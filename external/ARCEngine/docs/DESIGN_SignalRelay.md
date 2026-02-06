I’ll first read `ARC3_GAME_DEVELOPMENT_GUIDE.md` and the official examples doc to understand the engine constraints (loops, entities, I/O, scoring, level structure). Then I’ll pitch a *new* ARC3-compatible game concept explicitly aimed at producing evaluation signals relevant to ARC-AGI (generalization, program induction, robustness), including: core mechanic, how levels are authored, what the “agent” must infer, scoring, anti-cheese measures, and how it fits the prize narrative.
I’m going to locate both docs inside the **worktree** (the path you mentioned for `external/ARCEngine/...` looks like it’s outside), then read them and come back with a concrete, engine-constrained game pitch.

I found [external/ARCEngine/](cci:9://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/external/ARCEngine:0:0-0:0) inside the worktree; next I’ll locate the two markdown files within that folder (and the root) and read them so the pitch stays within the engine’s actual constraints.

I’m not seeing those markdown files inside the worktree yet, so I’ll inspect the [external/ARCEngine](cci:9://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/external/ARCEngine:0:0-0:0) directory structure to find where the docs actually live (or whether they’re missing from this worktree checkout). Once I find them, I’ll read them and then produce a game pitch that strictly respects the engine constraints and ties back to ARC-AGI evaluation signals.





I’ll fall back to a plain workspace search (filename + text grep) to find where ARC3 docs live in this worktree, since the `Fast Context` search tool errored and [external/ARCEngine](cci:9://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/external/ARCEngine:0:0-0:0) appears empty (likely an uninitialized submodule). Once I locate the files (or confirm they’re missing), I’ll proceed with the pitch using whatever authoritative constraints are available.




# Pitch: **“Signal Relay”** — a zero-language game about learning hidden causal circuits

A totally new ARC3 game where you *don’t* win by navigating to a goal or matching a picture—you win by **discovering and controlling an unknown causal system** under tight action-efficiency pressure.

This directly targets ARC-AGI’s core thesis: *intelligence is efficient conversion of interaction into a correct strategy*.

---

## Engine fit (grounded in the docs you have)
From [docs/reference/arc3/ARC3.md](cci:7://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/docs/reference/arc3/ARC3.md:0:0-0:0) + [ARC3_Games.md](cci:7://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/docs/reference/arc3/ARC3_Games.md:0:0-0:0), ARC3 constraints we must respect:

- **Observation**: 1–N frames per action; grid up to `64x64`; values `0–15`.
- **Actions**: fixed set `RESET`, `ACTION1–7`; `ACTION6(x,y)` is coordinate click; `ACTION7` may be unused but can be supported.
- **No instructions**: players/agents must infer controls/rules/goal.
- **Score pressure**: every action hurts efficiency; brute-force exploration is punished.

Signal Relay is designed to *reward hypothesis-driven experimentation* and *penalize random clicking*.

---

# Core fantasy
You’re dropped into a “circuit board” (a grid) where colored tiles behave like **unknown logic gates**. Your job is to route energy (“signals”) into target receivers and keep it stable for a few ticks.

Humans will infer the rules quickly (“that looks like a toggle”, “that gate inverts”), while agents have to learn *causal structure* from sparse interactions.

---

# What makes it “new” vs existing games
- Not pathfinding (`ls20`), not static pattern matching (`ft09`), not multi-object hydraulics (`vc33`).
- Instead, it’s **system identification + control**:
  - Learn which tiles are sensors, actuators, gates, wires.
  - Learn *compositions* (“A activates B only if C is off”).
  - Solve levels by applying the discovered program with minimal probes.

This is closer to *program induction in a dynamical system* than to puzzle navigation.

---

# Grid semantics (all representable with colors 0–15)
You can implement everything as colored glyph-like motifs:

- **Wires**: a color that “lights up” when energized.
- **Sources**: emit signal when active.
- **Targets/Receivers**: must be lit in the correct configuration to win.
- **Gates** (examples):
  - **Toggle**: flips internal state on click.
  - **Splitter**: routes signal in multiple directions.
  - **Inverter**: negates signal.
  - **Latch**: holds last signal until reset.
  - **Timer**: delays a change by N steps (forces temporal reasoning).
- **Walls/insulators**: block propagation.

Everything is still just integer colors; the meaning is discovered by interaction.

---

# Interaction model (uses the standardized ARC3 actions cleanly)

## ACTION6 (x,y): “click tile”
Primary interaction:
- Clicking on an **actuator** tile toggles it (or cycles its mode).
- Clicking elsewhere is a no-op (but you *don’t get told that*, consistent with ARC3).

## ACTION1–4: “probe modes” (optional but useful)
These are deliberately *low-bandwidth* tools:
- Example mapping:
  - `ACTION1`: switch **probe overlay** (show recent signal flow history for 1 frame).
  - `ACTION2`: switch overlay to show **tile states** (e.g., which latches are set).
  - `ACTION3`: step **simulation speed** (single-step vs multi-tick preview).
  - `ACTION4`: “hold” to freeze (forces planning vs flailing).

If you want to keep it simpler, you can make ACTION1–4 unused and rely only on ACTION6 + ACTION5.

## ACTION5: “run / commit”
Key anti-bruteforce lever:
- When the player thinks they’ve configured the circuit, they press `ACTION5` to **start the signal stream** for several frames (like `sp80`’s multi-frame stream idea in your docs).
- During streaming, clicks are disabled (or ignored), so the player must plan.

## RESET
Restarts the level and clears hidden internal states (latches/timers), matching the standard behavior.

## ACTION7 (Undo)
Optional: if supported, undo last click. This is a human-friendly affordance; for agents it enables safe counterfactual tests.

---

# Level structure (how you author 100+ levels without overfitting)
Each **game** would share core physics (signal propagation + gate types), while levels vary by *which rules matter*.

### Early levels: discover primitives
- “Only one clickable switch exists; find it; make target light.”
- “Two switches, one target; one switch is a decoy.”

### Mid levels: composition & invariants
- “Two targets must be lit simultaneously, but one gate inverts.”
- “You must route around blockers; split signal.”

### Late levels: temporal reasoning & sparse feedback
- “Timer gate: target must be lit on tick 3, not tick 1.”
- “Latch memory: you must pulse a line once, then reroute elsewhere.”

This progression rewards building a reusable internal “theory” of the environment.

---

# Win condition (crisp, non-language)
A level is `WIN` when:
- Targets match a required pattern, e.g.:
  - All receivers lit (or specific subset).
  - Or one receiver lit *and* another unlit (introduces logical constraints).
- Condition must hold **for K consecutive frames** during stream execution (prevents accidental transient wins).

If stream ends without meeting the invariant: `GAME_OVER` or back to `NOT_FINISHED` with penalty (depending on ARC3 conventions).

---

# Scoring and anti-cheese (the ARC-AGI point)
Signal Relay is built to punish the failure modes called out in [ARC3.md](cci:7://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-ac20befd/docs/reference/arc3/ARC3.md:0:0-0:0) (“too friendly to random search”).

- **Exploration is expensive**:
  - Many tiles are non-clickable.
  - Clicking a wrong tile is a wasted action.
- **Hypothesis-driven probes are cheap**:
  - You can learn a lot from a single purposeful click if you interpret the multi-frame response.
- **Commit step** (`ACTION5`) is irreversible during stream:
  - Prevents “spam-click until something happens”.
- **No-op traps**:
  - Plenty of alluring structure that does nothing (agents must learn salience).
- **Loop penalties**:
  - Repeatedly toggling the same actuator can introduce diminishing returns (e.g., locks for N steps), discouraging brute cycling.

This aligns with ARC3’s “action efficiency vs human baseline” evaluation.

---

# Why this helps ARC-AGI (what it measures)
Signal Relay tests a bundle of capabilities ARC3 explicitly wants:

- **Efficient exploration**: identify controllable affordances quickly.
- **Causal reasoning**: infer hidden state machines from before/after frames.
- **Compositionality**: gates compose into bigger programs.
- **Memory**: store discovered gate behavior and reuse across levels.
- **Planning**: configure then commit; avoid random actions.

It also creates **clean telemetry**:
- You can measure how quickly an agent identifies:
  - Which coordinates matter (ACTION6 salience).
  - Which gate types exist.
  - Minimal action solutions vs “thrash then stumble”.

---

# Two concrete “signature moments” (what a human does)
## Moment 1: “Oh, that’s a latch”
Human clicks switch once, sees signal persists even after disconnecting input, immediately uses it as memory.  
An agent without causal modeling will keep re-clicking “to keep it on” and waste actions.

## Moment 2: “Timer gate”
Human notices target only flashes on tick 2; realizes they need to delay input.  
Agents that don’t model temporal dynamics will miss the invariant and brute force.

---

# Implementation risk/complexity (pragmatic)
- **Moderate**: It’s basically a deterministic grid simulation with a small set of gate rules and an update loop that can emit multi-frame responses (which ARC3 already supports conceptually).
- **Highly authorable**: You can build levels by placing tiles; difficulty scales by layout + which gates appear.
- **Hard to overfit**: random layouts with the same mechanics still require *understanding*, not memorizing.

---

## Quick clarifying question (so I can tailor the pitch)
Do you want this pitched as:
- **A candidate “official-style” ARC3 benchmark game** (pure, minimal UI, hard anti-cheese), or
- **A community / demo game inside your ARC Explainer tooling** (more visual affordances, optional overlays, friendlier to humans)?

# Status
- **Done**: I identified the relevant in-repo ARC3 constraints and produced a new game design that fits them.
- **Next**: If you answer the question above, I’ll adapt the design into a tighter “one-pager” spec (mechanics + action mapping + level progression + anti-cheese checklist) suitable for implementation planning.