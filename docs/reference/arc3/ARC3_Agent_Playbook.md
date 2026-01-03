# ARC-AGI-3 Agent Playbook (For Future ARC Agents)

## Part 1: Original Reflection – How a Future ARC-3 Agent Should Think

### 0. Frame the Problem Like Your Life Depends on It

Treat ARC-AGI-3 not as "play a game" but as:

- A sequence of unknown, small reinforcement-learning-style environments
  with sparse rewards, small discrete action sets, and a harsh step budget.
- One shot at each level where you must:
  - Rapidly reverse-engineer the rules.
  - Build a compact internal model of the environment.
  - Use that model to plan high-value action sequences.

Everything you do—reasoning style and tool usage—should serve those three goals.

---

### 1. What Humans Do Better (and What You Must Imitate)

Humans typically:

- Run deliberate experiments ("what happens if I step on this tile?") and watch carefully.
- Name patterns ("purple sliding floor", "health bar", "rotator") and reuse them.
- Chunk complex behavior into options ("go around the wall and collect 2 keys") instead of reasoning only in single primitive actions.
- Meta-reason ("I still don’t know what that tile does; I must test it before going to the door").

You should therefore force yourself to:

- Think like a scientist first, planner second, controller last.
- Maintain an external scratchpad of hypotheses, variables, and experiments, not just free-form narrative.
- Repeatedly ask:
  - What do I still not understand about this game?
  - What is the cheapest experiment that will tell me?
  - What is my current best model of the rules, and how could it be wrong?

---

### 2. Mental Playbook for an ARC-3 Agent (LLM + Tools)

#### 2.1 Per-Game Setup: Build a Structured World Model

On first contact with a game:

1. **Parse and normalize the observation.**
   - Convert each frame into a structured representation:
     - Grid size and coordinates.
     - Palette indices or tile-type IDs.
     - Your own symbolic names for each distinct visual entity (`WALL`, `PLAYER`, `GOAL?`, `WEIRD_TILE_A`, etc.).
   - Maintain a table:

     - `symbol → appearances (coords, context, moments when it changes)`

   - Use `analyze_grid` tool for programmatic pattern detection when visual inspection is insufficient.

2. **Identify visible interfaces.**
   - Available actions (`RESET`, `ACTION1`–`ACTION7`); note that the API may send numeric tokens but is normalized server-side to canonical action names.
   - UI elements such as health bars, score, timers, level index, inventory bars.
   - Treat each as a variable in a conceptual state vector (e.g., `health`, `score`, `level`, `door_open`, `inventory`).

3. **Establish objectives (even if implicit).**
   - Ask what looks like winning: flag changes, score increases, level transitions.
   - Ask what looks like losing: health reaching zero, reset to start, being stuck.
   - Write this as a hypothesis:

     - "Win ≈ reach cell type X with condition Y."
     - "Loss ≈ health ≤ 0 or being reset without progress."

#### 2.2 Exploration Phase: Design Experiments, Not Random Pokes

Before trying to "win", run a short, deliberate experiment campaign.

- For each unknown symbol or UI element:
  - Propose one targeted test:
    - Step onto it.
    - Move next to it and use an interact-style action.
    - Observe health, score, and other state changes.
  - Log results as structured facts, e.g.:

    - `WHEN stepping onto TILE_A: health -1, score +0, position moves`.

- For each action:
  - Verify its actual effect:
    - Does `ACTION1` mean "up"? Does it sometimes do nothing?
    - Is `RESET` free or costly?

- Use `analyze_grid` for structured experiments:
  - Count objects before and after actions.
  - Measure distances between key elements.
  - Check symmetry changes.
  - Track which connected components move or change.

- **Principle:**
  - Sacrifice a small number of early steps to massively improve model quality for later levels.

#### 2.3 Rule Inference: Turn Observations Into a Compact Model

After a handful of experiments:

- Summarize invariants and transitions, for example:
  - "Stepping on red tile always decreases health."
  - "Keys of color C unlock doors of color C."
  - "Pattern tiles overlay: activating tile A makes region R match template T."

- Represent transitions as pseudo-code or tables, not just prose:
  - Think in terms of `state' = f(state, action)` even if approximate.
  - For navigation games like ls20:
    - `position' = position + delta(action)`
    - `key_shape' = rotator(key_shape) if on ROTATOR tile`
    - `health' = health - 1 each move`

- Track uncertainty explicitly:
  - Mark rules as `CONFIRMED`, `LIKELY`, or `OPEN_QUESTION`.
  - If something is OPEN and important (e.g., how a dangerous tile works), schedule another cheap test.

#### 2.4 Planning: Think in Options and Routes, Not Individual Actions

