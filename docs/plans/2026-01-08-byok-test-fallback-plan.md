## 2026-01-08 – BYOK "test" Fallback Plan

**Status:** Completed – 2026-01-08

### 1. Context & Problem
- Production Worm Arena endpoints currently require a non-empty API key when `NODE_ENV=production`.
- Product requirement: entering the literal string `"test"` should act as an Easter egg/BYOK workaround – the backend should silently swap to the server's provisioned OpenRouter key.
- Frontend forwards user input verbatim, backend rejects `"test"` because it treats it as a real key and never checks a sentinel.
- No automated tests cover this behavior, so regressions can slip in unnoticed.

### 2. Objectives
1. Allow `apiKey === 'test'` (case-insensitive, trimmed) to bypass the production BYOK requirement.
2. Ensure the backend uses the correct environment key when the sentinel is provided.
3. Prevent accidental leakage of the real server key back to the client.
4. Add regression coverage and documentation (including CHANGELOG) describing the fallback.

### 3. Proposed Changes
1. **Environment Policy Utility**
   - Add a helper to detect the sentinel (`isTestBypassKey`) and to resolve the effective key given user input + env fallback.
   - Reuse this helper wherever we gate BYOK (SnakeBench routes, future services).
2. **SnakeBench Controller / Validator**
   - When `requiresUserApiKey()` and incoming key is `"test"`, treat it as "no user key" for validation but still resolve to the server key before invoking `snakeBenchService`.
   - Ensure the resolved key is injected into the runner env the same way as real BYOK keys (only server-side, never returning to client).
3. **Documentation & Surface Areas**
   - Update relevant docs (AGENTS.md or BYOK plan) briefly noting the sentinel behavior for future devs.
   - Top entry in `CHANGELOG.md` describing the fix (SemVer bump TBD by maintainer, but include patch details).
4. **Testing**
   - Add unit/integration coverage proving:
     - Controller accepts `apiKey: 'test'` in production mode mock and proceeds with server key.
     - Requests without any key still fail when `NODE_ENV=production`.
     - Dev/staging path remains unchanged.

### 4. Implementation Steps
1. Extend `server/utils/environmentPolicy.ts` with sentinel helpers and exported `resolveApiKey` utility (user key > sentinel > server key).
2. Update `server/controllers/snakeBenchController.ts` to:
   - Normalize incoming key (`trim`, sentinel check).
   - Call the new resolver and pass the effective key into `SnakeBenchRunMatchRequest` even when the user typed `test`.
   - Keep existing validation/error paths untouched for other failure modes.
3. Update `server/services/snakeBench/helpers/validators.ts` so `request.apiKey` either holds the real user key or `undefined`. The env injection logic should rely on the controller to pass the effective key (server copy) via a new optional field if needed.
4. Add regression tests (likely in `tests/integration/accuracyHarnessEndpoint.test.ts` or create a new `tests/integration/snakeBenchRunMatch.test.ts`) that stub `process.env.NODE_ENV='production'` and verify sentinel handling.
5. Document + CHANGELOG update referencing the change ID, author, and reasoning.

### 5. Risks & Mitigations
- **Risk:** Accidentally exposing the server key via JSON response. *Mitigation:* Never return the resolved key; keep it purely server-side.
- **Risk:** Sentinel leaking into other services unintentionally. *Mitigation:* Scope helper usage to SnakeBench for now; document clearly to avoid misuse.
- **Risk:** Tests mutating `process.env` persistently. *Mitigation:* Reset env values after each test or clone originals.

### 6. Exit Criteria
- Typing `test` in the Worm Arena live form works in production (falls back to env key) without surfacing secrets.
- Empty keys still fail in production; dev/staging remain unchanged.
- Tests and docs updated; CHANGELOG top entry reflects the fix.
