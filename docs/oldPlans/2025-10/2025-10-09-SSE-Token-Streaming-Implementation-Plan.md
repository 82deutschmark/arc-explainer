# SSE Token Streaming Implementation Plan

**Author:** Cascade (Claude Sonnet 4)  
**Date:** 2025-10-09  
**Purpose:** Implement real-time token-by-token streaming from LLM providers to resolve UI freezing during long analysis operations

---

## Problem Statement

Current blocking LLM calls cause the UI to freeze during long-running puzzle analysis, especially with reasoning models (GPT-5, o3, o4) that take 30+ seconds. Users see no feedback until the complete response arrives, creating a poor experience. The existing WebSocket system only handles discrete progress events (iteration complete, phase changes) but does not stream incremental LLM tokens.

## Solution Architecture

Implement Server-Sent Events (SSE) for token-by-token streaming from OpenAI, Grok, and OpenRouter providers. This runs alongside the existing WebSocket progress system:

- **WebSocket**: Progress events, logs, iteration counts (KEEP AS-IS)
- **SSE**: Token-by-token LLM response streaming (NEW)

---

## Phase 1: Backend Infrastructure

### Chunk 1.1 - SSE Endpoint Foundation
**Goal:** Create the basic SSE server infrastructure

**Tasks:**
- Create `server/controllers/streamController.ts` with SSE response handler
- Add route `GET /api/stream/analyze/:taskId/:modelKey` to `routes.ts`
- Implement SSE connection management with proper headers (`text/event-stream`, `Cache-Control`, `Connection`)
- Add keep-alive mechanism (send comment every 15 seconds to prevent timeout)
- Implement proper connection cleanup on client disconnect
- Create sessionId-to-connection mapping for multi-client support
- Add error handling for stream interruptions

**Deliverables:**
- SSE endpoint that clients can connect to
- Connection registry for tracking active streams
- Heartbeat mechanism to keep connections alive

---

### Chunk 1.2 - Base Service Streaming Support
**Goal:** Extend the service layer to support streaming responses

**Tasks:**
- Extend `BaseAIService.ts` with abstract `analyzeWithStreaming()` method
- Create `StreamChunk` interface with fields: `type`, `content`, `delta`, `metadata`
- Add `StreamingOptions` interface for configuring streaming behavior
- Create utility methods: `formatSSEMessage()`, `emitChunk()`, `endStream()`
- Add streaming state tracking (active streams map, abort controllers)
- Implement graceful stream termination and cleanup
- Add stream error handling and recovery logic

**Deliverables:**
- Streaming-capable base service class
- Type definitions for streaming data
- Utility functions for SSE formatting

---

### Chunk 1.3 - OpenAI Streaming Implementation
**Goal:** Enable streaming for OpenAI models (GPT-4, GPT-5, o3, o4)

**Tasks:**
- Modify `openai.ts` to add `analyzeWithStreaming()` implementation
- Use OpenAI SDK with `stream: true` option
- Iterate through response chunks using `for await` loop
- Extract delta content from `chunk.choices[0]?.delta?.content`
- Yield standardized stream chunks for each token
- Handle reasoning content separately if present (o3/o4 models)
- Accumulate complete response in buffer while streaming
- Parse final JSON response after stream completes
- Implement error handling for stream interruptions
- Support temperature, reasoning effort, and other OpenAI-specific parameters

**Deliverables:**
- Streaming-enabled OpenAI service
- Token-by-token emission for all OpenAI models
- Complete response accumulation and validation

---

### Chunk 1.4 - Grok Streaming Implementation
**Goal:** Enable streaming for xAI Grok models

**Tasks:**
- Modify `grok.ts` to add `analyzeWithStreaming()` implementation
- Use xAI SDK with streaming enabled
- Parse SSE events from xAI API response
- Extract delta tokens from response chunks
- Yield standardized stream chunks
- Handle Grok-specific response format quirks
- Accumulate complete response while streaming
- Parse final JSON response after stream completes
- Implement retry logic for Grok API rate limits
- Handle confidence normalization (0-1 to 0-100 scale)

