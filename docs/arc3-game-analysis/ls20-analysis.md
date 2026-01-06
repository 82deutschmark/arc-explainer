# LS20: Locksmith - Intel & Strategy

## Game Overview
- **Game ID**: `ls20`
- **Official Title**: Locksmith
- **Category**: Preview
- **Difficulty**: Hard

## Core Mechanics
- **Player Avatar**: A character that can be moved around the grid.
- **Key Mechanics**: The "Key" has a specific shape. Stepping over certain tiles (possibly color-coded) changes the shape of the key.
- **Goal**: Reach the **exit door** after transforming the key into the correct required shape for the lock.

## Proven Strategies
- **Avatar Tracking**: Consistent monitoring of the player character's (x,y) coordinates.
- **Transformation Discovery**: Map out which "special tiles" correspond to which key-shape changes. This is essentially a "recipe" discovery problem.
- **Exit Logic**: The door remains locked or impassable until the "Belief" in the current key shape matches the "Lock" requirement.

## Potential Obstacles for Agents
- **Pathfinding with State**: The agent cannot just walk to the exit; it must walk a specific "transformation path" first.
- **Visual Feedback**: The "key shape" might be represented in a separate UI area or attached to the player sprite.

## Questions for Refining Strategy
1. **Key Visualization**: Is the current "Key Shape" shown in the main grid (e.g., as a cluster of pixels following the player) or in a separate status area?
2. **Tile Permanence**: Do the transformation tiles disappear after one use, or can you step on them multiple times to "cycle" shapes?
3. **Door Logic**: Is there a visual hint that reveals what the *target* key shape should be (e.g., a preview next to the door)?
