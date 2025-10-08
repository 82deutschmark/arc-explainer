# ARC-AGI Explainer Platform

**Version 3.7.7** • October 8, 2025

A research platform for analyzing Abstract Reasoning Corpus (ARC-AGI) puzzles using state-of-the-art AI models with deep reasoning capture, conversation chaining, and comprehensive performance analytics.

**[Live Demo](https://your-demo-url) • [Technical Docs](./CLAUDE.md) • [API Reference](./docs/EXTERNAL_API.md) • [Changelog](./CHANGELOG.md)**

---

## What's New in v3.7.7 🎉

### Conversation Chaining & Reasoning Persistence ⭐ NEW
- **Multi-turn conversations** with full context retention across OpenAI (GPT-5, o-series) and xAI (Grok-4) models
- **Server-side reasoning persistence** - 30-day encrypted storage means no re-sending of expensive reasoning tokens
- **PuzzleDiscussion feature** - Models refine their own analyses iteratively with complete context
- **Provider-aware chaining** - Automatically maintains conversation history within provider boundaries
- **"Refine This Analysis" badges** - One-click navigation from any result to conversation mode

### Batch Analysis Web UI
- **10-20x faster processing** with parallel execution (10 puzzles concurrently)
- **Live activity logs** - Terminal-style real-time updates showing correctness validation per puzzle
- **Resume capability** - Automatically skips already-analyzed puzzles
- **Click-to-analyze** - ModelBrowser now supports instant analysis from "Not Attempted" lists
- **Progress tracking** - Real-time status with pause/resume/cancel controls

### Enhanced User Experience
- **Correctness filtering** - Show only correct/incorrect results on PuzzleExaminer page
- **Deep linking** - Share direct links to specific analyses: `/puzzle/{id}?highlight={explanationId}`
- **Optimistic UI** - Instant feedback with progressive status updates (ANALYZING → SAVING → COMPLETED)
- **Activity monitoring** - See exactly what's happening during batch runs with validation results

## Core Capabilities

### 🔗 Conversation Chaining & Progressive Reasoning
- **Multi-turn conversations** - GPT-5, o-series, and Grok-4 models maintain full context across refinement turns
- **30-day reasoning persistence** - Server-side encrypted storage (OpenAI/xAI) eliminates token re-sending costs
- **PuzzleDiscussion mode** - Models iteratively refine their own analyses with complete conversation history
- **Model Debate system** - Challenge incorrect explanations, track rebuttal chains, provider-aware context
- **Response chain visualization** - Complete conversation history with clickable navigation

### 📊 Batch Analysis & Automation
- **Web UI at `/models`** - Full-featured batch analysis interface with real-time progress
- **Parallel processing** - 10 puzzles concurrently with 2s stagger (10-20x faster than sequential)
- **Live activity logs** - Terminal-style feed showing validation results (✓ CORRECT / ✗ INCORRECT) per puzzle
- **Resume mode** - Automatically detects and skips already-analyzed puzzles
- **Pause/resume/cancel** - Full session control for long-running batches
- **Click-to-analyze** - ModelBrowser supports instant analysis from "Not Attempted" lists

### 🤖 Multi-Provider AI Integration
- **OpenAI** - GPT-4, GPT-5, o3/o4 models with Responses API and reasoning token tracking
- **xAI** - Grok-4 variants with Responses API and structured outputs
- **Anthropic** - Claude models with Tool Use API for structured reasoning
- **Google** - Gemini models with thought process extraction
- **DeepSeek** - Reasoning models with human-readable thinking logs
- **OpenRouter** - 100+ additional models including Grok-3, uses Chat Completions API

### 🎯 Analysis & Comparison Tools
- **ELO rating system** - Anonymized pairwise comparisons for quality rankings beyond accuracy
- **Correctness filtering** - Show only correct/incorrect results with toggle UI
- **Trustworthiness scoring** - Confidence vs. accuracy to detect overconfidence
- **Cost tracking** - Token usage and API costs across all providers
- **Advanced sorting** - By cost, processing time, or composite difficulty scores
- **Deep linking** - Share specific analyses: `/puzzle/{id}?highlight={explanationId}`

### 🔬 Research & Data Access
- **HuggingFace ingestion** - Import external model predictions with full provenance tracking
- **Admin console** - `/admin` hub for model management, ingestion runs, and system stats
- **Unrestricted API** - Full dataset access for external applications (see `docs/EXTERNAL_API.md`)
- **Raw response storage** - Complete API responses preserved for debugging and analysis
- **Custom prompts** - Design domain-specific prompts for specialized research questions

### ⚡ User Experience
- **Optimistic UI** - Instant feedback with progressive status (ANALYZING → SAVING → COMPLETED)
- **Real-time updates** - WebSocket streaming for Saturn solver and batch progress
- **Skeleton loaders** - No "dead time" waiting for API responses
- **Data sanitization** - Resilient to non-compliant API responses and invalid characters

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd arc-explainer
npm install

# Configure API keys in .env file
OPENAI_API_KEY=your_key_here
DATABASE_URL=postgresql://...  # Optional

# Run development server
npm run test  # Allow ~10s to warm up, then open localhost:5173
```

**For detailed setup, deployment, and technical documentation, see [CLAUDE.md](./CLAUDE.md)**

---

## Architecture Overview

### Technology Stack
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui components  
**Backend:** Express.js + TypeScript + PostgreSQL (Drizzle ORM) + in-memory fallback  
**AI Integration:** Unified BaseAIService pattern supporting 6+ providers  
**Real-time:** WebSocket streaming for Saturn solver and batch progress  
**Deployment:** Railway-ready with Docker support

### Key Design Patterns
- **Repository pattern** - Clean separation between data access and business logic
- **Provider abstraction** - Unified interface across OpenAI, Anthropic, xAI, etc.
- **Optimistic updates** - Instant UI feedback with server reconciliation
- **Response preservation** - Raw API responses saved before parsing for debugging
- **Conversation chaining** - Provider-aware context management with 30-day persistence

**Complete technical details:** [CLAUDE.md](./CLAUDE.md) • **API Reference:** [docs/EXTERNAL_API.md](./docs/EXTERNAL_API.md) • **Database schemas:** [CLAUDE.md#database-schema](./CLAUDE.md#complete-database-schema-reference)


---

## For Researchers

This platform enables systematic study of AI reasoning capabilities on abstract visual patterns:

### Research Use Cases
- **Model comparison** - Evaluate reasoning across GPT-5, o-series, Grok-4, Claude, Gemini, DeepSeek
- **Cost-performance analysis** - Token usage vs. accuracy trade-offs for different providers
- **Confidence calibration** - Study overconfidence patterns and trustworthiness scoring
- **Reasoning depth** - Analyze structured thinking from models with reasoning token support
- **Conversation dynamics** - Track how context affects progressive reasoning refinement
- **Batch evaluation** - Large-scale systematic testing across 1,000+ puzzles

### Data Access
- **Unrestricted API** - Full programmatic access to all analyses and metrics
- **HuggingFace integration** - Import external predictions for comparative analysis
- **Raw response storage** - Complete API payloads preserved for custom analysis
- **Custom prompts** - Design specialized evaluation frameworks

**API Documentation:** [docs/EXTERNAL_API.md](./docs/EXTERNAL_API.md)

---

## About ARC-AGI Puzzles

The Abstract Reasoning Corpus for Artificial General Intelligence (ARC-AGI) is a benchmark for testing fluid intelligence in AI systems.

### Dataset Structure
- **ARC-AGI-1**: 400 training + 400 evaluation puzzles
- **ARC-AGI-2**: 1,000 training + 120 evaluation puzzles (public)
- **Private test sets**: Semi-private (commercial) and fully-private (competition) sets calibrated to same difficulty

### Puzzle Format
Each puzzle consists of:
- **Training examples**: 3 input/output pairs demonstrating the pattern
- **Test cases**: 1-2 input grids requiring output prediction
- **Grids**: Rectangular matrices (1x1 to 30x30) with integers 0-9 (visualized as colors or emojis)

### Success Criterion
- Predict **exact** output grid dimensions and all cell values
- 2 attempts allowed per test input
- Must work on **first encounter** with the puzzle
- Human performance: ~66% on evaluation set

### Data Location
```
data/
├── training/      # 1000 tasks for algorithm training
├── evaluation/    # 120 tasks for testing (ARC-AGI-1)
├── evaluation2/   # 120 tasks for testing (ARC-AGI-2)
└── training2/     # Additional training tasks
```

**Read the ARC-AGI-2 paper:** [arxiv.org/pdf/2505.11831](https://www.arxiv.org/pdf/2505.11831)

---

## Contributing

Contributions welcome! This is a hobby project supporting research into AI reasoning capabilities. See [CLAUDE.md](./CLAUDE.md) for architecture details and development guidelines.

---

**Built for research and education in abstract reasoning • [Changelog](./CHANGELOG.md) • [Technical Docs](./CLAUDE.md)**
