# ARC-AGI Analysis Platform

**Last updated: September 2025**

A professional research platform for analyzing Abstract Reasoning Corpus (ARC-AGI) puzzles using state-of-the-art AI models. Built for researchers, developers, and AI practitioners working on abstract reasoning and pattern recognition.

## Overview

This platform provides comprehensive analysis tools for ARC-AGI puzzles, featuring multi-model AI analysis, reasoning extraction, performance evaluation, and collaborative feedback systems. The architecture supports enterprise deployment with PostgreSQL database integration and Docker containerization.

## Key Features

### 🤖 Multi-Provider AI Integration
- **OpenAI**: GPT-4, GPT-5, O3/O4 models with Responses API and reasoning extraction
- **Anthropic**: Claude models with structured reasoning via Tool Use API  
- **Google**: Gemini 2.5+ models with thought process extraction
- **xAI**: Grok models with advanced reasoning capabilities
- **DeepSeek**: Reasoning models with comprehensive thinking capture
- **OpenRouter**: Access to 20+ additional models via unified API

### 🧠 Advanced Reasoning Capture
- **OpenAI Responses API** integration with reasoning tokens and structured output
- **GPT-5 Parameters**: Configurable reasoning effort, verbosity, and summary types
- **Reasoning Logs**: Captured thinking processes from all reasoning-capable models
- **Structured Output**: JSON schema enforcement for consistent analysis format

### 📊 Comprehensive Analytics
- **Performance Metrics**: Model accuracy, confidence calibration, processing times
- **Cost Tracking**: Token usage and API cost calculation across all providers
- **Trustworthiness Scoring**: Confidence vs accuracy analysis for overconfidence detection
- **Batch Analysis**: Large-scale evaluation with session management and progress tracking

### 🔬 Research Tools
- **Custom Prompts**: Override built-in templates with research-specific prompts
- **Prompt Preview**: Inspect exact prompts sent to each provider
- **Multi-Template System**: Solver, explanation, educational, and custom modes
- **Raw Response Logging**: Complete API responses stored for analysis

### 🏗 Professional Architecture
- **Modular Design**: BaseAIService pattern eliminates 90% code duplication
- **Repository Pattern**: Clean separation of data access with specialized repositories
- **Type Safety**: Full TypeScript coverage with comprehensive interfaces
- **Error Handling**: Robust retry logic, validation, and fallback systems

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
    pattern_description TEXT,
    solving_strategy TEXT,
    hints TEXT[],
    confidence INTEGER,
    model_name TEXT,
    reasoning_log TEXT,
    has_reasoning_log BOOLEAN,
    reasoning_items JSONB,
    api_processing_time_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER, 
    reasoning_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost NUMERIC,
    temperature NUMERIC,
    reasoning_effort TEXT,
    reasoning_verbosity TEXT,
    reasoning_summary_type TEXT,
    predicted_output_grid JSONB,
    is_prediction_correct BOOLEAN,
    prediction_accuracy_score NUMERIC,
    has_multiple_predictions BOOLEAN,
    multiple_predicted_outputs JSONB,
    multi_test_results JSONB,
    multi_test_all_correct BOOLEAN,
    multi_test_average_accuracy NUMERIC,
    system_prompt_used TEXT,
    user_prompt_used TEXT,
    prompt_template_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Feedback Table
User feedback and evaluation system:

```sql
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    explanation_id INTEGER REFERENCES explanations(id),
    vote_type VARCHAR CHECK (vote_type IN ('helpful', 'not_helpful')),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Reference

### Core Endpoints

#### Analysis
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
```http
GET /api/puzzles                           # List all available puzzles
GET /api/puzzle/:puzzleId                  # Get specific puzzle data
GET /api/puzzle/:puzzleId/explanations     # Get all analyses for puzzle
GET /api/overview?limit=50&offset=0        # Paginated overview with filters
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

---

**Professional Support**: For enterprise deployments, custom integrations, or research collaborations, please contact the development team.