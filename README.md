# ARC-AGI Puzzle Explorer - Colorblindness Aid 🛸

An interactive web application for examining ARC-AGI (Abstract Reasoning Corpus - Artificial General Intelligence) puzzles with accessibility in mind. If you've ever stared at a nine-color grid and wondered what cosmic joke you're missing, you're not alone. This tool helps humans (especially those with colorblindness and neurodivergent thinkers) understand abstract reasoning by translating complex grid patterns into emoji representations and providing AI-powered explanations of WHY solutions work.

## 🌟 Project Overview

This tool was created after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite—many people find these puzzles extremely challenging. The app treats ARC-AGI puzzles as alien communication patterns that humans can study and decode. It loads real puzzles from the v1 training set of the ARC-AGI prize, focuses on smaller grids (≤10x10 for better comprehension), and provides AI-powered analyses to explain the underlying logic in simple terms.

### Key Features

- **Accessibility Focus**: Designed for colorblind users and anyone who struggles with the standard puzzle representation
- **Emoji Translation**: Numbers (0-9) converted to emojis for better visualization and accessibility
- **Real Puzzle Data**: Uses puzzles from the v1 training set of the ARC-AGI prize
- **AI-Powered Explanations**: Focuses on WHY solutions are correct, not just HOW to solve them
- **Filter Options**: Ability to filter by grid size and other parameters
- **Neurodivergent-Friendly**: Designed to be accessible to diverse thinking styles

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
   
   # Optional database connection for Railway PostgreSQL
   DATABASE_URL=your_postgresql_connection_string_here
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
- Uses real ARC-AGI puzzles from the v1 training set
- Processes grid data for consistent viewing
- Prioritizes smaller grids (≤10x10) for better comprehension


### 2. Pattern Explanation
AI analysis provides:
- **Pattern Description**: What transformation rule is being used
- **Solving Strategy**: How the pattern transforms input to output
- **Simple Explanations**: Accessible language describing the logic
- **Confidence Score**: AI's certainty about the analysis
- **Alien Meaning**: What the aliens might be trying to communicate, based on the logic and symbols used

### 3. User Feedback System
- Users can vote on whether explanations are helpful or not
- Optional comments can be left to explain reasoning
- Feedback is stored in the database for future improvement
- Aggregate statistics (helpful/not helpful counts) are displayed with explanations

### 4. Database Storage
- Explanations and user feedback stored in Railway PostgreSQL database
- Falls back to memory-only mode if no database connection available
- Type-safe interfaces ensure data consistency
- Structured logging for better debugging and monitoring

### 5. Auto-Save System
- First analysis triggers automatic save to database and local file
- Explanations saved to database for user feedback collection
- Local file backup in `data/explained/{taskId}-EXPLAINED.json`
- Includes original puzzle data, model explanations, and timestamps
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
│   │   ├── dbService.ts        # Railway PostgreSQL database integration
│   │   ├── openai.ts           # AI model integration
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
│   ├── training/          # Downloaded ARC-AGI puzzles
│   └── explained/         # AI-analyzed puzzle exports
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
- **OpenAI API**: AI model integration for puzzle explanations
- **Railway PostgreSQL**: Database storage for explanations and feedback
- **Local Puzzle Storage**: Efficient loading of puzzle data
- **Custom Analysis Logic**: Processing of puzzle patterns
- **Structured Logger**: Consistent error handling and debugging

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
- Analyzed puzzles automatically save to both database and local files
- Database storage enables user feedback and community verification
- Local files saved to `data/explained/{puzzleId}-EXPLAINED.json`
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
# Set DATABASE_URL environment variable to enable database storage

# Database tables are automatically created on application startup
# Two main tables: explanations and feedback
```

#### Database Schema

**Explanations Table**
```sql
CREATE TABLE IF NOT EXISTS explanations (
  id SERIAL PRIMARY KEY,
  puzzle_id TEXT NOT NULL,
  pattern_description TEXT,
  solving_strategy TEXT,
  hints TEXT[],
  alien_meaning TEXT,
  confidence INTEGER,
  model_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Feedback Table**
```sql
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  explanation_id INTEGER REFERENCES explanations(id),
  vote_type TEXT CHECK (vote_type IN ('helpful', 'not_helpful')),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

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