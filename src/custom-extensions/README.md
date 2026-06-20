# Custom Extensions

This directory is reserved for custom extensions to the OmniRoute architecture.
It allows for adding custom providers, routing strategies, and middleware without modifying core files,
thus minimizing merge conflicts when syncing with the upstream repository.

## Structure

- `providers/`: Custom provider implementations. Register them in `registry.ts`.
- `strategies/`: Custom routing strategies. Register them in `registry.ts`.
- `middleware/`: Custom authz middleware. Add them to the array in `registry.ts`.

## Git Workflow

Boilerplate files (`.gitkeep`, `registry.ts`, and `README.md`) are tracked by Git.
Individual custom implementation files should be ignored by Git (configured in `.gitignore`).
