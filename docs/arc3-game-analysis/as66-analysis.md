# AS66: Always Sliding - Intel & Strategy

## Game Overview
- **Game ID**: `as66`
- **Official Title**: Always Sliding
- **Category**: Evaluation
- **Difficulty**: Easy

## Core Mechanics
- **Player Avatar**: Yellow sliding block.
- **Lethality**: Collision with orange or red enemies results in instant death. This applies to both static and mobile enemies.
- **Exit Condition**: The exit is a white U-shaped area. To win, the block must be the **matching color** expected by that specific door (often requiring a color-change via special objects first).

## Proven Strategies
- **Path Optimization**: Since death is instant, the safe path must be calculated with zero margins for error regarding enemy cycles.
- **Color Priming**: Always identify the color of the U-shaped exit gate before moving toward the finish line.

## Answers (read off Boss's 27-Dec-2025 winning recording, 2026-09-16)
1. **Gate Friction**: the cup's back wall is solid. The block enters through the open side and stops against the back wall; nothing slides through. A block in a pocket is not locked and leaves again if pressed toward the opening.
2. **Enemy Cycle Prediction**: enemies step exactly once per counted move (a blocked press moves nothing), and they step *before* the block slides. Corner-core enemies move diagonally, center-core enemies never move.

Full mechanics, level data and the recreation spec: `docs/plans/2026-09-16-as66-always-sliding-recreation-prd.md`, `as66_levels.json`, `as66_solutions.json`, `as66-levels-contact-sheet.png` in this folder.

