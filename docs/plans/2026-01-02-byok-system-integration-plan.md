# BYOK (Bring Your Own Key) System Integration Plan

**Date:** 2026-01-02
**Author:** Claude Haiku 4.5
**Status:** Planning – Implementation ready
**Scope:** Comprehensive BYOK architecture across all provider integrations

---

## 1. Problem Statement

Current state:
- **Poetiq**: Implements BYOK with provider-specific whitelisting (OpenRouter free models fallback to server key)
- **SnakeBench**: Uses server API key only, no BYOK
- **Council**: Uses hardcoded server OPENROUTER_API_KEY, no BYOK support yet
- **Inconsistency**: Users cannot provide their own keys for Council despite incurring real costs
- **Provider Chaos**: Different services support different providers (Poetiq: Gemini + OpenRouter; Council: OpenRouter only)
- **Architecture Gap**: No centralized BYOK provider/model registry; logic duplicated across controllers

---

## 2. Goals & Non-Goals

| Goal | Details |
|------|---------|
| G1 | Implement unified BYOK system supporting all providers (OpenAI, Anthropic, Gemini, xAI, OpenRouter). |
| G2 | Expose BYOK requirements via `/api/config` endpoint so frontend knows which services require keys. |
| G3 | Integrate BYOK into Council assessment (both `/api/council/assess` and `/api/council/assess/stream`). |
| G4 | Add provider/model registry defining which models require BYOK and which can use server keys. |
| G5 | Centralize BYOK validation logic to prevent duplication and divergence. |
| G6 | Never persist API keys server-side; pass keys only via request lifecycle. |
| Non-goals | Changing existing Poetiq/SnakeBench implementations (backward compatible); OAuth/federated auth; key rotation. |

---

## 3. Architecture Overview

### 3.1 BYOK Provider & Model Registry

Location: `server/config/byokRegistry.ts` (new file)

```ts
import { requiresUserApiKey, isDevelopment } from '../utils/environmentPolicy.ts';

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter';

export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  envVarName: string;
  envKeyExists: boolean;
  alwaysRequiresByo: boolean; // In dev, does this provider ALWAYS require BYOK?
}

// Provider registry
export const BYOK_PROVIDERS: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    envVarName: 'OPENAI_API_KEY',
    envKeyExists: !!process.env.OPENAI_API_KEY,
    alwaysRequiresByo: false, // Can use server key in dev if env var set
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    envVarName: 'ANTHROPIC_API_KEY',
    envKeyExists: !!process.env.ANTHROPIC_API_KEY,
    alwaysRequiresByo: false,
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    envVarName: 'GEMINI_API_KEY',
    envKeyExists: !!process.env.GEMINI_API_KEY,
    alwaysRequiresByo: true, // No free tier, always requires user key
  },
  xai: {
    name: 'xai',
    displayName: 'xAI (Grok)',
    envVarName: 'XAI_API_KEY',
    envKeyExists: !!process.env.XAI_API_KEY,
    alwaysRequiresByo: true,
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    envVarName: 'OPENROUTER_API_KEY',
    envKeyExists: !!process.env.OPENROUTER_API_KEY,
    alwaysRequiresByo: false,
  },
};

// OpenRouter models with free tier (can use server key in dev)
const OPENROUTER_FREE_MODELS = new Set([
  'openrouter/kwaipilot/kat-coder-pro:free',
  'openrouter/arcee-ai/trinity-mini:free',
  'openrouter/amazon/nova-2-lite-v1:free',
]);

/**
 * Determine if a model requires BYOK.
 *
 * PRODUCTION: Always require BYOK (via requiresUserApiKey())
 * DEVELOPMENT:
 *   - Gemini/xAI: Always require BYOK (no free tier)
 *   - OpenRouter: Only non-free models require BYOK; free models can use server key
 *   - Others: Can use server key if env var set
 */
export function requiresByo(
  provider: ProviderName,
  modelKey?: string
): boolean {
  // Production always requires BYOK
  if (requiresUserApiKey()) {
    return true;
  }

  // Development: check provider-specific rules
  const config = BYOK_PROVIDERS[provider];
  if (!config) return true; // Unknown provider: require BYOK

  // Providers that always require BYOK even in dev
  if (config.alwaysRequiresByo) {
    return true;
  }

  // OpenRouter: only free models can use server key
  if (provider === 'openrouter') {
    return modelKey ? !OPENROUTER_FREE_MODELS.has(modelKey) : true;
  }

  // Others: no BYOK required in dev (server key fallback available)
  return false;
}

/**
 * Get server API key for provider (if available)
 */
export function getServerKey(provider: ProviderName): string | null {
  const config = BYOK_PROVIDERS[provider];
  if (!config) return null;
  return process.env[config.envVarName] || null;
}
```

