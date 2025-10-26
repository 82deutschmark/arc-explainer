/**
 * Author: gpt-5-codex
 * Date: 2025-10-17T00:00:00Z
 * PURPOSE: Ensures the shared streaming configuration keeps streaming enabled by default
 * even when NODE_ENV is production while still respecting explicit environment overrides.
 * SRP/DRY check: Pass — scoped to resolveStreamingConfig() behaviours only.
 */

import test from "node:test";
import { strict as assert } from "node:assert";

import { resolveStreamingConfig } from "../shared/config/streaming.ts";

test("resolveStreamingConfig keeps streaming enabled by default in production", (t) => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    legacyBackend: process.env.ENABLE_SSE_STREAMING,
    frontend: process.env.VITE_STREAMING_ENABLED,
    legacyFrontend: process.env.VITE_ENABLE_SSE_STREAMING,
    nodeEnv: process.env.NODE_ENV,
  };

  delete process.env.STREAMING_ENABLED;
  delete process.env.ENABLE_SSE_STREAMING;
  delete process.env.VITE_STREAMING_ENABLED;
  delete process.env.VITE_ENABLE_SSE_STREAMING;
  process.env.NODE_ENV = "production";

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.ENABLE_SSE_STREAMING = previousEnv.legacyBackend;
    process.env.VITE_STREAMING_ENABLED = previousEnv.frontend;
    process.env.VITE_ENABLE_SSE_STREAMING = previousEnv.legacyFrontend;
    process.env.NODE_ENV = previousEnv.nodeEnv;
  });

  const config = resolveStreamingConfig();

  assert.equal(config.enabled, true, "Streaming should remain enabled by default in production");
  assert.equal(config.backendSource, undefined, "No backend override should be detected");
  assert.equal(config.frontendSource, undefined, "No frontend override should be detected");
  assert.equal(config.defaultValue, true, "Default value should reflect the optimistic streaming fallback");
});

test("resolveStreamingConfig honors explicit false overrides", (t) => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  };

  process.env.STREAMING_ENABLED = "false";
  process.env.NODE_ENV = "production";

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.NODE_ENV = previousEnv.nodeEnv;
  });

  const config = resolveStreamingConfig();

  assert.equal(config.enabled, false, "Explicit false flag should disable streaming");
  assert.equal(config.backendSource?.key, "STREAMING_ENABLED");
  assert.equal(config.backendSource?.value, false);
});
