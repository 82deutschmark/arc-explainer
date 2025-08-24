# Enhanced API Logging Implementation Plan

## Building on Cascade's Foundation

This plan enhances the excellent work in `Capturing_API_Call_Logs_Plan_2025-08-21.md` with:
1. **UI components** for rich API data display
2. **Data sanitization** improvements  
3. **Specific implementation steps**
4. **Security hardening**

## Critical Security Findings

### ✅ **No Data Leakage to AI**
- **Test answers are NOT sent to AI** - Only test input image sent to OpenAI
- **Training examples correctly include answers** - Proper for AI learning
- **Python solver loads full JSON** but sanitizes what gets sent to AI

### ⚠️ **Security Enhancement Needed**
- **Sanitize JSON loading** - Only load test input, not test output
- **Implement strict redaction** per Cascade's plan
- **Add answer detection** and automatic filtering

## Phase 1: Data Sanitization (Priority 1)

### A. Python Solver Enhancement
```python
# Add to arc_visual_solver.py
def load_task_sanitized(self, file_path: str) -> Dict[str, Any]:
    """Load ARC task with test output redacted for security"""
    with open(file_path, 'r') as f:
        task = json.load(f)
    
    # Sanitize: Remove test outputs to prevent accidental leakage
    if 'test' in task:
        for test_case in task['test']:
            if 'output' in test_case:
                # Store for local validation but remove from working data
                self._validation_output = test_case['output']
                del test_case['output']
    
    return task
```

### B. Event Emission Enhancement
```python
# Add API call logging events
def emit_api_call_start(self, provider: str, model: str, request_id: str, phase: str, params: dict):
    """Emit sanitized API call start event"""
    sanitized_params = {
        'temperature': params.get('temperature'),
        'max_tokens': params.get('max_tokens'),  
        'reasoning_effort': params.get('reasoning', {}).get('effort'),
        # Never include prompt content - too much data
        'prompt_length': len(str(params.get('input', ''))),
        'image_count': len([item for item in params.get('input', []) if item.get('type') == 'input_image'])
    }
    
    event = {
        'type': 'api_call_start',
        'timestamp': datetime.utcnow().isoformat(),
        'request_id': request_id,
        'provider': provider,
        'model': model,
        'phase': phase,
        'params': sanitized_params
    }
    print(json.dumps(event), flush=True)

def emit_api_call_end(self, request_id: str, response_data: dict, latency_ms: int):
    """Emit sanitized API call end event"""
    event = {
        'type': 'api_call_end', 
        'timestamp': datetime.utcnow().isoformat(),
        'request_id': request_id,
        'status': 'success' if response_data else 'error',
        'latency_ms': latency_ms,
        'response_id': response_data.get('id'),
        'output_items': len(response_data.get('output', [])),
        'reasoning_summary_length': len(str(response_data.get('reasoning', {}).get('summary', ''))),
        'token_usage': response_data.get('usage', {})  # If available
    }
    print(json.dumps(event), flush=True)
```

## Phase 2: UI Components for Rich Data Display