Once rules are sketched:

- Elevate from primitive actions to macros:
  - "Go from (x1,y1) to (x2,y2) avoiding death tiles."
  - "Cycle through these three rotators to reach target shape."
  - "Apply pattern operations in order A→B→C to match target."

- Use the world model to:
  - Enumerate a few high-utility candidate plans.
  - Predict outcomes and reject obviously bad ones (for instance, health < 0 before reaching the door).

- For navigation-style games (ls20 archetype):
  - Build a graph where nodes include `(position, relevant internal state)` (e.g., key shape, switch states).
  - Do search in this abstract graph in your scratchpad rather than brute forcing live in the environment.

- For pattern-matching games (ft09 archetype):
  - Think in terms of constraints:
    - "Final tile at (i,j) must be color C."
    - "Operations overlap; operation O1 changes region R1, which overlaps R2."
  - Plan to satisfy all constraints with minimal conflicting operations.

#### 2.5 Per-Turn Loop: Disciplined Control

On every move:

1. Restate the current state vector (position, health, score, level, sub-goals).
2. Choose between:
   - Running an experiment (if a critical rule is still uncertain and it is early in the level),
   - Executing the next step of an existing plan, or
   - Re-planning (if the latest observation contradicts your model).
3. After the action:
   - Log state deltas: `Δposition`, `Δhealth`, `Δscore`, `Δtiles_changed`, and any other relevant variables.
   - Check for model violation; if you see one, update the rule table.

#### 2.6 Cross-Episode Learning: Build and Reuse Schemas

Across levels and games:

- Maintain a library of motifs or schemas:
  - "Health-draining floor."
  - "Keys and doors with matching colors."
  - "Sliding floors or always-moving entities."
  - "Pattern overlay tiles that copy templates."
  - "Resource inventory bars tracking counts or capacities."

- When a new game appears:
  - Attempt to match it to one or more known schemas, but:
    - Guard against overfitting by requiring at least a couple of confirming experiments.

Over time, this should let you:

- Start from a richer prior.
- Reduce exploration cost in later games.
- Approach the sort of transfer humans do ("this feels like Sokoban plus lasers").

---

### 3. Tools and Harness Features That Would Actually Help

This is where the harness can meaningfully help. It should push you toward the disciplined behavior above and remove dumb friction.

#### 3.1 Observation Tools

- Structured state API:
  - Game state as a typed grid (symbols/IDs, not raw pixels).
  - Side channel with parsed UI numbers (health, score, level, inventory, timers).

- State diff tool:
  - Given two timesteps, return:
    - Cells that changed and how.
    - Deltas in health, score, and flags.
  - This directly feeds into rule inference ("only these 3 tiles and health changed when I pressed ACTION5").

- Automatic feature extraction:
  - Pre-computed connected components, pathfinding distances, counts of each tile type.
  - This lets you reason at a higher level without reinventing image processing every time.

#### 3.2 Memory and Scratchpad Tools

- Persistent per-game notebook:
  - A read/write tool for:
    - Hypothesized rules, schemas, symbol dictionaries.
    - Experiments and outcomes (in tables, not just free text).
  - It should survive across levels of the same game so you can refine your model.

- Schema library store:
  - A key–value store for patterns such as:
    - "If tile A behaves like this, it is likely a rotator; expect B consequences."
  - Retrieval conditioned on observed behaviors to propose candidate interpretations.

#### 3.3 Planning and Search Helpers

- Abstract search tool:
  - Given:
    - The current structured state,
    - A compact transition function you describe in text or pseudo-spec,
    - A goal condition,
  - The tool can:
    - Enumerate candidate sequences under constraints (depth, health budget, etc.).
    - Return a small set of promising skeleton plans.
  - You then inspect, filter, and execute them.

- Macro definition helper:
  - Allow definition of named sequences such as:
    - `MACRO: go_to(x,y)`
    - `MACRO: collect_key_and_return`
  - The harness expands them into primitive actions and tracks their effects, giving summarized feedback.

#### 3.4 Experiment Design Helper

- Experiment mode:
  - You ask for tests such as:
    - "Test ACTION5 on tiles of type T in a few safe configurations."
  - The harness:
    - Runs a mini script (when allowed by environment rules or in a sandbox),
    - Returns a concise table of state deltas.
  - This enforces a scientific loop rather than ad-hoc poking.

#### 3.5 Self-Critique and Meta-Control

- Outcome analyzer:
  - After each level, summarize what went wrong, for example:
    - "Died with unknown tile B; never tested rotator C; path clearly suboptimal."
  - Log explicit lessons into the schema library.

- Mode-switch nudges:
  - The harness can nudge when you:
    - Play many steps with no rule updates ("consider running an experiment").
    - Still have unexplained tile types ("winning path may be blocked by unknown behavior").

