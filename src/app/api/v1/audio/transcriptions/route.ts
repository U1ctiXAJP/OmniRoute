// Allow large audio/video file uploads — 5min for processing large files (up to 2GB)
export const maxDuration = 300;
import { handleAudioTranscription } from "@omniroute/open-sse/handlers/audioTranscription.ts";
import {
  parseTranscriptionModel,
  getTranscriptionProvider,
  buildDynamicAudioProvider,
  type ProviderNodeRow,
} from "@omniroute/open-sse/config/audioRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { getProviderNodes } from "@/lib/localDb";
import { attachOmniRouteMetaToResponse } from "@/domain/omnirouteResponseMeta";
import { generateRequestId } from "@/shared/utils/requestId";
import {
  handleCorsOptions,
  enforcePolicyOrFail,
  resolveProviderCredentialsOrFail,
  clearRecoveredProviderState,
  isLocalNetworkHost,
} from "@/app/api/v1/_shared/routeHelpers";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid multipart form data");
  }

  const startTime = Date.now();

  const model = formData.get("model");
  if (!model) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }

  const policy = await enforcePolicyOrFail(request, model as string);
  if (!policy.success) return policy.response;

  let dynamicProviders: ReturnType<typeof buildDynamicAudioProvider>[] = [];
  try {
    const nodes = await getProviderNodes();
    dynamicProviders = (Array.isArray(nodes) ? (nodes as unknown as ProviderNodeRow[]) : [])
      .filter((n: ProviderNodeRow) => {
        if (n.apiType !== "chat" && n.apiType !== "responses") return false;
        return isLocalNetworkHost(n.baseUrl);
      })
      .map((n) => buildDynamicAudioProvider(n, "/audio/transcriptions"));
  } catch {
    // DB error — fall back to hardcoded providers only
  }

  const { provider, model: resolvedModel } = parseTranscriptionModel(
    model as string,
    dynamicProviders
  );
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid transcription model: ${model}. Use format: provider/model`
    );
  }

  const providerConfig =
    getTranscriptionProvider(provider) || dynamicProviders.find((dp) => dp.id === provider) || null;

  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    const creds = await resolveProviderCredentialsOrFail(provider);
    if (!creds.success) return creds.response;
    credentials = creds.credentials;
  }

  let response = await handleAudioTranscription({
    formData,
    credentials,
    resolvedProvider: providerConfig,
    resolvedModel,
  });
  if (response?.ok) {
    await clearRecoveredProviderState(credentials);
    response = attachOmniRouteMetaToResponse(response, {
      provider,
      model: resolvedModel,
      costUsd: 0,
      latencyMs: Date.now() - startTime,
      requestId: generateRequestId(),
    });
  }
  return response;
}
