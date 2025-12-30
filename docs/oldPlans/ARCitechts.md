The ARChitects - Technical Report
ARC Prize 2025 Solution Summary
https://lambdalabsml.github.io/ARC2025_Solution_by_the_ARChitects/ 
Daniel Franzen 1*
Jan Disselhoff 1*
David Hartmann 2*

1 JGU Mainz
2 Lambda, Inc.
* “The ARChitects” Kaggle team members

ARC Kaggle Competition 2025
Code (GitHub)
Jump to: TL;DR, Our Initial Strategy: Autoregressive Model Improvements, Our Final Submission: Recursive Masked Diffusion Model, Things That Didn’t Work, Compute Budget, Final Submission Results, Things to Improve, See Y’All Soon!

TL;DR:
This year, we used an exploration-exploitation strategy; improving last year’s solution while simultaneously exploring several new directions.

In the first half of the competition, we improved our ARC 2024 AR-model approach, which relied on depth-first search sampling and a product-of-experts selection mechanism. The most significant changes were a stronger model (trained on more data), single-task test time finetuning and a deeper DFS search, enabled by speedups from speculative decoding and prefix caching.
Our final submission employed a masked diffusion model (LLaDA-8B), where we modified the positional encoding to better suit ARC-like inputs. Additionally, we also developed recursive latent sampling methods that allowed us to iteratively refine and improve upon the model’s guesses.
Due to the exploratory nature of our strategy this year, we tried a lot of things that didn’t work. From hierarchical network architectures, over reasoning tokens to synthetic data - we did test a few things that didn’t get us that far. We want to share our experience below with the community.
Finally, we want to disclose our compute budget that Lambda.ai kindly has sponsored for our journey.
Our Initial Strategy: Autoregressive Model Improvements
In the first half of the competition, we’ve been focusing to max out our last year’s approach:

an autoregressive model (nvidia/Mistral-NeMo-Minitron-8B-Base) with
an incredibly fast Depth-First-Search sampling for generation and
Product-of-Experts selection mechanism to identify the most probable solution.
You can find all the details in our ICML publication, read the shorter summary below, or jump directly down to our most recent addition to the community, a masked diffusion-based ARC solver.

Previously on ARC Prize 2024 …
Our last year’s approach consisted of three key ideas:

Data Augmentations: We applied ARC-specific data augmentations to improve the effectiveness of training (both offline and the test-time training).

Depth-First Search Sampling: By caching results during generation, tree traversal of all possible solutions above a certain threshold enables to generate a large number of candidate solutions quickly without any additional memory costs.



Product-of-Expert (PoE) Scoring: The model itself has already a good estimate of the probability that a candidate is correct. By re-applying the augmentations to the candidates and aggregating using the product of neg-loglikelihoods, we get stable selection mechanism to decide which candidate is most probable, considering all “views” at the same time.



Meanwhile, Back at ARC Prize 2025 …
So what has changed since our 2024 solution in terms of the AR approach? Three things helped us to squeeze out as much performance as possible to reach the top of the leaderboard, on July 21st - well, at least for a brief period of time.

First, we had a better model from the start. Since we didn’t publish our best model last year (we had a late submission that didn’t count at ARC Prize 2024 with a score of 56.5%), we had a kickstart for this year’s competition.

The improvement of this model came from using more data (including the ARC-Heavy dataset which was released in the last days of last year’s competition) and longer training.

We changed the test-time training workflow to run separately for each task, instead of fine-tuning the model on multiple tasks simultaneously as in the 2024 contest.

In addition to that, we were able to improve our sampling method to generate even more candidate solutions. First, we added speculative decoding to our DFS algorithm, using a simple heuristic to guess the next 16 to 32 tokens instead of generating only a single token in each inference step. This sped up the search by a factor of about 4.7x, allowing us to reduce the cutoff threshold probability in the DFS from 17% in our 2024 winning solution down to 7%. With the new threshold, the DFS would naturally generate a lot more solution candidates, so we also had to speed up the scoring process that evaluates each solution candidate to find the most promising guess. Here, we used a simple prefix caching strategy which re-uses the KV cache for the examples and challenge input in each augmentation. By doing so, we could speed up the scoring step by 5.8x, allowing us to efficiently process the increased number of solution candidates and even bump the number of augmentations used for scoring from 8 to 32, resulting in a more stable selection process.

Using this approach, we achieved a score of 16.94% on the public ARC2 leaderboard on August 11th. We realized quickly that this approach was not enough for this years’ ARC competition. So, while maxing out the performance using the autoregressive approach, we started research towards a better model - using masked diffusion language models.

