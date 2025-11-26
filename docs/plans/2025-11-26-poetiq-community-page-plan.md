/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-26
 * PURPOSE: Plan for Poetiq Community Solver page - a landing page that explains
 *          the solver, shows completion progress, and lets the community contribute
 *          by bringing their own API keys.
 * SRP and DRY check: Pass - Planning document only
 */

# Poetiq Community Solver Page - Implementation Plan

## Executive Summary

Create a dedicated "Poetiq Community Solver" landing page that:
1. **Explains** what Poetiq is and how it works in simple, accessible terms
2. **Shows progress** - which puzzles have been solved vs which remain
3. **Enables community contribution** - BYO API key to help fill out the database
4. **Supports multiple providers** - Gemini Direct, OpenRouter (with various models)

---

## Problem Statement

### The Rate Limit Challenge

The Poetiq solver (from [poetiq.ai](https://poetiq.ai)) claims state-of-the-art results on ARC-AGI benchmarks using iterative code generation. However:

- **Tier 1 Google AI API quotas** are limited (typically 2 requests/minute, 1500/day for free tier)
- **Each puzzle requires many API calls** - up to 10 iterations × multiple experts = 20-80+ API calls per puzzle
- **120 puzzles in ARC2-Eval** - impossible for a single user to complete in one day
- **Community pooling** could solve this: 20 people × 6 puzzles each = complete dataset

### Why This Matters

We want to **verify Poetiq's claims** by:
1. Running it on the full ARC2-Eval dataset (120 puzzles)
2. Storing results with full audit trail (generated code, iterations, etc.)
3. Comparing against direct-prediction methods already in our database

---

## What is Poetiq? (Plain-Language Explanation)

The landing page will explain Poetiq in these simple terms:

### How Most AI Solvers Work (Direct Prediction)
> "Look at the training examples. Now predict what the output grid should be."
> The AI looks at patterns and directly outputs a grid of numbers.

### How Poetiq Works (Code Generation)
> "Look at the training examples. Write a Python function that transforms ANY input into the correct output."
> 
> **The key difference**: Instead of guessing the answer, Poetiq writes **code that produces the answer**.

### The Poetiq Process (Step by Step)

```
1. 🧠 ANALYZE: AI looks at training input→output pairs
2. 📝 CODE: AI writes a Python transform() function
3. 🧪 TEST: Code runs on training examples (in sandbox)
4. ❌ FAIL? Get feedback on what went wrong
5. 🔄 RETRY: AI refines code based on feedback (up to 10 times)
6. ✅ SUCCESS: When code passes ALL training examples, apply to test
7. 🗳️ VOTE: Multiple "experts" vote on best solution
```

### Why Code Generation Might Be Better

| Direct Prediction | Code Generation |
|-------------------|-----------------|
| Guesses the answer | Proves it can reproduce the pattern |
| Can get lucky | Must understand the transformation |
| Single attempt | Iterates until correct on training |
| Black box | Explainable (we can read the code!) |

### Why We Need Your Help

> "Each API key has daily limits. One person can't run 120 puzzles. 
> But 20 people can each run 6 puzzles. Together, we complete the dataset!"

---

## Page Design & Components

### 1. Hero Section
- **Title**: "Help Verify the Poetiq Solver"
- **Subtitle**: "Donate your API quota to help the community verify state-of-the-art ARC solving"
- **Quick stats**: X/120 puzzles complete, Y remaining

### 2. "How It Works" Explainer (Collapsible)
- Plain-language explanation of Poetiq methodology
- Visual diagram of the iterative code generation loop
- Comparison table: Direct Prediction vs Code Generation

### 3. Progress Dashboard
- **Visual grid/heatmap** showing all 120 ARC2-Eval puzzles
- Color coding:
  - 🟩 Green: Solved correctly by Poetiq
  - 🟧 Orange: Attempted but failed
  - ⬜ Gray: Not yet attempted
- Click any puzzle to see details or run solver

### 4. "Pick a Puzzle" Quick Start
- Shows **next recommended puzzle** (first unsolved one)
- Option to pick specific unsolved puzzle from list
- Filter: Show only unsolved / Show all

### 5. BYO API Key Configuration
- Provider selector (Gemini Direct / OpenRouter)
- API key input (password field, never stored)
- Model selector (for OpenRouter: multiple models available)
- Expert count selector (1/2/4/8)
- Security messaging: "Your key is passed to the solver and never logged or stored"

### 6. Run Controls
- Start button (disabled until API key entered)
- Live progress display during run
- Elapsed time, current iteration, status messages

### 7. Results Display
- Success/Failure indicator
- Generated code viewer (syntax highlighted)
- Iteration history (how many attempts, what feedback)
- Auto-save to database on completion

---

## Technical Implementation

### Files to Create

```
client/src/pages/PoetiqCommunity.tsx        # Main landing page
client/src/components/poetiq/
  ├── PuzzleProgressGrid.tsx                # Visual grid of puzzle status
  ├── PoetiqExplainer.tsx                   # Collapsible how-it-works section
  ├── QuickStartPicker.tsx                  # Next puzzle recommendation
  └── PoetiqRunPanel.tsx                    # BYO key + run controls (extracted)
```

### API Endpoints Needed

Existing (already implemented):
- `GET /api/puzzle/list?source=ARC2-Eval` - Get all ARC2-Eval puzzle IDs
- `POST /api/puzzle/bulk-status` - Check which puzzles have Poetiq explanations
- `POST /api/poetiq/solve/:taskId` - Run solver on single puzzle
- `GET /api/poetiq/status/:sessionId` - Get solver progress
- `GET /api/poetiq/models` - List available models

New endpoints needed:
- `GET /api/poetiq/progress` - Get community progress summary (total/attempted/solved)
- `GET /api/poetiq/puzzle-status` - Get status for all ARC2-Eval puzzles at once

### Database Queries

To determine puzzle status, we need to check the `explanations` table for entries where:
- `model_name` starts with `poetiq-`
- `puzzle_id` is in the ARC2-Eval set
- `is_prediction_correct` or `multi_test_all_correct` is true

### Model Configuration for OpenRouter

Currently supported models in Poetiq (via LiteLLM):
```python
# Direct APIs
"gemini/gemini-3-pro-preview"
"openai/gpt-5"
"anthropic/claude-sonnet-4"

# Via OpenRouter
"openrouter/google/gemini-2.5-pro-preview"
"openrouter/google/gemini-2.5-flash-preview"
"openrouter/anthropic/claude-sonnet-4"
"openrouter/openai/gpt-4o"
```

The UI should show these as user-friendly options.

---

## Navigation Integration

Add to the **Misc** dropdown in `AppNavigation.tsx`:

```typescript
{
  type: 'link',
  title: 'Poetiq Solver',
  href: '/poetiq',
  icon: Code,  // or a custom icon
  description: 'Help verify the Poetiq code-generation solver with your API key'
}
```

Route in `App.tsx`:
```typescript
<Route path="/poetiq" component={PoetiqCommunity} />
```

Note: The existing `/puzzle/poetiq/:taskId` route remains for running on specific puzzles.

---

## Implementation TODO List

### Phase 1: Landing Page Structure (MVP)
- [ ] Create `PoetiqCommunity.tsx` with hero section and explainer
- [ ] Add route and navigation link
- [ ] Implement `PoetiqExplainer.tsx` collapsible component
- [ ] Add progress summary (reuse `useArc2EvalProgress` hook)

### Phase 2: Puzzle Progress Grid
- [ ] Create `PuzzleProgressGrid.tsx` component
- [ ] Visual grid showing all 120 puzzles with color-coded status
- [ ] Click to navigate to puzzle solver page
- [ ] Filter controls (All / Unsolved / Solved / Failed)

### Phase 3: Quick Start Flow
- [ ] "Next recommended puzzle" feature
- [ ] One-click "Run next unsolved" button
- [ ] Skip already-attempted puzzles

### Phase 4: Enhanced Model Support
- [ ] Add more OpenRouter models to `poetiqController.getModels()`
- [ ] Update `poetiq-solver/arc_agi/config.py` with new model IDs
- [ ] Model-specific UI hints (cost, speed estimates)

### Phase 5: Polish & Community Features
- [ ] Thank-you message after successful run
- [ ] Leaderboard of contributors (by API key hash? or anonymous?)
- [ ] Estimated time remaining to complete dataset

---

## Security Considerations

1. **API keys are never logged or stored** - passed directly to Python subprocess environment
2. **Keys are not transmitted to our servers** - only used locally in the solver process
3. **No API key validation** - if key is invalid, solver will fail with auth error
4. **Rate limiting** - we don't control user's API limits, solver handles retries

---

## Success Criteria

1. ✅ New landing page at `/poetiq` accessible from navigation
2. ✅ Clear plain-language explanation of Poetiq methodology
3. ✅ Visual progress showing which puzzles are done
4. ✅ Can run solver on unsolved puzzle with BYO API key
5. ✅ Results saved to database with full Poetiq metadata
6. ✅ Works with both Gemini Direct and OpenRouter providers
7. ✅ Community can collectively complete the ARC2-Eval dataset

---

## Open Questions

1. **Attribution**: Should we track who contributed which puzzle? Privacy concerns?
2. **Duplicate runs**: What if someone re-runs an already-solved puzzle? Overwrite or skip?
3. **Failed attempts**: Should failed attempts be visible in progress grid?
4. **Model consistency**: Should we standardize on one model or allow variety?

---

*Plan created 2025-11-26. Implementation will be tracked via changelog updates.*
