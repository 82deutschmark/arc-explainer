# LS20: Locksmith - Intel & Strategy

## Game Overview
- **Game ID**: `ls20`
- **Official Title**: Locksmith
- **Category**: Preview
- **Difficulty**: Hard

## Core Mechanics
- **Player Avatar**: A character controlled by UP, DOWN, LEFT, RIGHT.
- **Key Location**: The key is a distinct cluster of pixels located in the **bottom-left** area at the start of each level.
- **Goal**: Transform the key to match the door's lock requirements and reach the door.
- **Exit Logic**: The door does **not** require a trigger action (like ACTION5). Reaching it with the correct key configuration automatically wins the level.

## Proven Strategies
- **Three-Pillar Transformation**: Agents must account for changes in **Shape**, **Color**, and **Rotation**.
- **Transformation Mapping**: Each level has specific tiles that modify one of these three properties.
- **Visual Goal**: The door typically displays a "ghost" or "indicator" of the target key state.

## Potential Obstacles for Agents
- **Rotation Logic**: LLMs often struggle with 2D rotations. The harness must translate pixel-position changes into abstract rotation states (0, 90, 180, 270 deg).

## Questions for Refining Strategy
1. **Key Attachment/Collision**: Does the key cluster physically collide with walls/obstacles (potentially trapping the player), or is it a non-solid "tail" that simply follows the player?
2. **Multi-Key Scenarios**: Are there any "Level 10+" scenarios where multiple doors require different keys simultaneously, or is the logic always one-key-to-one-door per frame?