**Deliverables:**
- Streaming-enabled Grok service
- Grok API SSE event parsing
- Complete response handling

---

### Chunk 1.5 - OpenRouter Streaming Implementation
**Goal:** Enable streaming through OpenRouter proxy

**Tasks:**
- Modify `openrouter.ts` to add `analyzeWithStreaming()` implementation
- Configure OpenRouter endpoint with `stream: true`
- Handle OpenRouter's OpenAI-compatible SSE format
- Parse `data:` events from OpenRouter response
- Extract delta content from response chunks
- Yield standardized stream chunks
- Handle multiple provider formats through OpenRouter
- Accumulate complete response while streaming
- Parse final JSON response after stream completes
- Implement OpenRouter-specific error handling and rate limiting

**Deliverables:**
- Streaming-enabled OpenRouter service
- Multi-provider streaming support via proxy
- Unified streaming interface

---

### Chunk 1.6 - Stream Aggregation & Persistence
**Goal:** Accumulate streamed tokens and save complete results

**Tasks:**
- Create `StreamAggregator` class to buffer incoming tokens
- Implement token accumulation with efficient string building
- Detect JSON completion (closing brace detection)
- Parse complete JSON response once stream ends
- Validate structured response using existing `validateSolverResponse()`
- Extract prediction grids, confidence, reasoning logs
- Save complete result to database using existing `ExplanationRepository`
- Handle stream interruptions (save partial data with error flag)
- Implement cleanup for abandoned streams
- Add metrics tracking (stream duration, token count, interruption rate)

**Deliverables:**
- Stream aggregation system
- Database persistence for streamed results
- Partial data handling for interrupted streams

---

## Phase 2: Frontend Integration

### Chunk 2.1 - SSE Client Hook
**Goal:** Create React hook for consuming SSE streams

**Tasks:**
- Create `client/src/hooks/useStreamedAnalysis.ts` hook
- Implement EventSource connection to SSE endpoint
- Handle connection lifecycle (connecting, open, closed, error)
- Parse incoming `data:` events into React state
- Accumulate streamed tokens into display buffer
- Implement reconnection logic with exponential backoff
- Add abort controller for manual stream cancellation
- Handle SSE event types (message, error, done)
- Track streaming metrics (tokens received, elapsed time)
- Clean up EventSource on component unmount

**Deliverables:**
- Reusable streaming hook
- Connection management logic
- Error handling and reconnection

---

### Chunk 2.2 - Streaming UI Components
**Goal:** Create components to display streaming content

**Tasks:**
- Create `StreamedResponseViewer.tsx` component for incremental text
- Implement smooth text rendering (append-only, no flash)
- Add optional typewriter effect for aesthetic streaming display
- Show partial reasoning logs as they stream in
- Display streaming status badges (🔄 Connecting, ⏳ Streaming, ✅ Complete)
- Add progress indicator showing token count or time elapsed
- Implement auto-scroll to keep latest content visible
- Show cursor/pulse indicator at end of streaming text
- Add "Stop Streaming" button for user control
- Style with TailwindCSS and shadcn/ui components

**Deliverables:**
- Streaming text display component
- Status indicators and controls
- Smooth UX during streaming

---

### Chunk 2.3 - PuzzleExaminer Streaming Mode
**Goal:** Integrate streaming into existing analysis flow

**Tasks:**
- Add streaming mode option to "Analyze Puzzle" UI
- Create streaming toggle or checkbox in analysis form
- Modify `useAnalysis` or create new `useStreamedAnalysis` hook
- Connect streaming hook to analysis submission button
- Show `StreamedResponseViewer` during active streaming
- Display accumulated tokens in real-time above/beside puzzle
- Transition to normal `AnalysisResultCard` after stream completes
- Preserve existing non-streaming mode as fallback
- Add loading states during stream initialization
- Handle streaming errors with clear user feedback

