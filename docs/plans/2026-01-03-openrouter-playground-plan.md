# OpenRouter Playground Implementation Plan

**Author:** Claude Sonnet 4.5
**Date:** 2026-01-03
**Status:** APPROVED FOR IMPLEMENTATION

---

## Executive Summary

Create a dedicated **OpenRouter Playground** page that mirrors the OpenAI-focused ARC3 Playground but uses the OpenRouter API scaffolding (Python LangGraph runner) instead of the OpenAI Responses API (Agents SDK).

**Key Decision:** Separate pages for different provider scaffoldings rather than one unified page. The existing ARC3 Playground remains OpenAI-only; this new page is OpenRouter-only.

---

## Context: What We Discovered This Morning

### The Confusion About "Providers"

**Problem:** The ARC3 Playground had a toggle labeled "OpenAI Nano" and "OpenAI Codex" that appeared to be a provider selector but was actually broken.

**Root Cause:** Misunderstanding of architecture
- **"OpenAI Nano" and "OpenAI Codex" are MODEL NAMES**, not providers
- Both are OpenAI models that use the same API scaffolding (Responses API)
- The toggle switched between `provider='openai_nano'` and `provider='openai_codex'`, but both routed to the same backend (`/api/arc3`)
- **Result:** The toggle did nothing. It was visual noise.

### The Real Distinction: API Scaffolding (Not Models)

The actual distinction that matters is **API scaffolding** — the different request/response structures required by different LLM providers:

| Provider | API Structure | Scaffolding Location |
|----------|--------------|---------------------|
| **OpenAI** | Responses API (`/v1/responses`, `input[]`, reasoning config) | `/api/arc3` → Arc3RealGameRunner (Agents SDK) |
| **OpenRouter** | OpenRouter API wrapper (different auth, base URL) | `/api/arc3-openrouter` → Python LangGraph runner |
| **Claude** | Anthropic Messages API (different structure entirely) | Not yet implemented |

**Within a provider**, you can use different models (e.g., `gpt-5-nano-2025-08-07`, `gpt-5-codex-mini-2025-08-07`) without changing scaffolding.

**Between providers**, you need entirely different scaffolding (different API clients, different request formats, different authentication).

---

## Current State

### What's Already Built (Backend from Last Night - Version 6.23.0)

✅ **Complete OpenRouter backend infrastructure:**

1. **Python Runner:** `server/python/arc3_openrouter_runner.py`
   - LangGraph-style thinking agent
   - Uses LangChain's `ChatOpenAI` with OpenRouter base URL
   - Model: `xiaomi/mimo-v2-flash:free` (configurable)
   - Emits NDJSON events to stdout

2. **TypeScript Bridge:** `server/services/arc3/Arc3OpenRouterPythonBridge.ts`
   - Spawns Python subprocess
   - Parses NDJSON events line-by-line
   - Forwards events to SSE stream

3. **Stream Service:** `server/services/arc3/Arc3OpenRouterStreamService.ts`
   - Session management
   - SSE emission coordination

4. **Routes:** `server/routes/arc3OpenRouter.ts`
   - `POST /api/arc3-openrouter/stream/prepare`
   - `GET /api/arc3-openrouter/stream/:sessionId`
   - `POST /api/arc3-openrouter/stream/cancel/:sessionId`
   - `GET /api/arc3-openrouter/health`

5. **Hook Support:** `client/src/hooks/useArc3AgentStream.ts`
   - Lines 138-140: Routes to `/api/arc3-openrouter` when `provider='openrouter'`

✅ **Health check confirmed working:**
```json
{
  "success": true,
  "status": "healthy",
  "provider": "openrouter",
  "model": "xiaomi/mimo-v2-flash:free",
  "hasOpenRouterKey": true,
  "hasArc3Key": true
}
```

### What's Missing

❌ **Frontend page to expose this functionality**
- Users have no way to access the OpenRouter backend
- The existing Playground is OpenAI-only and should stay that way

---

## Architecture Decision

### Why Separate Pages?

