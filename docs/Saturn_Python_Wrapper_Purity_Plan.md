# Saturn Python Wrapper Purity Plan

## Mission Statement

Ensure Saturn Visual Service remains a **pure Python wrapper** that only orchestrates the Python solver without adding any AI prompt logic, custom analysis, or duplicate functionality on top of the Python project.

## Current State Assessment

### ✅ **CLEANED UP (Just Completed)**
- Removed `runWithResponses()` method (replaced with deprecation redirect)
- Removed all prompt building methods:
  - `buildPuzzlePrompt()`
  - `extractPatternFromReasoning()`
  - `extractStrategyFromReasoning()`
  - `extractHintsFromReasoning()`
  - `calculateConfidenceFromReasoning()`
- Removed OpenAI service import and direct API calls
- Removed Responses API integration logic

### ✅ **PROPER SATURN ARCHITECTURE**
Saturn should **ONLY**:
1. **Validate** task exists and DB connectivity
2. **Resolve** ARC task file path
3. **Spawn** Python subprocess via `pythonBridge`
4. **Stream** Python events to WebSocket clients
5. **Persist** Python results to database
6. **Handle** timeouts and cleanup

## Enforcement Rules

### ❌ **SATURN MUST NEVER**
1. **Build custom prompts** - Python handles all AI interactions
2. **Call OpenAI/Anthropic/etc APIs directly** - Python manages AI providers
3. **Parse or modify AI responses** - Python outputs structured data
4. **Implement reasoning extraction logic** - Python provides final results
5. **Duplicate AI provider functionality** - Python has its own AI integration
6. **Override Python solver behavior** - Python is the source of truth

### ✅ **SATURN SHOULD ONLY**
1. **File path resolution** - Find ARC JSON files for Python
2. **Process orchestration** - Start/stop Python subprocess
3. **Event streaming** - Forward Python events to WebSocket
4. **Database persistence** - Save Python results to DB
5. **Timeout management** - Kill long-running Python processes
6. **Error handling** - Surface Python errors to clients

## Implementation Boundaries

### **File Structure Separation**
```
server/services/saturnVisualService.ts  ← Pure Node.js wrapper
server/python/saturn_wrapper.py         ← Python bridge script  
solver/arc_visual_solver.py             ← Core Python solver
```

### **Data Flow**
```
Client Request → Saturn Service → Python Bridge → Python Solver
                                                      ↓
Client WebSocket ← Database ← Saturn Service ← Python Results
```

### **Responsibility Matrix**

| Function | Saturn Service | Python Solver |
|----------|---------------|---------------|
| **Prompt Building** | ❌ Never | ✅ Python handles |
| **AI API Calls** | ❌ Never | ✅ Python manages |
| **Pattern Analysis** | ❌ Never | ✅ Python analyzes |
| **Image Generation** | ❌ Never | ✅ Python creates |
| **WebSocket Streaming** | ✅ Yes | ❌ Python provides data |
| **Database Storage** | ✅ Yes | ❌ Python provides results |
| **Process Management** | ✅ Yes | ❌ Saturn orchestrates |

## Code Review Checklist

### **Before Any Saturn Changes**
- [ ] Does this add AI logic? → **REJECT**
- [ ] Does this build prompts? → **REJECT**  
- [ ] Does this call AI APIs? → **REJECT**
- [ ] Does this parse AI responses? → **REJECT**
- [ ] Does this duplicate Python functionality? → **REJECT**

### **Saturn Changes Must Only**
- [ ] Improve Python process management
- [ ] Enhance WebSocket streaming
- [ ] Fix database persistence
- [ ] Add timeout/error handling
- [ ] Resolve file paths

## Monitoring & Validation

### **Runtime Checks**
1. **No AI API calls** - Saturn logs should never show OpenAI/Anthropic calls
2. **No prompt building** - Saturn should never construct analysis prompts
3. **No reasoning extraction** - Saturn should only forward Python results
4. **Python autonomy** - All analysis comes from Python solver

