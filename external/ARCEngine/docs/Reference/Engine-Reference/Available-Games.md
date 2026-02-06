# Available Games

Reference of ARC-AGI-3 games

## Overview

ARC-AGI-3 provides a collection of publicly playable games designed for both human players and AI agents to engage with.

## Access Methods

There are two primary ways to discover games:

1. Visiting the web interface at https://three.arcprize.org
2. Using the ARC-AGI Toolkit's programmatic game listing feature

## Authentication Requirements

By default, anonymous users can access three games upon launch. However, accessing the full suite of public games requires an API key. Users can obtain a complimentary key by visiting the API keys section of the documentation.

## Example Games Referenced

- "ls20 - Agent reasoning"
- "ft09 - Elementary Logic"
- "vc33 - Orchestration"

## Getting Started

To programmatically list available games, use the ARC-AGI Toolkit's `get_environments()` method, which retrieves all games you have access to. Each game object contains:
- `game_id`: unique identifier (e.g., `ls20-016295f7601e`)
- `title`: display name for the game
- `tags`: categorization metadata

## Accessing Your First Game

```python
from arc_agi import Arcade

arcade = Arcade()
games = arcade.get_environments()
env = arcade.make(games[0].game_id)
```

This will initialize an environment instance for the first available game.
