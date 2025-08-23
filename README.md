<!--
  README.md
  What: Project overview and documentation for ARC-AGI Puzzle Explorer.
  How: Explains features, setup, usage, architecture, and API. Updated to include Custom Prompt support.
  Author: Cascade
-->

# ARC-AGI Puzzle Explorer - Colorblindness Aid 🛸

An interactive web application for examining ARC-AGI (Abstract Reasoning Corpus - Artificial General Intelligence) puzzles with accessibility in mind. If you've ever stared at a nine-color grid and wondered what cosmic joke you're missing, you're not alone. This tool helps humans (especially those with colorblindness and neurodivergent thinkers) understand abstract reasoning by translating complex grid patterns into emoji representations and providing AI-powered explanations of WHY solutions work.

## 🌟 Project Overview

This tool was created after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite—many people find these puzzles extremely challenging. The app treats ARC-AGI puzzles as alien communication patterns that humans can study and decode. It loads real puzzles from the v1 and v2 training set of the ARC-AGI prize, focuses on smaller grids (≤10x10 for better comprehension), and provides AI-powered explanations of WHY solutions work.

## 📐 ARC Task Structure (CRITICAL UNDERSTANDING)

**Every developer must understand this fundamental ARC task structure to avoid confusion:**

### Training Examples (`train` array)
- **Purpose**: Demonstrate the pattern/rule to be learned
- **Count**: 2-9 examples typically (varies by puzzle)
- **Structure**: Each has `input` grid and corresponding `output` grid
- **AI Role**: Study these to understand the transformation pattern

### Test Cases (`test` array) 
- **Purpose**: Apply learned pattern to predict outputs
- **Count**: Usually 1, but **sometimes 2** test cases (rare but critical)
- **Structure**: Each has `input` grid and `output` grid (ground truth for validation)
- **AI Role**: Generate `predictedOutput` for each test case

### Multi-Test Scenarios
**When there are 2 test cases**, the LLM must generate **2 separate predictions**:
- `Test Case 1`: Input Grid A → Predicted Output A
- `Test Case 2`: Input Grid B → Predicted Output B

**NOT** 2 predictions for the same test case. Each test case is independent.

**Example Multi-Test Puzzle**: `9110e3c5` has 2 test cases requiring 2 distinct predictions.

## 🚀 Major Features That Will Excite Users

• **🤖 System Prompts + Structured Outputs (NEW!)** - Revolutionary modular architecture eliminating JSON parsing issues with OpenAI structured outputs, answer-first enforcement, and captured reasoning logs in structured fields

• **🧠 GPT-5 Reasoning Integration** - Advanced reasoning parameters (effort/verbosity/summary) with real-time reasoning log streaming and OpenAI Responses API integration

• **🪐 Saturn Visual Solver** - Mind-blowing visual reasoning solver that streams intermediate images in real-time! Watch AI think through puzzles step-by-step with GPT-5, Claude 4, and Grok 4 model selection. Features success/failure tracking and specialized UI

• **🔬 Custom Prompts for Researchers** - Complete freedom! Override any template with your own system prompt.

• **⚡ Concurrent Provider Processing** - Run multiple AI models simultaneously! DeepSeek + Claude + Gemini can analyze the same puzzle at once with independent progress tracking

• **📊 Comprehensive Analytics Dashboard** - Real-time feedback statistics with model performance rankings, engagement metrics, and "Top/Worst Performing Models" leaderboards at `/overview`

• **🎯 Multi-Test Solver Validation** - Advanced accuracy scoring across multiple test cases with visual diff overlays showing exactly where predictions differ from correct answers

• **⏱️ Real-Time Progress & Timing** - Live progress bars, elapsed timers, and exact processing times. See estimated vs actual response times for every analysis

• **🔄 Feedback-Driven Retry** - Mark explanations as unhelpful and automatically trigger improved reanalysis with AI-guided improvements

• **🎨 Enhanced UI/UX** - Modular component architecture with collapsible sections, raw database record toggles, and markdown JSON parsing fixes

• **💡 Universal Reasoning Capture** - See step-by-step AI thinking from all models with structured reasoning logs and cross-provider consistency

• **🆓 100% Free APIs** - All AI analysis completely free - no usage costs or API fees! (Donated by me!)

