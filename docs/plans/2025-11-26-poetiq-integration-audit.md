---
description: Update Poetiq integration to reflect new blog post claims
---

# Poetiq Integration Audit & Update Plan

**Date:** 2025-11-26
**Goal:** Ensure the Poetiq solver integration, community page, and explainer text accurately reflect the claims made in the recent Poetiq blog post ("Traversing the Frontier of Superintelligence").

## 1. Analysis & Discrepancies

The blog post claims:
- **Meta-System:** Poetiq is a "recursive, self-improving, LLM-agnostic meta-system" that selects combinations of models.
- **Performance:** Establishes new Pareto frontiers on ARC-AGI-1 & 2. Surpasses previous results.
- **Models Used:** GPT-5.1, Gemini 3, Grok 4 Fast, GPT-OSS-120B.
- **Method:** "Straight reasoning model calls with the agent being a python implementation" (Code Generation).
- **Role:** We are "Independent Auditors" evaluating these results.

Current Implementation:
- `PoetiqExplainer.tsx`: Focuses on "Code Generation vs Prediction" but lacks the "Meta-System", "Pareto Frontier", and "Self-Auditing" terminology.
- `PoetiqCommunity.tsx`: Locked to Gemini 3 Pro Preview. Intro text is generic ("Help verify ARC solving").
- `poetiqController.ts`: Lists standard models but missing "Grok 4 Fast" and All the other models available from OpenRouter.And from OpenAI."

## 2. Implementation Plan

### Phase 1: Merge & Update Community Page (`client/src/pages/PoetiqCommunity.tsx`)
- [ ] **MERGE**: Move all content from `PoetiqExplainer.tsx` into `PoetiqCommunity.tsx`.
- [ ] **DELETE**: Remove `client/src/components/poetiq/PoetiqExplainer.tsx` to avoid confusion.
- [ ] Update the merged content to match the blog post:
    - **Header**: "Independent Audit of Poetiq's SOTA Results".
    - **New Section**: "The Poetiq Meta-System" (replacing "How it works").
    - **New Section**: "Pareto Optimal Reasoning" - visualizing the cost/performance claims.
    - **New Section**: "Supported Models" - explicitly listing Gemini 3, GPT-5.1, Grok 4 Fast, GPT-OSS.
    - **Process**: Keep the 1-6 step visual but update terminology (e.g. "Self-Auditing").

### Phase 2: Update Model Support (`server/controllers/poetiqController.ts`)
- [ ] **STRICT REQUIREMENT**: Use ONLY verified model keys from `server/config/models.ts`.
- [ ] Add `x-ai/grok-4.1-fast` (OpenRouter) and `grok-4-fast-reasoning` (xAI Direct) to match "Grok 4 Fast".
- [ ] Add `openai/gpt-oss-120b` (OpenRouter) to match "GPT-OSS".
- [ ] Add `openai/gpt-5.1` (OpenRouter) and `gpt-5.1-codex-mini` (OpenAI Direct) to match "GPT-5.1".
- [ ] Ensure the `getModels` endpoint returns these legitimate models so they appear in the dropdown.

### Phase 3: Update Solver UI (`client/src/pages/PoetiqSolver.tsx`)
- [ ] Update the UI to reflect the "Poetiq Meta-System" terminology.
- [ ] Verify the "Experts" dropdown. The blog mentions "Gemini-3-a/b/c" as *examples* of how it uses multiple experts (1, 2, 8), but implies the *system* can use any model. Ensure the UI allows selecting the expert count (1, 2, 8) for *any* selected model, effectively creating "GPT-5.1-a", "Grok-4-a", etc.

### Phase 4: Documentation
- [ ] Update `CHANGELOG.md`.

## 3. Verification
- [ ] Verify `PoetiqCommunity` page loads with new integrated content.
- [ ] Verify `PoetiqExplainer` is gone.
- [ ] Verify Solver page shows new models.

## 4. Additional Notes
The blog post provides additional context and details about the Poetiq meta-system, its performance, and the models used. It is essential to review the blog post in its entirety to ensure that all relevant information is incorporated into the updated implementation.

Traversing the Frontier of Superintelligence
Poetiq is proud to announce a major milestone in AI reasoning. We have established a new state-of-the-art (SOTA) on the ARC-AGI-1 & 2 benchmarks, significantly advancing both the performance and the efficiency of the current AI systems.

... (rest of the blog post remains the same)

November 20, 2025