### 3.2 BYOK Validation Service

Location: `server/services/byok/byokService.ts` (new file)

```ts
export interface ByokValidation {
  required: boolean;
  provider: ProviderName;
  message?: string; // Reason why BYOK is required
}

export interface ByokPayload {
  apiKey?: string;
  provider?: ProviderName;
}

/**
 * Determine if a model requires BYOK
 */
export function validateByokRequirement(
  modelKey: string,
  provider: ProviderName
): ByokValidation {
  if (requiresByo(provider, modelKey)) {
    return {
      required: true,
      provider,
      message: `${BYOK_PROVIDERS[provider]?.displayName} requires your API key. Your key is used for this session only and is never stored.`,
    };
  }

  return { required: false, provider };
}

/**
 * Validate that BYOK requirements are met
 */
export function validateByokProvided(
  validation: ByokValidation,
  payload: ByokPayload
): { valid: boolean; error?: string } {
  if (!validation.required) return { valid: true };

  if (!payload.apiKey?.trim()) {
    return {
      valid: false,
      error: validation.message || 'API key is required but not provided.',
    };
  }

  if (!payload.provider) {
    return {
      valid: false,
      error: 'Provider must be specified when using BYOK.',
    };
  }

  return { valid: true };
}

/**
 * Select API key (user key if provided, else fall back to server key)
 */
export function resolveApiKey(
  provider: ProviderName,
  userKey?: string
): { key: string; source: 'user' | 'server' } | null {
  if (userKey?.trim()) {
    return { key: userKey, source: 'user' };
  }

  const serverKey = getServerKey(provider);
  if (serverKey) {
    return { key: serverKey, source: 'server' };
  }

  return null;
}

/**
 * Scrub BYOK data from logs/responses (never include keys)
 */
export function scrubByokFromLog(data: any): any {
  const scrubbed = { ...data };
  delete scrubbed.apiKey;
  delete scrubbed.api_key;
  delete scrubbed.key;
  return scrubbed;
}
```

### 3.3 Global Config Endpoint Enhancement

Update `server/routes.ts` (around line 68):

```ts
app.get("/api/config", (_req, res) => {
  const config = {
    requiresUserApiKey: requiresUserApiKey(),
    isProduction: isProduction(),
    environment: process.env.NODE_ENV || 'development',

    // NEW: BYOK provider registry
    byokProviders: Object.entries(BYOK_PROVIDERS).map(([key, cfg]) => ({
      name: cfg.name,
      displayName: cfg.displayName,
      envKeyExists: cfg.envKeyExists,
      models: cfg.models,
      freeModels: cfg.freeModels || [],
      requiresByo: cfg.requiresByo,
    })),

    // NEW: Which services require BYOK
    services: {
      poetiq: { requiresByo: requiresUserApiKey() },
      council: { requiresByo: requiresUserApiKey() },
      snakeBench: { requiresByo: false },
      reArc: { requiresByo: false },
    },
  };

  return res.json(formatResponse.success(config));
});
```

---

## 4. Council Integration (Primary Target)

### 4.1 Backend: Council Controller

Update `server/controllers/councilController.ts`:

**Change signature of `streamAssessment`:**
```ts
export async function streamAssessment(req: Request, res: Response): Promise<void> {
  const { taskId, mode, explanationIds, apiKey, provider } = req.body;

  if (!taskId || !mode) {
    return res.status(400).json(formatResponse.error('INVALID_REQUEST', 'taskId and mode required'));
  }

  // Validate mode
  if (!['solve', 'assess'].includes(mode)) {
    return res.status(400).json(formatResponse.error('INVALID_MODE', 'Mode must be "solve" or "assess"'));
  }

  // Validate explanations for assess mode
  if (mode === 'assess' && (!explanationIds?.length)) {
    return res.status(400).json(formatResponse.error('MISSING_EXPLANATIONS', 'Assessment mode requires explanationIds'));
  }

  // NEW: BYOK validation
  const byokValidation = validateByokRequirement(
    'openrouter/default', // Council uses OpenRouter by default
    (provider as ProviderName) || 'openrouter'
  );

  const byokCheck = validateByokProvided(byokValidation, { apiKey, provider: (provider as ProviderName) || 'openrouter' });
  if (!byokCheck.valid) {
    return res.status(400).json(formatResponse.error('API_KEY_REQUIRED', byokCheck.error));
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // Check health
    const isHealthy = await councilBridge.healthCheck();
    if (!isHealthy) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Council service unavailable' })}\n\n`);
      res.end();
      return;
    }

    logger.info(`[CouncilController] Starting ${mode} assessment`, scrubByokFromLog({ taskId, apiKey }));
    res.write(`data: ${JSON.stringify({ type: 'start', message: `Beginning ${mode}` })}\n\n`);

    // NEW: Pass apiKey to service
    const result = await councilService.assessPuzzle(
      { taskId, mode, explanationIds, apiKey, provider: (provider as ProviderName) || 'openrouter' },
      (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
    res.end();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Stream failed';
    logger.error('[CouncilController] Stream failed:', scrubByokFromLog({ error: errMsg }));
    res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
    res.end();
  }
}
```

### 4.2 Backend: Council Service

Update `server/services/council/councilService.ts`:

```ts
export interface CouncilAssessmentRequest {
  taskId: string;
  mode: 'solve' | 'assess';
  explanationIds?: number[];
  apiKey?: string;        // NEW: User-provided API key
  provider?: ProviderName; // NEW: Provider for the key
}

