import { handleRerank } from "@omniroute/open-sse/handlers/rerank.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import { parseRerankModel, getRerankProvider } from "@omniroute/open-sse/config/rerankRegistry.ts";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { v1RerankSchema } from "@/shared/validation/schemas";
import { getProviderNodes } from "@/lib/localDb";
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

function buildDynamicRerankProvider(node: any) {
  let base = node.baseUrl || "";
  if (base.endsWith("/v1")) base = base.slice(0, -3);
  return {
    id: node.prefix,
    baseUrl: `${base}/v1/rerank`,
    authType: "apikey",
    authHeader: "bearer",
    providerId: node.id,
  };
}

async function postHandler(request, context) {
  const parsed = await parseAndValidateBody(request, v1RerankSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const policy = await enforcePolicyOrFail(request, body.model);
  if (!policy.success) return policy.response;

  let localProviders: ReturnType<typeof buildDynamicRerankProvider>[] = [];
  try {
    const nodes = await getProviderNodes();
    localProviders = (Array.isArray(nodes) ? nodes : [])
      .filter((n: any) => isLocalNetworkHost(n.baseUrl))
      .map((n) => {
        try {
          return buildDynamicRerankProvider(n);
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  } catch {
    // Non-critical — continue with cloud providers only
  }

  const { provider, model: modelId } = parseRerankModel(body.model);

  if (provider) {
    const creds = await resolveProviderCredentialsOrFail(provider);
    if (!creds.success) return creds.response;

    const response = await handleRerank({
      model: body.model,
      query: body.query,
      documents: body.documents,
      top_n: body.top_n,
      return_documents: body.return_documents,
      credentials: creds.credentials,
    });
    if (response?.ok) {
      await clearRecoveredProviderState(creds.credentials);
    }
    return response;
  }

  // Try local provider_nodes (model format: prefix/model-name)
  const parts = body.model.split("/");
  if (parts.length >= 2) {
    const prefix = parts[0];
    const localModel = parts.slice(1).join("/");
    const localProvider = localProviders.find((p) => p.id === prefix);

    if (localProvider) {
      const creds = await resolveProviderCredentialsOrFail(
        localProvider.providerId,
        "local provider"
      );
      if (!creds.success) return creds.response;

      const token = (creds.credentials as any)?.apiKey || (creds.credentials as any)?.accessToken;
      try {
        const res = await fetch(localProvider.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: localModel,
            query: body.query,
            documents: body.documents,
            top_n: body.top_n || body.documents.length,
            return_documents: body.return_documents !== false,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return errorResponse(
            res.status,
            errData.message || errData.detail || `Provider returned HTTP ${res.status}`
          );
        }

        const data = await res.json();
        return Response.json(data, {
          headers: {},
        });
      } catch (err: any) {
        return errorResponse(500, `Rerank request failed: ${err.message}`);
      }
    }
  }

  return errorResponse(
    HTTP_STATUS.BAD_REQUEST,
    `Invalid rerank model: ${body.model}. Use format: provider/model`
  );
}

export const POST = withInjectionGuard(postHandler);
