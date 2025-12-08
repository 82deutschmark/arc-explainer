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
ARC-AGI-3 Preview: 30-day learnings
Highlighting the gap between humans and AI with Interactive Benchmarks
Arcade graphic for ARC-AGI-3
ARC-AGI-3, the first Interactive Reasoning Benchmark by ARC Prize Foundation
On July 17, we released a sneak peek of ARC-AGI-3, our first Interactive Reasoning Benchmark. These three preview games were our first contact with reality using a new format: video-game-like environments where agents and humans must perceive, plan, and act across multiple steps to achieve long-horizon goals.

Our goal was to gather data about human performance, learn how well AI systems perform on interactive tasks, and see how the community would engage with this new style of evaluation. To encourage further development, we hosted an ARC-AGI-3 Preview Agent competition.

30-Day takeaways:

Interactive benchmarks are easy (even fun) for humans, but hard for AI
Most humans beat the games, often enjoying them. Persistent test-takers "speed ran" to theoretical minimums. AI agents struggled to efficiently make progress.

Some preview games were too friendly to random search
A few game designs could be brute-forced without reasoning. What we learn will help make future games more resistant to brute force and more reflective of intelligence.

Action efficiency provides a clear intelligence signal
Measuring how efficiently environment information is converted into strategy reveals a clear divide between human-level and AI-level performance.

Why Interactive Reasoning Benchmarks
Traditionally, to measure intelligence, static benchmarks have been the yardstick. However, Interactive Reasoning Benchmarks (IRBs) test for a broader scope of capabilities:

On-the-fly Learning - Like in ARC-AGI-1 & 2, the test-taker cannot simply memorize strategies to succeed at the games, it must recombine what it knows on the fly to make sense of novel situations.
Exploration - Can the test-taker efficiently gather the information it needs from the environment via its own choices?
Memory - Given previous experience, how does a test-taker choose to store that information for future use?
Goal Acquisition - Can a test-taker set its own intermediate goals, even if the ultimate goal is unknown?
We released ARC-AGI-3 Preview to put these core design principles into action.

When compared to static benchmarks, instead of asking, "Can the test-taker recall the right answer?" interactive benchmarks ask, "Can they explore, learn, plan, and adapt when dropped into an entirely new environment?"


Learn more about ARC-AGI-3 from ARC Prize Foundation President Greg Kamradt
Interactive benchmarks also offer something static benchmarks cannot: action efficiency.

Instead of just checking whether a goal is reached, we can measure how many actions it takes to get there. In other words, we're tracking how efficiently a test taker converts information from the environment into a working strategy.

Inspired by Francois Chollet's On the Measure of Intelligence, this gives us a new way to define efficiency, and by extension, intelligence, as the conversion ratio between environment information and agent behavior.

This new metric is not a nice to have, it is foundational to measuring performance of frontier models and intelligence in general. Intelligence is efficiency.

ARC-AGI-3 Preview games
ARC-AGI-3 will be a set of hand-crafted novel, unique environments that are designed to test the skill-acquisition efficiency of artificial systems as compared to humans.

It will rely on previous ARC-AGI pillars (core priors, excluding reliance on language, trivia, or vast training data) to evaluate performance against human baselines.

The first three games released were meant to demonstrate a spectrum of game types. Some are agent based (moving around a single object on screen), while others are orchestration based (viewing and manipulating multiple objects at once).

Preview games released

Game	Type	Description
ls20	Agentic, map based	Navigate a map while bringing a matching symbol to another object. The symbol must go through various transformations in order for it to reach the goal.
ft09	Non-agentic, logic	Match the pattern seen on the screen. Patterns occasionally overlap.
vc33	Orchestration	Alternate volume of objects in order to match levels to pre-specified heights.
Private Game #1	—	To be released
Private Game #2	—	To be released
Private Game #3	—	To be released
The three private games used as a hidden holdout set for the ARC-AGI-3 Preview Agent Competition will be released in the coming weeks.

