# FT09: Functional Tiles - Intel & Strategy

## Game Overview
- **Game ID**: `ft09`
- **Official Title**: Functional Tiles
- **Category**: Preview
- **Difficulty**: Medium

## Core Mechanics
- **Interaction**: ACTION6 (Click) based.
- **Reference Area**: Static, top-right corner. It defines the goal state for the main grid.
- **Precedence Logic**: Colors are ranked. The **top-listed color** in the reference is dominant. 
- **Conflict Resolution**: If two colors/shapes "compete" for the same zone, the dominant color's preference takes precedent.
- **Tile Behavior**: Clicking a tile cycles it through available colors or toggles it back to its original state.

## Proven Strategies
- **AISTHESIS Focus**: Extract the rank order of colors from the top-right immediately.
- **Iterative Alignment**: Map the dominant color first, then layer the sub-dominant colors where they don't conflict.

## Questions for Refining Strategy
1. **Z-Order Persistence**: Does the order of clicks matter (e.g., clicking Red then Blue vs Blue then Red), or is the final state determined 100% by the static precedence rules?
2. **Behavior Uniformity**: Can a single grid contain a mix of "Toggle" tiles and "Cycle" tiles, or is the grid behavior consistent (all toggle or all cycle) per level?