**Deliverables:**
- Streaming mode in PuzzleExaminer UI
- Graceful transition between streaming and complete views
- Error handling and fallback

---

### Chunk 2.4 - Incremental JSON Parsing
**Goal:** Display structured fields as they become available during streaming

**Tasks:**
- Integrate JSON streaming parser library (`@streamparser/json` or `jsonparse`)
- Parse incomplete JSON as tokens arrive
- Display completed fields immediately (`patternDescription`, `solvingStrategy`)
- Show loading placeholders for pending fields
- Handle array streaming (show `hints[]` items as they complete)
- Implement progressive prediction grid display
- Show partial reasoning items as array completes
- Handle malformed JSON gracefully (show raw text fallback)
- Update UI reactively as new fields parse successfully
- Ensure final complete response matches streamed preview

**Deliverables:**
- Incremental JSON parsing system
- Progressive field display
- Fallback for parsing errors

---

## Phase 3: Dual-System Coordination

### Chunk 3.1 - WebSocket + SSE Integration
**Goal:** Coordinate existing WebSocket progress with new SSE token streams

**Tasks:**
- Ensure WebSocket continues broadcasting discrete events (phase changes, iteration counts)
- Run SSE token streaming in parallel with WebSocket progress
- Show both token stream (SSE) and progress logs (WebSocket) in unified UI
- Create unified progress display combining both systems
- Prevent duplicate messages between systems
- Add visual distinction (tokens in one panel, logs in another)
- Ensure both systems update same underlying state correctly
- Handle race conditions between SSE completion and WebSocket status
- Test with Grover (iterative) and OpenAI (direct) workflows
- Document when to use each system

**Deliverables:**
- Coordinated dual-streaming system
- Unified progress UI
- Clear separation of concerns

---

### Chunk 3.2 - Grover + Saturn Integration
**Goal:** Ensure streaming works with existing iterative solvers

