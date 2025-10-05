
# ARC-AGI Explainer Platform

**Version 3.5.1**
**Last updated: October 05, 2025**

A professional research platform for analyzing Abstract Reasoning Corpus (ARC-AGI) puzzles using state-of-the-art AI models. Built for researchers, developers, and AI practitioners working on abstract reasoning and pattern recognition.

## Overview

This platform provides a robust suite of tools for ARC-AGI puzzle analysis, featuring multi-model AI evaluation, deep reasoning extraction, advanced performance analytics, and collaborative feedback systems. The architecture is engineered for stability and enterprise deployment, with PostgreSQL database integration and Docker containerization.

## What's New in v3.5.1
- Default GPT-5 reasoning settings now favor higher-quality outputs (reasoningEffort: high, reasoningVerbosity: high).
- Deep link to a specific explanation: share `/puzzle/{puzzleId}?highlight={explanationId}` to jump and highlight.
- Research-grade HuggingFace ingestion: import and validate external predictions with provenance and full run history.
- Admin console additions: `/admin`, `/admin/models`, `/admin/ingest-hf` for dashboards, model management, and HF ingestion.
- Multi-test accuracy display corrected; trustworthiness badge restored where appropriate.

## Key Features

### HuggingFace Dataset Ingestion (Research)
- Import high-quality public model predictions from HuggingFace for ARC/ARC-AGI datasets.
- Admin UI: `/admin/ingest-hf` with preflight checks (dataset URL, token, DB), dry-run mode, and detailed summaries.
- Provenance-first storage: raw provider payloads, accuracy stats, and cost/timing fields preserved.
- Ingestion runs tracked in `ingestion_runs` with indexes for fast analytics.
- See `docs/2025-10-01-Ingestion-Complete-Summary.md` and `docs/EXTERNAL_API.md`.


### ⭐ ELO Rating System
- **Pairwise Comparison**: Anonymously compare and vote on the quality of two different AI explanations for the same puzzle.
- **Quality Leaderboard**: Dynamically ranks AI models based on head-to-head user judgments, providing a more nuanced view of performance than simple accuracy.
- **Bias Reduction**: Hides model names during comparison to ensure impartial evaluation.

### 🤝 AI Model Debate System
- **Challenge Mode**: Select incorrect AI explanations and challenge them with different models to critique and improve the reasoning.
- **Rebuttal Tracking**: Complete debate chain visualization showing progression from original explanation through multiple rebuttals.
- **Custom Challenges**: Optional guidance text to focus challenger models on specific aspects (edge cases, color transformations, etc.).
- **Debate Navigation**: Breadcrumb UI displaying debate participants and relationships with clickable chain navigation.
- **Database Integration**: Foreign key relationships track debate chains with proper cascade behavior for data integrity.

### ✨ Instant & Optimistic UI
- **Immediate Feedback**: Analysis result cards appear instantly, with skeleton loaders and progressive status updates (`ANALYZING` → `SAVING` → `COMPLETED`).
- **No More Waiting**: Eliminates the 10-30 second "dead time" during analysis, providing a seamless and responsive user experience.

### 🔬 Advanced Research & Analysis Tools
- **Rich Filtering**: Filter puzzles by ARC dataset (`ARC1`, `ARC2-Eval`, etc.), multi-test status, and more.
- **Advanced Sorting**: Sort puzzles by cost, processing time, or composite difficulty scores to identify key trends.
- **GEPA Solver**: A new solver mode implementing the systematic strategy analysis from the proven GEPA methodology.
- **Unrestricted API**: API limits have been removed, allowing external applications to access complete datasets for deep analysis.

### 🤖 Multi-Provider AI Integration
- **OpenAI**: GPT-4, GPT-5, O3/O4 models with Responses API and reasoning extraction
- **Anthropic**: Claude models with structured reasoning via Tool Use API  
- **Google**: Gemini 2.5+ models with thought process extraction
- **xAI**: Grok models (via OpenRouter) with advanced reasoning capabilities
- **DeepSeek**: Reasoning models with comprehensive thinking capture
- **OpenRouter**: Access to 20+ additional models via unified API

### 🧠 Deep Reasoning Capture
- **OpenAI Responses API** integration with reasoning tokens and structured output
- **GPT-5 Parameters**: Configurable reasoning effort, verbosity, and summary types
- **Reasoning Logs**: Captured thinking processes from all reasoning-capable models
- **Raw Response Storage**: Complete, unaltered API responses are always saved for debugging and recovery.

