# Claude Code Memory - ARC Explainer Project

## Database Schema

The project uses PostgreSQL with two main tables:

### EXPLANATIONS Table
- **Primary Key**: `id` (SERIAL)
- **Core Fields**:
  - `puzzle_id` (TEXT NOT NULL) - Links to puzzle
  - `pattern_description`, `solving_strategy`, `alien_meaning` (TEXT)
  - `hints` (TEXT[]) - PostgreSQL array
  - `confidence`, `alien_meaning_confidence` (INTEGER)
  - `model_name` (TEXT) - AI model used
  
- **AI Features**:
  - `reasoning_log` (TEXT) - Step-by-step AI reasoning
  - `has_reasoning_log` (BOOLEAN) - Quick check flag
  - `api_processing_time_ms` (INTEGER) - Performance tracking
  
- **Saturn Solver Integration**:
  - `saturn_images` (TEXT) - JSON string of image paths
  - `saturn_log` (TEXT) - Verbose stdout/stderr logs
  - `saturn_events` (TEXT) - Compressed NDJSON/JSON event trace
  - `saturn_success` (BOOLEAN) - Whether puzzle was solved correctly
  
- **Metadata**: `created_at` (TIMESTAMPTZ)

### FEEDBACK Table
- **Primary Key**: `id` (SERIAL)
- **Foreign Key**: `explanation_id` → `explanations(id)` (1:N relationship)
- **Fields**:
  - `vote_type` (VARCHAR) - CHECK constraint: 'helpful' | 'not_helpful'
  - `comment` (TEXT)
  - `created_at` (TIMESTAMP)

## Key Architecture Notes

### Puzzle Data Loading Issue (FIXED)
- **Problem**: PuzzleLoader was creating artificial composite keys like `"taskId-ARC1"` 
- **Reality**: Each puzzle has a unique ID across all ARC categories (ARC1, ARC1-Eval, ARC2, ARC2-Eval)
- **Fix**: Use taskId directly as the key, not composite keys
- **Files Modified**: `server/services/puzzleLoader.ts`

### Data Sources Priority
1. ARC2-Eval (evaluation2) - Priority 1
2. ARC2 (training2) - Priority 2  
3. ARC1-Eval (evaluation) - Priority 3
4. ARC1 (training) - Priority 4

### Project Structure
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL (Railway) with fallback to memory
- **AI Providers**: OpenAI, Anthropic, Gemini, Grok, DeepSeek
- **Special Features**: Saturn Visual Solver with Python integration

### Common Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- Database tables auto-create on startup

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection (optional)
- `OPENAI_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY` - AI providers
- `PYTHON_BIN` - Python binary override for Saturn solver