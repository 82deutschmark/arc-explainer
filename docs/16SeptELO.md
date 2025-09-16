# LMArena-Style Elo Rating System Implementation Guide

**Date:** September 16, 2025
**Status:** In Development
**Project:** ARC Explainer - Head-to-Head Explanation Comparison System

## Overview
Implementation of an LMArena-style head-to-head comparison system where users compare AI explanations of ARC puzzles and vote for the better one. The system uses Elo ratings to rank explanations and models based on user preferences.

## 🚨 Critical Project Knowledge - DO NOT REINVENT

### Database Architecture (Drizzle ORM + PostgreSQL)
- **Schema Location:** `server/repositories/database/DatabaseSchema.ts`
- **Migration System:** Automatic on startup via `DatabaseSchema.initialize()`
- **Connection:** Uses connection pooling, falls back to in-memory if PostgreSQL unavailable
- **Table Creation:** All tables auto-create via `CREATE TABLE IF NOT EXISTS`
- **DO NOT:** Create separate migration files - add to existing schema methods

### Existing Components to REUSE
- **`AnalysisResultCard`**: Already displays explanations with predicted grids
- **`PuzzleGrid`**: Handles puzzle visualization with emoji/number toggle
- **`AnalysisResultContent`**: Shows strategy, patterns, hints
- **`AnalysisResultGrid`**: Displays predicted vs expected outputs
- **Layout System:** `PageLayout` with navigation already configured

### API Architecture Pattern
- **Location:** `server/controllers/` and `server/services/`
- **Pattern:** Controller → Service → Repository → Database
- **Response Format:** Standardized JSON with `success`, `data`, `message`, `timestamp`
- **Error Handling:** Centralized error middleware
- **DO NOT:** Create direct database queries in controllers

### Frontend Architecture
- **Router:** Wouter (not React Router)
- **State:** TanStack Query for server state
- **UI:** shadcn/ui + TailwindCSS
- **Hook Pattern:** Custom hooks in `client/src/hooks/`
- **Type Safety:** Shared types in `shared/types.ts`

## Implementation Checklist

### Phase 1: Database Schema ✅ IN PROGRESS
- [ ] Add Elo tables to `DatabaseSchema.ts`
  - [ ] `elo_ratings` table
  - [ ] `comparison_votes` table
  - [ ] `comparison_sessions` table
- [ ] Update `applySchemaMigrations()` for new columns if needed
- [ ] Test database initialization

### Phase 2: Backend API Endpoints
- [ ] Create `server/controllers/eloController.ts`
- [ ] Create `server/services/eloService.ts`
- [ ] Create `server/repositories/eloRepository.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/elo/comparison/:puzzleId?` - Get random explanation pairs
  - [ ] `POST /api/elo/vote` - Record vote and update ratings
  - [ ] `GET /api/elo/leaderboard` - Get rankings
  - [ ] `GET /api/elo/stats` - Statistics
- [ ] Add routes to `server/index.ts`

### Phase 3: Elo Algorithm Implementation
- [ ] Create `server/services/eloCalculator.ts`
- [ ] Implement standard Elo calculation (K-factor: 32 for new, 16 for established)
- [ ] Handle initial ratings (start at 1500)
- [ ] Update both explanation-level and model-level ratings
- [ ] Session management to prevent duplicate votes

### Phase 4: Frontend Components
- [ ] Create `client/src/pages/EloComparison.tsx` (model on PuzzleExaminer.tsx)
- [ ] Create `client/src/components/elo/ComparisonCard.tsx` (adapt AnalysisResultCard)
- [ ] Create `client/src/components/elo/VotingInterface.tsx`
- [ ] Create `client/src/hooks/useEloComparison.ts`
- [ ] Create `client/src/hooks/useEloVoting.ts`

### Phase 5: Data Filtering Logic
- [ ] Filter explanations with `predicted_output_grid IS NOT NULL`
- [ ] Include both correct and incorrect predictions
- [ ] Ensure model diversity in comparisons
- [ ] Handle puzzles with multiple test cases

### Phase 6: Integration
- [ ] Add route to `client/src/App.tsx`
- [ ] Add navigation link to `PageLayout`
- [ ] Update shared types in `shared/types.ts`
- [ ] Test end-to-end functionality

## Database Schema Specifications

### elo_ratings Table
```sql
CREATE TABLE elo_ratings (
  id SERIAL PRIMARY KEY,
  explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
  current_rating INTEGER DEFAULT 1500,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(explanation_id)
);
```

### comparison_votes Table
```sql
CREATE TABLE comparison_votes (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  puzzle_id VARCHAR(255) NOT NULL,
  explanation_a_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
  explanation_b_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
  winner_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
  rating_a_before INTEGER NOT NULL,
  rating_b_before INTEGER NOT NULL,
  rating_a_after INTEGER NOT NULL,
  rating_b_after INTEGER NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_winner CHECK (winner_id IN (explanation_a_id, explanation_b_id))
);
```

### comparison_sessions Table
```sql
CREATE TABLE comparison_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  total_votes INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoint Specifications

### GET /api/elo/comparison/:puzzleId?
**Purpose:** Get two explanations for head-to-head comparison
**Query Params:**
- `puzzleId` (optional): Specific puzzle, otherwise random
- `sessionId`: User session to prevent duplicates

**Response:**
```typescript
{
  success: true,
  data: {
    puzzleId: string,
    puzzle: PuzzleData,
    explanationA: ExplanationWithRating,
    explanationB: ExplanationWithRating,
    sessionId: string
  }
}
```

### POST /api/elo/vote
**Purpose:** Record user vote and update Elo ratings
**Body:**
```typescript
{
  sessionId: string,
  explanationAId: number,
  explanationBId: number,
  winnerId: number,
  puzzleId: string
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    newRatingA: number,
    newRatingB: number,
    ratingChangeA: number,
    ratingChangeB: number
  }
}
```

## Component Architecture

### EloComparison.tsx Structure
```
<Container>
  <Header with puzzle info />
  <PuzzleGrid with answer hidden />
  <ComparisonContainer>
    <ComparisonCard explanationA />
    <VotingInterface />
    <ComparisonCard explanationB />
  </ComparisonContainer>
  <SessionStats />