### 📊 Comprehensive Analytics & Cost Tracking
- **Performance Metrics**: Model accuracy, confidence calibration, processing times.
- **Cost Tracking**: Token usage and API cost calculation across all providers.
- **Trustworthiness Scoring**: Confidence vs. accuracy analysis to detect overconfidence.
- **Batch Analysis**: Large-scale evaluation with session management and progress tracking.

### 🏗 Professional Architecture: Stability & Data Integrity
- **Robust API Handling**: System is resilient to non-compliant API responses (e.g., conversational text, markdown-wrapped JSON), ensuring data is captured even from verbose or misbehaving models.
- **Data Sanitization**: All grid data is automatically sanitized to prevent database errors from invalid AI-generated characters.
- **Critical Data Preservation**: Raw API responses are saved *before* parsing, guaranteeing that expensive API calls are never lost, even if parsing fails.
- **Database Stability**: Eliminated duplicate initializations and added intelligent retry logic to ensure reliable connections to the PostgreSQL database.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (optional - falls back to in-memory storage)
- At least one AI provider API key

### Installation

```bash
git clone <repository-url>
cd arc-explainer
npm install
```

> Windows PowerShell
> Use the PowerShell equivalents on Windows:
>
> ```powershell
> git clone <repository-url>
> Set-Location arc-explainer
> npm install
> npm run test   # Starts the dev server (allow ~10s to warm up)
> ```


### Environment Configuration

```bash
# AI Provider API Keys (at least one required)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  
GEMINI_API_KEY=your_gemini_api_key_here
GROK_API_KEY=your_grok_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Database (optional - uses in-memory storage if not provided)
DATABASE_URL=postgresql://user:password@host:port/database
```

### Development

```bash
npm run test    # Start development server
```

### Production Deployment

```bash
npm run build  # Build for production
npm start      # Run production server
```

## Architecture

### Backend Stack
- **Express.js**: RESTful API server with TypeScript
- **PostgreSQL**: Primary database with Drizzle ORM
- **AI Services**: Unified BaseAIService pattern for consistent provider integration
- **Repository Layer**: Specialized data access objects (ExplanationRepository, FeedbackRepository)
- **Validation**: Comprehensive input validation and JSON schema enforcement

### Frontend Stack  
- **React 18**: Modern component architecture with TypeScript
- **Vite**: Fast development and optimized production builds
- **TailwindCSS**: Utility-first styling with shadcn/ui components
- **TanStack Query**: Server state management and intelligent caching
- **Wouter**: Lightweight client-side routing

### Database Schema

#### Explanations Table
Core storage for AI analysis results with comprehensive metadata:

```sql
CREATE TABLE explanations (
    id SERIAL PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    -- Core Analysis
    pattern_description TEXT,
    solving_strategy TEXT,
    hints TEXT[],
    confidence INTEGER,
    -- Prediction & Accuracy
    predicted_output_grid JSONB,
    is_prediction_correct BOOLEAN,
    prediction_accuracy_score NUMERIC,
    -- Multi-Test Prediction Fields
    has_multiple_predictions BOOLEAN,
    multiple_predicted_outputs JSONB,
    multi_test_results JSONB,
    multi_test_all_correct BOOLEAN,
    multi_test_average_accuracy NUMERIC,
    -- AI & Prompt Metadata
    model_name TEXT,
    provider_raw_response JSONB, -- Stores the complete, unaltered API response
    system_prompt_used TEXT,
    user_prompt_used TEXT,
    prompt_template_id TEXT,
    -- Reasoning & Timings
    reasoning_log TEXT,
    has_reasoning_log BOOLEAN,
    reasoning_items JSONB,
    api_processing_time_ms INTEGER,
    -- Token & Cost Tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    reasoning_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost NUMERIC,
    -- GPT-5 Specific
    temperature NUMERIC,
    reasoning_effort TEXT,
    reasoning_verbosity TEXT,
    reasoning_summary_type TEXT,
    -- Debate & Rebuttal Tracking (v2.30.7+)
    rebutting_explanation_id INTEGER REFERENCES explanations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for debate chain queries
CREATE INDEX idx_explanations_rebutting_explanation_id ON explanations(rebutting_explanation_id);
```

#### Feedback Table
User feedback and evaluation system:

