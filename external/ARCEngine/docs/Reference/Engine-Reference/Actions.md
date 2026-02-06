# Actions

Standardized action interface for ARC-AGI-3 games

## Overview

The ARC-AGI-3 games utilize a standardized action interface comprising seven core actions that manage gameplay interactions.

## Core Actions

The system implements these fundamental controls:

- **RESET**: "Initialize or restarts the game/level state"
- **ACTION1**: Directional movement (up)
- **ACTION2**: Directional movement (down)
- **ACTION3**: Directional movement (left)
- **ACTION4**: Directional movement (right)
- **ACTION5**: Context-dependent interaction (e.g., select, rotate, execute)
- **ACTION6**: "Complex action requiring x,y coordinates (0-63 range)"
- **ACTION7**: Undo functionality

## Human Controls

Two keyboard schemes are available for manual play:

1. **WASD + Space**: Uses W/S/A/D for directions, Space for interaction, mouse for coordinates
2. **Arrow Keys + F**: Uses arrow keys for directions, F for interaction, mouse for coordinates

Both schemes support mouse clicking for coordinate-based actions.

## Implementation Details

Games explicitly define which actions are available for each session. The returned frame metadata indicates "which actions are available," allowing agents to adapt their strategies accordingly. Notably, ACTION6 availability is indicated without specifying active coordinate regions.

Human players receive visual feedback through highlighted or disabled action buttons matching the available action set.

## Action Availability

Each game provides an explicit set of available actions. The actions available vary per game and are stated explicitly so your agent knows what it can do.
