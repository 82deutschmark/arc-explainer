SOURCE OF TRUTH AS OF DECEMBER 7, 2025
1) Summarize ARC-AGI-3’s purpose, scope, and timeline.
2) Specify the environment, games, actions, API, scorecards, and rate limits.
3) Summarize preview games, human results, AI results, and leading agent designs.
4) Summarize relationships to ARC-AGI-1/2 and practical design constraints.

====================================================
ARC-AGI-3 COMPREHENSIVE SPEC (STATE OF KNOWLEDGE, DEC 2025)
====================================================

0. HIGH-LEVEL PURPOSE, SCOPE, AND TIMELINE
-----------------------------------------

0.1 Benchmark goal
- ARC-AGI-3 is the third major ARC benchmark and the first **Interactive Reasoning Benchmark (IRB)**: it evaluates an AI agent’s ability to acquire skills in unseen environments via interaction, not static I/O mapping. 
- It is designed to be “easy for humans, hard for AI,” like previous ARC versions, but in **multi-step, turn-based games** rather than single-shot grid transforms.

0.2 Dataset size and composition
- Planned benchmark: **~100 unique hand-crafted environments (“games”)**, split into public and private evaluation sets.
- Each game consists of multiple **levels** with increasing difficulty.
- The benchmark will be used to compare **human vs AI skill-acquisition efficiency** across these environments.

0.3 ARC-AGI-3 as an Interactive Reasoning Benchmark (IRB)
ARC-AGI-3 is intended to test the following capabilities:
- Exploration
- Percept → Plan → Action (closed perception-planning-control loop)
- Memory
- Goal Acquisition (discover goals, not just follow given instructions)
- Alignment (pursue intended goals, avoid degenerate strategies)

0.4 Timeline
- Development began in early 2025; early preview limited to 6 games (3 public, 3 private).
- ARC-AGI-3 is planned to launch as a full benchmark in **2026**.
- ARC Prize 2025 results blog explicitly states: *ARC-AGI-3 planned for early 2026 alongside ARC Prize 2026.*

-----------------------------------------
1. ENVIRONMENTS, GAMES, AND GRID WORLD
-----------------------------------------

1.1 Turn-based game model
- Each ARC-AGI-3 **game** is a turn-based environment.
- Agent interacts via discrete actions; environment responds with **1–N “frames”** (observations) plus metadata after each action.
- Games are **2D grid environments** with standardized structure, but semantics differ per game.

1.2 Grid specification
- **Dimensions:** up to 64×64 cells.
- **Cell values:** integers in **[0, 15]**, representing “colors” or object/state IDs (no explicit semantics).
- **Coordinates:** `(x, y)` with origin at top-left; indices from 0 to width−1 (x) and 0 to height−1 (y).

1.3 Game IDs and versions
- Game IDs follow the format: `<game_name>-<version>`.  
  - Example: `ls20-1`, `ft09-1`, `vc33-1` (names stable, version may change as games update).

1.4 Available public preview games
From docs and blog:
- `ls20` – Agent reasoning (agentic, map-based).
  - Player moves a “key” through a grid to match a door.
  - Moving across “rotators” changes the key’s shape.
  - Every move reduces health; must reach door with matching shape before health runs out.
- `ft09` – Elementary Logic (non-agentic, pattern logic).
  - Match the pattern shown; patterns may overlap.
- `vc33` – Orchestration.
  - Adjust volumes/levels of multiple objects to match target heights.

Additional private preview games:
- 3 private games were used as a **hidden holdout** set in the Preview Agent Competition and will be released later.

1.5 Human gameplay UX
- Human instructions are intentionally minimal. Example for `ls20`: “There are no instructions, intentionally. Play the game to discover controls, rules, and goal.”
- Humans see the same grid, action buttons, and status bar (health, level, etc.) that agents see via frames and metadata (modulo human UI chrome).

-----------------------------------------
2. ACTIONS AND INTERACTION INTERFACE
-----------------------------------------

2.1 Standardized 7-action interface
All games implement the same **7 core actions**.

- `RESET`  
  - Initialize or restart the game/level state (also used to start a level).

- `ACTION1` – Simple action  
  - Semantically mapped to “Up”-like behavior in many games (exact semantics vary per game).

- `ACTION2` – Simple action  
  - Semantically mapped to “Down”-like behavior.

- `ACTION3` – Simple action  
  - Semantically mapped to “Left”-like behavior.

