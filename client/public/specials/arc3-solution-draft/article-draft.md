# Stuffing the Turducken

An ARC-AGI-3 agent has to learn what a game is asking while it plays. Every frame is evidence; every action spends time testing a hypothesis. A useful solver therefore needs more than a model that can reason about pictures. It needs a harness that turns reasoning into experiments, an inference stack that leaves time to run them, and a way to carry discoveries forward when the conversation fills up.

That is our turducken: the playing policy sits inside a tool-using harness, which runs inside a carefully fitted serving system. We worked on all three layers, then explored reinforcement learning to improve the policy itself. The connections mattered as much as the individual pieces. A faster model can try more ideas, but repeatedly rereading a rewritten conversation wastes that advantage. Training can improve a policy, but only if the model being trained behaves like the one being served.

Here we describe the October 18 submission harness and inference configuration, followed by the reinforcement-learning experiments that developed alongside and after it.

## Turning observations into experiments

![The game-playing harness](corners-only/01-harness-garage-v2-corners-only.png)

We built on Daniel Franzen's notebook and agent framework. The model receives a game frame and writes Python in a sandbox to inspect the frame and take actions. This lets it organize a sequence of moves as a small experiment: identify an uncertainty, choose an action that distinguishes possible explanations, and use the resulting frame to update its model of the game.

The harness had to address two familiar failures. Sometimes the agent analyzed the board at length without moving. Sometimes it moved confidently while pursuing the wrong goal. We emphasized identifying the objective, probing unfamiliar mechanics with small tests, and batching actions once their effects were understood. A level transition called for the same discipline: carry forward the game's rules, but reconsider the plan for the new board.

That loop produces a growing record of frames, code, observations and reasoning. Keeping it useful became both a memory problem and a serving problem.

### Make room without rebuilding the conversation every turn

The temperature-0.5 configuration used a **143,360-token context window** and allowed up to **12,288 output tokens per ordinary model request**. The harness reserved that output allowance plus **512 tokens** of margin, leaving a nominal **130,560-token input budget**. It estimated the rendered request length, so the effective boundary depended on the request rather than token arithmetic alone.

Once the history exceeded the budget, we cut it substantially, targeting approximately **58,000 retained tokens**. Whole message blocks and the latest interaction determined the exact retained length. The large gap between the input budget and the retention target was deliberate: it left room for several turns of growth before the next cut.

This mattered because the server could reuse computation for an unchanged conversation prefix. Its key-value cache holds attention state from tokens already processed; the model also has recurrent state that must be preserved to resume a cached path. Rewriting old messages, even with equivalent reasoning or tidier formatting, can change the rendered token sequence and break that reuse. We therefore preserved generated history as faithfully as possible.

Trimming just enough to squeeze in the next request would keep changing the prefix. A larger, less frequent cut let subsequent requests append to stable history. Each cut still caused recomputation of the affected prefix, and contention or eviction could remove cached state between requests. The aim was to reduce avoidable cache churn, not to depend on permanent residency.

Serving was sized for that workload: **32 concurrent request lanes**, **180 Mamba state slots**, and a **24 GB host-memory cache tier**. Attention state, recurrent state and conversation management had to work together; retaining one while repeatedly discarding another would leave part of the benefit unrealized.

### Keep discoveries somewhere a context cut cannot erase

Conversation history records how the agent reached an idea. Explicit notes record what it needs next. We gave those two jobs separate homes.

The harness maintained a persistent Markdown-style notes object outside the temporary Python sandbox. Notes writes streamed back to the harness, allowing already-recorded discoveries to survive a tool timeout. Retained helper functions also spared the agent from rebuilding useful code on every call.

The notes store was capped at **40,000 characters**. When its displayed form needed shortening, the selected head-and-tail mode kept both the beginning and the end: early rules and recent findings could remain visible together. The harness could present the notes again after a context cut or level transition, restoring discovered mechanics, failed approaches and the current plan without restoring the whole conversation.