**Option A (Rejected):** One unified "Agent Harnesses" page with provider selector
- ❌ Complex UI with conditional rendering
- ❌ Confusing for users (too many options)
- ❌ Risk of breaking working implementations

**Option B (Chosen):** Dedicated pages per provider scaffolding
- ✅ Clean separation of concerns
- ✅ Each page optimized for its provider's capabilities
- ✅ Easy to maintain and debug
- ✅ Users can bookmark their preferred playground
- ✅ Follows the pattern of LLM-Council (dedicated page, Python subprocess)

---

## Implementation Plan

### File to Create

**New page:** `client/src/pages/Arc3OpenRouterPlayground.tsx`

**Route:** `/arc3/openrouter-playground`

**Pattern:** Clone the existing `ARC3AgentPlayground.tsx` but route to OpenRouter backend

---

## Detailed Implementation Steps

### Phase 1: Create the OpenRouter Playground Page

**Based on:** `client/src/pages/ARC3AgentPlayground.tsx`

**Key Changes:**

1. **Page metadata:**
   ```typescript
   usePageMeta({
     title: 'ARC Explainer – OpenRouter Playground',
     description: 'Explore ARC-AGI-3 games using OpenRouter models (free and low-cost)',
     canonicalPath: '/arc3/openrouter-playground',
   });
   ```

2. **Provider routing:**
   - Always pass `provider: 'openrouter'` to `useArc3AgentStream.start()`
   - This routes to `/api/arc3-openrouter`

3. **BYOK Card:**
   - Label: "OpenRouter API Key Required"
   - Placeholder: "Enter your OpenRouter API key..."
   - Description: "Your key is used for this session only and is never stored."
   - Color: Amber (matching existing BYOK pattern)

4. **Model selection:**
   - Hardcode default: `xiaomi/mimo-v2-flash:free`
   - Allow users to change model (input field or dropdown)
   - Note: OpenRouter has hundreds of models; we can add a selector later

5. **Header branding:**
   - Title: "OpenRouter Playground"
   - Badge showing provider: `<Badge>OpenRouter</Badge>`

6. **Remove OpenAI-specific logic:**
   - No need to filter for `m.provider === 'OpenAI'`
   - Model fetching can be simplified (or hardcoded for MVP)

### Phase 2: Add Route and Navigation

**Route registration:**

File: `client/src/App.tsx`

```typescript
import Arc3OpenRouterPlayground from '@/pages/Arc3OpenRouterPlayground';

// Add route:
<Route path="/arc3/openrouter-playground" component={Arc3OpenRouterPlayground} />
```

**Navigation link:**

Option 1: Add to main ARC3 landing page (`/arc3`)
Option 2: Add to main navigation menu
Option 3: Both

Suggested UI:
```tsx
<Link href="/arc3/openrouter-playground">
  <Card>
    <CardHeader>
      <CardTitle>OpenRouter Playground</CardTitle>
      <CardDescription>
        Explore ARC-AGI-3 games using free OpenRouter models
      </CardDescription>
    </CardHeader>
  </Card>
</Link>
```

### Phase 3: Testing and Verification

**Pre-flight checks:**
1. ✅ Backend health endpoint responds
2. ✅ OpenRouter API key is set in environment
3. ✅ ARC3 API key is set in environment
4. ✅ Python dependencies installed

**Test flow:**
1. Navigate to `/arc3/openrouter-playground`
2. Enter OpenRouter API key (if in production)
3. Select game (e.g., `ls20`)
4. Click "Start Agent"
5. Verify SSE events stream correctly
6. Verify game grid updates in real-time
7. Verify reasoning logs appear in right panel
8. Verify agent actions execute via Python subprocess
9. Check final results and token usage

**Expected behavior:**
- Python subprocess spawns and emits NDJSON events
- TypeScript bridge parses events and forwards to SSE
- Frontend receives events and updates UI
- Grid shows frame-by-frame progression
- Reasoning panel shows agent's thinking
- Actions execute against ARC3 API
- Session ends gracefully when game completes

