# LLM Council UI + BYOK Redesign Plan

**Date:** 2026-01-02  
**Author:** Cascade (ChatGPT)  
**Status:** Draft – awaiting implementation  
**Scope:** Frontend layout/UX overhaul + BYOK enforcement for `/council` page (LLM Council)

---

## 1. Problem Statement
- Current page still looks like the old Model Debate layout with boxed sections, wide gutters, and the "Council Online" badge that the user wants removed.
- Explanation picker is capped at 20 items, hides correctness labels, and makes it hard to select from the full dataset.
- BYOK flow is missing for council runs even though they incur real API cost; failures appear as silent errors instead of instructing users to supply keys.
- Margins/spacing contradict new visual direction: page must be edge-to-edge with no outer padding.

## 2. Goals & Non-Goals
| Goal | Details |
|------|---------|
| G1 | Deliver an edge-to-edge, single-surface layout (no outer margins) with intentional typography and spacing. |
| G2 | Replace the explanation selector with unlimited data + correctness grouping + bulk selection tools. |
| G3 | Integrate the existing BYOK system so assessments require user keys when models/providers do. |
| G4 | Surface explicit BYOK prompts/errors (no silent failure). |
| Non-goals | Persisting results (handled by separate persistence plan), changing backend council workflow beyond explanation fetch and BYOK validation plumbing. |

## 3. UX/Visual Requirements
1. **Canvas:** Full-width background gradient or textured layer spanning the viewport; content columns float within but align flush to screen edges (tailwind `px-0` top-level, inner sections may use `px-6` for readability).
2. **Header Removal:** Drop the badge cluster entirely. Replace with a slim text header inline with puzzle selector.
3. **Panels:** Use a two-column responsive grid: configuration rail (~28rem fixed) and deliberation canvas (flex-fill). Cards stretch edge-to-edge with subtle dividers, not floating islands.
4. **Typography:** Use existing font stack but emphasize weight/size for puzzle IDs and stage labels; no gradient text or gimmicks.
5. **Empty/Loading States:** Keep streaming card logic but restyle to match new surface (borderless, light background). Maintain clarity for stage progress.

## 4. Data & Interaction Requirements
### 4.1 Explanation Fetching
- Remove `?limit=20` query param. Back end already supports `limit` optional; omit to retrieve all.
- Add loading skeleton capable of handling large arrays (virtualized list not required yet but list should remain performant via `overflow-auto` and grouping). 
- Provide counts: total, correct, incorrect, unknown.

### 4.2 Selector UX
- Present segmented controls or tabs for All / Correct / Incorrect (mirrors `ExplanationsList` pattern). Each tab still shows the counts.
- Within each group, show explanation cards with:
  - Model name, correctness badge, timestamp.
  - Buttons: select/deselect; “view detail” linking to `/explanations/:id` (optional).
- Include bulk actions: "Select All", "Select None", "Select Incorrect Only".
- Track selection state clearly (chips or pinned summary at top). If zero selected when required, show inline warning.

### 4.3 Streaming Panel
- Recenter stage indicators under a single horizontal tracker to match edge-to-edge style.
- Event log remains scrollable but adopt mono font on translucent background to reduce contrast.

## 5. BYOK Extension (per Codemap @[Bring Your Own Key (BYOK) System - Multi-Provider API Key Management])
1. **Frontend Prompting**
   - Reuse BYOK input component patterns (e.g., from `PoetiqControlPanel` and `SnakeArena`).
   - Add BYOK drawer on the config rail: provider dropdown + key input + helper text.
   - Show warning banner when council mode requires BYOK but key missing. This banner must render before user starts assessment.
2. **Detection Logic**
   - Mirror Poetiq logic: check selected council provider/model (likely openrouter default). Provide `useRequiresUserApiKey` helper for reuse or inline logic referencing existing whitelist constants.
3. **Validation**
   - Pass `apiKey` & `provider` through the POST `/api/council/assess/stream` payload (and non-stream path). Ensure backend rejects missing key when required (similar to Poetiq controller `requiresByo`).
   - Display toast/alert on rejection with actionable copy (“Provide your API key — nothing is stored server-side”).
4. **Error Handling**
   - If SSE stream errors due to missing key or billing, surface red alert at top of config rail, not just console log.

## 6. Implementation Phases
| Phase | Description | Owner |
|-------|-------------|-------|
| P1 | **Layout Refactor** – Update `LLMCouncil.tsx` container wrappers, remove badge header, align gradients. | Frontend dev |
| P2 | **Explanation Selector Revamp** – Build grouping component (reuse logic from `ExplanationsList`), integrate bulk actions, ensure unlimited fetch. | Frontend dev |
| P3 | **BYOK UI + Validation** – Add BYOK inputs, state, validation banner, payload plumbing to stream request; update backend controller/service to enforce BYOK. | Frontend + backend |
| P4 | **Error/Alert Polish** – Ensure missing key errors and provider health issues show inline. Adjust stage tracker visuals. | Frontend dev |
| P5 | **QA & Docs** – Document BYOK expectations (README section, inline comments), verify regression tests for controllers. | Dev + reviewer |

## 7. Dependencies & References
- **BYOK patterns:** `PoetiqControlPanel.tsx`, `SnakeArena.tsx`, `usePoetiqProgress.ts`, `poetiqController.ts`, `snakeBenchController.ts`, validators referenced in codemap.
- **Explanation correctness utilities:** `@shared/utils/correctness` (already used by ExplanationsList) – reuse for grouping.
- **Streaming handling:** existing `useAnalysisResults` not required; simply keep `LLMCouncil` SSE logic but update UI states.
- **Docs:** Update AGENTS or UI guide once implemented; include note that council runs depend on BYOK.

## 8. Acceptance Criteria
1. Page renders with zero outer margins and no "Council Online" badge.
2. Explanation list shows all entries, grouped by correctness, with working bulk selection + counts.
3. Attempting to start assessment without required API key displays blocking warning; backend rejects missing key with user-friendly error.
4. SSE failures due to auth or provider issues surface inline message.
5. BYOK key never persisted (single-session only) and documentation reflects this.
6. Visual style matches project guidance (no AI slop, purposeful typography/colors).

## 9. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Large explanation sets slow rendering | Use memoized grouping & minimal DOM (cards vs tables). Consider virtualized list later. |
| BYOK logic diverges from other flows | Centralize helper (`requiresUserApiKey`) or import whitelist constants so behavior stays consistent. |
| User confusion about costs | Prominent banner near start button + tooltip referencing BYOK doc. |

## 10. Next Steps
1. Get approval on this plan (user already requested plan doc). 
2. Assign developer(s) for Phases 1–5. 
3. After implementation, update `CHANGELOG.md` and relevant docs (BYOK overview, Council plan).
