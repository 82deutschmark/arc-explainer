# Known Issues and Implementation Status for ARC3 Agent Playground

**Last Updated:** 2026-01-02 21:45
**Status:** UNDER ACTIVE REMEDIATION
**Strategy:** Three parallel implementations (Claude, OpenAI, OpenRouter) following the same lightweight pattern
**Session Notes:** Audit complete, submodules integrated, Arc3OpenAIRunner exists but not wired up

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
   - Location: `external/ARC-AGI-3-Agents2/` ✅ Added as submodule 2026-01-02
   - Provides: Python implementations, official API examples, random agent, LangGraph agents
   - Usage: Cross-reference for API contract validation
   - Key files: `agents/random.py`, `agents/agent.py`, `main.py`

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

---

## For the Next Developer: Detailed Implementation Guide

### What Was Done in This Session (2026-01-02)

1. ✅ **Comprehensive Audit** - Identified that previous implementation used heavy Agents SDK when lightweight HTTP pattern needed
2. ✅ **Claude SDK Integration** - Moved from `.cache/external/` to `external/` as proper submodule
3. ✅ **ARC-AGI-3-Agents2 Added** - Added official Python agents repo as submodule for reference
4. ✅ **Documentation** - Created comprehensive audit trail and reference docs
5. ✅ **Arc3OpenAIRunner Created** - Lightweight runner exists but routes not registered

### What You Need to Do Next

#### STEP 1: Wire Up Arc3OpenAI Routes (30 minutes)

**Problem:** `Arc3OpenAIRunner.ts` and `arc3OpenAI.ts` routes exist but aren't registered in main app.

**Files to modify:**
1. `server/routes.ts` - Add route registration

**Exact code to add:**

```typescript
// At top of file with other imports (around line 42)
import arc3OpenAIRouter from "./routes/arc3OpenAI";

// In registerRoutes function (around line 84, after arc3CodexRouter)
app.use("/api/arc3-openai", arc3OpenAIRouter);
```

**How to verify:**
```bash
npm run build  # Should compile without errors
# Then in browser:
curl http://localhost:5000/api/arc3-openai/health
# Should return: {"success":true,"data":{"status":"healthy","provider":"openai","timestamp":...}}
```

#### STEP 2: Create Arc3OpenRouter Runner (2-3 hours)

**Pattern:** Copy Arc3OpenAIRunner exactly, swap OpenAI→OpenRouter API calls.

**Files to create:**

1. **`server/services/arc3/Arc3OpenRouterRunner.ts`**
   - Copy from `Arc3OpenAIRunner.ts`
   - Change import from `fetch` OpenAI endpoint to OpenRouter endpoint
   - OpenRouter URL: `https://openrouter.ai/api/v1/chat/completions`
   - Key differences:
     ```typescript
     // OpenAI (current)
     const response = await fetch('https://api.openai.com/v1/responses', {
       headers: { 'Authorization': `Bearer ${apiKey}` }
     });

     // OpenRouter (new)
     const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'HTTP-Referer': 'https://arc-explainer.com',
         'X-Title': 'ARC Explainer'
       }
     });
     ```
   - OpenRouter uses standard Chat Completions API (not Responses API)
   - Tool calls format is same as OpenAI

2. **`server/services/arc3/Arc3OpenRouterStreamService.ts`**
   - Copy from `Arc3OpenAIStreamService.ts`
   - Change references from `Arc3OpenAIRunner` to `Arc3OpenRouterRunner`
   - Export as `arc3OpenRouterStreamService`

3. **`server/routes/arc3OpenRouter.ts`**
   - Copy from `arc3OpenAI.ts`
   - Change all route paths from `/stream/prepare` to match same pattern
   - Change service import to `arc3OpenRouterStreamService`
   - Change health check to return `provider: "openrouter"`

4. **`server/routes.ts`**
   - Add import: `import arc3OpenRouterRouter from "./routes/arc3OpenRouter";`
   - Add route: `app.use("/api/arc3-openrouter", arc3OpenRouterRouter);`

**Critical Notes:**
- OpenRouter requires `HTTP-Referer` and `X-Title` headers (see OpenRouter docs)
- OpenRouter uses Chat Completions API, NOT Responses API
- Tool calls work the same way as OpenAI
- Streaming is supported (use `stream: true`)