export async function assessPuzzle(
  request: CouncilAssessmentRequest,
  onEvent?: (evt: any) => void
): Promise<CouncilAssessmentResult> {
  // Existing health check...
  const isHealthy = await councilBridge.healthCheck();
  if (!isHealthy) {
    throw new Error('LLM Council service unavailable. Ensure Python wrapper and llm-council submodule present.');
  }

  // Load puzzle...
  const puzzle = await puzzleLoader.loadPuzzle(request.taskId);
  if (!puzzle) {
    throw new Error(`Puzzle ${request.taskId} not found`);
  }

  // NEW: Resolve API key (user key if provided, else server key)
  const keyResolution = resolveApiKey(
    request.provider || 'openrouter',
    request.apiKey
  );

  if (!keyResolution) {
    throw new Error('No API key available for council assessment. Provide your own or set OPENROUTER_API_KEY.');
  }

  // Build prompt (unchanged)
  let prompt: string;
  if (request.mode === 'assess' && request.explanationIds?.length) {
    const explanations = await loadExplanations(request.explanationIds);
    prompt = buildAssessPrompt({ ...puzzle, taskId: request.taskId }, explanations);
  } else {
    prompt = buildSolvePrompt({ ...puzzle, taskId: request.taskId });
  }

  // NEW: Pass API key to council bridge
  const response = await councilBridge.runCouncil(
    prompt,
    keyResolution.key,      // User or server key
    request.provider || 'openrouter',
    onEvent
  );

  // ... rest of function (save result, etc.)
}
```

### 4.3 Backend: Council Bridge

Update `server/services/council/councilBridge.ts`:

```ts
export async function runCouncil(
  query: string,
  apiKey: string,         // NEW: Required parameter
  provider: ProviderName, // NEW: Provider name
  onEvent?: (evt: CouncilBridgeEvent) => void
): Promise<CouncilResponse> {
  return new Promise((resolve, reject) => {
    const pythonBin = resolvePythonBin();
    const wrapperPath = resolveWrapperPath();

    // Build environment with user key (or server key)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    // NEW: Set provider-specific API key (don't expose env var name to frontend)
    if (provider === 'openrouter') {
      env.OPENROUTER_API_KEY = apiKey;
    } else if (provider === 'openai') {
      env.OPENAI_API_KEY = apiKey;
    } else if (provider === 'anthropic') {
      env.ANTHROPIC_API_KEY = apiKey;
    }
    // ... etc for other providers

    const spawnOpts: SpawnOptions = {
      cwd: path.dirname(wrapperPath),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    logger.info('[CouncilBridge] Spawning council subprocess');
    const child = spawn(pythonBin, [wrapperPath], spawnOpts);

    // ... rest unchanged (streams, event handling, timeout, etc.)
  });
}
```

---

## 5. Frontend Integration

### 5.1 BYOK Config Hook

Create `client/src/hooks/useByokConfig.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

export function useByokConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/config');
      const data = await res.json();
      return data.data;
    },
    staleTime: Infinity,
  });
}

// Helper: Check if council requires BYOK
export function useCouncilRequiresByok() {
  const { data: config } = useByokConfig();
  return config?.services?.council?.requiresByo ?? false;
}
```

### 5.2 BYOK Input Component

Create `client/src/components/byok/ByokInput.tsx`:

```tsx
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { useByokConfig } from '@/hooks/useByokConfig';