Human performance insights
Since the Preview launch, over 1,200 people have played more than 3,900 ARC-AGI-3 games.

To measure how efficiently humans play, we've adopted a scoring framework inspired by work from Josh Tenenbaum's lab, Human-Level Reinforcement Learning through Theory-Based Modeling, Exploration, and Planning.

The method is straightforward, track the number of actions taken to complete each level, then plot how that effort accumulates over time. This makes it easy to compare performance, not just between two humans, but more importantly, between humans and AI (more on this later).

We were also inspired by Shortest Path Length algorithms (such as Dijkstra's and A*) which focus on two questions: 1) Did the agent complete its goal? 2) How efficiently did it do it?

When this framework is used on ARC-AGI-3, we get a view of level progression vs action count. It may look like a simple chart, but it reveals a lot! Here's an example of human test data from, vc33, a public preview game.

Action level efficiency broken down for vc33
Action level efficiency for vc33
What we can learn from this chart:

What is the least amount of action needed to complete a game? - After many practice runs, a persistent human is able to find the perfect path through a game per level. This path is the lowest number of actions needed to complete a game (the left-most line on the chart above)
How quick is the average human? - Plotting the average # of actions across all human runs shows you the average number of actions taken per level
The amount of action variance across levels - Different levels require different numbers of actions to be completed.
The amount of action variance across games - Different games require different numbers of actions to be completed
Expanding this view to all 3 public games, we can start to see each game's unique characteristics.

Action level efficiency broken down for vc33
Human data for all three preview games. X-axis is fixed at 600 actions (some humans (and many agents) require more actions). Y-axis reflects the max level of each game.
When measuring human performance, we only count a player's first run on a game to compare with AI's first run to measure learning efficiency, not memorization.

The dataset shown above comes from authenticated users. We can't guarantee that their first game run was truly their first time playing. Some may have played the game anonymously before logging in. So although this data is useful to understand action variability per level & game, it will not be used for standardized scoring.

For the production launch of ARC-AGI-3, we will rely on controlled human study of >200 participants to determine baselines.

Comparing humans to AI
Using this scoring framework, we can directly compare human and AI performance on a per-level basis by using action efficiency.

As a test-taker plays a game, they "spend" action in two ways:

Exploration - Actions spent probing the environment to understand its rules
Execution - Actions spent applying a strategy to reach the goal
Every player, human or AI, must use exploratory actions before executing a strategy. Humans are generally good at this: they explore briefly, then execute successfully. Random brute-force agents, however, may eventually complete a level but require far more actions. They aren't effective at turning information from the environment into a workable strategy.

To understand how well AI is doing relative to humans, we can see how many actions it takes an agent to complete a level as a percent of how many actions it takes a human to do the same.

This sets the stage for our scoring framework:

Score agents by their per-level action efficiency (as compared to humans), normalized per game, across all games.

Broken down:

“Score agents by their per-level action efficiency” - For each level that a test-taker completes, evaluate how many actions it took to complete.
“As compared to human baseline” - For each level that is scored, compare the test-takers score to the human baseline that was observed during human testing.
“Normalized per game” - Each level will be scored in isolation. Each individual game will get a score between 0%-100%. Similar to ARC-AGI 1 & 2 tasks.
“Across all games” - Total score will be the sum of individual game scores divided by the total number of games. Output will be a score between 0%-100%.
Agent Preview competition
Alongside the launch of the first ARC-AGI-3 Preview games, we launched an Agent Preview Competition with the goal of incentivizing the collective intelligence of the community to build. By putting ARC-AGI-3 Preview into the hands of developers, we could test our game and API design early before scaling up development for the full benchmark.

In partnership with Hugging Face, who generously sponsored the competition, we released the first version of our API. Developers could train and test their agents on the public set.

Our aim was to discourage overfitting and reward generalization. The competition would be judged based off the agent's performance on 3 additional private games.

The competition ran for 30 days, open to anyone worldwide. In the end, we received 12 submissions, with 8 tested against the private games. Scores were computed using prelimary results from human testing in the scoring framework above.

Winners of the ARC-AGI-3 Preview Competition
1st Place: StochasticGoose @ Tufa Labs: Score: 12.58%, Levels Completed: 18
Convolutional Neural Network Action-learning agent. It uses a simple reinforcement learning approach to predict which actions will cause frame changes, enabling more efficient exploration than random selection. Lead Developer: Dries Smit, Adviser/Reviewer: Jack Cole. Blog Recap:

StochasticGoose performance on vc33
StochasticGoose performance on vc33.
In the beginning the agent uses nearly 350 moves clicking actions with no result. Then it "learns" what is clickable and starts exploiting the action space.
2nd Place: Blind Squirrel: Score: 6.71%, Levels Completed: 13
Explore-and-learn agent that builds a state graph from frames. It prunes actions that create loops or don't change state. Whenever the score improves, it back-labels that level with distances and retrains a small ResNet18-based value model to rank (state, action) pairs toward the next milestone, then repeats until win or cap. Developer: Will Dick. Blog Recap

Blind Squirrel performance on ft09
Blind Squirrel performance on ft09.
Honorable Mentions

Dhana Abhiraj - Play Zero Agent (Blog Recap)
Evgenii Rudakov - Explore It Till You Solve It (Paper Recap)
Ujjwal Chadha, Maya Nguyen, Shobhit Singhal, Filip Dominas - Fluxonian
Top Submissions

Agent	Team	Type	Score	Games Completed	Levels Completed	Actions	Replays
StochasticGoose	Dries Smit - Lead Developer Jack Cole - Advisor Review	Smart Random (CNN)	12.58%	2	18	255,964	ft09
ls20
vc33
Blind Squirrel	Will Dick	Smart Random (Rules)	6.71%	1	13	109,108	ft09
ls20
vc33
Explore It Till You Solve It	Evgenii Rudakov (Developer)	Smart Random (Frame Graph)	3.64%	0	12	278,158	ft09
ls20
vc33
GuidedRandomAgent	Bob	Smart Random (Rules)	2.24%	1	11	39,881	ft09
ls20
vc33
Fluxonian	Ujjwal Chadha (Engineer) Maya Nguyen (Engineer) Shobhit Singhal (Engineer) Filip Dominas (TPM)	DSL + LLM	8.04%	0	5	11,890	ft09
ls20
vc33
Play Zero Agent	Dhana Abhiraj (Developer)	Random + LLM Video	4.37%	0	5	7,226	ft09
ls20
vc33
Tomas Engine	Cristian Valdivia (Developer) - Blog Post Recap	LLM - Limited Results, Crashed Often	3.70%	0	1	79	ft09
ls20
vc33
Notes:

For agents that required large (>10K) actions, the replays files have been truncated for viewing.
View the winners page and archived competition page.
Learnings moving forward
Based on preview feedback, we're shipping several practical improvements today, and more later with the full benchmark release:

Action undo - Players wanted a simple way to step back. We'll add an undo button to both the API and UI. Not all games will support this.
Clearer guidance on which actions are available per game - Too many users were unsure which actions were valid. We'll explicitly show available actions, and specifically call out when grid-clicking is allowed.
Clear docs reduce friction - Switching to Mintlify docs mid-competition worked well. Most users signed up, ran the sample random agent immediately, and got started quickly.
Local execution preferred - While the hosted API made onboarding easy, many requested local/offline execution for training at scale. We're exploring an offline engine to support this.
Early exit mechanism - Some replays ballooned to tens of gigabytes due to brute-force action loops. We'll add caps and early exits to keep files manageable.
More precise scoring vocabulary - We'll distinguish between games completed, levels completed, and score. "Score" will be reserved for normalized performance against human baselines.
Time to build
The ARC-AGI-3 competition is wrapped but the preview is still live!

SIX games are now available on three.arcprize.org, and we encourage you to keep building.