#### STEP 3: Update Frontend Provider Selection (30 minutes)

**Files to modify:**

1. **`client/src/hooks/useArc3AgentStream.ts`**
   - Add `openrouter` case to provider routing logic
   - Around line 136, add:
     ```typescript
     const apiBasePath =
       options.provider === 'openrouter' ? '/api/arc3-openrouter' :
       options.provider === 'openai_nano' || options.provider === 'openai_codex' ? '/api/arc3-openai' :
       '/api/arc3';  // fallback to old Agents SDK runner
     ```

2. **`client/src/pages/ARC3AgentPlayground.tsx`**
   - Update provider state type to include openrouter:
     ```typescript
     const [provider, setProvider] = useState<'openai_nano' | 'openai_codex' | 'openrouter'>('openai_nano');
     ```
   - Add "OpenRouter" option to provider selection UI

3. **`shared/types.ts`**
   - Update `Arc3AgentOptions.provider` type to include `'openrouter'`

#### STEP 4: Test All Three Implementations

**Testing checklist:**

```bash
# 1. Start dev server
npm run dev

# 2. Test Claude SDK (manual, CLI)
cd external/ARC-AGI-3-ClaudeCode-SDK
node actions/list-games.js
node actions/open-scorecard.js
node actions/start-game.js --game ls20
node actions/action.js --type 1

# 3. Test OpenAI Runner (web UI)
# Open http://localhost:5173/arc3-agent-playground
# Select "OpenAI Nano" from dropdown
# Select game "ls20"
# Click "Start Agent"
# Verify: SSE stream shows frames, reasoning, actions

# 4. Test OpenRouter Runner (web UI)
# Same as OpenAI but select "OpenRouter" from dropdown
# Verify: Works with OpenRouter API key

# 5. Verify health endpoints
curl http://localhost:5000/api/arc3-openai/health
curl http://localhost:5000/api/arc3-openrouter/health
```

**Expected results:**
- All three providers work independently
- Frontend can toggle between them
- SSE streaming shows frames updating in real-time
- Game completes with WIN or GAME_OVER state

---

## Reference Code Patterns

### Claude SDK Pattern (Reference)
```javascript
// From external/ARC-AGI-3-ClaudeCode-SDK/actions/start-game.js
const response = await makeRequest("/api/cmd/RESET", {
  method: "POST",
  body: JSON.stringify({
    game_id: options.game,
    card_id: config.currentScorecardId,
  }),
});
// Response: { guid, frame, state, score, win_score }
```

### Arc3OpenAIRunner Pattern (Ours)
```typescript
// From server/services/arc3/Arc3OpenAIRunner.ts:52-53
const cardId = await this.apiClient.openScorecard(["openai-runner"], "arc-explainer");
let frame = await this.apiClient.startGame(config.game_id, undefined, cardId);

// Loop pattern (line 60-92)
for (; turn < maxTurns; turn++) {
  if (frame.state === "WIN" || frame.state === "GAME_OVER") break;

  const action = await this.chooseAction(apiKey, config.model, frame, ...);
  frame = await this.apiClient.executeAction(config.game_id, frame.guid, { action: action.type, ... }, undefined, cardId);

  stream.emitEvent("game.frame_update", { frame, turn: turn + 1 });
}
```

### Tool Calls Format (OpenAI/OpenRouter)
```typescript
// Tools definition (what LLM sees)
const tools = [
  {
    type: "function",
    function: {
      name: "ACTION1",
      description: "Move up or perform primary action",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "ACTION6",
      description: "Click at specific coordinates",
      parameters: {
        type: "object",
        properties: {
          x: { type: "integer", minimum: 0, maximum: 63 },
          y: { type: "integer", minimum: 0, maximum: 63 }
        },
        required: ["x", "y"]
      }
    }
  }
];

// LLM response parsing
const toolCall = response.choices[0].message.tool_calls[0];
const actionType = toolCall.function.name;  // "ACTION1" or "ACTION6"
const args = JSON.parse(toolCall.function.arguments);  // { x: 10, y: 20 } for ACTION6
```

---

## Gotchas & Common Issues