### A. API Call Timeline Component
```typescript
// client/src/components/saturn/SaturnAPITimeline.tsx
interface APICall {
  id: string;
  type: 'api_call_start' | 'api_call_end';
  timestamp: string;
  provider: string;
  model: string;
  phase: string;
  latency?: number;
  status?: 'success' | 'error';
  params?: {
    temperature: number;
    prompt_length: number;
    image_count: number;
    reasoning_effort: string;
  };
  response?: {
    output_items: number;
    reasoning_summary_length: number;
    token_usage?: any;
  };
}

export function SaturnAPITimeline({ apiCalls }: { apiCalls: APICall[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          API Call Timeline
          <Badge variant="outline">{apiCalls.length} calls</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-auto">
          {apiCalls.map((call, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 font-mono">
                {new Date(call.timestamp).toLocaleTimeString()}
              </div>
              <Badge variant={call.status === 'success' ? 'default' : 'destructive'}>
                {call.provider}
              </Badge>
              <div className="flex-1 text-sm">
                <span className="font-medium">{call.phase}</span>
                {call.latency && (
                  <span className="text-gray-600 ml-2">({call.latency}ms)</span>
                )}
              </div>
              {call.params && (
                <div className="text-xs text-gray-600">
                  {call.params.image_count} images • {call.params.prompt_length} chars
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### B. API Stats Component
```typescript
// client/src/components/saturn/SaturnAPIStats.tsx
export function SaturnAPIStats({ apiCalls }: { apiCalls: APICall[] }) {
  const stats = useMemo(() => {
    const successful = apiCalls.filter(c => c.status === 'success');
    const totalLatency = successful.reduce((sum, c) => sum + (c.latency || 0), 0);
    const avgLatency = successful.length > 0 ? totalLatency / successful.length : 0;
    
    return {
      totalCalls: apiCalls.length,
      successRate: successful.length / apiCalls.length * 100,
      avgLatency: avgLatency,
      totalImages: apiCalls.reduce((sum, c) => sum + (c.params?.image_count || 0), 0),
      totalTokens: successful.reduce((sum, c) => sum + (c.response?.token_usage?.total_tokens || 0), 0)
    };
  }, [apiCalls]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="p-3">
        <div className="text-lg font-bold text-blue-600">{stats.totalCalls}</div>
        <div className="text-xs text-gray-600">API Calls</div>
      </Card>
      <Card className="p-3">
        <div className="text-lg font-bold text-green-600">{stats.successRate.toFixed(1)}%</div>
        <div className="text-xs text-gray-600">Success Rate</div>
      </Card>
      <Card className="p-3">
        <div className="text-lg font-bold text-purple-600">{Math.round(stats.avgLatency)}ms</div>
        <div className="text-xs text-gray-600">Avg Latency</div>
      </Card>
      <Card className="p-3">
        <div className="text-lg font-bold text-orange-600">{stats.totalImages}</div>
        <div className="text-xs text-gray-600">Images Sent</div>
      </Card>
      <Card className="p-3">
        <div className="text-lg font-bold text-red-600">{stats.totalTokens.toLocaleString()}</div>
        <div className="text-xs text-gray-600">Tokens Used</div>
      </Card>
    </div>
  );
}
```

### C. Enhanced Saturn Page Layout
```typescript
// Enhanced SaturnVisualSolver.tsx additions
export default function SaturnVisualSolver() {
  // ... existing code ...
  
  // Extract API calls from log events
  const apiCalls = useMemo(() => {
    return (state.logLines || [])
      .filter(line => line.startsWith('{"type":"api_call_'))
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  }, [state.logLines]);

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* ... existing header and status ... */}
      
      {/* API Statistics - Show during/after runs */}
      {(isRunning || isDone) && apiCalls.length > 0 && (
        <SaturnAPIStats apiCalls={apiCalls} />
      )}
      
      {/* Main output section with tabs */}
      <Card className="w-full">
        <CardHeader>
          <Tabs defaultValue="logs" className="w-full">
            <TabsList>
              <TabsTrigger value="logs">Python Solver Output</TabsTrigger>
              <TabsTrigger value="api-timeline">API Timeline</TabsTrigger>
            </TabsList>
            
            <TabsContent value="logs">
              {/* ... existing Python output display ... */}
            </TabsContent>
            
            <TabsContent value="api-timeline">
              <SaturnAPITimeline apiCalls={apiCalls} />
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>
      
      {/* ... rest of existing layout ... */}
    </div>
  );
}
```

## Phase 3: Backend Integration

### A. Enhanced WebSocket Event Handling
```typescript
// server/services/saturnVisualService.ts additions
interface APICallEvent {
  type: 'api_call_start' | 'api_call_end';
  timestamp: string;
  request_id: string;
  provider: string;
  model: string;
  phase?: string;
  latency_ms?: number;
  status?: 'success' | 'error';
  params?: any;
  response?: any;
}

