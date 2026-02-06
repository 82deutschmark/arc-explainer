"""
Author: Claude Sonnet 4
Date: 2026-01-31
PURPOSE: Inspect the official ARC-AGI-3 preview games (ls20, ft09, vc33) via API.
         This script lists available games and captures initial frames/metadata.
SRP/DRY check: Pass - Single purpose inspection script
"""

import arc_agi
from arcengine import GameAction, GameState

def inspect_game(arc: arc_agi.Arcade, game_id: str) -> dict:
    """Inspect a game and return its metadata and initial state."""
    print(f"\n{'='*60}")
    print(f"INSPECTING: {game_id}")
    print('='*60)
    
    try:
        # Create environment (no render for inspection)
        env = arc.make(game_id, render_mode=None)
        if env is None:
            print(f"  ERROR: Failed to create environment for {game_id}")
            return {"error": "Failed to create environment"}
        
        # Get available actions
        print(f"\n  Available Actions:")
        for action in env.action_space:
            print(f"    - {action}")
        
        # Get initial observation
        obs = env.reset()
        if obs:
            print(f"\n  Initial State:")
            print(f"    - State: {obs.state}")
            print(f"    - Levels completed: {obs.levels_completed}")
            print(f"    - Win levels: {obs.win_levels}")
            print(f"    - Frame count: {len(obs.frames) if obs.frames else 0}")
            
            if obs.frames and len(obs.frames) > 0:
                frame = obs.frames[0]
                print(f"    - Frame shape: {len(frame)}x{len(frame[0]) if frame else 0}")
                
                # Count unique colors used
                colors = set()
                for row in frame:
                    for pixel in row:
                        colors.add(pixel)
                print(f"    - Colors used: {sorted(colors)}")
        
        # Try one action to see response pattern
        print(f"\n  Testing ACTION1 (up)...")
        obs2 = env.step(GameAction.ACTION1)
        if obs2:
            print(f"    - State after: {obs2.state}")
            print(f"    - Frames returned: {len(obs2.frames) if obs2.frames else 0}")
        
        return {
            "game_id": game_id,
            "action_space": [str(a) for a in env.action_space],
            "win_levels": obs.win_levels if obs else None,
            "initial_state": str(obs.state) if obs else None,
        }
        
    except Exception as e:
        print(f"  ERROR: {e}")
        return {"error": str(e)}


def main():
    print("ARC-AGI-3 Preview Game Inspector")
    print("================================")
    
    # Initialize client
    arc = arc_agi.Arcade()
    
    # List all available games
    print("\nListing available games...")
    try:
        games = arc.list_games()
        if games:
            print(f"\nFound {len(games)} games:")
            for game in games:
                print(f"  - {game}")
        else:
            print("  No games found (may need API key)")
    except Exception as e:
        print(f"  Error listing games: {e}")
    
    # Inspect the three preview games
    preview_games = ["ls20", "ft09", "vc33"]
    results = {}
    
    for game_id in preview_games:
        results[game_id] = inspect_game(arc, game_id)
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for game_id, info in results.items():
        if "error" in info:
            print(f"{game_id}: ERROR - {info['error']}")
        else:
            print(f"{game_id}: {info.get('win_levels', '?')} levels, actions: {len(info.get('action_space', []))}")
    
    # Get scorecard
    print("\n" + "="*60)
    print("SCORECARD")
    print("="*60)
    try:
        scorecard = arc.get_scorecard()
        if scorecard:
            print(f"  Score: {scorecard.score}")
            print(f"  Details: {scorecard}")
    except Exception as e:
        print(f"  Error getting scorecard: {e}")


if __name__ == "__main__":
    main()
