"""Key Forge: Collect key fragments in a maze to unlock the door."""

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

# =============================================================================
# SPRITES
# =============================================================================

sprites = {
    # Player - starts as a single blue pixel
    "player": Sprite(
        pixels=[[9]],  # Light blue
        name="player",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        tags=["player"],
    ),
    # Key fragment: top piece (horizontal bar)
    "fragment_top": Sprite(
        pixels=[
            [4, 4, 4],  # Yellow - top of key
        ],
        name="fragment_top",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["fragment"],
    ),
    # Key fragment: vertical shaft
    "fragment_shaft": Sprite(
        pixels=[
            [4],  # Yellow
            [4],
        ],
        name="fragment_shaft",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["fragment"],
    ),
    # Key fragment: teeth at bottom
    "fragment_teeth": Sprite(
        pixels=[
            [4, 4],  # Yellow - teeth
            [4, -1],
        ],
        name="fragment_teeth",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["fragment"],
    ),
    # Door for Level 1: simple key (player + one fragment)
    # Player (9) merges with fragment_top to form this shape
    "door_1": Sprite(
        pixels=[
            [4, 4, 4],  # Yellow top
            [-1, 9, -1],  # Blue player in middle
        ],
        name="door_1",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        tags=["door"],
        layer=-1,
    ),
    # Door for Level 2: medium key (player + two fragments)
    "door_2": Sprite(
        pixels=[
            [4, 4, 4],  # Yellow top
            [-1, 9, -1],  # Blue player
            [-1, 4, -1],  # Shaft
            [-1, 4, -1],
        ],
        name="door_2",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        tags=["door"],
        layer=-1,
    ),
    # Door for Level 3: full key (player + three fragments)
    "door_3": Sprite(
        pixels=[
            [4, 4, 4],  # Yellow top
            [-1, 9, -1],  # Blue player
            [-1, 4, -1],  # Shaft
            [-1, 4, -1],
            [4, 4, -1],  # Teeth
            [4, -1, -1],
        ],
        name="door_3",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        tags=["door"],
        layer=-1,
    ),
    # Maze for Level 1 (10x10) - simple introduction
    "maze_1": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 0
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],  # Row 1
            [5, -1, 5, 5, 5, 5, 5, 5, -1, 5],  # Row 2
            [5, -1, 5, -1, -1, -1, -1, 5, -1, 5],  # Row 3
            [5, -1, 5, -1, 5, 5, -1, 5, -1, 5],  # Row 4
            [5, -1, 5, -1, 5, -1, -1, 5, -1, 5],  # Row 5
            [5, -1, 5, -1, 5, -1, 5, 5, -1, 5],  # Row 6
            [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],  # Row 7
            [5, -1, 5, 5, 5, 5, 5, 5, -1, 5],  # Row 8
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 9
        ],
        name="maze_1",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        layer=-2,
    ),
    # Maze for Level 2 (12x12) - two fragments to collect
    "maze_2": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 0
            [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5],  # Row 1
            [5, -1, 5, 5, -1, 5, -1, 5, 5, 5, -1, 5],  # Row 2
            [5, -1, 5, -1, -1, -1, -1, -1, -1, 5, -1, 5],  # Row 3
            [5, -1, 5, -1, 5, 5, 5, 5, -1, 5, -1, 5],  # Row 4
            [5, -1, -1, -1, 5, -1, -1, 5, -1, 5, -1, 5],  # Row 5
            [5, 5, 5, -1, 5, -1, 5, 5, -1, 5, -1, 5],  # Row 6
            [5, -1, -1, -1, 5, -1, -1, -1, -1, 5, -1, 5],  # Row 7
            [5, -1, 5, 5, 5, 5, 5, 5, 5, 5, -1, 5],  # Row 8
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],  # Row 9
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, -1, 5],  # Row 10
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 11
        ],
        name="maze_2",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        layer=-2,
    ),
    # Maze for Level 3 (14x14) - three fragments, more complex
    "maze_3": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 0
            [5, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1, 5],  # Row 1
            [5, -1, 5, 5, 5, -1, 5, -1, 5, 5, 5, 5, -1, 5],  # Row 2
            [5, -1, 5, -1, -1, -1, 5, -1, -1, -1, -1, 5, -1, 5],  # Row 3
            [5, -1, 5, -1, 5, 5, 5, 5, 5, 5, -1, 5, -1, 5],  # Row 4
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, 5, -1, 5],  # Row 5
            [5, 5, 5, 5, 5, 5, 5, 5, -1, 5, -1, 5, -1, 5],  # Row 6
            [5, -1, -1, -1, -1, -1, -1, 5, -1, 5, -1, -1, -1, 5],  # Row 7
            [5, -1, 5, 5, 5, 5, -1, 5, -1, 5, 5, 5, -1, 5],  # Row 8
            [5, -1, -1, -1, -1, 5, -1, 5, -1, -1, -1, 5, -1, 5],  # Row 9
            [5, 5, 5, 5, -1, 5, -1, 5, 5, 5, -1, 5, -1, 5],  # Row 10
            [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5, -1, 5],  # Row 11
            [5, -1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, -1, 5],  # Row 12
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],  # Row 13
        ],
        name="maze_3",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        layer=-2,
    ),
}

