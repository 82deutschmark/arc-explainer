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

## xAI Grok-4 Structured Outputs (Oct 7, 2025)
- Enabled via Responses API using `response_format.json_schema` (not `text.format`).
- Minimal schema in `server/services/schemas/grokJsonSchema.ts`:
  - required: `multiplePredictedOutputs`, `predictedOutput`
  - optional: `predictedOutput1/2/3`, `confidence`
  - arrays-of-arrays of integers; shallow nesting; `additionalProperties: false`
  - Avoid unsupported constraints: no `minLength/maxLength`, no `minItems/maxItems`, no `allOf`.
- Fallback: on grammar/schema error (400/422/503), auto-retry once without schema; parsing still succeeds via `output_text`.


## OPEN AI Structured Outputs (Oct 14, 2025)
Supported schemas
Structured Outputs supports a subset of the JSON Schema language.

Supported types
The following types are supported for Structured Outputs:

String
Number
Boolean
Integer
Object
Array
Enum
anyOf
Supported properties
In addition to specifying the type of a property, you can specify a selection of additional constraints:

Supported string properties:

pattern — A regular expression that the string must match.
format — Predefined formats for strings. Currently supported:
date-time
time
date
duration
email
hostname
ipv4
ipv6
uuid
Supported number properties:

multipleOf — The number must be a multiple of this value.
maximum — The number must be less than or equal to this value.
exclusiveMaximum — The number must be less than this value.
minimum — The number must be greater than or equal to this value.
exclusiveMinimum — The number must be greater than this value.
Supported array properties:

minItems — The array must have at least this many items.
maxItems — The array must have at most this many items.