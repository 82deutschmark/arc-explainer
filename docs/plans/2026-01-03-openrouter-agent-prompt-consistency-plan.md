# OpenRouter Agent System Prompt Consistency Plan

**Author**: Assistant
**Date**: 2026-01-03
**Status**: Planning
**Priority**: High

## Problem Statement

The OpenRouter agent currently has an **inconsistent instruction model** compared to the OpenAI agent:

### Current Behavior (Broken)
- **OpenAI Playground**: Respects user's selected system prompt preset 100% (playbook, twitch, none)
- **OpenRouter Playground**: Ignores user preset selection and uses a hard-coded `BASE_SYSTEM_PROMPT` in Python

The OpenRouter agent does this in `server/python/arc3_openrouter_runner.py:450-472`:
```python
def build_system_prompt(self) -> str:
    prompt = self.BASE_SYSTEM_PROMPT  # <-- HARD-CODED, ignores UI selection
    if self.instructions:
        prompt += f"\n\n**User Instructions:**\n{self.instructions}"
    # ... adds observations/thoughts
    return prompt
```

### Expected Behavior
Both agents should respect the user's system prompt selection from the UI. If user selects "playbook", the agent uses the playbook system prompt. If user edits the textarea, that becomes the system prompt.

---

## Solution Overview

### Phase 1: Create "openrouter" System Prompt Preset
Add a new preset optimized for open-source reasoning models (MiMo, DeepSeek, etc.) that incorporates best practices from the Python agent.

**Location**: Add to system prompts table/config
**Characteristics**:
- Emphasizes hypothesis-driven exploration (from reasoning_agent.py)
- Tracks observations and learning (memory-focused)
- Encourages detailed reasoning before action
- Suitable for free/low-cost models

### Phase 2: Remove Hard-Coded Base Prompt
Modify `arc3_openrouter_runner.py` to eliminate `BASE_SYSTEM_PROMPT` and use user-provided prompt instead.

### Phase 3: Pass Full System Prompt to Python
Ensure the entire system prompt (not just instructions) flows from frontend → backend → Python.

---

## Implementation Steps

### Step 1: Create "openrouter" System Prompt Preset

**File**: `server/config/arc3SystemPrompts.ts` (or wherever presets are defined)

Add a new preset:
```typescript
{
  id: 'openrouter',
  label: 'OpenRouter (Reasoning-Focused)',
  description: 'Optimized for open-source reasoning models. Emphasizes hypothesis-driven exploration and learning.',
  isDefault: false, // User can change, but "playbook" remains default
  body: `You are an expert game explorer. Your goal is to understand the rules of interactive games through systematic experimentation.

**Your Approach:**
1. Form clear hypotheses about game mechanics
2. Design targeted tests to validate or refute hypotheses
3. Document discoveries and patterns
4. Build cumulative understanding across turns

**Game Actions:**
You have exactly 5 actions:
- ACTION1: MOVE_UP
- ACTION2: MOVE_DOWN
- ACTION3: MOVE_LEFT
- ACTION4: MOVE_RIGHT
- RESET: Start over (use only when stuck)
- ACTION6: Click coordinates (when needed for click-based games)

**Analysis Process:**
Before each action:
1. Examine the current grid state
2. Review your recent observations and findings
3. Identify what you learned from the last action
4. Propose the next test that will advance your understanding

**What to Track:**
- Entity positions and movements
- Color changes and patterns
- Game state transitions (WIN, GAME_OVER)
- Obstacles, keys, doors, collectibles
- Score or progress indicators

**Documentation:**
After each action, note:
- What changed in the game state
- Whether the result matches your hypothesis
- New discoveries or contradictions
- Refined understanding of mechanics

Remember: You are learning the game rules by observation and experimentation. Every action teaches you something.`,
}
```

**Rationale** (from reasoning_agent.py best practices):
- Emphasizes **hypothesis-driven** exploration (not random)
- Tracks **observations and findings** for learning
- Uses **structured reasoning** before action
- Designed for **reasoning-capable models** (MiMo, DeepSeek)
- Encourages **detailed reasoning** useful for reasoning tokens

### Step 2: Update Route Validation (Optional)

The route already accepts `systemPrompt` as optional, which is correct.

**File**: `server/routes/arc3OpenRouter.ts` (no changes needed)

