Author: Claude Haiku 4.5
Date: 2026-01-03
PURPOSE: Deep analysis of TOMAS Engine and GuidedRandomAgent. What they do well, technical architecture, and how to adapt patterns to OpenRouter/OpenAI agents.
SRP/DRY check: PASS - Patterns identified and unique responsibilities separated clearly

---

# External Agents Detailed Analysis: TOMAS Engine & GuidedRandomAgent

## TL;DR: What Each Agent Does Right

**TOMAS Engine (Gemini-based, 3.70% score, crashed often)**
- ✓ Three-phase sequential pipeline (perception → learning → decision) - clean SRP
- ✓ Shared memory system across phases for context continuity
- ✓ Explicit rule consolidation when levels are completed
- ✓ Structured output passing between phases (not just text)
- ✗ Over-engineered for ARC-3 constraints (single LLM, not three running agents)
- ✗ Multi-image handling (before/after/click) adds complexity without proven benefit
- ✗ Poor performance suggests complexity didn't translate to better gameplay

**GuidedRandomAgent (Pure heuristics, 2.24% score, 39k actions)**
- ✓ Effective action bias learning - tracks which action TYPES change the grid
- ✓ Object tracking with spontaneous change detection - spots when objects change without being clicked
- ✓ Avoids dead-end actions by remembering ineffective actions per grid state
- ✓ Movement mode cycling (aggro_momentum → momentum → random) - systematic exploration
- ✓ Cost-aware - budgets steps per level, quits early on hard levels
- ✗ No reasoning - pure probability adjustments, no understanding of WHY things work
- ✗ No rule learning - can't generalize across levels or games

---

## TOMAS Engine - Detailed Breakdown

### Architecture: Three Sequential Agents (Poorly Named)

**Not** three separate running processes. **One LLM (Gemini)** called three times with different prompts:

```
Game Frame →
  AISTHESIS prompt → "What changed?" → Structured object analysis →
  SOPHIA prompt → "What are the rules?" → Rule discovery + hypothesis generation →
  LOGOS prompt → "What should I do?" → Action sequence selection (1-5 actions) →
Action(s)
```

### Phase 1: AISTHESIS (Perception)
**Responsibility:** Analyze frame deltas with mathematical precision

**What it does:**
- Detects objects using flood-fill (connected components)
- Tracks object bounds, colors, regions (9-region grid)
- Compares before/after states to find:
  - Objects that changed (moved, color changed, disappeared)
  - Objects that stayed the same
  - Transformation type (TRANSLATION, COLOR_CHANGE, FUSION, FRAGMENTATION, etc.)
- Detects level transitions (WIN, GAME_OVER, RESET)
- Generates clickable coordinates from object centers
- **Outputs:** Text description + StructuredData with changed/unchanged objects + clickable coords

**Key Innovation:** Movement vectors
- Calculates `dx, dy` for each object movement
- Classifies direction (up/down/left/right + diagonals)
- Provides magnitude of movement

**Issues:**
- Flood-fill can be slow on large grids
- Multi-layer frame extraction needed "critical fix" - suggests fragility
- Tries to use Gemini for "no change" scenarios to understand environment (expensive)

### Phase 2: SOPHIA (Learning)
**Responsibility:** Discover and validate game rules

**Rule Types Tracked:**
- `MOVEMENT`: "ACTION1 moves player when path clear"
- `INTERACTION`: "Clicking button toggles light"
- `STATE_CHANGE`: "Key unlocks door"
- `WIN_CONDITION`: "Reaching exit completes level"
- `CONSTRAINT`: "Wall blocks movement"

**How it learns:**
1. **Observation Recording:** Stores every action → effect pair
2. **Pattern Detection:** Aggressive keyword matching on AISTHESIS output
   - Movement keywords: "moved", "position", "translation", "shifted"
   - Interaction keywords: "changed", "activated", "triggered", "switched"
   - Progress keywords: "score", "level", "complete", "win"
