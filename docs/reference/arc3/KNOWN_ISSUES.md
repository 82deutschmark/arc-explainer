# Known Issues and Implementation Status for ARC3 Agent Playground

**Last Updated:** 2026-01-02 21:28
**Status:** UNDER ACTIVE REMEDIATION
**Strategy:** Three parallel implementations (Claude, OpenAI, OpenRouter) following the same lightweight pattern

---

## Current Architecture

We maintain **three parallel agent runners**, each calling the official ARC3 API using the same lightweight pattern:

| Runner | Provider | Status | Location | Pattern |
|--------|----------|--------|----------|---------|
| **Claude SDK** (Reference) | Anthropic Claude | ✅ Working | `external/ARC-AGI-3-ClaudeCode-SDK/` | CLI scripts (reference pattern) |
| **Arc3OpenAIRunner** | OpenAI (Responses API) | 🔧 Partially Complete | `server/services/arc3/Arc3OpenAIRunner.ts` | Direct HTTP to ARC3 API |
| **Arc3OpenRouterRunner** | OpenRouter | ⏳ TODO | `server/services/arc3/Arc3OpenRouterRunner.ts` | Direct HTTP to ARC3 API |

### The Pattern (from Claude SDK)

All three implementations follow this flow:
1. `openScorecard()` → Get `card_id` from `/api/scorecard/open`
2. `startGame(game_id, card_id)` → Call `/api/cmd/RESET` → Get `guid` + initial frame
3. **Loop:**
   - Call LLM provider (Responses API) with current frame + available actions as tools
   - Parse action tool call from LLM response
   - Execute action via `/api/cmd/ACTION{1-6}` with `guid` + `card_id`
   - Get new frame + state
4. Repeat until `state === 'WIN'` or `state === 'GAME_OVER'`

**Key insight:** This is lightweight because we're NOT using heavy SDKs. We're making simple HTTP calls and asking the LLM to pick actions via tool calls.

---

## Issues & Status

### ✅ RESOLVED
- **Claude SDK Integration:** Moved from `.cache/external/` to `external/` as proper git submodule
- **Frontend Provider Naming:** Updated to `openai_nano` and `openai_codex` (clear labeling)
- **Claude SDK Reference:** Available at `external/ARC-AGI-3-ClaudeCode-SDK/` with full pattern documentation

### 🔧 IN PROGRESS
- **Arc3OpenAIRunner**: Exists but routes NOT registered in `server/routes.ts`
  - Status: Implementation complete, integration incomplete
  - Fix: Register `/api/arc3-openai/*` routes in main router
- **Frontend Hook:** Currently calls `/api/arc3-openai` but routes don't exist yet
  - Fix: Once routes registered, frontend will work

### ⏳ TODO
- **Arc3OpenRouterRunner:** New runner needed
  - Create `server/services/arc3/Arc3OpenRouterRunner.ts` (copy Arc3OpenAIRunner pattern, swap OpenAI→OpenRouter)
  - Create `server/services/arc3/Arc3OpenRouterStreamService.ts`
  - Create `server/routes/arc3OpenRouter.ts`
  - Register routes in `server/routes.ts`
  - Update frontend to support provider selection
- **Helper Utilities:** Port from Claude SDK for better analysis
  - `frameAnalysis.ts` - compareFrames, getGrid, diffs
  - `gridAnalysis.ts` - color distribution, connected components
  - `gridVisualization.ts` - ASCII art, side-by-side diffs
- **Old Agents SDK Runners:** Arc3RealGameRunner and CodexArc3Runner still exist
  - Decision: Keep as fallback or delete? (User to decide)

### ❌ KNOWN LIMITATIONS (By Design)
- **ACTION7 (Undo):** Not implemented
  - Reason: Not needed for current preview games
  - Status: Can add later if games require it
- **Multi-turn Continuation:** Not yet supported
  - Reason: Current focus on single-session gameplay
  - Status: Roadmap feature for future

---

## Reference Implementations

Two reference repos exist to guide implementation:

1. **Claude SDK** (Official Claude Code Implementation)
   - Location: `external/ARC-AGI-3-ClaudeCode-SDK/`
   - Provides: CLI scripts showing exact HTTP request patterns
   - Pattern: Read `CLAUDE.MD` for system instructions
   - Usage: Direct reference for action/scorecard APIs

2. **ARC-AGI-3-Agents2** (Official Agents Reference)
   - Location: `external/ARC-AGI-3-Agents2/` (TODO: add as submodule)
   - Provides: Python implementations, official API examples
   - Usage: Cross-reference for API contract validation

---

## How to Use Each Runner

### Claude SDK (Manual/Interactive)
```bash
node external/ARC-AGI-3-ClaudeCode-SDK/actions/open-scorecard.js
node external/ARC-AGI-3-ClaudeCode-SDK/actions/start-game.js --game ls20
node external/ARC-AGI-3-ClaudeCode-SDK/actions/action.js --type 1
```

### OpenAI Runner (Via Web UI)
```
1. Open http://localhost:5173/arc3-agent-playground
2. Select "OpenAI Nano" from provider dropdown
3. Select game, click "Start Agent"
4. Watch SSE stream with frames + reasoning
```

### OpenRouter Runner (Via Web UI) - Coming Soon
```
1. Open http://localhost:5173/arc3-agent-playground
2. Select "OpenRouter" from provider dropdown
3. (Same workflow as OpenAI)
```

---

## What This Means Going Forward

### Do This ✅
- Use **Claude SDK** as the reference pattern for HTTP calls and scorecard lifecycle
- Create new runners by copying the Arc3OpenAIRunner pattern
- Keep each runner focused: one provider, one clear implementation
- Test each runner independently before toggling between them

### Don't Do This ❌
- Extend Arc3RealGameRunner or CodexArc3Runner (deprecated Agents SDK approach)
- Create new documentation before implementing (focus on code)
- Mix multiple providers in a single runner
- Add complexity beyond the three-step HTTP pattern

---

## Quick Audit Summary

**What Works:**
- Claude SDK reference implementation (fully functional)
- Arc3OpenAIRunner code exists (just needs route registration)
- Frontend provider selection UI exists

**What's Broken:**
- Arc3OpenAIRunner routes not registered → endpoints don't respond
- No OpenRouter implementation yet

**What's Missing:**
- Arc3OpenRouterRunner implementation
- Route registration for Arc3OpenAIRunner
- Helper utilities from Claude SDK

**Time to Full Implementation:**
- Wire up Arc3OpenAI routes: **30 min**
- Create Arc3OpenRouter runner: **2-3 hours**
- Add helper utilities: **1-2 days** (optional, improves agent quality)
- Testing & cleanup: **1 day**

**Total: ~1 week for three working, parallel implementations**

---

## References

- **Official ARC3 Docs:** https://docs.arcprize.org
- **Claude SDK Pattern:** `external/ARC-AGI-3-ClaudeCode-SDK/CLAUDE.MD`
- **Our Architecture Doc:** `docs/reference/arc3/Claude_SDK_Reference.md`
- **Audit Trail:** `docs/audits/2026-01-02-arc3-implementation-audit.md`


