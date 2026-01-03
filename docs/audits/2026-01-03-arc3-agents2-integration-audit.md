# ARC3 Agents2 Integration Audit
**Date:** 2026-01-03
**Author:** Claude Sonnet 4.5
**Purpose:** Audit the external ARC-AGI-3-Agents2 repository files to identify valuable patterns we should incorporate into our OpenRouter runner

## Executive Summary

The external ARC-AGI-3-Agents2 repository contains significantly more sophisticated agent architecture than our current `arc3_openrouter_runner.py`. Key files contain valuable patterns we should consider integrating:

1. **nodes.py** - Sophisticated LangGraph workflow with tool use, journaling, frame delta analysis
2. **prompts.py** - Game-specific prompts (but overfitted to Game LS20, needs generalization)
3. **llm.py** - Outdated (uses non-existent "gpt-4.1", doesn't support Responses API)

## File-by-File Analysis

### 1. `nodes.py` - HIGH VALUE ⭐⭐⭐⭐⭐

**Status:** "One of the most interesting and valuable files in here. Needs audit for 2026."

**Key Capabilities:**
- **Tool-based agent architecture** (`act()` function, lines 26-118)
  - Uses LangChain's `bind_tools()` with `tool_choice="required"`
  - Agent can call `think` and `act` tools iteratively
  - Supports up to 5 reasoning steps before selecting action
  - Maintains thoughts/observations in LangGraph store

- **Frame delta analysis** (`analyze_frame_delta()`, lines 155-218)
  - Pixel-by-pixel comparison between frames
  - Detects health changes, energy usage, movement
  - Uses LLM to synthesize changes into human-readable insights
  - Adds multimodal context (before/after images)

- **Vision-based key checking** (`check_key()`, lines 221-251)
  - Uses structured output (`with_structured_output()`)
  - Vision model analyzes if player's key matches exit door
  - Returns `KeyCheck` schema with match status

- **Smart initialization** (`init()`, lines 254-271)
  - Handles game state transitions (NOT_PLAYED → RESET)
  - Clears action after reset to avoid infinite loops

- **Random baseline** (`act_randomly()`, lines 121-152)
  - Useful for A/B testing against LLM agent
  - Shows proper action validation patterns

**What We're Missing in Our Runner:**
- ❌ No tool use (our agent just gets one LLM call per turn)
- ❌ No frame delta analysis
- ❌ No persistent journal/observations
- ❌ No vision-based verification of game state
- ❌ No multi-step reasoning loops

**Incorporation Opportunities:**
1. Add tool support to `Arc3OpenRouterAgent.analyze_frame()`
2. Implement frame delta analysis between turns
3. Add LangGraph store for observations/thoughts
4. Use structured outputs for action selection (more reliable than regex parsing)

### 2. `prompts.py` - MEDIUM VALUE ⭐⭐⭐

**Status:** "Prompts is putting it lightly; this is overfit and spoilers and specific instructions solely for Game LS20. Needs audit for 2026."

**Key Capabilities:**
- **Frame delta prompting** (`build_frame_delta_prompt()`, lines 30-50)
  - Asks model to interpret changes in context of last action
  - Focuses on learning and hypothesis updating
  - Good pattern for reflection

- **Game frame explanation** (`build_game_frame_explanation_prompt()`, lines 53-122)
  - **WARNING:** Hardcoded for Game LS20 specifics:
    - Specific object types (exit door, key, lives, refiller, rotator, wall)
    - Specific color codes and patterns
    - Specific win condition (match key to exit door)
  - **Problem:** Not generalizable to other ARC3 games

- **Key checker prompt** (`build_key_checker_prompt()`, lines 125-161)
  - Vision analysis prompt for key-door matching
  - Again, game-specific

- **System prompt builder** (`build_system_prompt()`, lines 164-204)
  - Injects observations and thoughts into system message
  - Dynamically rebuilds each turn with updated journal
  - Good pattern for maintaining agent memory

**What We're Using:**
- ✅ We have generic system prompt in `arc3_openrouter_runner.py` (lines 233-252)
- ✅ We build context with state/score/action history

**Problems with prompts.py:**
- 🚨 **Overfitted to LS20** - won't work for other games
- 🚨 **Spoilers** - tells agent exactly what objects are and how to win
- 🚨 **Not competition-valid** - gives agent game-specific knowledge

**Incorporation Strategy:**
- ❌ **DO NOT** copy game-specific prompts
- ✅ **DO** adopt patterns:
  - Frame delta analysis flow
  - Observation/thought journaling
  - Dynamic system prompt rebuilding

### 3. `llm.py` - LOW VALUE ⭐

**Status:** "This is just extremely out of date... Essentially, write your own better version."

**Problems:**
- Uses non-existent model "gpt-4.1" (should be GPT-5.1 series now)
- Uses Chat Completions API (deprecated for reasoning)
- Doesn't support Responses API
- No reasoning configuration
- Single hardcoded model

**What We're Doing Better:**
- ✅ Our runner uses LangChain's `ChatOpenAI` with OpenRouter
- ✅ Supports configurable models
- ✅ Supports reasoning toggle via `extra_body.reasoning.enabled`
- ✅ Proper temperature/max_tokens configuration

**Action:** Ignore this file, our implementation is superior.

## Our Current Implementation: `arc3_openrouter_runner.py`

**Strengths:**
- ✅ Clean NDJSON event emission for TypeScript integration
- ✅ Full ARC3 API client (open/close scorecard, execute actions)
- ✅ Frame rendering to PNG for multimodal input
- ✅ Configurable model, reasoning toggle, max turns
- ✅ Rich scorecard metadata (tags, opaque fields)
- ✅ Proper error handling and event streaming
- ✅ Competition-emulation mode (autonomous until WIN/GAME_OVER)

**Weaknesses (compared to nodes.py):**
- ❌ Single-shot LLM calls (no tool use or multi-step reasoning)
- ❌ No frame delta analysis
- ❌ No persistent observations/thoughts journal
- ❌ Regex-based JSON extraction (fragile)
- ❌ No structured output enforcement
- ❌ No vision-based state verification

**Severity:** MEDIUM
**Impact:** Agent makes less informed decisions, can't build up knowledge over time

## Recommendations

### Priority 1: Structured Outputs with Pydantic (CRITICAL IMPACT)

**Goal:** Reliable, type-safe action extraction - eliminate fragile regex parsing

**Pattern from nodes.py:**
```python
# nodes.py line 241-244
result = llm.with_structured_output(
    KeyCheck,
    method="json_schema",
).invoke([message])
```

**Implementation:**
1. Define Pydantic schema for action response with proper validation
2. Use `with_structured_output()` instead of JSON regex extraction
3. Handle schema validation errors gracefully with fallback
4. Ensure coordinates are properly typed and validated

**Current Problem:**
```python
# arc3_openrouter_runner.py lines 346-355 - FRAGILE
json_match = re.search(r'\{[^}]+\}', response_text)
if json_match:
    action_data = json.loads(json_match.group())
else:
    action_data = {"action": "ACTION1", "reasoning": "Exploring"}
```

**Benefit:** Eliminates parsing failures, proper type safety, guaranteed valid actions

### Priority 2: Observation Journal & Persistent Memory (CRITICAL IMPACT)

**Goal:** Agent builds knowledge across turns, remembers discoveries and hypotheses

**Pattern from nodes.py:**
```python
# nodes.py lines 71-76
observations = [
    Observation(id=item.key, observation=item.value)
    for item in store.search(("observations"), limit=100)
]
system_message = SystemMessage(
    content=build_system_prompt(observations, state["thoughts"])
)
```

**Implementation:**
1. Maintain `observations` list in agent state (not LangGraph store for simplicity)
2. Add new observations after each frame delta analysis
3. Inject observations into system prompt dynamically each turn
4. Limit to last 10-15 observations to avoid context bloat
5. Track `thoughts` list for agent's hypotheses and learnings

**Current Problem:** Agent has no memory - every turn is independent, can't build on discoveries

**Benefit:** Agent learns game rules, remembers what works, builds coherent strategies

### Priority 3: Frame Delta Analysis (HIGH IMPACT)

**Goal:** Help agent learn from action outcomes by showing what changed

**Pattern from nodes.py:**
```python
# nodes.py lines 169-193
for i in range(len(latest_frame.frame)):
    for j in range(len(latest_frame.frame[i])):
        for k in range(len(latest_frame.frame[i][j])):
            if latest_frame.frame[i][j][k] != previous_frame.frame[i][j][k]:
                movements.append(f"<{j},{k}>: {prev} -> {curr}")
```

**Implementation:**
1. Store `previous_frame` in agent state
2. After each action, compute pixel-level diff
3. Summarize changes (movement, state changes, energy usage, etc.)
4. Add diff summary to observations journal
5. Include recent deltas in next LLM call context

**Current Problem:** Agent doesn't know if actions succeeded, failed, or had unintended effects

**Benefit:** Agent understands action consequences, can debug failed strategies, learns cause-effect

### ~~Priority 4: Tool Support~~ (REJECTED - Token Waste)

**Why NOT implementing:**
- Actions are simple (ACTION1-6, RESET) - no complex reasoning needed
- Reasoning models already think deeply in single pass
- Multi-step tool calls waste tokens without adding value
- Frame delta analysis provides feedback loop instead

**Decision:** Keep single-shot LLM calls, use reasoning budget for frame analysis instead

## Integration Risks

### Risk 1: Increased Token Usage
**Mitigation:** Make features configurable (turn off delta analysis, limit observations)

### Risk 2: Breaking Changes
**Mitigation:** Keep current simple mode, add "advanced" mode flag

### Risk 3: Model Compatibility
**Mitigation:** Test tool use with MiMo-V2-Flash and fallback gracefully

### Risk 4: Game-Specific Overfitting
**Mitigation:** DO NOT copy prompts.py verbatim - keep generic exploration prompts

## Proposed Implementation Plan

### Phase 1: Structured Outputs with Pydantic (1 hour) - CRITICAL
1. Define Pydantic `ActionDecision` schema with fields: `action`, `reasoning`, `coordinates` (optional)
2. Add validation: action must be valid enum, coordinates required only for ACTION6
3. Replace regex extraction with `llm.with_structured_output(ActionDecision)`
4. Add fallback handling for schema validation failures
5. Test with edge cases (malformed responses, missing fields)

**Files to modify:** `server/python/arc3_openrouter_runner.py` (lines 292-361)

### Phase 2: Observation Journal & Persistent Memory (2 hours) - CRITICAL
1. Add `observations: list[str]` and `thoughts: list[str]` to `Arc3OpenRouterAgent.__init__`
2. Create `add_observation(text: str)` method with length limiting (max 15 items)
3. Update `build_system_prompt()` to inject observations and thoughts
4. After frame delta analysis, add summary to observations
5. After each action, optionally add agent's reasoning to thoughts
6. Test memory persistence across full game session

**Files to modify:** `server/python/arc3_openrouter_runner.py` (Arc3OpenRouterAgent class)

### Phase 3: Frame Delta Analysis (2 hours)
1. Add `previous_frame: Optional[dict]` to agent state
2. Create `analyze_frame_delta(prev, curr) -> str` function
3. Implement pixel-level diff with movement/state change detection
4. Generate human-readable delta summary
5. Add delta summary to observations journal
6. Test on game with clear visual changes

**Files to modify:** `server/python/arc3_openrouter_runner.py` (new function + integration)

**Total Estimated Effort:** 5 hours
**Expected Impact:** 3-5x improvement in agent performance through memory and reliability

## Files on 2026 Branch

The external ARC-AGI-3-Agents2 repo is now on branch `2026` (isolated from upstream updates). Any modifications we make should:
1. Happen on this branch
2. Be documented in this audit
3. Avoid breaking compatibility with our runner

## Next Steps

1. **User Decision:** Which priorities to tackle first?
2. **Smoke Test:** Run current runner on dev server to establish baseline
3. **Implementation:** Add features incrementally with tests
4. **Comparison:** Run A/B test (simple vs. advanced mode)

## Conclusion

The nodes.py file contains battle-tested patterns that could significantly improve our agent's performance. The tool-use architecture and frame delta analysis are particularly valuable. However, we must avoid the overfitting pitfalls in prompts.py and ignore the outdated llm.py.

Our current runner is a solid foundation - we should enhance it incrementally rather than replace it wholesale.