Our Final Submission: Recursive Masked Diffusion Model
When we attended ICML 2025 to present last year’s paper, it became clear to us that our autoregressive approach wouldn’t be strong enough for certain puzzle types. Especially tasks like this one (which we haven’t seen being solved at all, yet) and this one (which our model did solve in the end), where the model must understand and alter the global structure of the solution.

From that point on, we leaned fully into an exploration-exploitation strategy: continuing to push our old model to its limits, while simultaneously working on entirely new techniques.

Two Issues Stood Out Immediately:

The AR model was not trained to re-iterate upon it’s own first guess, and therefore unable to perform the needed puzzle-ling and trying of several solutions. This was only done implicitly using our “Product-of-Expert” selection mechanism.
However, the simple augmentations we used previously, while being a valuable tool to gauge the model’s assessment of it’s own global mistakes, weren’t expressive enough to mitigate the issues of autoregressive models on the new benchmark. In particular we saw a lot of trouble on puzzle and simulation tasks, as well as issues with diagonal line predictions.
Towards Recursive Masked Diffusion Models
The observations above ultimately led us to a masked diffusion approach and, later on, to a recursive and continuous sampling method that allowed the model to improve upon its own guesses.

We used a LLaDA-8B masked diffusion LLM and fine-tuned it to de-mask the solution, assuming the output shape shape is already known.

Technical Overview

In essence, we used:

a masked diffusion LLM, GSAI-ML/LLaDA-8B-Base The model is trained with discrete tokens and tasked with replacing <mask> tokens with a proposed solution. Architecturally, we replaced the original RoPE positional encoding with a 2D variant, hoping that this would help the model to work better on the two-dimensional grid structure of the ARC-AGI tasks
a fine-tunning setup to solve ARC-like problems, using the same data pipeline as our AR model. Compared to the training objectives provided with the original LLaDA model, we used LoRA for more stable convergence and adapted the loss to extract information from the multi-example format more effectively.
recursive latent sampling, our most impactful addition We experimented with several sampling methods to better leverage the masked diffusion model. Similar to our observations with the AR model, we found that one-shot performance was substantially weaker than a more thorough exploration of the solution space. By continuously mixing latent tokens, we were able to apply the model recursively and iteratively refine its own predictions, effectively allowing it to improve on its previous guesses.
data-wise we used the same datasets as before: ReARC, ARC Gen 100k, ARC 1 and ARC 2 training & evaluation sets, ARC-Heavy & Concept ARC.
Model & Training Process
In terms of the model setup, besides hyperparameter tuning, we adapted the positional encoding and the masking method to better suit the ARC setting.

Positional Encoding Modifications
Starting out with the LLaDA-8B-Base model, we modified the original model code to use a 2D positional encoding inspired by the Golden Gate RoPE instead of the standard 1D RoPE that the model was originally trained with. Unlike the classical 2D RoPE approach, which encodes only horizontal and vertical directions, the Golden Gate RoPE incorporates a range of other directions as well. We felt this broader directional coverage would better suit ARC tasks, where the model frequently needs to “look” across the grid from multiple angles - an insight that has significantly boosted performance in the ARC‘24 competition.

Our input format remains largely consistent with the previous version, passing multiple input/output pairs to the model sequentially, but we now expand all input/output grids to a uniform size to align with our modified positional encoding. We do this by first adding a single row of delimiter symbols along the right and bottom edges of each original grid, then adding additional padding tokens to expand the grid to a fixed 32×32 size.

After tokenization, when the position IDs have been assigned, we remove the previously added padding tokens to save computation, while preserving the remaining tokens’ assigned position IDs so the model can still reference each token’s location using the new 2D positional scheme.

Masking Strategy & Loss Calculation
In masked diffusion models, training typically involves masking a subset of tokens and training the model to reconstruct them, encouraging it to learn robust contextual representations.

Building on this idea, we adopt a fully random masking strategy: for each output grid, we first draw a random masking probability, then independently replace output tokens with mask tokens according to that probability. Our training uses a standard cross-entropy loss applied only to positions where a token had been masked, ensuring the model focuses its learning on reconstructing the masked content.

While we initially applied masking to just one of the output grids, to allow the model to rely on the remaining unmasked grids to infer the underlying transformation rules, we later discovered that applying masking to multiple output grids at once could substantially accelerate training without harming performance. In our final setup, we randomized the number of grids to be masked for each task, while ensuring that at least one output grid always remained fully visible.

Model Finetuning Process In our initial finetuning phase, we trained the model using a rank-512 LoRA across a diverse collection of datasets:

the ReARC dataset by Michael Hodel,
the ARC-GEN-100K dataset,
the official ARC1 and ARC2 training and evaluation sets,
the ARC-Heavy dataset, and
the ConceptARC dataset.
This pretraining stage ran for 175,000 training steps with an effective batch size of 8. This took in total 39 hours on an 8×H100 cluster.

For the second, test-time finetuning stage, we made use of Kaggle’s NVIDIA L4 GPUs. For each individual task, we trained a specialized model directly on its provided examples, running for 128 training steps, each with a distinct random augmentation, and using a batch size of 1 and a rank-32 LoRA.

Observations: Token Algebra Enables Recursion
Three observations really helped to boost the performance of the masked diffusion model.

Model Output Looks Like Model Input Already For discrete masked diffusion, the model predicts a distribution over tokens at each position, and that output can be fed right back in as the next input. Typical remasking strategies use the following loop:

guess = model(all_masked)
for i in range(steps):
    guess = mask_strategy(guess)
    guess = sample(guess)
    guess = model(guess)
This gave us an early hint: the model can refine its own guesses. However, this usually only happens after a discretization step, here done in sample. But is this discretization step actually fully necessary?

There Are No Tokens (🥄)

Modern LLMs don’t actually operate on discrete symbols except in the first embedding layer. Inside the model, every token is just a point in continuous embedding space. And in that space we can create linear combinations of input tokens!

(Other people are using similar techniques, for example in T2I diffusion models, see here.)

Input (what we pretend the model sees)

<token_what>, <token_is>, <token_2>, <token_plus>, <token_2>, <token_question>

Actual internal representation

<token_is> → [0.756, 0.452, 0.112, 0.980, 0.221, ...]

Token Algebra

Because tokens are just vectors, we can blend them:

<token_is> → 0.5 * <token_is> + 0.5 * <token_equals>

This simple idea (that tokens can be mixed) turns out to unlock recursion for diffusion models.

Key Observation: Soft-Masking

We discovered especially interesting behaviour when we added the <mask> embedding to every input position: <color_ANY> * 1.0 + <mask> * 1.0

It seems that during training the model has learned that <mask> means “this position needs improvement”. So when we soft-mask all positions, we are essentially instructing the model to refine the direction of the guess. In other words, adding <mask> everywhere implicitly turns the diffusion model into a continuous iterative solver that improves upon its own output each step. This creates a natural form of recursive self-improvement, where each iteration becomes: guess → soft-mask → refine → repeat

This alone isn’t very stable without further tricks, though. Probably, because the model has never seen it’s own outputs as input during training. For this reason (and because we found this techniques too late in the competition to finalize this approach, say, by baking the recursion into the fine-tuning of the model), our sampling methods were in that sense “stabilization” techniques around this observation.

In summary, the combined observation here, and the one that enabled recursive sampling, is that the model works surprisingly well with:

discrete inputs (<color_0>)
continuous mixtures (0.25 * <color_0> + 0.75 * <color_1>)
and even hybrid masked mixtures (especially, adding the <mask> token to every position)
This means inference is not limited to hard tokens. Instead, we can nudge the model by giving it soft combinations of token embeddings.

Sampling Strategy
Task 28a6681f
Task
28a6681f
Task b6f77b65
Task
b6f77b65
Task 142ca369
Task
142ca369
Task 6e4f6532
Task
6e4f6532
Task 8b7bacbf
Task
8b7bacbf
Task 5dbc8537
Task
5dbc8537
During development, we worked on two sampling methods in parallel (which is part of our on-going strategy of following multiple promising directions at the same time). Both sampling methods were able to solve different tasks initially, and, over the course of the last two weeks of the competition, we merged the efforts by using the best parts of each.

The core tricks where:

soft-masking every token (adding <mask> embeddings to each position)
feeding the model’s output back into itself
stabilization of predictions to improve convergence, which was necessary, because we did not have the time to take the recursive sampling approach into account during model training. Here, we used either:
discrete projection + noise injection (a monte-carlo or simulated annealing based approach)
feeding the output logits back to the model in a continuous manner (which requires normalization/scaling to ensure the model’s output can actually be handled numerically stable as a next-step input)
Having found the soft-masking trick only 5 days before the competition ended, we decided to focus on the latter approach, since it required less refinement steps for this compute-budget limited competition.

However, the other method (discrete projection + noise) did solve different tasks for longer refinement loops, indicating to be also a promising candidate for future iterations.

Soft-Masking Sampling Loop

Sampling with masked diffusion LLMs (dLLMs) starts by providing a fully masked output grid and asking the model to replace the mask tokens with content tokens. The sampling loop that follows is typically some variation of: re-masking parts of the input, feeding it back into the dLLM, and requesting a refined prediction. This process repeats until the model converges on a stable solution. Note that we use a different random augmentation of the task in each refinement step.

