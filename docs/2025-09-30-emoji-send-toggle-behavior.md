# 2025-09-30 - Emoji Send Toggle Behavior

Author: Buffy the Base Agent
Date: 2025-09-30
PURPOSE: Clarify and document final behavior for sending grids as emojis outside Alien mode without making emojis the default.
SRP/DRY check: Pass. Minimal, focused edits. Reused existing prompt architecture and UI controls. No duplicate logic introduced.
shadcn/ui: Pass. UI uses existing shadcn components (Switch, Select, etc.).

## Final Behavior
- Default: Emojis OFF.
- When "Send as emojis" is ON: grids are formatted as emojis for the prompt even outside Alien mode.
- Alien Communication mode: always uses emojis regardless of the toggle.
- Prompt Preview respects the toggle: only sends emojiSetKey when the toggle is ON.

## Code Changes (Minimal)
- server/services/promptBuilder.ts
  - useEmojis = (!!emojiSetKey) || isAlien
  - Legacy path mirrors same rule with options.emojiSetKey
- client/src/components/PromptPreviewModal.tsx
  - Only include emojiSetKey in POST body when options.sendAsEmojis is true
- client/src/pages/PuzzleExaminer.tsx (already correct)
  - emojiSetKey: sendAsEmojis ? emojiSet : undefined (analysis path)

## How to Test
1) Open Puzzle Examiner page for any task.
2) Ensure the Advanced Options → "Send as emojis" is OFF.
   - Analyze with any model → prompts should show numeric grids.
   - Preview Prompt → numeric grids.
3) Turn ON "Send as emojis".
   - Preview Prompt → user prompt shows emoji grids.
   - Analyze with any model → backend sends emoji grids even when not in Alien mode.
4) Switch to Alien Communication mode.
   - Preview/Analyze continue using emoji grids regardless of the toggle.
5) Toggle OFF again.
   - Preview/Analyze revert to numeric grids outside Alien mode.

## Notes
- UI display (show emojis) is independent from what gets sent to the AI; sending is controlled by the "Send as emojis" toggle.
- Palette selection uses DEFAULT_EMOJI_SET when not changed by the user.
