---
title: "Custom Extensions Architecture"
---

# Custom Extensions Architecture

To prevent merge conflicts when syncing downstream forks with the upstream OmniRoute repository, a modular extension architecture is provided.

Downstream developers should place their custom logic in the `src/custom-extensions/` directory. This directory is configured in `.gitignore` to avoid accidental commits of local customizations while providing dynamic loading hooks in the core logic.

## Directory Structure

```
src/custom-extensions/
├── README.md
├── providers/
│   └── registry.ts      # Custom provider definitions
├── strategies/
│   └── registry.ts      # Custom routing strategies
└── middleware/
    └── registry.ts      # Custom auth/request middleware
```

## Extension Points

### 1. Custom Providers
Add new LLM providers by defining them in `src/custom-extensions/providers/registry.ts`. These are merged into the core `REGISTRY` and become available for all routing operations.

### 2. Custom Routing Strategies
Implement custom combo routing logic in `src/custom-extensions/strategies/registry.ts`. Custom strategies can reorder or filter targets based on request context.

### 3. Custom Middleware
Register custom middleware functions in `src/custom-extensions/middleware/registry.ts`. These run during the authorization pipeline and can intercept or modify requests before they reach core handlers.

## Best Practices
- Always use the `src/custom-extensions/` folder for fork-specific logic.
- Keep the `registry.ts` files clean to minimize sync conflicts.
- Follow the existing project patterns and types for each extension point.
