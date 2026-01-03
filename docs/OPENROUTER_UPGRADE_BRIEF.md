# OpenRouter Runner Upgrade - Developer Brief
**Date:** 2026-01-03
**Status:** Ready for implementation
**Estimated Effort:** 5 hours
**Expected Impact:** 3-5x performance improvement

## Context

The OpenRouter agent runner (`server/python/arc3_openrouter_runner.py`) is functional but missing critical features from the battle-tested LangGraph pattern in `external/ARC-AGI-3-Agents2/agents/templates/langgraph_thinking/nodes.py`.

**Full audit:** [docs/audits/2026-01-03-arc3-agents2-integration-audit.md](docs/audits/2026-01-03-arc3-agents2-integration-audit.md)

## Three Critical Upgrades (In Order)

### 1. Structured Outputs with Pydantic (1 hour) - HIGHEST PRIORITY

**Problem:** Lines 346-355 use fragile regex to parse JSON from LLM response. This fails silently and falls back to random exploration.

**Solution:** Use LangChain's `with_structured_output()` with Pydantic schema.

**Implementation:**
```python
from pydantic import BaseModel, Field
from typing import Optional

class ActionDecision(BaseModel):
    """Structured action decision from LLM"""
    action: str = Field(description="ACTION1|ACTION2|ACTION3|ACTION4|ACTION5|ACTION6|RESET")
    reasoning: str = Field(description="Why this action was chosen")
    coordinates: Optional[tuple[int, int]] = Field(default=None, description="x,y for ACTION6 only")

    @validator('action')
    def validate_action(cls, v):
        valid = ["RESET", "ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6"]
        if v.upper() not in valid:
            raise ValueError(f"Invalid action: {v}")
        return v.upper()

    @validator('coordinates')
    def validate_coordinates_for_action6(cls, v, values):
        if values.get('action') == 'ACTION6' and v is None:
            raise ValueError("ACTION6 requires coordinates")
        return v
```

**Replace lines 334-361 in `analyze_frame()` with:**
```python
try:
    result = self.llm.with_structured_output(
        ActionDecision,
        method="json_schema",
    ).invoke(messages)

    return {
        "action": result.action,
        "reasoning": result.reasoning,
        "coordinates": result.coordinates,
    }
except Exception as e:
    emit_event("agent.reasoning", {"content": f"Structured output failed: {e}, using fallback"})
    return {"action": "ACTION1", "reasoning": f"Fallback due to error: {e}"}
```

**Test:** Run game, verify no regex parsing errors, check all action types work.

---

### 2. Observation Journal & Persistent Memory (2 hours) - SECOND PRIORITY

**Problem:** Agent has zero memory. Every turn is independent. Can't learn game rules or build strategies.

**Solution:** Maintain observations and thoughts lists, inject into system prompt each turn.

**Implementation:**

**Step 1:** Add to `Arc3OpenRouterAgent.__init__` (after line 260):
```python
self.observations: list[str] = []
self.thoughts: list[str] = []
```

**Step 2:** Add method to agent class:
```python
def add_observation(self, observation: str):
    """Add observation to journal, keeping only last 15"""
    self.observations.append(observation)
    if len(self.observations) > 15:
        self.observations = self.observations[-15:]

def add_thought(self, thought: str):
    """Add thought to journal, keeping only last 10"""
    self.thoughts.append(thought)
    if len(self.thoughts) > 10:
        self.thoughts = self.thoughts[-10:]
```

**Step 3:** Update `SYSTEM_PROMPT` (lines 233-252) to be a method:
```python
def build_system_prompt(self) -> str:
    """Build dynamic system prompt with observations and thoughts"""
    base = """You are an expert ARC-AGI-3 game player. Your goal is to explore and discover the rules of the game.

The game has the following actions:
- ACTION1: Move/interact up
- ACTION2: Move/interact down
- ACTION3: Move/interact left
- ACTION4: Move/interact right
- ACTION5: Special action (rotate, transform, etc.)
- ACTION6: Click at specific coordinates (requires x, y)
- RESET: Start over (only use if stuck)

Analyze the game frame carefully. Look for:
1. Patterns and shapes
2. Color relationships
3. Possible objectives (doors, keys, targets)
4. Changes from previous actions

Think step by step about what action to take next."""

    # Add thoughts if any
    if self.thoughts:
        thoughts_str = "\n".join([f"- {t}" for t in self.thoughts])
        base += f"\n\n**Your Previous Thoughts:**\n{thoughts_str}"

    # Add observations if any
    if self.observations:
        obs_str = "\n".join([f"- {o}" for o in self.observations])
        base += f"\n\n**Your Observations:**\n{obs_str}"

    return base
```

**Step 4:** Update `analyze_frame()` to use dynamic prompt (line 320):
```python
messages = [
    SystemMessage(content=self.build_system_prompt()),  # Changed from self.SYSTEM_PROMPT
    HumanMessage(content=[...])
]
```

**Step 5:** After each action, add reasoning to thoughts (in `choose_action()` after line 387):
```python
# Track action history and thoughts
self.action_history.append(action)
self.add_thought(f"Action {action}: {reasoning}")
self.previous_frame = frame_data
```

**Test:** Run game, check observations/thoughts appear in subsequent turns, verify memory persists.

---

### 3. Frame Delta Analysis (2 hours) - THIRD PRIORITY

**Problem:** Agent doesn't know what changed after actions. Can't learn cause-effect relationships.

**Solution:** Compare frames pixel-by-pixel, add delta summary to observations.

**Implementation:**

