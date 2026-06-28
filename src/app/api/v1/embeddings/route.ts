import {
  parseEmbeddingModel,
  getAllEmbeddingModels,
} from "@omniroute/open-sse/config/embeddingRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { isRequireApiKeyEnabled } from "@/shared/utils/featureFlags";
import { v1EmbeddingsSchema } from "@/shared/validation/schemas";

import { getAllCustomModels, getApiKeyMetadata } from "@/lib/localDb";
import { createEmbeddingResponse, type EmbeddingHandlerOptions } from "@/lib/embeddings/service";
import { extractApiKey, isValidApiKey } from "@/sse/services/auth";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import {
  handleCorsOptions,
  parseAndValidateBody,
  enforcePolicyOrFail,
} from "@/app/api/v1/_shared/routeHelpers";

function toProviderScopedModelId(providerId: string, modelId: string): string {
  return modelId.startsWith(`${providerId}/`) ? modelId : `${providerId}/${modelId}`;
}

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  const builtInModels = getAllEmbeddingModels();
  const timestamp = Math.floor(Date.now() / 1000);

  const data = builtInModels.map((m) => ({
    id: m.id,
    object: "model",
    created: timestamp,
    owned_by: m.provider,
    type: "embedding",
    dimensions: m.dimensions,
  }));

  try {
    const customModelsMap = (await getAllCustomModels()) as Record<string, any>;
    for (const [providerId, models] of Object.entries(customModelsMap)) {
      if (!Array.isArray(models)) continue;
      for (const model of models) {
        if (!model?.id || !Array.isArray(model.supportedEndpoints)) continue;
        if (!model.supportedEndpoints.includes("embeddings")) continue;
        const fullId = toProviderScopedModelId(providerId, model.id);
        if (data.some((d) => d.id === fullId)) continue;
        data.push({
          id: fullId,
          object: "model",
          created: timestamp,
          owned_by: providerId,
          type: "embedding",
          dimensions: null,
        });
      }
    }
  } catch {}

  return new Response(JSON.stringify({ object: "list", data }), {
    headers: { "Content-Type": "application/json" },
  });
}

type ValidatedEmbeddingBody = Record<string, unknown> & { model: string };

export async function handleValidatedEmbeddingRequestBody(
  body: ValidatedEmbeddingBody,
  options: EmbeddingHandlerOptions = {}
) {
  return createEmbeddingResponse(body, options);
}

async function postHandler(request, context) {
  const parsed = await parseAndValidateBody(request, v1EmbeddingsSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Auth check
  const apiKeyRaw = extractApiKey(request);
  if (isRequireApiKeyEnabled() && !apiKeyRaw) {
    return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Authentication required");
  }
  if (apiKeyRaw && !(await isValidApiKey(apiKeyRaw))) {
    return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }

  const policy = await enforcePolicyOrFail(request, body.model);
  if (!policy.success) return policy.response;

  // Extract API key info for logging
  const apiKeyMeta = apiKeyRaw ? await getApiKeyMetadata(apiKeyRaw) : null;

  // Build client raw request for logging
  const clientRawRequest = {
    endpoint: "/v1/embeddings",
    body: parsed.rawBody,
    headers: Object.fromEntries(request.headers.entries()),
  };

  return handleValidatedEmbeddingRequestBody(body as ValidatedEmbeddingBody, {
    clientRawRequest,
    apiKeyId: apiKeyMeta?.id || null,
    apiKeyName: apiKeyMeta?.name || null,
    connectionId: null,
  });
}

export const POST = withInjectionGuard(postHandler);