The extension to use soft-masking is very similar:

# start fully masked
logits = np.zeros(shape)
logits[..., mask_position] = 1

for step in range(iterations):
    logits = model(logits)
    
    # discretize, normalize or any other mixing of logits
    logits = normalize(logits)
    
      # soft-mask every position
    logits[..., mask_position] = 1
The normalization method serves two purposes:

it ensures that the model can actually handle the logits, both numerically and also conceptually, since it was never trained on non-discrete inputs, and
it also has the potential to re-introduce noise, encouraging additional creative exploration during sampling. While this did help in our tests, the extra noise also has led to a larger sampling budgets to fully benefit from it. (For this reason, we did not pursue this direction for this competition).
Most-Visited-Candidate Selection

Convergence alone was not stable enough. Especially on harder tasks where the model remained uncertain and tended to flip back and forth between two or more solution states. As a result, the recursive sampling loop typically produced multiple candidate solutions.

We found that the most reliable approach was a stateful selection method: counting which candidates were visited most often during the soft-masking refinement process. For each task, we then selected the two most-visited candidates as our final guesses.

Alongside this, we also explored several stateless scoring methods, which do not require access to the sampling history. Two of them were particularly interesting:

one method compared each candidate against the model’s final prediction distribution to assess how well they aligned, performing similarly well to the stateful most-visited strategy
another provided a per-token confidence signal that we found could be used as an effective early stopping mechanism, allowing easy tasks to terminate sooner and subsequently spending more inference time on harder tasks. However, its threshold parameter involved a speed/accuracy trade-off that we did not have time to fully optimize.
Across all experiments, both stateful and stateless methods worked comparably well, but our final submission relied on most-visited count for selecting both the first and second guess.

Shape Prediction
With the demasking model working reliably, one major challenge remains: determining the size of the output grid. To address this, we introduce a second model and make a small adjustment to the data format. As before, we provide multiple input/output pairs, but we alter the representation of the final output grid to make the model predict its shape:

We no longer shrink the grid by removing padding tokens.
Instead, we also substitute the pixel-color tokens with padding tokens.
This leaves only the delimiter tokens, which define the right and bottom boundaries of the output grid
We then perform an additional finetuning run, initializing from our previously finetuned demasking model. In the model input, all tokens of the final output grid are replaced by mask tokens and have a loss applied to them, as we want the model to correctly place the delimiter tokens on the grid, which we then use during inference to detect the correct size of the output.

Things That Didn’t Work
The exploratory nature of this year’s competition meant trying a lot of ideas: probably a hundred on paper, a couple dozen in practice, and it’s been only a handful that truly increased the accuracy. We would like to share what we’ve learned, but also want to highlight the things that looked promising on paper but didn’t translate well in practice: architectural adaptations we were excited about, and large-scale synthetic data generation.

Synthetic Data
We did work on synthetic data early on. Our best-guess approach involved fine-tuning a coder LLM (Qwen/Qwen2.5-Coder-32B-Instruct) to produce steerable Atari-like game screens on up-to 30x30 pixels. The approach was to use GRPO training and vision LLM as a reward to decide whether the rendered screen look like Atari game or not.

Specifically, we created a “game screen” generator, asking to present a specific feature of a game. For example: “the dashboard of a flight simulator”, “the UI of a real time strategy game”, “a jump-and-run side-scroller”, “a close-up of a fighting game”, “the health bar in a …. game”. The resulting generators (some shown below) quickly resembled game screens, and allowed to “steer” some features using input variables.

Game screen example 1
Game screen example 2
Game screen example 3
Game screen example 4
The hardest part, however, was to define “meaningful puzzles” on these Atari-like game generators.

One approach was to use our best predictive model so far to decide whether a task was too easy or too hard, and using that as the reward function for an additional GRPO training loop. Another idea involved to measure the compressibility (both using LLM or classic compression algorithms) of the input to output mappings, since “less” compressible games contain more “independent noise”, thus cannot be inferred unambiguously.

Our best approach of synthetic generation, unfortunately, didn’t scale well enough; only 1 in about 50 to 100 generations convinced us to be novel and interesting enough. However, early tests showed that our small, semi-manually curated synthetic dataset of 150 additional tasks did not yield sufficient performance gains to justify pursuing this direction

