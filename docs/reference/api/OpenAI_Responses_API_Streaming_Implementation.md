# OpenAI Responses API - Streaming Implementation Guide

**Author**: Claude Code
**Date**: 2025-10-15
**Target**: Developers implementing GPT-5 streaming with reasoning capture
**API**: OpenAI Responses API (`/v1/responses`) with Server-Sent Events (SSE)

---

## Overview

The **Responses API** is OpenAI's endpoint for advanced reasoning models (GPT-5, o3, o4). It differs significantly from Chat Completions API and requires special handling for streaming reasoning data.

### Key Differences from Chat Completions API

| Feature | Chat Completions (`/v1/chat/completions`) | Responses API (`/v1/responses`) |
|---------|------------------------------------------|--------------------------------|
| **Models** | GPT-4, GPT-4o, older models | GPT-5, o3, o4 reasoning models |
| **Reasoning** | Not available | Built-in reasoning tracking |
| **Output Location** | `choices[0].message.content` | `output_text` OR `output[]` array |
| **Structured Output** | `response_format` parameter | `text.format.json_schema` nested object |
| **Reasoning Control** | N/A | `reasoning.effort`, `reasoning.summary`, `text.verbosity` |
| **Token Accounting** | Combined in `completion_tokens` | Separate `reasoning_tokens` field |
| **Messages Format** | `messages` array | `input` array (same structure) |

---

## Part 1: Understanding the Responses API Structure

### Request Payload

```typescript
interface ResponsesAPIPayload {
  model: string;                        // "gpt-5-mini-2025-08-07"
  input: Array<{                        // Same as "messages" in Chat Completions
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  // Reasoning configuration (GPT-5 specific)
  reasoning?: {
    effort?: "minimal" | "low" | "medium" | "high";  // Controls depth
    summary?: "auto" | "detailed" | "concise";       // Summary style
  };

  // Text configuration (verbosity + structured output)
  text?: {
    verbosity?: "low" | "medium" | "high";           // Reasoning detail in output
    format?: {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: object;                                // JSON schema for structured output
    };
  };

  // Standard parameters
  temperature?: number;                              // Only for non-reasoning models
  max_output_tokens?: number;                        // Default: 128000 for GPT-5
  store?: boolean;                                   // Enable conversation chaining
  previous_response_id?: string;                     // For multi-turn conversations
  stream?: boolean;                                  // Enable SSE streaming
}
```

### Response Structure (Non-Streaming)

```typescript
interface ResponsesAPIResponse {
  id: string;                                        // Response ID for chaining
  status: "completed" | "failed" | "incomplete";

  // Output variants (model-dependent)
  output_text?: string;                              // Preferred: Simple text output
  output_parsed?: object;                            // JSON schema enforced output
  output?: Array<{                                   // Fallback: Block-based output
    type: "reasoning" | "message" | "text";
    content?: string;
    summary?: string;
  }>;

  // Reasoning data (if reasoning model)
  output_reasoning?: {
    summary: string | string[] | object;             // Reasoning summary
    items?: Array<string | object>;                  // Reasoning steps
  };

  // Token usage
  usage: {
    input_tokens: number;
    output_tokens: number;
    output_tokens_details?: {
      reasoning_tokens?: number;                     // Separate reasoning token count
    };
  };
}
```

---

## Part 1.5: Feature Flags and Configuration

### Streaming Enablement

The system uses a shared `STREAMING_ENABLED` feature flag that must be enabled for streaming to work:

```typescript
// server/config/streaming.ts
export function resolveStreamingConfig() {
  return {
    enabled: isFeatureFlagEnabled(process.env.STREAMING_ENABLED || "true"),
  };
}

// client/src/hooks/useAnalysisResults.ts
const streamingEnabled = useMemo(() => {
  const rawValue = import.meta.env.VITE_ENABLE_SSE_STREAMING as string | undefined;
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    return isFeatureFlagEnabled(rawValue);
  }
  return doesFrontendAdvertiseStreaming();
}, []);
```

Both server and client must agree on this flag for streaming to be available.

---

## Part 2: Implementing SSE Streaming

### Step 0: Two-Step Handshake Process

