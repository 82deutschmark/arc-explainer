*
* Author: Codex using GPT-5-high
* Date: 2025-10-09T00:00:00Z
* PURPOSE: Detailed execution roadmap for implementing SSE token streaming for GPT-5 mini/nano and Grok-4 variants, covering backend, frontend, and deployment touchpoints to resolve UI blocking issues.
* SRP/DRY check: Pass — validated no existing execution roadmap for this effort.
* shadcn/ui: Pass — no UI authored in this document.

# SSE Streaming Execution Plan

## Objectives
- Deliver token streaming via SSE for GPT-5 mini/nano and Grok-4/Grok-4-Fast using the Responses API.
- Maintain coexistence with existing WebSocket progress events.
- Ensure backend services, frontend consumption, and operations follow SRP/DRY.

## Current Constraints
- Reuse existing repository/service abstractions; avoid duplicating logic already present.
- Preserve production readiness: no mock data, align with Drizzle repositories.
- Respect Responses API streaming structure (response.output_text.delta, reasoning, refusal tracks).

## Work Breakdown

### 1. Backend Infrastructure
1.1 Implement SSE controller and routing (`streamController`) with heartbeats and cleanup.  
1.2 Extend base AI service contracts with streaming interfaces and lifecycle helpers.  
1.3 Implement streaming for GPT-5 mini/nano within OpenAI service (Responses API).  
1.4 Implement streaming for Grok-4 and Grok-4-Fast (Responses API compatibility).  
1.5 Introduce shared aggregation to persist final responses and propagate stream closures.  
1.6 Add repository/service hooks if persistence or logging needs updates.

### 2. Frontend Integration
2.1 Create typed SSE client utility leveraging EventSource with retry strategy.  
2.2 Update analysis hooks to branch between blocking and streaming modes.  
2.3 Update UI components to render incremental reasoning/text safely via shadcn/ui primitives.  
2.4 Ensure cleanup when navigating away or cancelling analysis.

### 3. Feature Coordination
3.1 Introduce configuration toggles/feature flags.  
3.2 Align API contracts shared via `@shared` types for streaming payloads.  
3.3 Update docs/EXTERNAL_API.md and frontend hooks reference.

### 4. Error Handling
4.1 Add server-side guards for provider failures.  
4.2 Surface client-visible retry and fallback messaging.  
4.3 Log and metric hooks for monitoring.

### 5. Testing
5.1 Unit tests for SSE utilities and AI services.  
5.2 Integration tests covering streaming start, mid-stream, completion, and failure.  
5.3 Frontend tests verifying UI updates and cleanup.

### 6. Deployment
6.1 Update env/docs for streaming endpoints.  
6.2 Define rollout plan using feature flags and progressive enablement.  
6.3 Prepare rollback and monitoring checklist.

## Immediate Next Actions
- Complete backend Chunk 1.1 (SSE endpoint foundation).  
- Proceed sequentially through backend chunks before frontend work.  
- Keep Grok implementation aligned with Responses API semantics.

## Status Update
- Backend SSE controller and feature flag landed (`ENABLE_SSE_STREAMING`).
- OpenAI GPT-5 mini/nano and Grok-4(-Fast) providers stream via Responses API.
- Client-side EventSource helper (`createAnalysisStream`) and hook (`useAnalysisStreaming`) power Model Browser live view.
- Added unit tests (`npx tsx --test tests/sseUtils.test.ts`) for SSE parsing utilities.