3. **Hypothesis Generation:** Creates ~15 different hypothesis types based on keywords
4. **Evidence Tracking:** Counts supporting/contradicting evidence for each rule
5. **Promotion to Rules:** Hypothesis → confirmed rule when:
   - Path 1: confidence ≥ 0.7 AND evidence ≥ 2
   - Path 2: confidence ≥ 0.6 AND evidence ≥ 4
   - Path 3: confidence ≥ 0.5 AND evidence ≥ 6

**Key Innovation: Rule Consolidation**
When level is completed:
- Rules that were confirmed recently (within last 10 turns) get marked `level_proven=True`
- Confidence boost: +0.15 (big boost)
- Level-proven rules:
  - Minimum confidence floor: 0.7 (won't degrade below this)
  - Degradation rate: 0.1% per turn after 25 turns (vs 0.5-1.5% for normal rules)
  - This etches successful patterns into memory

**Confidence Degradation (Important!):**
- Normal rules: Start degrading after 10 turns
- High confidence (≥0.8): -0.5% per turn (0.03 max per turn)
- Medium confidence (0.6-0.8): -1% per turn (0.05 max)
- Low confidence (<0.6): -1.5% per turn (0.08 max)
- **Why:** Prevents outdated rules from blocking learning in new contexts

**Outputs:** Text summary + StructuredData with:
- Confirmed rules (with confidence scores)
- Active hypotheses (being tested)
- Game objective confidence
- Recommended tests for LOGOS

### Phase 3: LOGOS (Decision Making)
**Responsibility:** Choose 1-5 actions based on perception + learning + psychology

**Psychological State Engine:**
Tracks five emotional dimensions:
- `confidence` (0-1): How sure about current strategy
- `frustration` (0-1): How stuck/blocked
- `curiosity` (0-1): Desire to explore vs exploit
- `patience` (0-1): Tolerance for exploration
- `recent_success_rate` (0-1): Moving average of action success

**Mental States (state machine):**
1. **Exploring** (default)
   - High curiosity focus
   - Sequence length: 1-2 actions
   - Risk tolerance: 0.8
2. **Pattern-seeking**
   - Lower curiosity, some successes
   - Sequence length: 2-3
   - Risk tolerance: 0.6
3. **Hypothesis Testing**
   - Medium confidence, some successes
   - Sequence length: 1-2 (short to test hypotheses)
   - Risk tolerance: 0.4
4. **Optimization**
   - High confidence, good success rate
   - Sequence length: 3-5 (commit to proven strategies)
   - Risk tolerance: 0.2
5. **Frustrated**
   - High frustration after repeated failures
   - Sequence length: 1 (snap decisions)
   - Risk tolerance: 0.9 (try radical different approaches)

**State Transitions:**
- Require 3 confirmations (stable transitions, not jittery)
- Trigger conditions:
  - frustration > 0.7 → frustrated
  - consecutive_failures > 4 → frustrated
  - consecutive_no_progress > 8 → frustrated
  - confidence > 0.8 + success_rate > 0.6 → optimization
  - confidence > 0.5 + successes > 1 → hypothesis_testing
  - curiosity < 0.5 + successes > 0 → pattern_seeking

**Confidence Adjustment Mechanism:**
Compares previous `expected_outcome` with actual AISTHESIS result:
- Perfect match: +0.2 boost
- Partial match: +0.1 boost
- No match: 0 adjustment
- Wrong prediction: -0.1 penalty

This measures how well LOGOS's mental model predicts reality.

**Outputs:** Sequence of 1-5 GameActions with reasoning

---

## GuidedRandomAgent - Detailed Breakdown

### Core Philosophy
"Simple cost-cheap policies + smart heuristics beat naive random"

This agent doesn't learn RULES. It learns WHAT WORKS FOR THIS GRID RIGHT NOW.

### Key Components

#### 1. Action Probability Bias Learning
**What it tracks:**
- `arrow_keys_chance` (initial 1.0)
- `spacebar_chance` (initial 1.0)
- `click_chance` (initial 1.0)

**How it learns:**
After every action, checks if grid changed:
- Grid changed: +0.5 to that action type's weight
- Grid unchanged: -0.1 to that action type's weight
- Bounds: [0.1, 5.0] (prevents weights from becoming useless)

This is **not** "arrow keys work", it's "arrow keys changed the grid this time"

#### 2. Object Tracking with Spontaneous Change Detection
**What it tracks per object:**
- Region (set of pixel coordinates)
- Color ID
- Bounds
- Size
- Weight (1.0 default, affects click probability)

**Spontaneous Change Heuristic:**
If an object's color changes without that object being the click target:
- Interpret as critical game event
- Apply temp_buff = 20.0 to that object's weight
- Next click will heavily favor this object

This catches indirect effects: "I clicked button A, but object B changed color → B is probably important"

**Object tracking lifecycle:**
- Detect objects each frame (flood-fill)
- Track which objects persist vs appear/disappear
- Remove stale objects from tracking
- When an object's color changes spontaneously → HIGH priority for next clicks

#### 3. Dead-End Action Memory
**What it remembers:**
```python
ineffective_actions_by_grid: Dict[str, List[ActionKey]]
```

For each unique grid state, remember which actions resulted in NO change.

**Example:**
- Grid state S1: tried UP, no effect → remember (UP,) was ineffective at S1
- Grid state S1: tried UP again, filter out from candidates
- Grid state S2 (different): UP might work → try it

This prevents getting stuck in loops of trying the same useless action.

#### 4. Movement Mode Cycling
**Three modes that cycle:**

**Aggro Momentum (100 steps default):**
```
UP → 80% UP, 10% LEFT, 10% RIGHT, 1% DOWN
DOWN → 80% DOWN, 10% LEFT, 10% RIGHT, 1% UP
LEFT → 80% LEFT, 10% UP, 10% DOWN, 1% RIGHT
RIGHT → 80% RIGHT, 10% UP, 10% DOWN, 1% LEFT
```
Biases heavily toward same direction (aggressive pursuit)

**Momentum (100 steps):**
```
UP → 50% UP, 25% LEFT, 25% RIGHT, 2.5% DOWN
(more balanced, still favors same direction)
```
Explores more while maintaining momentum

**Random (100 steps):**
```
All movement equally likely (25% each)
Pure exploration
```

**Why cycle?**
- Aggro momentum: If current direction works, commit hard
- Momentum: If lost, explore perpendicular directions
- Random: If still stuck, reset and search differently
- Cycle back: Gives previous direction another chance (environment might have changed)

#### 5. Cost-Aware Budgeting
**Hard limits:**
- `LEVEL_QUIT_STEPS = 13000`: If single level takes >13k actions, quit game
- `MAX_PREV_LEVEL_STEPS = 5000`: If previous level took >5k actions, expect future to be hard → quit
- `MAX_ACTIONS = 40000`: Total global limit

**Why quit early?**
- ARC-3 scoring is action efficiency
- Wasting 10k+ actions on one level tanks final score
- Better to quit and try different strategy on fresh game
- (This actually scored better than TOMAS which didn't quit)

---

## Gap Analysis: What The External Learnings Doc Got Wrong

### 1. TOMAS Is NOT Three Separate Agents
**Gap:** The doc says "three specialized AI agents" - this misses the architecture
**Reality:** One LLM called three times with different prompts (actually cleaner than stated)
**Implication:** We CAN adapt this pattern to OpenAI/OpenRouter by just calling the API three times per turn

### 2. Rule Consolidation Mechanism Was Underexplained
**Gap:** "Etches successful patterns into memory" - vague
**Reality:**
- Detects level completion by explicit AISTHESIS keywords ("🎉 LEVEL UP")
- Marks rules proven in last 10 turns as `level_proven=True`
- Sets minimum confidence floor at 0.7 (vs 0.4 for normal rules)
- Drastically reduces degradation rate (0.1% vs 0.5-1.5%)
**Implication:** This is mechanically sound and worth adapting

### 3. Confidence Degradation Was Ignored
**Gap:** External doc mentions rule storage but not how confidence decays
**Reality:**
- Different degradation rates based on confidence level
- Rules naturally fade if unconfirmed (prevents stale knowledge)
- Level-proven rules are protected
**Implication:** Without this, old rules block learning in new contexts

### 4. GuidedRandomAgent Wasn't Analyzed At All
**Gap:** No mention of object tracking, spontaneous change detection, dead-end memory, or movement cycling
**Reality:** All of these are LOW-COST heuristics that work
**Implication:** We should borrow these patterns (don't need LLM for any of them)

### 5. TOMAS's Poor Performance Suggests Over-Engineering
**Gap:** No mention of TOMAS's 3.70% score vs GuidedRandom's 2.24%
**Reality:**
- TOMAS spent 79 total actions before crashing (2nd place TOMAS attempt)
- GuidedRandom spent 39,881 actions and completed 1 game
- TOMAS crashed frequently (Gemini API issues?)
**Implication:** Complexity didn't help. Maybe the three-phase approach is overhead without proven benefit.

### 6. Missing: Psychological State Tracking
**Gap:** TOMAS has a sophisticated emotion system but it's barely mentioned
**Reality:** Frustration/confidence/curiosity significantly modulate decision-making
**Implication:** Worth adapting but as optional "soft" modulation, not hard state machine

---

## Actionable Patterns to Adapt

### From TOMAS (Worth Keeping)
1. ✓ **Three-phase pipeline structure** (perception → learning → decision)
   - Maps naturally to: AISTHESIS → SOPHIA → LOGOS
   - Each phase is one LLM call
   - Structured output passing between phases

2. ✓ **Rule consolidation on level completion**
   - Detect WIN state explicitly
   - Mark recently-confirmed rules as "proven"
   - Protect proven rules from degradation
   - Boosts confidence significantly

3. ✓ **Confidence degradation schedule**
   - Don't let old rules block forever
   - But protect high-confidence rules longer
   - Variable rates based on confidence level

4. ✓ **Structured rule representation**
   - Track rule_type, description, confidence, evidence_count
   - Store supporting_evidence + contradicting_evidence
   - Enable per-rule performance metrics

### From GuidedRandomAgent (Worth Stealing)
1. ✓ **Action type probability tracking**
   - Simple: track if arrows/space/clicks change the grid
   - Cheap: just boolean check, no LLM needed
   - Effective: biases toward action types that work

2. ✓ **Object tracking + spontaneous change detection**
   - Low cost: flood-fill is O(n)
   - High value: catches indirect effects
   - When object changes without being clicked → it's important

3. ✓ **Dead-end action memory per grid state**
   - Prevent looping on useless actions
   - Per-state tracking avoids false overgeneralization
   - Hashes grid state for quick lookup

4. ✓ **Movement mode cycling**
   - Structured exploration: aggro momentum → momentum → random
   - Don't get stuck: cycle through different patterns
   - Cost-cheap: just changes action probabilities

5. ✓ **Cost-aware budgeting**
   - Quit early on hard levels
   - Preserve action budget for easier wins
   - Improves overall action efficiency score

### To AVOID / Fix
1. ✗ **Multi-image AISTHESIS analysis**
   - TOMAS sends before/after + click visualization to Gemini
   - This is expensive (3 images per analysis)
   - Single structured object analysis is sufficient

2. ✗ **Over-reliance on Gemini for "no change" analysis**
   - When grid doesn't change, TOMAS calls Gemini to "understand environment"
   - This is wasteful
   - Should just report "no change detected, skipping analysis"

3. ✗ **Psychological state as hard state machine**
   - TOMAS transitions between mental states based on frustration/confidence
   - This works but is complex
   - Better: use psychology as soft modulation (adjust prompt + sequence length, don't hard-lock behavior)

4. ✗ **Aggressive hypothesis generation**
   - SOPHIA creates ~15 different hypothesis types per action
   - Most are weak/redundant
   - Better: focus on high-confidence rule discovery only

---

## Recommended Integration into OpenRouter/OpenAI Agents

### Phase 1: Perception (Keep TOMAS, Simplify)
```python
class AisthesisService(BaseService):
    """Analyze frame deltas with object detection"""
    - Flood-fill object detection
    - Before/after comparison
    - Changed vs unchanged object lists
    - Clickable coordinate generation
    - Return: StructuredAisthesisData (text + objects)
```

**Don't do:**
- Multi-image analysis (single structured analysis sufficient)
- Call Gemini for "no change" (just report it)

### Phase 2: Learning (Hybrid TOMAS + GuidedRandom)
```python
class SophiaService(BaseService):
    """Discover rules + track action effectiveness"""
    - TOMAS-style rule discovery (from AISTHESIS + action)
    - GuidedRandom-style action probability tracking
    - Rule consolidation on level completion
    - Keep it lightweight (5-10 rule types max, not 15)
```

**Layers:**
1. Symbolic rule learning (TOMAS-style)
2. Action type effectiveness (GuidedRandom-style)
3. Object interaction history (GuidedRandom-style)

### Phase 3: Decision (Keep TOMAS, Add GuidedRandom Heuristics)
```python
class LogosService(BaseService):
    """Choose actions based on perception + learning + heuristics"""
    - Core: TOMAS-style psychological modulation
    - Add: GuidedRandom-style dead-end filtering
    - Add: Movement mode cycling (optional)
    - Output: 1-5 action sequence
```

**Decision layers:**
1. First try: high-confidence rules
2. Second try: active hypotheses
3. Third try: movement mode cycling
4. Filter: remove known dead-end actions from this grid
5. Modulate: sequence length by psychological state

---

## Implementation Priorities

### Must Have (Week 1)
- [ ] Perception: Flood-fill object detection (AISTHESIS-lite)
- [ ] Learning: Rule tracking with confidence (SOPHIA-lite, 5 rule types)
- [ ] Decision: Basic action selection (LOGOS-lite, psychology optional)
- [ ] Action effectiveness tracking (GuidedRandom)
- [ ] Dead-end action memory (GuidedRandom)

### Should Have (Week 2)
- [ ] Rule consolidation on level completion (TOMAS)
- [ ] Movement mode cycling (GuidedRandom)
- [ ] Spontaneous change detection (GuidedRandom)
- [ ] Confidence degradation schedule (TOMAS)

### Nice to Have (Week 3+)
- [ ] Psychological state machine (TOMAS)
- [ ] Structured rule evidence tracking (TOMAS)
- [ ] Cross-validation of rules (TOMAS)
- [ ] Cost-aware budgeting (GuidedRandom)

---

## Summary Table

| Pattern | TOMAS | GuidedRandom | Score | Cost | Recommended |
|---------|-------|--------------|-------|------|-------------|
| Three-phase pipeline | ✓ | ✗ | 3.70% | High | ✓ Yes |
| Object tracking | ✓ | ✓ | 3.70% / 2.24% | Low | ✓ Yes |
| Rule consolidation | ✓ | ✗ | 3.70% | Low | ✓ Yes |
| Spontaneous change detection | ✗ | ✓ | 2.24% | Low | ✓ Yes |
| Action type effectiveness | ✗ | ✓ | 2.24% | Low | ✓ Yes |
| Dead-end memory | ✗ | ✓ | 2.24% | Low | ✓ Yes |
| Movement cycling | ✗ | ✓ | 2.24% | Low | ✓ Maybe |
| Psychological state machine | ✓ | ✗ | 3.70% | Med | ◐ Soft version |
| Multi-image analysis | ✓ | ✗ | 3.70% | High | ✗ Skip |
| Cost-aware budgeting | ✗ | ✓ | 2.24% | Low | ✓ Yes |

---

## Open Questions

1. **Why did TOMAS crash so much?**
   - Gemini API timeout issues?
   - Image processing errors?
   - Need to investigate before committing to multi-image analysis

2. **Would GuidedRandom have scored better with an LLM?**
   - GuidedRandom did 39,881 actions (super high)
   - But completed 1 full game vs TOMAS's 0 full games
   - What if we gave GuidedRandom's logic to an LLM for planning?

3. **Is three-phase pipeline overhead?**
   - TOMAS called Gemini 3x per turn (expensive)
   - GuidedRandom made decisions with pure heuristics
   - Could we do perception + decision in ONE Gemini call?

4. **How much does rule consolidation actually help?**
   - TOMAS implemented it but still got 3.70%
   - Could be useful for multi-level games, less so for single puzzle
   - Need empirical testing

---
