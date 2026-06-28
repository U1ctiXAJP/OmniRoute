# Custom Extensions

This directory is intended for downstream fork customizations (new providers, routing strategies, and middleware).

## Structure
- `providers/`: Place custom provider definitions here. Update `registry.ts`.
- `strategies/`: Implement custom routing logic here. Update `registry.ts`.
- `middleware/`: Register custom authorization/request middleware here. Update `registry.ts`.

## Syncing with Upstream
The files in this directory are configured to avoid merge conflicts with the upstream repository. Core logic imports from these registries, which are initialized as empty.

See `docs/architecture/CUSTOM_EXTENSIONS.md` for more details.