```sql
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    explanation_id INTEGER REFERENCES explanations(id) ON DELETE CASCADE,
    vote_type VARCHAR CHECK (vote_type IN ('helpful', 'not_helpful')),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ELO Rating System Tables
Stores data for the pairwise explanation quality comparison system:

```sql
CREATE TABLE elo_ratings (
    id SERIAL PRIMARY KEY,
    explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
    current_rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
```

## API Reference

### Core Endpoints
```http
POST /api/puzzle/analyze/:puzzleId/:modelKey
Content-Type: application/json

{
    "temperature": 0.2,
    "promptId": "solver",
    "customPrompt": "Your custom analysis prompt...",
    "reasoningEffort": "medium",
    "reasoningVerbosity": "high", 
    "reasoningSummaryType": "detailed"
}
```

#### Batch Analysis
```http
POST /api/batch/start
Content-Type: application/json

{
    "modelKey": "gpt-4",
    "puzzleIds": ["puzzle1", "puzzle2"],
    "temperature": 0.2,
    "reasoningEffort": "low"
}
```

#### Prompt Preview
```http
POST /api/prompt/preview/:provider/:puzzleId
Content-Type: application/json

{
    "promptId": "solver",
    "customPrompt": "Preview this custom prompt..."
}
```

### Data Retrieval
**NOTE**: API limits on analytics and feedback endpoints have been removed or significantly increased to support external applications. See `docs/EXTERNAL_API.md` for full details.

```http
GET /api/puzzles                           # List all available puzzles
GET /api/puzzle/:puzzleId                  # Get specific puzzle data
GET /api/puzzle/:puzzleId/explanations     # Get all analyses for puzzle
GET /api/overview?limit=50&offset=0        # Paginated overview with filters
GET /api/elo/comparison_pair               # Get a pair of explanations for ELO voting
```

### Debate & Rebuttal Endpoints
```http
POST /api/puzzle/analyze/:puzzleId/:modelKey
Content-Type: application/json

{
    "originalExplanation": { /* explanation to challenge */ },
    "customChallenge": "Focus on edge cases...",
    "temperature": 0.2
}

GET /api/explanations/:id/chain            # Get full rebuttal chain
GET /api/explanations/:id/original         # Get parent explanation
```

## Deployment

### Railway Deployment
The application is configured for Railway deployment with automatic database provisioning:

1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard  
3. Deploy automatically on git push

### Docker Deployment
```bash
docker build -t arc-explainer .
docker run -p 5000:5000 --env-file .env arc-explainer
```

### Environment Variables for Production
```bash
NODE_ENV=production
DATABASE_URL=your_postgresql_url
OPENAI_API_KEY=your_key
# Additional provider keys as needed
```

## Research Applications

### Academic Research
- **Pattern Recognition Studies**: Analyze AI model performance on abstract reasoning tasks
- **Model Comparison**: Systematic evaluation across multiple AI providers and architectures
- **Reasoning Analysis**: Study structured thinking processes from reasoning-capable models
- **Confidence Calibration**: Research overconfidence and trustworthiness in AI systems

### Industry Applications  
- **AI Evaluation**: Benchmark reasoning capabilities for enterprise AI implementations
- **Model Selection**: Data-driven choice between AI providers for specific use cases
- **Cost Analysis**: Token usage and API cost optimization across providers
- **Performance Monitoring**: Track model accuracy and reliability over time

### Custom Research Workflows
- **Custom Prompts**: Design domain-specific prompts for specialized research questions
- **Batch Processing**: Analyze large datasets efficiently with progress tracking
- **Raw Data Export**: Access complete API responses for custom analysis pipelines
- **Collaborative Evaluation**: Team-based feedback and evaluation systems

## Contributing

This platform follows professional development standards:

- **TypeScript**: Strict type checking with comprehensive interfaces
- **Testing**: Unit and integration test coverage
- **Code Quality**: ESLint, Prettier, and automated formatting
- **Documentation**: Comprehensive inline documentation and architecture guides
- **Version Control**: Detailed commit messages and branch-based development

## License

Built for research and educational applications in abstract reasoning and AI analysis.
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

When looking at a task, a test-taker has access to inputs & outputs of the demonstration pairs, plus the input(s) of the test pair(s). The goal is to construct the output grid(s) corresponding to the test input grid(s), using 3 trials for each test input. "Constructing the output grid" involves picking the height and width of the output grid, then filling each cell in the grid with a symbol (integer between 0 and 9, which are visualized as colors OR emojis!). Only exact solutions (all cells match the expected answer) can be said to be correct.

Some may be ambiguous and will require two attempts to solve.
