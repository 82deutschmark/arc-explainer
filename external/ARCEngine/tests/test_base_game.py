"""Tests for the base game module."""

import os
import unittest
from unittest.mock import patch

import numpy as np

from arcengine import (
    ActionInput,
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    GameState,
    Level,
    PlaceableArea,
    Sprite,
)


class TestGame(ARCBaseGame):
    """Test implementation of TestGame."""

    def __init__(self, game_id: str, levels: list[Level], camera: Camera | None = None, available_actions: list[int] = [1, 2, 3, 4, 5, 6]) -> None:
        super().__init__(game_id=game_id, levels=levels, camera=camera, available_actions=available_actions)
        self._step_count = 0
        self._level_index = -1

    def step(self) -> None:
        """Step the game, completing after 3 steps."""
        if self.action.id == GameAction.ACTION5:
            print("test game - next level")
            self.next_level()
            self.complete_action()
        elif self.action.id == GameAction.ACTION7:
            self.lose()
            self.complete_action()
        else:
            self._step_count += 1
            if self._step_count >= 3:
                self.complete_action()

    def on_set_level(self, level: Level) -> None:
        self._level_index = self._current_level_index

    def _is_sprite_clickable_now(self, sprite: Sprite) -> bool:
        """Check if a sprite is clickable now."""
        return sprite.name != "ignore_me"


class TestGameWithTooManyFrames(ARCBaseGame):
    """Test implementation of TestGameWithTooManyFrames."""

    def __init__(self, game_id: str, levels: list[Level], camera: Camera | None = None, available_actions: list[int] = [1, 2, 3, 4, 5, 6]) -> None:
        super().__init__(game_id=game_id, levels=levels, camera=camera, available_actions=available_actions)
        self._step_count = 0
        self._level_index = -1

    def step(self) -> None:
        """Step the game, completing after 3 steps."""
        if self._action_count == 0:
            self.complete_action()
        elif self.action.id == GameAction.ACTION7:
            self.lose()
            self.complete_action()

    def on_set_level(self, level: Level) -> None:
        self._level_index = self._current_level_index

    def _is_sprite_clickable_now(self, sprite: Sprite) -> bool:
        """Check if a sprite is clickable now."""
        return sprite.name != "ignore_me"


class TestGameWithWinScore(ARCBaseGame):
    """Test implementation of TestGame."""

    def __init__(self, game_id: str, levels: list[Level], camera: Camera | None = None, win_score: int = 1) -> None:
        super().__init__(game_id=game_id, levels=levels, camera=camera, win_score=win_score)
        self._step_count = 0
        self._level_index = -1

    def step(self) -> None:
        """Step the game, completing after 3 steps."""
        if self.action.id == GameAction.ACTION5:
            print("test game - next level")
            self.next_level()
            self.complete_action()
        else:
            self._step_count += 1
            if self._step_count >= 3:
                self.complete_action()

    def on_set_level(self, level: Level) -> None:
        self._level_index = self._current_level_index


