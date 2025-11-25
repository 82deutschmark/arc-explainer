/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * PURPOSE: Critical assessment and integration plan for Poetiq ARC-AGI solver
 * SRP and DRY check: Pass - this is a planning document
 */

# Poetiq Solver Integration Plan

## Critical Assessment

### What Poetiq Claims
- "Record-breaking submission" to ARC-AGI-1 and ARC-AGI-2 benchmarks
- SOTA (State of the Art) reasoning capabilities
- Uses Gemini-3-Pro-Preview as primary model

### What Poetiq Actually Does (Code Analysis)

The methodology is **fundamentally different** from direct prediction approaches:

1. **Code Generation Approach**: Instead of having the LLM predict output grids directly, Poetiq asks the LLM to generate Python `transform(grid)` functions
2. **Iterative Refinement**: Up to 10 iterations per puzzle, with feedback from failed attempts
3. **Sandboxed Execution**: Generated code runs in isolated subprocess with 5s timeout
4. **Parallel Experts**: Configurable 1-8 expert instances running concurrently
5. **Voting System**: Aggregates results across experts, prioritizing solutions that pass all training examples

### Architectural Components

```
arc_agi/
├── solve.py           # Entry point
├── solve_coding.py    # Main iteration loop
├── solve_parallel_coding.py  # Multi-expert orchestration
├── llm.py             # LiteLLM wrapper with rate limiting
├── sandbox.py         # Subprocess code execution
├── prompts.py         # Three solver prompt variants
├── config.py          # Expert configuration
└── types.py           # TypeScript-like TypedDicts
```

### Strengths
- Iterative approach with learning from failures
- Code-based solutions are verifiable against training examples
- Voting provides robustness across multiple attempts
- Uses LiteLLM for provider abstraction

### Concerns for Reproducibility

1. **Non-Determinism**: Temperature 1.0 means different runs will produce different code
2. **Resource Intensive**: 10 iterations × multiple experts = many API calls per puzzle
3. **Time Budget**: Default max 2 hours per puzzle per solver
4. **Model Dependency**: Currently hardcoded for Gemini-3-Pro-Preview
5. **No Token/Cost Tracking**: The solver doesn't capture detailed usage metrics

### Critical Questions
- Claims 75%+ on ARC-AGI-1 but uses `SELECTED_PROBLEMS` subset - cherry-picked?
- No published methodology paper, only blog post
- High temperature (1.0) makes exact reproduction impossible

---

## Integration Architecture

### Database Fields Needed (poetiq-specific)

```sql
-- Consider adding to explanations table:
poetiq_iterations INTEGER,           -- Number of iterations used
poetiq_expert_count INTEGER,         -- Number of parallel experts
poetiq_generated_code TEXT,          -- Final transform() function
poetiq_iteration_log JSONB,          -- Full iteration history
poetiq_voting_results JSONB,         -- Expert voting data
poetiq_train_accuracy DECIMAL(5,4),  -- % of training examples passed
poetiq_config JSONB                  -- Solver configuration used
```

### Integration Strategy

Create a TypeScript service that:
1. Calls Python subprocess to run Poetiq solver
2. Captures iteration data, generated code, and results
3. Maps results to standard explanation format
4. Stores everything in database with Poetiq-specific fields

### File Structure
```
server/
├── services/
│   └── poetiq/
│       └── poetiqService.ts       # TypeScript wrapper
└── python/
    └── poetiq_wrapper.py          # Python bridge script
```

---

## TODO

1. [ ] Create `poetiqService.ts` - TypeScript service wrapping Python execution
2. [ ] Create `poetiq_wrapper.py` - Bridge script for subprocess communication
3. [ ] Add Poetiq-specific database columns
4. [ ] Create API endpoint `/api/analyze/poetiq`
5. [ ] Add model config entries for Poetiq variants
6. [ ] Implement result capture and storage
7. [ ] Add iteration tracking for debugging/analysis
8. [ ] Document rate limiting and resource requirements

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| High API costs | High | Per-puzzle budget limits |
| Long execution times | Medium | Progress callbacks, timeout handling |
| Non-reproducible results | Medium | Log all iterations and random seeds |
| Sandbox security | Low | Subprocess isolation, no network |

---

## Success Criteria

1. Can run Poetiq solver on any puzzle in our database
2. Results stored in standard explanation format
3. Full iteration history preserved for audit
4. Cost/token tracking where possible
5. Side-by-side comparison with direct prediction methods possible
