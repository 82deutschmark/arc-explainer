# AS66: Always Sliding - Intel & Strategy

## Game Overview
- **Game ID**: `as66`
- **Official Title**: Always Sliding
- **Category**: Evaluation
- **Difficulty**: Easy

## Core Mechanics
- **Player Avatar**: A yellow block.
- **Movement**: The block "Always Slides." When you press a direction (UP, DOWN, LEFT, RIGHT), it moves in that direction until it hits an obstacle (wall or boundary).
- **Goal**: Reach the indicated objective (usually a target position).

## Advanced Level Complications
- **Color Manipulation**: Later levels require the player block to change color by passing through or interacting with special colored objects.
- **Enemies**: 
  - **Orange and Red objects**: These are enemies.
  - **Behavior**: Can be static (stationary obstacles) or mobile (moving patterns).
  - **Interaction**: Collision typically results in failure.

## Proven Strategies
- **Level 1 Quick-Win**: `DOWN` -> `LEFT` -> `DOWN`.
- **Sliding Physics**: Use walls to "catch" the block and redirect its path. 
- **Deterministic Paths**: Since the block moves until it hits something, the search space is limited to intersection points and wall boundaries.

## Potential Obstacles for Agents
- **Pathfinding**: Traditional A* might oversimplify the "slide-to-stop" constraint.
- **Dynamic Timing**: Mobile enemies require the agent to time its moves, not just pathplan.

## Questions for Refining Strategy
1. **Enemy Movement**: Do orange/red enemies move in a predictable loop, or do they react to the player's position?
2. **Color Constraints**: Does the objective target have a specific color requirement that must match the player block?
3. **Reset Behavior**: When hitting an enemy, does the game auto-reset to the start of the level, or is a manual `RESET` required?
