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
   - Browse puzzles 
   - Select a puzzle to examine with AI models

## 🚨 Deployment Troubleshooting

### Common Issues & Solutions

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

### 1. Puzzle Loading
- Uses real ARC-AGI puzzles from arc-explainer\data\training
- ???? 
- ????


### 4. Pattern Explanation
Each AI model provides:
- **Pattern Description**: What the alien communication rule appears to be
- **Solving Strategy**: How the pattern transforms input to output
- **Simple Explanations**: Child-friendly language describing the logic
- **Confidence Score**: AI's certainty about the analysis
- **Alien Meaning**: What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions. 

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
│   │   ├── githubService.ts    # Puzzle downloading from GitHub NOT USED!!!
│   │   ├── openai.ts          # AI model integration
│   │   ├── puzzleAnalyzer.ts  # Grid analysis utilities
│   │   ├── puzzleExporter.ts  # JSON export functionality for explained puzzles
│   │   └── puzzleLoader.ts    # Puzzle loading and caching   Possibly poorly architected or designed 
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
- Filter by sizes (No idea if this works)
- Filter by grid size (No idea if this works)
- Real-time GitHub API integration  (Pretty sure we arent using this but might be nice for later?)
- Grid consistency analysis (No idea if this works)

### Puzzle Examiner
- grid display with space emojis
- Side-by-side training examples and test cases
- Multiple AI model testing with one-click analysis
- cost information and premium model warnings

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
- **Claude API**: Multiple model integration with fallback handling
- **GitHub API**: Real-time puzzle fetching (Not using)
- **Drizzle ORM**: Type-safe database operations (PostgreSQL)

### Data Pipeline
- **Real-time GitHub fetching**: Direct API calls to fchollet/ARC-AGI (deprecated but nice feature)
- **Local caching**: File system storage for downloaded puzzles
- **Metadata extraction**: Grid size, difficulty, pattern analysis  (No idea if this works)
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
4. Select a puzzle to examine
5. Click AI model buttons to analyze patterns


### Accessing Saved Analyses
- Analyzed puzzles automatically save to `data/explained/`  (where does this go without a database?)
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

### Learner-Centered Approach
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

 🛸