# Custom Extensions

This directory is intended for downstream fork customizations to OmniRoute.
By placing your custom providers, routing strategies, and middleware here, you can prevent merge conflicts when syncing with the upstream repository.

## Structure

- `providers/`: Custom provider definitions.
- `strategies/`: Custom routing strategies for combos.
- `middleware/`: Custom authorization/request middleware.

## Usage

OmniRoute dynamically loads extensions from these folders. Each extension should follow the project's standard patterns for those components.