**CRITICAL**: Always use the two-step handshake to avoid race conditions and ensure proper session management:

1. **POST /api/stream/analyze**: Cache the analysis payload and return a `sessionId`
2. **GET /api/stream/analyze/:taskId/:modelKey/:sessionId**: Register SSE connection and start streaming

```typescript
// Step 1: Cache payload
const handshakeResponse = await fetch('/api/stream/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'puzzle_001',
    modelKey: 'gpt-5-mini-2025-08-07',
    reasoningEffort: 'medium',
    reasoningVerbosity: 'high',
    captureReasoning: true,
    // ... other params
  }),
});

const { sessionId } = await handshakeResponse.json();

// Step 2: Immediately open SSE (critical timing!)
const eventSource = new EventSource(
  `/api/stream/analyze/${taskId}/${encodeURIComponent(modelKey)}/${sessionId}`
);
```

**Session Expiration**: Cached sessions expire after 60 seconds. Always open the SSE connection immediately after the POST to avoid `HANDSHAKE_FAILED` errors.

### Step 1: Enable Streaming in Request

```typescript
const response = await openai.responses.stream({
  model: "gpt-5-mini-2025-08-07",
  input: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  reasoning: {
    effort: "medium",      // Controls reasoning depth - NEVER "minimal"
    summary: "detailed"    // Required for summary emission
  },
  text: {
    verbosity: "high",     // CRITICAL: Without this, NO reasoning deltas emit
    format: {              // Optional: Structured JSON output
      type: "json_schema",
      name: "puzzle_solution",
      strict: true,
      schema: yourJsonSchema
    }
  },
  stream: true,            // Enable streaming
  max_output_tokens: 128000
});
```

### Step 2: Handle Stream Events

The stream emits different event types that MUST be normalized:

```typescript
// Use async iteration (OpenAI SDK v4+)
for await (const event of response) {
  switch (event.type) {
    case "response.reasoning_summary_text.delta":
      // Real-time reasoning summary chunks
      const reasoningDelta = event.delta;
      console.log("[Reasoning]", reasoningDelta);
      // Normalize to SSE: send("stream.chunk", { type: "reasoning", delta: reasoningDelta })
      break;

    case "response.content_part.added":
      // Output text chunks
      const textDelta = event.part?.text;
      // Normalize to SSE: send("stream.chunk", { type: "text", delta: textDelta })
      break;

    case "response.in_progress":
      // Status update
      send("stream.status", { state: "in_progress" });
      break;

    case "response.completed":
      // Stream finished - get final response
      const finalResponse = await response.finalResponse();
      const analysis = extractAnalysis(finalResponse);
      await saveToDatabase(analysis);
      send("stream.complete", { status: "success", analysisId: analysis.id });
      break;

    case "response.failed":
    case "error":
      // Handle errors
      const errorMsg = event.error?.message || "Stream failed";
      send("stream.error", { code: "STREAM_FAILED", message: errorMsg });
      break;
  }
}
```

### Step 3: Extract Final Response

After streaming completes, get the final response with proper token usage extraction:

```typescript
const finalResponse = await response.finalResponse();

// Extract output (priority order)
let outputText: string;
if (finalResponse.output_text) {
  outputText = finalResponse.output_text;           // Preferred
} else if (finalResponse.output_parsed) {
  outputText = JSON.stringify(finalResponse.output_parsed);  // Structured output
} else if (finalResponse.output && Array.isArray(finalResponse.output)) {
  // Extract from output[] array (gpt-5-nano format)
  const textBlock = finalResponse.output.find(block => block.type === "text");
  outputText = textBlock?.text || "";
}

// Extract reasoning (priority order)
let reasoningLog: string = "";
if (finalResponse.output_reasoning?.summary) {
  const summary = finalResponse.output_reasoning.summary;

  if (typeof summary === "string") {
    reasoningLog = summary;
  } else if (Array.isArray(summary)) {
    reasoningLog = summary.map(s =>
      typeof s === "string" ? s : (s?.text || s?.content || JSON.stringify(s))
    ).join("\n\n");
  }
}

// Extract token usage (CRITICAL: nested path)
const tokenUsage = {
  input: finalResponse.usage.input_tokens,
  output: finalResponse.usage.output_tokens,
  reasoning: finalResponse.usage.output_tokens_details?.reasoning_tokens || 0  // NOT usage.reasoning_tokens!
};
```

