import { handleMusicGeneration } from "@omniroute/open-sse/handlers/musicGeneration.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import {
  parseMusicModel,
  getAllMusicModels,
  getMusicProvider,
} from "@omniroute/open-sse/config/musicRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import * as log from "@/sse/utils/logger";
import { toJsonErrorPayload } from "@/shared/utils/upstreamError";
import { v1ImageGenerationSchema } from "@/shared/validation/schemas";
import { attachOmniRouteMetaHeaders } from "@/domain/omnirouteResponseMeta";
import { calculateModalCost } from "@/lib/usage/costCalculator";
import { generateRequestId } from "@/shared/utils/requestId";
import {
  handleCorsOptions,
  parseAndValidateBody,
  enforcePolicyOrFail,
  resolveProviderCredentialsOrFail,
  clearRecoveredProviderState,
} from "@/app/api/v1/_shared/routeHelpers";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  const models = getAllMusicModels();
  return new Response(
    JSON.stringify({
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: m.provider,
        type: "music",
      })),
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function postHandler(request, context) {
  const parsed = await parseAndValidateBody(request, v1ImageGenerationSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const startTime = Date.now();

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Prompt is required");
  }

  const policy = await enforcePolicyOrFail(request, body.model);
  if (!policy.success) return policy.response;

  const { provider } = parseMusicModel(body.model);
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid music model: ${body.model}. Use format: provider/model`
    );
  }

  const providerConfig = getMusicProvider(provider);

  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    const creds = await resolveProviderCredentialsOrFail(provider, "music provider");
    if (!creds.success) return creds.response;
    credentials = creds.credentials;
  }

  const result = await handleMusicGeneration({ body, credentials, log });

  if (result.success) {
    await clearRecoveredProviderState(credentials);
    const seconds = Number(body.duration) || 0;
    const costUsd = await calculateModalCost("audio", provider, body.model, { seconds });
    const headers = new Headers({ "Content-Type": "application/json" });
    attachOmniRouteMetaHeaders(headers, {
      provider,
      model: body.model,
      costUsd,
      latencyMs: Date.now() - startTime,
      requestId: generateRequestId(),
    });
    return new Response(JSON.stringify((result as { data: unknown }).data), {
      status: 200,
      headers,
    });
  }

  const errorPayload = toJsonErrorPayload((result as any).error, "Music generation provider error");
  return new Response(JSON.stringify(errorPayload), {
    status: (result as any).status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST = withInjectionGuard(postHandler);