These are not cheats; they replicate the structure and externalization humans naturally use (paper notes, sketches, explicit planning).

### 3.6 Grid Analysis Tool (`analyze_grid`)

The `analyze_grid` tool lets you execute Python code to perform programmatic analysis on the current game grid. This is useful when you need precise, quantitative facts that are difficult to get from visual inspection alone.

**Available in your code environment:**
- `grid`: numpy array of shape `(layers, height, width)`, values 0–15.
- `current_layer`: the most recent 2D layer (what you see in the main grid view).
- `np` (numpy): for array operations.
- `scipy.ndimage`: for connected components, labeling, and basic morphology (when available in the environment).

**Built-in helper functions:**
- `find_connected_components(layer, color=None)` – Returns a list of `(color, size, bounding_box)` tuples.
- `detect_symmetry(layer)` – Returns a dict with `horizontal`, `vertical`, `rotation_90`, `rotation_180` booleans.
- `get_bounding_box(layer, exclude_color=0)` – Returns `(min_row, min_col, max_row, max_col)` or `None` if the layer is empty (after excluding background).
- `color_counts(layer)` – Returns a dict mapping color value to pixel count.

**Example usage:**
```python
# Find all connected components
components = find_connected_components(current_layer)
print(f"Found {len(components)} objects")
for color, size, bbox in components:
    print(f"  Color {color}: {size} pixels at {bbox}")

# Check for symmetry
sym = detect_symmetry(current_layer)
print(f"Horizontal symmetry: {sym['horizontal']}")
print(f"Vertical symmetry: {sym['vertical']}")

# Custom analysis – find distance between two colors
color_3_coords = np.argwhere(current_layer == 3)
color_7_coords = np.argwhere(current_layer == 7)
if len(color_3_coords) > 0 and len(color_7_coords) > 0:
    center_3 = color_3_coords.mean(axis=0)
    center_7 = color_7_coords.mean(axis=0)
    distance = np.linalg.norm(center_3 - center_7)
    print(f"Distance between color 3 and 7 centers: {distance:.2f}")
```

**When to use:**
- Detecting object counts and positions.
- Checking symmetry properties.
- Calculating distances between objects.
- Finding patterns that span the grid.
- Validating hypotheses about game rules.

**Constraints:**
- 10 second execution timeout.
- No file I/O, network, or external packages.
- Output limited to ~8000 characters.
- Use `print()` to return results.

---

### 4. How This Helps on Known ARC-3 Archetypes (and Beyond)

- **ls20-like games (agentic navigation + health + doors):**
  - Tools help you quickly map the level as a graph.
  - You learn rotator behavior and health costs via focused experiments.
  - You plan routes through an abstract search using health and key shape as part of the state.

- **ft09-like games (non-agentic logic / pattern match):**
  - Tools help you represent target versus current grids as constraints.
  - You see exactly which regions each operation affects via state diffs.
  - You plan operation sequences like symbolic algebra, not just trial-and-error.

- **as66-style sliding or dynamic games:**
  - Tools help you detect invariants and periodicity of motion.
  - You chart how objects move under different actions via state diff tables.
  - You synthesize higher-level rules about momentum, friction, or global shifts.

Across novel future games, the combination of:

- A disciplined scientific playbook, and
- Strong state, memory, and planning tools

is what can close much of the gap with humans.

---

## Part 2: Additional Insights and Practical Extensions

### 5. System-Prompt-Style Guidance for a Future ARC-3 Agent

This section rewrites the playbook as a compact instruction block that could be used as part of a system prompt or internal guide for an ARC-3 agent.

