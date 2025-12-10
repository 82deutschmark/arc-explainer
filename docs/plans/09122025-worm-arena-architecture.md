# Worm Arena Architecture Refactor

## Objective
Fix page-purpose separation: WormArena (replay viewer) vs WormArenaLive (active match viewer). Remove Start Match from replay page. Extract shared UI components to eliminate duplication while maintaining page-specific logic.

## Current Issues
1. WormArena.tsx has "Start Match" button and scrollToControls logic (should not exist)
2. WormArenaHeader tied to replay page, prevents reuse in live page
3. Code duplication: both pages need header, controls, and board rendering
4. WormArenaLive has minimal styling; needs consistent farm aesthetic

## Files to Modify
- `client/src/pages/WormArena.tsx` - Remove Start Match; integrate session/game replay flow
- `client/src/pages/WormArenaLive.tsx` - Add header; integrate live streaming UI
- `client/src/components/WormArenaHeader.tsx` - Make agnostic (remove Start Match)
- `client/src/components/WormArenaControls.tsx` - Verify replay-only usage

## Files to Create
- `client/src/components/WormArenaHeaderStartAction.tsx` - Extracted "Start Match" button
- `client/src/components/WormArenaLiveStatus.tsx` - Live status display extracted from WormArenaLive

## Implementation Tasks

1. **Extract Start Match button into standalone component** (`WormArenaHeaderStartAction.tsx`)
   - Move button, loading state, and action callbacks from WormArenaHeader
   - Props: `isLoading`, `onPlayClick`, `onScrollToControls`
   - Export as optional child for header

2. **Refactor WormArenaHeader to generic header component**
   - Remove conditional `onPlayClick`, `onScrollToControls` props
   - Keep: title, worm decorations, stats (totalGames/matchupLabel), subtitles
   - Props become: `matchupLabel?`, `subtitle?`, `totalGames?`, `children?` (for action slot)
   - Support optional slot for header actions (to render WormArenaHeaderStartAction)

3. **Create WormArenaLiveStatus.tsx**
   - Extract live status panel from WormArenaLive (lines 104-139)
   - Props: `status`, `message`, `error`, `finalSummary`
   - Rendered on right side of live match view

4. **Update WormArena.tsx**
   - Render WormArenaHeader with `matchupLabel` only (no Start Match)
   - Remove `configRef`, `handleScrollToControls`, scroll logic
   - Keep game replay/controls flow unchanged
   - Setup section remains collapsible for selecting/configuring future matches

5. **Update WormArenaLive.tsx**
   - Add WormArenaHeader at top (no Start Match button)
   - Import WormArenaLiveStatus to replace inline status panel
   - Keep board + streaming logic unchanged
   - Consistent farm aesthetic (Fredoka fonts, earthy colors)

6. **Update WormArenaControls.tsx if needed**
   - Verify it's replay-only (playback controls, frame stepping)
   - No changes required; stays in WormArena.tsx only

## Shared vs Unique

### Shared (DRY)
- Header component (WormArenaHeader)
- Game board rendering (WormArenaGameBoard)
- Styling: Fredoka fonts, #f5f1e8 background, #d4b5a0 borders, earthy palette

### Unique to WormArena (Replay)
- WormArenaControls (play/pause, frame stepping)
- WormArenaReasoning (left/right reasoning columns)
- WormArenaRecentGames (game selection)
- WormArenaSetup (match configuration)
- Move reasoning toggle

### Unique to WormArenaLive (Active)
- WormArenaLiveStatus (session, final summary, replay link)
- Streaming connection management
- Status badges (Connecting, Streaming, Completed, Failed)
- Polling/SSE frame updates

## Integration Points
- Both pages use WormArenaGameBoard for visualization
- Both pages render farm-themed header with worm decorations
- WormArenaLive final summary links back to WormArena replay viewer
- Header can optionally render action buttons (slot-based composition)

## Validation
- WormArena has NO Start Match button; header is read-only
- WormArenaLive displays live status without replay controls
- Both pages styled consistently (Fredoka, farm palette)
- WormArenaHeader reusable; WormArenaHeaderStartAction used only in setup/initial state if needed
- No scroll-to-controls logic in replay page
