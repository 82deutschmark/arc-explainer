I'll read both documentation files to understand the ARC3 engine constraints before pitching a new game design.





# New ARC3 Game Pitch: **Causal Echo** (`ce42`)

## Core Concept

A **temporal causality inference** game where the agent must discover that actions have **delayed, non-local effects** and must reason backwards from observed consequences to deduce the causal graph governing the environment.

---

## Why This Tests AI Differently

| Existing Games Test | Causal Echo Tests |
|---------------------|-------------------|
| Immediate feedback (action → result) | **Delayed feedback** (action now → effect in 3-5 turns) |
| Local effects (move here → change here) | **Non-local effects** (click here → change over there) |
| Single causal chain | **Entangled causal dependencies** |
| Pattern matching | **Counterfactual reasoning** ("what would happen if I hadn't done X?") |

---

## Mechanics

### Grid Layout
- **30×30 grid** divided into 4 quadrants
- **Source nodes** (colored cells, values 1-4): where agent acts
- **Effect nodes** (cells with value 8-11): where delayed changes manifest
- **Causal links** (invisible): connect source→effect with a **delay of N turns**
- **Goal indicators** (value 15): target patterns that must appear in effect nodes

### The Core Challenge
1. Agent clicks a **source node** (ACTION6)
2. Nothing visibly changes for **2-5 turns**
3. Then an **effect node** in a different quadrant changes color
4. Agent must infer: *which source caused which effect, and with what delay?*

### Level Progression
- **Level 1-3**: Single causal links, delay=2 turns, visual hint lines
- **Level 4-6**: Multiple overlapping links, delay=3 turns, no hints
- **Level 7-10**: Causal **interference** (two sources affecting same effect, XOR/AND logic)
- **Level 11+**: Temporal **ordering matters** (A then B ≠ B then A)

---

## Why Humans Win, AI Struggles

### Humans naturally:
- Form **hypotheses** ("I bet clicking red affects that blue corner")
- Track **time** intuitively ("that changed 3 moves after I clicked there")
- Use **elimination** ("I only clicked once, so that effect must be from it")
- Leverage **spatial intuition** ("sources on left probably affect targets on left")

### AI failure modes this exploits:
1. **Credit assignment collapse**: When effects are delayed, RL-style action→reward mapping fails
2. **Working memory limits**: Must remember what was clicked 5 turns ago
3. **Exploration inefficiency**: Random clicking produces noise; causal inference requires controlled experiments
4. **Correlation ≠ causation**: Multiple actions before an effect—which caused it?

---

## Action Semantics

| Action | Function |
|--------|----------|
| ACTION1-4 | Pan/scroll viewport (for larger grids) |
| ACTION5 | **"Wait/Pass"** — advance time without acting (critical for observing delayed effects!) |
| ACTION6 | Click source node (x,y) to activate it |
| ACTION7 | Undo last source activation (if within delay window) |

The **wait action** (ACTION5) is key—AI must learn that *not acting* is sometimes optimal to isolate causation.

---

## Win Condition

Produce the **target pattern** in effect nodes within the action budget. Target shown in corner of grid (like `ft09`'s reference pattern).

Since effects are delayed, the agent must:
1. **Plan backwards** from target state
2. **Interleave** source activations with wait cycles
3. **Avoid interference** from overlapping causal chains

---

## Scoring Framework

```
efficiency = human_baseline_actions / agent_actions
```

Human baseline: ~15-25 actions per level (hypothesis → test → confirm → execute plan)
AI random baseline: Effectively infinite (cannot solve by brute force due to combinatorial explosion of timing)

---

## Sample Level Walkthrough

**Level 4 setup:**
- 3 source nodes: Red (S1), Green (S2), Blue (S3)
- 3 effect nodes: E1, E2, E3
- Hidden causal graph: S1→E2 (delay 3), S2→E1 (delay 2), S3→E3 (delay 2)
- Target: E1=Yellow, E2=Cyan, E3=Magenta

**Optimal solution (12 actions):**
1. Click S1 (turn 1)
2. Click S2 (turn 2)
3. Click S3 (turn 3)
4. Wait (turn 4) — S2's effect appears at E1
5. Wait (turn 5) — S3's effect appears at E3, S1's effect appears at E2
6. WIN detected

**Why AI fails:** Random exploration triggers effects in unpredictable order. Without tracking "what did I do N turns ago?", the agent cannot learn the causal structure.

---

## Technical Fit

| Constraint | Causal Echo Compliance |
|------------|------------------------|
| Grid 0-64 | ✓ Uses 30×30 |
| Cell values 0-15 | ✓ 0=empty, 1-4=sources, 8-11=effects, 15=goal |
| ACTION1-7 | ✓ All used meaningfully |
| Frame response | ✓ Each turn returns updated grid |
| State enum | ✓ IN_PROGRESS until target pattern achieved |
| Level structure | ✓ Progressive difficulty via causal graph complexity |

---

## Summary

**Causal Echo** attacks a known AI weakness: **temporal credit assignment** and **causal reasoning under delayed feedback**. Humans solve it through intuitive hypothesis testing; current AI architectures struggle because:

- Transformers lack explicit temporal memory for "what I did N steps ago"
- RL reward signals get diluted across delay windows
- Random exploration cannot isolate variables

This directly tests the "intelligence as efficient skill acquisition" thesis—humans form causal models quickly; AI must either develop similar abstractions or fail.


Based on your knowledge of the ARC3 games and engines, was this idea any good? I'm not totally sold on this.  