---

## Part 3: Critical Configuration Requirements

### For GPT-5 Models to Emit Reasoning Deltas

You MUST set ALL three parameters correctly:

```typescript
reasoning: {
  effort: "medium" | "high",        // NOT "minimal" or "low" - those hide deltas
  summary: "detailed"               // Required for summary emission
},
text: {
  verbosity: "high"                 // CRITICAL: Without this, NO reasoning deltas emit
}
```

**What happens if you miss these:**
- ❌ No `reasoning` → No reasoning captured at all
- ❌ `effort: "minimal"` → Reasoning computed but not emitted
- ❌ No `text.verbosity` → Reasoning summary only at END, no real-time deltas
- ❌ `verbosity: "low"` → Sparse reasoning, poor UX

### For o3/o4 Models

```typescript
reasoning: {
  summary: "auto"      // o3/o4 don't support effort or verbosity
}
// No text.verbosity for o3/o4
```

---

## Part 4: SSE Server Implementation

### Express SSE Endpoint with Session Management

```typescript
const pendingSessions = new Map<string, StreamAnalysisPayload>();

app.post("/api/stream/analyze", (req, res) => {
  const { payload, errors } = buildPayloadFromBody(req.body);

  if (errors.length > 0 || !payload) {
    res.status(422).json({
      error: "Invalid stream request payload.",
      details: errors,
    });
    return;
  }

  try {
    const sessionId = analysisStreamService.savePendingPayload(payload);
    const cachedPayload = analysisStreamService.getPendingPayload(sessionId);
    const expiresAtMs = cachedPayload?.expiresAt;
    const expiresInSeconds = typeof expiresAtMs === "number"
      ? Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000))
      : PENDING_SESSION_TTL_SECONDS;

    res.status(200).json({
      sessionId,
      expiresInSeconds,
      expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare analysis stream';
    res.status(500).json({ error: "Failed to prepare analysis stream." });
  }
});

app.get("/api/stream/analyze/:taskId/:modelKey/:sessionId", async (req, res) => {
  const { taskId, modelKey, sessionId } = req.params;
  const cached = analysisStreamService.getPendingPayload(sessionId);

  if (!cached || cached.taskId !== taskId || cached.modelKey !== decodeURIComponent(modelKey)) {
    res.status(404).json({ error: "Session payload missing or mismatched." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: stream.init\n`);
  res.write(`data: ${JSON.stringify({ sessionId, taskId, modelKey })}\n\n`);

  try {
    // Streaming logic here...
  } catch (error) {
    res.write(`event: stream.error\n`);
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
    res.end();
  } finally {
    analysisStreamService.clearPendingPayload(sessionId);
  }
});
```

---

## Part 5: Client-Side SSE Consumption

### React Hook Integration

```typescript
// useAnalysisStreaming.ts - Hook wrapper around SSE utility
export function useAnalysisStreaming() {
  const [state, setState] = useState<UseAnalysisStreamingState>(INITIAL_STATE);
  const streamHandleRef = useRef<{ close: () => void } | null>(null);

  const startStream = useCallback(
    async (params: AnalysisStreamParams, extraHandlers: Partial<AnalysisStreamHandlers> = {}) => {
      if (streamHandleRef.current) {
        streamHandleRef.current.close();
      }

      setState({
        status: { state: 'requested' },
        chunks: [],
        summary: undefined,
        error: undefined,
      });

      try {
        const handle = await createAnalysisStream(params, {
          onInit: payload => {
            setState(prev => ({
              ...prev,
              sessionId: payload.sessionId,
            }));
            extraHandlers.onInit?.(payload);
          },
          onStatus: status => {
            setState(prev => ({
              ...prev,
              status,
            }));
            extraHandlers.onStatus?.(status);
          },
          onChunk: chunk => {
            setState(prev => ({
              ...prev,
              chunks: [...prev.chunks, chunk],
            }));
            extraHandlers.onChunk?.(chunk);
          },
          onComplete: summary => {
            setState(prev => ({
              ...prev,
              status: { state: 'completed' },
              summary,
            }));
            extraHandlers.onComplete?.(summary);
          },
          onError: error => {
            setState(prev => ({
              ...prev,
              status: { state: 'failed', message: error.message },
              error,
            }));
            extraHandlers.onError?.(error);
          },
        });

        streamHandleRef.current = handle;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start analysis stream';
        const errorPayload = { code: 'HANDSHAKE_FAILED', message };

        setState(prev => ({
          ...prev,
          status: { state: 'failed', message },
          error: errorPayload,
        }));

        extraHandlers.onError?.(errorPayload);
      }
    },
    []
  );

  const closeStream = useCallback(() => {
    if (streamHandleRef.current) {
      streamHandleRef.current.close();
      streamHandleRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamHandleRef.current) {
        streamHandleRef.current.close();
        streamHandleRef.current = null;
      }
    };
  }, []);

  return {
    sessionId: state.sessionId,
    status: state.status,
    chunks: state.chunks,
    summary: state.summary,
    error: state.error,
    visibleText: aggregatedContent.text,
    reasoningText: aggregatedContent.reasoning,
    structuredJsonText: aggregatedContent.json,
    structuredJson: parsedStructuredJson,
    promptPreview,
    startStream,
    closeStream,
  };
}
```

### Orchestrator Hook (useAnalysisResults)

```typescript
// useAnalysisResults.ts - Main orchestrator hook
export function useAnalysisResults({ taskId, refetchExplanations, ...props }) {
  const {
    startStream,
    closeStream,
    status: streamStatus,
    visibleText: streamingVisibleText,
    reasoningText: streamingReasoningText,
    summary: streamSummary,
    error: streamError,
  } = useAnalysisStreaming();

  const canStreamModel = useCallback(
    (modelKey: string) => streamingEnabled && streamSupportedModels.has(modelKey),
    [streamingEnabled, streamSupportedModels]
  );

  const startStreamingAnalysis = useCallback(
    (modelKey: string, supportsTemperature: boolean) => {
      const params: AnalysisStreamParams = {
        taskId,
        modelKey,
        temperature: supportsTemperature ? temperature : undefined,
        reasoningEffort: isGPT5ReasoningModel(modelKey) ? reasoningEffort : undefined,
        reasoningVerbosity: isGPT5ReasoningModel(modelKey) ? reasoningVerbosity : undefined,
        reasoningSummaryType: isGPT5ReasoningModel(modelKey) ? reasoningSummaryType : undefined,
        captureReasoning: true,
        // ... other params
      };

      void startStream(params, {
        onStatus: status => {
          // Update streaming phase/message
          if (status && typeof status === 'object') {
            if ('phase' in status) {
              setStreamingPhase((status as any).phase);
            }
            if ('message' in status) {
              setStreamingMessage((status as any).message);
            }
          }
        },
        onComplete: summary => handleStreamingComplete(summary, modelKey),
        onError: error => handleStreamingError(error, modelKey),
      });
    },
    [startStream, taskId, temperature, reasoningEffort, reasoningVerbosity, reasoningSummaryType]
  );

  const analyzeWithModel = useCallback(
    (modelKey: string, supportsTemperature: boolean = true) => {
      if (canStreamModel(modelKey)) {
        startStreamingAnalysis(modelKey, supportsTemperature);
        return;
      }

      // Fallback to legacy mutation
      analyzeAndSaveMutation.mutate(payload);
    },
    [canStreamModel, startStreamingAnalysis, analyzeAndSaveMutation]
  );

  return {
    analyzeWithModel,
    startStreamingAnalysis,
    streamingEnabled,
    streamingModelKey,
    streamStatus,
    streamingText: streamingVisibleText,
    streamingReasoning: streamingReasoningText,
    streamingPhase,
    streamingMessage,
    streamingTokenUsage,
    streamError,
    cancelStreamingAnalysis,
    closeStreamingModal,
    canStreamModel,
    // ... other exports
  };
}
```

---

## Part 6: Testing & Debugging

### Debug Checklist

1. **Check server logs for configuration**:
   ```
   [OpenAI-PayloadBuilder] Has reasoning: true     ← MUST be true
   [OpenAI-PayloadBuilder] - verbosity: high       ← MUST be "high"
   [OpenAI-PayloadBuilder] - effort: medium        ← NOT "minimal"
   ```

2. **Verify reasoning tokens are tracked**:
   ```typescript
   console.log("Reasoning tokens:", finalResponse.usage.output_tokens_details?.reasoning_tokens);
   // Should be > 0 for reasoning models
   ```

3. **Check for empty reasoning**:
   ```typescript
   if (!reasoningLog || reasoningLog === "[]" || reasoningLog === "") {
     console.error("Reasoning extraction failed - check configuration!");
   }
   ```

4. **Verify SSE events emit correctly**:
   ```bash
   curl -N -H "Accept: text/event-stream" \
     "http://localhost:5000/api/stream/analyze/puzzle_id/gpt-5-mini?reasoningEffort=medium&reasoningVerbosity=high&reasoningSummaryType=detailed"
   ```

---

## Part 7: Common Pitfalls

### ❌ Pitfall 1: Using Chat Completions API for GPT-5
```typescript
// WRONG - GPT-5 doesn't work with Chat Completions
const response = await openai.chat.completions.create({
  model: "gpt-5-mini-2025-08-07",  // Will fail or use wrong API
  messages: [...]
});
```

### ❌ Pitfall 2: Missing verbosity Parameter
```typescript
// WRONG - No reasoning deltas will emit
text: {
  format: { type: "json_schema", ... }
  // Missing: verbosity: "high"
}
```

### ❌ Pitfall 3: Wrong Token Extraction
```typescript
// WRONG - Reasoning tokens are nested
const tokens = response.usage.reasoning_tokens;  // undefined

