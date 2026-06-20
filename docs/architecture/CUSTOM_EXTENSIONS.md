# Modular Architecture for Custom Extensions

This document describes the architectural approach for extending OmniRoute without causing merge conflicts with the upstream repository.

## Overview

To ensure seamless updates from the upstream `diegosouzapw/OmniRoute` repository, all custom logic should be placed in the `src/custom-extensions/` directory. Core components have been modified to dynamically load extensions from this directory.

## Extension Points

### 1. Custom Providers
- **Location**: `src/custom-extensions/providers/`
- **Registration**: Add your provider implementation to `CUSTOM_REGISTRY` in `src/custom-extensions/providers/registry.ts`.
- **Integration**: Merged into the core `REGISTRY` in `open-sse/config/providers/index.ts`.

### 2. Custom Routing Strategies
- **Location**: `src/custom-extensions/strategies/`
- **Registration**: Add your strategy handler to `CUSTOM_STRATEGIES` in `src/custom-extensions/strategies/registry.ts`.
- **Integration**: Checked in `open-sse/services/combo.ts` before built-in strategies.

### 3. Custom Middleware
- **Location**: `src/custom-extensions/middleware/`
- **Registration**: Add your middleware function to the `CUSTOM_MIDDLEWARE` array in `src/custom-extensions/middleware/registry.ts`.
- **Integration**: Executed in `src/server/authz/pipeline.ts` after route classification but before policy evaluation.

## Private Synced Repo Workflow

To maintain a private fork that stays in sync with the public upstream while keeping your custom extensions, follow this workflow:

### 1. Initial Setup (Mirror Clone)
Create a bare clone of the upstream repository and push it to your private repository:
```bash
git clone --bare https://github.com/diegosouzapw/OmniRoute.git
cd OmniRoute.git
git push --mirror https://github.com/your-org/your-private-omniroute.git
cd ..
rm -rf OmniRoute.git
```

### 2. Working on Your Fork
Clone your private repository and add the original as an upstream remote:
```bash
git clone https://github.com/your-org/your-private-omniroute.git
cd your-private-omniroute
git remote add upstream https://github.com/diegosouzapw/OmniRoute.git
```

### 3. Syncing with Upstream
Periodically fetch updates and rebase your changes:
```bash
git fetch upstream
git rebase upstream/main
git push origin main --force
```

By using the `src/custom-extensions/` directory (which is mostly ignored by Git except for boilerplate) and following this rebase workflow, you can maintain your private customizations with minimal conflict.
