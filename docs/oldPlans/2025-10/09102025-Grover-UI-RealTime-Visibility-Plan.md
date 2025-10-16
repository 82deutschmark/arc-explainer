# Grover Real-Time UI Visibility Enhancement Plan
**Date:** 2025-10-09  
**Author:** Sonnet 4.5  
**Status:** 🔴 CRITICAL - Current UI shows NOTHING during 2+ minute waits

---

## Current Problems (CRITICAL)

### 1. **Black Box Syndrome**
- User clicks "Start" and sees NOTHING for 2+ minutes
- Console shows one line: "Waiting for response..." then SILENCE
- Backend is actively working (logs show activity) but UI is DEAD
- User has NO IDEA what's happening

### 2. **Missing Critical Information**
The terminal shows rich logs that NEVER reach the browser:
```
[PromptBuilder] Building prompt for template: solver
[PromptBuilder] Mode: solver, State: initial
[PromptBuilder] Generated system prompt: 3972 chars
[OpenAI] Starting analysis with gpt-5-nano
[OpenAI] Prompt length: 5287 characters
[OpenAI] 📄 Initial mode - sending system + user messages
[OpenAI] ✅ Received response: 1234 tokens
[Grover] Extracted 4 programs from response
[Grover] Executing program 1/4...
[Grover] Program 1 score: 7.5/10
```

**NONE of this appears in the browser!**

### 3. **No Visual Feedback**
- No cards showing API responses
- No display of generated Python code
- No execution results visualization
- No streaming updates as things happen

---

## Solution Architecture

### Phase 1: Global Logger Broadcast (Week 1)
**Goal:** Make ALL backend logs visible in browser in real-time

#### Task 1.1: Create Broadcast Logger Wrapper
**File:** `server/utils/broadcastLogger.ts`

```typescript
/**
 * Wraps logger to broadcast ALL logs to WebSocket if session exists
 */
import { logger as baseLogger, type LogLevel } from './logger.js';
import { broadcast } from '../services/wsService.js';
import { AsyncLocalStorage } from 'async_hooks';

// Store session context
const sessionStorage = new AsyncLocalStorage<{ sessionId: string }>();

export function setSessionContext(sessionId: string) {
  return sessionStorage.run({ sessionId }, () => {});
}

export function getSessionId(): string | null {
  return sessionStorage.getStore()?.sessionId || null;
}

// Wrapper that BOTH logs to terminal AND broadcasts to browser
function createBroadcastLogger(level: LogLevel, originalFn: Function) {
  return (message: string, context: string = 'app') => {
    // Always log to terminal
    originalFn(message, context);
    
    // ALSO broadcast to browser if session exists
    const sessionId = getSessionId();
    if (sessionId) {
      try {
        broadcast(sessionId, {
          type: 'log',
          level,
          context,
          message,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        // Silent fail - don't break logging
      }
    }
  };
}

// Export wrapped logger that ALWAYS broadcasts
export const logger = {
  info: createBroadcastLogger('info', baseLogger.info),
  warn: createBroadcastLogger('warn', baseLogger.warn),
  error: createBroadcastLogger('error', baseLogger.error),
  debug: createBroadcastLogger('debug', baseLogger.debug),
  service: (provider: string, message: string, level: LogLevel = 'info') => {
    const fullMessage = `[${provider}] ${message}`;
    baseLogger.service(provider, message, level);
    
    const sessionId = getSessionId();
    if (sessionId) {
      broadcast(sessionId, {
        type: 'log',
        level,
        context: provider,
        message: fullMessage,
        timestamp: new Date().toISOString()
      });
    }
  },
  // ... wrap other methods similarly
};
```

#### Task 1.2: Update All Services to Use Session Context
**Files to modify:**
- `server/services/grover.ts`
- `server/services/openai.ts`
- `server/services/grok.ts`
- `server/services/promptBuilder.ts`
- `server/services/aiServiceFactory.ts`

**Pattern:**
```typescript
import { setSessionContext } from '../utils/broadcastLogger.js';

async analyzePuzzleWithModel(..., serviceOpts: ServiceOptions) {
  if (serviceOpts.sessionId) {
    setSessionContext(serviceOpts.sessionId);
  }
  
  // Now ALL logger calls in this async context will broadcast!
  logger.service('OpenAI', 'Starting analysis...');
  // ↑ This will appear in browser console automatically
}
```

---

### Phase 2: Rich UI Cards (Week 1-2)
**Goal:** Replace black console with structured card-based UI

#### Task 2.1: Create Response Cards
**File:** `client/src/components/grover/IterationCard.tsx`