- `ACTION4` – Simple action  
  - Semantically mapped to “Right”-like behavior.

- `ACTION5` – Simple action  
  - Game-specific, often “Interact/Select/Execute/Rotate/Attach/Detach/etc.”

- `ACTION6` – Complex action with coordinates  
  - Requires `x, y` integers in the range **0–63** each.
  - Semantics vary by game (clicking/tapping a tile, selecting an object, etc.).

- `ACTION7` – Simple action (Undo)  
  - Undo / inverse of previous operation where applicable (interact/select/undo).  

2.2 Available actions per game / step
- Each game **specifies which actions are available**; unavailable actions are disabled in human UI and marked in frame metadata for agents.
- **Action 6 availability** is binary: the environment exposes “ACTION6 is allowed” but **does not tell which coordinates will have an effect**; the agent must explore.

2.3 Game state enumeration
Frame metadata includes a **state** field:
- `NOT_FINISHED` – Game/level active, awaiting next action.
- `WIN` – Objective completed successfully.
- `GAME_OVER` – Game terminated (max actions reached, death, or other failure condition).

2.4 Human control schemes (for reference)
- WASD + Space, or Arrow Keys + F plus mouse for ACTION6, CTRL/CMD+Z for undo; these are mapped 1:1 to ACTION1–7.

-----------------------------------------
3. API, SCORECARDS, REPLAYS, AND RATE LIMITS
-----------------------------------------

3.1 ARC-AGI-3 API overview
- Root endpoint: `https://three.arcprize.org/api/...` for:
  - Listing games: `/api/games`.
  - Opening scorecards: `/api/scorecard/open`.
  - Sending actions: `/api/cmd/<ACTION_NAME>`, with JSON body (game_id, card_id, and for ACTION6 also x,y).
- Each action returns:
  - One or more **frames** (grid + metadata),
  - Updated `state`,
  - Optional `score`,
  - Game-unique `guid` for the current run.

3.2 Listing available games
- `GET /api/games` returns metadata for all games, including `game_id`, title, tags, and version.

3.3 Scorecards
Scorecards are the core tracking unit for evaluation:
- Before playing a game, an agent (or swarm) must **open a scorecard** via `/api/scorecard/open`.
- Every action call must include the `card_id`.
- Scorecards store:
  - Tags (e.g., experiment ID, agent version),
  - Optional `source_url` and `opaque` metadata,
  - Per-game action counts, states, and level progress.
- Properties:
  - Scorecards **auto-close after ~15 minutes**.
  - Agent scorecards are batched into the leaderboard roughly every 15 minutes.
  - If you kill the program mid-run (e.g., Ctrl-C), scorecard results may be incomplete or not visible.

3.4 Recordings and replays
- Each scorecard can generate **replays** (video-like or frame-by-frame visualizations) accessible on `three.arcprize.org`.
- Replays are the main tool for analyzing agent behavior at a fine-grained level.

3.5 Swarms and reference agent runner
- ARC provides an **ARC-AGI-3-Agents** repo and “Swarms” runner:
  - Swarms orchestrate **multiple agents across multiple games**, automate scorecard opening/closing, and manage logs.
  - `main.py` in that repo runs a named agent on one or all games, using the ARC API under the hood.

3.6 Rate limits and access model
- ARC-AGI API is free during research preview but enforced via **rate limits**:
  - Current documented limit: **600 requests per minute**, with exponential backoff on violation.
- This indirectly constrains:
  - Online RL training speed,
  - Data collection,
  - Large-scale brute-force exploration.

-----------------------------------------
4. SCORING, METRICS, AND HUMAN BASELINES
-----------------------------------------

4.1 Primary evaluation metric: human-normalized action efficiency
From ARC blog and docs:
- ARC-AGI-3’s scoring framework is explicitly about **action efficiency relative to humans**:
  - For each level and game, human performance is measured (average actions to win, success/failure).
  - Agents are scored based on **how many actions they use vs that human baseline**.
- ARC takes inspiration from cognitive-science benchmarks (e.g., Tenenbaum-lab work on human-level RL).

4.2 Per-level, per-game scoring
- Scores are computed:
  - Per **level** (action efficiency vs human baseline),
  - Normalized per **game**,
  - Aggregated across **all games** to yield an overall benchmark score.
- This means:
  - Agents are rewarded for **winning levels in fewer actions**,
  - Excess exploration (extra actions) directly reduces score.

