import { handleVideoGeneration } from "@omniroute/open-sse/handlers/videoGeneration.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import {
  parseVideoModel,
  getAllVideoModels,
  getVideoProvider,
} from "@omniroute/open-sse/config/videoRegistry.ts";
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
  const models = getAllVideoModels();
  return new Response(
    JSON.stringify({
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: m.provider,
        type: "video",
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

  const { provider } = parseVideoModel(body.model);
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid video model: ${body.model}. Use format: provider/model`
    );
  }

  const providerConfig = getVideoProvider(provider);

  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    const creds = await resolveProviderCredentialsOrFail(provider, "video provider");
    if (!creds.success) return creds.response;
    credentials = creds.credentials;
  }

  const result = await handleVideoGeneration({ body, credentials, log });

  if (result.success) {
    await clearRecoveredProviderState(credentials);
    const seconds = Number(body.duration) || 0;
    const costUsd = await calculateModalCost("video", provider, body.model, { seconds });
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

  const errorPayload = toJsonErrorPayload((result as any).error, "Video generation provider error");
  return new Response(JSON.stringify(errorPayload), {
    status: (result as any).status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST = withInjectionGuard(postHandler);
