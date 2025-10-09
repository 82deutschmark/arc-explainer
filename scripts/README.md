# ARC Explainer Scripts

Automation scripts for analyzing ARC-AGI puzzles with AI models.

## Table of Contents

- [Progressive Reasoning Scripts](#progressive-reasoning-scripts)
- [Batch Analysis Scripts](#batch-analysis-scripts)
- [Helper Scripts](#helper-scripts)
- [Best Practices](#best-practices)

---

## Progressive Reasoning Scripts

Progressive reasoning uses conversation chaining (Responses API) to iteratively refine solutions.

### `grok-4-progressive-reasoning.ts`

**Purpose**: Iterative refinement for Grok-4-Fast-Reasoning using previousResponseId chaining

**Model**: `grok-4-fast-reasoning`

**Configuration**:
- Temperature: 0.99
- Prompt: `discussion` mode (progressive reasoning)
- Max iterations: 2 (default, configurable via `--iterations`)
- Timeout: 60 minutes per iteration
- Concurrency: Unlimited (0s stagger between puzzles)

**Usage**:
```bash
# Auto-load from default file (scripts/grok-4-unsolved-arc2.txt)
node --import tsx scripts/grok-4-progressive-reasoning.ts

# Specific puzzle IDs
node --import tsx scripts/grok-4-progressive-reasoning.ts 045e512c 0e206a2e 234bbc79

# From file
node --import tsx scripts/grok-4-progressive-reasoning.ts --file puzzle-ids.txt

# Custom iterations
node --import tsx scripts/grok-4-progressive-reasoning.ts --iterations 3 045e512c 0e206a2e
```

**Output**:
- Per-puzzle correctness progression (✗ → ✓ tracking)
- Improvement analysis (improved/unchanged/degraded counts)
- All results saved to database via `/api/puzzle/save-explained`

---

### `gpt-5-progressive-reasoning.ts`

**Purpose**: Iterative refinement for GPT-5 models using Responses API with reasoning parameters

**Models**:
- `gpt-5-2025-08-07` (main reasoning model)
- `gpt-5-mini-2025-08-07` (smaller reasoning model)
- `gpt-5-nano-2025-08-07` (tiny reasoning model)
- `gpt-5-chat-latest` (chat model, no reasoning)

**Configuration**:
- Temperature: NOT sent (GPT-5 reasoning models don't support temperature)
- Reasoning Effort: `high` (default: minimal/low/medium/high)
- Reasoning Verbosity: `high` (default: low/medium/high)
- Reasoning Summary Type: `detailed` (default: auto/none/detailed)
- Max iterations: 2 (default, configurable via `--iterations`)
- Timeout: 60 minutes per iteration
- Concurrency: Lower (3s stagger between puzzles)

**Usage**:
```bash
# Basic usage (requires model as first argument)
node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-2025-08-07 045e512c 0e206a2e

# From file
node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-2025-08-07 --file puzzle-ids.txt

# Custom reasoning parameters
node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-2025-08-07 \
  --iterations 3 \
  --reasoning-effort medium \
  --reasoning-verbosity high \
  --reasoning-summary-type detailed \
  045e512c 0e206a2e

# GPT-5 Mini (smaller, faster)
node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-mini-2025-08-07 --file puzzle-ids.txt
```

**Output**:
- Per-puzzle correctness progression (✗ → ✓ tracking)
- Improvement analysis (improved/unchanged/degraded counts)
- GPT-5 specific: reasoning log length tracking
- All results saved to database via `/api/puzzle/save-explained`

---

## Batch Analysis Scripts

Simple one-shot analysis without conversation chaining.

### `grok-4-fast-reasoning.ts`

**Purpose**: Single-pass analysis for Grok-4-Fast-Reasoning

**Model**: `grok-4-fast-reasoning`

**Configuration**:
- Temperature: 0.99
- Prompt: `custom` (solver mode)
- System Prompt Mode: `ARC`
- Omit Answer: `true` (research mode)
- Timeout: 60 minutes per puzzle
- Concurrency: Unlimited (1s stagger)

**Usage**:
```bash
# All ARC1 evaluation puzzles (400 puzzles)
node --import tsx scripts/grok-4-fast-reasoning.ts --dataset arc1

# All ARC2 evaluation puzzles (120 puzzles)
node --import tsx scripts/grok-4-fast-reasoning.ts --dataset arc2

# Specific puzzle IDs
node --import tsx scripts/grok-4-fast-reasoning.ts 00d62c1b 00d7ad95 00da1a24

# From file
node --import tsx scripts/grok-4-fast-reasoning.ts --file puzzle-ids.txt

# Limit to first N puzzles
node --import tsx scripts/grok-4-fast-reasoning.ts --dataset arc2 --limit 10

# Take last N puzzles
node --import tsx scripts/grok-4-fast-reasoning.ts --dataset arc2 --tail 20
```

**Output**:
- Success/failure counts
- Average response time
- Failed puzzles list for manual review
- All results saved to database

---

## Helper Scripts

### `get-unsolved-puzzles.ts`

**Purpose**: Fetch unsolved puzzles from database for progressive reasoning workflows

**Data Source**: `/api/model-dataset/performance/:modelName/:datasetName` endpoint

**Default Output**: `scripts/grok-4-unsolved-arc2.txt`

**Usage**:
```bash
# Default: grok-4-fast-reasoning on evaluation2 (ARC2 eval)
node --import tsx scripts/get-unsolved-puzzles.ts

# Custom model and dataset
node --import tsx scripts/get-unsolved-puzzles.ts \
  --model gpt-5-2025-08-07 \
  --dataset evaluation

# Custom output path
node --import tsx scripts/get-unsolved-puzzles.ts \
  --output scripts/my-unsolved-puzzles.txt

# Only unattempted puzzles (exclude failed attempts)
node --import tsx scripts/get-unsolved-puzzles.ts \
  --include-failed false \
  --include-unattempted true

# Only failed puzzles (exclude unattempted)
node --import tsx scripts/get-unsolved-puzzles.ts \
  --include-failed true \
  --include-unattempted false
```

**Output**:
- Text file with one puzzle ID per line
- Performance summary (correct/incorrect/notAttempted counts)
- Ready to use with `--file` flag in other scripts

**Workflow Example**:
```bash
# Step 1: Generate unsolved puzzle list
node --import tsx scripts/get-unsolved-puzzles.ts

# Step 2: Run progressive reasoning on unsolved puzzles
node --import tsx scripts/grok-4-progressive-reasoning.ts
# (auto-loads from scripts/grok-4-unsolved-arc2.txt)
```

---

## Best Practices

### Script Selection Guide

**Use Progressive Reasoning When**:
- Model supports Responses API (Grok-4, GPT-5/o-series, o1/o3/o4)
- You want iterative improvement through conversation chaining
- Previous analysis exists (can continue from `providerResponseId`)
- Testing if second-pass reasoning improves accuracy

**Use Batch Analysis When**:
- First-time analysis of many puzzles
- Model doesn't support Responses API
- Simple one-shot evaluation needed
- Bulk testing across datasets

### Concurrency & Rate Limits

**Grok-4 Scripts**:
- Unlimited concurrent requests (0-1s stagger)
- xAI has generous rate limits
- Monitor via console output

**GPT-5 Scripts**:
- Lower concurrency (3s stagger recommended)
- OpenAI reasoning models are expensive/slow
- Consider `--limit` flag for testing

### Cost Management

**Progressive Reasoning**:
- 2 iterations × 115 puzzles = 230 API calls
- ~11 minutes per puzzle (Grok-4)
- Total time: ~20-24 hours for full ARC2 unsolved set

**Estimation**:
```bash
# Test on small subset first
node --import tsx scripts/get-unsolved-puzzles.ts --output test-puzzles.txt
# Manually edit test-puzzles.txt to keep only 5 puzzles
node --import tsx scripts/grok-4-progressive-reasoning.ts --file test-puzzles.txt

# Analyze results before full run
# Check improvement rate in Analytics Dashboard
```

### Database Integration

All scripts save results via:
- `/api/puzzle/analyze/:puzzleId/:modelKey` (analysis)
- `/api/puzzle/save-explained/:puzzleId` (database save)

Monitor progress via:
- Analytics Dashboard: http://localhost:5173/analytics
- API endpoint: `/api/model-dataset/performance/grok-4-fast-reasoning/evaluation2`

### Error Handling

**Common Issues**:
1. **Timeout errors**: Increase `PUZZLE_TIMEOUT_MS` for slower models
2. **Rate limit errors**: Increase `PUZZLE_STAGGER_MS` or reduce concurrency
3. **No provider response ID**: Check model supports Responses API
4. **File not found**: Ensure working directory is project root

**Graceful Shutdown**:
- All scripts handle `SIGINT` (Ctrl+C) and `SIGTERM`
- Partial results are saved to database
- Resume by excluding already-analyzed puzzles

### Monitoring Progress

**Real-time Console Output**:
```
🔄 045e512c - Iteration 0 (initial)
✅ Iteration 0 complete in 678s
   Explanation ID: 12345
   Provider Response ID: resp_abc123...
   Correct: ✗, Confidence: 65%

🔄 045e512c - Iteration 1 (continuing from resp_abc123...)
✅ Iteration 1 complete in 701s
   Explanation ID: 12346
   Provider Response ID: resp_def456...
   Correct: ✓, Confidence: 82%

📊 Summary for 045e512c:
   Total Iterations: 2
   Successful: 2
   Failed: 0
   Total Time: 1379s
   Correctness: ✗ → ✓
```

**Final Summary**:
```
📈 IMPROVEMENT ANALYSIS:
   Improved (✗ → ✓): 5
   Unchanged: 108
   Degraded (✓ → ✗): 2
```

---

## Environment Variables

All scripts require:
- `API_BASE_URL` (default: http://localhost:5000)
- Appropriate API keys in `.env`:
  - `GROK_API_KEY` (for Grok scripts)
  - `OPENAI_API_KEY` (for GPT-5 scripts)

---

## Troubleshooting

**Script won't run**:
```bash
# Ensure you're using node --import tsx (NOT ts-node)
node --import tsx scripts/script-name.ts

# Check you're in project root
pwd  # Should show: /path/to/arc-explainer
```

**Database connection issues**:
```bash
# Verify server is running
curl http://localhost:5000/api/health

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

**No puzzles in output file**:
```bash
# Check model has attempts in database
node --import tsx scripts/get-unsolved-puzzles.ts --model grok-4-fast-reasoning
# If "All puzzles are correct", the model has 100% accuracy!
```

---

## Architecture Notes

### Responses API vs Chat Completions API

**Responses API** (Grok-4, GPT-5, o1/o3/o4):
- Conversation chaining via `previousResponseId`
- Structured output via JSON schema
- Reasoning token tracking (separate from output tokens)
- 30-day server-side state retention

**Chat Completions API** (all other models):
- Stateless conversations
- No automatic chaining support
- Standard token accounting

### Progressive Reasoning Implementation

Progressive scripts use the **discussion** prompt mode:
```typescript
{
  promptId: 'discussion',  // Enables iterative refinement prompts
  systemPromptMode: 'ARC',
  previousResponseId: 'resp_abc123'  // Links to prior conversation
}
```

The backend automatically:
1. Validates `previousResponseId` exists in provider's 30-day window
2. Checks provider compatibility (xAI → xAI, OpenAI → OpenAI)
3. Passes to Responses API with conversation context
4. Stores new `providerResponseId` for next iteration

### Database Schema

All analyses stored in `explanations` table:
- `provider_response_id` (TEXT): For conversation chaining
- `is_prediction_correct` (BOOLEAN): Single-test accuracy
- `multi_test_all_correct` (BOOLEAN): Multi-test accuracy
- `predicted_output_grid` (JSONB): Predicted solution
- `reasoning_log` (TEXT): Human-readable reasoning summary
- `reasoning_items` (JSONB): Structured reasoning steps

Query via repository:
```typescript
repositoryService.modelDataset.getModelDatasetPerformance(
  'grok-4-fast-reasoning',
  'evaluation2'
)
```

---

## Future Enhancements

Potential improvements:
- [ ] Automatic cost tracking per script run
- [ ] Resume from checkpoint (skip already-improved puzzles)
- [ ] Multi-model comparison (debate mode via scripts)
- [ ] Adaptive iteration count (stop early if correct)
- [ ] Parallel script orchestration (multiple models simultaneously)

---

## Support

For issues or questions:
- Check `/docs` folder for detailed architecture docs
- Review Analytics Dashboard for model performance
- Examine console output for detailed error messages
- Verify API keys and environment configuration