### **Code Metrics**
- Saturn service should be **< 200 lines** (currently ~330, needs reduction)
- Zero imports from `./openai.ts`, `./anthropic.ts`, etc.
- Zero prompt building or AI response parsing logic
- Single responsibility: Python process wrapper

## Future Development Guidelines

### **Adding New Features**
1. **Python-first** - New AI capabilities go in Python solver
2. **Saturn-relay** - Saturn only relays new Python data to clients
3. **Database-extend** - Saturn may need new DB fields for Python results
4. **WebSocket-stream** - Saturn may need new event types for Python data

### **Bug Fixes**
1. **Python bugs** → Fix in Python solver
2. **Streaming bugs** → Fix in Saturn WebSocket logic  
3. **Database bugs** → Fix in Saturn persistence logic
4. **Process bugs** → Fix in Saturn process management

## Validation Tests

### **Integration Tests Needed**
1. **Python autonomy test** - Verify Saturn never calls AI APIs
2. **Data passthrough test** - Verify Saturn only forwards Python results
3. **Process isolation test** - Verify Python solver runs independently
4. **Event streaming test** - Verify all Python events reach WebSocket

### **Code Analysis**
1. **Import analysis** - No AI service imports in Saturn
2. **Method analysis** - No prompt/AI methods in Saturn  
3. **API call analysis** - No HTTP requests to AI providers from Saturn
4. **Complexity analysis** - Saturn should be simple orchestration logic

## Recovery Plan

If Saturn becomes bloated again:

1. **Immediate cleanup** - Remove all AI logic from Saturn
2. **Python migration** - Move any useful logic to Python solver
3. **Interface restoration** - Return to pure wrapper pattern
4. **Documentation update** - Update this plan with lessons learned

## Success Criteria

✅ **Saturn is properly minimal when:**
- File is < 200 lines of orchestration logic
- Zero AI API imports or calls
- Zero prompt building methods
- Zero AI response parsing
- Python solver operates completely independently
- All analysis logic lives in Python
- WebSocket streaming works correctly
- Database persistence works correctly

## Frontend UI Integration

### **Saturn UI Responsibilities**
The frontend Saturn page should **only**:
1. **Display** Python solver logs in real-time
2. **Show** API call progress from Python
3. **Stream** Python events via WebSocket
4. **Present** Python-generated images
5. **Save** final Python results to database

### **UI Data Flow**
```
Python Solver → Saturn Service → WebSocket → React UI
     ↓              ↓              ↓          ↓
   Logs          Forward        Stream    Display
API Calls       Events         Events    Progress  
Images          Results        Data      Results
```

### **Frontend Components Architecture**

#### **SaturnVisualSolver.tsx** - Main Page
- **Purpose**: Container for the entire Saturn solver interface
- **Responsibilities**:
  - Manage WebSocket connection to Saturn service
  - Display model selector and run controls
  - Coordinate between log display and image gallery components
  - Handle run state (idle/running/completed/error)

#### **Saturn Log Display Component**
- **Data Source**: Direct Python solver stdout/stderr via WebSocket
- **Features**:
  - Real-time log streaming from Python
  - Syntax highlighting for different log levels
  - API call detection and highlighting
  - Collapsible sections for long outputs
  - Auto-scroll with scroll-lock toggle
- **What to Show**:
  - `[INFO]` Python solver initialization
  - `[API]` OpenAI/Anthropic API calls with timing
  - `[ANALYSIS]` Pattern detection steps
  - `[IMAGE]` Image generation progress
  - `[ERROR]` Any Python errors or warnings

#### **Saturn Progress Component**
- **Data Source**: Python solver progress events via WebSocket
- **Features**:
  - Progress bar based on Python solver phases
  - Current step indicator from Python
  - Estimated time remaining
  - Model information display
- **Progress Phases** (from Python):
  - Initialization
  - API Analysis
  - Pattern Recognition  
  - Image Generation
  - Result Compilation

#### **Saturn Image Gallery Component**
- **Data Source**: Python-generated images via WebSocket events
- **Features**:
  - Real-time image display as Python generates them
  - Image thumbnails with click-to-expand
  - Step labeling from Python solver
  - Download individual images
