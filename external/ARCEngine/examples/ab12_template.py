"""
Author: Claude Sonnet 4 (adapted from ARC Prize Foundation example)
Date: 2026-01-31
PURPOSE: Click-to-remove puzzle game template. This is the official ARC-AGI-3
         tutorial example from https://docs.arcprize.org/add_game adapted for
         local development. Clone and modify this file to create your own games.
SRP/DRY check: Pass - Reference implementation with clear separation of concerns
"""

import random

from arcengine import (
    ARCBaseGame,
    Camera,
    GameAction,
    Level,
    Sprite,
)

# ==============================================================================
# SPRITE DEFINITIONS
# ==============================================================================

# Base sprite template - single pixel that will be cloned, scaled, and recolored
# Use this pattern for procedurally generated sprites
sprites = {
    "sprite-1": Sprite(
        pixels=[
            [9],  # Single pixel, color 9 (blue)
        ],
        name="sprite-1",
        visible=True,
        collidable=True,
    ),
}

# ==============================================================================
# LEVEL DEFINITIONS
# ==============================================================================

# Levels with increasing grid sizes
# Sprites are generated procedurally in on_set_level()
levels = [
    Level(sprites=[], grid_size=(8, 8)),
    Level(sprites=[], grid_size=(16, 16)),
    Level(sprites=[], grid_size=(24, 24)),
    Level(sprites=[], grid_size=(32, 32)),
    Level(sprites=[], grid_size=(64, 64)),
]

# ==============================================================================
# CONSTANTS
# ==============================================================================

BACKGROUND_COLOR = 0  # White background
PADDING_COLOR = 4  # Gray letterbox

# Available colors for sprites (excluding black/white for visibility)
SPRITE_COLORS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

# Parameters for procedural generation
MIN_SIZE = 1
MAX_SIZE = 4


# ==============================================================================
# GAME CLASS
# ==============================================================================


class Ab12(ARCBaseGame):
    """
    Click-to-remove puzzle game with seeded random sprite generation.

    Goal: Click all sprites to remove them from the level.
    Win: Remove all sprites from all 5 levels.

    This demonstrates:
    - Procedural sprite generation with seeding
    - ACTION6 (click) handling with coordinate conversion
    - Level progression with varying grid sizes
    - Win condition checking
    """

    def __init__(self, seed: int = 0) -> None:
        """Initialize the game with optional seed for reproducibility."""
        # Initialize random number generator with seed
        self._rng = random.Random(seed)

        # Create camera with background and padding colors
        # Camera viewport is 8x8 but will scale to fill 64x64 output
        camera = Camera(
            background=BACKGROUND_COLOR,
            letter_box=PADDING_COLOR,
            width=8,
            height=8,
        )

        # Initialize base game with levels and camera
        super().__init__(
            game_id="ab12",
            levels=levels,
            camera=camera,
        )

    def generate_sprites(self) -> None:
        """Generate a random set of sprites based on the seed."""
        # Calculate sprite count based on grid size
        grid_w, grid_h = self.current_level.grid_size
        cell_count = grid_w * grid_h
        sprite_count = cell_count // 64  # 1 sprite per 64 cells

        for _ in range(sprite_count):
            # Random properties for each sprite
            scale = self._rng.randint(MIN_SIZE, MAX_SIZE)
            color = self._rng.choice(SPRITE_COLORS)
            x = self._rng.randint(0, grid_w - 1)
            y = self._rng.randint(0, grid_h - 1)

            # Clone template sprite and apply random properties
            # Chain operations: clone -> recolor -> scale -> position
            sprite = (
                sprites["sprite-1"]
                .clone()
                .color_remap(None, color)  # None = remap all pixels
                .set_scale(scale)
                .set_position(x, y)
            )
            self.current_level.add_sprite(sprite)

    def on_set_level(self, level: Level) -> None:
        """Called when a level loads - generate sprites for this level."""
        self.generate_sprites()

    def _check_win(self) -> bool:
        """Check if all targets have been removed."""
        return len(self.current_level._sprites) == 0

    def step(self) -> None:
        """
        Process game logic for each step.

        This is called every time an action is received.
        MUST call self.complete_action() when done processing.
        """
        # Handle click action (ACTION6 provides x,y coordinates)
        if self.action.id == GameAction.ACTION6:
            # Extract coordinates from action data
            x = self.action.data.get("x", 0)
            y = self.action.data.get("y", 0)

            # Convert display coordinates (0-63) to grid coordinates
            # This handles camera scaling/offset
            coords = self.camera.display_to_grid(x, y)

            if coords:
                grid_x, grid_y = coords

                # Find sprite at clicked position
                clicked_sprite = self.current_level.get_sprite_at(grid_x, grid_y)
                if clicked_sprite:
                    # Remove the clicked sprite
                    self.current_level.remove_sprite(clicked_sprite)

                    # Check win condition
                    if self._check_win():
                        # next_level() handles:
                        # - Advancing to next level (calls on_set_level)
                        # - Calling win() if this was the last level
                        # - Incrementing score
                        self.next_level()

        # REQUIRED: Always call complete_action at end of step
        self.complete_action()


# ==============================================================================
# LOCAL TESTING
# ==============================================================================

if __name__ == "__main__":
    from arcengine import ActionInput, GameState

    # Create game instance with seed 42 for reproducibility
    game = Ab12(seed=42)

    # Get initial frame (performs RESET)
    frame = game.perform_action(ActionInput(id=GameAction.RESET))
    print(f"Game started: Level {frame.levels_completed + 1}")
    print(f"Grid: {frame}")

    # Simulate some clicks
    test_clicks = [(32, 32), (16, 16), (48, 48)]
    for x, y in test_clicks:
        frame = game.perform_action(
            ActionInput(id=GameAction.ACTION6, data={"x": x, "y": y})
        )
        print(f"Clicked ({x}, {y}) -> State: {frame.state}")

        if frame.state == GameState.WIN:
            print("Game won!")
            break

    print(f"Final: Level {frame.levels_completed + 1}, State: {frame.state}")