// In the pythonBridge event handler
case 'api_call_start':
case 'api_call_end': {
  // Forward API call events to WebSocket
  broadcast(sessionId, {
    status: 'running',
    phase: 'api_call',
    messageType: evt.type,
    apiCallData: evt,
    message: `${evt.type}: ${evt.provider} ${evt.model} (${evt.phase || 'unknown'})`
  });
  break;
}
```

### B. Database Storage Enhancement
```typescript
// server/services/dbService.ts additions
interface EnhancedSaturnData {
  // ... existing fields ...
  apiCallSummary?: {
    totalCalls: number;
    successfulCalls: number;
    avgLatency: number;
    totalTokens: number;
    providers: string[];
  };
}

// Calculate API summary from events
function summarizeAPICalls(events: any[]): any {
  const apiEvents = events.filter(e => e.type?.startsWith('api_call_'));
  const calls = groupAPIEvents(apiEvents);
  
  return {
    totalCalls: calls.length,
    successfulCalls: calls.filter(c => c.status === 'success').length,
    avgLatency: calls.reduce((sum, c) => sum + (c.latency || 0), 0) / calls.length,
    totalTokens: calls.reduce((sum, c) => sum + (c.tokenUsage?.total || 0), 0),
    providers: [...new Set(calls.map(c => c.provider))]
  };
}
```

## Phase 4: Security Hardening

### A. Environment Variables
```bash
# .env additions
API_LOG_REQUESTS=true          # Log sanitized request metadata
API_LOG_RESPONSES=true         # Log sanitized response metadata  
API_LOG_MAX_BYTES=50000       # Cap per API call log entry
SATURN_REDACT_TEST_OUTPUT=true # Remove test outputs from loaded tasks
API_CALL_TIMEOUT_MS=300000    # 5 minute timeout for API calls
```

### B. Automatic Redaction
```typescript
// shared/apiSanitizer.ts
export function sanitizeAPIRequest(request: any): any {
  return {
    // Include metadata only
    model: request.model,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    reasoning_effort: request.reasoning?.effort,
    
    // Summarize content without exposing prompts
    input_summary: {
      text_length: getTotalTextLength(request.input),
      image_count: getImageCount(request.input),
      has_function_calls: hasFunctionCalls(request.input)
    }
  };
}

export function sanitizeAPIResponse(response: any): any {
  return {
    id: response.id,
    output_count: response.output?.length || 0,
    reasoning_summary_length: response.reasoning?.summary?.length || 0,
    reasoning_items_count: response.reasoning?.items?.length || 0,
    token_usage: response.usage,
    // Never include actual output text/reasoning content
  };
}
```

## Implementation Timeline

### Week 1: Security & Data Sanitization
- [ ] Implement sanitized task loading
- [ ] Add API call event emission in Python
- [ ] Test no test output leakage

### Week 2: Basic UI Components  
- [ ] API statistics cards
- [ ] API timeline display
- [ ] Tab integration in Saturn page

### Week 3: Backend Integration
- [ ] WebSocket event forwarding
- [ ] Database storage enhancements
- [ ] Feature flag implementation

### Week 4: Testing & Refinement
- [ ] End-to-end testing
- [ ] Security validation
- [ ] Performance optimization

## Expected Outcomes

### For Users
- **Transparency**: See exactly what's sent to/from AI APIs
- **Performance**: Monitor API latency and token usage
- **Debugging**: Rich timeline of API interactions
- **Security**: Confidence that no answers are leaked

### For Developers  
- **Debugging**: Detailed API call traces
- **Optimization**: Identify slow API calls
- **Monitoring**: Token usage and cost tracking
- **Security**: Automatic redaction and sanitization

This plan builds on Cascade's excellent foundation while adding the UI layer and security enhancements needed for a complete solution.