### 1. Route Registration Order Matters
Routes MUST be registered in `server/routes.ts` or they won't respond. Check with:
```bash
curl http://localhost:5000/api/arc3-openai/health
# If 404 → routes not registered
```

### 2. OpenRouter Headers Required
OpenRouter requires these headers or requests fail:
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': 'https://your-site.com',  // Required
  'X-Title': 'Your App Name'  // Required
}
```

### 3. SSE Registration Must Happen Before Streaming
```typescript
// CORRECT order:
sseStreamManager.register(sessionId, res);
res.flushHeaders();  // Send headers to client
await startStreaming(sessionId);  // Start sending events

// WRONG (events lost):
await startStreaming(sessionId);
sseStreamManager.register(sessionId, res);
```

### 4. Arc3ApiClient Requires card_id AND guid
```typescript
// WRONG:
await apiClient.executeAction(gameId, guid, { action: 'ACTION1' });

// CORRECT:
await apiClient.executeAction(gameId, guid, { action: 'ACTION1' }, undefined, cardId);
//                                                                    ^^^^^^^^  ^^^^^^^
//                                                                    reasoning  card_id
```

### 5. Frame State Transitions
```typescript
// Initial RESET call:
frame.state === "NOT_FINISHED"  // or "NOT_PLAYED"

// After actions:
frame.state === "NOT_FINISHED"  // game continues
frame.state === "WIN"           // level/game won
frame.state === "GAME_OVER"     // failed (health=0, max actions reached, etc.)
```

---

## Files Modified/Created This Session

### Modified:
- `docs/reference/arc3/KNOWN_ISSUES.md` - This file (completely rewritten)
- `.gitmodules` - Added two submodules
- `external/ARC-AGI-3-ClaudeCode-SDK/` - Moved from `.cache/external/`

### Created:
- `external/ARC-AGI-3-Agents2/` - New submodule added
- `docs/audits/2026-01-02-arc3-implementation-audit.md` - Full audit report
- `docs/audits/2026-01-02-arc3-audit-addendum.md` - Clarifications
- `docs/reference/arc3/Claude_SDK_Reference.md` - Pattern documentation

### Already Exists (from previous dev):
- `server/services/arc3/Arc3OpenAIRunner.ts` ✅ Ready to use
- `server/services/arc3/Arc3OpenAIStreamService.ts` ✅ Ready to use
- `server/routes/arc3OpenAI.ts` ✅ Ready to use (just need to register)

### Need to Create:
- `server/services/arc3/Arc3OpenRouterRunner.ts` ⏳ Copy pattern from OpenAI
- `server/services/arc3/Arc3OpenRouterStreamService.ts` ⏳ Copy pattern from OpenAI
- `server/routes/arc3OpenRouter.ts` ⏳ Copy pattern from OpenAI

---

## Quick Start Commands for Next Session

```bash
# 1. Register OpenAI routes (5 min)
# Edit server/routes.ts and add import + app.use() as shown in STEP 1

# 2. Test OpenAI runner works (5 min)
npm run build
npm run dev
# Visit http://localhost:5173/arc3-agent-playground
# Select "OpenAI Nano", start game

# 3. Create OpenRouter files (2 hours)
# Copy Arc3OpenAIRunner.ts → Arc3OpenRouterRunner.ts
# Copy Arc3OpenAIStreamService.ts → Arc3OpenRouterStreamService.ts
# Copy arc3OpenAI.ts → arc3OpenRouter.ts
# Modify API calls to use OpenRouter endpoint

# 4. Register OpenRouter routes (5 min)
# Edit server/routes.ts and add import + app.use()

# 5. Test OpenRouter runner (10 min)
# Visit playground, select "OpenRouter", verify it works
```

---

## References

- **Official ARC3 Docs:** https://docs.arcprize.org
- **Claude SDK Pattern:** `external/ARC-AGI-3-ClaudeCode-SDK/CLAUDE.MD`
- **Python Agents Reference:** `external/ARC-AGI-3-Agents2/README.md`
- **Our Architecture Doc:** `docs/reference/arc3/Claude_SDK_Reference.md`
- **Full Audit Report:** `docs/audits/2026-01-02-arc3-implementation-audit.md`
- **OpenRouter API Docs:** https://openrouter.ai/docs
- **OpenAI Responses API:** https://platform.openai.com/docs/api-reference/responses