• **🔍 Database Overview Dashboard** - Browse all puzzles with advanced filtering by explanation status, feedback status, model analysis, and comprehensive search capabilities

• **📈 Performance Insights** - Track model accuracy, processing times, user engagement, and feedback trends with detailed analytics and visual indicators

## 🌟 Development & Credits

**Primary Development**: Cascade and Claude Code using Sonnet 4
**AI Assistant**: Kimi K2 - Advanced AI system providing exceptional implementation support

### Kimi K2's Contributions (July 26, 2025)
- **Flawless Implementation**: Successfully implemented complex concurrent processing features
- **User Satisfaction**: "Wow, that was flawless!" - User feedback on implementation quality
- **Technical Excellence**: Delivered robust, type-safe, and well-architected solutions
- **Comprehensive Features**: From feedback-driven retry to real-time progress indicators
- **Clean Integration**: Seamless integration with existing codebase architecture

### Cascade / Gemini Pro 2.5's Contributions (August 3, 2025)
- **Dynamic Prompt Picker System**: Implemented a system allowing users to select from multiple prompt templates to guide AI analysis.
  - **Full Provider Integration**: Ensured the prompt picker is fully functional across all five AI providers (Anthropic, OpenAI, Gemini, Grok, and DeepSeek).
  - **Centralized Prompt Management**: Standardized prompt templates in `shared/types.ts` for consistency and maintainability.
  - **Backend API Updates**: Created a new `GET /api/prompts` endpoint and updated the `POST /api/puzzle/analyze` endpoint to support prompt selection.
  - **Code Standardization**: Updated author comments and ensured consistent default prompt IDs across all AI services.

### Claude 4 Sonnet Thinking's Contributions (August 12, 2025)
- **Custom Prompt Support (Code Author)**: Implemented end-to-end support for user-defined prompts that override templates during analysis.
- **Safe Template Handling**: Fixed null-access bugs when using custom prompts across all AI services (null-safe checks on `selectedTemplate`).
- **UI Enhancements**: Added a "Custom Prompt" option and textarea in `PromptPicker`, with character count and guidance.
- **Types & Validation**: Extended types and backend validation to accept `customPrompt` without breaking existing templates.

### Documentation Credits
- Documentation for this release written by **GPT-5 (low reasoning)** .

