# ARC-AGI Explainer Knowledge Base

## Project Mission
Interactive web application for exploring and analyzing ARC-AGI puzzles with AI-powered explanations. Focuses on pattern recognition, reasoning transparency, and educational insights.

## Architecture
- **Frontend**: React + TypeScript + Vite, TanStack Query, shadcn/ui
- **Backend**: Express + TypeScript, PostgreSQL/Drizzle ORM
- **AI**: Multi-provider support (OpenAI, Anthropic, Gemini, Grok, DeepSeek, OpenRouter)
- **Python**: Saturn Visual Solver integration

## Key Commands
- `npm run dev` - Start development server (Vite + Express)
- `npm run test` - Run build and dev together (wait 20s for output)
- `npm run db:push` - Push database schema changes
- `npm run build` - Production build

## Development Patterns
- ESM modules throughout (use .ts extensions in imports)
- Repository pattern for data access
- Prompt templates in `server/services/prompts/`
- Shared types in `shared/types.ts`

## Important Files
- `CLAUDE.md` - Detailed coding guidelines
- `server/services/promptBuilder.ts` - Centralized prompt system
- `server/repositories/*` - Data access layer
- `shared/schema.ts` - Database schema definitions

## API Endpoints
- `/api/puzzle/*` - Puzzle data and analysis
- `/api/feedback/*` - User feedback and stats
- `/api/metrics/*` - Performance metrics
- `/api/elo/*` - Model rankings

## Environment Variables
PRESENT IN .env

## Best Practices
- Always check CLAUDE.md for detailed guidelines
- Use repository pattern, not direct DB queries
- Maintain SRP and DRY principles
- Real implementations only, no mocks
- Git commit after changes with detailed messages

## Common Issues

- WebSocket issues: Saturn solver streaming can conflict
- Database: Auto-creates tables on startup if PostgreSQL configured
