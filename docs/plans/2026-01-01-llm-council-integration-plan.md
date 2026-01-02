# LLM Council Integration Plan

**Date**: 2026-01-01
**Objective**: Replace existing `/debate` endpoint with llm-council to have multiple LLMs rate explanations in the ELO system
**Status**: Planning complete, ready for implementation

## Overview

### Current State
- **llm-council submodule**: Added at project root (`llm-council/`)
- **Existing `/elo` endpoint**: Users rate which of two explanations is better (or if both are bad)
- **Existing `/debate` endpoint**: Being replaced with council-based approach

### Goal
The llm-council (FastAPI service with 3-stage orchestration) will:
1. Receive two explanations (same ones presented to users on `/elo` page)
2. Ask the council the same question users get: "Which explanation is better, or are they both bad?"
3. Return aggregated voting results in ELO-compatible format
4. Become another "rater" in the leaderboard system (just like users are)

## Architecture Decision
- **Python Backend**: llm-council FastAPI service handles multi-LLM orchestration
- **TypeScript Bridge**: New `councilService.ts` wraps and orchestrates the Python backend
- **No Complex Conversion**: Council votes directly on explanations (no need to convert visual puzzles to text)

## Implementation Steps

### Phase 1: Understand Existing System

**Task 1.1**: Find `/elo` endpoint
- Search for "elo" in `server/controllers/` or similar
- File to find: Route that handles explanation rating
- What to understand:
  - How are explanations retrieved?
  - What's the data structure (explanation object)?
  - What voting options exist? (A better, B better, tie, both bad, etc.)
  - How are votes recorded in database?
  - How is ELO updated?

**Task 1.2**: Find `/debate` endpoint
- Search for "debate" in `server/controllers/`
- What does it currently do?
- What endpoint signature should we preserve?

**Task 1.3**: Understand explanation data model
- Look in `shared/types.ts` or database schema
- What fields does an explanation have?
- How are puzzle + explanations linked?

### Phase 2: Backend Implementation

**Task 2.1**: Create `server/services/council/councilService.ts`
```
Purpose:
- Wrap llm-council backend
- Convert two explanations into a question string
- Call llm-council stages
- Parse results and convert to ELO vote format

Imports needed:
- pythonBridge (or similar pattern used for Saturn/Grover)
- Services from llm-council/backend/council.py

Method signature:
async rateExplanations(
  puzzle: ArcPuzzle,
  explanation1: Explanation,
  explanation2: Explanation
): Promise<CouncilVote>

Where CouncilVote = {
  winner: 'explanation1' | 'explanation2' | 'tie' | 'both_bad',
  confidence: number,
  reasoning: string,
  stage1_responses: Record<string, string>,  // Model -> response
  stage2_rankings: Record<string, string[]>, // Model -> ranked order
  stage3_synthesis: string
}
```

**Task 2.2**: Create `server/controllers/councilController.ts`
```
Endpoint: POST /api/council/rate-explanations

Request body:
{
  puzzleId: string,
  explanation1Id: string,
  explanation2Id: string
}

Response: CouncilVote (from Task 2.1)

Pattern:
- Fetch explanations from DB
- Call councilService.rateExplanations()
- Return result
- (Optional) Save council vote to database for audit trail
```

**Task 2.3**: Environment Configuration
- Ensure `OPENROUTER_API_KEY` is in `.env`
- Test that llm-council can access it
- May need to add council-specific config:
  - `COUNCIL_MODELS` (which models participate)
  - `CHAIRMAN_MODEL` (final synthesis model)
  - `REASONING_EFFORT` (medium or high)

### Phase 3: Database (if needed)

**Task 3.1**: Track Council Votes
- Add table or column to record council votes alongside user votes
- Fields: puzzle_id, explanation1_id, explanation2_id, council_vote, timestamp
- Or integrate into existing vote table with voter_type = 'council'

**Task 3.2**: Update ELO Calculation
- Ensure council votes are counted in ELO system
- Treat council as one "user" or aggregate votes appropriately
- Update leaderboard query if needed

