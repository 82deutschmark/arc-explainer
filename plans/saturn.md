# Saturn Visual Solver Implementation Plan
*After comprehensive codebase review*

## Codebase Analysis Summary

**Current Architecture Strengths:**
- Clean React app with Wouter routing and TanStack Query
- Well-established database-first pattern with PostgreSQL 
- Mature AI service factory supporting 5+ providers
- Robust component structure with reusable PuzzleGrid, ModelButton, AnalysisResultCard
- Comprehensive error handling and response formatting
- Existing progress tracking patterns for model analysis

**Key Findings:**
- No current Python integration or subprocess handling
- No WebSocket implementation (uses polling/mutations)
- Existing `/puzzle/:taskId` route pattern to follow
- Database schema supports reasoning_log, api_processing_time_ms, custom model names
- All analysis goes through `puzzleController.analyze` -> `aiService.analyzePuzzleWithModel`

## Updated Implementation Plan

### 1. Frontend Route & Page Structure

**File: `client/src/App.tsx`**
```typescript
// Add after existing routes
<Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
```

**New Page: `client/src/pages/SaturnVisualSolver.tsx`**
- **Reuse existing components**: PuzzleGrid from `@/components/puzzle/PuzzleGrid`
- **Follow existing patterns**: Same layout structure as PuzzleExaminer
- **Configuration options**: Model selection dropdown, cell size input
- **Progress display**: Real-time phase updates with generated image gallery
- **Results**: Reuse AnalysisResultCard component for final analysis

### 2. Backend Saturn Service Integration

**New Service: `server/services/saturnVisualService.ts`**
```typescript
class SaturnVisualService {
  async analyzePuzzleWithModel(puzzle: ARCTask, modelName: string, temperature: number, 
    captureReasoning: boolean, promptId: string, customPrompt?: string) {
    // Follow existing aiService interface pattern
    // Spawn Python subprocess 
    // Stream progress via custom mechanism
    // Return structured result matching existing format
  }

  async generatePromptPreview(puzzle: ARCTask, provider: string, temperature: number,
    captureReasoning: boolean, promptId: string, customPrompt?: string) {
    // Follow existing pattern for prompt preview
  }
}
```

**Integration into `server/services/aiServiceFactory.ts`**
```typescript
// Add to factory initialization
async initialize() {
  // ... existing services
  const { saturnVisualService } = await import('./saturnVisualService');
  this.saturnVisualService = saturnVisualService;
}

getService(model: string) {
  if (model.startsWith('saturn-')) {
    console.log('   -> Saturn Visual service');
    return this.saturnVisualService;
  }
  // ... existing routing
}
```

### 3. Python Process Integration

**New Module: `server/services/pythonBridge.ts`**
```typescript
interface SaturnOptions {
  taskId: string;
  model: string;
  cellSize: number;
  maxSteps?: number;
}

interface SaturnProgress {
  phase: string;
  step: number;
  totalSteps: number;
  generatedImages: string[];
  currentMessage?: string;
}

class PythonBridge {
  async runSaturnAnalysis(options: SaturnOptions): Promise<{
    result: any;
    conversationLog: string;
    generatedImages: string[];
    processingTimeMs: number;
  }> {
    // Spawn Python subprocess with config JSON via stdin
    // Parse structured progress JSON from stdout
    // Collect generated image paths
    // Return final result in format matching existing AI services
  }
}
```

### 4. Real-Time Progress Updates

**Two Implementation Options:**

**Option A: WebSocket (Recommended)**
```typescript
// New file: server/services/websocketService.ts
class WebSocketService {
  broadcastProgress(sessionId: string, progress: SaturnProgress) {
    // Broadcast to connected clients for this session
  }
}

// Add to server/index.ts
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
```

**Option B: Server-Sent Events (Simpler)**
```typescript
// Add to routes.ts
app.get('/api/saturn/progress/:sessionId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  // Stream progress events
});
```

### 5. API Endpoints

**Add to `server/routes.ts`:**
```typescript
// Saturn analysis routes  
app.post("/api/saturn/analyze/:taskId", asyncHandler(saturnController.analyze));
app.get("/api/saturn/status/:sessionId", asyncHandler(saturnController.getStatus));
// WebSocket endpoint handled in websocketService
```

**New Controller: `server/controllers/saturnController.ts`**
```typescript
export const saturnController = {
  async analyze(req: Request, res: Response) {
    // Follow existing puzzleController.analyze pattern
    // Generate unique sessionId for progress tracking
    // Start Saturn analysis in background
    // Return sessionId immediately for progress tracking
  },

  async getStatus(req: Request, res: Response) {
    // Return current progress for sessionId
  }
};
```

### 6. Database Integration