We also made room for abandoning a bad line of thought. After a prolonged stall, a “fresh eyes” mechanism asked the agent to write a handover note, cleared the conversation, and prompted a fresh look at competing explanations. This deliberately traded cache reuse for a chance to escape an unproductive trajectory. Preserving state is useful only while that state is helping.

## Fitting more play into the time budget

![The inference stack](corners-only/02-inference-v1-corners-only.png)

The next layer was inference. The serving stack ran a quantized Flash-Next model on a single **96 GB RTX PRO 6000**, using Daniel's SGLang fork and additional serving patches. The question was how to fit the model, reusable state and concurrent work into the available memory while leaving enough throughput for the agent to explore.

The routed experts used four-bit weights, and routing was restricted to **341 of the original 512 experts per layer**. Reducing the active expert pool freed memory for the rest of the workload at the cost of model capacity. Memory layout, fused operations and kernel tiling were further parts of the same fit. The selected build also used a four-bit attention-cache configuration, with other precision choices elsewhere in the model.

Speculative decoding addressed generation speed. A separately trained multi-token-prediction drafter proposed tokens for the target model to verify. What mattered was how much progress the target accepted per verification step. The drafter and target were therefore a pair: changing the target weights could change acceptance and erase a speed advantage measured against the previous model.

Together, faster generation and less repeated prefill left more wall-clock time for game experiments. That made serving efficiency valuable to the playing agent, while keeping the evaluation questions distinct. Throughput measures how quickly it can try; game evaluations measure whether the attempts work. An internal game score and a Kaggle leaderboard score answer different questions again.

## Training the policy that actually plays

![The reinforcement-learning pipeline](corners-only/03-rl-v1-corners-only.png)

Once the harness could collect useful play, saved game states and trajectories gave us a starting point for training. A saved moment let us branch into several continuations from the same situation and compare their outcomes, without replaying everything that led there.

Earlier experiments included supervised learning on efficient wins, expert iteration over alternative continuations, and a lightweight per-turn coach. Later work moved toward on-policy ReST-GRPO-style training: collect attempts from the current model, score them, update the model, and collect again. The loop connected the training examples to the policy currently making the decisions.

Procedural level generation supplied additional situations. A generator preserved a game's mechanics while changing the instance, and provided a solution that could be replayed through the actual engine. That gave us fresh boards and action baselines instead of relying entirely on a fixed set of hand-authored levels.

The serving decisions followed us into the trainer. It needed the same expert-routing masks as the deployed model; long trajectories required memory-efficient attention and packed expert weights. We also had to keep two training targets straight. Improving the playing policy changes decisions. Improving the speculative drafter can make those decisions arrive faster. Either could help the overall system, but they required different measurements.

The evidence was mixed. The October 18 review recorded earlier weight-training attempts that tied or lost against the base model; the later RL v4 record reported gains on its internal evaluation suites. Those results came from different experiments and measurement settings, so they do not establish the final Kaggle contribution of reinforcement learning. Harness behavior and serving efficiency were already part of the documented submission stack; reinforcement learning remained an experimental track.

## What held the layers together

The most useful distinction was between **what the agent knows**, **what it is currently doing**, and **what the server has cached**. Notes preserve selected knowledge. Recent history preserves the trajectory. Cached state saves computation for an exact rendered prefix. Calling all three “memory” makes it easy to fix the wrong problem.

Our design followed that distinction: preserve history while it is productive, cut it deliberately when it fills up, restore important discoveries from notes, and restart the reasoning when it stalls. Fit the serving stack around that behavior, then evaluate training in the same environment. Stuffing the pieces together was not enough; they had to leave room for one another to work.

## References

- [Daniel Franzen's ARC-AGI-3 milestone notebook](https://www.kaggle.com/code/dfranzen/arc-agi-3-milestone-2-solution)
- [Game catalog and project viewer](https://arc3.sonpham.net/)