- **Image Types** (from Python):
  - Input visualization
  - Pattern analysis diagrams
  - Transformation steps
  - Final prediction visualization

### **WebSocket Event Types**
Saturn UI should handle these event types from Python solver:

```typescript
interface SaturnEvent {
  type: 'start' | 'progress' | 'log' | 'image' | 'final' | 'error';
  
  // Progress events
  phase?: string;
  step?: number;
  totalSteps?: number;
  message?: string;
  
  // Log events  
  level?: 'INFO' | 'ERROR' | 'API' | 'DEBUG';
  logMessage?: string;
  timestamp?: string;
  
  // Image events
  images?: Array<{
    path: string;
    label: string;
    step: number;
  }>;
  
  // Final results
  result?: {
    success: boolean;
    prediction: any;
    confidence: number;
    processingTime: number;
  };
}
```

### **UI State Management**

#### **React Hook: useSaturnProgress**
```typescript
const useSaturnProgress = (sessionId: string) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'idle',
    step: 0,
    totalSteps: 0
  });
  const [isRunning, setIsRunning] = useState(false);
  
  // WebSocket connection management
  // Event handling for Python solver output
  // Real-time state updates
}
```

### **UI Design Principles**

#### **Transparency First**
- Show **exactly** what Python solver is doing
- No UI-side interpretation or modification of Python data
- Real-time streaming without buffering delays
- Raw log display option for debugging

#### **Performance Considerations**
- Efficient log rendering for long Python outputs
- Image lazy loading for large galleries
- WebSocket message batching if needed
- Memory management for long-running sessions

#### **Error Handling**
- Display Python solver errors clearly
- WebSocket connection retry logic
- Timeout handling with clear messaging
- Graceful degradation if Python fails

### **Frontend File Structure**
```
client/src/pages/SaturnVisualSolver.tsx     ← Main Saturn page
client/src/components/saturn/
  ├── SaturnLogDisplay.tsx                  ← Python log viewer
  ├── SaturnProgress.tsx                    ← Progress from Python
  ├── SaturnImageGallery.tsx               ← Python-generated images
  └── SaturnControls.tsx                   ← Run controls
client/src/hooks/useSaturnProgress.ts       ← WebSocket state management
```

### **UI Validation Checklist**

#### **Data Purity**
- [ ] All logs come directly from Python solver
- [ ] No UI-side prompt building or AI analysis
- [ ] Images are Python-generated only
- [ ] Progress data matches Python solver phases
- [ ] No frontend interpretation of results

#### **Real-time Features**
- [ ] Logs stream in real-time via WebSocket
- [ ] Images appear as Python generates them
- [ ] Progress updates reflect Python solver state
- [ ] API call timing visible from Python logs
- [ ] Error messages come directly from Python

#### **User Experience**
- [ ] Clear indication when Python solver is running
- [ ] Easy-to-read log formatting
- [ ] Responsive image gallery
- [ ] Intuitive progress indicators
- [ ] Proper error state handling

## Current Status

### **Backend (Completed)**
- [x] Removed inappropriate AI logic from Saturn service
- [x] Restored pure wrapper architecture  
- [x] Python solver remains autonomous
- [x] WebSocket streaming infrastructure intact
- [x] Database persistence for Python results

### **Frontend (Completed)**
- [x] Removed redundant "Reasoning Analysis" section from Saturn UI
- [x] Redesigned page with terminal-style Python solver output display
- [x] Improved visual layout with single-column focus on Python logs
- [x] Enhanced log formatting with dark terminal theme
- [x] Made puzzle details collapsible to reduce clutter
- [x] Ensured UI only displays Python data without interpretation

### **Integration Testing**
- [ ] End-to-end Python solver → UI data flow
- [ ] WebSocket message handling
- [ ] Error propagation from Python to UI
- [ ] Performance with long-running Python processes
- [ ] Multiple concurrent Saturn sessions

### **Documentation**
- [x] Saturn Python wrapper purity plan
- [x] Frontend architecture guidelines
- [ ] API documentation for WebSocket events
- [ ] Developer guide for Saturn debugging

**Saturn is now a complete pure Python wrapper with transparent UI display.**