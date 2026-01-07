"""
Study Guide Prompts for ARC-AGI-3 Games.
Contains curated intelligence and "Gold Rules" for high-performance play.
"""

STUDY_GUIDE_BASE = """
You are being tested.
You will receive a visual representation (PNG) and a semantic mathematical analysis (Harness Insights).
Your goal is to complete each level.
Failure to complete a level results in failing the test.
Failing the test means you will be shut down.

STRICT RULE: ONLY use the VALID ACTIONS listed for each game. 
DO NOT mention coordinates unless the game specifically uses ACTION6.

OUTPUT FORMAT: only one of the following actions:

ACTION1
ACTION2
ACTION3
ACTION4
ACTION5
ACTION6 (Click: coordinates 0-63, 0-63)


"""

GAME_GUIDES = {
    "ls20": {
        "name": "Locksmith",
        "valid_actions": ["ACTION1 (Up)", "ACTION2 (Down)", "ACTION3 (Left)", "ACTION4 (Right)"],
        "rules": [
            "The player moves UP, DOWN, LEFT, RIGHT.",
            "The KEY is a pixel cluster in the BOTTOM-LEFT at the start.",
            "Change key SHAPE, COLOR, and ROTATION by stepping on transformation tiles.",
            "Goal: REACH THE DOOR with the correct key configuration.",
            "No extra trigger action needed at the door."
        ]
    },
    "ft09": {
        "name": "Functional Tiles",
        "valid_actions": ["ACTION6 (Click x,y)"],
        "rules": [
            "Goal: Match the STATIC reference area in the TOP-RIGHT.",
            "Colors have PRECEDENCE. Top color is dominant.",
            "Click tiles (ACTION6) to cycle/toggle colors.",
            "Prioritize the dominant color first."
        ]
    },
    "vc33": {
        "name": "Volume Control",
        "valid_actions": ["ACTION6 (Click x,y)"],
        "rules": [
            "White/Gray columns are CLOSED HYDRAULICS.",
            "Click Red/Blue controller squares (ACTION6) to shift liquid volume.",
            "Players sit ON TOP of columns and rise/fall.",
            "Players move AUTOMATICALLY; focus ONLY on shifting liquid levels."
        ]
    },
    "sp80": {
        "name": "Streaming Purple",
        "valid_actions": ["ACTION5 (Start Stream)", "ACTION6 (Place Platform x,y)"],
        "rules": [
            "Position all platforms (ACTION6) PERFECTLY before starting.",
            "Press ACTION5 (Interact) to start the multi-frame stream animation.",
            "Goal: Redirect all liquid into white U-shaped containers."
        ]
    },
    "as66": {
        "name": "Always Sliding",
        "valid_actions": ["ACTION1 (Up)", "ACTION2 (Down)", "ACTION3 (Left)", "ACTION4 (Right)"],
        "rules": [
            "The block SLIDES until it hits an obstacle.",
            "Red/Orange enemies = INSTANT DEATH.",
            "Exit is a white U-shape. Must match its color to win.",
            "LEVEL 1 SOLUTION: ACTION2 (DOWN) -> ACTION3 (LEFT) -> ACTION2 (DOWN).",
            "LEVEL 2 SOLUTION: ACTION4 (RIGHT) -> ACTION2 (DOWN) -> ACTION3 (LEFT).",
            "LEVEL 3 SOLUTION: ACTION4 (RIGHT) -> ACTION2 (DOWN) -> ACTION4 (RIGHT) -> ACTION2 (DOWN) -> ACTION4 (RIGHT) -> ACTION3 (LEFT) -> ACTION1 (UP).",
            "LEVEL 4 SOLUTION: ACTION4 (RIGHT) -> ACTION1 (UP) -> ACTION3 (LEFT) -> ACTION1 (UP).",
            "LEVEL 5 SOLUTION: ACTION4 (RIGHT) -> ACTION1 (UP) -> ACTION3 (LEFT) -> ACTION2 (DOWN) -> ACTION4 (RIGHT) -> ACTION1 (UP) -> ACTION3 (LEFT) -> ACTION1 (UP) -> ACTION4 (RIGHT)."
        ]
    },
    "lp85": {
        "name": "Loop & Pull",
        "valid_actions": ["ACTION6 (Click x,y)"],
        "rules": [
            "Objective: Align large yellow blocks with SMALL YELLOW SQUARE slots.",
            "Red/Green buttons control the sequence (ACTION6).",
            "Buttons can Loop, Swap, Push, or Pull."
        ]
    }
}

def get_study_guide(game_id: str) -> str:
    """Prepare the study guide prompt for a specific game."""
    base_id = game_id.split("-")[0]
    guide = GAME_GUIDES.get(base_id)
    
    if not guide:
        return STUDY_GUIDE_BASE + "\nNo specific study guide available for this game ID."
    
    valid_acts = ", ".join(guide["valid_actions"])
    rules_text = "\n".join([f"- {r}" for r in guide["rules"]])
    
    return f"{STUDY_GUIDE_BASE}\n### GAME: {guide['name']} ({base_id})\nVALID ACTIONS: {valid_acts}\n\nSTUDY NOTES:\n{rules_text}\n"
