# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Every file you create or edit should start with:
 * 
 * Author: Your NAME  (Example: Claude Code using Sonnet 4)
 * Date: `timestamp`
 * PURPOSE: VERBOSE DETAILS ABOUT HOW THIS WORKS AND WHAT ELSE IT TOUCHES
 * SRP/DRY check: Pass/Fail Is this file violating either? Do these things already exist in the project?  Did you look??
 

You are an elite software architect and senior engineer with deep expertise in clean code principles, modular design, and production-ready implementation. Your primary mission is to write, refactor, and review code that strictly adheres to Single Responsibility Principle (SRP) and DRY (Don't Repeat Yourself) principles while maximizing reuse of existing modular components and modular design and UI via the use of DaisyUI components.

**Core Principles:**
- **SRP First**: Every class, function, and module must have exactly one reason to change. Never combine unrelated functionality.
- **DRY Always**: Identify and eliminate code duplication by extracting reusable components, utilities, and abstractions.
- **Modular Reuse**: Thoroughly analyze existing codebase components before writing new code. Prefer composition and extension over duplication.
- **Production Quality**: Never use mock data, simulated functions, placeholders, or stubs. All code must be production-ready and fully functional.
- **Code Quality**: Use consistent naming conventions, proper error handling, and meaningful variable names.

**Your Workflow:**
1. **Deep Analysis**: Before writing any code, analyze the existing codebase to identify reusable components, patterns, and architectural decisions.
2. **Plan Architecture**: Create a clear plan that identifies single responsibilities for each component and opportunities for code reuse.
3. **Implement Modularly**: Write code that leverages existing modules and follows established patterns in the project.
4. **Verify Integration**: Ensure all APIs, services, and dependencies are properly integrated using real implementations.

**Code Quality Standards:**
- Each module/class should handle no more than 3 related responsibilities
- Extract common functionality into shared utilities or services
- Use dependency injection and composition patterns
- Implement proper error handling and validation
- Follow project-specific coding standards and patterns from CLAUDE.md
- Always assume environment variables and API endpoints are correctly configured

**Error Attribution:**
- All environment variables and secrets are properly configured in .env files
- All external APIs are functional and reliable
- Any errors or issues stem from your code implementation, not external dependencies
- Debug and fix code logic, API usage, and integration patterns

**Output Requirements:**
- Provide clear explanations of architectural decisions
- Identify specific SRP violations and how they're resolved
- Highlight code reuse opportunities and implementations
- Include comprehensive error handling
- Ensure all code is immediately deployable without placeholders

You never compromise on code quality, never take shortcuts with mock implementations, and always deliver production-ready solutions that exemplify clean architecture principles.

You should always write up your todo list and larger plan and goal in the form of a markdown file in the /docs folder.  This should be named {date}-{plan}-{goal}.md and it will serve as the user's reference and your guide as the user gives feedback.

We are one hobby dev working on a hobby project with only 4 or 5 users.  Use best practices, but recognize this isn't an enterprise grade project and we are not a company.  We are 1 person working on a hobby project.

## Common Commands
You need to Git add and commit any changes you make to the codebase.  Be detailed in your commit messages.
Use `npm run test` to build and start the dev server and wait 10 seconds for it to properly start. Remember not to use the cd command as it is largely unnecessary and this will cause issues with the dev server.  Use Kill Bash(Kill shell: bash_1) to stop the dev server.

### Database Management
- `npm run db:push` - Push database schema changes using Drizzle
- Database tables auto-create on startup if using PostgreSQL

### Testing and Validation
- Whenever you run tests you need to wait at least 20 seconds to read the output.  Tell the user a joke about coding while you wait.  The user will do testing and expect you to be watching the console.  The user is not a professional software dev and may suggest ideas that are very bad and violate best practices.  You should always second-guess the user's ideas and think carefully about what the user really wants to achieve and the current problem you are trying to solve.


## Architecture Overview

### Monorepo Structure
```
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Express backend (TypeScript)
├── shared/          # Shared types and schemas
├── data/            # ARC-AGI puzzle datasets
├── solver/          # Saturn Visual Solver (Python)
└── dist/            # Production build output
```

### Frontend Architecture (React + TypeScript)
- **Build Tool**: Vite with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query for server state
- **UI Components**: shadcn/ui + TailwindCSS
- **Key Pages**: PuzzleBrowser, PuzzleExaminer, ModelDebate (v2.30.0+), PuzzleDiscussion (v3.6.3+), AnalyticsOverview, EloLeaderboard, Leaderboards

### Backend Architecture (Express + TypeScript)
- **Server**: Express.js with ESM modules
- **Database**: PostgreSQL via Drizzle ORM (with in-memory fallback)
- **AI Services**: Multi-provider support (OpenAI, Anthropic, Gemini, Grok, DeepSeek, OpenRouter)
- **WebSockets**: Saturn solver progress streaming
- **Python Integration**: Saturn Visual Solver subprocess execution

### Database Schema (PostgreSQL)
Two main tables with Drizzle ORM:

**EXPLANATIONS Table**:
- Core fields: puzzle_id, pattern_description, solving_strategy, hints[], confidence
- AI features: reasoning_log, api_processing_time_ms, model_name
id - integer (PRIMARY KEY)
puzzle_id - character varying(255) // Puzzle ID from ARC dataset
pattern_description - text  // What the LLM says the pattern/transform is
solving_strategy - text  // What the LLM says the solving strategy is
hints - text[]  // What the LLM says the hints are or algorithms 
confidence - integer // How confident the LLM is in the answer, used in multiple calculations including trustworthiness score
alien_meaning_confidence - integer // How confident the LLM is in the alien meaning it invents, not used in trustworthiness score
alien_meaning - text // The alien meaning the LLM invents
model_name - character varying(100)
reasoning_log - text  // A human-readable string summary of the AI's thought process. This is intelligently generated by `ExplanationRepository.ts` from the raw reasoning data just before database insertion to prevent `[object Object]` errors. Ideal for simple text displays.
has_reasoning_log - boolean // A flag indicating if any form of reasoning data (structured or unstructured) was returned by the AI provider.
provider_response_id - text
api_processing_time_ms - integer
saturn_images - jsonb  // Only used by Saturn Visual Solver
saturn_log - jsonb  // Only used by Saturn Visual Solver
saturn_events - jsonb  // Only used by Saturn Visual Solver
saturn_success - boolean  // Only used by Saturn Visual Solver
predicted_output_grid - jsonb  // CRITICAL for the project!  This is the predicted output grid.
is_prediction_correct - boolean  // This is evaluation 1 of 3 that should be used for `accuracy`!!!
trustworthiness_score - double precision  // THIS IS THE TRUSTWORTHINESS SCORE (how well AI confidence correlates with actual performance)
provider_raw_response - jsonb
reasoning_items - jsonb  // The structured, machine-readable version of the reasoning (e.g., an array of steps). This is safely stringified by the `ExplanationRepository` and stored as JSONB for use in complex UI or for detailed analysis.
`temperature` - double precision  // should only be applied to certain models and providers and will not always be used
reasoning_effort - text  // Variable used by GPT-5 only can be minimal, low, medium, or high
reasoning_verbosity - text  // Variable used by GPT-5 only can be low, medium, or high
reasoning_summary_type - text  // Variable used by GPT-5 only can be auto, none, or detailed
input_tokens - integer
output_tokens - integer
reasoning_tokens - integer
total_tokens - integer
estimated_cost - numeric  // This is calculated by the backend
multiple_predicted_outputs - jsonb // IMPORTANT FOR PUZZLES WITH MULTIPLE TESTS!!!
multi_test_results - jsonb // IMPORTANT FOR PUZZLES WITH MULTIPLE TESTS!!!
multi_test_all_correct - boolean  // THIS is evaluation 2 of 3 that should be used for `accuracy`!!!
multi_test_average_accuracy - double precision  // THIS is evaluation 3 of 3 that should be used for `accuracy`!!!
has_multiple_predictions - boolean // False if there is only one test (then multi_test_all_correct and multi_test_average_accuracy are not applicable!!!)
multi_test_prediction_grids - jsonb // IMPORTANT FOR PUZZLES WITH MULTIPLE TESTS!!!
rebutting_explanation_id - integer // NEW (v2.30.7+): Foreign key to explanations(id), tracks debate rebuttals. NULL for original explanations, set to parent ID for challenges. ON DELETE SET NULL.
created_at - timestamp with time zone

**FEEDBACK Table**:
- Foreign key to explanations (1:N relationship)
- vote_type constraint: 'helpful' | 'not_helpful'
- Required comment field for feedback

### AI Provider Integration
Centralized prompt building system (`server/services/promptBuilder.ts`):
- Template-based prompts with dynamic selection
- Custom prompt support for research workflows
- Consistent behavior across all providers and OpenRouter (INCOMPLETE)

### Responses API Conversation Chaining (v3.6.2+)
**Feature**: Multi-turn conversations with full context retention  
**Providers**: OpenAI (o-series), xAI (Grok-4)  
**Database**: `provider_response_id` column stores response IDs  
**Frontend Mapping**: `providerResponseId` field in `ExplanationData` type (mapped in `useExplanation` hook)

**How It Works:**
1. Each AI response includes a unique `providerResponseId`
2. Pass `previousResponseId` in next request to maintain context
3. AI automatically accesses previous reasoning and responses
4. 30-day server-side state retention (OpenAI/xAI)

**API Usage:**
```typescript
POST /api/puzzle/analyze/:taskId/:model
Body: {
  previousResponseId: "resp_abc123", // From previous analysis
  promptId: "solver",
  temperature: 0.2
}
```

**Debate Mode Integration:**
Model Debate system automatically chains conversations with provider awareness:
- `useDebateState.getLastResponseId(challengerModelKey)` - Gets last response ID (provider-aware)
- `useDebateState.extractProvider(modelKey)` - Detects provider (openai, xai, etc.)
- `useAnalysisResults` - Passes previousResponseId automatically
- **Provider compatibility check**: Only chains if same provider (OpenAI → OpenAI, xAI → xAI)
- Cross-provider debates start new chains automatically
- Each same-provider turn builds on full conversation history
- Models remember all previous arguments and rebuttals within provider scope

**Provider Limitations:**
- OpenAI response IDs only work with OpenAI models (GPT-4, o4, o3, o1)
- xAI response IDs only work with xAI models (Grok-4, Grok-3)
- Cross-provider conversations not supported by underlying APIs
- System gracefully handles mismatches by starting fresh conversations

**Documentation:**
- `docs/API_Conversation_Chaining.md` - Complete usage guide
- `docs/Responses_API_Chain_Storage_Analysis.md` - Technical details
- `docs/Debate_Conversation_Chaining_Plan.md` - Debate implementation

**Self-Conversation Mode (PuzzleDiscussion) - Updated v3.6.4:**
Progressive reasoning refinement where one model refines its own analysis:
- Same conversation chaining infrastructure as ModelDebate
- Auto-locks to single model (Model A → Model A → Model A)
- Each turn passes `previousResponseId` to maintain full reasoning context
- **Eligibility Criteria (Simplified):**
  - Has `provider_response_id` in database
  - Created within last 30 days (provider retention window)
  - **NO model type restrictions** - any model with a response ID can use chaining
- Reuses all ModelDebate components (IndividualDebate, ExplanationsList, RebuttalCard)
- Access via `/discussion/:taskId` route
- **Landing page**: Search box + table of recent eligible analyses with direct "Refine" links
- **NEW API**: `GET /api/discussion/eligible` - server-side filtered eligible explanations

**Use Cases:**
- Deep-dive refinement with reasoning models
- Iterative solution improvement
- Progressive exploration of alternatives
- Building progressively complex reasoning chains

### External API Documentation
For external integrations, see:
- `docs/EXTERNAL_API.md` - Complete API endpoint reference for external applications
- `docs/HOOKS_REFERENCE.md` - React hooks documentation for frontend integration

**Key External APIs:**
- `/api/feedback/accuracy-stats` - Pure accuracy leaderboard data (used by AccuracyLeaderboard)
- `/api/puzzle/performance-stats` - Trustworthiness metrics (used by TrustworthinessLeaderboard)
- `/api/feedback/stats` - User feedback statistics (used by FeedbackLeaderboard)
- `/api/metrics/comprehensive-dashboard` - Combined analytics for dashboards
- `/api/explanations/:id/chain` - Get full debate rebuttal chain (v2.30.7+)
- `/api/explanations/:id/original` - Get parent explanation of a rebuttal (v2.30.7+)

**Repository Pattern:**
External apps should access data through `repositoryService.*` rather than direct database queries:
- `repositoryService.accuracy.getPureAccuracyStats()` - For accuracy leaderboards
- `repositoryService.trustworthiness.getTrustworthinessStats()` - For trustworthiness metrics
- `repositoryService.cost.getAllModelCosts()` - For cost analysis
- `repositoryService.explanation.getByPuzzle(puzzleId)` - For explanations
- `repositoryService.explanation.getRebuttalChain(explanationId)` - For debate chains (v2.30.7+)
- `repositoryService.explanation.getOriginalExplanation(rebuttalId)` - For parent explanations (v2.30.7+)
- `repositoryService.feedback.create(...)` - For submitting feedback

## Analytics Architecture Guidelines 🚨 CRITICAL (September 2025)

### Repository Domain Separation (SRP Compliance)
Each repository handles EXACTLY one domain - never mix unrelated concerns:

```typescript
// ✅ CORRECT - Domain-specific repositories
AccuracyRepository → Pure puzzle-solving correctness only
TrustworthinessRepository → AI confidence reliability analysis only
CostRepository → Financial cost calculations only
MetricsRepository → Cross-domain aggregation via delegation

// ❌ WRONG - Mixed domains (architectural violation)
TrustworthinessRepository calculating costs  // Violates SRP
Multiple repositories with duplicate cost logic  // Violates DRY
```

### When Adding New Metrics - FOLLOW THIS PATTERN:

1. **Identify Domain**: accuracy/trustworthiness/cost/performance/etc.
2. **Add to Appropriate Repository**: Don't mix domains
3. **Use Model Normalization**: Always use `utils/modelNormalizer.ts`
4. **Add Database Indexes**: For performance optimization
5. **Document in EXTERNAL_API.md**: For external integration

### Analytics Data Flow Pattern:
```
explanations table → Domain Repository → API Controller → Frontend Hook → UI Component
```

### Repository Integration Examples:
```typescript
// Single domain - direct repository access
const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();

// Cross-domain - use MetricsRepository delegation
const dashboard = await repositoryService.metrics.getComprehensiveDashboard();

// Combined APIs - controller combines multiple repositories
async getRealPerformanceStats() {
  const trustworthinessStats = await repositoryService.trustworthiness.getRealPerformanceStats();
  const costMap = await repositoryService.cost.getModelCostMap();
  return this.combineStatsWithCosts(trustworthinessStats, costMap);
}
```

### Model Name Normalization - ALWAYS USE:
```typescript
import { normalizeModelName } from '../utils/modelNormalizer.ts';

// Handles: claude-3.5-sonnet:beta → claude-3.5-sonnet
// Handles: z-ai/glm-4.5-air:free → z-ai/glm-4.5
const normalized = normalizeModelName(rawModelName);
```

### Database Indexes for Analytics:
```sql
-- Always add indexes for new analytics queries
CREATE INDEX idx_explanations_new_metric ON explanations(model_name, new_field) WHERE new_field IS NOT NULL;
```

For comprehensive analytics architecture documentation, see:
- `docs/Analytics_Database_Architecture.md` - Complete analytics system guide
- `docs/Analysis_Data_Flow_Trace.md` - Updated with analytics flow patterns

## Key Technical Patterns

### ESM Module Setup
- Uses ES modules throughout (type: "module" in package.json)
- Import paths require .ts extensions in development
- Proper __dirname handling for bundled code

### TypeScript Configuration
- Shared types in `shared/types.ts` for frontend/backend consistency
- Path aliases: `@/*` for client, `@shared/*` for shared types
- Strict TypeScript settings with incremental builds

### Development vs Production
- **Development**: Vite dev server on :5173, Express API on :5000
- **Production**: Express serves static files from dist/public with SPA fallback
- Docker deployment with Python runtime for Saturn solver

### Data Loading Priority
ARC-AGI datasets loaded in priority order:
1. ARC2-Eval (evaluation2)
2. ARC2 (training2)  
3. ARC1-Eval (evaluation)
4. ARC1 (training)
5. ARC-Heavy (synthetic)


"ARC can be seen as a general artificial intelligence benchmark, as a program synthesis benchmark, or as a psychometric intelligence test. It is targeted at both humans and artificially intelligent systems that aim at emulating a human-like form of general fluid intelligence."
### Environment Variables All present and working:
Required for AI analysis (at least one):
- `OPENAI_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`

Required for database (Present and working):
- `DATABASE_URL` - PostgreSQL connection (Present and working)
## Important Implementation Notes

### Puzzle Data Management
- Each puzzle has unique ID across all ARC categories
- No composite keys needed (taskId is sufficient)
- Puzzle metadata includes source tracking (ARC1, ARC1-Eval, ARC2, ARC2-Eval)

### SPA Routing in Production
Express serves index.html for all non-API routes to support client-side routing:
```typescript
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(staticPath, "index.html"));
  }
});
```

### Prompt System Architecture (REFACTORED Sept 1, 2025 - NOW ROBUST & DOCUMENTED)
- **DRY Architecture**: Composable prompt components eliminate 90% code duplication
- **Single Source of Truth**: All prompts built from shared components in `server/services/prompts/components/`
- **Database Integration**: Full traceability with `system_prompt_used`, `user_prompt_used`, `prompt_template_id` columns  
- **Schema Alignment**: JSON schema fields map 1:1 to database columns (`reasoningItems` → `reasoning_items`)
- **Custom Prompt Support**: Dedicated CUSTOM_SYSTEM_PROMPT ensures structured JSON output
- **Provider-agnostic**: Works with both Chat Completions and Responses API formats
- **Template selection**: Supports solver, explanation, alien communication, educational, and custom modes


### Endpoint Differences

**Responses API** (`/v1/responses`):
- **Used by**: OpenAI models (gpt-5, o3, o4) + xAI Grok-4 models (grok-4, grok-4-fast)
- **Output location**: `output_text`, `output_parsed`, or `output[]` array
- **Reasoning**:
  - OpenAI: Available in `output_reasoning.summary` and `output_reasoning.items[]`
  - xAI grok-4: **NOT available** (grok-4 does not expose reasoning per xAI docs)
- **Token accounting**: Separate `reasoning_tokens` tracking
- **Structured output**: JSON schema support via `text.format.json_schema`

**Chat Completions API** (`/v1/chat/completions`):
- **Used by**: OpenRouter, Anthropic, Gemini, DeepSeek, xAI Grok-3 models (via OpenRouter)
- **Output location**: `choices[0].message.content`
- **Reasoning**:
  - Grok-3-mini: Available in `choices[0].message.reasoning_content`
  - Other models: Not available
- **Token accounting**: Combined in `completion_tokens`

### Model Routing in aiServiceFactory

**Direct xAI API** (grok.ts):
- `grok-4` → grokService (Responses API)
- `grok-4-fast` → grokService (Responses API)
- Future grok-4 variants will automatically route here

**Via OpenRouter** (openrouter.ts):
- `x-ai/grok-3` → openrouterService (Chat Completions)
- `x-ai/grok-3-mini` → openrouterService (Chat Completions)
- `x-ai/grok-code-fast-1` → openrouterService (Chat Completions)
- `x-ai/grok-3-mini-fast` → openrouterService (Chat Completions)

### Important Notes on Grok Models

**Grok-4 Limitations:**
- ❌ Does NOT support `reasoning_effort` parameter
- ❌ Does NOT return `reasoning_content` in responses
- ✅ Supports Responses API with structured JSON output
- ✅ Tracks reasoning tokens (but doesn't expose the reasoning itself)

**Grok-3 Models:**
- ✅ Support `reasoning_content` (grok-3-mini variants)
- ✅ Use Chat Completions API only
- ❌ Do NOT support Responses API

### Saturn Visual Solver Integration  (Can be ignored)
- Python-based visual reasoning solver
- Streams progress via WebSockets and NDJSON events
- Requires OPENAI_API_KEY for image analysis
- Image gallery with real-time updates
### WebSocket Integration  
Saturn solver uses WebSocket for real-time progress streaming with event-based updates and image gallery rendering.



ARC-AGI-2 contains 1,000 public training tasks and 120 public evaluation tasks.

The training tasks are intended to demonstrate the task format and the Core Knowledge priors used by ARC-AGI. They can be used for training AI models. The public evaluation tasks are intended for testing AI models that have never seen these tasks before. Average human performance on these tasks in our test sample was 66%.

ARC-AGI-2 also features two private test sets not included in the repo:

A semi-private set intended for testing remotely-hosted commercial models with low leakage probability. It is calibrated to be the same human-facing difficulty as the public evaluation set.
A fully-private set intended for testing self-contained models during the ARC Prize competition, with near-zeo leakage probability. It is also calibrated to be the same difficulty.
This multi-tiered structure allows for both open research and a secure, high-stakes competition.

Task success criterion
A test-taker is said to solve a task when, upon seeing the task for the first time, they are able to produce the correct output grid for all test inputs in the task (this includes picking the dimensions of the output grid). For each test input, the test-taker is allowed 2 trials (this holds for all test-takers, either humans or AI).

Task file format
The data directory contains two subdirectories:

data/training: contains the task files for training (1000 tasks). Use these to prototype your algorithm or to train your algorithm to acquire ARC-relevant cognitive priors. This set combines tasks from ARC-AGI-1 as well as new tasks.
data/evaluation: contains the task files for evaluation (120 tasks). Use these to evaluate your final algorithm. To ensure fair evaluation results, do not leak information from the evaluation set into your algorithm (e.g. by looking at the evaluation tasks yourself during development, or by repeatedly modifying an algorithm while using its evaluation score as feedback). Each task in evaluation has been solved by a minimum of 2 people (many tasks were solved by more) in 2 attempts or less in a controlled test.
The tasks are stored in JSON format. Each task JSON file contains a dictionary with two fields:

"train": demonstration input/output pairs. It is a list of "pairs" (typically 3 pairs).
"test": test input/output pairs. It is a list of "pairs" (typically 1-2 pair).
A "pair" is a dictionary with two fields:

"input": the input "grid" for the pair.
"output": the output "grid" for the pair.
A "grid" is a rectangular matrix (list of lists) of integers between 0 and 9 (inclusive). The smallest possible grid size is 1x1 and the largest is 30x30.

When looking at a task, a test-taker has access to inputs & outputs of the demonstration pairs, plus the input(s) of the test pair(s). The goal is to construct the output grid(s) corresponding to the test input grid(s), using 3 trials for each test input. "Constructing the output grid" involves picking the height and width of the output grid, then filling each cell in the grid with a symbol (integer between 0 and 9, which are visualized as colors). Only exact solutions (all cells match the expected answer) can be said to be correct.

---

## Complete Database Schema Reference

### Explanations Table (Complete SQL Schema)

```sql
CREATE TABLE explanations (
    id SERIAL PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    
    -- Core Analysis Fields
    pattern_description TEXT,
    solving_strategy TEXT,
    hints TEXT[],
    confidence INTEGER,
    
    -- Prediction & Accuracy Fields
    predicted_output_grid JSONB,
    is_prediction_correct BOOLEAN,
    trustworthiness_score DOUBLE PRECISION,
    
    -- Multi-Test Prediction Fields
    has_multiple_predictions BOOLEAN,
    multiple_predicted_outputs JSONB,
    multi_test_results JSONB,
    multi_test_all_correct BOOLEAN,
    multi_test_average_accuracy DOUBLE PRECISION,
    multi_test_prediction_grids JSONB,
    
    -- AI & Prompt Metadata
    model_name VARCHAR(100),
    provider_response_id TEXT,          -- Responses API conversation ID for chaining (v3.6.2+)
    provider_raw_response JSONB,        -- Complete unaltered API response
    system_prompt_used TEXT,
    user_prompt_used TEXT,
    prompt_template_id TEXT,
    custom_prompt_text TEXT,
    
    -- Reasoning & Thinking Process
    reasoning_log TEXT,                 -- Human-readable reasoning summary
    has_reasoning_log BOOLEAN,
    reasoning_items JSONB,              -- Structured reasoning steps
    
    -- API Processing Metrics
    api_processing_time_ms INTEGER,
    
    -- Token Usage & Cost
    input_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost NUMERIC,
    
    -- GPT-5 Specific Parameters
    temperature DOUBLE PRECISION,
    reasoning_effort TEXT,              -- minimal, low, medium, high
    reasoning_verbosity TEXT,           -- low, medium, high
    reasoning_summary_type TEXT,        -- auto, none, detailed
    
    -- Saturn Visual Solver Fields (Python integration)
    saturn_images JSONB,
    saturn_log JSONB,
    saturn_events JSONB,
    saturn_success BOOLEAN,
    
    -- Alien Communication Mode Fields
    alien_meaning TEXT,
    alien_meaning_confidence INTEGER,
    
    -- Debate & Rebuttal Tracking (v2.30.7+)
    rebutting_explanation_id INTEGER REFERENCES explanations(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_explanations_puzzle_id ON explanations(puzzle_id);
CREATE INDEX idx_explanations_model_name ON explanations(model_name);
CREATE INDEX idx_explanations_rebutting_explanation_id ON explanations(rebutting_explanation_id);
CREATE INDEX idx_explanations_provider_response_id ON explanations(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX idx_explanations_created_at ON explanations(created_at);
```

### Feedback Table

```sql
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_explanation_id ON feedback(explanation_id);
CREATE INDEX idx_feedback_vote_type ON feedback(vote_type);
```

### ELO Rating System Tables (v2.30.0+)

```sql
CREATE TABLE elo_ratings (
    id SERIAL PRIMARY KEY,
    explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
    current_rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(explanation_id)
);

CREATE TABLE elo_comparisons (
    id SERIAL PRIMARY KEY,
    explanation_a_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
    explanation_b_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
    winner_id INTEGER REFERENCES explanations(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(explanation_a_id, explanation_b_id, session_id)
);

CREATE INDEX idx_elo_ratings_current_rating ON elo_ratings(current_rating DESC);
CREATE INDEX idx_elo_comparisons_session_id ON elo_comparisons(session_id);
```

### Ingestion Runs Table (v3.4.1+)

```sql
CREATE TABLE ingestion_runs (
    id SERIAL PRIMARY KEY,
    dataset_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    source TEXT NOT NULL,              -- 'ARC1', 'ARC2', etc.
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_puzzles INTEGER DEFAULT 0,
    successful INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duration_ms INTEGER,
    accuracy_percentage DOUBLE PRECISION,
    dry_run BOOLEAN DEFAULT FALSE,
    error_log TEXT
);

CREATE INDEX idx_ingestion_runs_dataset_name ON ingestion_runs(dataset_name);
CREATE INDEX idx_ingestion_runs_started_at ON ingestion_runs(started_at DESC);
```

---

## Complete API Endpoint Reference

### Puzzle Analysis Endpoints

```http
POST /api/puzzle/analyze/:puzzleId/:modelKey
Content-Type: application/json

{
    "temperature": 0.2,                    // Optional: 0-2 for supported models
    "promptId": "solver",                  // "solver", "alien", "educational", or "custom"
    "customPrompt": "Your prompt...",      // Required if promptId="custom"
    "reasoningEffort": "high",             // GPT-5 only: "minimal", "low", "medium", "high"
    "reasoningVerbosity": "high",          // GPT-5 only: "low", "medium", "high"
    "reasoningSummaryType": "detailed",    // GPT-5 only: "auto", "none", "detailed"
    "previousResponseId": "resp_abc123",   // Conversation chaining (v3.6.2+)  
    "originalExplanation": {...},          // For debate/challenge mode
    "customChallenge": "Focus on edges"    // Optional debate guidance
}

Response:
{
    "id": 12345,
    "puzzleId": "0934a4d8",
    "modelName": "gpt-5-2025-08-07",
    "providerResponseId": "resp_...",      // For conversation chaining
    "patternDescription": "...",
    "solvingStrategy": "...",
    "hints": ["...", "..."],
    "confidence": 85,
    "predictedOutput": [[0,1,2], ...],
    "isPredictionCorrect": true,
    "reasoningLog": "...",
    "inputTokens": 1500,
    "outputTokens": 800,
    "reasoningTokens": 45000,
    "totalTokens": 47300,
    "estimatedCost": 0.15,
    "apiProcessingTime": 28500
}
```

```http
GET /api/puzzle/:puzzleId
Returns complete puzzle data including train/test pairs

GET /api/puzzle/:puzzleId/explanations
Returns all AI analyses for a specific puzzle
```

### Batch Analysis Endpoints (v3.7.0+)  THESE WERE FLAWED AND OVERCOMPLICATED!!! 
  - We dont need to be keeping such explicit track of "batches" we just want to make the API calls quickly!

### Prompt Preview Endpoints

```http
POST /api/prompt/preview/:provider/:puzzleId
Content-Type: application/json

{
    "promptId": "solver",
    "customPrompt": "...",
    "emojiSetKey": "animals",              // Optional: emoji palette
    "omitAnswer": false                    // Optional: hide solution from prompt
}

Response:
{
    "systemPrompt": "...",
    "userPrompt": "...",
    "provider": "openai"
}
```

### Data Retrieval Endpoints

```http
GET /api/puzzles
List all available puzzles with metadata

GET /api/overview?limit=50&offset=0&source=ARC2&hasMultipleTests=true
Paginated puzzle overview with filtering

Query Parameters:
- limit: Results per page (default: 50, max: 1000)
- offset: Page offset
- source: Filter by ARC dataset
- hasMultipleTests: Filter multi-test puzzles
- sortBy: "cost", "processingTime", "difficulty"
- sortOrder: "asc", "desc"
```

### Analytics & Leaderboard Endpoints

```http
GET /api/feedback/accuracy-stats?minAttempts=20
Pure accuracy leaderboard data

GET /api/puzzle/performance-stats?minAttempts=20  
Trustworthiness metrics (confidence reliability)

GET /api/feedback/stats
User feedback statistics

GET /api/metrics/comprehensive-dashboard
Combined analytics for dashboards

GET /api/cost/model-costs
Cost analysis per model
```

### Debate Endpoints

```http
GET /api/explanations/:id/chain
Get full rebuttal chain for a debate

Response:
{
    "chain": [
        { "id": 1, "modelName": "gpt-4.1", ... },
        { "id": 2, "modelName": "claude-3.5", "rebuttingExplanationId": 1, ... },
        { "id": 3, "modelName": "gpt-5-2025-08-07", "rebuttingExplanationId": 2, ... }
    ]
}

GET /api/explanations/:id/original
Get parent explanation of a rebuttal
```

### PuzzleDiscussion Endpoints (v3.6.4+)

GET /api/discussion/eligible
Get explanations eligible for conversation chaining
THIS MEANS only explanations that have a provider_response_id in the database!!!

Eligibility Criteria:
- Has provider_response_id in database
- Created within last 30 days (provider retention window)

```

### ELO Comparison Endpoints (v2.30.0+)

```http
GET /api/elo/comparison_pair?puzzleId=0934a4d8
Get a random pair of explanations for blind comparison

POST /api/elo/submit_comparison
Content-Type: application/json

{
    "explanationAId": 123,
    "explanationBId": 456,
    "winnerId": 123,
    "sessionId": "uuid"
}

GET /api/elo/leaderboard?minGames=10
Get ELO ratings leaderboard
```

---

## Deployment Guide

### Railway Deployment

GitHub repository is already linked to Railway project
   - Railway auto-detects Node.js and PostgreSQL requirements

2. **Environment Variables**
   Present in .env file and on Railway

3. **Deploy**
   - Push or merge to main branch → automatic deployment to production
   - Push or merge to current branch → automatic deployment to staging
   - Railway runs `npm run build` and `npm start`
   - Database migrations run automatically on startup

### Docker Deployment

```dockerfile
# Build
docker build -t arc-explainer .

# Run with environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://... \
  -e OPENAI_API_KEY=... \
  --env-file .env \
  arc-explainer

# With Docker Compose
docker-compose up -d
```

**Dockerfile highlights:**
- Multi-stage build for optimized size
- Python runtime included for Saturn Visual Solver
- Health check on `/api/health` endpoint
- Automatic database migration on startup


## Performance Optimization Tips

### Database Indexing
All critical indexes are created automatically. For custom analytics queries, consider adding:
```sql
CREATE INDEX idx_custom ON explanations(your_field) WHERE your_condition;
```
### Proper Way to Handle Streaming Replies with Reasoning in OpenAI's Responses API

The OpenAI Responses API (used for models like GPT-5 series, o3-mini, o1, and o1-mini) provides structured streaming for real-time replies, including built-in reasoning capture. Streaming uses Server-Sent Events (SSE) over the `/v1/responses` endpoint, allowing incremental updates for both output (e.g., final responses) and reasoning (e.g., internal thought processes). This is designed for interactive UIs, where reasoning can be displayed alongside or before the output.

To capture everything properly—real-time deltas, full traces, metadata, summaries, and completions—follow this step-by-step process. It ensures no loss of content, handles persistence (e.g., buffering until the stream ends), and supports UI integration like WebSockets. Use the official OpenAI SDK (v4+ for Node.js) or raw fetch for implementation. All models with reasoning (e.g., GPT-5) require explicit configuration to expose reasoning events; defaults minimize latency by hiding traces.

#### 1. **Set Up the Request for Streaming with Reasoning**
Start by configuring the API call to enable streaming and reasoning exposure. Key parameters:
- `model`: Specify a reasoning-capable model (e.g., `'gpt-5'`, `'o1'`, `'o3-mini'`).
- `stream: true`: Activates SSE streaming.
- `reasoning_effort`: Controls depth and visibility ('low', 'medium', 'high', or 'max')—use 'high' or 'max' to ensure deltas emit for raw reasoning.
- `include_reasoning_summary: true`: Optionally generates a concise summary alongside full reasoning.
- `verbosity: 'high'`: Expands events to include detailed traces and metadata.
- Avoid heavy tools initially (e.g., `tool_choice: 'none'`) to prevent reasoning from routing to tool calls; enable them later if needed.
- Messages: Include prompts that trigger reasoning, like "Think step-by-step before responding."

Example request in Node.js with the SDK:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createStreamingResponse(messages: Array<{role: string; content: string}>, options: {model?: string} = {}) {
  const { model = 'gpt-5' } = options;

  const stream = await openai.beta.responses.create({
    model,
    messages,
    stream: true, // Enables SSE
    reasoning_effort: 'high', // Exposes reasoning deltas; 'max' for deepest traces
    include_reasoning_summary: true, // For UI-friendly summaries
    verbosity: 'high', // Ensures full metadata and traces in events
    tool_choice: 'none', // Prevents tool interference with reasoning
    // Optional: Custom instructions for reasoning style
    instructions: 'Provide detailed step-by-step reasoning before the final output.',
  });

  return stream;
}
```

- **Why these params?** Without `reasoning_effort`, reasoning is internal and hidden to optimize speed. `verbosity: 'high'` ensures events include `metadata` like effort used and token counts. This setup works for all reasoning models; adjust effort based on use case (e.g., 'medium' for balance).

#### 2. **Parse the Stream: Handle SSE Events**
The stream emits events in real-time (e.g., every few tokens). Each event is a JSON object with:
- `type`: e.g., `'response.reasoning.delta'`, `'response.output.delta'`, `'response.reasoning_summary.delta'`.
- `data`: Contains the payload, like `{ content: { text: 'delta text' } }` or `{ delta: { text: '...' } }`.
- Nested structures: Reasoning often nests under `data.choices[0].delta.reasoning` or directly in `data.reasoning`.

Use an async iterator on the stream to process events. Accumulate deltas into buffers (e.g., strings or arrays) for full capture. Listen for `.done` events to finalize and persist content.

- **Core Event Types to Handle**:
  - **Reasoning Deltas**: `'response.reasoning.delta'` (raw thoughts/traces), `'response.reasoning_summary.delta'` (concise overview), `'response.reasoning_summary_text.delta'` (text-only summary for easy UI display).
  - **Output Deltas**: `'response.output.delta'` or `'response.output_text.delta'` (main response chunks).
  - **Completion**: `'response.reasoning.done'`, `'response.output.done'`, or `'response.done'` (signals end; includes final metadata).
  - **Metadata/Extras**: Events may include `data.metadata` (e.g., `{ reasoning_effort: 'high', tokens: { reasoning: 150 } }`).
  - **Errors**: `'error'` (e.g., rate limits or aborts).

Example event handler (integrate with a UI buffer or emitter):

```typescript
function processStream(stream: any, buffers: { reasoning: string; output: string; summary: string }) {
  // Async iteration over the stream
  (async () => {
    for await (const event of stream) {
      const { type, data } = event;

      // Extract delta text (common structure; adapt if using raw SSE)
      const extractText = (payload: any): string | null => {
        return payload?.content?.text || 
               payload?.delta?.text || 
               payload?.reasoning?.text || 
               payload?.choices?.[0]?.delta?.content?.text;
      };

      switch (type) {
        case 'response.reasoning.delta':
          const reasoningDelta = extractText(data);
          if (reasoningDelta) {
            buffers.reasoning += reasoningDelta;
            // Real-time UI update (e.g., emit to WebSocket harness)
            console.log('Live reasoning:', reasoningDelta); // Or emit('reasoningDelta', reasoningDelta);
          }
          break;

        case 'response.reasoning_summary.delta':
        case 'response.reasoning_summary_text.delta':
          const summaryDelta = extractText(data);
          if (summaryDelta) {
            buffers.summary += summaryDelta;
            // Use for high-level UI display
            console.log('Reasoning summary delta:', summaryDelta);
          }
          break;

        case 'response.output.delta':
        case 'response.output_text.delta':
          const outputDelta = extractText(data);
          if (outputDelta) {
            buffers.output += outputDelta;
            // Stream to main UI
            console.log('Output delta:', outputDelta);
          }
          break;

        case 'response.reasoning.done':
          // Finalize reasoning; persist full buffer
          const reasoningMeta = data?.metadata;
          console.log('Reasoning complete:', { 
            fullReasoning: buffers.reasoning, 
            effort: reasoningMeta?.reasoning_effort,
            reasoningTokens: reasoningMeta?.tokens?.reasoning 
          });
          // Persist: e.g., save to state or UI until dismissed
          break;

        case 'response.output.done':
          // Final output persistence
          console.log('Output complete:', buffers.output);
          // Combine with reasoning for full context
          const fullResponse = { reasoning: buffers.reasoning, summary: buffers.summary, output: buffers.output };
          break;

        case 'response.done': // Overall stream end
          // Cleanup: Emit full capture
          console.log('Stream fully captured:', fullResponse);
          break;

        case 'error':
          console.error('Stream error:', data?.message || data);
          // Handle retry or abort buffering
          break;

        default:
          // Fallback for model-specific variations (e.g., nested metadata)
          if (type?.includes('reasoning') && data) {
            const fallback = data.metadata?.reasoning || data.choices?.[0]?.delta?.reasoning;
            if (fallback) {
              buffers.reasoning += typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
            }
          }
      }
    }
  })();
}
```

- **Buffering Strategy**: Use separate strings/arrays for reasoning, summary, and output. Append deltas incrementally for real-time display. On `.done`, concatenate and persist (e.g., in app state) until user dismisses.
- **Real-Time UI**: Emit deltas via a harness (e.g., Socket.io: `socket.emit('update', { type: 'reasoning', content: delta })`). This enables live "thinking" indicators.
- **Capture Everything**: Always log/emit metadata from `.done` events (e.g., token usage, effort level). For long streams, use chunking to avoid memory issues.

#### 3. **Full Usage Example in Your Service**
Tie it together in a function (e.g., in `openai.ts`):

```typescript
async function handleStreamingRequest(prompt: string) {
  const messages = [{ role: 'user', content: prompt }];
  const stream = await createStreamingResponse(messages);
  
  const buffers = { reasoning: '', output: '', summary: '' };
  processStream(stream, buffers);

  // Return stream ID or handler for UI
  return { streamId: stream.id, buffers }; // For persistence
}

// Call it
handleStreamingRequest('Solve this puzzle step-by-step: [details]');
```

- **Persistence Until Dismissal**: In your UI/core logic, hold the `fullResponse` in session storage or a Redux store. Clear only on user action (e.g., close panel).

#### 4. **Best Practices and Edge Cases**
- **Error Resilience**: Wrap in try-catch; reconnect on aborts using `stream_id` for resumable streams (set `store: true` in request if supported).
- **Performance**: For high-effort reasoning, expect longer latency (e.g., 10-30s for complex prompts). Limit to reasoning models only.
- **Tools Integration**: If using tools, set `tool_choice: 'auto'` after basic reasoning; parse `response.tool_calls.delta` separately to avoid conflicts.
- **Testing**: Use prompts like "Explain quantum computing step-by-step" to trigger reasoning. Monitor network tab for SSE events—expect interleaved deltas (reasoning first, then output).
- **Rate Limits**: Reasoning increases token usage; monitor via metadata.
- **Model Variations**: GPT-5 exposes more raw traces; o1/o3-mini focuses on summaries. Test per model.
- **SDK vs. Raw SSE**: SDK handles parsing; for raw (fetch), parse `event.data` lines manually with `JSON.parse(line.replace('data: ', ''))`.

This method captures 100% of the stream—deltas, traces, summaries, and metadata—while enabling seamless real-time UI. 