Figure 1: Poetiq’s systems redraw the Pareto frontier for cost versus performance, delivering better results for lower cost at every level on the ARC-AGI-1 Public Eval Set. The comparisons presented here are on the Public Eval Set for all shown entries.
Sources: (1) Public Eval results are from ARC-AGI official website (public-set results) (2) Pang’s Public Eval result was unavailable, so we reproduced it with his public code. (3) Berman’s Grok 4 Thinking result was unavailable, so we reproduced it with his public code. (4) Berman’s latest GPT-5 Pro result is on 100 of the 400 problems (see his xAI post).
ARC-AGI-1
ARC-AGI-2
The Results
SOTA on the ARC-AGI Benchmark
Poetiq's systems establish entirely new Pareto frontiers on both ARC-AGI-1 and ARC-AGI-2 (Figures 1 and 2), surpassing previous results and pushing the boundary for what is possible in cost-effective reasoning. We highlight a few interesting points, with emphasis given to our system’s configuration using models released in the last week; GPT-5.1 on November 13, 2025 and Gemini 3 on November 18, 2025.
Poetiq (Mix) used both the latest Gemini 3 and GPT-5.1 models. Compare with Gemini 3 Deep Think (Preview) which is significantly more expensive and has lower accuracy.
Poetiq (Gemini-3-a,b,c) are examples of how Poetiq can leverage multiple LLMs to maximize performance at any target cost. Poetiq discovered a straight-forward method to achieve pareto-optimal solutions across a wide swath of operating regimes by using multiple Gemini-3 calls to programmatically address these problems (both on ARC-AGI-1 and ARC-AGI-2). We have open-sourced the code for these systems.
Poetiq (Grok-4-Fast) emphasizes cost and is built on top of the Grok 4 Fast Reasoning model. In fact, it is both cheaper and more accurate than the underlying model’s reported numbers (see below for more details). It achieves accuracy rivaling models that are over two orders of magnitude more expensive.
Poetiq (GPT-OSS-b) is built on top of the open weights GPT-OSS-120B model and shows remarkable accuracy for less than 1 cent per problem (Figure 1).
Poetiq (GPT-OSS-a) is built on top of the GPT-OSS-120B low thinking model. This point is included to show system performance at extreme cost savings levels (Figure 1).
All these points (and more), while being capable separate systems in their own right, are produced by the underlying, flexible, Poetiq meta-system. One of the meta-system’s core strengths is automatically selecting combinations of models and approaches, even deciding when to write any code, and to which models to assign coding tasks. Our recursive, self-improving, system is LLM-agnostic and demonstrates its abilities with the state-of-the-art models.
Four observations:
Note that Poetiq (Gemini-3-b) is saturating the performance on ARC-AGI-1; allowing larger computation expenditure, Poetiq (Gemini-3-c), did not provide benefit. However, on ARC-AGI-2, performance continues improving.
All of Poetiq’s meta-system’s adaptation was done prior to the release of the Gemini 3 and GPT-5.1. Additionally, it was never shown problems from ARC-AGI-2. Further, for cost efficiency, the Poetiq system only relied on open-source models for adaptation. The results from that adaptation (the basis for all of the systems shown) were then used on both ARC-AGI-1 & 2, and also with over a dozen different underlying LLM models (shown below in Figure 3). This indicates substantial transference and generalization in the results of Poetiq’s system across model versions, families, and sizes. We have observed this type of generalization on other problems as well.
Our ARC-AGI-2 results have exceeded the performance of the average human test-taker (60%).
As is described below (see final section), most of the underlying LLM models suffer varying degrees of performance degradation when moving from Public to Semi-Private evaluation on ARC-AGI-1. We expect the same. Most models have seen a smaller difference in performance on ARC-AGI-2 as the sets are more closely calibrated. All results reported here, for our work and everyone else’s, are on the public evaluation sets. See our analysis below.
Per Model Improvements
Using Poetiq’s Meta-System to Improve Performance of Popular Models
To further illustrate the benefits of Poetiq’s meta-system we apply our technique to popular recent models from Google DeepMind, OpenAI, Anthropic, and xAI. In each case, our system improves the accuracy while reducing the cost. How is this even possible? Our systems achieve this because they make only a single attempt that uses fewer than two requests on average, rather than the two attempts that ARC-AGI permits. Figure 3 shows this on ARC-AGI-1 for 12 models from a variety of model families: GPT, Claude Haiku, Gemini, Grok 4, and GPT-5.1 Codex models.
How We Did It
It’s LLMs all the way down. We used LLMs to build, improve, and power the system. This flexible, powerful, and recursive architecture is what allowed our small team to rapidly achieve this suite of state-of-the-art results.
The specific configurations that we are open-sourcing were chosen to illustrate two key principles:
The prompt is an interface, not the intelligence: Our system engages in an iterative problem-solving loop. It doesn't just ask a single question; it uses the LLM to generate a potential solution (sometimes code as in this example), receives feedback, analyzes the feedback, and then uses the LLM again to refine it. This multi-step, self-improving process allows us to incrementally build and perfect the answer.
Self-Auditing: The system autonomously audits its own progress. It decides for itself when it has enough information and the solution is satisfactory, allowing it to terminate the process. This self-monitoring is critical for avoiding wasteful computation and minimizing costs.
We hope that our open-source code will help inspire new ideas and accelerate the path to superintelligence. The official code is available on Github.
Why ARC-AGI?
ARC-AGI provides an ideal test bed to firmly establish one of our core tenets – LLMs contain much of humanity’s knowledge, but often struggle with tasks that rely on more complex reasoning. While the performance of an LLM heavily relies on the query, their inherent stochasticity makes knowledge extraction unreliable and makes the reasoning steps unpredictable. The challenge lies in discovering a reasoning strategy that can both find the necessary pieces of information and assemble them when they are discovered to intelligently determine what information is needed next.
At Poetiq, automating and optimizing this process is one of our key goals. We are building technology to optimize the extraction of this fragmented knowledge for complex reasoning tasks by not a priori dictating, but rather discovering, appropriate reasoning strategies that are both adaptive to the underlying LLM and work within specified real-world constraints (budgets, tokens, or compute). This will unlock the rapid progress in AI that the technology promises. Our system is designed to very quickly adapt to the specifics of the task and the model. ARC-AGI provides a concrete demonstration of this. For ARC-AGI, our system discovered an elegant method to improve performance across the entire frontier!
What's Next
At Poetiq, our core meta-system produces optimized agents to automate the extraction of knowledge for hard tasks that require complex reasoning. We optimize every part of the process: developing better strategies for determining what to ask, refining sequential chain-of-questions, and devising fundamental new methods for assembling the answers. ARC-AGI is just the beginning – we’ve tackled several other benchmarks as well, with similarly compelling results. Watch this space for more information on those, as well as other fun demonstrations of our capabilities.

We're excited to share this result with the community and look forward to the discussion. Let us know your thoughts at poetiq@poetiq.ai.