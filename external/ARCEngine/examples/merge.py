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

# Create sprites dictionary with all sprite definitions
sprites = {
    "player": Sprite(
        pixels=[
            [9],
        ],
        name="player",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["merge"],
    ),
    "sprite-1": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, 5, 5, 5, 5, 5, 5, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        ],
        name="sprite-1",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
    ),
    "sprite-2": Sprite(
        pixels=[
            [14, 14],
            [14, 14],
        ],
        name="sprite-2",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["merge"],
    ),
    "sprite-3": Sprite(
        pixels=[
            [8, 8],
            [-1, 8],
        ],
        name="sprite-3",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["merge"],
    ),
    "sprite-4": Sprite(
        pixels=[
            [8, 8],
            [9, 8],
        ],
        name="sprite-4",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["target"],
    ),
    "sprite-5": Sprite(
        pixels=[
            [11],
            [11],
            [11],
        ],
        name="sprite-5",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["merge"],
    ),
    "sprite-6": Sprite(
        pixels=[
            [11, 8, 8],
            [11, 9, 8],
            [11, -1, -1],
        ],
        name="sprite-6",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["target"],
    ),
    "sprite-7": Sprite(
        pixels=[
            [-1, 8, 8, 11],
            [14, 14, 8, 11],
            [14, 14, 9, 11],
        ],
        name="sprite-7",
        blocking=BlockingMode.PIXEL_PERFECT,
        interaction=InteractionMode.TANGIBLE,
        tags=["target"],
    ),
}

# Create levels array with all level definitions
levels = [
    # Level 1
    Level(
        sprites=[
            sprites["player"].clone().set_position(3, 10),
            sprites["sprite-1"].clone(),
            sprites["sprite-3"].clone().set_position(4, 5),
            sprites["sprite-4"].clone().set_position(12, 2),
        ],
        grid_size=(16, 16),
    ),
    # Level 2
    Level(
        sprites=[
            sprites["player"].clone().set_position(3, 12),
            sprites["sprite-1"].clone(),
            sprites["sprite-3"].clone().set_position(7, 9),
            sprites["sprite-5"].clone().set_position(2, 3),
            sprites["sprite-6"].clone().set_position(11, 1),
        ],
        grid_size=(16, 16),
    ),
    # Level 3
    Level(
        sprites=[
            sprites["player"].clone().set_position(12, 9),
            sprites["sprite-1"].clone().set_rotation(180),
            sprites["sprite-2"].clone().set_position(12, 3),
            sprites["sprite-3"].clone().set_position(8, 5),
            sprites["sprite-5"].clone().set_position(4, 2),
            sprites["sprite-7"].clone().set_position(1, 11),
        ],
        grid_size=(16, 16),
    ),
]

BACKGROUND_COLOR = 1

PADDING_COLOR = 3


class Merge(ARCBaseGame):
    """A simple maze game where the player navigates and pushes objects."""

    _player: Sprite
    _target: Sprite

    def __init__(self) -> None:
        # Create camera with step counter UI
        camera = Camera(
            width=16,
            height=16,
            background=BACKGROUND_COLOR,
            letter_box=PADDING_COLOR,
        )

        # Initialize the base game
        super().__init__(game_id="merge", levels=levels, camera=camera)

    def on_set_level(self, level: Level) -> None:
        """Called when the level is set, use this to set level specific data."""
        self._player = level.get_sprites_by_name("player")[0]
        self._target = level.get_sprites_by_tag("target")[0]

    def step(self) -> None:
        """Step the game forward based on the current action."""
        # Handle movement based on action ID
        dx = 0
        dy = 0
        moved = False

        if self.action.id == GameAction.ACTION1:  # Move Up
            dy = -1
            moved = True
        elif self.action.id == GameAction.ACTION2:  # Move Down
            dy = 1
            moved = True
        elif self.action.id == GameAction.ACTION3:  # Move Left
            dx = -1
            moved = True
        elif self.action.id == GameAction.ACTION4:  # Move Right
            dx = 1
            moved = True

        # Try to move player and handle pushing
        if moved and (dx != 0 or dy != 0):
            others = self.try_move("player", dx, dy)
            for collide in others:
                if "merge" in collide.tags:
                    old_player = self._player
                    self._player = self._player.merge(collide)
                    self.current_level.remove_sprite(collide)
                    self.current_level.remove_sprite(old_player)
                    self.current_level.add_sprite(self._player)
                    self._player.move(dx, dy)

        # Check win condition
        if self.check_win_condition():
            self.next_level()
        else:
            merge = self.current_level.get_sprites_by_tag("merge")
            if len(merge) <= 1:
                self.lose()

        self.complete_action()

    def check_win_condition(self) -> bool:
        source = self.get_pixels_at_sprite(self._player)
        target = self.get_pixels_at_sprite(self._target)
        if np.array_equal(source, target):
            return True
        return False