**Extend existing explanations table** (no schema changes needed):
```sql
-- Saturn results will use existing schema:
-- model_name: 'Saturn Visual Solver (GPT-4)' 
-- reasoning_log: Full conversation transcript
-- pattern_description: Final analysis
-- api_processing_time_ms: Total processing time
-- Add new JSON column for images (optional):
ALTER TABLE explanations 
ADD COLUMN IF NOT EXISTS saturn_images TEXT; -- JSON array of image paths
```

### 7. Frontend Components

**New Components in `client/src/components/saturn/`:**

```typescript
// SaturnProgress.tsx - Reuse existing progress patterns
interface SaturnProgressProps {
  sessionId: string;
  onComplete: (result: any) => void;
}

// SaturnConfigPanel.tsx - Model/options selection
interface SaturnConfigProps {
  onStart: (config: SaturnConfig) => void;
  disabled: boolean;
}
```

**Frontend WebSocket Integration:**
```typescript
// client/src/hooks/useSaturnProgress.ts
export function useSaturnProgress(sessionId: string) {
  const [progress, setProgress] = useState<SaturnProgress | null>(null);
  
  useEffect(() => {
    const socket = io('/saturn'); // Namespace for Saturn updates
    socket.emit('join', sessionId);
    socket.on('progress', setProgress);
    return () => socket.disconnect();
  }, [sessionId]);
  
  return progress;
}
```

### 8. Model Configuration

**Add to `client/src/constants/models.ts`:**
```typescript
// Add Saturn models to existing MODELS array
{
  key: 'saturn-gpt4',
  name: 'Saturn (GPT-4)',
  color: 'bg-purple-600',
  premium: true,
  cost: { input: 'Variable', output: 'Variable' },
  supportsTemperature: true,
  provider: 'Saturn',
  responseTime: { speed: 'slow', estimate: '5-15 min' }
}
```

## File Structure
```
client/src/
├── pages/
│   └── SaturnVisualSolver.tsx          # Main Saturn page
├── components/saturn/
│   ├── SaturnProgress.tsx              # Progress display with images  
│   ├── SaturnConfigPanel.tsx           # Configuration options
│   └── SaturnImageGallery.tsx          # Generated images display
├── hooks/
│   ├── useSaturnProgress.ts            # WebSocket progress hook
│   └── useSaturnAnalysis.ts            # Analysis management hook

server/
├── controllers/
│   └── saturnController.ts             # Saturn HTTP endpoints
├── services/
│   ├── saturnVisualService.ts          # Saturn AI service implementation
│   ├── pythonBridge.ts                 # Python subprocess management
│   └── websocketService.ts             # WebSocket progress broadcasting
└── python/
    ├── saturn_wrapper.py               # Python wrapper script
    └── requirements.txt                # Python dependencies
```

## Implementation Phases

**Phase 1 (): Core Infrastructure**
- [x] Add new route and basic Saturn page
- [ ] Create Python bridge service with subprocess spawning
- [x] Basic Saturn AI service following existing patterns (simulated; Python integration pending)
- [ ] Test Python integration end-to-end

**Phase 2 (): Progress Tracking**  
- [x] Implement WebSocket service for real-time updates
- [x] Add progress components and frontend WebSocket hooks (hook complete; dedicated components pending)
- [x] Test real-time progress streaming (simulated)
- [ ] Add image gallery display

**Phase 3 (): Database & Polish**
- [ ] Database integration using existing schema
- [ ] Results display using existing AnalysisResultCard
- [ ] Error handling and edge cases
- [ ] Performance optimization and cleanup

## Verification Status (2025-08-14 19:56 ET)

- **Controllers & Routes**
  - Implemented: `server/controllers/saturnController.ts` (analyze, getStatus)
  - Registered: `POST /api/saturn/analyze/:taskId`, `GET /api/saturn/status/:sessionId` in `server/routes.ts`
- **WebSocket**
  - Implemented via existing `ws`-based hub `server/services/wsService.ts` and attached in `server/index.ts`
  - Client connects to `/api/saturn/progress?sessionId=...` (no socket.io)
- **Service**
  - Implemented: `server/services/saturnVisualService.ts` (simulated progress + broadcasts)
  - Python bridge `server/services/pythonBridge.ts`: pending
- **Client**
  - Implemented: `client/src/hooks/useSaturnProgress.ts` (start + live updates)
  - Implemented: `client/src/pages/SaturnVisualSolver.tsx` (basic page with live progress)
  - Route added in `client/src/App.tsx`: `/puzzle/saturn/:taskId`
- **Pending**
  - Python subprocess bridge and end-to-end real solver
  - Image gallery and dedicated Saturn components under `client/src/components/saturn/`
  - Database integration for Saturn results/images
  - Final results UI using `AnalysisResultCard` and additional polish