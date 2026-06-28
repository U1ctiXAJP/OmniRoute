import { handleModeration } from "@omniroute/open-sse/handlers/moderations.ts";
import { withInjectionGuard } from "@/middleware/promptInjectionGuard";
import { parseModerationModel } from "@omniroute/open-sse/config/moderationRegistry.ts";
import { v1ModerationSchema } from "@/shared/validation/schemas";
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

async function postHandler(request, context) {
  const parsed = await parseAndValidateBody(request, v1ModerationSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const model = body.model || "omni-moderation-latest";

  const policy = await enforcePolicyOrFail(request, model);
  if (!policy.success) return policy.response;

  const { provider } = parseModerationModel(model);
  const resolvedProvider = provider || "openai";

  const creds = await resolveProviderCredentialsOrFail(resolvedProvider);
  if (!creds.success) return creds.response;

  const response = await handleModeration({
    body: { ...body, model },
    credentials: creds.credentials,
  });
  if (response?.ok) {
    await clearRecoveredProviderState(creds.credentials);
  }
  return response;
}

export const POST = withInjectionGuard(postHandler);
