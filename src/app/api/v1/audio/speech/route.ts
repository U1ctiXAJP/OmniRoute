import { handleAudioSpeech } from "@omniroute/open-sse/handlers/audioSpeech.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import {
  parseSpeechModel,
  getSpeechProvider,
  buildDynamicAudioProvider,
  type ProviderNodeRow,
} from "@omniroute/open-sse/config/audioRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { getProviderNodes } from "@/lib/localDb";
import { v1AudioSpeechSchema } from "@/shared/validation/schemas";
import { attachOmniRouteMetaToResponse } from "@/domain/omnirouteResponseMeta";
import { calculateModalCost } from "@/lib/usage/costCalculator";
import { generateRequestId } from "@/shared/utils/requestId";
import {
  handleCorsOptions,
  parseAndValidateBody,
  enforcePolicyOrFail,
  resolveProviderCredentialsOrFail,
  clearRecoveredProviderState,
  isLocalNetworkHost,
} from "@/app/api/v1/_shared/routeHelpers";

export async function OPTIONS() {
  return handleCorsOptions();
}

async function postHandler(request, context) {
  const parsed = await parseAndValidateBody(request, v1AudioSpeechSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const startTime = Date.now();

  const policy = await enforcePolicyOrFail(request, body.model);
  if (!policy.success) return policy.response;

  let dynamicProviders: ReturnType<typeof buildDynamicAudioProvider>[] = [];
  try {
    const nodes = await getProviderNodes();
    dynamicProviders = (Array.isArray(nodes) ? (nodes as unknown as ProviderNodeRow[]) : [])
      .filter((n: ProviderNodeRow) => {
        if (n.apiType !== "chat" && n.apiType !== "responses") return false;
        return isLocalNetworkHost(n.baseUrl);
      })
      .map((n) => buildDynamicAudioProvider(n, "/audio/speech"));
  } catch {
    // DB error — fall back to hardcoded providers only
  }

  const { provider, model: resolvedModel } = parseSpeechModel(body.model, dynamicProviders);
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid speech model: ${body.model}. Use format: provider/model`
    );
  }

  const providerConfig =
    getSpeechProvider(provider) || dynamicProviders.find((dp) => dp.id === provider) || null;

  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    const creds = await resolveProviderCredentialsOrFail(provider);
    if (!creds.success) return creds.response;
    credentials = creds.credentials;
  }

  let response = await handleAudioSpeech({
    body,
    credentials,
    resolvedProvider: providerConfig,
    resolvedModel,
  });
  if (response?.ok) {
    await clearRecoveredProviderState(credentials);
    const characters = typeof body.input === "string" ? body.input.length : 0;
    const costUsd = await calculateModalCost("audio", provider, resolvedModel || body.model, {
      characters,
    });
    response = attachOmniRouteMetaToResponse(response, {
      provider,
      model: resolvedModel || body.model,
      costUsd,
      latencyMs: Date.now() - startTime,
      requestId: generateRequestId(),
    });
  }
  return response;
}

export const POST = withInjectionGuard(postHandler);