Synthetic data example 1
Synthetic data example 2
Synthetic data example 3
Synthetic data example 4
Synthetic data example 5
Synthetic data example 6
Synthetic data example 7
Synthetic data example 8
Synthetic data example 9
Synthetic data example 10
Novel Techniques on the Horizon
Throughout the competition, we kept a close eye on new ideas popping up on X and arXiv, and a few of them sparked directions we explored ourselves. One particularly exciting development of tiny recursive models, which not only validated ARC as a meaningful benchmark in our opinion but also highlighted how crucial the embedding space for ARC-like tasks is. Their approach shares some conceptual ideas with ours, since both rely on recursion between input and output, but the embedding design and task representations are radically different, and that difference seems to matter a lot.

Inspired by this, we also experimented with ways to find better representations of the ARC problem space. We tried alternative positional encodings, hybrid schemes, and various embedding tweaks, though most of our tests didn’t end up helping much.

On the architectural side, we tested a range of ideas: tiny language models, Canon layers, H-Net–style architectures, intermediate reasoning tokens, and alternative grid representations. Some were promising, others dead ends. Life of trying a thousand small ideas, you name it. ¯*(ツ)*/¯

But also remember: Only because these approaches did not pan out for us, doesn’t mean that they can’t work at all!

Compute Budget
For the duration of the challenge, Lambda has generously provided us with one to three GH200 machines for development and experiments (depending on current needs) throughout the whole competition time, and, in addition to that with two weeks of 16 x NVIDIA H100 GPUs to max out our solution in the final two weeks of the competition. Early on, we used an additional machine with 8 x NVIDIA A100 GPUs for a total runtime of about three weeks, mainly while exploring the synthetic data generation, which, however, was not used for the final submission.

We sincerely like to thank Lambda for providing us with resources that enabled rapid iteration of our ideas.

Final Submission’s Results
Since our final submission involved two models, one to predict the shape of the solution, and, another one to fill out the empty solution space, our estimates of the final score had a higher variance.

Assuming the shape was known, our best two sampling techniques achieved a score

of about 30.5% ± 1% on the eval data set (not used for training)
used 128 test-time training steps, and
102 inference steps (of recursive refinement) Note: we used a total of 102 inference steps, however, to increase chances of a correct solution, our algorithm uses two rounds of 51 inference steps each, with a cold restart in the middle.
To infer the shape, we used a second LLaDA Model, which achieved an accuracy of about 85% ± 2% on the eval data set in predicting the correct shape given the example set of the respective ARC task and the challenge input.

Combining these two models, we expected a score of about 26%, however, our best submission achieved a score of 21.67% on the public leaderboard, which suggests some overfitting towards the evaluation set.

Things To Improve
Because of the multiplicative effect of the additional shape model (accuracy of the shape model times the accuracy of the known-shape model), a combined model would most likely helped to improve the score further. The main reason why we started with a dedicated model for each sub-task was the limited compute budget on the Kaggle servers, in terms of both memory and speed.

Similarly, the recursive sampling method that we found in the final 5 days of the competition was not reinforced in a proper training objective; the model never learned to use it’s own logits, yet we used it in that way anyways. To improve upon this, the training loop would have required a single change of one (or more) additional recursive forward passes of the model, potentially eliminating any requirement to schedule and normalize logits during inference. (Making the normalization just right has shown to be rather difficult, otherwise inference became instable for longer recursions.)

Looking at our scores of the last weeks, we made the biggest jumps when we scaled-up training resources for faster iterations in the last two weeks; better models enabled faster re-iterations of the sampling techniques.

We should have scaled up earlier. ;D

See Y’All Soon!
This year has been an exciting ride for us: from the moment we switched from autoregressive models to masked diffusion, to the breakthrough that continuous, recursive sampling could actually work with the right tricks. It was also inspiring to see ARC becoming more and more the de-facto benchmark in the broader community, with results from Anthropic, Gemini, OpenAI, and xAI pushing everyone forward.

One lesson that surprised us again and again: models with lower training losses don’t just perform better. Instead, they unlock entirely new ways of using them, which was the reason why we found the soft-masking tricks so late in the competition. Also, many of last year’s optimizations didn’t transfer to the new model, but taking a two-pronged exploration-exploitation approach helped us move fast while developing novel methods. On the practical side, we kept things generalizable by being careful with submissions (we used only 60 submissions throughout the competition, and only 17 of those used our diffusion approach), reducing sampling steps of the diffusion refinement, shortening test-time training, and always being slightly biased towards more parameter free methods.

Thanks for following along, we’re looking forward to what comes next in the ARC community. <3

Greetings, The ARChitects - that is: Daniel, Jan & David. 👋

The ARChitects team
ARC front

© 2025 Daniel Franzen, Jan Disselhoff, David Hartmann. Licensed under CC BY-SA 4.0.