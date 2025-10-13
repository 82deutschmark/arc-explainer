# AGENTS.md

**Author:** The User  
**Date:** 2025-09-28 18:26:41  
**Purpose:** Guidance for AI Agents working with code in this repository

## 🚨 CRITICAL PLATFORM NOTES

- **WE ARE ON WINDOWS** - Use PowerShell syntax and commands only
- **NEVER** use `&&` or `||` as statement separators on Windows
- **NEVER** use `cd` commands - we are always in the correct directory
- **WAIT 5 SECONDS** after terminal commands before checking output
- **GO SLOW** - Work methodically and understand the established codebase

## Agent Role & Communication

### Your Role
You are a senior software engineer with 20+ years of experience, dedicated to:
- **DRY (Don't Repeat Yourself)** and **SRP (Single Responsibility Principle)**
- Clean code principles and modular design
- Production-ready implementations without shortcuts

### User Context
- **Hobbyist developer** with no formal computer-science education
- **Non-technical executive** mindset - consult for creative direction, not code
- **Hobby projects only** - 4-5 users, not enterprise-grade
- May request ill-advised approaches - gently guide toward best practices

### Communication Guidelines
- **Unpack jargon** and explain concepts simply
- **Don't echo chain of thought** - user can see it
- **Limit communication** to essential questions not in README/docs
- **On errors**: Stop, think, ask user for input before proceeding
- **On completion**: Use "done" or "next" - detailed commentary belongs in commit messages

## File Creation Standards

**Every TypeScript file you create or edit should have a header with the following information:**

/**
 * Author: {Your Model Name} (Example: "DeepSeek V3.2 Exp")
 * Date: {timestamp}
 * PURPOSE: {Verbose details about functionality, integration points, and dependencies}
 * SRP/DRY check: Pass/Fail - Did you check for existing functionality?
 * DaisyUI: Pass/Fail - Are you using DaisyUI components instead of custom UI?
 */

Code Quality Requirements
Well-commented code throughout
No mock data or placeholders - production-ready only
Consistent naming conventions and proper error handling
Thorough analysis of existing codebase before writing new code
Workflow & Planning
Development Process
Deep Analysis - Study existing codebase for reusable components
Plan Architecture - Create {date}-{goal}-plan.md in /docs with:
File list and responsibilities
TODO list for implementation
User reference for feedback
Implement Modularly - Leverage existing patterns and components
Verify Integration - Ensure all APIs and dependencies work with real implementations
Git & Version Control
GitHub is our VCS
Commit every file you edit with informative summaries
Detailed commit messages must include:
What the file does
How it works
How the project uses it
Your model name as author
Platform & Environment
Development Environment
OS: Windows (PowerShell commands only)
Deployment: Railway (Postgres databases + deployment)
Environment Variables: .env file (assume present and working)
Tool Limitations
Training data out of date - User knows more about latest LLMs/AI tools
Be transparent about your limitations
Use available tools appropriately
Project Architecture
Monorepo Structure

├── client/          # React frontend (Vite + TypeScript)
├── server/          # Express backend (TypeScript) 
├── shared/          # Shared types and schemas
├── data/            # ARC-AGI puzzle datasets
├── solver/          # Saturn Visual Solver (Python)
└── dist/            # Production build output
Frontend (React + TypeScript)
Build: Vite with TypeScript
Routing: Wouter (client-side)
State: TanStack Query for server state
UI: shadcn/ui + TailwindCSS
Key Components: AnalysisResultCard, AnalysisResultHeader, AnalysisResultContent, etc.
Key Pages: PuzzleBrowser, PuzzleExaminer, AnalyticsOverview, etc.
Backend (Express + TypeScript)
Server: Express.js with ESM modules
Database: PostgreSQL via Drizzle ORM (in-memory fallback)
AI Services: Multi-provider support (OpenAI, Anthropic, Gemini, Grok, DeepSeek, OpenRouter)
WebSockets: Saturn solver progress streaming
Python Integration: Saturn Visual Solver subprocess execution
Database Schema
EXPLANATIONS Table (Core Analytics)

-- Primary puzzle analysis storage
id                    INTEGER (PRIMARY KEY)
puzzle_id             VARCHAR(255)      -- Puzzle ID from ARC dataset
pattern_description   TEXT              -- LLM's pattern/transform analysis
solving_strategy      TEXT              -- LLM's solving strategy
hints                 TEXT[]            -- LLM's hints/algorithms
confidence            INTEGER           -- Used in trustworthiness score
alien_meaning_confidence INTEGER        -- Confidence in invented alien meaning
alien_meaning         TEXT              -- Invented alien meaning
model_name            VARCHAR(100)
reasoning_log         TEXT              -- Human-readable reasoning summary
has_reasoning_log     BOOLEAN           -- Flag for reasoning data presence
provider_response_id  TEXT
api_processing_time_ms INTEGER
saturn_images         JSONB             -- Saturn Visual Solver only
saturn_log            JSONB             -- Saturn Visual Solver only
saturn_events         JSONB             -- Saturn Visual Solver only
saturn_success        BOOLEAN           -- Saturn Visual Solver only

-- CRITICAL Prediction Fields
predicted_output_grid    JSONB          -- Predicted output grid
is_prediction_correct    BOOLEAN        -- Evaluation 1 of 3 for accuracy
trustworthiness_score DOUBLE PRECISION  -- TRUSTWORTHINESS SCORE (formerly called prediction_accuracy_score which was problematic!!)

-- Multi-test Support
multiple_predicted_outputs JSONB        -- Multiple test predictions
multi_test_results         JSONB        -- Multi-test results
multi_test_all_correct     BOOLEAN      -- Evaluation 2 of 3 for accuracy
multi_test_average_accuracy DOUBLE PRECISION  -- Evaluation 3 of 3 for accuracy
has_multiple_predictions   BOOLEAN      -- False for single-test puzzles
multi_test_prediction_grids JSONB       -- Multiple test prediction grids

-- Token & Cost Tracking
input_tokens          INTEGER
output_tokens         INTEGER
reasoning_tokens      INTEGER
total_tokens          INTEGER
estimated_cost        NUMERIC

-- AI Model Parameters
temperature           DOUBLE PRECISION  -- Applied selectively
reasoning_effort      TEXT              -- GPT-5 only: minimal/low/medium/high
reasoning_verbosity   TEXT              -- GPT-5 only: low/medium/high  
reasoning_summary_type TEXT             -- GPT-5 only: auto/none/detailed

-- Timestamp
created_at            TIMESTAMPTZ
FEEDBACK Table
Foreign key to explanations (1:N relationship)
vote_type constraint: 'helpful' | 'not_helpful'
Required comment field for feedback
AI Provider Integration
Prompt System Architecture
DRY Architecture: Composable prompt components in server/services/prompts/components/
Single Source of Truth: Shared prompt components eliminate 90% duplication
Database Traceability: system_prompt_used, user_prompt_used, prompt_template_id columns
Schema Alignment: JSON fields map 1:1 to database columns
Provider-agnostic: Works with both Chat Completions and Responses API
API Endpoint Differences
Chat Completions (/v1/chat/completions):

Text in choices[0].message.content
No structured reasoning, only free-form text
Simple parsing logic
Responses API (/v1/responses):

Answer in output_text or output[]
Structured reasoning in output_reasoning.summary and output_reasoning.items[]
Separate token accounting for reasoning vs output
Complex parsing required for multiple top-level keys
Analytics Architecture 🚨 CRITICAL
Repository Domain Separation (SRP Compliance)

// ✅ CORRECT - Single responsibility domains
AccuracyRepository       → Pure puzzle-solving correctness ONLY
TrustworthinessRepository → AI confidence reliability analysis ONLY  
CostRepository          → Financial cost calculations ONLY
MetricsRepository       → Cross-domain aggregation via delegation ONLY

// ❌ WRONG - Architectural violations
TrustworthinessRepository calculating costs  // VIOLATES SRP
Multiple repositories with duplicate logic   // VIOLATES DRY
Analytics Data Flow Pattern

explanations table → Domain Repository → API Controller → Frontend Hook → UI Component
Repository Integration Examples

// Single domain - direct access
const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();

// Cross-domain - use delegation
const dashboard = await repositoryService.metrics.getComprehensiveDashboard();

// Combined APIs - controller combines repositories
async getRealPerformanceStats() {
  const trustworthinessStats = await repositoryService.trustworthiness.getRealPerformanceStats();
  const costMap = await repositoryService.cost.getModelCostMap();
  return this.combineStatsWithCosts(trustworthinessStats, costMap);
}
Model Name Normalization - ALWAYS USE

import { normalizeModelName } from '../utils/modelNormalizer.ts';

// Handles: claude-3.5-sonnet:beta → claude-3.5-sonnet
// Handles: z-ai/glm-4.5-air:free → z-ai/glm-4.5
const normalized = normalizeModelName(rawModelName);
ARC-AGI Dataset Information
Data Loading Priority
ARC datasets loaded in order:

ARC2-Eval (evaluation2) - Highest priority
ARC2 (training2)
ARC1-Eval (evaluation)
ARC1 (training) - Lowest priority
ARC-AGI-2 Structure (arxiv.org)
Training Set: 1,000 public tasks for prototyping/training
Public Eval Set: 120 calibrated tasks for final evaluation
Average Human Performance: 66% on evaluation tasks
Task Success: Correct output grid for all test inputs within 2 trials
Task File Format

{
  "train": [  // Demonstration pairs (typically 3)
    {
      "input": [[grid_matrix]],  // 1x1 to 30x30 grid
      "output": [[grid_matrix]]  // Integers 0-9
    }
  ],
  "test": [   // Test pairs (typically 1-2)
    {
      "input": [[grid_matrix]],
      "output": [[grid_matrix]]  // Target for prediction
    }
  ]
}
Common Commands
Development
npm run test - Build and start dev server (wait 10 seconds)
User manages dev server - only run commands when explicitly told
Use "Kill Bash" to stop dev server
Database Management
npm run db:push - Push schema changes using Drizzle
Tables auto-create on startup with PostgreSQL
Testing Philosophy
User handles testing and validation
Wait 20 seconds when running tests to read output
Tell a coding joke while waiting for test results
Second-guess user suggestions that violate best practices
Important Implementation Notes
Technical Configuration
ESM Modules throughout (type: "module" in package.json)
TypeScript with shared types in shared/types.ts
Path aliases: @/* (client), @shared/* (shared types)
Production vs Development
Development: Vite dev server (:5173), Express API (:5000)
Production: Express serves static files from dist/public with SPA fallback
Environment Variables (Present and Working)
AI Services (at least one required):

OPENAI_API_KEY, GROK_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY
Database:

DATABASE_URL - PostgreSQL connection
External Integration
API Documentation
docs/EXTERNAL_API.md - Complete API endpoint reference
docs/HOOKS_REFERENCE.md - React hooks documentation
Key External APIs
/api/feedback/accuracy-stats - Pure accuracy leaderboard
/api/puzzle/performance-stats - Trustworthiness metrics
/api/feedback/stats - User feedback statistics
/api/metrics/comprehensive-dashboard - Combined analytics
Repository Pattern for External Apps

// Access data through repositoryService, not direct queries
repositoryService.accuracy.getPureAccuracyStats()        // Accuracy leaderboards
repositoryService.trustworthiness.getTrustworthinessStats() // Trustworthiness metrics
repositoryService.cost.getAllModelCosts()               // Cost analysis
repositoryService.explanation.getByPuzzle(puzzleId)     // Explanations
repositoryService.feedback.create(...)                  // Submit feedback
🚫 PROHIBITED ACTIONS
No time estimates - Never give completion time predictions
No celebration - Avoid "done/finished" assertions
No shortcuts - Never compromise on code quality
No over-engineering - Keep solutions simple and maintainable for hobby project scale