---

## Technical Specifications

### Component Reuse

The OpenRouter Playground will **reuse existing components**:
- `Arc3ConfigurationPanel` - System prompt, instructions, settings
- `Arc3GamePanel` - Game grid, action buttons, frame navigation
- `Arc3ReasoningViewer` - Streaming reasoning logs
- `Arc3ToolTimeline` - Action history
- `Arc3AgentControls` - User message injection (if needed)
- `Arc3AgentVisionPreview` - Base64 frame image preview

**SRP/DRY:** All these components are provider-agnostic. They accept state from the hook and render UI. No code duplication needed.

### Hook Integration

The `useArc3AgentStream` hook already supports OpenRouter:

```typescript
// In Arc3OpenRouterPlayground.tsx
const { state, start, cancel, ... } = useArc3AgentStream();

// On start:
start({
  game_id: gameId,
  agentName,
  systemPrompt,
  instructions,
  model: 'xiaomi/mimo-v2-flash:free', // OpenRouter model
  maxTurns,
  reasoningEffort: 'low',
  provider: 'openrouter', // ← Routes to /api/arc3-openrouter
  apiKey: userApiKey.trim(), // OpenRouter API key
});
```

The hook will:
1. Route to `/api/arc3-openrouter` (line 138-140)
2. POST to `/api/arc3-openrouter/stream/prepare`
3. GET SSE stream from `/api/arc3-openrouter/stream/:sessionId`
4. Parse events and update state
5. Forward state to components

**No hook changes needed.** It already works.

---

## Environment Variables

**Required:**
```bash
OPENROUTER_API_KEY=sk-or-...  # OpenRouter API key
ARC3_API_KEY=...              # ARC-AGI-3 API key
```

**Optional:**
```bash
PYTHON_BIN=python3            # Custom Python binary
```

**BYOK:** In production, users must provide their own OpenRouter API key via the UI. The server never stores it.

---

## File Manifest

### Files to Create

1. `client/src/pages/Arc3OpenRouterPlayground.tsx` - Main playground page

### Files to Modify

1. `client/src/App.tsx` - Add route
2. (Optional) `client/src/pages/ARC3Landing.tsx` - Add navigation link

### Files Already in Place (No Changes Needed)

- `server/python/arc3_openrouter_runner.py`
- `server/services/arc3/Arc3OpenRouterPythonBridge.ts`
- `server/services/arc3/Arc3OpenRouterStreamService.ts`
- `server/routes/arc3OpenRouter.ts`
- `client/src/hooks/useArc3AgentStream.ts`
- All Arc3 UI components (ConfigurationPanel, GamePanel, etc.)

---

## Testing Checklist

### Backend Verification
- [ ] Health endpoint: `curl http://localhost:5000/api/arc3-openrouter/health`
- [ ] Python runner standalone: `echo '{"game_id":"ls20"}' | python server/python/arc3_openrouter_runner.py`

### Frontend Verification
- [ ] Page loads at `/arc3/openrouter-playground`
- [ ] Game selector populates with games
- [ ] BYOK card appears in production
- [ ] Model field shows `xiaomi/mimo-v2-flash:free`
- [ ] "Start Agent" button triggers stream
- [ ] SSE connection opens (check Network tab)
- [ ] Events flow and UI updates in real-time
- [ ] Game grid shows frames
- [ ] Reasoning panel shows agent thinking
- [ ] Actions execute via Python subprocess
- [ ] Session completes successfully
- [ ] Token usage and final state displayed

### Error Handling
- [ ] Missing OpenRouter API key → Clear error message
- [ ] Missing ARC3 API key → Clear error message
- [ ] Python subprocess fails → Error displayed in UI
- [ ] SSE connection drops → Graceful reconnect or error
- [ ] Invalid game ID → Error handled

---

## Future Enhancements

### Short-term (Next Sprint)
- [ ] Model selector dropdown (fetch from OpenRouter catalog)
- [ ] Cost estimation display
- [ ] Save/load agent configurations
- [ ] Link from main ARC3 landing page

