# ARC Explainer Developer Onboarding Guide

*Last Updated: September 29, 2025*

Welcome to the ARC Explainer project! This guide is designed to help new developers understand the project's architecture, locate key files, and contribute effectively. Our goal is to reuse existing components and maintain a clear, modular structure.

## Project Overview

The ARC Explainer is a full-stack web application for analyzing and visualizing Abstract Reasoning Corpus (ARC) puzzles. It allows users to submit puzzles to various AI models, view their analyses, and compare results. The application is built with a React frontend and a Node.js/Express backend, following a "database-first" architecture.

### 🆕 NEW: Model Debate & Rebuttal Tracking (September 2025)
The application now includes AI-vs-AI debate functionality with parent-child rebuttal tracking:
- **ModelDebate Page**: Interface for AI models to challenge each other's incorrect explanations
- **Rebuttal Tracking**: Database tracks which explanations are rebuttals challenging other explanations
- **Debate Chains**: Recursive queries to show full debate threads (Original → Rebuttal 1 → Rebuttal 2)
- **Custom Challenges**: Users can provide optional guidance when generating challenges
- **API Endpoints**: `GET /api/explanations/:id/chain` and `GET /api/explanations/:id/original`
- **95% Complete**: Backend fully implemented, UI display of chains pending

### Model Dataset Performance Analysis (September 2025)
The application includes dynamic model performance analysis across ANY ARC dataset:
- **Dynamic Dataset Discovery**: Automatically discovers available datasets from `data/` directory
- **Model Performance Tracking**: Shows which puzzles each model solved/failed/skipped on any dataset
- **Real Database Queries**: Uses same logic as `puzzle-analysis.ts` and `retry-failed-puzzles.ts` scripts
- **Complete Flexibility**: No hardcoded datasets or models - works with any combination
- **Analytics Dashboard**: Available in the Analytics section with dataset and model selectors

### Core Philosophy: Database-First Architecture

The application's data flow is designed to ensure data integrity and persistence. Here’s the typical flow for an analysis request:

1.  **Frontend Request**: The user initiates an action (e.g., clicking "Analyze") in the UI.
2.  **Backend Processing**: The backend receives the request, constructs a prompt, calls an external AI service, validates the response, and saves the complete, validated result to the PostgreSQL database.
3.  **Frontend Refetch**: After the backend confirms the database write, the frontend re-fetches the data from the database to update the UI.

This ensures that the UI always displays a persistent, validated record. For a detailed trace, see [Analysis Data Flow Trace](./Analysis_Data_Flow_Trace.md).

## Directory Structure

The project is organized into three main parts: `client`, `server`, and `shared`.

### `client/` - The Frontend

The frontend is a React application built with Vite. All source code resides in `client/src/`.

-   **`pages/`**: Top-level components that correspond to a specific URL route (e.g., `PuzzleExaminer.tsx`). These components assemble layouts and are responsible for page-level concerns.
-   **`components/`**: Reusable UI elements. This directory is further organized by feature (e.g., `puzzle/`, `overview/`) and common UI elements (`ui/`). Before creating a new component, always check here first.
-   **`hooks/`**: Custom React hooks that encapsulate business logic and data fetching (e.g., `usePuzzle.ts`, `useAnalysisResults.ts`). Hooks are the primary way the frontend interacts with the backend API.
-   **`contexts/`**: React context providers for managing global or shared state across the application (e.g., `AnalysisContext.tsx`).
-   **`lib/`**: Utility functions, query client configuration, and other shared frontend logic.

### `server/` - The Backend

The backend is a Node.js application using Express.js.

-   **`controllers/`**: These handle incoming HTTP requests, orchestrate the necessary business logic, and send back responses. They act as the bridge between the client and the backend services (e.g., `puzzleController.ts`).
-   **`services/`**: This is where the core business logic lives. Services are responsible for tasks like calling external AI APIs (`openai.ts`, `gemini.ts`), building prompts (`promptBuilder.ts`), and validating responses (`responseValidator.ts`).
-   **`repositories/`**: These classes are responsible for all database interactions. They contain the raw SQL queries and logic for creating, reading, updating, and deleting records (e.g., `ExplanationRepository.ts`, `AccuracyRepository.ts`, `CostRepository.ts`). Each repository follows Single Responsibility Principle (SRP) - handling only one domain concern. No other part of the application should interact with the database directly.
-   **`routes/`**: Defines the API endpoints and maps them to the appropriate controller functions.
-   **`utils/`**: Shared utility functions for the backend, such as logging and response formatting.

### `shared/` - Code for Both Client and Server

This directory contains code that is used by both the frontend and the backend.

-   **`types.ts`**: Contains TypeScript type definitions and interfaces (e.g., `ARCTask`, `AnalysisResult`) shared across the entire application to ensure type safety.

## Repository Architecture & Domain Separation

**🚨 CRITICAL**: As of September 24, 2025, the repository layer underwent a major architectural refactoring to eliminate Single Responsibility Principle (SRP) violations and ensure proper domain separation.

### Repository Design Principles