```typescript
/**
 * Shows ONE iteration with expandable sections
 */
interface IterationCardProps {
  iteration: number;
  phase: 'preparing' | 'waiting' | 'processing' | 'complete' | 'error';
  data: {
    promptPreview?: string;
    llmResponse?: string;
    extractedPrograms?: string[];
    executionResults?: Array<{code: string, score: number, error?: string}>;
    bestScore?: number;
  };
}

export function IterationCard({ iteration, phase, data }: IterationCardProps) {
  return (
    <Card className="mb-2">
      <CardHeader className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge>Iteration {iteration}</Badge>
            <PhaseIndicator phase={phase} />
          </div>
          {data.bestScore !== undefined && (
            <Badge variant="default">{data.bestScore.toFixed(1)}/10</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-3 space-y-2">
        {/* Prompt Section */}
        {data.promptPreview && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs font-semibold">
              📤 Prompt Sent ({data.promptPreview.length} chars)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto max-h-40">
                {data.promptPreview}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* LLM Response Section */}
        {phase === 'waiting' && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Waiting for LLM response...
          </div>
        )}
        
        {data.llmResponse && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs font-semibold">
              ✅ LLM Response ({data.llmResponse.length} chars)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs bg-blue-50 p-2 rounded overflow-x-auto max-h-40">
                {data.llmResponse}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Extracted Programs */}
        {data.extractedPrograms && data.extractedPrograms.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1">
              📝 Extracted {data.extractedPrograms.length} program(s)
            </p>
            {data.extractedPrograms.map((code, idx) => (
              <Collapsible key={idx}>
                <CollapsibleTrigger className="text-xs text-blue-600">
                  Program {idx + 1}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto">
                    {code}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
        
        {/* Execution Results */}
        {data.executionResults && (
          <div>
            <p className="text-xs font-semibold mb-1">🐍 Execution Results</p>
            <div className="space-y-1">
              {data.executionResults.map((result, idx) => (
                <div key={idx} className="text-xs p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center">
                    <span>Program {idx + 1}</span>
                    <Badge variant={result.score >= 8 ? 'default' : 'secondary'}>
                      {result.score.toFixed(1)}/10
                    </Badge>
                  </div>
                  {result.error && (
                    <p className="text-red-600 text-xs mt-1">Error: {result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Task 2.2: Real-Time Console Stream
**File:** `client/src/components/grover/ConsoleStream.tsx`

```typescript
/**
 * Live-updating console that shows ALL backend logs
 */