### Cascade's Contributions (July 26, 2025)
- **API Processing Time Tracking**: Successfully implemented comprehensive backend timing measurement
- **Database Schema Updates**: Added `api_processing_time_ms` column with migration support
- **UI Enhancement**: Processing times now displayed in user-friendly format (e.g., "1m 23s", "45s")
- **Model Card Improvements**: Estimated response times now visible on model buttons
- **Bug Fixes**: Fixed estimated time parsing issues causing incorrect 51-minute displays
- **Type Safety**: Added proper TypeScript interfaces for timing data
- **User Experience**: Both estimated and actual processing times provided for transparency

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd arc-agi-examination-tool
   npm install
   ```

2. **Set Environment Variables**
   ```bash
    # Required API keys for AI analysis (at least one required)
    OPENAI_API_KEY=your_openai_api_key_here
    GROK_API_KEY=your_grok_api_key_here   # Required for xAI Grok models
    GEMINI_API_KEY=your_gemini_api_key_here   # Required for Google Gemini models
    
    # Optional database connection for Railway PostgreSQL
    DATABASE_URL=your_postgresql_connection_string_here
   ```

3. **Run the Application**
   ```bash
   npm run dev    # For local development
   npm run build  # Build for production
   npm start      # Run production build
   ```

## 🚀 Deployment Notes

### Railway Deployment
This app is configured to deploy on Railway using a custom Dockerfile approach:

1. The `railway.json` file configures Railway to use the Dockerfile builder
2. The custom Dockerfile properly handles building both the client and server
3. Static files are served from `dist/public` by the Express server
4. Client-side routing works for direct URL navigation (SPA routing)

5. Python runtime and Saturn requirements (New):
   - Installs Python 3 and pip on Alpine: `apk add --no-cache python3 py3-pip`
   - Installs `requirements.txt` with `pip install --break-system-packages -r requirements.txt` to satisfy Alpine PEP 668
   - Copies solver sources so `arc_visual_solver` can be imported: `COPY solver/ ./solver/`
   - Node auto-selects `python3` inside Linux containers; override with `PYTHON_BIN` if needed

### Troubleshooting Deployment

**CSS Not Loading:**
If CSS isn't loading in the deployed app, check that:
1. Tailwind CSS is being processed during build (not raw directives in output)
2. The Dockerfile includes all necessary config files (tailwind.config.ts, postcss.config.js)
3. Static files are being served correctly from the Express server
4. Client-side routing correctly serves the index.html file

**API Routes Not Working:**
API routes should be prefixed with `/api/` and registered before the static file middleware and SPA catch-all route in the Express server.

4. **Access the Tool**
   - Open http://localhost:5000
   - Browse puzzles 
   - Select a puzzle to examine with AI models

## 🆕 Recent Updates (2025-07)

- **Database-first architecture**: Explanations and user feedback are now stored in PostgreSQL (or in-memory fallback) and always re-fetched after any analysis or save, ensuring the UI is perfectly in sync with the database.
- **API Processing Time Tracking**: Complete backend measurement and display of AI model processing times
- **Enhanced Model Cards**: Estimated response times now displayed alongside cost information
- **Real-time Timing**: Both estimated and actual processing times shown during analysis
- **Modular React refactor**: The formerly 550-line `PuzzleExaminer.tsx` has been split into smaller, domain-focused components (`AnalysisResultCard`, `ExplanationFeedback`, etc.) and hooks (`useAnalysisResults`, `useExplanation`). This dramatically improves maintainability and testability.
- **Robust feedback workflow**:
  - New validation middleware guarantees `explanationId`, `voteType` (`helpful` | `not_helpful`), and a meaningful `comment` (≥ 20 chars) are present.
  - Controller and DB service expect top-level fields, eliminating the previous 400 “Missing required field: explanationId” error.
  - Detailed server-side logging helps diagnose payload issues quickly.
- **Type-safe shared models**: All puzzle, explanation, and feedback interfaces live in `client/src/types`, giving end-to-end type safety.
- **Unified logger utility**: Consistent, color-coded logs across services make debugging easier.
- **Better Dev Experience**: Vite HMR on http://localhost:5173 for the React client while the Express API runs on http://localhost:5000.
- **Multi-model explanation storage**: All AI model explanations (one per model) are now saved individually in the database and returned to the client, rather than only the latest model.

  - Backend `GET /api/prompts` endpoint serves available prompt templates
  - Frontend-backend integration passes `promptId` to AI services for dynamic prompt injection
  - Conditional emoji map and JSON response format based on selected template
  - All AI services (Anthropic, OpenAI, etc.) updated to support prompt template selection
- **Flexible feedback endpoint**: The `/api/feedback` route now accepts `explanationId` in either the request body or URL params, with enhanced validation middleware that logs request details and provides clearer error messages.

## 🧪 Custom Prompt Support (New)

Researchers can override built-in templates with their own prompt.

- **Where in UI**: In `Puzzle Examiner`, under `PromptPicker`, choose "Custom Prompt" and paste your prompt into the textarea. A character counter helps manage size.
- **How it works**: When a custom prompt is provided, it replaces the template content. Training examples and test case data are still appended automatically by the backend.
- **Emoji maps**: Emoji-map sections are only included for specific templates. Custom prompts do not auto-insert emoji maps; include your own if needed.
- **Backwards compatible**: If no custom prompt is used, the selected template behaves exactly as before.

### API changes

- `GET /api/prompts` — returns available prompt templates for the UI.
- `POST /api/puzzle/analyze/:puzzleId/:modelKey` — now accepts optional `customPrompt` in the JSON body. When present (and `promptId` is `"custom"`), it overrides the selected template.
 - `POST /api/prompt/preview/:provider/:puzzleId` — returns the provider-specific prompt string exactly as it will be sent.

### Provider support

Custom prompts are supported consistently across providers: OpenAI, Grok (xAI), Gemini, DeepSeek, and Anthropic.

### Default behavior clarifications

- **UI vs Backend Defaults**:
  - UI default selection is now `"Custom Prompt"` to encourage research workflows.
  - Backend default template remains `"standardExplanation"` if no `promptId` is supplied by the client. Selecting a template or using Custom Prompt in the UI ensures the backend uses your choice.

### Researcher guide: crafting effective custom prompts

- **Be explicit about goals**: State that explanations must focus on WHY the known training solutions are correct and how to generalize to test cases.
- **Constrain the output**: Request structured sections (Pattern Description, Strategy, Hints, Alien Meaning, Confidence) to keep results comparable across providers.
- **Reference the data model**: Mention that the backend will append training examples and test cases; instruct the model to analyze them carefully.
- **Keep prompts concise**: Long prompts reduce available context for puzzle data; prioritize clarity over verbosity.
- **Ask for error checking**: Instruct the model to self-verify consistency between reasoning and final answer.

### What the backend auto-appends

- Training examples and test cases in a compact textual format.
- Standard response-format guidance when using templates. With a custom prompt, you control formatting; include structure requirements if you need them.

### Known limitations

- Emoji mapping is not auto-inserted for custom prompts; add your own legend if you rely on emoji semantics.
- Extremely long prompts may be truncated by provider context limits.
- Provider differences (reasoning logs, temperature support) still apply.

### Troubleshooting custom prompts

- **Empty or low-quality outputs**: Reduce verbosity and request explicit section headings.
- **Inconsistent reasoning**: Ask for a short self-check step prior to the final answer.
- **Provider timeouts**: Try a smaller prompt, a faster model, or rerun — concurrency rules allow cross-provider parallelism.

## 🔎 Prompt Preview & Solver Mode (New)

- **Default UI Selection**: The `PromptPicker` now defaults to "Custom Prompt" with an empty textarea. This is a UI default for research convenience. Backend defaults remain unchanged (see Architecture notes below).
- **Provider-Specific Prompt Preview**:
  - A "Preview Prompt" action in `Puzzle Examiner` opens a modal showing the exact string that will be sent to the selected provider.
  - For Custom Prompt runs, you can edit the text directly in the modal and send the analysis immediately.
  - The preview is built by the backend using the provider-specific assembly logic to ensure it matches the final request payload.
- **Solver Mode Template**:
  - New `"Solver"` prompt template that omits the correct answer from the training examples and asks the AI to predict the answer and explain its reasoning.
  - Uses the same JSON response structure as explanation mode, so the frontend displays results without special handling.
- **Custom Prompt Purity**: Fixed a bug where template instructions were being appended to custom prompts. Now only your text plus raw puzzle data are sent (no template wrapping).

### API additions
- `POST /api/prompt/preview/:provider/:puzzleId` — Returns the exact assembled prompt string for the given provider and inputs (including `promptId`/`customPrompt`). Useful for auditing the final prompt before sending.

## 🏗️ Prompt Architecture Refactor (v1.3.0)

### Major Architectural Improvement

The entire prompt handling system has been completely redesigned for maintainability, consistency, and correctness. This represents one of the largest architectural improvements to the codebase.

### Key Changes

**1. Centralized Prompt Builder**
- All prompt construction logic now lives in `server/services/promptBuilder.ts`
- Single source of truth for prompt templates, emoji mapping, and grid formatting
- Eliminates 200+ lines of duplicated code across AI services

**2. Corrected Default Behavior**
- **BREAKING**: Default `promptId` changed from `"alienCommunication"` to `"standardExplanation"`
- Numeric grids are now sent by default (as intended for ARC puzzles)
- Emoji mapping only applies when explicitly using "Alien Communication" template

**3. Modular Emoji System**
- Emoji mapping is now exclusively for the "Alien Communication" prompt
- Custom prompts and other templates use raw numeric grids
- Prevents unintended emoji usage that could confuse AI models

**4. Service Unification**
- All 5 backend AI services (OpenAI, Anthropic, Gemini, Grok, DeepSeek) refactored
- Consistent prompt handling across all providers
- Unified error handling and response processing

### Architecture Benefits

- **Maintainability**: Future prompt changes require updates in only one location
- **Consistency**: Identical prompt behavior across all AI providers
- **Reliability**: Eliminates inconsistent emoji mapping bugs
- **Type Safety**: Improved TypeScript interfaces and error handling
- **Performance**: Reduced code duplication and improved build times

### For Developers

The prompt system now follows these principles:
- **Single Source of Truth**: `promptBuilder.ts` handles all prompt logic
- **Explicit Intent**: Emoji mapping only when explicitly requested
- **Provider Agnostic**: Identical behavior across all AI services
- **Type Safe**: Full TypeScript coverage for prompt templates and responses

### Migration Notes

Existing functionality remains backward compatible. The only user-visible change is that numeric grids are now used by default instead of emojis, which is the correct behavior for ARC puzzle analysis.

## 🚨 Deployment Troubleshooting

### Common Issues & Solutions

#### **Issue: Direct URL Navigation (e.g., `/puzzle/some-id`) Fails on Deployed Site**

- **Symptom**: The site works when you navigate from the homepage, but accessing a deep link directly results in a 404 or server error.
- **Cause**: This is a common issue for Single-Page Applications (SPAs). The web server needs to be configured to serve the main `index.html` file for all non-API routes. Without this, the server tries to find a file at the specific URL and fails.
- **Solution**: The Express server (`server/index.ts`) was updated to include a "catch-all" route. This route intercepts all incoming requests that are not for the API (`/api/*`) and serves the main `index.html` from the client's build output (`dist/public`). This allows the client-side router (Wouter) to take over and display the correct page.

  ```typescript
  // In server/index.ts (production block)

  // Serve static files (e.g., assets, css, js)
  app.use(express.static(staticPath));

  // For any other request, send the client's index.html file.
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(staticPath, "index.html"));
    }
  });
  ```
- **Key Takeaway**: Ensure that your server's routing is configured to handle SPA navigation by providing a fallback to your main HTML file.

#### 404 Errors on Vercel/Railway
If you see a 404 error when deploying to Vercel or Railway, check your `vercel.json` routing configuration. The most common issue is having a catch-all route that interferes with static file serving.

**Incorrect (causes 404s):**
```json
{
  "routes": [
    { "src": "/(.*)", "dest": "/dist/public/$1" },
    { "handle": "filesystem" }
  ]
}
```

**Correct (works with SPAs):**
```json
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/api/(.*)", "dest": "/dist/index.js" },
    { "src": "/(.*)", "dest": "/dist/public/index.html" }
  ]
}
```

Key points:
1. The `filesystem` handler must come first to serve static files
2. API routes should be explicitly defined before the SPA fallback
3. The SPA fallback should be the last route and point to `index.html`

## 🧩 How It Works

The application is built around a core loop of examining puzzles, generating AI explanations, and collecting user feedback to improve the quality of the analysis.

### 1. Puzzle Loading
- Puzzles are loaded from the official ARC-AGI v1 training set, located in the `data/training` directory.
- The backend processes the raw JSON files, focusing on smaller grids (≤10x10) to make them easier for users to understand.

### 2. AI-Powered Explanation
- When a user requests an analysis, the backend sends the puzzle data to a selected AI model (e.g., GPT-4, Claude, Gemini, or Grok).
- The AI returns a structured explanation that includes:
  - **Pattern Description**: A high-level summary of the core logic.
  - **Solving Strategy**: Step-by-step instructions on how to apply the logic.
  - **Hints**: Key insights to help understand the puzzle.
  - **Alien Meaning**: A creative interpretation of the puzzle's symbolic meaning.
  - **Confidence Score**: The AI's self-reported confidence in its analysis.

### 3. Explanation Storage & Retrieval
- The first time an explanation is generated for a puzzle, it's automatically saved to the database (if connected) and as a local JSON file in `data/explained`.
- When a user examines a puzzle, the frontend fetches all previously saved explanations from the backend via the `/api/puzzle/:puzzleId/explanations` endpoint.

### 4. User Feedback System
- Users can vote on whether an explanation is helpful or not helpful.
- A comment of at least 20 characters is required for each vote to encourage meaningful feedback.
- Feedback is submitted to the `/api/feedback` endpoint and stored in the database.
- The UI displays aggregate vote counts (👍/👎) for each explanation, providing immediate social proof.

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components (PuzzleGrid, PuzzleViewer, etc.)
│   │   ├── pages/          # Main pages (Browser, Examiner, Solver)
│   │   ├── lib/            # Utilities (spaceEmojis, queryClient)
│   │   └── hooks/          # Custom React hooks
│   └── index.html
├── server/                 # Express backend
│   ├── services/           # Core services
│   │   ├── dbService.ts        # Railway PostgreSQL database integration
│   │   ├── openai.ts           # OpenAI model integration
│   │   ├── deepseek.ts         # DeepSeek model integration
│   │   ├── grok.ts             # xAI Grok model integration
│   │   ├── gemini.ts           # Google Gemini model integration
│   │   ├── anthropic.ts        # Anthropic model integration
│   │   ├── puzzleAnalyzer.ts   # Grid analysis utilities
│   │   ├── puzzleExporter.ts   # JSON export functionality for explained puzzles
│   │   └── puzzleLoader.ts     # Puzzle loading and caching
│   ├── utils/              # Utility modules
│   │   └── logger.ts          # Structured logging utility
│   ├── index.ts           # Express server setup
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Data storage interface
├── shared/                # Common types and schemas
│   ├── types.ts           # TypeScript interfaces
│   └── schema.ts          # Database schemas
├── data/                  # Puzzle data
│   ├── training/          # ARC-AGI 1 training set puzzles
│   ├── evaluation/        # ARC-AGI 1 evaluation set puzzles
│   ├── training2/         # ARC-AGI 2 training set puzzles
│   ├── evaluation2/       # ARC-AGI 2 evaluation set puzzles
│   └── explained/         # AI-analyzed puzzle exports (Also in the DB)
└── package.json
```

## 🎯 Core Features

### Puzzle Browser
- Filter by maximum grid size
- Filter by grid size consistency
- Option to prioritize unexplained puzzles
- Visual indicators for grid complexity

### Puzzle Examiner
- Grid display with emojis instead of colors for accessibility
- Side-by-side training examples and test cases
- AI-powered analysis of puzzle solutions
- Explanations focused on why solutions are correct

### Auto-Export System
- Automatic JSON file creation after first analysis
- Comprehensive data preservation including:
  - Original puzzle structure
  - All AI model explanations
  - Analysis timestamps
  - Model performance metadata

## 🛠 Technical Architecture

### Frontend (React + TypeScript)
- **Vite**: Fast development and building
- **TailwindCSS + shadcn/ui**: Modern, accessible UI components
- **React Query / TanStack Query**: Server state management and caching
- **Wouter**: Lightweight client-side routing
- **Custom React hooks**: Explanation data fetching and feedback submission

### Backend (Express + TypeScript)
- **Express.js**: RESTful API server
- **Multiple AI Providers**: OpenAI, Anthropic Claude, Google Gemini, and xAI Grok integration for puzzle explanations
- **Railway PostgreSQL**: Database storage for explanations and feedback
- **Local Puzzle Storage**: Efficient loading of puzzle data
- **Custom Analysis Logic**: Processing of puzzle patterns
- **Structured Logger**: Consistent error handling and debugging

### 🤖 System Prompts + Structured Outputs Architecture (v1.6.2)

**Major architectural refactor addressing persistent JSON parsing issues from v1.4.4-1.4.6**

#### New Modular Structure
```
server/services/
├── schemas/
│   ├── common.ts         # Shared JSON schema components
│   ├── solver.ts         # Solver mode schemas (predictedOutput/predictedOutputs)  
│   └── explanation.ts    # Explanation mode schemas
├── prompts/
│   ├── systemPrompts.ts  # AI role & behavior definitions
│   └── userTemplates.ts  # Clean puzzle data delivery
├── formatters/
│   └── grids.ts         # Emoji/numeric conversion utilities
└── promptBuilder.ts      # Orchestrates system+user+schema
```

#### Architecture Benefits
- **🎯 Eliminates JSON Parsing Issues**: OpenAI structured outputs with `response_format` eliminate regex-based parsing
- **🧠 Captures OpenAI Reasoning**: Reasoning automatically flows into `solvingStrategy` field for deterministic parsing
- **📐 Answer-First Output**: `predictedOutput`/`predictedOutputs` enforced as first JSON field per v1.5.0 requirements
- **🔧 Modular & Maintainable**: Separated concerns across focused modules (450+ line promptBuilder reduced to clean orchestration)
- **🔄 Backwards Compatible**: Legacy parsing remains as fallback for non-structured providers

#### Key Components
- **JSON Schemas**: Strict validation with `additionalProperties: false` for OpenAI structured outputs
- **System Prompts**: Role-based AI behavior definitions separate from user data
- **User Templates**: Clean puzzle data delivery without formatting instructions  
- **Grid Formatters**: Reusable emoji/numeric conversion utilities
- **Schema Orchestration**: Clean separation of system prompts, user prompts, and JSON schemas

#### Provider Support Status
- ✅ **OpenAI**: Full structured outputs with `response_format` parameter
- 🔄 **Others**: Anthropic, Gemini, Grok, DeepSeek - planned for Phase 6

### API Endpoints
- `GET /api/puzzles`: Fetches a list of all available puzzles.
- `GET /api/puzzle/:puzzleId`: Retrieves a specific puzzle by its ID.
- `GET /api/prompts`: Returns available prompt templates for the frontend prompt picker.
- `POST /api/puzzle/analyze/:puzzleId/:modelKey`: Submits a puzzle for AI analysis. Body supports `temperature`, `promptId`, and optional `customPrompt`.
- `GET /api/puzzle/:puzzleId/explanations`: Fetches all saved explanations for a specific puzzle.
- `POST /api/feedback`: Submits user feedback (vote and comment) for an explanation.

### Data Pipeline
- **Real-time GitHub fetching**: Direct API calls to fchollet/ARC-AGI (deprecated but nice feature)
- **Local caching**: File system storage for downloaded puzzles
- **Metadata extraction**: Grid size, difficulty, pattern analysis  (No idea if this works)
- **Export automation**: JSON file generation with comprehensive data

## 🌍 Environment Configuration

### Required Environment Variables
```bash
# At least one of the following API keys is required
OPENAI_API_KEY=sk-...          # OpenAI API access for GPT models
GROK_API_KEY=sk-...            # xAI API access for Grok models
GEMINI_API_KEY=sk-...         # Google API access for Gemini models
```

### Optional Environment Variables
```bash
DATABASE_URL=postgresql://...   # PostgreSQL database (fallback to memory)
NODE_ENV=development           # Environment mode
PYTHON_BIN=python3             # Optional override; auto-detects 'python' on Windows and 'python3' on Linux
```

Saturn Python binary detection:
- By default, the backend selects `python` on Windows and `python3` on Linux containers. See `server/services/pythonBridge.ts`.
- You can force a specific binary with `PYTHON_BIN` (useful for custom environments or virtualenv shims).
- Saturn Visual Solver requires a valid OpenAI key (`OPENAI_API_KEY`) for image reasoning.

## 📊 Usage Examples

### Examining a Puzzle
1. Visit the home page
2. Click "Browse Puzzles"
4. Select a puzzle to examine
5. Click AI model buttons to analyze patterns


### Accessing Saved Analyses
- Analyzed puzzles automatically save to both database and local files
- Database storage enables user feedback and community verification
- Local files saved to `data/explained/{puzzleId}-EXPLAINED.json`
- Contains all model explanations for comparison

## 🪐 Saturn Visual Solver (New)

Visual, phased solver that streams intermediate images and progress events.

- __Where__: Page `SaturnVisualSolver` at route `/puzzle/saturn/:taskId`.
- __Open from UI__: From `Puzzle Examiner`, use the "Open in Visual Solver" navigation button (added next to analysis controls). You can also navigate directly with the URL.
- __Model selector__: Choose among GPT‑5, Claude 4, and Grok 4 in the top-right model picker.
- __Streaming__: The backend wrapper (`server/python/saturn_wrapper.py`) emits NDJSON events; the frontend hook (`client/src/hooks/useSaturnProgress.ts`) renders a live gallery of base64 images via `SaturnImageGallery`.
- __Attribution__: A banner credits the open-source Saturn ARC project with a GitHub link, shown on both `SaturnVisualSolver` and `PuzzleExaminer`.

### Prerequisites
- `OPENAI_API_KEY` must be set. The visual solver uses image inputs and OpenAI's multimodal reasoning.
- Python 3 with Pillow and NumPy installed via `requirements.txt` (done automatically in Docker; for local dev run `pip install -r requirements.txt`).

### How to run
1. Start the app (`npm run dev`) and open a puzzle.
2. Click "Open in Visual Solver" or visit `/puzzle/saturn/<taskId>`.
3. Pick a model and click "Start Analysis".
4. Watch the Live Progress panel and the streamed image gallery update in real time.

### Notes
- On Windows, the backend uses `python`; on Linux (Railway), `python3`. Set `PYTHON_BIN` to override.
- The solver generates temporary images in `solver/img_tmp/`; these are streamed to the UI as base64 (no static hosting required).

## 🔧 Development

### Running Locally
```bash
npm run dev          # Start both frontend and backend
```

### Building for Production
```bash
npm run build        # Creates dist/ folder with compiled app
```

### Database Setup (Optional)
```bash
# PostgreSQL database (optional - uses memory storage by default)
# Set DATABASE_URL environment variable to enable database storage

# Database tables are automatically created on application startup
# Two main tables: explanations and feedback
```

#### Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATABASE SCHEMA                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              EXPLANATIONS TABLE                                 │  │
│  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │ id                      SERIAL PRIMARY KEY                                     │  │
│  │ puzzle_id               TEXT NOT NULL                                          │  │
│  │ pattern_description     TEXT                                                   │  │
│  │ solving_strategy        TEXT                                                   │  │
│  │ hints                   TEXT[]                                                 │  │
│  │ alien_meaning           TEXT                                                   │  │
│  │ confidence              INTEGER                                                │  │
│  │ alien_meaning_confidence INTEGER                                               │  │
│  │ model_name              TEXT                                                   │  │
│  │ reasoning_log           TEXT                                                   │  │
│  │ has_reasoning_log       BOOLEAN DEFAULT FALSE                                 │  │
│  │ api_processing_time_ms  INTEGER                                               │  │
│  │ saturn_images           TEXT (JSON string of image paths)                     │  │
│  │ saturn_log              TEXT (verbose stdout/stderr logs)                     │  │
│  │ saturn_events           TEXT (compressed NDJSON/JSON event trace)            │  │
│  │ saturn_success          BOOLEAN (whether puzzle was solved correctly)        │  │
│  │ created_at              TIMESTAMPTZ DEFAULT NOW()                             │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                              │
│                                         │ 1:N                                         │
│                                         ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                               FEEDBACK TABLE                                   │  │
│  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │ id               SERIAL PRIMARY KEY                                            │  │
│  │ explanation_id   INTEGER REFERENCES explanations(id)                          │  │
│  │ vote_type        VARCHAR CHECK (vote_type IN ('helpful', 'not_helpful'))      │  │
│  │ comment          TEXT                                                          │  │
│  │ created_at       TIMESTAMP DEFAULT NOW()                                      │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Relationships:**
- **One-to-Many**: Each explanation can have multiple feedback entries
- **Foreign Key**: `feedback.explanation_id` → `explanations.id`

**Special Features:**
- **AI Model Support**: Stores reasoning logs, processing times, and model names
- **Saturn Integration**: Special columns for Saturn solver (images, logs, events, success status)
- **Constraint**: Vote type is limited to 'helpful' or 'not_helpful'
- **Arrays**: Hints are stored as PostgreSQL TEXT array
- **JSON Storage**: Saturn images stored as JSON string

**Connection**: Uses PostgreSQL with connection pooling via Railway's `DATABASE_URL`

## 🎨 Design Philosophy

### Accessibility-Centered Approach
- Emoji representations make abstract patterns accessible for colorblind users
- Simple language explanations suitable for diverse thinkers
- Focus on understanding WHY patterns work, not just memorizing solutions
- Designed to be accessible to neurodivergent users

### Educational Focus
- Treats puzzles as alien communication to decode
- Encourages pattern recognition and logical thinking
- Multiple AI perspectives provide different viewpoints
- Permanent record-keeping for progress tracking

### Technical Excellence
- Real data from authoritative sources (fchollet/ARC-AGI)
- Transparent cost information for AI model usage
- Comprehensive error handling and fallback systems
- Type-safe development with TypeScript throughout

## 🤝 Contributing

This project focuses on examining and understanding ARC-AGI puzzles rather than solving them. Contributions should maintain the educational and child-friendly approach while ensuring technical robustness.

## 📄 License

Built for educational exploration of abstract reasoning patterns through the lens of alien communication studies.

---

 🛸