### Long-term
- [ ] Claude Playground (Anthropic Messages API)
- [ ] Head-to-head comparison (run same game with multiple providers)
- [ ] Provider performance analytics
- [ ] Unified "Agent Harnesses" page if demand warrants

---

## References

- **Plan from last night:** `docs/plans/2026-01-02-arc3-openrouter-integration-plan.md`
- **Existing Playground:** `client/src/pages/ARC3AgentPlayground.tsx`
- **LLM-Council pattern:** `client/src/pages/LLMCouncil.tsx` (Python subprocess + BYOK)
- **Hook routing logic:** `client/src/hooks/useArc3AgentStream.ts` (lines 138-140)
- **BYOK pattern:** `client/src/pages/ARC3AgentPlayground.tsx` (BYOK card)

---

## Success Criteria

**MVP Definition:**
- [ ] Users can access `/arc3/openrouter-playground`
- [ ] Users can provide OpenRouter API key
- [ ] Users can select a game and start the agent
- [ ] Agent plays the game using OpenRouter's `xiaomi/mimo-v2-flash:free` model
- [ ] UI updates in real-time with game frames and reasoning
- [ ] Session completes successfully with final results displayed

**Production Ready:**
- [ ] All tests passing
- [ ] Error handling robust
- [ ] BYOK enforced in production
- [ ] Navigation links in place
- [ ] Documentation updated (README, CHANGELOG)

---

## Changelog Entry (To Be Added After Implementation)

```markdown
### Version 6.24.0  Jan 3, 2026

- **OpenRouter Playground – Dedicated Page for OpenRouter Models** (Author: [Your Model])
  - **What**: Created a dedicated ARC3 playground page for OpenRouter models, separate from the OpenAI-focused playground.
  - **Why**: The existing playground is optimized for OpenAI's Responses API (Agents SDK). OpenRouter requires different scaffolding (Python LangGraph runner). Keeping them separate maintains clarity and allows each to be optimized for its provider.
  - **How**:
    - Created `Arc3OpenRouterPlayground.tsx` based on existing Playground pattern
    - Routes to `/api/arc3-openrouter` (backend already in place from Version 6.23.0)
    - BYOK card for OpenRouter API key (amber styling, session-only)
    - Default model: `xiaomi/mimo-v2-flash:free`
    - Reuses all Arc3 UI components (GamePanel, ReasoningViewer, etc.)
    - Added route `/arc3/openrouter-playground` in App.tsx
    - Added navigation link from main ARC3 landing page
  - **Pattern**: Follows LLM-Council approach (Python subprocess + TypeScript bridge + BYOK)
  - **Files**: `Arc3OpenRouterPlayground.tsx`, `App.tsx`, [navigation page]
```

---

## Notes for Next Developer

**Key Insights:**
1. **Providers ≠ Models**: "OpenAI Nano" is a model, not a provider. The provider is OpenAI. Don't confuse them.
2. **Scaffolding Matters**: Each provider needs its own API client, request format, and authentication. This is why we have separate backends.
3. **Hook Already Works**: `useArc3AgentStream` routes correctly based on `provider` parameter. No hook changes needed.
4. **Component Reuse**: All Arc3 UI components are provider-agnostic. Just wire them up to the hook state.
5. **BYOK Pattern**: See existing Playground for reference. Amber card, session-only, never logged.

**Common Pitfalls:**
- ❌ Don't try to unify OpenAI and OpenRouter into one page. They have different APIs.
- ❌ Don't filter models by `m.provider === 'OpenAI'` in the OpenRouter page.
- ❌ Don't forget to pass `provider: 'openrouter'` to the hook.
- ❌ Don't hardcode model if you want a selector (but hardcoding is fine for MVP).

**Questions? Check:**
- This plan document
- Last night's plan: `2026-01-02-arc3-openrouter-integration-plan.md`
- Existing Playground: `client/src/pages/ARC3AgentPlayground.tsx`
- LLM-Council: `client/src/pages/LLMCouncil.tsx`
