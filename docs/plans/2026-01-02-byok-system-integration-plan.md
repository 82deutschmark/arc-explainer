# BYOK (Bring Your Own Key) Integration for Council

**Date:** 2026-01-02
**Author:** Claude Haiku 4.5
**Status:** Ready for implementation
**Scope:** Add BYOK enforcement to Council assessment endpoints, following existing patterns

---

## 1. Problem Statement

Council assessment currently uses a hardcoded server `OPENROUTER_API_KEY` and doesn't support user-provided API keys. This means:
- Users incur real API costs but have no way to use their own budgets
- No option for users to bring their own keys in production
- Inconsistent with other services (Poetiq, SnakeBench, streamController) which already enforce BYOK

**Solution:** Apply the proven BYOK pattern already implemented across 5+ services to Council.

---

## 2. Goals

| Goal | Details |
|------|---------|
| G1 | Council requires user API key when `requiresUserApiKey()` returns true (production only). |
| G2 | Frontend (LLMCouncil page) collects API key and provider from user before starting assessment. |
| G3 | Backend validates key presence, rejects with 400 error if missing in production. |
| G4 | API key is passed through request lifecycle, never logged or stored. |
| G5 | Health check logging muted after first failure to prevent console spam. |
| G6 | Implementation follows exact pattern from streamController (simplest existing pattern). |

---

## 3. Current BYOK Implementation Pattern

The project already enforces BYOK consistently across:
- `streamController.ts` - Puzzle analysis streaming (simplest pattern, just production check)
- `poetiqController.ts` - Poetiq solver (provider-aware: Gemini always requires, OpenRouter has whitelist)
- `groverController.ts` - Grover solver (production check only)
- `snakeBenchController.ts` - SnakeBench matches (production check only)
- `arc3.ts` - ARC3 agent playground (production check only)

**Core policy** (`server/utils/environmentPolicy.ts`):
- `requiresUserApiKey()` returns `true` only when `NODE_ENV === 'production'`
- `validateUserApiKey(apiKey, providerName)` validates presence and returns error message if needed
- `getEffectiveApiKey(userKey, serverKey)` prefers user key; falls back to server key in dev/staging

**Frontend pattern** (PuzzleExaminer, ARC3AgentPlayground):
- Check `requiresUserApiKey()` from config
- Conditionally show BYOK input card
- Block analysis start if key required but missing
- Pass `apiKey` in request body

---

## 4. Implementation Plan: 5 Steps

### Step 1: Update Council Controller (`councilController.ts`)

Modify both `streamAssessment()` and `assessPuzzle()` endpoints:
- Extract `apiKey` and `provider` from request body
- Call `requiresUserApiKey()` to check if key is required
- Validate presence: if required and missing, return 400 error with message "Production requires your API key..."
- Pass `apiKey` and `provider` to `councilService.assessPuzzle()` call

**Pattern:** Follow streamController lines 287-292 exactly. No provider-specific logic needed (Council determines models internally).

### Step 2: Update Council Service (`councilService.ts`)

Modify `assessPuzzle()` function signature:
- Add optional `apiKey?: string` parameter
- Add optional `provider?: ProviderName` parameter
- Call `getEffectiveApiKey(apiKey, getServerKey(provider))` to resolve which key to use
- Pass resolved key to `councilBridge.runCouncil()`

**Key principle:** Service doesn't validate—controller already did. Service just resolves and forwards.

### Step 3: Update Council Bridge (`councilBridge.ts`)

Modify `runCouncil()` function:
- Accept `apiKey: string` as required parameter (passed from service)
- Accept `provider: ProviderName` as required parameter
- Set environment variable based on provider: `env.OPENROUTER_API_KEY = apiKey` (or appropriate env var for other providers)
- Add health check log muting: After first failure, mute logs for 5 minutes to prevent console spam

**Log muting strategy:** Track `lastFailureTime` in module scope. Only log if 5+ minutes since last logged failure.

### Step 4: Update Frontend (LLMCouncil page)

Add BYOK input to sidebar:
- Import `useRequiresUserApiKey()` hook from `useAppConfig`
- Create local state: `[apiKey, setApiKey]` and `[provider, setProvider]`
- Conditionally render BYOK section only when `useRequiresUserApiKey()` returns true
- Show provider dropdown and password input field
- Validate before starting assessment: if BYOK required and key missing, show error and return early
- Include `apiKey` and `provider` in request body to `/api/council/assess/stream`

**Reuse:** Model after PuzzleExaminer's BYOK card (lines 413-447)

### Step 5: Update Health Check Polling