### Phase 4: Frontend (if applicable)

**Task 4.1**: Find UI that calls `/debate`
- Search for API calls to `/debate` endpoint
- Update to call `/api/council/rate-explanations` instead
- Display council voting results appropriately

**Task 4.2**: (Optional) Add Council Rating Display
- Show which explanation council preferred
- Show confidence level
- Show reasoning/synthesis from stage 3

## Key Implementation Details

### Explanation to Question Format
Convert explanations into a question the council can understand:
```
"You are rating two explanations for an ARC visual puzzle solution.

Puzzle Description: [puzzle description if available]

Explanation A:
[explanation1.text]

Explanation B:
[explanation2.text]

Which explanation is better at describing the puzzle solution?
- Explanation A is better
- Explanation B is better
- Both are equally good
- Both are inadequate"
```

### Vote Aggregation Strategy
From llm-council's 3 stages, derive a single vote:
- Stage 1: Each model votes
- Stage 2: Models rank each other's responses
- Stage 3: Chairman synthesizes final verdict
- **Result**: Use stage3_synthesis to determine winner

### Error Handling
- If council cannot reach consensus: return 'tie'
- If all models rate both bad: return 'both_bad'
- If API rate limits hit: queue for retry or fallback to user votes
- Log all failures for debugging

## Critical Files to Create/Modify

| File | Type | Purpose |
|------|------|---------|
| `server/services/council/councilService.ts` | Create | Main service wrapper |
| `server/controllers/councilController.ts` | Create | API endpoints |
| `server/services/council/councilBridge.ts` | Create | Python subprocess bridge (if needed) |
| `server/config/models.ts` | Modify | Register council models (if not auto-discovered) |
| `shared/types.ts` | Modify | Add CouncilVote type |
| Database migrations | Create | Add council vote tracking (if needed) |
| `CHANGELOG.md` | Modify | Document changes |

## Dependencies & Configuration

**Already Available**:
- OPENROUTER_API_KEY environment variable
- Python 3.10+
- Node.js/TypeScript setup

**Needs Verification**:
- Python packages: fastapi>=0.115, uvicorn>=0.32, httpx>=0.27, pydantic>=2.9
- Install via: `cd llm-council && uv sync` or `pip install -r requirements.txt` (if exists)

**Configuration Options** (set in `.env` or use defaults):
- `COUNCIL_MODELS`: Comma-separated list (defaults in llm-council/backend/)
- `CHAIRMAN_MODEL`: Synthesis model
- `REASONING_EFFORT`: 'medium' or 'high'

## Testing Checklist

- [ ] Can import llm-council backend functions
- [ ] councilService.rateExplanations() executes without errors
- [ ] Returns proper CouncilVote structure
- [ ] API endpoint POST /api/council/rate-explanations works
- [ ] Council votes appear in ELO system correctly
- [ ] Streaming works (if applicable)
- [ ] Error cases handled gracefully
- [ ] Database records council votes (if implemented)

## Next Steps for Next Assistant

1. **Start with Phase 1**: Find the existing `/elo` and `/debate` endpoints
2. **Understand the flow**: How do explanations get rated now?
3. **Build Phase 2**: Implement councilService and controller
4. **Test thoroughly**: Make sure votes integrate with ELO
5. **Update CHANGELOG.md**: Document the changes (SemVer, what/why/how)

## Questions for Implementation

If unclear during implementation:
1. Are council votes treated as one "user" or multiple votes?
2. Should council votes be weighted differently than user votes?
3. Do we need to store council reasoning for audit/display?
4. Should there be a UI indicator that a rating came from the council?
5. What happens if llm-council service fails? Fallback to random? Skip?

## Author Notes

- This is simpler than the original ARC-task-debate idea because explanations are text-based (no grid conversion needed)
- The council becomes a "super-rater" in your existing ELO system
- Follow CLAUDE.md SRP/DRY principles: reuse existing patterns from Grover/Saturn if applicable
- Production-ready code only: no mocks, no placeholders