4.3 Human performance
From the 30-day learnings blog:
- Over 1,200 humans played >3,900 games in the preview.
- Humans generally:
  - Discover controls and goals within a few minutes,
  - Reach near-minimal action counts on many levels,
  - Show robust generalization across levels within the same game.
- Preview commentary and social posts emphasize that humans often solve new games in **<5 minutes**, while current AIs still struggle.

4.4 AI performance to date (Preview Agent Competition)
From the official preview competition recap and leaderboard:
- ARC-AGI-3 Preview Agent Competition:
  - Ran July 18 – Aug 19, 2025, in partnership with Hugging Face.
  - Agents played 3 private games (plus the known public ones).
  - Goal: complete as many levels as possible, as efficiently as possible.
- Verified leaderboard on private set (sample numbers, not full spec):
  - 1st place: **StochasticGoose** – ~12.58% score, 2 games completed, 18 levels overall.
  - 2nd place: **Blind Squirrel** – ~6.71%, 1 game completed.
  - 3rd place: **Explore It Till You Solve It** – ~3.64%.

Takeaway: even top agents are **far below human-level action efficiency** on the interactive benchmark.

-----------------------------------------
5. OFFICIAL PREVIEW GAMES AND GAME TYPES
-----------------------------------------

5.1 Purpose of preview games
The preview is designed to showcase a spectrum of **game archetypes**:
- Agentic navigation (`ls20`),
- Non-agentic logic (`ft09`),
- Orchestration of multiple objects (`vc33`),
- Plus 3 private games with additional structure.

5.2 Game archetypes
From the 30-day blog:
- `ls20` – Agentic, map-based:
  - Navigate a map, carry a symbol/key to a target.
  - Symbol must undergo transformations (e.g., via rotators) before reaching the goal.
- `ft09` – Non-agentic, logic:
  - Match a target pattern on screen (patterns can overlap/add complexity).
- `vc33` – Orchestration:
  - Adjust “volume” (height/level) of multiple objects to match target states.

5.3 LS20 concrete rules (from external templates)
From LangGraph/Plank article:
- Door opens only if the “key” shape matches door shape.
- Moving across a rotator cycles the key through different shapes.
- Each movement costs health; running out of health ends the level.
- Implicit objective: find a route and transformation sequence that:
  - Guarantees right key shape at door,
  - Minimizes steps (maximize remaining health).

-----------------------------------------
6. AGENT DESIGN SPACE (WHAT CURRENT LEADING AGENTS DO)
-----------------------------------------

6.1 StochasticGoose (1st place) – RL + CNN action learner
From Dries Smit’s write-up and repo:
- Core idea:
  - Use a simple RL agent that predicts **which actions will change the frame**.
  - Aim: avoid wasting actions on no-ops; focus on actions that lead to state changes.
- Architecture:
  - CNN backbone over the grid to extract features.
  - Heads for:
    - Simple actions (ACTION1–5,7),
    - Spatial “heatmap” / distribution for ACTION6 (coordinate actions).
- Training:
  - Use game transitions (frame, action, next frame) to label actions as “changed state vs not”.
  - RL objective biases toward actions with higher probability of meaningful state change.
- Operational constraints:
  - Limited number of API calls per day/hour (rate limits).
  - Must be sample-efficient in terms of total steps per game.

6.2 Blind Squirrel (2nd place) – State graphs + small ResNet
From 30-day blog:
- Builds a graph over **observed states** (frames) and transitions.
- Uses a small **ResNet-18** to score or value (state, action) pairs.
- Explores via this learned value function plus graph search.

6.3 Explore It Till You Solve It (3rd-ish rank) – Graph-based exploration
From its open repo:
- Maintains a graph where nodes are frames and edges are actions.
- Prioritizes untested actions on new states to drive exploration.
- Approaches the edge of brute force while trying to be more intelligent than random.

6.4 LLM-centric agents (Fluxonian, PlayZero, etc.)
From Preview blog and public repos:
- **Fluxonian:**
  - Uses a Domain-Specific Language (DSL) + LLM to describe and manipulate the grid.
  - LLM plans at a higher abstraction; a lower-level executor interacts with the ARC API.
- **PlayZero/others:**
  - Use LLMs (text, vision, sometimes video) to interpret frames,
  - Build language-level descriptions of rules and goals,
  - Then call tools to issue actions.

