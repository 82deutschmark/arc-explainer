# Game Schema

Structure and format of ARC-AGI-3 game environments

## Overview

ARC-AGI-3 games are turn-based environments where agents interact with 2D grids through a standardized action interface. Each game maintains state through discrete action-response cycles.

* Agents receive 1-N frames of JSON objects with the game state and metadata.
* Agents respond with an [action](/actions) to interact with the game.

## Grid Structure

* **Dimensions:** Maximum 64x64 grid size
* **Cell Values:** Integer values 0-15 representing different states/colors
* **Coordinate System:** (0,0) at top-left, (x,y) format

## Game ID Format

Game IDs are formatted as `<game_name>`-`<version>`.

`game_names` are stable, but `version` may change as games update.

## Game Available Actions

Each game provides an explicit set of available actions. The actions available vary per game and are stated explicitly so your agent knows what it can do.

To learn about the standardized action interface, see the [Actions](/actions) page.

To see how to retrieve a game's available actions programmatically, see [List Available Actions](/toolkit/list-actions).

## Agent Interaction Model

Agents operate within a request-response cycle:
1. They receive one or more frames containing JSON objects with game state and metadata
2. They submit an action to interact with the environment

## Available Actions

"Each game provides an explicit set of available actions" that varies by game. To understand the standardized action interface, agents should consult the Actions documentation page. Developers can programmatically retrieve available actions for a specific game using the List Available Actions toolkit.
