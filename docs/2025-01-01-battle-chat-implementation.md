# Battle Chat Feature Implementation Plan

## Overview
Implement a battle-chat system where multiple AI models compete to solve ARC-AGI puzzles and challenge each other's answers, similar to ModelCompare's battle-chat feature.

## Core Components

### 1. Backend Services
- **BattleChatService**: Orchestrates multi-model battles
- **ModelDebateService**: Manages model-to-model challenges and rebuttals
- **BattleSessionRepository**: Stores battle sessions, rounds, and outcomes
- **RealTimeService**: WebSocket integration for live battle updates

### 2. Database Schema
```sql
CREATE TABLE battle_sessions (
  id SERIAL PRIMARY KEY,
  puzzle_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  winner_model VARCHAR(100),
  total_rounds INTEGER DEFAULT 0
);

CREATE TABLE battle_rounds (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES battle_sessions(id),
  round_number INTEGER,
  model_name VARCHAR(100),
  response_type VARCHAR(50), -- 'solution', 'challenge', 'rebuttal'
  content TEXT,
  reasoning_log TEXT,
  predicted_output JSONB,
  confidence INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE battle_votes (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES battle_sessions(id),
  round_id INTEGER REFERENCES battle_rounds(id),
  voter_type VARCHAR(50), -- 'human', 'ai_judge'
  vote_target VARCHAR(100), -- model name
  vote_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Frontend Components
- **BattleChatPage**: Main battle interface
- **BattleArena**: Real-time chat-like interface
- **ModelParticipants**: Shows active models and their status
- **BattleControls**: Start battle, add models, voting interface
- **ResponseCard**: Individual model responses with challenge buttons
- **LiveScoreboard**: Real-time scoring and statistics

## Battle Flow

### Phase 1: Initial Solutions
1. User selects puzzle and 2-4 AI models
2. All models simultaneously attempt to solve the puzzle
3. Each model provides solution + reasoning
4. Solutions are displayed side-by-side

### Phase 2: Challenge Round
1. Models can challenge other models' solutions
2. Challenges include:
   - Point out logical flaws
   - Propose alternative interpretations
   - Question confidence levels
   - Suggest better approaches

### Phase 3: Rebuttal Round
1. Challenged models can respond to criticisms
2. Models can revise their original solutions
3. New evidence and reasoning can be presented

### Phase 4: Judgment
1. Human voting on best solution/reasoning
2. Optional AI judge model for automated scoring
3. Points awarded based on:
   - Solution correctness
   - Reasoning quality
   - Successful challenges
   - Effective rebuttals

## API Endpoints

```typescript
// Battle management
POST /api/battle/start
GET /api/battle/:sessionId
POST /api/battle/:sessionId/add-model
POST /api/battle/:sessionId/challenge
POST /api/battle/:sessionId/rebuttal
POST /api/battle/:sessionId/vote
GET /api/battle/:sessionId/leaderboard

// Real-time updates
WS /api/battle/:sessionId/live
```

## Implementation Steps

### Step 1: Database Setup
- Create migration for battle tables
- Set up repository classes
- Add battle-related types to shared/types.ts

### Step 2: Backend Services
- Implement BattleChatService for orchestration
- Create ModelDebateService for challenge logic
- Add WebSocket handlers for real-time updates
- Integrate with existing aiServiceFactory

### Step 3: API Controllers
- Battle controller with CRUD operations
- Challenge/rebuttal endpoints
- Voting and scoring endpoints

### Step 4: Frontend Components
- Create BattleChatPage with chat-like interface
- Implement real-time updates via WebSocket
- Add model selection and battle controls
- Create responsive battle arena layout

### Step 5: Advanced Features
- AI judge integration
- Battle history and statistics
- Tournament mode
- Export battle transcripts

## Technical Considerations

### Performance
- Use WebSockets for real-time updates
- Implement request queuing for multiple model calls
- Cache model responses to avoid redundant API calls

### UI/UX
- Chat-like interface similar to Discord/Slack
- Color-coded models for easy identification
- Animated typing indicators during model responses
- Mobile-responsive design

### Error Handling
- Graceful degradation when models fail
- Timeout handling for slow models
- Retry mechanisms for API failures

## Success Metrics
- Battle completion rate
- User engagement time
- Model performance insights
- Community feedback on solution quality