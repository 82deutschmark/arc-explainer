# 2025-02-14 Structured streaming plan

## Goal
Enhance streaming hook and panel to surface incremental JSON deltas from Responses models without regressing plain text providers.

## Scope & Target files
- client/src/hooks/useAnalysisStreaming.ts — track structured deltas and expose aggregated buffers.
- client/src/pages/ModelBrowser.tsx — update panel props wiring if needed.
- client/src/components/puzzle/StreamingAnalysisPanel.tsx — render structured JSON buffer with fallback to existing text display.
- tests or smoke instructions — ensure manual smoke test documentation if applicable.

## Tasks
1. Audit `StreamChunkPayload` contract to confirm json delta shape; ensure hook concatenates `delta` content for `type === 'json'` and exposes aggregated state.
2. Update hook return type to surface structured buffer (string or parsed JSON) alongside existing text/reasoning, ensuring memoized recomputation and compatibility with existing consumers.
3. Modify `StreamingAnalysisPanel` to prefer structured buffer when available, formatting JSON pretty (parse+stringify) similar to responses starter repo; preserve reasoning text and token usage sections.
4. Verify `ModelBrowser` wiring uses new hook fields and adjust UI as required.
5. Run smoke test by connecting to Responses model to verify incremental JSON updates render live; document command/results.