# =============================================================================
# LEVELS
# =============================================================================

levels = [
    # Level 1: Tutorial - one fragment, simple path
    Level(
        sprites=[
            sprites["maze_1"].clone(),
            sprites["player"].clone().set_position(1, 1),
            sprites["fragment_top"].clone().set_position(4, 5),  # In the inner area
            sprites["door_1"].clone().set_position(6, 7),  # Near bottom right
        ],
        grid_size=(10, 10),
        name="level_1",
    ),
    # Level 2: Two fragments - need to collect both
    Level(
        sprites=[
            sprites["maze_2"].clone(),
            sprites["player"].clone().set_position(1, 1),
            sprites["fragment_top"].clone().set_position(5, 5),  # First fragment
            sprites["fragment_shaft"].clone().set_position(7, 7),  # Second fragment
            sprites["door_2"].clone().set_position(10, 9),  # Bottom right area
        ],
        grid_size=(12, 12),
        name="level_2",
    ),
    # Level 3: Three fragments - full key required
    Level(
        sprites=[
            sprites["maze_3"].clone(),
            sprites["player"].clone().set_position(1, 1),
            sprites["fragment_top"].clone().set_position(3, 3),  # First fragment
            sprites["fragment_shaft"].clone().set_position(6, 7),  # Second fragment
            sprites["fragment_teeth"].clone().set_position(10, 9),  # Third fragment
            sprites["door_3"].clone().set_position(12, 11),  # Bottom right
        ],
        grid_size=(14, 14),
        name="level_3",
    ),
]

# =============================================================================
# GAME CLASS
# =============================================================================

BACKGROUND_COLOR = 0  # Black
PADDING_COLOR = 3  # Cyan


class KeyForge(ARCBaseGame):
    """Navigate maze, collect key fragments, unlock the door.

    Combines maze navigation with sprite merging mechanics.
    Collect all key fragments to form a key that matches the door pattern.
    """

    _player: Sprite
    _door: Sprite

    def __init__(self) -> None:
        """Initialize the KeyForge game."""
        camera = Camera(background=BACKGROUND_COLOR, letter_box=PADDING_COLOR)
        super().__init__(game_id="key_forge", levels=levels, camera=camera)

    def on_set_level(self, level: Level) -> None:
        """Cache sprite references when level loads."""
        self._player = level.get_sprites_by_name("player")[0]
        self._door = level.get_sprites_by_tag("door")[0]

    def step(self) -> None:
        """Process one game step."""
        # Calculate movement direction
        dx, dy = 0, 0
        if self.action.id == GameAction.ACTION1:
            dy = -1  # Up
        elif self.action.id == GameAction.ACTION2:
            dy = 1  # Down
        elif self.action.id == GameAction.ACTION3:
            dx = -1  # Left
        elif self.action.id == GameAction.ACTION4:
            dx = 1  # Right

        # Try to move and get collisions
        collisions = self.try_move("player", dx, dy)

        # Handle fragment collection (merge)
        for sprite in collisions:
            if "fragment" in sprite.tags:
                self._collect_fragment(sprite, dx, dy)
                # Re-check collisions after merge since player position changed
                break

        # Check win condition: player matches door key AND touches door
        for sprite in collisions:
            if "door" in sprite.tags:
                if self._check_key_matches():
                    self._handle_door_reached()
                break

        self.complete_action()

    def _collect_fragment(self, fragment: Sprite, dx: int, dy: int) -> None:
        """Merge fragment into player."""
        old_player = self._player

        # Merge the fragment into the player
        self._player = old_player.merge(fragment)
        self._player.name = "player"  # Keep the name for try_move to work
        self._player.tags = ["player"]

        # Update level sprites
        self.current_level.remove_sprite(fragment)
        self.current_level.remove_sprite(old_player)
        self.current_level.add_sprite(self._player)

        # Continue movement after merge
        self._player.move(dx, dy)

    def _check_key_matches(self) -> bool:
        """Compare player shape to door's required key."""
        player_pixels = self.get_pixels_at_sprite(self._player)
        door_pixels = self.get_pixels_at_sprite(self._door)

        # Check if shapes match
        return bool(np.array_equal(player_pixels, door_pixels))

    def _handle_door_reached(self) -> None:
        """Player unlocked the door!"""
        if self.is_last_level():
            self.win()
        else:
            self.next_level()


# =============================================================================
# MAIN (for testing)
# =============================================================================

if __name__ == "__main__":
    from arcengine import ActionInput

    game = KeyForge()

    # Get initial frame
    result = game.perform_action(ActionInput(id=GameAction.RESET))
    print(f"Initial state: {result.state}")
    print(f"Level: 1/{result.win_levels}")

    # Test a few moves
    moves = [
        GameAction.ACTION4,  # Right
        GameAction.ACTION2,  # Down
        GameAction.ACTION2,  # Down
    ]

    for move in moves:
        result = game.perform_action(ActionInput(id=move))
        print(f"After move: state={result.state}, levels_completed={result.levels_completed}")
