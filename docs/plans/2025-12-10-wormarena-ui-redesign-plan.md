# 2025-12-10-wormarena-ui-redesign-plan

## Goal
Bring Worm Arena replay UI in line with SnakeBench's layout (header nav, compact controls, single reasoning display per player, improved typography).

## Key Tasks
1. Add navigation links to `WormArenaHeader` (Live, Replay, Leaderboard) with active state.
2. Replace bulky `WormArenaControls` usage with a new horizontal `WormArenaControlBar` focused on playback + thought toggle.
3. Refresh `WormArenaReasoning` to show one panel per player, bolder typography, and emoji score badges (no duplicate reasoning content).
4. Restructure `client/src/pages/WormArena.tsx` to:
   - remove the legacy middle section,
   - show matchup title/timestamp first,
   - keep three-column layout (reasoning-board-reasoning),
   - render the new control bar + compact metadata strip + accordion selector.
5. Update supporting styles + typography to ensure headings and controls are bold/legible.
6. Document the redesign in CHANGELOG with semantic version bump.

## Verification Checklist
- Header renders nav links with proper active state.
- Only the 3-column reasoning panels show model thoughts.
- Control bar buttons and thought toggle work after refactor.
- Scores render via apple icons in reasoning panels.
- Match metadata + copyable ID appear under the controls.
- Recent games accordion still works.
- CHANGELOG entry added at the top.
