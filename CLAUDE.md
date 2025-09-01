# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
You need to Git add and commit any changes you make to the codebase.  Be detailed in your commit messages.
Use `npm run test` to start the dev server and wait 10 seconds for it to properly start. Remember not to use the cd command as it is largely unnecessary and this will cause issues with the dev server.  Use Kill Bash(Kill shell: bash_1) to stop the dev server.

### Database Management
- `npm run db:push` - Push database schema changes using Drizzle
- Database tables auto-create on startup if using PostgreSQL

### Testing and Validation
- Whenever you run tests you need to wait at least 20 seconds to read the output.  Tell the user a joke about coding while you wait.


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
- **Key Pages**: PuzzleBrowser, PuzzleExaminer, ModelExaminer, PuzzleOverview, SaturnVisualSolver

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
reasoning_log - text  // UNKNOWN if this is properly used in the frontend or the backend
has_reasoning_log - boolean // UNKNOWN if this is properly used in the frontend or the backend
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
reasoning_items - jsonb  // UNKNOWN if this is properly used in the frontend or the backend
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
### WebSocket Integration  (POTENTIALLY BREAKING OTHER THINGS AND CAN BE DEPRECATED)
Saturn solver uses WebSocket for real-time progress streaming with event-based updates and image gallery rendering.