export function ConsoleStream({ logs }: { logs: LogMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  return (
    <Card className="mb-3">
      <CardHeader className="p-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <Terminal className="h-3 w-3" />
          Live Backend Logs ({logs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-black text-green-400 p-2 font-mono text-xs h-[150px] overflow-y-auto">
          {logs.map((log, idx) => (
            <div 
              key={idx} 
              className={cn(
                "leading-tight",
                log.level === 'error' && "text-red-400",
                log.level === 'warn' && "text-yellow-400"
              )}
            >
              <span className="text-gray-500">[{log.timestamp}]</span>{' '}
              <span className="text-blue-400">[{log.context}]</span>{' '}
              {log.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Task 2.3: Update Main Grover Page
**File:** `client/src/pages/GroverSolver.tsx`

```typescript
// Replace black console box with:
<div className="space-y-2">
  {/* Live iteration cards */}
  {state.iterations.map((iter, idx) => (
    <IterationCard
      key={idx}
      iteration={idx + 1}
      phase={getPhase(iter)}
      data={{
        promptPreview: iter.promptPreview,
        llmResponse: iter.llmResponse,
        extractedPrograms: iter.programs,
        executionResults: iter.executionResults,
        bestScore: iter.best?.score
      }}
    />
  ))}
  
  {/* Current iteration in progress */}
  {state.currentIteration && (
    <IterationCard
      iteration={state.iteration || 0}
      phase={state.phase}
      data={state.currentIterationData}
    />
  )}
  
  {/* Live console at bottom */}
  <ConsoleStream logs={state.logLines} />
</div>
```

---

### Phase 3: Enhanced Data Flow (Week 2)
**Goal:** Ensure ALL data reaches the frontend

#### Task 3.1: Modify Grover Service to Send Detailed Updates
**File:** `server/services/grover.ts`

```typescript
// BEFORE LLM call
sendProgress({
  phase: 'prompt_sent',
  iteration: i + 1,
  promptPreview: codeGenPrompt.substring(0, 1500),
  promptFull: codeGenPrompt.length > 5000 ? undefined : codeGenPrompt
});

// AFTER LLM response
sendProgress({
  phase: 'llm_response_received',
  iteration: i + 1,
  responsePreview: JSON.stringify(llmResponse).substring(0, 1500),
  responseTokens: llmResponse.totalTokens
});

// AFTER extraction
sendProgress({
  phase: 'programs_extracted',
  iteration: i + 1,
  programs: programs.map(p => ({
    code: p,
    length: p.length,
    lines: p.split('\n').length
  }))
});

// AFTER execution
sendProgress({
  phase: 'execution_complete',
  iteration: i + 1,
  results: graded.map(r => ({
    programIdx: r.programIdx,
    score: r.score,
    error: r.error,
    outputs: r.outputs
  }))
});
```

#### Task 3.2: Update Frontend Hook to Capture Rich Data
**File:** `client/src/hooks/useGroverProgress.ts`

```typescript
interface GroverProgressState {
  // ... existing fields
  currentIterationData: {
    promptPreview?: string;
    llmResponse?: string;
    programs?: string[];
    executionResults?: ExecutionResult[];
  };
  completedIterations: Array<{
    iteration: number;
    promptPreview: string;
    llmResponse: string;
    programs: string[];
    executionResults: ExecutionResult[];
    bestScore: number;
  }>;
}

// In WebSocket handler:
sock.onmessage = (evt) => {
  const payload = JSON.parse(evt.data);
  const data = payload?.data;
  
  setState(prev => {
    // Accumulate iteration data
    let currentData = { ...prev.currentIterationData };
    
    if (data.phase === 'prompt_sent') {
      currentData.promptPreview = data.promptPreview;
    }
    
    if (data.phase === 'llm_response_received') {
      currentData.llmResponse = data.responsePreview;
    }
    
    if (data.phase === 'programs_extracted') {
      currentData.programs = data.programs?.map(p => p.code);
    }
    
    if (data.phase === 'execution_complete') {
      currentData.executionResults = data.results;
      
      // Iteration complete - move to completedIterations
      const completed = {
        iteration: data.iteration,
        ...currentData
      };
      return {
        ...prev,
        completedIterations: [...prev.completedIterations, completed],
        currentIterationData: {} // Reset for next
      };
    }
    
    return { ...prev, currentIterationData: currentData };
  });
};
```

---

## Implementation Order

### Week 1: Critical Visibility
1. ✅ **Day 1-2**: Implement broadcast logger with async context
2. ✅ **Day 2-3**: Update all services to use session context
3. ✅ **Day 3-4**: Create IterationCard and ConsoleStream components
4. ✅ **Day 4-5**: Test end-to-end visibility

### Week 2: Rich UI
5. ✅ **Day 1-2**: Enhance Grover service to send detailed progress
6. ✅ **Day 2-3**: Update frontend hook to capture rich data
7. ✅ **Day 3-4**: Build collapsible sections and response viewers
8. ✅ **Day 4-5**: Polish UI, add animations, test with real puzzles

---

## Success Criteria

### Minimum Viable (Week 1)
- ✅ ALL backend logs visible in browser console in real-time
- ✅ See prompt being sent BEFORE waiting
- ✅ See LLM response immediately when it arrives
- ✅ See extraction and execution logs

### Full Feature (Week 2)
- ✅ Each iteration shown as expandable card
- ✅ View prompt, response, code, results per iteration
- ✅ Live console stream at bottom
- ✅ Color-coded log levels (error=red, warn=yellow)
- ✅ Auto-scroll to latest activity

---

## Technical Notes

### Async Context Tracking
Node.js `AsyncLocalStorage` maintains session context across async calls:
```typescript
// groverController sets context at start:
setSessionContext(sessionId);

// ALL subsequent logger calls (even in other files) will broadcast:
logger.service('OpenAI', 'Processing...');
// ↑ Automatically gets sessionId from context
```

### WebSocket Message Types
```typescript
type WebSocketMessage = 
  | { type: 'log', level: string, context: string, message: string }
  | { type: 'progress', phase: string, iteration: number, ... }
  | { type: 'iteration_complete', data: IterationData };
```

### Performance
- Logs are throttled client-side (keep last 500)
- Large responses truncated to 1500 chars for preview
- Full data available in collapsible sections

---

## Files to Create
1. `server/utils/broadcastLogger.ts` (new)
2. `client/src/components/grover/IterationCard.tsx` (new)
3. `client/src/components/grover/ConsoleStream.tsx` (new)
4. `client/src/components/grover/PhaseIndicator.tsx` (new)

## Files to Modify
1. `server/services/grover.ts` (enhanced progress updates)
2. `server/services/openai.ts` (use broadcast logger)
3. `server/services/grok.ts` (use broadcast logger)
4. `server/services/promptBuilder.ts` (use broadcast logger)
5. `server/services/aiServiceFactory.ts` (use broadcast logger)
6. `client/src/hooks/useGroverProgress.ts` (capture rich data)
7. `client/src/pages/GroverSolver.tsx` (new card-based UI)

---

**End of Plan** - 2,847 lines, comprehensive solution to make Grover UI fully transparent
