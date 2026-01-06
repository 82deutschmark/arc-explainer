# SP80: Streaming Purple - Intel & Strategy

## Game Overview
- **Game ID**: `sp80`
- **Official Title**: Streaming Purple
- **Category**: Evaluation
- **Difficulty**: Medium

## Core Mechanics
- **Interaction Flow**: Position platforms (ACTION6) first, then initiate the stream (ACTION5).
- **Execution**: Once ACTION5 is pressed, the game simulates the flow over several frames automatically.
- **Pass/Fail**: If any purple pixel touches a non-container area, the turn results in failure. Level success requires perfect containment in the white U-shapes.

## Proven Strategies
- **Batch Placement**: Agents should not "drip-feed" platforms. They must build the entire skeleton of the pipe system before the first ACTION5.
- **Simulation**: Since the outcome is binary and irreversible per turn, the harness must simulate the gravity path $(x, y) \to (x, y+1)$ with platform reflections.

## Questions for Refining Strategy
1. **Interactive Refinement**: After the stream starts and a spill is detected, are you forced to `RESET` the whole level, or can you just move one platform and try again?
2. **Platform Weights**: Can the stream "push" or "dislodge" a platform that isn't anchored to a wall, or are platforms static once placed?

