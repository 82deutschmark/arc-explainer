# Author: Cascade (ChatGPT)
# Date: 2026-02-01
# PURPOSE: Game registry providing centralized discovery and instantiation of all ARCEngine games.
#          Updated to include official ARC Prize preview IDs (ls20, ft09, vc33) alongside ws01/gw01.
# SRP/DRY check: Pass - registry module with version support

"""
ARCEngine Game Registry

Provides a central place to discover and instantiate available games.
Each game is identified by a unique game_id-version key.

Usage:
    from games import get_game, list_games, get_game_info

    # Get available games
    available = list_games()  # ["gw01", "ws01", "ls20", "ft09", "vc33"]

    # Instantiate a game by ID
    game = get_game("ws01")

    # Get full info including version
    info = get_game_info("ws01")  # {"id": "ws01", "version": "1.0.0", ...}
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from arcengine import ARCBaseGame

# Game registry with version info - using official game IDs
# Format: base_id -> (module_path, version)
_GAME_REGISTRY: dict[str, tuple[str, str]] = {
    "ws01": ("games.official.ws01", "1.0.0"),  # World Shifter
    "gw01": ("games.official.gw01", "1.0.0"),  # Gravity Well
    "ls20": ("games.official.ls20", "1.0.0"),  # Light Switch (ARC Prize)
    "ft09": ("games.official.ft09", "1.0.0"),  # Fill The Grid (ARC Prize)
    "vc33": ("games.official.vc33", "1.0.0"),  # Vector Chase (ARC Prize)
}


def get_game(game_id: str) -> "ARCBaseGame":
    """
    Instantiate a game by its ID.

    Args:
        game_id: The base identifier for the game (e.g., "ws01", "gw01")
                 Can also accept full game_id-version format (e.g., "ws01-1.0.0")

    Returns:
        A new instance of the requested game

    Raises:
        ValueError: If game_id is not recognized
    """
    # Handle full game_id-version format
    base_id = game_id.split("-")[0] if "-" in game_id else game_id

    if base_id not in _GAME_REGISTRY:
        available = ", ".join(sorted(_GAME_REGISTRY.keys()))
        raise ValueError(f"Unknown game: {game_id}. Available games: {available}")

    if base_id == "ws01":
        from games.official.ws01 import Ws01

        return Ws01()
    if base_id == "gw01":
        from games.official.gw01 import Gw01

        return Gw01()
    if base_id == "ls20":
        from games.official.ls20 import Ls20

        return Ls20()
    if base_id == "ft09":
        from games.official.ft09 import Ft09

        return Ft09()
    if base_id == "vc33":
        from games.official.vc33 import Vc33

        return Vc33()

    raise ValueError(f"Game {game_id} registered but not implemented")


def list_games() -> list[str]:
    """
    Return list of available game base IDs.

    Returns:
        Sorted list of game identifiers
    """
    return sorted(_GAME_REGISTRY.keys())


def get_game_info(game_id: str) -> dict[str, str]:
    """
    Get metadata about a game including version.

    Args:
        game_id: The base identifier for the game

    Returns:
        Dict with id, version, and full_id (game_id-version format)

    Raises:
        ValueError: If game_id is not recognized
    """
    if game_id not in _GAME_REGISTRY:
        available = ", ".join(sorted(_GAME_REGISTRY.keys()))
        raise ValueError(f"Unknown game: {game_id}. Available games: {available}")

    module_path, version = _GAME_REGISTRY[game_id]
    return {
        "id": game_id,
        "version": version,
        "full_id": f"{game_id}-{version}",
        "module": module_path,
    }


def list_games_with_versions() -> list[dict[str, str]]:
    """
    Return list of all games with their version info.

    Returns:
        List of dicts with id, version, and full_id for each game
    """
    return [get_game_info(game_id) for game_id in sorted(_GAME_REGISTRY.keys())]
