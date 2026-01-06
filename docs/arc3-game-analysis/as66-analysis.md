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

## Questions for Refining Strategy
1. **Gate Friction**: When you slide into the white U-shaped exit, does the block "stop" automatically inside the U, or must there be a wall behind it to prevent you from sliding right past/through it?
2. **Enemy Cycle Prediction**: Do mobile enemies move one step for every player move, or do they move on a real-time clock independently of the player actions?

