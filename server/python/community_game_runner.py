#!/usr/bin/env python3
"""
Author: Cascade (Claude)
Date: 2026-01-31
PURPOSE: Community Game Runner for ARCEngine games. Reads commands from stdin,
         executes game actions via the ARCEngine library, and outputs NDJSON to stdout.
         This bridge enables Node.js to run user-uploaded Python games.
SRP/DRY check: Pass - single-purpose Python subprocess runner for ARCEngine games.
"""

import sys
import json
import importlib.util
import traceback
from pathlib import Path

# Add ARCEngine to path (external submodule)
ARCENGINE_PATH = Path(__file__).parent.parent.parent / "external" / "ARCEngine"
sys.path.insert(0, str(ARCENGINE_PATH))

try:
    from arcengine import ARCBaseGame, ActionInput, GameAction
except ImportError as e:
    print(json.dumps({
        "type": "error",
        "code": "ARCENGINE_NOT_FOUND",
        "message": f"Failed to import ARCEngine: {e}"
    }), flush=True)
    sys.exit(1)


def load_game_from_file(file_path: str):
    """
    Dynamically load a game class from a Python file.
    Searches for a class that subclasses ARCBaseGame.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Game file not found: {file_path}")
    
    spec = importlib.util.spec_from_file_location("community_game", file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from: {file_path}")
    
    module = importlib.util.module_from_spec(spec)
    sys.modules["community_game"] = module
    spec.loader.exec_module(module)
    
    # Find the game class (subclass of ARCBaseGame)
    game_class = None
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if (isinstance(attr, type) and 
            issubclass(attr, ARCBaseGame) and 
            attr is not ARCBaseGame):
            game_class = attr
            break
    
    if game_class is None:
        raise ValueError("No ARCBaseGame subclass found in file")
    
    return game_class


def emit_frame(game, action_name: str, frame_data=None):
    """Emit frame data as NDJSON to stdout."""
    if frame_data is None:
        # Get initial frame via RESET
        frame_data = game.perform_action(ActionInput(id=GameAction.RESET))
    
    # Convert frame to list if it's a numpy array
    frame = frame_data.frame
    if hasattr(frame, 'tolist'):
        frame = frame.tolist()
    
    output = {
        "type": "frame",
        "game_id": getattr(game, 'game_id', 'unknown'),
        "frame": frame,
        "score": frame_data.score,
        "state": frame_data.state,
        "action_counter": getattr(frame_data, 'action_counter', 0),
        "max_actions": getattr(frame_data, 'max_actions', 100),
        "win_score": getattr(frame_data, 'win_score', 1),
        "available_actions": getattr(frame_data, 'available_actions', []),
        "last_action": action_name
    }
    print(json.dumps(output), flush=True)


def emit_error(message: str, code: str = "GAME_ERROR"):
    """Emit error message as NDJSON to stdout."""
    print(json.dumps({
        "type": "error",
        "code": code,
        "message": message
    }), flush=True)


def emit_ready(game_id: str, metadata: dict):
    """Emit ready signal with game metadata."""
    print(json.dumps({
        "type": "ready",
        "game_id": game_id,
        "metadata": metadata
    }), flush=True)


def get_action_from_string(action_str: str) -> GameAction:
    """Convert action string to GameAction enum."""
    action_map = {
        "RESET": GameAction.RESET,
        "ACTION1": GameAction.ACTION1,
        "ACTION2": GameAction.ACTION2,
        "ACTION3": GameAction.ACTION3,
        "ACTION4": GameAction.ACTION4,
        "ACTION5": GameAction.ACTION5,
        "ACTION6": GameAction.ACTION6,
        "ACTION7": GameAction.ACTION7,
    }
    return action_map.get(action_str.upper(), GameAction.ACTION1)


def main():
    """Main entry point for the community game runner."""
    game = None
    
    try:
        # Read initial payload from stdin (game path)
        init_line = sys.stdin.readline()
        if not init_line:
            emit_error("No initialization payload received", "NO_PAYLOAD")
            return 1
        
        payload = json.loads(init_line.strip())
        game_path = payload.get("game_path")
        
        if not game_path:
            emit_error("game_path is required", "MISSING_GAME_PATH")
            return 1
        
        # Load and instantiate the game
        GameClass = load_game_from_file(game_path)
        game = GameClass()
        
        # Extract metadata
        metadata = {
            "game_id": getattr(game, 'game_id', 'unknown'),
            "level_count": len(getattr(game, 'levels', [])),
            "win_score": getattr(game, 'win_score', 1),
            "max_actions": getattr(game, 'max_actions', 100),
        }
        
        # Emit ready signal
        emit_ready(metadata["game_id"], metadata)
        
        # Output initial frame
        emit_frame(game, "INIT")
        
        # Action loop - read commands from stdin
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                cmd = json.loads(line)
                action_str = cmd.get("action", "ACTION1")
                coordinates = cmd.get("coordinates")
                
                # Build action input
                action_id = get_action_from_string(action_str)
                action_input = ActionInput(id=action_id)
                
                # Handle coordinates for ACTION6 (click/select)
                if coordinates and action_str.upper() == "ACTION6":
                    if len(coordinates) >= 2:
                        action_input.x = coordinates[0]
                        action_input.y = coordinates[1]
                
                # Execute action
                frame_data = game.perform_action(action_input)
                emit_frame(game, action_str, frame_data)
                
            except json.JSONDecodeError as e:
                emit_error(f"Invalid JSON command: {e}", "INVALID_JSON")
            except Exception as e:
                emit_error(f"Action execution failed: {e}", "ACTION_ERROR")
                traceback.print_exc(file=sys.stderr)
                
    except FileNotFoundError as e:
        emit_error(str(e), "FILE_NOT_FOUND")
        return 1
    except ImportError as e:
        emit_error(f"Failed to import game: {e}", "IMPORT_ERROR")
        return 1
    except ValueError as e:
        emit_error(str(e), "INVALID_GAME")
        return 1
    except Exception as e:
        emit_error(f"Unexpected error: {e}", "UNEXPECTED_ERROR")
        traceback.print_exc(file=sys.stderr)
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
