import test from "node:test";
import assert from "node:assert/strict";
import { REGISTRY } from "../../open-sse/config/providers/index.ts";
import { CUSTOM_REGISTRY } from "../../src/custom-extensions/providers/registry.ts";
import { CUSTOM_STRATEGIES } from "../../src/custom-extensions/strategies/registry.ts";
import { CUSTOM_MIDDLEWARE } from "../../src/custom-extensions/middleware/registry.ts";

test("custom extensions registries are exported", () => {
  assert.ok(CUSTOM_REGISTRY, "CUSTOM_REGISTRY should be exported");
  assert.ok(CUSTOM_STRATEGIES, "CUSTOM_STRATEGIES should be exported");
  assert.ok(CUSTOM_MIDDLEWARE, "CUSTOM_MIDDLEWARE should be exported");
});

test("core registry is a record", () => {
  // Just verify it's a record.
  assert.equal(typeof REGISTRY, "object");
});
