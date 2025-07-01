# ARC-AGI Puzzle Solver

## Overview

This is an interactive web application for solving ARC-AGI (Abstract Reasoning Corpus - Artificial General Intelligence) puzzles. The application presents puzzles as grids with symbolic representations using space-themed emojis, allowing users to interact with and solve pattern recognition challenges. The system provides AI-powered analysis and hints to help users understand and solve puzzles.

## System Architecture

The application follows a full-stack architecture with a clear separation between client and server:

**Frontend (React + TypeScript)**
- Modern React application using Vite as the build tool
- TypeScript for type safety and better development experience
- Tailwind CSS for styling with shadcn/ui component library
- React Query (TanStack Query) for state management and API interactions
- Wouter for lightweight client-side routing

**Backend (Express + TypeScript)**
- Express.js server with TypeScript support
- RESTful API design for puzzle operations
- OpenAI integration for puzzle analysis and solution validation
- In-memory storage with extensible storage interface

**Database Layer**
- Drizzle ORM configured for PostgreSQL
- Schema defined for user management
- Database migrations support via Drizzle Kit

## Key Components

### Frontend Components

1. **PuzzleGrid** - Displays interactive grids with emoji representations
2. **PuzzleViewer** - Main puzzle interface with training examples and test cases  
3. **HintSystem** - Progressive hint revelation system with emoji legend
4. **PuzzleSolver** - Main page component orchestrating the puzzle-solving experience

### Backend Services

1. **Puzzle Analyzer** - Validates grid consistency and analyzes puzzle patterns
2. **OpenAI Service** - Integrates with GPT-4o for pattern analysis and solution validation
3. **Storage Interface** - Abstracted storage layer supporting multiple implementations
4. **Route Handlers** - RESTful endpoints for puzzle operations

### Shared Types

- **ARCTask** - Defines puzzle structure with training and test examples
- **PuzzleAnalysis** - AI-generated analysis with patterns and strategies
- **SolutionValidation** - Feedback system for user solutions

## Data Flow

1. **Puzzle Loading**: Client requests puzzle data from `/api/puzzle/task/:id`
2. **AI Analysis**: Server analyzes puzzle patterns using OpenAI API
3. **User Interaction**: Interactive grid allows users to modify solutions
4. **Solution Validation**: User solutions validated against correct answers
5. **Feedback Loop**: Real-time feedback provided to guide learning

## External Dependencies

### Frontend Dependencies
- **@radix-ui/react-*** - Accessible UI primitives for components
- **@tanstack/react-query** - Server state management and caching
- **tailwindcss** - Utility-first CSS framework
- **wouter** - Minimalist routing library
- **date-fns** - Date manipulation utilities

### Backend Dependencies
- **express** - Web application framework
- **drizzle-orm** - Type-safe ORM for database operations
- **@neondatabase/serverless** - Serverless PostgreSQL driver
- **openai** - Official OpenAI API client
- **connect-pg-simple** - PostgreSQL session store

### Development Tools
- **vite** - Fast build tool and development server
- **typescript** - Static type checking
- **drizzle-kit** - Database migration and schema management
- **esbuild** - JavaScript bundler for production builds

## Deployment Strategy

**Development Environment**
- Vite development server with hot module replacement
- Express server with TypeScript compilation via tsx
- Environment variable configuration for API keys and database URLs

**Production Build**
- Vite builds optimized client-side bundle to `dist/public`
- esbuild compiles server code to `dist/index.js`
- Static file serving integrated with Express server
- Single deployment artifact containing both client and server

**Database Strategy**
- PostgreSQL as primary database (configurable via DATABASE_URL)
- Drizzle migrations for schema evolution
- In-memory storage fallback for development/testing

**Environment Configuration**
- `NODE_ENV` for environment detection
- `DATABASE_URL` for PostgreSQL connection
- `OPENAI_API_KEY` for AI service integration
- Replit-specific optimizations for cloud deployment

## Recent Changes

- July 01, 2025: Built comprehensive ARC-AGI puzzle examination tool
  - Implemented real GitHub API integration with fchollet/ARC-AGI repository
  - Downloaded and analyzed 30+ actual puzzle files from the repository
  - Created puzzle browser with filtering by grid size (focusing on ≤10x10 puzzles)
  - Added space-themed emoji mapping for alien communication patterns
  - Integrated OpenAI API for puzzle pattern analysis and solving strategies
  - Built puzzle examination interface to view solutions without solving

## Architecture Updates

**GitHub Integration:**
- Real-time fetching from ARC-AGI repository (400+ puzzles available)
- Automatic download and local caching of puzzle files
- Grid size analysis and metadata extraction for filtering

**Data Pipeline:**
- Authentic puzzle data from fchollet/ARC-AGI/data/training
- Local file system storage with metadata caching
- Real-time filtering by difficulty, grid size, and consistency

**AI Analysis:**
- OpenAI GPT-4o integration for pattern recognition
- Puzzle strategy explanations and hint generation
- Solution validation with detailed feedback

## User Preferences

Preferred communication style: Simple, everyday language.