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

### Phase 1: Update Explainer (`client/src/components/poetiq/PoetiqExplainer.tsx`)
- [ ] Update "The Key Difference" to mention **Meta-System** and **Self-Auditing**.
- [ ] Add a "Pareto Optimal Reasoning" section or bullet point explaining the cost/accuracy breakthroughs.
- [ ] Update "Why This Matters" to mention the system is **LLM-agnostic** and list the models (GPT-5.1, Gemini 3, Grok 4, GPT-OSS).
- [ ] Explicitly state our role as **Independent Auditors**.

### Phase 2: Update Community Page (`client/src/pages/PoetiqCommunity.tsx`)
- [ ] Update header/intro text to reflect the audit nature: "We are independently auditing Poetiq's SOTA results...".
- [ ] Ensure the blog post link is prominent (already is).
- [ ] Add a small summary of the claims (e.g. "Claims to establish new Pareto frontiers...").

### Phase 3: Update Model List (`server/controllers/poetiqController.ts`)
- [ ] Add `xai/grok-4-fast` (or similar) to the supported models list.
- [ ] Add `openrouter/openai/gpt-oss-120b` (if available) or similar placeholders to reflect the blog post's models.

### Phase 4: Update Solver UI (`client/src/pages/PoetiqSolver.tsx`)
- [ ] Ensure the terminology in the UI matches "Poetiq Meta-System" where appropriate.
- [ ] (Optional) Check if "Experts" setting needs to be more flexible or if 1/2/8 is still the correct fixed set (Blog mentions "Gemini-3-a,b,c" map to these, but implies flexibility).

### Phase 5: Documentation
- [ ] Update `CHANGELOG.md`.

## 3. Verification
- [ ] Verify the Explainer text reads correctly and covers all user points.
- [ ] Verify the Community page reflects the "Independent Auditor" stance.
- [ ] Verify the Solver page lists the new models.
