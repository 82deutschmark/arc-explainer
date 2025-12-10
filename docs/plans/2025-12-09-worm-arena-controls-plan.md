# Worm Arena Replay Controls Plan

*Author: Cascade*
*Date: 2025-12-09*

## Purpose

Define a small, self-contained replay controls component for Worm Arena that:

- Keeps all transport logic (play / pause / step / jump) out of `SnakeArena.tsx`.
- Provides clear, non-technical wording around rounds and model thoughts.
- Is reusable for future redesigns without changing the core replay logic.

This plan is text- and behavior-focused so another agent can handle detailed visuals.

## Component: `WormArenacontrol.tsx`

Location: `client/src/components/WormArenacontrol.tsx`

Exports:
- `WormArenaControlsProps` – props interface.
- `default` – `WormArenaControls` React component.

### Responsibilities

- Show where we are in the match:
  - Current round index and total rounds.
  - Which models are playing (label passed from parent).
- Provide replay transport controls:
  - Jump to first / last round.
  - Step backward / forward by one round.
  - Toggle play / pause.
- Display two text areas for model thoughts:
  - "Current move" thought.
  - "Upcoming move" thought, if available.
- Surface replay-level loading and error text.

The component does **not**:
- Parse SnakeBench JSON.
- Own timers, intervals, or frame arrays.
- Own any network calls.

### Props (high level)

```ts
interface WormArenaControlsProps {
  // Match context
  modelsLabel: string;              // e.g. "Grok 4.1 Fast vs GPT‑5.1 Codex Mini"
  currentRound: number;            // 1-based
  totalRounds: number;             // total frames/rounds

  // Thoughts text (optional)
  currentThought?: string | null;  // thought for this round
  upcomingThought?: string | null; // thought for next round

  // Playback state
  isPlaying: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;

  // Navigation capabilities
  canStepBackward: boolean;
  canStepForward: boolean;

  // Callbacks (parent owns state)
  onPlayToggle: () => void;
  onStepPrevious: () => void;
  onStepNext: () => void;
  onJumpToStart?: () => void;
  onJumpToEnd?: () => void;
}
```

### Text and wording

- Title: `Replay controls`.
- Match line: `Round {currentRound} of {totalRounds} · {modelsLabel}`.
- Error line (when present): `Replay error: {errorMessage}`.
- Loading line (when `isLoading`): `Loading replay…`.
- Thoughts section:
  - Left card header: `Current move — {model name}` (parent bakes model name into `modelsLabel` or future props).
  - Right card header: `Upcoming move`.
  - Empty-state copy:
    - Current: `No thoughts recorded for this round.`
    - Upcoming: `No upcoming move recorded yet.`
- Controls bar button labels:
  - `« First`, `‹ Prev`, `Play` / `Pause`, `Next ›`, `Last »`.
  - Frame status text: `Round {currentRound} of {totalRounds}`; or `No rounds available yet.` when `totalRounds === 0`.

### Integration with `SnakeArena.tsx`

Parent constructs props from existing state:

- `currentRound = frames.length === 0 ? 0 : frameIndex + 1`.
- `totalRounds = frames.length`.
- `modelsLabel = models.length > 0 ? models.join(' vs ') : `${modelA || 'Model A'} vs ${modelB || 'Model B'}``.
- `isPlaying`, `isLoading = loadingReplay`, `errorMessage = replayError ? String(replayError) : null`.
- `canStepBackward = frameIndex > 0`.
- `canStepForward = frameIndex < frames.length - 1`.
- `onPlayToggle` / `onStepPrevious` / `onStepNext` / `onJumpToStart` / `onJumpToEnd` all delegate to existing `setFrameIndex` / `setIsPlaying` logic.
- `currentThought` / `upcomingThought` are initially `undefined` until replay JSON surfaces explicit reasoning fields.

Placement in UI:

- Keep summary (scores, rounds, board size) and ASCII board in `SnakeArena.tsx`.
- Render `<WormArenaControls />` in the right-hand replay column between the summary grid and ASCII frame.
- Remove inline `Prev` / `Next` buttons from `SnakeArena.tsx` so all navigation lives in the new component.

### Migration notes

- This is a refactor of existing controls, not a new backend feature.
- Transport behavior (how frames advance) must remain identical to the current implementation.
- Visual styling may be updated later by a separate agent; this plan only fixes structure and wording.
