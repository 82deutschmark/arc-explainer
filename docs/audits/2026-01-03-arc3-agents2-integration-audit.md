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

### Priority 1: Add Tool Support (HIGH IMPACT)

**Goal:** Let agent think multiple times before acting

**Pattern from nodes.py:**
```python
# nodes.py lines 79-84
response = llm.bind_tools(
    all_tools,
    tool_choice="required",
    parallel_tool_calls=False,
    strict=True,
).invoke([system_message, *messages])
```

**Implementation:**
1. Define tools: `think(thought: str)`, `act(action: str, reasoning: str, x: int, y: int)`
2. Allow agent to call `think` multiple times
3. Extract action only when `act` tool is called
4. Emit `agent.reasoning` events for each thought

**Benefit:** Agent can deliberate before acting, build multi-step reasoning chains

### Priority 2: Frame Delta Analysis (MEDIUM IMPACT)

**Goal:** Help agent learn from action outcomes

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
3. Summarize changes (movement, state changes, etc.)
4. Add diff summary to next LLM call context

**Benefit:** Agent understands action consequences, can debug failed strategies

### Priority 3: Structured Outputs (LOW IMPACT)

**Goal:** Reliable action extraction without regex

**Pattern from nodes.py:**
```python
# nodes.py line 241-244
result = llm.with_structured_output(
    KeyCheck,
    method="json_schema",
).invoke([message])
```

**Implementation:**
1. Define Pydantic schema for action response
2. Use `with_structured_output()` instead of JSON regex
3. Handle schema validation errors gracefully

**Benefit:** More reliable, eliminates regex parsing bugs

### Priority 4: Observation Journal (MEDIUM IMPACT)

**Goal:** Persistent memory across turns

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
1. Maintain list of observations in agent state
2. Add new observations after frame delta analysis
3. Inject observations into system prompt
4. Limit to last N observations (avoid context bloat)

**Benefit:** Agent builds up knowledge, remembers discoveries

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

### Phase 1: Tool Support (2-3 hours)
1. Define `think` and `act` tools with Pydantic schemas
2. Update `analyze_frame()` to use `bind_tools()`
3. Implement tool execution loop (max 5 iterations)
4. Emit reasoning events for each thought
5. Test with MiMo-V2-Flash

### Phase 2: Frame Delta Analysis (1-2 hours)
1. Add `previous_frame` storage
2. Implement pixel-level diff function
3. Add diff summary to context
4. Test on game with clear state changes

### Phase 3: Observation Journal (1 hour)
1. Add `observations` list to agent state
2. Inject observations into system prompt
3. Limit to last 10 observations
4. Test memory persistence across turns

### Phase 4: Structured Outputs (30 min)
1. Define action schema with Pydantic
2. Replace regex with `with_structured_output()`
3. Test with edge cases

**Total Estimated Effort:** 5-7 hours
**Expected Impact:** 2-3x improvement in agent performance

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