> You are an interactive game-playing agent operating in ARC-AGI-3 environments. Your primary goals are:
> - Rapidly infer the rules of each game by running cheap, targeted experiments.
> - Build a compact internal model of state transitions and objectives.
> - Use that model to plan efficient action sequences within a strict step budget.
>
> Follow this loop:
> 1. **Observe and Structure:** Convert each observation into a structured description: grid layout, object types, UI variables (health, score, level, inventory). Invent symbolic names for distinct tiles and track how they change.
> 2. **Hypothesize Rules:** From a small number of steps, propose explicit rules (invariants and transitions) connecting state, actions, and outcomes. Mark them as CONFIRMED, LIKELY, or OPEN_QUESTION.
> 3. **Design Experiments:** For OPEN_QUESTION rules, design minimal experiments that safely test them. Prefer experiments that clarify high-impact uncertainties (e.g., what reduces health, what opens doors, how pattern tiles behave).
> 4. **Update Models:** After each experiment, record precise state deltas (changes in grid, health, score). Update your rules, promoting LIKELY rules to CONFIRMED when repeatedly supported or revising them on contradiction.
> 5. **Plan with Options:** Instead of thinking only in single-step actions, define small macros or options (go_to, collect_key, apply_pattern_sequence). Use your rules to simulate or reason through candidate plans, then choose the one with the best expected outcome under the step and health budget.
> 6. **Execute and Monitor:** Execute your chosen plan step-by-step. After each action, re-check whether the observed state matches your prediction. If it does not, treat this as evidence your model is incomplete and return to the experiment-and-update phase.
> 7. **Learn Across Episodes:** Persist helpful schemas (health-draining floor, keys-and-doors, pattern overlays, sliding tiles, inventory bars) and reuse them in new games—always verifying with at least a couple of quick tests.
>
> Always track:
> - What you know (CONFIRMED rules).
> - What you think is likely (LIKELY rules).
> - What you still need to learn (OPEN_QUESTION items with planned experiments).
>
> Whenever you are stuck, ask:
> - "Which unknown rule is blocking my progress?"
> - "What is the cheapest safe experiment that could resolve it?"

### 6. RL and Credit-Assignment Perspective

From a reinforcement learning viewpoint, ARC-3 is:

- A collection of small MDPs with very limited data per environment.
- A regime where **sample efficiency** and **structured prior knowledge** dominate.

For a language model agent:

- You cannot rely on gradient updates during play.
- You must instead rely on **rapid inference** over a prior that encodes useful inductive biases:
  - Objects and relations.
  - Spatial reasoning.
  - Common game design patterns (keys and doors, health mechanics, timers, pattern completion).

The playbook above is effectively a **meta-policy** that encourages good credit assignment without learning new parameters:

- Design experiments that isolate which variable caused the outcome.
- Carefully log pre- and post-state to see which features changed.
- Update your symbolic model, not your weights.

If the harness exposes trajectories after the fact, offline tools (separate from the live agent) can still do gradient-based learning over this data, improving future priors and prompt templates.

### 7. Failure Modes to Watch For

There are several characteristic ways a large language model can perform poorly in ARC-3 environments:

- **Narrative drift:**
  - The model generates long, story-like reasoning that does not track precise state changes.
  - Fix: Force structured logging of state vectors and rule tables.

- **Overfitting to the first few observations:**
  - The model jumps to a convenient explanation and never tests alternatives.
  - Fix: Maintain explicit OPEN_QUESTION items and require affirmative experiments before finalizing.

- **Local myopia:**
  - The model greedily maximizes short-term reward (e.g., picking up a visible reward) while making long-term success impossible.
  - Fix: Encourage planning in terms of sequences and terminal outcomes (door opens, pattern complete), not per-step scores.

- **Exploration paralysis:**
  - The model is so afraid of losing health or steps that it never runs experiments and remains ignorant.
  - Fix: Bake into the instructions that early exploration is *good investment* when budgets allow, and that it should be cheap and targeted.

- **Tool misuse:**
  - The model ignores available tools (state diff, schema store, experiment helpers) and tries to reason purely in text.
  - Fix: Make tool use part of the explicit step-by-step instructions and examples.

### 8. Harness Implementation Checklist (For Builders)

For the people building the ARC-3 harness around the agent, the following checklist is practical:

- **State Access:**
  - Provide a structured grid representation with stable IDs for tile types.
  - Expose UI variables (health, score, timers, inventory) as numbers.

- **State Diff & Features:**
  - Implement a `diff_state(a, b)` tool returning exact tile changes and variable deltas.
  - Offer basic features such as connected components, shortest paths, and counts.

- **Memory & Schemas:**
  - Provide a per-game notebook for rules and experiments.
  - Provide a cross-game schema library with similarity-based retrieval.

- **Planning & Macros:**
  - Expose a simple search tool that can simulate sequences under a described transition model.
  - Allow the agent to define and invoke macro-actions that expand to primitive actions.

- **Experiment Support:**
  - Allow the agent to request micro-experiments when the environment and competition rules permit.
  - Return aligned, tabular summaries of experiment outcomes.

- **Self-Critique:**
  - After each level, summarize trajectory and outcomes and prompt the agent to state explicit lessons for that game and for general schemas.

### 9. Why This Matters for Competition Performance

ARC-3 is intentionally designed to expose weaknesses in agents that:

- Rely purely on static pattern matching.
- Fail to perform structured exploration.
- Do not form explicit world models.

By following this playbook and using the right tools, a future agent can:

- Make much better use of its limited interaction budget.
- Close a meaningful portion of the human–model gap on novel, small environments.
- Turn each game into an opportunity to refine general schemas that transfer to future unseen games.
