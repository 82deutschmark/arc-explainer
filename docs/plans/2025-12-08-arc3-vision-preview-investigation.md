# ARC3 Vision Preview Investigation

**Date:** 2025-12-08
**Author:** Claude Code using Opus 4.5
**Status:** Investigation incomplete - handoff document

---

## Problem Statement

User tested the ARC3 Agent Playground and saw **no indication** that:
1. A base64 PNG image is being generated from the grid
2. The image is being passed to the vision-enabled agent
3. The image is displayed in the UI for users to see what the agent sees

The implementation plan (`2025-12-07-arc3-playground-improvements-plan.md`) was marked "complete" but testing failed.

---

## What Should Happen

1. **Backend** generates a base64 PNG from the 64×64 grid
2. **Backend** passes the image to the agent via `inspect_game_state` tool result
3. **Frontend** displays the image in a preview component so users can verify

---

## Current State (Unverified)

### Backend Components

| File | Purpose |
|------|---------|
| `server/services/arc3/arc3GridImageService.ts` | Contains `renderArc3FrameToPng()` - generates base64 PNG |
| `server/services/arc3/Arc3RealGameRunner.ts` | Contains `inspect_game_state` tool that calls the image service |
| `server/services/arc3/Arc3StreamService.ts` | Manages SSE streaming, calls `runWithStreaming()` |
| `server/services/streaming/SSEStreamManager.ts` | Sends events to frontend via SSE |

### Frontend Components

| File | Purpose |
|------|---------|
| `client/src/hooks/useArc3AgentStream.ts` | Receives `agent.tool_result` SSE events, adds to timeline |
| `client/src/pages/ARC3AgentPlayground.tsx` | Extracts `latestFrameImage` from timeline (lines 266-282) |
| `client/src/components/arc3/Arc3AgentVisionPreview.tsx` | Displays the image (returns null if no image) |

---

## Known Issues

1. **Dead code**: `Arc3RealGameRunner.ts` has TWO versions of every tool (streaming and non-streaming). The non-streaming version (lines 70-340) is dead code - only streaming is used. This is a DRY violation.

2. **Silent failure**: `Arc3AgentVisionPreview` returns `null` when there's no image, giving users no feedback that the feature exists.

3. **Unverified image generation**: Need to check server logs for `[ARC3 TOOL STREAM] Generated frame image` to confirm `renderArc3FrameToPng()` succeeds.

---

## Next Steps

1. Run the agent and check server logs for image generation messages
2. If images generate: trace why they don't reach the frontend
3. If images fail: debug `renderArc3FrameToPng()` (uses `sharp` library)
4. Fix `Arc3AgentVisionPreview` to show placeholder when no image
5. Delete dead non-streaming code from `Arc3RealGameRunner.ts`

---

## Related Documents

- `docs/plans/2025-12-07-arc3-playground-improvements-plan.md` - Original plan (marked complete prematurely)
- `docs/reference/arc3/ARC3_Agent_Playbook.md` - Agent design guidance
