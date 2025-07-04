# ARC-AGI Puzzle Examination Tool 🛸

An interactive web application for examining ARC-AGI (Abstract Reasoning Corpus - Artificial General Intelligence) puzzles through the lens of alien communication patterns. Rather than solving puzzles, this tool helps humans (especially children) understand abstract reasoning by translating complex grid patterns into space-themed emoji representations and providing AI-powered explanations of WHY solutions work.

## 🌟 Project Overview

This tool treats ARC-AGI puzzles as alien communication patterns that humans can study and decode. It loads real puzzles from the official fchollet/ARC-AGI repository, focuses on smaller grids (≤10x10 for better comprehension), and provides multiple AI model analyses to explain the underlying logic in simple terms.

### Key Features

- **Real Puzzle Data**: Direct integration with fchollet/ARC-AGI GitHub repository (400+ puzzles)
- **Space-Themed Translation**: Numbers converted to space emojis (🌌 ⭐ 🌙 etc.) for engaging visualization
- **AI Model Testing**: 7 different OpenAI models with transparent pricing information
- **Pattern Analysis**: AI explanations focused on WHY solutions are correct, not HOW to solve
- **Auto-Save System**: Analyzed puzzles automatically saved as JSON files for future reference
- **Child-Friendly**: Simple language explanations suitable for young learners

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd arc-agi-examination-tool
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   # Required for AI analysis
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Optional database (falls back to memory storage)
   DATABASE_URL=your_postgresql_url_here
   ```

3. **Run the Application**
   ```bash
   npm run dev
   ```

4. **Access the Tool**
   - Open http://localhost:5000
   - Browse puzzles by difficulty and grid size
   - Select a puzzle to examine with AI models

## 🧩 How It Works

### 1. Puzzle Loading
- Fetches real ARC-AGI puzzles from GitHub API
- Downloads and caches puzzle files locally
- Analyzes grid sizes and patterns for filtering

This is the prompt that is sent to the AI model:

const prompt = `You are helping idiot humans understand alien communication patterns. Look at this puzzle where we already know the correct answer.

TRAINING EXAMPLES (what the aliens taught us):
${trainingExamples}

TEST CASE (the aliens' question and our correct answer, but we don't understand why the answer is correct):
Input: ${JSON.stringify(task.test[0].input)}
Correct Answer: ${JSON.stringify(task.test[0].output)}

Your job:
1. Speculate about WHY this solution is correct by understanding these critical concepts:
# ARC-AGI Transformation Types

## Geometric Transformations
- Rotation (90°, 180°, 270°)
- Reflection (horizontal, vertical, diagonal)
- Translation (moving objects)
- Scaling (resize objects)

## Pattern Operations
- Pattern completion
- Pattern extension
- Pattern repetition
- Sequence prediction

## Logical Operations
- AND operations
- OR operations
- XOR operations
- NOT operations
- Conditional logic

## Grid Operations
- Grid splitting (horizontal, vertical, quadrant)
- Grid merging
- Grid overlay
- Grid subtraction

## Object Manipulation
- Object counting
- Object sorting
- Object grouping
- Object filtering

## Spatial Relationships
- Inside/outside relationships
- Adjacent/touching relationships
- Containment relationships
- Proximity relationships

## Color Operations
- Color mapping
- Color replacement
- Color pattern matching
- Color logic operations

## Shape Operations
- Shape detection
- Shape transformation
- Shape combination
- Shape decomposition

## Rule Inference
- Single rule application
- Multiple rule application
- Rule interaction
- Rule generalization

## Abstract Reasoning
- Symbol interpretation
- Semantic relationships
- Conceptual mapping
- Abstract pattern recognition


2. Explain it in simple terms an idiot could understand.  The user sees the puzzle as emojis, NOT AS NUMBERS.  
3. Make a creative guess for the user about what the aliens might be trying to communicate based on the transformation type you think is involved. 


4. The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:

0: ⬛ (no/nothing/negative)
1: ✅ (yes/positive/agreement)
2: 👽 (alien/them/we)
3: 👤 (human/us/you)
4: 🪐 (their planet/home)
5: 🌍 (human planet/Earth)
6: 🛸 (their ships/travel)
7: ☄️ (danger/bad/problem)
8: ♥ (peace/friendship/good)
9: ⚠️ (warning/attention/important)

