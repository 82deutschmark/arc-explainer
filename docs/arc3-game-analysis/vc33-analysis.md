# VC33: Volume Control - Intel & Strategy

## Game Overview
- **Game ID**: `vc33`
- **Official Title**: Volume Control
- **Category**: Preview
- **Difficulty**: Medium

## Core Mechanics
- **Player Objects**: Large squares in Yellow, Green, and Purple.
- **Environment**: Contains "doors" (narrow passages) and "white columns."
- **Controls**: Clicking specific **Red or Blue squares** controls the height (volume) of the **white columns**.
- **Goal**: Clear the path for the colored player squares so they can pass through doors and reach their objectives.

## Proven Strategies
- **Logic Mapping**: Determine which Red/Blue controller square maps to which white column.
- **Elevation Management**: Lower or raise columns strategically to create gaps just large enough for the players (Yellow/Green/Purple) to move through.

## Potential Obstacles for Agents
- **Orchestration**: Managing multiple players simultaneously or in a specific order.
- **Controller Feedback**: Understanding that "Red" might mean "Lower" and "Blue" might mean "Raise" (or vice versa).

## Questions for Refining Strategy
1. **Controller Logic**: Is the mapping between Red/Blue squares and white columns always 1:1, or can one click effect multiple columns?
2. **Player Movement**: Do the players (Yellow/Green/Purple squares) move autonomously towards the objective once the path is clear, or must the agent also control their movement using other actions?
3. **Collision**: What happens if a column is raised while a player square is occupying its space?
