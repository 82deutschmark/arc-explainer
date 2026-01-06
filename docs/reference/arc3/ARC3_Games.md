# Games

> Hand crafted environments that test interactive abstraction and reasoning

ARC-AGI-3 games are turn-based systems where agents interact with 2D grid environments through a standardized action interface. Each game maintains state through discrete action-response cycles.

* Agents will receive 1–N frames of JSON objects with the game state and metadata (3D or 4D; 4D gets unpacked).
* Agents will respond with an [action](/actions) RESET or ACTION1–7; ACTION6 includes x, y coordinates. ACTION7 is undo where supported.

### Available Games

To see which games are available, either go to [three.arcprize.org](https://three.arcprize.org) or make an API call to [list games](/api-reference/games/list-available-games).

THREE ORIGINAL PREVIEW GAMES:

* [ls20](https://three.arcprize.org/games/ls20) - Locksmith
* [ft09](https://three.arcprize.org/games/ft09) - Functional Tiles
* [vc33](https://three.arcprize.org/games/vc33) - Volume Control

THREE ORIGINAL Private Evaluation Games:

* [sp80](https://three.arcprize.org/games/sp80) - Streaming Purple
* [as66](https://three.arcprize.org/games/as66) - Always Sliding
* [lp85](https://three.arcprize.org/games/lp85) - Loop & Pull

### Game ID

Game IDs are formatted as `<game_name>`-`<version>`.

`game_names` are stable, but `version` may change as games update.

### Grid Structure

* **Dimensions:** Maximum 64x64 grid size
* **Cell Values:** Integer values 0-15 representing different states/colors
* **Coordinate System:** (0,0) at top-left, (x,y) format

### Game Available Actions

Each game provides an explicit set of actions; unavailable actions are omitted. The API may send numeric tokens or strings—server normalizes to canonical `RESET` / `ACTION1-7`. Missing/empty available_actions means “no restriction”.

Typical semantics:

* ACTION1–4: directional / simple interactions (game-specific)
* ACTION5: context-specific interact/execute
* ACTION6: coordinate-based (requires x,y)
* ACTION7: undo (if supported by the game)

To learn more about each action and what it does, please visit the [Actions](/actions).

## Running a Full Playtest

To run a complete playtest, you'll need to integrate your agent with scorecard management and the game loop. This is what happens "under the hood" when you run commands like `uv run main.py --agent=random --game=ls20` (from the [Quick Start](./quick-start.md)). Below is pseudocode for the key steps. For a ready-to-use implementation, see the [Swarms](./swarms.md) guide—which can automate this for you across multiple games.

## Game State Enumeration

| State          | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| `NOT_PLAYED`   | Fresh session, no actions taken yet                                |
| `IN_PROGRESS`  | Active run                                                         |
| `NOT_FINISHED` | Active but non-terminal (alias seen in some responses)             |
| `WIN`          | Objective completed successfully                                   |
| `GAME_OVER`    | Game terminated due to the max actions reached or other conditions |

## Full Playtest

This is a bare-bones example for (educational purposes) is also available as a [notebook](https://colab.research.google.com/drive/1Bt4PU6Xl_avLPV70hNAyReXaRqFDhifJ?usp=sharing).

```python
#!/usr/bin/env python3
"""
Simple demo showing what a swarm agent does under the hood.
This is a bare-bones example for educational purposes.
"""

import json
import os
import random
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=".env")

# Setup
ROOT_URL = "https://three.arcprize.org"
API_KEY = os.getenv("ARC_API_KEY")

# Create a session with headers
session = requests.Session()
session.headers.update({
    "X-API-Key": API_KEY,
    "Accept": "application/json"
})

print("=== MANUAL SWARM DEMO ===")
print("This shows what happens when an agent plays an ARC game.\n")

# Step 1: Get available games
print("STEP 1: Getting list of games...")
response = session.get(f"{ROOT_URL}/api/games")
games = [g["game_id"] for g in response.json()]
print(f"Found {len(games)} games")

# Pick a random game
game_id = random.choice(games)
print(f"Selected game: {game_id}\n")

# Step 2: Open a scorecard (tracks performance)
print("STEP 2: Opening scorecard...")
response = session.post(
    f"{ROOT_URL}/api/scorecard/open",
    json={"tags": ["manual_demo"]}
)
card_id = response.json()["card_id"]
print(f"Scorecard ID: {card_id}\n")

# Step 3: Start the game
print("STEP 3: Starting game with RESET action...")
url = f"{ROOT_URL}/api/cmd/RESET"
print(f"URL: {url}")
response = session.post(
    url,
    json={
        "game_id": game_id,
        "card_id": card_id
    }
)

# Check if response is valid
if response.status_code != 200:
    print(f"Error: {response.status_code} - {response.text}")
    exit()

game_data = response.json()
guid = game_data["guid"]
state = game_data["state"]
score = game_data.get("score", 0)
print(f"Game started! State: {state}, Score: {score}\n")

# Step 4: Play with random actions (max 5 actions)
print("STEP 4: Taking random actions...")
actions = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6", "ACTION7"]

for i in range(5):
    # Check if game is over
    if state in ["WIN", "GAME_OVER"]:
        print(f"\nGame ended! Final state: {state}, Score: {score}")
        break
    
    # Pick a random action
    action = random.choice(actions)
    
    # Build request data
    request_data = {
        "game_id": game_id,
        "card_id": card_id,
        "guid": guid
    }
    
    # ACTION6 needs x,y coordinates
    if action == "ACTION6":
        request_data["x"] = random.randint(0, 29)
        request_data["y"] = random.randint(0, 29)
        print(f"Action {i+1}: {action} at ({request_data['x']}, {request_data['y']})", end="")
    else:
        print(f"Action {i+1}: {action}", end="")
    
    # Take the action
    response = session.post(
        f"{ROOT_URL}/api/cmd/{action}",
        json=request_data
    )
    
    game_data = response.json()
    state = game_data["state"]
    score = game_data.get("score", 0)
    print(f" -> State: {state}, Score: {score}")

# Step 5: Close scorecard
print("\nSTEP 5: Closing scorecard...")
response = session.post(
    f"{ROOT_URL}/api/scorecard/close",
    json={"card_id": card_id}
)
scorecard = response.json()
print("Scorecard closed!")
print(f"\nView results at: {ROOT_URL}/scorecards/{card_id}")

print("\n=== DEMO COMPLETE ===")
print("\nThis is what every agent does:")
print("1. Get games list")
print("2. Open a scorecard")
print("3. Reset to start the game")
print("4. Take actions based on its strategy (we used random)")
print("5. Close the scorecard when done")
print("\nThe real agents use smarter strategies instead of random!")
```

This workflow ensures your plays are tracked officially. For parallel playtests across games, use a [swarm](./swarms.md) to handle the orchestration automatically.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.arcprize.org/llms.txt

## Scorecards
# Scorecards

> Keeping track of agent performance

Scorecards aggregate the results from your agent's [game](/games) performance.

In order to play a game, a scorecard must be opened, and the agent must submit the scorecard ID with each action. Running a [swarm](/swarms) (recommended) will automatically open/close a scorecard for each agent.

Scorecards can be viewed online at [https://three.arcprize.org/scorecards](https://three.arcprize.org/scorecards) and [https://three.arcprize.org/scorecards/\`scorecard\_id\`](https://three.arcprize.org/scorecards/`scorecard_id`).

Scorecard fields

| Field       | Description                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------- |
| tags        | Array of strings used to categorize and filter scorecards (e.g., \["experiment1", "v2.0", "test"]) |
| source\_url | Optional URL field returned in the scorecard response                                              |
| opaque      | Optional field for arbitrary data                                                                  |

Scorecards are not public, however you can share [replays](/recordings) with others.

Other scorecard notes:

* Scorecards auto close after 15min
* Agent scorecards are automatically added to the leaderboard in batch every \~15min
* Stopping the program prematurely with Ctrl‑C mid‑run will not allow you to see the scorecard results.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.arcprize.org/llms.txt

# Actions

> Your agent's interaction with the game

All games implement a standardized action interface with seven core actions:

| Action    | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `RESET`   | Initialize or restarts the game/level state                                                   |
| `ACTION1` | Simple action - varies by game (semantically mapped to up)                                    |
| `ACTION2` | Simple action - varies by game (semantically mapped to down)                                  |
| `ACTION3` | Simple action - varies by game (semantically mapped to left)                                  |
| `ACTION4` | Simple action - varies by game (semantically mapped to right)                                 |
| `ACTION5` | Simple action - varies by game (e.g., interact, select, rotate, attach/detach, execute, etc.) |
| `ACTION6` | Complex action requiring x,y coordinates (0-63 range)                                         |
| `ACTION7` | Simple action - Undo (e.g., interact, select)                                                 |

### Human Player Keybindings

When playing games manually in the ARC-AGI-3 UI, you can use these keyboard shortcuts instead of clicking action buttons:

| Control Scheme     | ACTION1 | ACTION2 | ACTION3 | ACTION4 | ACTION5 | ACTION6     | ACTION7    |
| ------------------ | ------- | ------- | ------- | ------- | ------- | ----------- | ---------- |
| **WASD + Space**   | `W`     | `S`     | `A`     | `D`     | `Space` | Mouse Click | CTRL/CMD+Z |
| **Arrow Keys + F** | `↑`     | `↓`     | `←`     | `→`     | `F`     | Mouse Click | CTRL/CMD+Z |

All control schemes support mouse clicking for ACTION6 (coordinate-based actions). Choose whichever scheme feels most comfortable for your playstyle.

### Available Actions

Each game explicitly defines the set of available actions that can be used within that game. This approach ensures clarity for both human and AI participants by making it clear which actions are permitted, thereby reducing confusion. In the human-facing UI, available actions are visually highlighted or dismissed to provide the same affordance.

For each action taken, the metadata of the returned frame will indicate which actions are available. Agents may use this information to narrow the action space and develop effective strategies for completing the game.

Note: Action 6 does not provide explicit X/Y coordinates for active areas. If Action 6 is available, only its availability will be indicated, without specifying which coordinates are active.

Action 7:  NOT USED IN ANY PREVIEW GAMES
---
# Recordings & Replays

> Viewing your agent's gameplay

The ARC-AGI-3 agent system includes automatic recording of gameplay sessions.

The most common way to view a recording is online in the ARC-AGI-3 UI. You can navigate to your scorecard to review your gameplay sessions.

Ex: `https://three.arcprize.org/scorecards/<scorecard_id>`

Here is an example [recording](https://three.arcprize.org/replay/ft09-16726c5b26ff/1d251d20-9043-4ace-9f9d-09822f5438d8)

## Automatic Recording

When running a [swarm](/swarms) all agent gameplay is also recorded by default and stored in the `recordings/` directory with GUID-based filenames:

```
ls20-6cbb1acf0530.random.100.a1b2c3d4-e5f6-7890-abcd-ef1234567890.recording.jsonl
```

The filename format is: `{game_id}.{agent_type}.{max_actions}.{guid}.recording.jsonl`

## Recording File Format

### JSONL Format

Recordings are stored in JSONL format with timestamped entries:

```json
{"timestamp": "2024-01-15T10:30:45.123456+00:00", "data": {"game_id": "ls20-016295f7601e", "frame": [...], "state": "NOT_FINISHED", "score": 5, "action_input": {"id": 0, "data": {"game_id": "ls20-016295f7601e"}, "reasoning": "..."}, "guid": "...", "full_reset": false}}
{"timestamp": "2024-01-15T10:30:46.234567+00:00", "data": {"game_id": "ls20-016295f7601e", "frame": [...], "state": "NOT_FINISHED", "score": 6, "action_input": {"id": 1, "data": {"game_id": "ls20-016295f7601e"}, "reasoning": "..."}, "guid": "...", "full_reset": false}}
```


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.arcprize.org/llms.txt