**Tasks:**
- Add streaming support to Grover service (stream each iteration's LLM call)
- Display streamed program code as Grover generates it
- Coordinate Grover progress broadcasts (WebSocket) with token streams (SSE)
- Add streaming to Saturn if needed (streaming visual solver prompts)
- Ensure iteration completion events trigger properly with streaming
- Test streaming within multi-iteration workflows
- Handle streaming cancellation mid-iteration gracefully
- Show per-iteration streaming status in UI
- Preserve existing iteration cards and progress visualization
- Document Grover/Saturn streaming behavior

**Deliverables:**
- Streaming-enabled iterative solvers
- Coordinated iteration + token streaming
- Clear UX for multi-step streaming

---

## Phase 4: Error Handling & Resilience

### Chunk 4.1 - Stream Interruption Handling
**Goal:** Gracefully handle network failures and stream interruptions

**Tasks:**
- Detect dropped connections (EventSource error events)
- Implement automatic reconnection with exponential backoff
- Preserve partial streamed data during reconnection attempts
- Resume streaming from last checkpoint if possible
- Show clear error messages for permanent failures
- Add manual retry button for failed streams
- Save partial responses to database with error flags
- Log stream interruptions for debugging
- Test with network throttling and disconnections
- Document recovery behavior for users

**Deliverables:**
- Robust reconnection logic
- Partial data preservation
- Clear error feedback

---

### Chunk 4.2 - Provider-Specific Error Handling
**Goal:** Handle quirks and failures from each LLM provider

**Tasks:**
- Implement OpenAI rate limit detection and backoff
- Handle Grok API timeouts and retries
- Manage OpenRouter proxy errors and fallbacks
- Parse and display provider-specific error messages
- Implement circuit breaker pattern for failing providers
- Add provider health monitoring
- Log provider errors for analysis
- Show user-friendly error messages (not raw API errors)
- Implement graceful degradation to non-streaming mode
- Test error scenarios for each provider

**Deliverables:**
- Provider-specific error handlers
- Circuit breaker implementation
- Graceful degradation

---

### Chunk 4.3 - Rate Limiting & Throttling
**Goal:** Prevent overwhelming clients or servers with streams

**Tasks:**
- Implement server-side rate limiting for SSE endpoints
- Add per-user stream concurrency limits
- Throttle token emission if client can't keep up
- Implement backpressure handling (pause stream if buffer full)
- Add stream priority system (premium users, urgent requests)
- Monitor active stream count and resource usage
- Add stream timeout enforcement (max 5 minutes)
- Implement graceful stream closure on timeout
- Log throttling events for capacity planning
- Document rate limits for API consumers

**Deliverables:**
- Rate limiting system
- Backpressure handling
- Resource monitoring

---

## Phase 5: Testing & Validation

### Chunk 5.1 - Unit Tests
**Goal:** Test streaming components in isolation

**Tasks:**
- Write tests for `StreamController` SSE emission
- Test `BaseAIService` streaming methods
- Mock OpenAI/Grok/OpenRouter streaming responses
- Test stream aggregation and JSON accumulation
- Test SSE message formatting
- Test connection cleanup and resource management
- Test error handling in streaming services
- Achieve 80%+ code coverage for streaming code
- Use Jest for backend tests, React Testing Library for frontend
- Document test cases and coverage

**Deliverables:**
- Comprehensive unit test suite
- High code coverage
- Documented test cases

---

### Chunk 5.2 - Integration Tests
**Goal:** Test end-to-end streaming workflows

**Tasks:**
- Test complete analysis flow with streaming enabled
- Test PuzzleExaminer streaming mode end-to-end
- Test Grover iterative streaming workflow
- Test WebSocket + SSE coordination
- Test stream interruption and recovery
- Test multi-client streaming scenarios
- Test database persistence after streaming
- Test streaming with all providers (OpenAI, Grok, OpenRouter)
- Use Playwright for E2E tests
- Document integration test scenarios

**Deliverables:**
- End-to-end test suite
- Multi-provider validation
- Documented test scenarios

---

### Chunk 5.3 - Performance Testing
**Goal:** Ensure streaming doesn't degrade performance

**Tasks:**
- Load test SSE endpoints with multiple concurrent streams
- Measure server memory usage during streaming
- Test client performance with rapid token updates
- Benchmark streaming vs. non-streaming response times
- Test with slow network connections (throttled)
- Monitor database write performance with streaming
- Test stream cleanup and resource deallocation
- Identify and fix memory leaks in streaming code
- Document performance benchmarks and limits
- Set up performance monitoring in production

**Deliverables:**
- Performance benchmarks
- Load testing results
- Production monitoring setup

---

## Phase 6: Documentation & Deployment

### Chunk 6.1 - Developer Documentation
**Goal:** Document streaming architecture for future developers

**Tasks:**
- Write architecture overview in `docs/STREAMING_ARCHITECTURE.md`
- Document SSE endpoint API in `docs/EXTERNAL_API.md`
- Add streaming examples to `docs/HOOKS_REFERENCE.md`
- Document provider-specific streaming quirks
- Create troubleshooting guide for streaming issues
- Document WebSocket vs. SSE usage guidelines
- Add streaming diagrams (sequence, architecture)
- Document configuration options for streaming
- Add migration guide from blocking to streaming mode
- Keep `AGENTS.md` updated with streaming guidance

**Deliverables:**
- Complete developer documentation
- Architecture diagrams
- Troubleshooting guide

---

### Chunk 6.2 - User Documentation
**Goal:** Help users understand and use streaming features

**Tasks:**
- Update `README.md` with streaming feature highlight
- Add streaming mode usage guide
- Document when to use streaming vs. non-streaming
- Create FAQ for streaming issues
- Add streaming demo video or screenshots
- Document streaming performance expectations
- Explain streaming UI elements and indicators
- Add streaming troubleshooting for end users
- Update changelog with streaming release notes
- Create user-facing announcement for streaming feature

**Deliverables:**
- User-facing documentation
- Usage guides
- FAQ and troubleshooting

---

### Chunk 6.3 - Deployment Preparation
**Goal:** Prepare streaming feature for production deployment

**Tasks:**
- Add feature flag for streaming (enable/disable globally)
- Configure environment variables for SSE endpoints
- Set up monitoring for streaming metrics (active streams, errors)
- Configure logging for streaming operations
- Add streaming health check endpoint
- Test deployment on Railway staging environment
- Configure reverse proxy (if any) for SSE compatibility
- Ensure keep-alive settings work with hosting platform
- Test streaming through CDN/load balancer
- Create rollback plan if streaming causes issues

**Deliverables:**
- Production-ready streaming feature
- Monitoring and logging
- Deployment checklist

---

### Chunk 6.4 - Gradual Rollout Strategy
**Goal:** Deploy streaming safely with minimal risk

**Tasks:**
- Deploy streaming feature behind feature flag (disabled by default)
- Enable streaming for admin/testing users only initially
- Monitor error rates and performance metrics
- Gradually enable for 10% of users, then 50%, then 100%
- Collect user feedback on streaming experience
- Fix issues discovered during rollout
- Compare streaming vs. non-streaming success rates
- Adjust rate limits based on production load
- Document rollout issues and resolutions
- Plan for final full rollout or rollback

**Deliverables:**
- Gradual rollout plan executed
- User feedback collected
- Final deployment decision

---

## Success Criteria

**Technical:**
- Token-by-token streaming works for OpenAI, Grok, and OpenRouter
- UI updates smoothly without freezing during long analysis
- SSE and WebSocket systems coexist without conflicts
- Stream interruptions recover gracefully
- No memory leaks or resource exhaustion
- 80%+ test coverage for streaming code

**User Experience:**
- Users see immediate feedback when starting analysis
- Reasoning content appears progressively, not after 30s delay
- Clear status indicators show streaming state
- Errors provide actionable feedback
- Streaming feels responsive and reliable

**Operational:**
- Streaming feature is production-stable
- Monitoring catches streaming issues
- Documentation enables future maintenance
- Performance meets or exceeds blocking mode

---

## Non-Goals (Out of Scope)

- Real-time collaborative editing
- Streaming for batch analysis operations
- Video/audio streaming
- Streaming historical analysis results
- P2P streaming between users

---

## Dependencies

- `@streamparser/json` or similar for incremental JSON parsing
- OpenAI SDK (already installed)
- xAI SDK (already installed)
- OpenRouter API access (already configured)
- EventSource API (browser native)
- Playwright for E2E tests (already installed)

---

## Risk Mitigation

**Risk:** Streaming introduces complexity and potential bugs  
**Mitigation:** Feature flag allows instant rollback, comprehensive testing before rollout

**Risk:** Provider APIs might not support streaming reliably  
**Mitigation:** Implement fallback to blocking mode, test with all providers

**Risk:** Streaming might overload server resources  
**Mitigation:** Rate limiting, stream limits, resource monitoring

**Risk:** Users on slow connections might have poor experience  
**Mitigation:** Adaptive streaming, buffering, clear status indicators

---

## Timeline (For Planning Only - No Commitments)

- Phase 1: Backend Infrastructure (largest effort)
- Phase 2: Frontend Integration (medium effort)
- Phase 3: Coordination (small effort)
- Phase 4: Error Handling (medium effort)
- Phase 5: Testing (medium effort)
- Phase 6: Documentation & Deployment (small effort)

Total estimated effort: Significant undertaking requiring thorough implementation and testing across entire stack.

---

## Next Steps

1. Review and approve this plan
2. Create tracking issues for each chunk in GitHub
3. Prioritize chunks and assign to developer(s)
4. Begin with Phase 1, Chunk 1.1 (SSE endpoint foundation)
5. Iterate through chunks sequentially, testing as you go
6. Deploy behind feature flag and gather feedback
7. Roll out gradually to production

---

**End of Plan**