class TestARCBaseGame(unittest.TestCase):
    """Test cases for the TestGame class."""

    def test_initialization(self):
        """Test basic game initialization."""
        # Create test levels
        level1 = Level([Sprite([[1]], name="player")])
        level2 = Level([Sprite([[2]], name="enemy")])

        # Test with default camera
        game = TestGame("test_game", [level1, level2])
        self.assertEqual(len(game._levels), 2)
        self.assertEqual(game._current_level_index, 0)
        self.assertEqual(game.camera.width, 64)  # Default camera size
        self.assertEqual(game.camera.height, 64)

        # Test with custom camera
        camera = Camera(width=32, height=32)
        game = TestGame("test_game", [level1, level2], camera=camera)
        self.assertEqual(game.camera.width, 32)
        self.assertEqual(game.camera.height, 32)

        # Test empty levels list
        with self.assertRaises(ValueError) as ctx:
            TestGame("test_game", [])
        self.assertIn("must have at least one level", str(ctx.exception))

    def test_camera_resizes_to_level_size(self):
        """Test basic game initialization."""
        # Create test levels
        level1 = Level([Sprite([[1]], name="player")], grid_size=(8, 8))
        level2 = Level([Sprite([[2]], name="enemy")], grid_size=(12, 12))

        # Test with custom camera
        camera = Camera(width=32, height=32)
        game = TestGame("test_game", [level1, level2], camera=camera)
        self.assertEqual(game.camera.width, 8)
        self.assertEqual(game.camera.height, 8)

        game.set_level(1)
        self.assertEqual(game.camera.width, 12)
        self.assertEqual(game.camera.height, 12)

    def test_level_management(self):
        """Test level management functionality."""
        # Create test levels
        level1 = Level([Sprite([[1]], name="player")])
        level2 = Level([Sprite([[2]], name="enemy")])
        game = TestGame("test_game", [level1, level2])

        # Test current level
        self.assertEqual(game.current_level, game._levels[0])

        # Test level switching
        game.set_level(1)
        self.assertEqual(game.current_level, game._levels[1])

        # Test invalid level index
        with self.assertRaises(IndexError) as ctx:
            game.set_level(2)
        self.assertIn("out of range", str(ctx.exception))

        with self.assertRaises(IndexError) as ctx:
            game.set_level(-1)
        self.assertIn("out of range", str(ctx.exception))

    def test_level_cloning(self):
        """Test that levels are properly cloned."""
        # Create a level with a sprite
        sprite = Sprite([[1]], name="player")
        level = Level([sprite])
        game = TestGame("test_game", [level])

        # Verify the level was cloned
        self.assertIsNot(game._levels[0], level)

        # Verify sprites were cloned
        original_sprites = level.get_sprites()
        game_sprites = game._levels[0].get_sprites()
        self.assertEqual(len(original_sprites), len(game_sprites))
        self.assertIsNot(original_sprites[0], game_sprites[0])

        # Verify modifications to original don't affect game
        sprite.set_position(10, 10)
        self.assertEqual(game_sprites[0].x, 0)  # Should still be at original position

    def test_try_move(self):
        """Test the try_move method."""
        # Create a level with multiple sprites
        player = Sprite([[1]], name="player", x=0, y=0, blocking=BlockingMode.BOUNDING_BOX)
        wall1 = Sprite([[2]], name="wall1", x=2, y=0, blocking=BlockingMode.BOUNDING_BOX)
        wall2 = Sprite([[2]], name="wall2", x=0, y=1, blocking=BlockingMode.BOUNDING_BOX)
        level = Level([player, wall1, wall2])
        game = TestGame("test_game", [level])

        player = game.current_level.get_sprites_by_name("player")[0]

        # Test successful move
        collisions = game.try_move("player", 1, 0)
        self.assertEqual(collisions, [])
        self.assertEqual(player.x, 1)
        self.assertEqual(player.y, 0)

        # Test collision with wall1
        collisions = game.try_move("player", 1, 0)
        self.assertEqual(collisions[0].name, "wall1")
        self.assertEqual(player.x, 1)  # Position should not change
        self.assertEqual(player.y, 0)

        # Test collision with wall2
        player.set_position(0, 0)  # Reset position
        collisions = game.try_move("player", 0, 1)
        self.assertEqual(collisions[0].name, "wall2")
        self.assertEqual(player.x, 0)  # Position should not change
        self.assertEqual(player.y, 0)

        # Test non-existent sprite
        with self.assertRaises(ValueError) as ctx:
            game.try_move("nonexistent", 1, 0)
        self.assertIn("No sprite found with name", str(ctx.exception))

    def test_camera_properties(self):
        """Test camera property getters and setters."""
        game = TestGame("test_game", [Level()])

        # Test initial values
        self.assertEqual(game.camera.x, 0)
        self.assertEqual(game.camera.y, 0)
        self.assertEqual(game.camera.width, 64)
        self.assertEqual(game.camera.height, 64)

        # Test setters
        game.camera.x = 10
        game.camera.y = 20
        game.camera.width = 32
        game.camera.height = 32

        self.assertEqual(game.camera.x, 10)
        self.assertEqual(game.camera.y, 20)
        self.assertEqual(game.camera.width, 32)
        self.assertEqual(game.camera.height, 32)

    def test_perform_action(self):
        """Test performing an action and collecting frames."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level = Level([sprite])

        # Create a test game
        game = TestGame("test_game", [level])

        # Create an action input
        action_input = ActionInput(id=GameAction.ACTION1)

        # Perform the action
        frame_data = game.perform_action(action_input)

        # Verify the frame data
        self.assertEqual(frame_data.game_id, "test_game")
        self.assertEqual(frame_data.state, GameState.NOT_FINISHED)
        self.assertEqual(frame_data.levels_completed, 0)
        self.assertEqual(frame_data.action_input, action_input)

        # Verify we got 3 frames (one for each step)
        self.assertEqual(len(frame_data.frame), 3)

        # Verify each frame is a 64x64 array
        for frame in frame_data.frame:
            self.assertEqual(len(frame), 64)
            self.assertEqual(len(frame[0]), 64)

        # Verify the sprite is visible in the first frame
        first_frame = np.array(frame_data.frame[0])
        self.assertEqual(first_frame[0, 0], 1)
        self.assertEqual(first_frame[0, 1], 1)
        self.assertEqual(first_frame[1, 0], 1)
        self.assertEqual(first_frame[1, 1], 1)

    def test_multiple_levels(self):
        """Test performing actions with multiple levels."""
        # Create two levels with different sprites
        sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
        sprite2 = Sprite([[2, 2], [2, 2]], x=0, y=0)
        level1 = Level([sprite1])
        level2 = Level([sprite2])

        # Create a test game with both levels
        game = TestGame("test_game", [level1, level2])

        # Perform action on first level
        action_input = ActionInput(id=GameAction.ACTION1)
        frame_data1 = game.perform_action(action_input)

        # Switch to second level
        game.set_level(1)

        # Perform action on second level
        frame_data2 = game.perform_action(action_input)

        # Verify frames show different sprites
        first_frame1 = np.array(frame_data1.frame[0])
        first_frame2 = np.array(frame_data2.frame[0])

        self.assertEqual(first_frame1[0, 0], 1)  # First level shows sprite1
        self.assertEqual(first_frame2[0, 0], 2)  # Second level shows sprite2

    def test_full_reset_gives_fresh_game(self):
        """Test performing actions with multiple levels."""
        # Create two levels with different sprites
        sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite1])

        # Create a test game with both levels
        game = TestGame("test_game", [level1])

        # Simulate some game logic
        game_sprite_1 = game.current_level._sprites[0]
        game_sprite_1.set_position(1, 1)
        game._score = 100

        self.assertEqual(game_sprite_1.x, 1)
        self.assertEqual(game_sprite_1.y, 1)
        self.assertEqual(game._score, 100)

        game.full_reset()

        game_sprite_2 = game.current_level._sprites[0]
        self.assertNotEqual(game_sprite_2, game_sprite_1)
        self.assertEqual(game_sprite_2.x, 0)
        self.assertEqual(game._score, 0)

    def test_level_reset_only_resets_current_level(self):
        """Test performing actions with multiple levels."""
        # Create two levels with different sprites
        sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite1])
        level2 = Level([sprite1.clone().set_position(1, 1)])

        # Create a test game with both levels
        game = TestGame("test_game", [level1, level2])

        # Simulate some game logic
        game_sprite_1 = game.current_level._sprites[0]
        game_sprite_1.set_position(10, 10)
        game._score = 100

        self.assertEqual(game_sprite_1.x, 10)
        self.assertEqual(game_sprite_1.y, 10)
        self.assertEqual(game._score, 100)

        game.next_level()
        game._really_set_next_level()

        game_sprite_2 = game.current_level._sprites[0]

        self.assertNotEqual(game_sprite_2, game_sprite_1)
        self.assertEqual(game_sprite_2.x, 1)
        self.assertEqual(game_sprite_2.y, 1)
        self.assertEqual(game._score, 101)

        # Simulate some game logic
        game_sprite_2 = game.current_level._sprites[0]
        game_sprite_2.set_position(9, 9)

        self.assertEqual(game._score, 101)
        self.assertNotEqual(game_sprite_2, game_sprite_1)
        self.assertEqual(game_sprite_2.x, 9)
        self.assertEqual(game_sprite_2.y, 9)

    def test_reset_action_count(self):
        """Test that the reset action count is properly set."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite])
        level2 = Level([sprite.clone().set_position(1, 1)])

        # Create a test game
        game = TestGame("test_game", [level1, level2])

        game.next_level()
        game._really_set_next_level()

        # Perform an action and simulate a step
        game.perform_action(ActionInput(id=GameAction.ACTION1))
        game_sprite_1 = game.current_level._sprites[0]
        game_sprite_1.move(2, 2)

        game_sprite_1 = game.current_level._sprites[0]
        self.assertEqual(game_sprite_1.x, 3)
        self.assertEqual(game_sprite_1.y, 3)
        self.assertEqual(game._action_count, 1)

        game.perform_action(ActionInput(id=GameAction.RESET))

        game_sprite_2 = game.current_level._sprites[0]
        self.assertEqual(game._action_count, 0)
        self.assertEqual(game._current_level_index, 1)
        self.assertEqual(game_sprite_2.x, 1)
        self.assertEqual(game_sprite_2.y, 1)
        self.assertNotAlmostEqual(game_sprite_1.x, game_sprite_2.x)

        # another reset with no action should do a full reset
        game.perform_action(ActionInput(id=GameAction.RESET))

        game_sprite_3 = game.current_level._sprites[0]
        self.assertEqual(game._action_count, 0)
        self.assertEqual(game._current_level_index, 0)
        self.assertEqual(game_sprite_3.x, 0)
        self.assertEqual(game_sprite_3.y, 0)
        self.assertNotAlmostEqual(game_sprite_1.x, game_sprite_3.x)
        self.assertNotAlmostEqual(game_sprite_2.x, game_sprite_3.x)

    def test_set_level_by_name(self):
        """Test setting the current level by name."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite], name="level1")
        level2 = Level([sprite.clone().set_position(1, 1)], name="level2")
        game = TestGame("test_game", [level1, level2])

        game.set_level_by_name("level1")
        self.assertEqual(game.current_level.name, level1.name)
        # check that the on_level_set is called and the level index is set correctly
        self.assertEqual(game._level_index, 0)

        game.set_level_by_name("level2")
        self.assertEqual(game.current_level.name, level2.name)
        # check that the on_level_set is called and the level index is set correctly
        self.assertEqual(game._level_index, 1)

        with self.assertRaises(ValueError) as ctx:
            game.set_level_by_name("nonexistent")
        self.assertIn("not found", str(ctx.exception))

    def test_get_pixels_at_sprite(self):
        """Test getting pixels at a sprite's position."""
        # Create a test sprite
        sprite = Sprite(name="sprite", pixels=[[1, 2], [3, 4]], x=5, y=5)

        # Add sprite to level
        level = Level([sprite])

        # Create a game with a 16x16 camera
        game = TestGame("test_game", [level])
        game.camera.resize(16, 16)

        # Test getting pixels at sprite position
        pixels = game.get_pixels_at_sprite(sprite)
        self.assertEqual(pixels.tolist(), [[1, 2], [3, 4]])

        # Test with camera offset
        game.camera.move(2, 2)
        pixels = game.get_pixels_at_sprite(sprite)
        self.assertEqual(pixels.tolist(), [[1, 2], [3, 4]])

        # Test with sprite partially off screen
        game_sprite = game.current_level.get_sprites_by_name("sprite")[0]
        game_sprite.set_position(15, 15)
        pixels = game.get_pixels_at_sprite(game_sprite)
        self.assertEqual(pixels.tolist(), [[1, 2], [3, 4]])

    def test_get_pixels(self):
        """Test getting pixels at specific coordinates."""
        # Create test sprites
        sprite1 = Sprite(pixels=[[1, 2], [3, 4]], x=5, y=5)
        sprite2 = Sprite(pixels=[[6, 7], [8, 9]], x=7, y=7)

        # Add sprites to level
        level = Level([sprite1, sprite2])

        # Create a game with a 16x16 camera
        game = TestGame("test_game", [level])
        game.camera.resize(16, 16)

        # Test getting pixels at specific coordinates
        pixels = game.get_pixels(5, 5, 2, 2)
        self.assertEqual(pixels.tolist(), [[1, 2], [3, 4]])

        # Test getting pixels at overlapping area
        pixels = game.get_pixels(6, 6, 2, 2)
        self.assertEqual(pixels.tolist(), [[4, 5], [5, 6]])

        # Test with camera offset
        game.camera.move(2, 2)
        pixels = game.get_pixels(3, 3, 2, 2)
        self.assertEqual(pixels.tolist(), [[1, 2], [3, 4]])

        # Test getting pixels outside sprite area
        pixels = game.get_pixels(0, 0, 2, 2)
        self.assertEqual(pixels.tolist(), [[5, 5], [5, 5]])

        # Test getting pixels partially outside sprite area
        pixels = game.get_pixels(4, 4, 2, 2)
        self.assertEqual(pixels.tolist(), [[4, 5], [5, 6]])

    def test_level_win_renders_two_frames(self):
        sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
        sprite2 = Sprite([[2, 2], [2, 2]], x=0, y=0)
        level1 = Level([sprite1])
        level2 = Level([sprite2])

        # Create a test game with both levels
        game = TestGame("test_game", [level1, level2])

        # Perform action on first level
        action_input = ActionInput(id=GameAction.ACTION5)
        frame_data1 = game.perform_action(action_input)

        self.assertEqual(game._current_level_index, 1)
        self.assertEqual(len(frame_data1.frame), 2)

    def test_full_reset(self):
        """Test that the full reset is properly set."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite])
        game = TestGame("test_game", [level1])

        action_input = ActionInput(id=GameAction.RESET)
        frame_data1 = game.perform_action(action_input)

        self.assertTrue(frame_data1.full_reset, "Full reset should be True on new game Reset")

        action_input = ActionInput(id=GameAction.ACTION1)
        frame_data1 = game.perform_action(action_input)
        action_input = ActionInput(id=GameAction.RESET)
        frame_data2 = game.perform_action(action_input)

        self.assertFalse(frame_data2.full_reset, "Full reset should be False on level reset as an action has been taken")

    def test_full_reset_after_50_level_resets_does_not_reset_game(self):
        """Test that the full reset is properly set."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite])
        level2 = Level([sprite])
        game = TestGame("test_game", [level1, level2])

        game.set_level(1)

        for i in range(50):
            action_input = ActionInput(id=GameAction.ACTION1)
            game.perform_action(action_input)
            action_input = ActionInput(id=GameAction.RESET)
            frame_data2 = game.perform_action(action_input)
            self.assertFalse(frame_data2.full_reset, "Full reset should be False on level reset as an action has been taken")
            self.assertEqual(game._current_level_index, 1)

        action_input = ActionInput(id=GameAction.ACTION1)
        game.perform_action(action_input)
        action_input = ActionInput(id=GameAction.RESET)
        frame_data2 = game.perform_action(action_input)
        self.assertFalse(frame_data2.full_reset, "Full reset should be False on level reset as an action has been taken")
        self.assertEqual(game._current_level_index, 1)

    def test_win_score(self):
        """Test that the max score is properly set."""

        # Test not providing a max score does not break existing games
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite])
        game1 = TestGame("test_game", [level1])
        action_input = ActionInput(id=GameAction.ACTION1)
        frame1 = game1.perform_action(action_input)

        self.assertEqual(game1.win_score, 1)
        self.assertEqual(frame1.win_levels, 1)

        # Test providing a max score
        game2 = TestGameWithWinScore("test_game", [level1], win_score=10)
        action_input = ActionInput(id=GameAction.ACTION1)
        frame2 = game2.perform_action(action_input)

        self.assertEqual(game2.win_score, 10)
        self.assertEqual(frame2.win_levels, 10)

    def test_available_actions(self):
        """Test that the available actions are properly set."""
        # Create a test level with a sprite
        sprite = Sprite([[1, 1], [1, 1]], x=0, y=0)
        level1 = Level([sprite])
        game1 = TestGame("test_game", [level1])
        action_input = ActionInput(id=GameAction.ACTION1)
        frame1 = game1.perform_action(action_input)
        self.assertEqual(frame1.available_actions, [1, 2, 3, 4, 5, 6])

        game2 = TestGame("test_game", [level1], available_actions=[1, 2, 3, 4])
        frame2 = game2.perform_action(action_input)
        self.assertEqual(frame2.available_actions, [1, 2, 3, 4])

        game3 = TestGame("test_game", [level1], available_actions=[6])
        frame3 = game3.perform_action(action_input)
        self.assertEqual(frame3.available_actions, [6])

    def test_lose_game_and_then_reset(self):
        """Test that if the game is lost on the first move then reset does not result in a full reset"""
        # Create a test level with a sprite
        sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
        sprite2 = Sprite([[1, 1], [1, 1]], x=2, y=2)
        level1 = Level([sprite1])
        level2 = Level([sprite2])
        game = TestGame("test_game", [level1, level2])

        # Start Game with Reset
        action_input = ActionInput(id=GameAction.RESET)
        game.perform_action(action_input)
        self.assertEqual(game.level_index, 0)

        # Perform Action 5 to get to the next level
        action_input = ActionInput(id=GameAction.ACTION5)
        frame1 = game.perform_action(action_input)
        self.assertEqual(frame1.levels_completed, 1)
        self.assertEqual(frame1.win_levels, 2)
        self.assertEqual(game.level_index, 1)

        # Perform Action 7 which results in a game over
        action_input = ActionInput(id=GameAction.ACTION7)
        frame2 = game.perform_action(action_input)
        self.assertEqual(frame2.state, GameState.GAME_OVER)

        # Perform a Reset which should not be a full reset
        action_input = ActionInput(id=GameAction.RESET)
        frame3 = game.perform_action(action_input)
        self.assertFalse(frame3.full_reset)
        self.assertEqual(frame3.levels_completed, 1)
        self.assertEqual(game.level_index, 1)

        # Perform a second Reset which should be a full reset
        action_input = ActionInput(id=GameAction.RESET)
        frame3 = game.perform_action(action_input)
        self.assertTrue(frame3.full_reset)
        self.assertEqual(frame3.levels_completed, 0)
        self.assertEqual(game.level_index, 0)

    def test_env_flag_only_allows_level_resets(self):
        """if ONLY_RESET_LEVELS is true, then the game should only allow level resets"""
        with patch.dict(os.environ, {"ONLY_RESET_LEVELS": "true"}, clear=False):
            # Create a test level with a sprite
            sprite1 = Sprite([[1, 1], [1, 1]], x=0, y=0)
            sprite2 = Sprite([[1, 1], [1, 1]], x=2, y=2)
            level1 = Level([sprite1])
            level2 = Level([sprite2])

            game = TestGame("test_game", [level1, level2])
            # Start Game with Reset
            action_input = ActionInput(id=GameAction.RESET)
            game.perform_action(action_input)
            self.assertEqual(game.level_index, 0)

            # Perform Action 5 to get to the next level
            action_input = ActionInput(id=GameAction.ACTION5)
            frame1 = game.perform_action(action_input)
            self.assertEqual(frame1.levels_completed, 1)
            self.assertEqual(game.level_index, 1)

            # Perform Reset 1 which should not be a full reset
            action_input = ActionInput(id=GameAction.RESET)
            frame3 = game.perform_action(action_input)
            self.assertFalse(frame3.full_reset)
            self.assertEqual(frame3.levels_completed, 1)
            self.assertEqual(game.level_index, 1)

            # Perform Reset 2 which should not be a full reset
            action_input = ActionInput(id=GameAction.RESET)
            frame4 = game.perform_action(action_input)
            self.assertFalse(frame4.full_reset)
            self.assertEqual(frame4.levels_completed, 1)
            self.assertEqual(game.level_index, 1)

            # Perform Reset 3 which should not be a full reset
            action_input = ActionInput(id=GameAction.RESET)
            frame5 = game.perform_action(action_input)
            self.assertFalse(frame5.full_reset)
            self.assertEqual(frame5.levels_completed, 1)
            self.assertEqual(game.level_index, 1)

    def test_get_valid_actions(self):
        """Test the _get_valid_actions method returns correct actions based on available_actions."""
        # Create test levels
        level1 = Level([Sprite([[1]], name="player")])
        level2 = Level([Sprite([[2]], name="enemy")])

        # Test with default available actions [1, 2, 3, 4, 5, 6]
        game = TestGame("test_game", [level1, level2])
        valid_actions = game._get_valid_actions()

        # Should return correct GameAction for each action ID (1, 2, 3, 4, 5)
        # Plus clickable actions for action 6
        expected_actions = [ActionInput(id=GameAction.ACTION1.value), ActionInput(id=GameAction.ACTION2.value), ActionInput(id=GameAction.ACTION3.value), ActionInput(id=GameAction.ACTION4.value), ActionInput(id=GameAction.ACTION5.value)]

        # For default available actions [1, 2, 3, 4, 5, 6], we should have:
        # - 5 basic actions (1-5)
        # - Plus any clickable actions from action 6
        clickable_actions = game._get_valid_clickable_actions()
        expected_total = 5 + len(clickable_actions)

        self.assertEqual(len(valid_actions), expected_total)

        # Check that the first 5 actions are correct basic actions
        for i in range(5):
            self.assertEqual(valid_actions[i].id, expected_actions[i].id)

        # Check that any remaining actions are ACTION6 (clickable actions)
        for i in range(5, len(valid_actions)):
            self.assertEqual(valid_actions[i].id, GameAction.ACTION6.value)
            self.assertIn("x", valid_actions[i].data)
            self.assertIn("y", valid_actions[i].data)

        # Test with custom available actions
        custom_actions = [1, 3, 5]
        game = TestGame("test_game", [level1, level2], available_actions=custom_actions)
        valid_actions = game._get_valid_actions()

        # Should return correct GameAction for each action ID
        expected_actions = [ActionInput(id=GameAction.ACTION1.value), ActionInput(id=GameAction.ACTION3.value), ActionInput(id=GameAction.ACTION5.value)]
        self.assertEqual(len(valid_actions), 3)
        self.assertEqual(valid_actions, expected_actions)

        # Test with empty available actions
        empty_actions = []
        game = TestGame("test_game", [level1, level2], available_actions=empty_actions)
        valid_actions = game._get_valid_actions()

        # Should return empty list
        self.assertEqual(len(valid_actions), 0)
        self.assertEqual(valid_actions, [])

        # Test with actions that don't match the pattern (should be ignored)
        mixed_actions = [1, 7, 3, 8, 5]
        game = TestGame("test_game", [level1, level2], available_actions=mixed_actions)
        valid_actions = game._get_valid_actions()

        # Should only return actions for 1, 3, 5 (actions 7, 8 don't match)
        expected_actions = [ActionInput(id=GameAction.ACTION1.value), ActionInput(id=GameAction.ACTION3.value), ActionInput(id=GameAction.ACTION5.value)]
        self.assertEqual(len(valid_actions), 3)
        self.assertEqual(valid_actions, expected_actions)

        # Test that the method doesn't modify the original _available_actions
        original_actions = [1, 2, 3, 4, 5]
        game = TestGame("test_game", [level1, level2], available_actions=original_actions)
        game._get_valid_actions()

        # _available_actions should remain unchanged
        self.assertEqual(game._available_actions, original_actions)

    def test_clickable_actions(self):
        """Test the clickable actions functionality."""

        # Create test level with clickable sprites
        level = Level(
            [
                # Single button sprite
                Sprite([[1, 1], [1, 1]], name="button1", x=10, y=10, tags=["sys_click"]),
                # Multi-pixel clickable sprite
                Sprite([[2, 0], [0, 2]], name="button2", x=20, y=20, tags=["sys_click", "sys_every_pixel"]),
                # Non-clickable sprite
                Sprite([[3, 3], [3, 3]], name="non_clickable", x=30, y=30, tags=["other_tag"]),
            ]
        )

        # Create game
        game = TestGame("test_clickable", [level], available_actions=[6])

        # Test clickable actions
        valid_actions = game._get_valid_clickable_actions()

        # Test _get_valid_actions with case 6
        all_actions = game._get_valid_actions()
        self.assertEqual(len(all_actions), len(valid_actions))

    def test_get_valid_clickable_actions(self):
        """Test the _get_valid_clickable_actions method returns correct clickable actions."""
        # Create test levels with clickable sprites
        level1 = Level(
            [
                # Sprite with sys_click tag but no sys_every_pixel (acts as single button)
                Sprite([[1, 1], [1, 1]], name="button1", x=10, y=10, tags=["sys_click"]),
                # Sprite with both sys_click and sys_every_pixel tags (every pixel is clickable)
                Sprite([[2, -1], [-1, 2]], name="button2", x=20, y=20, tags=["sys_click", "sys_every_pixel"]),
                # Sprite with no sys_click tag (should be ignored)
                Sprite([[3, 3], [3, 3]], name="non_clickable", x=30, y=30, tags=["other_tag"]),
                # Sprite with sys_click tag but all transparent pixels (should be ignored)
                Sprite([[-1, -1], [-1, -1]], name="transparent_button", x=40, y=40, tags=["sys_click"]),
            ]
        )

        game = TestGame("test_game", [level1], available_actions=[6])

        # Test clickable actions
        valid_actions = game._get_valid_clickable_actions()

        # Should have actions for:
        # 1. button1: 1 action (single button behavior)
        # 2. button2: 2 actions (every non-negative pixel)
        # 3. transparent_button: 0 actions (all pixels are -1)
        # 4. non_clickable: 0 actions (no sys_click tag)
        expected_count = 1 + 2 + 0 + 0
        self.assertEqual(len(valid_actions), expected_count)

        # Verify button1 action (single button)
        # Note: coordinates are transformed by camera scale and offset
        button1_actions = [a for a in valid_actions if a.data.get("x") == 10 and a.data.get("y") == 10]
        self.assertEqual(len(button1_actions), 1)
        self.assertEqual(button1_actions[0].id, GameAction.ACTION6)

        # Verify button2 actions (every pixel)
        # Note: coordinates are transformed by camera scale and offset
        button2_actions = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 20]
        self.assertEqual(len(button2_actions), 1)  # First non-negative pixel at (0,0) -> screen (20,20)

        button2_actions_2 = [a for a in valid_actions if a.data.get("x") == 21 and a.data.get("y") == 21]
        self.assertEqual(len(button2_actions_2), 1)  # Second non-negative pixel at (1,1) -> screen (21,21)

        # Verify all actions have correct structure
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)
            self.assertIsInstance(action.data["x"], int)
            self.assertIsInstance(action.data["y"], int)

        # Test with empty level
        empty_level = Level([])
        game_empty = TestGame("test_game", [empty_level])
        empty_actions = game_empty._get_valid_clickable_actions()
        self.assertEqual(len(empty_actions), 0)

        # Test with sprites that have no tags
        no_tags_level = Level([Sprite([[1, 1], [1, 1]], name="no_tags", x=50, y=50)])
        game_no_tags = TestGame("test_game", [no_tags_level])
        no_tags_actions = game_no_tags._get_valid_clickable_actions()
        self.assertEqual(len(no_tags_actions), 0)

        # Test with sprite that has sys_click but only transparent pixels
        transparent_level = Level([Sprite([[-1, -1], [-1, -1]], name="all_transparent", x=60, y=60, tags=["sys_click"])])
        game_transparent = TestGame("test_game", [transparent_level])
        transparent_actions = game_transparent._get_valid_clickable_actions()
        self.assertEqual(len(transparent_actions), 0)

    def test_action_6_integration(self):
        """Test that action 6 is properly integrated in _get_valid_actions."""
        # Create test level with clickable sprites
        level = Level(
            [
                # Single button sprite
                Sprite([[1, 1], [1, 1]], name="button1", x=10, y=10, tags=["sys_click"]),
                # Multi-pixel clickable sprite
                Sprite([[2, 0], [0, 2]], name="button2", x=20, y=20, tags=["sys_click", "sys_every_pixel"]),
            ]
        )

        # Test with only action 6 available
        game = TestGame("test_game", [level], available_actions=[6])
        valid_actions = game._get_valid_actions()

        # Should only have clickable actions (ACTION6)
        self.assertGreater(len(valid_actions), 0)
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)

        # Test with actions 1, 2, 3, 4, 5, 6
        game = TestGame("test_game", [level], available_actions=[1, 2, 3, 4, 5, 6])
        valid_actions = game._get_valid_actions()

        # Should have 5 basic actions + clickable actions
        basic_actions = [a for a in valid_actions if a.id != GameAction.ACTION6]
        clickable_actions = [a for a in valid_actions if a.id == GameAction.ACTION6]

        self.assertEqual(len(basic_actions), 5)
        self.assertGreater(len(clickable_actions), 0)

        # Verify basic actions are correct
        expected_basic_ids = [GameAction.ACTION1.value, GameAction.ACTION2.value, GameAction.ACTION3.value, GameAction.ACTION4.value, GameAction.ACTION5.value]
        actual_basic_ids = [a.id.value for a in basic_actions]
        self.assertEqual(sorted(actual_basic_ids), sorted(expected_basic_ids))

        # Verify clickable actions have proper structure
        for action in clickable_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)
            self.assertIsInstance(action.data["x"], (int, float))
            self.assertIsInstance(action.data["y"], (int, float))

        # Test with no clickable sprites
        empty_level = Level([])
        game_empty = TestGame("test_game", [empty_level], available_actions=[1, 2, 3, 4, 5, 6])
        valid_actions = game_empty._get_valid_actions()

        # Should have 5 basic actions + 0 clickable actions
        basic_actions = [a for a in valid_actions if a.id != GameAction.ACTION6]
        clickable_actions = [a for a in valid_actions if a.id == GameAction.ACTION6]

        self.assertEqual(len(basic_actions), 5)
        self.assertEqual(len(clickable_actions), 0)

    def test_clickable_actions_camera_transformations(self):
        """Test that clickable actions properly apply camera scale and offset transformations."""
        # Create a custom camera with specific scale and offset
        from arcengine import Camera

        custom_camera = Camera(width=32, height=32)  # This will create scale=2 and offsets for centering

        # Create test level with clickable sprites
        level = Level(
            [
                # Single button sprite at (5, 5) - should be transformed by camera
                Sprite([[1]], name="button1", x=5, y=5, tags=["sys_click"]),
                # Multi-pixel sprite at (10, 10) with sys_every_pixel - should generate multiple actions
                Sprite([[2, -1], [-1, 2]], name="button2", x=10, y=10, tags=["sys_click", "sys_every_pixel"]),
                # This sprite should be ignored even with the "sys_click" tag
                # This is because of the _is_sprite_clickable_now override in TestGame
                Sprite([[1]], name="ignore_me", x=5, y=5, tags=["sys_click"]),
            ]
        )

        # Create game with custom camera
        game = TestGame("test_camera_game", [level], camera=custom_camera, available_actions=[6])

        # Get clickable actions
        valid_actions = game._get_valid_clickable_actions()

        # Should have actions for both sprites:
        # - button1: 1 action (single button)
        # - button2: 2 actions (2 non-negative pixels)
        expected_action_count = 1 + 2
        self.assertEqual(len(valid_actions), expected_action_count)

        # Verify all actions are ACTION6
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)

        # Test button1: single pixel at (5, 5)
        # Expected screen coordinates: (5 * 2 + 0, 5 * 2 + 0) = (10, 10)
        button1_actions = [a for a in valid_actions if a.data.get("x") == 10 and a.data.get("y") == 10]
        self.assertEqual(len(button1_actions), 1, "button1 should have exactly one action at transformed coordinates (10, 10)")

        # Test button2: two non-negative pixels at (0,0) and (1,1) relative to sprite
        # Expected screen coordinates:
        # - (10 + 0) * 2 + 0 = 20, (10 + 0) * 2 + 0 = 20
        # - (10 + 1) * 2 + 0 = 22, (10 + 1) * 2 + 0 = 22
        button2_actions_1 = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 20]
        self.assertEqual(len(button2_actions_1), 1, "button2 should have action at transformed coordinates (20, 20)")

        button2_actions_2 = [a for a in valid_actions if a.data.get("x") == 22 and a.data.get("y") == 22]
        self.assertEqual(len(button2_actions_2), 1, "button2 should have action at transformed coordinates (22, 22)")

        # Test with default 64x64 camera (scale=1, offsets=0)
        default_camera = Camera(width=64, height=64)
        game_default = TestGame("test_default_camera", [level], camera=default_camera, available_actions=[6])
        default_actions = game_default._get_valid_clickable_actions()

        # With default camera, coordinates should be untransformed
        # Expected: button1 at (5, 5), button2 at (10, 10) and (11, 11)
        button1_default = [a for a in default_actions if a.data.get("x") == 5 and a.data.get("y") == 5]
        self.assertEqual(len(button1_default), 1, "Default camera should place button1 at untransformed coordinates (5, 5)")

        button2_default_1 = [a for a in default_actions if a.data.get("x") == 10 and a.data.get("y") == 10]
        self.assertEqual(len(button2_default_1), 1, "Default camera should place button2 first pixel at (10, 10)")

        button2_default_2 = [a for a in default_actions if a.data.get("x") == 11 and a.data.get("y") == 11]
        self.assertEqual(len(button2_default_2), 1, "Default camera should place button2 second pixel at (11, 11)")

        # Verify that all coordinates are within valid screen bounds (0-63)
        for action in valid_actions:
            x, y = action.data["x"], action.data["y"]
            self.assertGreaterEqual(x, 0, f"X coordinate {x} should be >= 0")
            self.assertLess(x, 64, f"X coordinate {x} should be < 64")
            self.assertGreaterEqual(y, 0, f"Y coordinate {y} should be >= 0")
            self.assertLess(y, 64, f"Y coordinate {y} should be < 64")

        # Test with a different camera size to verify offset calculations
        # 48x48 camera: scale = 64 // 48 = 1, offsets = (64 - 48*1) // 2 = 8
        offset_camera = Camera(width=48, height=48)
        game_offset = TestGame("test_offset_camera", [level], camera=offset_camera, available_actions=[6])
        offset_actions = game_offset._get_valid_clickable_actions()

        # Expected transformations for 48x48 camera:
        # scale = 1, x_offset = 8, y_offset = 8
        # button1: (5 * 1 + 8, 5 * 1 + 8) = (13, 13)
        # button2: (10 * 1 + 8, 10 * 1 + 8) = (18, 18) and (11 * 1 + 8, 11 * 1 + 8) = (19, 19)
        button1_offset = [a for a in offset_actions if a.data.get("x") == 13 and a.data.get("y") == 13]
        self.assertEqual(len(button1_offset), 1, "48x48 camera should place button1 at (13, 13)")

        button2_offset_1 = [a for a in offset_actions if a.data.get("x") == 18 and a.data.get("y") == 18]
        self.assertEqual(len(button2_offset_1), 1, "48x48 camera should place button2 first pixel at (18, 18)")

        button2_offset_2 = [a for a in offset_actions if a.data.get("x") == 19 and a.data.get("y") == 19]
        self.assertEqual(len(button2_offset_2), 1, "48x48 camera should place button2 second pixel at (19, 19)")

    def test_placeable_sprites_and_areas(self):
        """Test the placeable sprite functionality with placable areas."""

        # Create test level with placable areas and a placeable sprite
        level = Level(
            [
                # Regular clickable sprite
                Sprite([[1, 1], [1, 1]], name="clickable", x=5, y=5, tags=["sys_click"]),
                # Placeable sprite (should be clickable when not placed)
                Sprite([[2, 2], [2, 2]], name="placeable", x=10, y=10, tags=["sys_place"]),
                # Another placeable sprite
                Sprite([[3, 3], [3, 3]], name="placeable2", x=15, y=15, tags=["sys_place"]),
            ],
            placeable_areas=[
                # Small placable area at (20, 20) with 2x2 scale
                PlaceableArea(x=20, y=20, width=8, height=8, x_scale=2, y_scale=2),
                # Larger placable area at (40, 40) with 1x1 scale
                PlaceableArea(x=40, y=40, width=16, height=16, x_scale=1, y_scale=1),
            ],
        )

        game = TestGame("test_placeable", [level], available_actions=[6])

        # Test 1: When no placeable sprite is set, should get clickable actions including sys_place sprites
        valid_actions = game._get_valid_actions()

        # Should have actions for:
        # - clickable sprite: 1 action (single button)
        # - placeable sprite: 1 action (single button)
        # - placeable2 sprite: 1 action (single button)
        expected_clickable_count = 3
        self.assertEqual(len(valid_actions), expected_clickable_count)

        # Verify all actions are ACTION6
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)

        # Verify specific sprite actions exist
        clickable_action = [a for a in valid_actions if a.data.get("x") == 5 and a.data.get("y") == 5]
        self.assertEqual(len(clickable_action), 1, "Clickable sprite should have action at (5, 5)")

        placeable_action = [a for a in valid_actions if a.data.get("x") == 10 and a.data.get("y") == 10]
        self.assertEqual(len(placeable_action), 1, "Placeable sprite should have action at (10, 10)")

        placeable2_action = [a for a in valid_actions if a.data.get("x") == 15 and a.data.get("y") == 15]
        self.assertEqual(len(placeable2_action), 1, "Placeable2 sprite should have action at (15, 15)")

        # Test 2: Set a placeable sprite and verify it switches to placeable mode
        placeable_sprite = level.get_sprites_by_name("placeable")[0]
        game.set_placeable_sprite(placeable_sprite)

        # Now should get placeable actions instead of clickable actions
        valid_actions = game._get_valid_actions()

        # Should have placeable actions for both areas:
        # - Small area: (20,20) to (27,27) with 2x2 scale = 4x4 = 16 positions
        # - Large area: (40,40) to (55,55) with 1x1 scale = 16x16 = 256 positions
        expected_placeable_count = 16 + 256
        self.assertEqual(len(valid_actions), expected_placeable_count)

        # Verify all actions are ACTION6
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)

        # Test small area with 2x2 scale
        # Should have positions: (20,20), (22,20), (24,20), (26,20), (20,22), (22,22), etc.
        small_area_actions = [a for a in valid_actions if 20 <= a.data.get("x") <= 26 and 20 <= a.data.get("y") <= 26]
        self.assertEqual(len(small_area_actions), 16, "Small area should have 16 placeable positions with 2x2 scale")

        # Verify some specific positions exist
        pos_20_20 = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 20]
        self.assertEqual(len(pos_20_20), 1, "Position (20, 20) should be placeable")

        pos_22_20 = [a for a in valid_actions if a.data.get("x") == 22 and a.data.get("y") == 20]
        self.assertEqual(len(pos_22_20), 1, "Position (22, 20) should be placeable")

        pos_20_22 = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 22]
        self.assertEqual(len(pos_20_22), 1, "Position (20, 22) should be placeable")

        # Test large area with 1x1 scale
        # Should have positions: (40,40) to (55,55) with 1x1 scale
        large_area_actions = [a for a in valid_actions if 40 <= a.data.get("x") <= 55 and 40 <= a.data.get("y") <= 55]
        self.assertEqual(len(large_area_actions), 256, "Large area should have 256 placeable positions with 1x1 scale")

        # Verify some specific positions exist
        pos_40_40 = [a for a in valid_actions if a.data.get("x") == 40 and a.data.get("y") == 40]
        self.assertEqual(len(pos_40_40), 1, "Position (40, 40) should be placeable")

        pos_55_55 = [a for a in valid_actions if a.data.get("x") == 55 and a.data.get("y") == 55]
        self.assertEqual(len(pos_55_55), 1, "Position (55, 55) should be placeable")

        # Test 3: Different scale factors
        # Create a level with different scale factors
        level_scaled = Level(
            [
                Sprite([[1]], name="placeable3", x=0, y=0, tags=["sys_place"]),
            ],
            placeable_areas=[
                # Area with 3x3 scale
                PlaceableArea(x=0, y=0, width=9, height=9, x_scale=3, y_scale=3),
            ],
        )

        game_scaled = TestGame("test_scaled", [level_scaled], available_actions=[6])
        placeable3_sprite = level_scaled.get_sprites_by_name("placeable3")[0]
        game_scaled.set_placeable_sprite(placeable3_sprite)

        valid_scaled_actions = game_scaled._get_valid_actions()

        # Should have 3x3 = 9 positions: (0,0), (3,0), (6,0), (0,3), (3,3), (6,3), (0,6), (3,6), (6,6)
        expected_scaled_count = 9
        self.assertEqual(len(valid_scaled_actions), expected_scaled_count)

        # Verify specific scaled positions
        pos_0_0 = [a for a in valid_scaled_actions if a.data.get("x") == 0 and a.data.get("y") == 0]
        self.assertEqual(len(pos_0_0), 1, "Position (0, 0) should be placeable")

        pos_3_0 = [a for a in valid_scaled_actions if a.data.get("x") == 3 and a.data.get("y") == 0]
        self.assertEqual(len(pos_3_0), 1, "Position (3, 0) should be placeable")

        pos_6_6 = [a for a in valid_scaled_actions if a.data.get("x") == 6 and a.data.get("y") == 6]
        self.assertEqual(len(pos_6_6), 1, "Position (6, 6) should be placeable")

        # Test 4: Camera transformations with placeable areas
        custom_camera = Camera(width=32, height=32)  # scale=2, offsets=0
        game_camera = TestGame("test_camera_placeable", [level], camera=custom_camera, available_actions=[6])
        game_camera.set_placeable_sprite(placeable_sprite)

        valid_camera_actions = game_camera._get_valid_actions()

        # With scale=2 camera, coordinates should be transformed
        # Small area positions should be: (20*2+0, 20*2+0) = (40, 40), (22*2+0, 20*2+0) = (44, 40), etc.
        pos_40_40_camera = [a for a in valid_camera_actions if a.data.get("x") == 40 and a.data.get("y") == 40]
        self.assertEqual(len(pos_40_40_camera), 1, "Camera-transformed position (40, 40) should be placeable")

        pos_44_40_camera = [a for a in valid_camera_actions if a.data.get("x") == 44 and a.data.get("y") == 40]
        self.assertEqual(len(pos_44_40_camera), 1, "Camera-transformed position (44, 40) should be placeable")

        # Test 5: Clear placeable sprite and verify it returns to clickable mode
        game.set_placeable_sprite(None)
        valid_actions_cleared = game._get_valid_actions()

        # Should be back to clickable actions
        self.assertEqual(len(valid_actions_cleared), expected_clickable_count)

        # Verify clickable actions exist again
        clickable_action_cleared = [a for a in valid_actions_cleared if a.data.get("x") == 5 and a.data.get("y") == 5]
        self.assertEqual(len(clickable_action_cleared), 1, "Should have clickable actions when placeable sprite is cleared")

    def test_get_valid_placeble_actions_method(self):
        """Test the _get_valid_placeble_actions method in isolation."""
        # Create test level with placable areas
        level = Level(
            [
                Sprite([[1]], name="dummy", x=0, y=0),  # Dummy sprite, not used for this test
            ],
            placeable_areas=[
                # Small area with 1x1 scale
                PlaceableArea(x=10, y=10, width=4, height=4, x_scale=1, y_scale=1),
                # Medium area with 2x1 scale
                PlaceableArea(x=20, y=20, width=6, height=3, x_scale=2, y_scale=1),
                # Large area with 3x2 scale
                PlaceableArea(x=30, y=30, width=9, height=8, x_scale=3, y_scale=2),
            ],
        )

        game = TestGame("test_placeble_method", [level])

        # Test the method directly
        valid_actions = game._get_valid_placeble_actions()

        # Calculate expected positions:
        # Area 1: (10,10) to (13,13) with 1x1 scale = 4x4 = 16 positions
        # Area 2: (20,20) to (30,22) with 2x1 scale = 3x3 = 9 positions
        # Area 3: (30,30) to (54,42) with 3x2 scale = 3x4 = 12 positions
        expected_total = 16 + 9 + 12
        self.assertEqual(len(valid_actions), expected_total)

        # Verify all actions are ACTION6
        for action in valid_actions:
            self.assertEqual(action.id, GameAction.ACTION6)
            self.assertIn("x", action.data)
            self.assertIn("y", action.data)

        # Test Area 1: 1x1 scale, positions (10,10) to (13,13)
        area1_actions = [a for a in valid_actions if 10 <= a.data.get("x") <= 13 and 10 <= a.data.get("y") <= 13]
        self.assertEqual(len(area1_actions), 16, "Area 1 should have 16 positions with 1x1 scale")

        # Verify some specific positions
        pos_10_10 = [a for a in valid_actions if a.data.get("x") == 10 and a.data.get("y") == 10]
        self.assertEqual(len(pos_10_10), 1, "Position (10, 10) should be placeable")

        pos_13_13 = [a for a in valid_actions if a.data.get("x") == 13 and a.data.get("y") == 13]
        self.assertEqual(len(pos_13_13), 1, "Position (13, 13) should be placeable")

        # Test Area 2: 2x1 scale, positions (20,20), (22,20), (24,20), (26,20), (28,20), (30,20), (20,21), (22,21), etc.
        area2_actions = [a for a in valid_actions if 20 <= a.data.get("x") <= 30 and 20 <= a.data.get("y") <= 22]
        self.assertEqual(len(area2_actions), 9, "Area 2 should have 18 positions with 2x1 scale")

        # Verify some specific positions
        pos_20_20 = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 20]
        self.assertEqual(len(pos_20_20), 1, "Position (20, 20) should be placeable")

        pos_22_20 = [a for a in valid_actions if a.data.get("x") == 22 and a.data.get("y") == 20]
        self.assertEqual(len(pos_22_20), 1, "Position (22, 20) should be placeable")

        pos_20_21 = [a for a in valid_actions if a.data.get("x") == 20 and a.data.get("y") == 21]
        self.assertEqual(len(pos_20_21), 1, "Position (20, 21) should be placeable")

        # Test Area 3: 3x2 scale, positions (30,30), (33,30), (36,30), (39,30), (42,30), (45,30), (48,30), (51,30), (54,30), (30,32), etc.
        area3_actions = [a for a in valid_actions if 30 <= a.data.get("x") <= 54 and 30 <= a.data.get("y") <= 42]
        self.assertEqual(len(area3_actions), 12, "Area 3 should have 63 positions with 3x2 scale")

        # Verify some specific positions
        pos_30_30 = [a for a in valid_actions if a.data.get("x") == 30 and a.data.get("y") == 30]
        self.assertEqual(len(pos_30_30), 1, "Position (30, 30) should be placeable")

        pos_33_30 = [a for a in valid_actions if a.data.get("x") == 33 and a.data.get("y") == 30]
        self.assertEqual(len(pos_33_30), 1, "Position (33, 30) should be placeable")

        pos_30_32 = [a for a in valid_actions if a.data.get("x") == 30 and a.data.get("y") == 32]
        self.assertEqual(len(pos_30_32), 1, "Position (30, 32) should be placeable")

        # Test with camera transformations
        custom_camera = Camera(width=16, height=16)  # scale=4, offsets=0
        game_camera = TestGame("test_camera_placeble", [level], camera=custom_camera)

        valid_camera_actions = game_camera._get_valid_placeble_actions()

        # With scale=4 camera, coordinates should be transformed
        # Area 1 positions should be: (10*4+0, 10*4+0) = (40, 40), (11*4+0, 10*4+0) = (44, 40), etc.
        pos_40_40_camera = [a for a in valid_camera_actions if a.data.get("x") == 40 and a.data.get("y") == 40]
        self.assertEqual(len(pos_40_40_camera), 1, "Camera-transformed position (40, 40) should be placeable")

        pos_44_40_camera = [a for a in valid_camera_actions if a.data.get("x") == 44 and a.data.get("y") == 40]
        self.assertEqual(len(pos_44_40_camera), 1, "Camera-transformed position (44, 40) should be placeable")

    def test_too_many_frames(self):
        """Test that an error is raised if an action takes too many frames."""
        game = TestGameWithTooManyFrames("test_too_many_frames", [Level()])
        with self.assertRaises(ValueError) as ctx:
            game.perform_action(ActionInput(id=GameAction.ACTION1))
        self.assertIn("Action took too many frames", str(ctx.exception))