// CORRECT
const tokens = response.usage.output_tokens_details?.reasoning_tokens || 0;
```

### ❌ Pitfall 4: Not Handling output[] Array Format
```typescript
// WRONG - Assumes output_text always exists
const text = response.output_text;  // Can be undefined for some models

// CORRECT - Check all formats
const text = response.output_text
  || extractFromOutputArray(response.output)
  || JSON.stringify(response.output_parsed);
```

### ❌ Pitfall 5: Ignoring Handshake Timing
```typescript
// WRONG - Session expires before SSE opens
setTimeout(() => {
  const eventSource = new EventSource(streamUrl); // Too late!
}, 1000);
```

### ❌ Pitfall 6: Not Handling Session Expiration
```typescript
// WRONG - No retry on session expiry
eventSource.onerror = () => {
  console.error("Connection lost");
};

// CORRECT - Implement retry logic for expired sessions
```

### ❌ Pitfall 7: Missing Feature Flag Check
```typescript
// WRONG - Assumes streaming always available
if (model.supportsStreaming) {
  startStreamingAnalysis(modelKey); // May fail if flag disabled
}

// CORRECT - Check feature flag first
if (streamingEnabled && canStreamModel(modelKey)) {
  startStreamingAnalysis(modelKey);
}
```

---

## Summary Checklist

✅ Use `/v1/responses` endpoint, NOT `/v1/chat/completions`
✅ Set `reasoning.effort` to "medium" or "high" (not "minimal")
✅ Set `reasoning.summary` to "detailed"
✅ Set `text.verbosity` to "high" for real-time deltas
✅ Use two-step handshake (POST then GET) for SSE
✅ Handle session expiration (60-second TTL)
✅ Extract reasoning from `output_reasoning.summary` with fallbacks
✅ Track reasoning tokens in `output_tokens_details.reasoning_tokens`
✅ Check `STREAMING_ENABLED` feature flag on both ends
✅ Handle ALL SSE events (init, status, chunk, complete, error)
✅ Test with curl to verify SSE events emit correctly
✅ Reset streaming state only when user explicitly closes modal
✅ Implement proper error recovery and retry logic

---

**Reference Implementation**: `arc-explainer/server/services/openai.ts` (GPT-5 streaming with full reasoning capture)

**OpenAI Docs**: https://platform.openai.com/docs/api-reference/responses