export function ByokInput() {
  const { data: config } = useByokConfig();
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openrouter');

  if (!config?.byokProviders) return null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold">Provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.byokProviders.map((p: any) => (
              <SelectItem key={p.name} value={p.name}>
                {p.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">API Key</Label>
        <Input
          type="password"
          placeholder="Paste your API key here..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="text-sm font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Your key is used for this session only and never stored.
        </p>
      </div>

      {!apiKey && (
        <div className="flex gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>API key required</strong>
            Get one from{' '}
            {provider === 'openrouter' && <a href="https://openrouter.ai" className="underline">OpenRouter</a>}
            {provider === 'gemini' && <a href="https://aistudio.google.com" className="underline">Google AI Studio</a>}
            {provider === 'openai' && <a href="https://platform.openai.com" className="underline">OpenAI Platform</a>}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.3 Integration into LLMCouncil Component

Update `client/src/pages/LLMCouncil.tsx`:

```tsx
import { ByokInput } from '@/components/byok/ByokInput';
import { useCouncilRequiresByok } from '@/hooks/useByokConfig';

export default function LLMCouncil() {
  // ... existing state...
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openrouter');
  const councilRequiresByok = useCouncilRequiresByok();

  const handleStartAssessment = async () => {
    if (!selectedPuzzle) return;
    if (mode === 'assess' && selectedExplanationIds.length === 0) return;

    // NEW: Validate BYOK if required
    if (councilRequiresByok && !apiKey) {
      setStreamError('API key required. Please provide your key above.');
      return;
    }

    setIsStreaming(true);
    setStreamEvents([]);
    setStreamError(null);

    try {
      const body = {
        taskId: selectedPuzzle,
        mode,
        ...(mode === 'assess' && { explanationIds: selectedExplanationIds }),
        ...(councilRequiresByok && { apiKey, provider }), // NEW: Include BYOK
      };

      const res = await fetch('/api/council/assess/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: streamAbortController.current.signal,
      });

      // ... rest of streaming logic (unchanged)
    } catch (error) {
      // ... error handling
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    // ... existing layout ...
    {councilRequiresByok && (
      <>
        <Separator className="my-2" />
        <div>
          <h2 className="text-sm font-semibold text-purple-900 mb-3">API Key</h2>
          <ByokInput />
        </div>
      </>
    )}
    // ... rest of layout
  );
}
```

---

## 6. Existing Integration: Poetiq (Backward Compatible)

No changes required. Poetiq already implements BYOK correctly:
- Uses `requiresUserApiKey()` + provider whitelist
- Validates in controller before calling service
- Passes keys via request body
- Never logs/stores keys

Review point: Ensure Poetiq uses centralized `byokService` functions instead of inline validation.

---

## 7. Health Check Logging Strategy

Update `server/services/council/councilBridge.ts`:

```ts
interface HealthCheckState {
  lastFailure?: Date;
  failureCount: number;
  muteLogsUntil?: Date;
}

const healthCheckState: HealthCheckState = { failureCount: 0 };

export async function healthCheck(): Promise<boolean> {
  try {
    // ... existing checks ...

    if (/* checks fail */) {
      healthCheckState.failureCount++;

      // Mute logs after first failure for 5 minutes
      if (healthCheckState.failureCount === 1) {
        healthCheckState.muteLogsUntil = new Date(Date.now() + 5 * 60 * 1000);
        logger.warn('[CouncilBridge] Health check failed (will mute logs for 5 min)');
      } else if (!healthCheckState.muteLogsUntil || Date.now() > healthCheckState.muteLogsUntil.getTime()) {
        logger.warn('[CouncilBridge] Health check still failing...');
        healthCheckState.muteLogsUntil = new Date(Date.now() + 5 * 60 * 1000);
      }

      return false;
    }

    // Reset on success
    healthCheckState.failureCount = 0;
    healthCheckState.muteLogsUntil = undefined;
    return true;
  } catch (error) {
    // ... handle error
  }
}
```

Frontend: Change health check poll from `30000` to `5 * 60 * 1000` (5 min) when unhealthy:

```ts
const { data: healthData, isLoading: isCheckingHealth } = useQuery({
  queryKey: ['council-health'],
  queryFn: async () => {
    const res = await fetch('/api/council/health');
    return res.json();
  },
  refetchInterval: councilHealthy ? 30000 : 5 * 60 * 1000, // Back off when unhealthy
});
```

---

## 8. Implementation Phases

| Phase | Task | Owner | Depends On |
|-------|------|-------|-----------|
| **P1** | Create `byokRegistry.ts` + `byokService.ts` | Backend | None |
| **P2** | Update `councilBridge.ts` to accept apiKey + provider | Backend | P1 |
| **P3** | Update `councilService.ts` to pass keys through | Backend | P2 |
| **P4** | Update `councilController.ts` with BYOK validation | Backend | P3 |
| **P5** | Enhance `/api/config` endpoint | Backend | P1 |
| **P6** | Create `useByokConfig.ts` hook | Frontend | P5 |
| **P7** | Create `ByokInput.tsx` component | Frontend | P6 |
| **P8** | Integrate BYOK into LLMCouncil page | Frontend | P7 |
| **P9** | Update health check logging + polling | Backend/Frontend | P2 |
| **P10** | Audit Poetiq controller for consistency | Backend | P1 |
| **P11** | Update CHANGELOG.md + docs | Docs | All |
| **P12** | Add test cases for BYOK validation | QA | All |

---

## 9. Critical Dependencies & Assumptions

1. **Council Python Wrapper**: Must accept provider-specific API key env vars (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.). Verify wrapper supports this.
2. **Provider Support**: Council currently uses OpenRouter only. Extending to other providers requires verifying wrapper compatibility.
3. **No Key Storage**: Keys must never be logged, stored in DB, or included in response payloads.
4. **Session-Only Scope**: Keys are valid only for the duration of the request; no persistence between requests.

---

## 10. Testing Strategy

### 10.1 Backend Tests

- [ ] `validateByokRequirement` with various provider/model combos
- [ ] `validateByokProvided` with missing/empty keys
- [ ] `resolveApiKey` with user key + server key fallback
- [ ] Council controller rejects empty BYOK when required
- [ ] Council service passes key to bridge correctly
- [ ] Keys are never logged via `scrubByokFromLog`

### 10.2 Frontend Tests

- [ ] `useByokConfig` returns provider registry from `/api/config`
- [ ] `ByokInput` shows all providers from config
- [ ] LLMCouncil shows BYOK section only when required
- [ ] Start button disabled until key provided (when required)
- [ ] Key is included in request body to `/api/council/assess/stream`
- [ ] Error alerts display meaningful messages for missing/invalid keys

### 10.3 Integration Tests

- [ ] Full flow: Select puzzle → Provide BYOK → Start assessment → Stream works
- [ ] Fallback: If server key available and not required, assessment works without BYOK
- [ ] Health check muting: Verify logs don't spam after first failure

---

## 11. Acceptance Criteria

1. Council assessment requires BYOK when applicable (production or Gemini/xAI).
2. Missing BYOK key shows blocking error with actionable message.
3. API key is passed via request body, never stored, never logged.
4. `/api/config` exposes provider registry for frontend UI.
5. Frontend BYOK input component is reusable (can extend to Poetiq for consistency).
6. Health check logs are muted after first failure (prevents console spam).
7. Documentation updated with BYOK overview + Council integration instructions.

---

## 12. File Checklist

### New Files
- [ ] `server/config/byokRegistry.ts`
- [ ] `server/services/byok/byokService.ts`
- [ ] `client/src/hooks/useByokConfig.ts`
- [ ] `client/src/components/byok/ByokInput.tsx`

### Modified Files
- [ ] `server/routes.ts` – Enhance `/api/config`
- [ ] `server/controllers/councilController.ts` – Add BYOK validation
- [ ] `server/services/council/councilService.ts` – Accept + pass keys
- [ ] `server/services/council/councilBridge.ts` – Mute logs, accept keys
- [ ] `client/src/pages/LLMCouncil.tsx` – Integrate BYOK input + state
- [ ] `CHANGELOG.md` – Document BYOK system

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Key exposed in logs | Use `scrubByokFromLog` everywhere; audit all log calls |
| Key sent to wrong provider | Enum provider names; validate at controller + service |
| Backward incompatible | Keep old request signature; apiKey/provider are optional |
| Council wrapper incompatible | Verify wrapper supports per-request env vars before implementing |
| BYOK diverges from Poetiq | Share validation logic via centralized `byokService` |

---

## 14. Next Steps

1. **Get approval** on this plan.
2. **Implement phases P1–P5** (backend infrastructure).
3. **Test BYOK validation** end-to-end with real Council assessment.
4. **Implement phases P6–P8** (frontend integration).
5. **Test full flow** (key provision → assessment → stream).
6. **Update documentation** and create BYOK guide for users.
7. **Commit** with detailed SemVer entry in `CHANGELOG.md`.