Current code polls every 30 seconds. When council is unhealthy, this causes repeated log spam.

**Change:** Implement backoff on frontend. When `!councilHealthy`, change refetch interval from 30s to 5 minutes. When it becomes healthy again, reset to 30s.

Optional: Add log muting on backend (described in Step 3).

---

## 5. Data Flow

### Request Flow (Production with BYOK)

```
User selects puzzle → Types API key in BYOK section → Clicks "Start"
  ↓
Frontend validates: if requiresUserApiKey && !apiKey, show error and return
  ↓
POST /api/council/assess/stream { taskId, mode, explanationIds, apiKey, provider }
  ↓
Controller validates: if requiresUserApiKey && !apiKey, return 400 error
  ↓
Service calls getEffectiveApiKey(userKey, serverKey) → resolves to userKey
  ↓
Bridge sets env.OPENROUTER_API_KEY = userKey (or provider-specific key)
  ↓
Python subprocess spawned with env var set
  ↓
Council uses user's API quota for all deliberation calls
  ↓
Key never logged, never stored, never returned to client
```

### Request Flow (Development without BYOK)

```
User clicks "Start" (no BYOK card shown)
  ↓
POST /api/council/assess/stream { taskId, mode, explanationIds } (no apiKey)
  ↓
Controller checks: if !requiresUserApiKey(), allow request
  ↓
Service calls getEffectiveApiKey(undefined, getServerKey()) → resolves to server key
  ↓
Bridge sets env.OPENROUTER_API_KEY = server key
  ↓
Council uses server's API quota
```

---

## 6. Files to Modify

### Backend Changes
- `server/controllers/councilController.ts` - Add BYOK validation to both endpoints
- `server/services/council/councilService.ts` - Accept and forward apiKey/provider
- `server/services/council/councilBridge.ts` - Set env var, add log muting

### Frontend Changes
- `client/src/pages/LLMCouncil.tsx` - Add BYOK UI, state, validation

### No Changes Needed
- `server/utils/environmentPolicy.ts` - Already handles all logic
- `client/src/lib/environmentPolicy.ts` - Already available
- `/api/config` endpoint - Already exposes `requiresUserApiKey`

---

## 7. Error Messages

When BYOK is required but not provided:

**HTTP 400 Response:**
```
error: 'api_key_required'
message: 'Production requires your API key. Your key is used for this session only and is never stored.'
```

**Frontend alert (if validation passes but API rejects):**
Same message displayed in red alert box in sidebar.

---

## 8. Testing Checklist

- [ ] **Production mode:** Start assessment without key → blocked with 400 error
- [ ] **Production mode:** Provide key → assessment proceeds
- [ ] **Development mode:** Start assessment without key → works (uses server key)
- [ ] **Frontend validation:** BYOK section shown only in production
- [ ] **Key handling:** Verify apiKey never appears in logs (use Ctrl+F "apiKey" in console)
- [ ] **Health check:** Unhealthy council → logs appear once, then muted for 5 min
- [ ] **Polling:** Unhealthy council → backend polls every 5 min (not 30 sec)
- [ ] **Provider override:** User can select different provider if needed
- [ ] **Stream completion:** Full deliberation streams correctly with user's key

---

## 9. Implementation Order

1. **Backend foundation** (Step 1-3): Update controller, service, bridge
2. **Frontend integration** (Step 4): Add BYOK UI to LLMCouncil
3. **Polish** (Step 5): Implement backoff polling for health checks
4. **Testing & verification**: Run through all test cases

---

## 10. Breaking Changes

**None.** Implementation is backward compatible:
- In development, existing behavior unchanged (uses server key as fallback)
- Optional `apiKey` and `provider` fields in request body
- Frontend only shows BYOK UI when required (production)

---

## 11. Future Considerations

- **Provider expansion:** If Council adds support for multiple providers (beyond OpenRouter), add provider-specific logic similar to Poetiq
- **Key validation:** Could add pre-flight test of user key validity before starting assessment
- **Error surfacing:** SSE stream errors due to invalid key should show clear message to user (already handled by existing error flow)

---

## 12. Acceptance Criteria

✓ Council assessment requires BYOK key in production (NODE_ENV=production)
✓ Frontend shows BYOK input only in production
✓ Missing key returns 400 error with clear message
✓ Key is never logged or stored server-side
✓ Health check logs muted after first failure
✓ Implementation matches streamController pattern exactly
✓ All existing tests still pass

---

## Summary

This plan applies the proven BYOK pattern already used across 5+ services to Council. It's a straightforward 3-file backend change + 1-file frontend change, following established patterns in the codebase. No new dependencies or infrastructure needed.