1. **Single Responsibility Principle (SRP)**: Each repository handles exactly one domain concern:
   - `AccuracyRepository` → Pure puzzle-solving correctness metrics only
   - `TrustworthinessRepository` → AI confidence reliability analysis only
   - `CostRepository` → All cost calculations and cost domain logic only
   - `MetricsRepository` → Aggregated analytics using delegation pattern

2. **DRY (Don't Repeat Yourself)**: No duplicate business logic across repositories:
   - Model name normalization handled by shared `utils/modelNormalizer.ts`
   - Cost calculations centralized in `CostRepository` only
   - Cross-repository data access via delegation pattern

3. **Domain Separation**: Related concerns are kept together, unrelated concerns are separated:
   - **WRONG**: TrustworthinessRepository calculating costs (mixing domains)
   - **RIGHT**: TrustworthinessRepository → trustworthiness, CostRepository → costs

### Critical Architectural History

**Problem Solved (September 2025)**: The system had severe SRP violations where:
- `TrustworthinessRepository` was calculating cost metrics (lines 342-343)
- `MetricsRepository` had duplicate cost logic with different business rules
- Same models showed different costs in different UI components due to inconsistent data sources

**Solution Implemented**: Complete domain separation with dedicated `CostRepository` following SRP/DRY principles.

### Repository Integration Pattern

Use `RepositoryService` for centralized access:

```typescript
// Access individual repositories through service
const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();
const costData = await repositoryService.cost.getAllModelCosts();
const trustworthinessData = await repositoryService.trustworthiness.getTrustworthinessStats();

// MetricsRepository aggregates data from multiple repositories
const dashboard = await repositoryService.metrics.getComprehensiveDashboard();
```

**⚠️ Developer Guideline**: When adding new features:
1. **Identify the domain** (accuracy, trustworthiness, cost, etc.)
2. **Add logic to the appropriate repository** (don't mix domains)
3. **Use delegation pattern** if multiple repositories needed
4. **Never duplicate business logic** across repositories

## Key Component Reference

This section provides a quick reference to the most important files in the project. Before starting a new task, review these files to see if the functionality you need already exists.

### Server-Side Components

| Directory | File | Description |
| :--- | :--- | :--- |
| `controllers` | `puzzleController.ts` | Orchestrates all puzzle-related operations, including analysis, fetching, and stats. |
| | `batchAnalysisController.ts` | Handles starting, pausing, and monitoring batch analysis sessions. |
| | `eloController.ts` | Manages ELO rating calculations and leaderboards for models. |
| | `costController.ts` | **NEW**: Handles all cost-related API endpoints following RESTful principles. |
| `services` | `puzzleAnalysisService.ts` | Core logic for analyzing a single puzzle, including prompt building and validation. |
| | `explanationService.ts` | Handles the saving and processing of AI-generated explanations. |
| | `aiServiceFactory.ts` | A factory that returns the correct AI provider service (e.g., OpenAI, Gemini) based on a model key. |
| | `pythonBridge.ts` | Manages communication with Python scripts for specialized solvers. |
| `repositories`| `ExplanationRepository.ts` | All database operations for the `explanations` table. |
| | `AccuracyRepository.ts` | Pure puzzle-solving accuracy metrics (boolean correctness only). |
| | `TrustworthinessRepository.ts` | AI confidence reliability analysis (no cost calculations). |
| | `CostRepository.ts` | **NEW**: All cost calculations and cost domain logic (SRP compliant). |
| | `MetricsRepository.ts` | Aggregated analytics from multiple repositories using delegation. |
| | `EloRepository.ts` | Database logic for storing and updating ELO scores. |

### Client-Side Components

| Directory | File | Description |
| :--- | :--- | :--- |
| `pages` | `PuzzleExaminer.tsx` | The main page for viewing a puzzle, triggering analysis, and displaying results. |
| | `PuzzleBrowser.tsx` | The primary dashboard for browsing and filtering all puzzles. |
| | `EloLeaderboard.tsx` | Displays the ELO rankings of all AI models. |
| | `ModelDebate.tsx` | **NEW**: AI-vs-AI debate interface for challenging incorrect explanations. |
| `components` | `PuzzleViewer.tsx` | A core component that displays the training and test grids for a puzzle. |
| | `AnalysisResultCard.tsx`| Renders a single AI model's explanation for a puzzle. |
| | `ModelButton.tsx` | A specialized button for triggering an analysis with a specific model. |
| | `debate/IndividualDebate.tsx` | **NEW**: Manages individual debate sessions with challenge generation. |
| | `debate/ExplanationsList.tsx` | **NEW**: Reusable explanation browsing with correctness filtering. |
| `hooks` | `usePuzzle.ts` | Fetches and manages the state for a single puzzle. |
| | `useAnalysisResults.ts`| Manages the state and logic for running analyses and handling results. |
| | `useExplanation.ts` | Fetches existing explanations for a puzzle from the database. |
| | `debate/useDebateState.ts` | **NEW**: Debate-specific state management (selected explanation, challenger model, etc.). |
| `contexts` | `AnalysisContext.tsx` | Provides shared state for analysis operations across different components. |

By familiarizing yourself with this structure, you can quickly identify where to find existing logic and where to add new features, ensuring that we continue to build upon the solid foundation of the ARC Explainer.
