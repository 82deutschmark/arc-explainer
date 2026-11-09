# Check, Don't Predict: Cheap Falsification Tools for an ARC-AGI-3 Agent

*Team Turducken. Small checking tools that let an agent kill its own wrong beliefs before they cost lives, and why making it predict every move lost.*

## 1. Submission

Our scored entry to ARC-AGI-3 is submission 57721173, public score 53.70, kernel sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g, script version 363005415 [S§0, S§4; confirmed by Son]. The same script version scored differently on other runs, so a few points between runs is noise, not signal [S§0].

The agent plays each game by writing Python against a small game interface: an action call, frame objects with a text grid, a list of recorded transitions, and helper functions it can keep between calls. That interface is Daniel Franzen's harness, built on Tufa Labs' work; it is not ours and we do not claim it [S§3]. This paper is about three things we added on top: checked play, rule replay against history, and notes that survive history trims. The first write-up covers serving, model and inference details; this one covers why the checking tools work.

## 2. The failure we were fighting

Before building anything, we read 875 game traces from 35 runs to find out why games are won and lost [arc-3: docs/trace-findings/2026-10-10-trace-review.md]. Wins look the same everywhere: the rule is found early with one or two cheap probes, the board is written down as a few numbers and checked against the frame, and the solution is played as one checked batch on the first life. 83% of clears happen on the first life; after two game overs on a level only 61% ever clear, and after four only 35% [same source].

The dominant failure is not a lack of reasoning. It is a wrong belief that hardens. A control that works only in one situation is tried in the wrong one and written off: "nothing happened here" becomes "this does nothing". This one pattern explains 4 of the 8 hard-game walls in the review [same source]. Then memory freezes it. Handover notes file the stall's cause under CONFIRMED; rolling summaries carry the misreading forward as "established"; the agent is told to doubt its plans but never its confirmed mechanics, so they are never retested [same source].

The separating signal was reading the frame. Frame-diff code appears in 17 to 20% of requests on cleared levels against 8 to 9% on stuck ones [same source]. This is observational, not causal: winning levels may simply be easier to read.

## 3. The tools

We turned what winners did by hand into three functions the agent may call from its own code [arc-3: harnesses/daniel-main-1017/variants/exec/block_exec.py].

**Checked play.** The agent passes a list of moves, each with an expectation: either a few cells and the colours they must show, or a function of the new and previous frame. The tool plays one move at a time and stops at the first failed expectation, returning which step failed and a compact diff of what actually changed. A plan with no expectations at all is refused as a blind batch [same source].

**Rule replay.** The agent writes a rule as a function of before-frame, action and after-frame that returns true, false or "does not apply". The tool replays it against every recorded move of the level, skipping resets, level changes and game overs, and reports how often it held, how often it broke and the first broken examples. A rule that never applied is reported as "no evidence", never as a pass [same source].

**Cell readers** return the colour at a position, so expectations stay short [same source].

About a hundred words of system prompt offer the tools, including one line aimed squarely at the dominant failure: "nothing happened" is a result to record with where you tried it, not proof the control does nothing [same source]. Expectations and rules cannot move the game; the tool blocks the action call while they run [same source]. A notes memory that survives history trims, shown as head and tail past a size cap, keeps findings alive across long games [S§3].

The tools are on in the scored line: the switch is set in the 48.92 and 52.82 notebooks [S§3], and in the cleaned copy of the 53.70 package, which its own equivalence check shows sends the model byte-identical requests [arc-3: harnesses/daniel-main-1030-rulesonce]. The submitted kernel itself was not reopened.

## 4. Why it works

A belief in an interactive game is only dangerous when it is acted on. The agent has two cheap sources of truth that cost no lives: the frame in front of it, and the record of what already happened. Checked play turns every planned move into a test against the frame, so a wrong rule fails on the first move that contradicts it, not after a life is spent. Rule replay turns the whole level history into a test set, so a rule that the agent's memory calls confirmed can be contradicted by moves it already made, at zero cost in moves. These are the only mechanisms in the harness that can falsify a belief before it costs lives; notes and summaries can only repeat beliefs.

Both tools are offered, not mandated. The agent pays for a check only when it is unsure. That matters because the clock is shared: about nine hours across all games [S§6], so every token spent on a move the agent already understands is taken from a game it has not solved.

## 5. What lost, and why

**Mandated prediction.** A strict predict-before-acting variant, built on the 52.82 line, scored 41.37 (submission 57399562) [S§3, S§4]. It forced the expensive step on every move, including moves the agent already understood, and spent the shared clock doing it.

**Rolling summaries.** They hurt when an early misreading was written down as established, and cost time at every window: 18 to 26% fewer moves [arc-3: trace review]. A summary amplifies beliefs; it does not check them.

**Heavier reasoning scaffolds.** On the hardest seven games, symbolic, solver, execution and self-check arms were each run twice; none beat the plain control [arc-3: HARNESS-NOTES.md, intensive-harness ladder, 27-Sep]. The sample is thin.

**A full executable world model.** We reproduced the core of an OPINE-style agent, which writes a simulator of the game and verifies it by exact replay, on one game, but it never reached a scored run [S§2; arc-3: harnesses/world-model/MANIFEST.md]. An outside controlled ablation, as recorded in our notes, ranked verification first and the executable world model weakest [arc-3: HARNESS-NOTES.md; outside study not re-read, unverified].

**A rich perception language.** A fourteen-method vision toolkit was never measured in play [S§3].

## 6. Novelty

Program-search languages and executable world models such as OPINE are the public prior work. Our claim is the lighter, cheaper version. Instead of asking a model to write a whole simulator, ask it for a few expected cells per move and a rule it can test against history. A model under a shared clock can actually use that, and the heavy versions lost or never shipped.

## 7. Universality

The tools read only frames and recorded transitions; nothing is game-specific, so they apply to any interactive grid environment with an observable state and a move log. We test on copycat games (one rule-alike copy per public game) and on public synthetic games that run on the real engine; the synthetic-games repository is public for others to use [S§3]. The cleaned 53.70 package scored about the same on copycats as on official games in two runs of our own replay setup [arc-3: harnesses/daniel-main-1030-rulesonce/README.md].

## 8. What others can take

Offer verify-before-commit tools; do not mandate them. Make "nothing happened" a recorded observation with its situation, never a conclusion. Never let notes promote a belief to confirmed without a check against history. Make tool crashes harmless: a timed-out tool call wiping every saved helper showed up in 111 game-runs in our review [arc-3: trace review]. Skip what lost: strict prediction, rolling summaries, heavy scaffolds.

## 9. Limits

We have no clean ablation of the checking tools; they shipped bundled with other changes, so any score credit to them is unverified [S§5]. We have no usage counts from scored runs; the tools log them to a side file we have not yet recovered [S§5]. The trace review predates the tools, so there is no before-and-after on the same signals [S§5]. This is mechanism plus trace evidence, not a measured gain.