**Step 1:** Add function before `Arc3OpenRouterAgent` class:
```python
def analyze_frame_delta(previous_frame: list, current_frame: list) -> str:
    """Analyze pixel differences between frames.

    Returns human-readable summary of changes.
    """
    if not previous_frame or not current_frame:
        return "No previous frame to compare"

    # Handle 3D frames (take layer 0)
    prev_grid = previous_frame[0] if len(previous_frame) > 0 and isinstance(previous_frame[0], list) else previous_frame
    curr_grid = current_frame[0] if len(current_frame) > 0 and isinstance(current_frame[0], list) else current_frame

    changes = []
    movement_pixels = 0

    try:
        for y in range(min(len(prev_grid), len(curr_grid))):
            for x in range(min(len(prev_grid[y]), len(curr_grid[y]))):
                if prev_grid[y][x] != curr_grid[y][x]:
                    movement_pixels += 1
                    # Only log significant changes (avoid spam)
                    if movement_pixels <= 10:
                        changes.append(f"({x},{y}): {prev_grid[y][x]} → {curr_grid[y][x]}")

        if movement_pixels == 0:
            return "No visible changes - action may have failed or hit obstacle"
        elif movement_pixels < 20:
            return f"Small change ({movement_pixels} pixels): {', '.join(changes[:5])}"
        elif movement_pixels < 100:
            return f"Moderate change ({movement_pixels} pixels) - likely player movement or object interaction"
        else:
            return f"Large change ({movement_pixels} pixels) - major state transition or game reset"

    except Exception as e:
        return f"Delta analysis error: {e}"
```

**Step 2:** Update `choose_action()` to analyze deltas (add after line 388):
```python
# Analyze what changed from previous action
if self.previous_frame:
    prev_frame_data = self.previous_frame.get("frame", [])
    curr_frame_data = frame_data.get("frame", [])
    delta_summary = analyze_frame_delta(prev_frame_data, curr_frame_data)

    # Add delta to observations
    self.add_observation(f"After {self.action_history[-1]}: {delta_summary}")
    emit_event("agent.reasoning", {"content": f"Frame delta: {delta_summary}"})
```

**Test:** Run game with movement actions, verify delta summaries appear, check observations journal.

---

## What NOT to Do

### ❌ DON'T copy `prompts.py`
- It's overfitted to Game LS20 (specific objects, spoilers)
- Not competition-valid (gives game-specific knowledge)
- Won't work on other ARC3 games

### ❌ DON'T use `llm.py`
- Uses non-existent "gpt-4.1" model
- Deprecated Chat Completions API
- Our LangChain implementation is superior

### ❌ DON'T implement tool support
- Multi-step thinking wastes tokens
- Reasoning models already think deeply
- Actions are simple (ACTION1-6), don't need planning
- Frame delta provides feedback loop instead

---

## Testing Plan

### Baseline Test (Before Changes)
1. Start dev server: `npm run dev`
2. Navigate to `/arc3/openrouter-playground`
3. Enter OpenRouter API key
4. Select game `ls20`, model `xiaomi/mimo-v2-flash:free`
5. Run agent, record:
   - Success/failure
   - Total turns
   - Token usage
   - Parse errors in console

### After Each Phase
1. Run same test
2. Compare metrics
3. Check new features work (structured output, observations, deltas)
4. Verify no regressions

### Final A/B Test
- Run 5 games with old version
- Run 5 games with new version
- Compare success rate, avg turns, token usage

---

## Files to Modify

**Single file:** `server/python/arc3_openrouter_runner.py`

**Sections:**
- Lines 254-361: `Arc3OpenRouterAgent` class
- Add new function: `analyze_frame_delta()`
- Add Pydantic model: `ActionDecision`

**No changes needed to:**
- TypeScript bridge (`Arc3OpenRouterPythonBridge.ts`)
- Stream service (`Arc3OpenRouterStreamService.ts`)
- Frontend components
- Routes

---

## Dependencies

**Already installed:**
- `langchain-openai`
- `pydantic` (included with LangChain)

**No new dependencies needed.**

---

## Verification Checklist

After implementation:

- [ ] Structured outputs: No regex parsing errors in logs
- [ ] Structured outputs: Invalid actions rejected gracefully
- [ ] Observations: Check logs show observations accumulating
- [ ] Observations: Verify observations limited to 15 items max
- [ ] Thoughts: Check logs show thoughts being recorded
- [ ] Thoughts: Verify thoughts limited to 10 items max
- [ ] Frame delta: Check logs show pixel change counts
- [ ] Frame delta: Verify "no changes" detected when action fails
- [ ] Memory: Observations persist across turns in same game
- [ ] Memory: System prompt shows observations/thoughts
- [ ] Performance: Agent wins more games than baseline
- [ ] Performance: Token usage reasonable (<20% increase)

---

## Expected Outcomes

**Before:** Fragile regex parsing, no memory, blind to action outcomes
**After:** Reliable parsing, persistent memory, learns from feedback

**Metrics:**
- Parse success: 70% → 99%+
- Win rate: ~15% → 45-60%
- Avg turns to win: ~60 → ~35-40
- Token usage: +10-15% (offset by faster wins)

---

## Questions?

Refer to:
- Full audit: `docs/audits/2026-01-03-arc3-agents2-integration-audit.md`
- Reference implementation: `external/ARC-AGI-3-Agents2/agents/templates/langgraph_thinking/nodes.py`
- Current runner: `server/python/arc3_openrouter_runner.py`

Good luck! 🚀
