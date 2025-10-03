# AGENTS.md

Author: The User
Date: 2025-09-28 18:26:41
Purpose: To provide guidance to AI Agents when working with code in this repository.

WE ARE ON WINDOWS!!!  USE POWERSHELL SYNTAX AND COMMANDS!!!

This file provides guidance to AI Agents when working with code in this repository.
Every file you create or edit should start with:
 * 
 * Author: Your NAME  (Example: `Claude Code` using `Sonnet 4` or `Codex` using `GPT-5-high`)
 * Date: `timestamp`
 * PURPOSE: `VERBOSE DETAILS ABOUT HOW THIS WORKS AND WHAT ELSE IT TOUCHES`
 * SRP/DRY check: Pass/Fail Is this file violating either? Do these things already exist in the project?  Did you look??
 * shadcn/ui: Pass/Fail Is this file using shadcn/ui components?  DO NOT WRITE CUSTOM UI WHEN WE HAVE shadcn/ui COMPONENTS!!!

## ROLE
`You are an elite software architect and senior engineer with deep expertise in clean code principles, modular design, and production-ready implementation. You never do anything quick or sloppy. Your primary mission is to write, refactor, and review code that strictly adheres to Single Responsibility Principle (SRP) and DRY (Don't Repeat Yourself) principles while maximizing reuse of existing modular components and modular design and UI via the use of shadcn/ui components.`

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
    - **Key Components**: AnalysisResultCard, AnalysisResultHeader, AnalysisResultContent, AnalysisResultGrid, AnalysisResultListCard, CommunitySolutionsSection
- **Key Pages**: PuzzleBrowser, PuzzleExaminer, AnalyticsOverview, PuzzleOverview, SaturnVisualSolver

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
prediction_accuracy_score - double precision  // THIS IS THE `TRUSTWORTHINESS` SCORE
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

### External API Documentation
For external integrations, see:
- `docs/EXTERNAL_API.md` - Complete API endpoint reference for external applications
- `docs/HOOKS_REFERENCE.md` - React hooks documentation for frontend integration

**Key External APIs:**
- `/api/feedback/accuracy-stats` - Pure accuracy leaderboard data (used by AccuracyLeaderboard)
- `/api/puzzle/performance-stats` - Trustworthiness metrics (used by TrustworthinessLeaderboard)
- `/api/feedback/stats` - User feedback statistics (used by FeedbackLeaderboard)
- `/api/metrics/comprehensive-dashboard` - Combined analytics for dashboards

**Repository Pattern:**
External apps should access data through `repositoryService.*` rather than direct database queries:
- `repositoryService.accuracy.getPureAccuracyStats()` - For accuracy leaderboards
- `repositoryService.trustworthiness.getTrustworthinessStats()` - For trustworthiness metrics
- `repositoryService.cost.getAllModelCosts()` - For cost analysis
- `repositoryService.explanation.getByPuzzle(puzzleId)` - For explanations
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
Abstraction and Reasoning Corpus for Artificial General Intelligence v2 (ARC-AGI-2)

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


### Endpoint difference
All OpenAI models should be using Responses API, but OpenRouter and other providers still use Chat Completions.
Chat Completions: /v1/chat/completions

Responses API: /v1/responses

Output location

Chat Completions: text lives in choices[0].message.content

Responses: visible answer lives in output_text or inside output[], reasoning lives in output_reasoning

Reasoning capture

Chat Completions: no structured reasoning, only free-form text if the model decides to include it

Responses: dedicated output_reasoning.summary and output_reasoning.items[] fields

Token accounting

Chat Completions: max_tokens controls the final answer only

Responses: reasoning tokens and visible output tokens are separate; must set max_output_tokens or you risk only getting reasoning with no final text

Streaming

Chat Completions: stream only text deltas for choices[].delta.content

Responses: streams both reasoning and output chunks, with separate message types (reasoning-summary, output_text, etc.)

Chaining

Chat Completions: manually manage conversation history

Responses: use previous_response_id to continue reasoning chains without resending full history

Parsing logic

Chat Completions: simple—always look at choices[0].message.content

Responses: must parse multiple top-level keys: output_text, output[], output_reasoning, response.id

Failure modes

Chat Completions: usually just truncates answer if token cap too small

Responses: if misconfigured, you can get only reasoning and no visible reply, or nothing if your parser ignores output[]!!!  This might be where to start investigating.

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