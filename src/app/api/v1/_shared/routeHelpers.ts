import { z } from "zod";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";
import { getProviderCredentials, clearRecoveredProviderState } from "@/sse/services/auth";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { isAllRateLimitedCredentials, rateLimitedProviderResponse } from "./rateLimit";
import { handleCorsOptions } from "@/shared/utils/cors";

/**
 * Standard CORS preflight handler using the centralized CORS headers.
 * Routes should export this as their OPTIONS handler.
 */
export { handleCorsOptions };

// ─── JSON Body Parsing + Validation ─────────────────────────────────────────

type ParsedBodySuccess<T> = { success: true; data: T; rawBody: unknown };
type ParsedBodyFailure = { success: false; response: Response };
type ParsedBodyResult<T> = ParsedBodySuccess<T> | ParsedBodyFailure;

/**
 * Parse a JSON request body and validate it against a Zod schema in one step.
 * Returns either validated data or an error Response ready to return.
 *
 * Usage:
 * ```ts
 * const parsed = await parseAndValidateBody(request, mySchema);
 * if (!parsed.success) return parsed.response;
 * const body = parsed.data;
 * ```
 */
export async function parseAndValidateBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<ParsedBodyResult<z.infer<TSchema>>> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      response: errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body"),
    };
  }

  const validation = validateBody(schema, rawBody);
  if (isValidationFailure(validation)) {
    return {
      success: false,
      response: errorResponse(HTTP_STATUS.BAD_REQUEST, validation.error.message),
    };
  }

  return { success: true, data: validation.data, rawBody };
}

// ─── Provider Credential Resolution ─────────────────────────────────────────

type CredentialSuccess = { success: true; credentials: Record<string, unknown> };
type CredentialFailure = { success: false; response: Response };
type CredentialResult = CredentialSuccess | CredentialFailure;

/**
 * Resolve provider credentials and check for rate limiting in one step.
 * Returns credentials or an error Response.
 *
 * Usage:
 * ```ts
 * const creds = await resolveProviderCredentialsOrFail(provider);
 * if (!creds.success) return creds.response;
 * const credentials = creds.credentials;
 * ```
 */
export async function resolveProviderCredentialsOrFail(
  provider: string,
  label?: string
): Promise<CredentialResult> {
  const credentials = await getProviderCredentials(provider);
  if (!credentials) {
    const displayLabel = label || "provider";
    return {
      success: false,
      response: errorResponse(
        HTTP_STATUS.BAD_REQUEST,
        `No credentials for ${displayLabel}: ${provider}`
      ),
    };
  }
  if (isAllRateLimitedCredentials(credentials)) {
    return {
      success: false,
      response: rateLimitedProviderResponse(provider, credentials),
    };
  }
  return { success: true, credentials };
}

// ─── API Key Policy Enforcement ─────────────────────────────────────────────

type PolicySuccess = { success: true };
type PolicyFailure = { success: false; response: Response };
type PolicyResult = PolicySuccess | PolicyFailure;

/**
 * Enforce API key policies and return an error response if rejected.
 *
 * Usage:
 * ```ts
 * const policy = await enforcePolicyOrFail(request, model);
 * if (!policy.success) return policy.response;
 * ```
 */
export async function enforcePolicyOrFail(request: Request, model: string): Promise<PolicyResult> {
  const policy = await enforceApiKeyPolicy(request, model);
  if (policy.rejection) {
    return { success: false, response: policy.rejection };
  }
  return { success: true };
}

// ─── Localhost / Private Network Filtering ──────────────────────────────────

/**
 * Private network regex matching Docker's 172.16.0.0/12 range.
 * Used for SSRF hardening — only local provider nodes are trusted.
 */
const DOCKER_PRIVATE_RANGE_RE = /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/;

/**
 * Check if a URL's hostname is a local/private network address.
 * Returns true for localhost, 127.0.0.1, and Docker 172.16.0.0/12 range.
 * Explicitly blocks ::1 (IPv6 loopback) per SSRF hardening policy.
 */
export function isLocalNetworkHost(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname;
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || DOCKER_PRIVATE_RANGE_RE.test(hostname)
    );
  } catch {
    return false;
  }
}

// ─── Generation Response Helpers ────────────────────────────────────────────

export { clearRecoveredProviderState };