Respond in this JSON format:
{
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
  "solvingStrategy": "Step-by-step how to solve it, for dummies.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation"
}`;

### 3. AI Model Analysis
Seven OpenAI models analyze puzzles with different capabilities and costs:

| Model | Input Cost | Output Cost | Type |
|-------|------------|-------------|------|
| GPT-4.1 Nano | $0.10/M | $0.40/M | Standard |
| GPT-4o Mini | $0.15/M | $0.60/M | Standard |
| GPT-4.1 Mini | $0.40/M | $1.60/M | Standard |
| o1-mini | $1.10/M | $4.40/M | Premium 💰 |
| o3-mini | $1.10/M | $4.40/M | Premium 💰 |
| o4-mini | $1.10/M | $4.40/M | Premium 💰 |
| GPT-4.1 | $2.00/M | $8.00/M | Premium 💰 |

### 4. Pattern Explanation
Each AI model provides:
- **Pattern Description**: What the alien communication rule appears to be
- **Solving Strategy**: How the pattern transforms input to output
- **Simple Explanations**: Child-friendly language describing the logic
- **Confidence Score**: AI's certainty about the analysis

### 5. Auto-Save System
- First analysis triggers automatic save to `data/explained/{taskId}-EXPLAINED.json`
- Includes original puzzle data, all model explanations, and timestamps
- Creates permanent record for future study and comparison

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
│   │   ├── githubService.ts    # Puzzle downloading from GitHub
│   │   ├── openai.ts          # AI model integration
│   │   ├── puzzleAnalyzer.ts  # Grid analysis utilities
│   │   ├── puzzleExporter.ts  # JSON export functionality
│   │   └── puzzleLoader.ts    # Puzzle loading and caching
│   ├── index.ts           # Express server setup
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Data storage interface
├── shared/                # Common types and schemas
│   ├── types.ts           # TypeScript interfaces
│   └── schema.ts          # Database schemas
├── data/                  # Puzzle data
│   ├── training/          # Downloaded ARC-AGI puzzles
│   └── explained/         # AI-analyzed puzzle exports
└── package.json
```

## 🎯 Core Features

### Puzzle Browser
- Filter by difficulty (easy/medium/hard)
- Filter by grid size (≤10x10 recommended)
- Real-time GitHub API integration
- Grid consistency analysis

### Puzzle Examiner
- Interactive grid display with space emojis
- Side-by-side training examples and test cases
- Multiple AI model testing with one-click analysis
- Real-time cost information and premium model warnings

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
- **React Query**: Server state management and caching
- **Wouter**: Lightweight client-side routing

### Backend (Express + TypeScript)
- **Express.js**: RESTful API server
- **OpenAI API**: Multiple model integration with fallback handling
- **GitHub API**: Real-time puzzle fetching
- **Drizzle ORM**: Type-safe database operations (PostgreSQL)

### Data Pipeline
- **Real-time GitHub fetching**: Direct API calls to fchollet/ARC-AGI
- **Local caching**: File system storage for downloaded puzzles
- **Metadata extraction**: Grid size, difficulty, pattern analysis
- **Export automation**: JSON file generation with comprehensive data

## 🌍 Environment Configuration

### Required Environment Variables
```bash
OPENAI_API_KEY=sk-...          # OpenAI API access
```

### Optional Environment Variables
```bash
DATABASE_URL=postgresql://...   # PostgreSQL database (fallback to memory)
NODE_ENV=development           # Environment mode
```

## 📊 Usage Examples

### Examining a Puzzle
1. Visit the home page
2. Click "Browse Puzzles"
3. Filter by grid size (≤10x10 recommended)
4. Select a puzzle to examine
5. Click AI model buttons to analyze patterns


### Accessing Saved Analyses
- Analyzed puzzles automatically save to `data/explained/`
- Files named: `{puzzleId}-EXPLAINED.json`
- Contains all model explanations for comparison

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
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
```

## 🎨 Design Philosophy

### Child-Centered Approach
- Space themes make abstract patterns engaging
- Simple language explanations suitable for young learners
- Visual emoji representations easier to understand than numbers
- Focus on WHY patterns work, not memorizing solutions

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

*"Every puzzle is a message from another world, waiting to be understood."* 🛸