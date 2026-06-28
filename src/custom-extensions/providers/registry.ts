import type { RegistryEntry } from "../../open-sse/config/providers/shared.ts";

/**
 * Custom provider registry for downstream fork customizations.
 * Add your custom provider definitions here.
 * They will be automatically merged into the core REGISTRY.
 */
export const CUSTOM_REGISTRY: Record<string, RegistryEntry> = {
  // Example:
  // "custom-provider": { ... }
};