</Container>
```

### ComparisonCard.tsx (Adapted from AnalysisResultCard)
**Key Changes:**
- Remove correctness indicators (`is_prediction_correct` badges)
- Hide accuracy metrics
- Show predicted grid without diff highlighting
- Keep: strategy, patterns, hints, predicted output
- Add: current Elo rating display

## Data Flow Requirements

### Explanation Selection Algorithm
1. Filter explanations with `predicted_output_grid IS NOT NULL`
2. Prioritize explanations with fewer comparison votes (ensure fair sampling)
3. Avoid pairing explanations from same model when possible
4. Check session history to prevent duplicate comparisons
5. Ensure rating difference isn't too extreme (within 400 points when possible)

### Elo Calculation
```typescript
function calculateElo(ratingA: number, ratingB: number, outcome: 0 | 0.5 | 1): [number, number] {
  const kFactor = (games: number) => games < 30 ? 32 : 16;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  const newRatingA = ratingA + kFactor(gamesA) * (outcome - expectedA);
  const newRatingB = ratingB + kFactor(gamesB) * ((1 - outcome) - expectedB);

  return [Math.round(newRatingA), Math.round(newRatingB)];
}
```

## Critical Integration Points

### Existing Hook Patterns to Follow
- `usePuzzle(taskId)` - Fetch puzzle data
- `usePuzzleWithExplanation(taskId)` - Fetch explanations
- `useAnalysisResults()` - Complex analysis state management
- Pattern: Return `{ data, isLoading, error, refetch }`

### Type Definitions Required
Add to `shared/types.ts`:
```typescript
interface EloRating {
  id: number;
  explanationId: number;
  currentRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lastUpdated: string;
}

interface ComparisonVote {
  id: number;
  sessionId: string;
  puzzleId: string;
  explanationAId: number;
  explanationBId: number;
  winnerId: number;
  ratingABefore: number;
  ratingBBefore: number;
  ratingAAfter: number;
  ratingBAfter: number;
  createdAt: string;
}

interface ComparisonPair {
  puzzleId: string;
  puzzle: PuzzleData;
  explanationA: ExplanationData & { eloRating: EloRating };
  explanationB: ExplanationData & { eloRating: EloRating };
  sessionId: string;
}
```

### Navigation Integration
Add to `PageLayout.tsx` navigation:
```typescript
{ href: "/compare", label: "Compare Explanations", icon: Users }
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Database tables create successfully
- [ ] Comparison pairs load with valid explanations
- [ ] Voting updates ratings correctly
- [ ] Session management prevents duplicates
- [ ] UI components render explanation content properly
- [ ] Puzzle grids display without answer revelation
- [ ] Rating calculations match expected Elo formula

### Edge Cases to Handle
- [ ] No available explanation pairs for puzzle
- [ ] Only one explanation available for puzzle
- [ ] Database connection failures
- [ ] Invalid session IDs
- [ ] Concurrent vote submissions
- [ ] Rating overflow/underflow protection

## Performance Considerations

### Database Indexes Required
```sql
CREATE INDEX idx_elo_ratings_rating ON elo_ratings(current_rating DESC);
CREATE INDEX idx_elo_ratings_explanation ON elo_ratings(explanation_id);
CREATE INDEX idx_comparison_votes_session ON comparison_votes(session_id);
CREATE INDEX idx_explanations_predicted_grid ON explanations(id) WHERE predicted_output_grid IS NOT NULL;
```

### Caching Strategy
- Cache available explanation pairs for 5 minutes
- Cache model-level Elo rankings for 10 minutes
- Use TanStack Query stale-while-revalidate pattern

## Security Considerations

### Session Management
- Generate cryptographically secure session IDs
- Store minimal user information
- Implement rate limiting (max 100 votes per session per hour)
- Validate all explanation IDs exist and have required data

### Input Validation
- Sanitize all user inputs
- Validate winner_id matches one of the compared explanations
- Prevent manipulation of rating calculations
- Log suspicious voting patterns

## Future Enhancements

### Phase 2 Features (Future)
- [ ] Leaderboard page with detailed statistics
- [ ] Model-vs-model comparison modes
- [ ] Puzzle difficulty-based rating adjustments
- [ ] User accounts and persistent preferences
- [ ] Tournament-style comparison brackets
- [ ] API for external researchers to submit votes

### Analytics Integration
- [ ] Track voting patterns by puzzle difficulty
- [ ] Model performance correlation analysis
- [ ] User engagement metrics
- [ ] Export data for research publications

---

## ⚠️ DO NOT CREATE THESE (Already Exist)

### Database Infrastructure
- Connection pooling (already configured)
- Migration system (use existing DatabaseSchema pattern)
- Error handling middleware (already implemented)

### UI Components
- Grid visualization (PuzzleGrid component)
- Card layouts (AnalysisResultCard family)
- Loading states (existing patterns)
- Toast notifications (already configured)

### API Patterns
- Response formatting (standardized in controllers)
- Error codes (existing middleware)
- Logging (existing logger utility)

### Build/Deploy
- Docker configuration (already set up)
- Environment variables (already configured)
- Development server (port 5000 established)

Remember: This is a mature codebase with established patterns. Follow existing architecture rather than introducing new paradigms.