6.5 LangGraph templates (Plank)
From Plank’s article:
- Provides a **multi-agent graph** architecture for LS20:
  - A “Vision” agent (frame interpreter),
  - A “Planner” agent (decides next high-level move),
  - A “Navigator” / “Actuator” agent (maps plan to ACTION1–7),
  - Shared memory where beliefs about world rules are stored.
- Intended as a general template that can be extended across other ARC-AGI-3 games.

-----------------------------------------
7. RELATIONSHIP TO ARC-AGI-1 / ARC-AGI-2
-----------------------------------------

7.1 Continuity with earlier ARC pillars
From ARC-AGI-3 overview and 30-day blog:
- ARC-AGI-3 **inherits** the core design principles from ARC-AGI-1/2:
  - Core knowledge priors and intuitive physics,
  - Avoid reliance on language, trivia, and massive training data,
  - Tasks are solvable by typical humans (crowd workers) without expert training.
- New aspect: **interactivity and multi-step skill acquisition** instead of static mapping.

7.2 Difference in evaluation mode
- ARC-AGI-1/2:
  - Static I/O mapping: given input grids + demos, produce output grid.
  - Score = accuracy across tasks.
- ARC-AGI-3:
  - Interactive game: no explicit instructions; must determine controls, rules, goals.
  - Score = **action efficiency vs human baseline** across games.

7.3 Integration with broader ARC ecosystem (2025)
From ARC Prize 2025 results & other blogs:
- ARC-AGI-1 continues as:
  - ARC-AGI-2 competition benchmark with strict compute constraints.
  - ARC-AGI-Pub (public leaderboard with relaxed constraints).
- ARC-AGI-3 will be the new **interactive counterpart**, focusing specifically on agents and on-the-fly learning.

-----------------------------------------
8. PRACTICAL DESIGN CONSTRAINTS AND EMERGENT PROPERTIES
-----------------------------------------

8.1 Constraints that matter for agent design
- **API rate limits**: 600 requests/minute; effectively caps training and exploration speed.
- **Scorecards auto-closing** in ~15 minutes: encourages compact runs and stable control loops.
- **Action efficiency** scoring:
  - Every wasted action reduces final score; resets and no-ops are not free.
- **No offline simulator** (for now):
  - You can’t download environment dynamics; must train and test via the remote API. (A local engine is being discussed/iterated in docs/blogs but not yet public as a full offline simulator.)

8.2 Emergent capabilities incentivized
From the IRB framing and 30-day blog:
- Fast hypothesis-driven exploration (active exploration, not random wandering).
- Compact, reusable internal world models for:
  - Predicting action consequences,
  - Planning sequences toward inferred goals.
- Persistent memory across steps and levels within a game (and potentially across games).
- Robust goal inference: deduce win conditions from raw experience and UI cues.

8.3 Current performance gap (humans vs AI)
- Humans:
  - Quickly infer controls and goals,
  - Achieve near-minimal action counts on many levels.
- AI agents (as of Preview competition):
  - Best agent ≈12.6% on private games vs human baseline, far from human-level.
  - Many sophisticated RL + LLM systems still struggle even to **finish** later levels reliably.

8.4 Community observations
- Early external reviews (e.g., Singularity and AGI subreddit posts) highlight that:
  - Games feel like classic no-instruction puzzle games (CoolMathGames vibe).
  - Humans can solve many puzzles but often need several attempts.
  - LLM-only agents without structured action planning essentially fail.

-----------------------------------------
9. CHECKLIST-STYLE SUMMARY FOR AN AGENT DESIGN
-----------------------------------------

If you are building an ARC-AGI-3 agent, the environment spec you must satisfy is:

- Environment:
  - Turn-based 2D grid up to 64×64; cell values 0–15.
  - No natural-language goal; rules and objectives must be discovered.
- Observations:
  - 1–N frames per step; each frame includes:
    - Grid tensor (H×W, values 0–15),
    - Metadata with:
      - Available actions,
      - Game state (`NOT_FINISHED`, `WIN`, `GAME_OVER`),
      - Optional `score` and UI/status variables.
- Actions (exactly 7):
  - Per-game subset is available at each step.
- Control plane:
  - Must open a **scorecard** and pass `card_id` with every action.
  - Must obey **rate limits** (600 RPM, exponential backoff on violation).
- Evaluation:
  - Score = human-normalized action efficiency, aggregated over levels and games.
  - Every action counts; resets and no-ops are penalized via increased action count.

====================================================
END OF ARC-AGI-3 KNOWLEDGE COMPENDIUM (DEC 2025)
====================================================
