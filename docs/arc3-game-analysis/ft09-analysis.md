# FT09: Functional Tiles - Intel & Strategy

## Game Overview
- **Game ID**: `ft09`
- **Official Title**: Functional Tiles
- **Category**: Preview
- **Difficulty**: Medium

## Core Mechanics
- **Interaction**: ACTION6 (Click) based.
- **Reference Area**: The **top-right** corner of the grid contains the "dominant colors" or "target configuration."
- **Goal**: Modify the main grid (via clicking) so that it matches the configuration/pattern dictated by the top-right reference.

## Proven Strategies
- **AISTHESIS Focus**: The agent must isolate the top-right region (e.g., a 3x3 or 4x4 sector) and treat it as the "Truth" or "Objective."
- **Iterative Alignment**: Compare the current grid state with the top-right reference and perform targeted clicks to correct discrepancies.

## Potential Obstacles for Agents
- **Static vs. Periodic**: Does the top-right reference change during the level, or is it static at the start?
- **Click Mapping**: Does clicking a tile cycle through colors, or does it flip a state?

## Questions for Refining Strategy
1. **Reference Grid Size**: Is the size of the top-right configuration area fixed (e.g., 5x5) or does it vary by difficulty/level?
2. **Click Side-Effects**: Does clicking one tile affect its neighbors (like Lights Out), or is it a direct 1:1 state change for that specific tile?
3. **Color Cycle**: If clicking cycles colors, what is the fixed sequence (e.g., White -> Blue -> Red -> ...)?
