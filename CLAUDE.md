# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server (both frontend on :5173 and backend on :5000)
- `npm run build` - Build for production (client to dist/public, server to dist/)
- `npm run start` - Run production build
- `npm run check` - TypeScript type checking
- `npm run windows-dev` - Windows-specific development command
- `npm run windows-start` - Windows-specific production command

### Database Management
- `npm run db:push` - Push database schema changes using Drizzle
- Database tables auto-create on startup if using PostgreSQL

### Testing and Validation
- No specific test commands configured - check project for testing framework setup

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
- **Key Pages**: PuzzleBrowser, PuzzleExaminer, SaturnVisualSolver, PuzzleOverview

### Backend Architecture (Express + TypeScript)
- **Server**: Express.js with ESM modules
- **Database**: PostgreSQL via Drizzle ORM (with in-memory fallback)
- **AI Services**: Multi-provider support (OpenAI, Anthropic, Gemini, Grok, DeepSeek)
- **WebSockets**: Saturn solver progress streaming
- **Python Integration**: Saturn Visual Solver subprocess execution

### Database Schema (PostgreSQL)
Two main tables with Drizzle ORM:

**EXPLANATIONS Table**:
- Core fields: puzzle_id, pattern_description, solving_strategy, hints[], confidence
- AI features: reasoning_log, api_processing_time_ms, model_name
- Saturn integration: saturn_images, saturn_log, saturn_events, saturn_success

**FEEDBACK Table**:
- Foreign key to explanations (1:N relationship)
- vote_type constraint: 'helpful' | 'not_helpful'
- Required comment field for feedback

### AI Provider Integration
Centralized prompt building system (`server/services/promptBuilder.ts`):
- Template-based prompts with dynamic selection
- Custom prompt support for research workflows
- Consistent behavior across all 5 AI providers
- Emoji mapping only for "Alien Communication" template

### Saturn Visual Solver Integration
- Python-based visual reasoning solver
- Streams progress via WebSockets and NDJSON events
- Requires OPENAI_API_KEY for image analysis
- Image gallery with real-time updates

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

### Environment Variables
Required for AI analysis (at least one):
- `OPENAI_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`

Optional:
- `DATABASE_URL` - PostgreSQL connection (fallback to memory storage)
- `PYTHON_BIN` - Override Python binary (auto-detects: 'python' on Windows, 'python3' on Linux)

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

### Prompt System Architecture
- Single source of truth in `promptBuilder.ts`
- Provider-agnostic prompt handling
- Template selection with custom prompt override capability
- Numeric grids by default, emoji mapping only for specific templates

### WebSocket Integration
Saturn solver uses WebSocket for real-time progress streaming with event-based updates and image gallery rendering.
- Endpoint difference

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

Responses: if misconfigured, you can get only reasoning and no visible reply, or nothing if your parser ignores output[]