The schema already supports:
```typescript
systemPrompt: z.string().optional(),
```

### Step 3: Remove Hard-Coded Base Prompt from Python Agent

**File**: `server/python/arc3_openrouter_runner.py`

**Change**: Eliminate `BASE_SYSTEM_PROMPT` and replace with user-provided prompt.

**Current Code (Lines 366-385)**:
```python
class Arc3OpenRouterAgent:
    BASE_SYSTEM_PROMPT = """You are an expert ARC-AGI-3 game player..."""  # REMOVE THIS

    def __init__(self, model: str, api_key: str, instructions: str = None,
                 reasoning_effort: str = "low", agent_name: str = "OpenRouter Agent"):
        # ...
        self.system_prompt = system_prompt  # ADD THIS PARAMETER
        self.instructions = instructions or ""
```

**New Code**:
```python
class Arc3OpenRouterAgent:
    # NO MORE BASE_SYSTEM_PROMPT

    def __init__(self, model: str, api_key: str, instructions: str = None,
                 system_prompt: str = None, reasoning_effort: str = "low",
                 agent_name: str = "OpenRouter Agent"):
        """
        Args:
            model: OpenRouter model ID
            api_key: OpenRouter API key
            instructions: User instructions for the game
            system_prompt: Full system prompt from UI (replaces hard-coded base)
            reasoning_effort: Reasoning effort level
            agent_name: Agent name for scorecard
        """
        self.model = model
        self.api_key = api_key
        self.system_prompt = system_prompt or "You are an AI game explorer. Experiment systematically to understand game rules."  # Minimal fallback
        self.instructions = instructions or ""
        self.reasoning_effort = reasoning_effort
        self.agent_name = agent_name
        # ... rest of init
```

**Change Method** (Lines 450-472):
```python
def build_system_prompt(self) -> str:
    """Build dynamic system prompt with observations and thoughts.

    Uses user-provided system prompt (not hard-coded) + observations/thoughts.
    """
    prompt = self.system_prompt  # <-- FROM USER, NOT HARD-CODED

    # Add user instructions if provided
    if self.instructions:
        prompt += f"\n\n**Your Task:**\n{self.instructions}"

    # Add thoughts (strategic insights) if any
    if self.thoughts:
        thoughts_str = "\n".join([f"- {t}" for t in self.thoughts[-5:]])
        prompt += f"\n\n**Your Strategic Thoughts:**\n{thoughts_str}"

    # Add observations (learned facts) if any
    if self.observations:
        obs_str = "\n".join([f"- {o}" for o in self.observations[-10:]])
        prompt += f"\n\n**Your Observations:**\n{obs_str}"

    return prompt
```

### Step 4: Update Python Runner to Pass System Prompt

**File**: `server/python/arc3_openrouter_runner.py`

**Change** (Lines 663-677):
```python
# Current (BROKEN):
combined_instructions = instructions
if system_prompt:
    combined_instructions = f"{system_prompt}\n\n{instructions}" if instructions else system_prompt

# REPLACE WITH:
# Pass system_prompt separately to agent - it handles the combination
agent = Arc3OpenRouterAgent(
    model,
    openrouter_api_key,
    instructions=instructions,  # Just instructions
    system_prompt=system_prompt,  # User's full system prompt
    reasoning_effort=reasoning_effort,
    agent_name=agent_name,
)
```

### Step 5: Update Frontend to Support "openrouter" Preset

**File**: `client/src/pages/Arc3OpenRouterPlayground.tsx`

No code changes needed—the UI already:
- Fetches system prompt presets from `/api/arc3/system-prompts`
- Allows switching between presets
- The new "openrouter" preset will automatically appear

**Frontend behavior**:
1. User selects "OpenRouter (Reasoning-Focused)" from dropdown
2. System fetches the "openrouter" preset body
3. Sets `systemPrompt` state to the full preset text
4. Passes it to backend in `start()` call
5. Backend passes it to Python
6. Python agent uses it (not hard-coded base)

---

## Files to Modify

