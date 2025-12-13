# 2025-12-12 - WormArenaLive UX + Decomposition Refactor Plan

**Author:** Cascade  
**Date:** 2025-12-12  
**Purpose:** Fix Worm Arena Live UX by separating *setup vs live vs completed* flows, eliminating wasted space and misleading controls, and decomposing `client/src/pages/WormArenaLive.tsx` into small reusable chunks while reusing existing Worm Arena components/hooks.

---

## 1) Problems to Fix (Observed)

### 1.1 State-Content mismatch
- Page can show **Completed** while the main panel is labeled **LIVE BOARD** and is empty.
- "Start Match" appears even when the current session already finished.
- Matchup cards suggest selection/action but often do nothing for the current session.

### 1.2 Wasted real estate
- Right side reserves a large empty area before frames arrive.
- Left panel packs many controls that should not be visible in "completed" view.

### 1.3 Confusing and risky controls
- API key input is front-and-center (bad UX/security). "Use server keys" dropdown adds ambiguity.

### 1.4 Maintainability
- `WormArenaLive.tsx` is too large and mixes:
  - routing/session logic
  - streaming logic
  - match setup UI
  - status UI
  - results UI
  - board UI

---

## 2) Target UX: Three Explicit Modes

### Mode A - **Setup (no active session / starting a new run)**
**When:** user navigates to `/worm-arena/live` or to a sessionId that is not connected/valid.

**What user sees:**
- Title + nav only.
- A single compact setup panel:
  - matchup selection
  - advanced board params (collapsed)
  - (optional) BYO key (collapsed + explicit warning)
  - one primary CTA: **Start live match**

**What user does NOT see:**
- session badge
- "completed" results
- any empty live board placeholder area

### Mode B - **Live (session connected and in_progress / starting)**
**When:** `status in {'connecting','starting','in_progress'}`.

**Layout principle:** board-first. No big padding, no blank panels.

**What user sees:**
- A slim status strip at top of content: state badge + message + (batch progress if present).
- Main area shows the board immediately:
  - if no frame yet, show a *small* "Waiting for first frame..." placeholder (fixed height, not full panel)
- A collapsible "Controls" section (collapsed by default during live):
  - matchup selection disabled
  - advanced settings disabled
  - BYO key disabled

### Mode C - **Completed (session done)**
**When:** `finalSummary != null` OR `status === 'completed'`.

**What user sees (primary):**
- "Match complete" summary card with:
  - matchup
  - final scores
  - links: **View replay** + **Stats**
- Board area shows:
  - final frame (if available) OR a compact "No frames streamed for this match" + replay link

**What user sees (secondary):**
- A clear CTA: **Run another match** (reveals setup panel)

**What user does NOT see by default:**
- matchup selector list
- BYO key inputs
- misleading "Start Match" in the header

---

## 3) Layout Redesign (No Wasted Space)

### 3.1 Page structure
- Keep `WormArenaHeader` for navigation, but **remove any run/start action from the header**.
- Use a responsive two-column layout only when it earns its keep:
  - **Live:** content column is board-first; controls collapse.
  - **Completed:** content is results-first; controls hidden.

### 3.2 Spacing rules
- Reduce outer padding: replace `p-8` with a tighter `p-3`/`p-4`.
- Remove `min-h` hacks that force big blank areas.
- Board container:
  - no "flex-1" blank fill if no frame exists
  - placeholder has a fixed, modest height (e.g. ~240px) so the page doesn't look broken

### 3.3 Copy fixes
- Replace "Launch your first battle" with copy that matches mode:
  - Setup: "Start a live match"
  - Live: "Streaming..."
  - Completed: "Match complete"
- Rename CTA from "Start Match" to **Start live match** (setup) and **Run another match** (completed).

---

## 4) Component Decomposition (SRP/DRY)

### 4.1 Extract components from `WormArenaLive.tsx`
Create small components under `client/src/components/`:
- `WormArenaLiveStatusStrip`
  - Inputs: `status`, `message`, `error`, `batch counters`
  - Output: slim status UI only
- `WormArenaLiveBoardPanel`
  - Inputs: `latestFrame`, `boardWidth`, `boardHeight`, `status`
  - Uses: existing `WormArenaGameBoard`
  - Handles: compact placeholder vs board rendering
- `WormArenaLiveResultsPanel`
  - Inputs: `finalSummary`
  - Outputs: summary + links (replay/stats)
- `WormArenaRunControls`
  - Inputs: matchup selection, advanced settings, and CTA handlers
  - Handles: disabled state based on `status`
  - Owns collapsible "Advanced" and "BYO key" sections

### 4.2 Keep/reuse existing pieces
- Reuse:
  - `useWormArenaStreaming` (SSE contract unchanged)
  - `WormArenaHeader`
  - `WormArenaGameBoard`
  - `WormArenaMatchupSelector`

### 4.3 Delete/avoid duplication
- Do not duplicate replay rendering logic beyond showing the last frame.
- Do not duplicate "match finished" messaging in multiple places.

---

## 5) API Key UX/Security Adjustment

- Default: **server keys**, with *no key input visible*.
- Move BYO key into a collapsed "Advanced: Use your own API key" section.
- Add explicit copy:
  - "Key is used only for this request from your browser; it is not stored server-side."
- If we want stronger posture later: remove BYO key entirely from UI and rely on server config + server-side stored keys.

---

## 6) State Logic (Clear and Testable)

Define a single derived view state:
- `viewMode = 'setup' | 'live' | 'completed'`

Suggested rules:
- If `finalSummary` exists: `completed`
- Else if `status in {'connecting','starting','in_progress'}`: `live`
- Else: `setup`

This drives show/hide/disable of all UI.

---

## 7) File Plan (Proposed Changes)

### Create
- `client/src/components/WormArenaLiveStatusStrip.tsx`
- `client/src/components/WormArenaLiveBoardPanel.tsx`
- `client/src/components/WormArenaLiveResultsPanel.tsx`
- `client/src/components/WormArenaRunControls.tsx`

### Update
- `client/src/pages/WormArenaLive.tsx`
  - shrink to orchestration/routing only
  - remove header actionSlot
  - implement `viewMode` and new layout

### Optional follow-ups (only if needed)
- Adjust styling utilities/classes in the worm theme CSS (only if current classes force padding/blank area).

---

## 8) Acceptance Criteria

- **No empty "live board" wasteland:** page never shows a huge blank panel.
- **Completed sessions look completed:** results are front-and-center; setup controls hidden.
- **No misleading header CTA:** starting a match happens in setup controls, not the header.
- **Controls are mode-appropriate:** setup controls appear only when starting a new run (or explicitly expanded).
- **Code is decomposed:** `WormArenaLive.tsx` becomes a small coordinator and UI pieces are reusable.

---

## 9) Open Questions (Need Your Preference)

1. `/worm-arena/live/:sessionId` MUST be **strictly view-only** once completed (no "run another match" on that URL)!!!!
2. BYOK support is essential.  