| File | Change | Complexity |
|------|--------|-----------|
| `server/config/arc3SystemPrompts.ts` | Add new "openrouter" preset | Low |
| `server/python/arc3_openrouter_runner.py` | Remove `BASE_SYSTEM_PROMPT`, add `system_prompt` parameter | Medium |
| ~~`server/routes/arc3OpenRouter.ts`~~ | No changes (already passes `systemPrompt`) | - |
| ~~`client/src/pages/Arc3OpenRouterPlayground.tsx`~~ | No changes (already sends `systemPrompt`) | - |

---

## Testing Strategy

### Unit Tests
1. Verify `Arc3OpenRouterAgent` receives system_prompt parameter ✓
2. Verify `build_system_prompt()` uses user prompt, not hard-coded base ✓
3. Verify observations/thoughts append correctly to custom prompt ✓

### Integration Tests
1. **Test Scenario 1**: User selects "playbook" preset
   - Expected: Agent uses playbook system prompt
   - Verify: Check Python runner logs for system prompt content

2. **Test Scenario 2**: User selects "openrouter" preset
   - Expected: Agent uses openrouter reasoning-focused prompt
   - Verify: Check Python runner logs for system prompt content

3. **Test Scenario 3**: User edits system prompt textarea
   - Expected: Custom prompt is used instead of preset
   - Verify: Agent output reflects custom instructions

4. **Test Scenario 4**: Empty system prompt
   - Expected: Minimal fallback prompt used
   - Verify: Agent still functions (doesn't crash)

### Manual Testing
1. Start OpenRouter agent with "playbook" preset → observe reasoning
2. Start OpenRouter agent with "openrouter" preset → observe hypothesis-driven exploration
3. Edit system prompt textarea to custom text → verify custom prompt is respected
4. Switch presets mid-way (if paused) → verify new preset takes effect

---

## Rationale for "openrouter" Preset

The new preset incorporates best practices from `external/ARC-AGI-3-Agents2/agents/templates/reasoning_agent.py`:

| Practice | Source | Benefit |
|----------|--------|---------|
| Hypothesis-driven exploration | reasoning_agent.py lines 237-240 | Reduces random actions, focuses on learning |
| Observation tracking | reasoning_agent.py lines 431-438 | Agent learns from discoveries, improves actions |
| Detailed reasoning | reasoning_agent.py lines 28-39 | Better for reasoning token models |
| Action-effect analysis | reasoning_agent.py lines 317, 383-386 | Agent understands cause-effect relationships |
| Aggregated findings | reasoning_agent.py line 41 | Cumulative knowledge improves decisions |

---

## Success Criteria

✓ OpenRouter agent respects user's system prompt selection (like OpenAI agent does)
✓ Hard-coded `BASE_SYSTEM_PROMPT` is removed
✓ New "openrouter" preset is available for selection
✓ Observations and thoughts still append dynamically each turn
✓ All three presets (playbook, twitch, openrouter) work identically for both agents
✓ Tests pass (unit + integration)

---

## Dependencies & Considerations

### API Keys
- If user selects "openrouter" preset but uses OpenAI agent → preset will work fine (it's just instructions)
- If user selects "playbook" but uses OpenRouter agent → now it will work (currently ignored)

### Backward Compatibility
- Old saved games/sessions using hard-coded prompt will still work
- No DB migrations needed

### Performance
- No performance impact (same number of LLM calls)
- Slightly smaller prompts if user selects minimal preset

---

## Timeline & Phasing

**Phase 1 (Easy)**: Add "openrouter" preset config
**Phase 2 (Medium)**: Update Python agent to accept & use system_prompt
**Phase 3 (Verification)**: Test all scenarios, document results

**Total Effort**: ~2-3 hours for experienced developer

---

## References

- Current implementation: `server/python/arc3_openrouter_runner.py:366-472`
- OpenAI agent (reference): `client/src/pages/Arc3AgentPlayground.tsx` (shows correct pattern)
- System prompt presets: `server/config/arc3SystemPrompts.ts`
- Reasoning agent best practices: `external/ARC-AGI-3-Agents2/agents/templates/reasoning_agent.py`

---

## Questions for Next Developer

If stuck:
1. Are all three presets showing in the UI? (check `/api/arc3/system-prompts` response)
2. Is `systemPrompt` being passed to `start()` function? (check network tab in DevTools)
3. Is Python runner receiving `system_prompt` in JSON stdin? (add debug logging)
4. Does `build_system_prompt()` return the expected content? (print to stderr)
