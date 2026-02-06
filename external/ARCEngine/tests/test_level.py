"""Tests for the level module."""

import unittest

from arcengine import BlockingMode, Level, Sprite


class TestLevel(unittest.TestCase):
    """Test cases for the Level class."""

    def test_sprite_management(self):
        """Test basic sprite management functionality."""
        level = Level()

        # Test empty level
        self.assertEqual(len(level.get_sprites()), 0)

        # Create some test sprites
        sprite1 = Sprite([[1]], name="box")
        sprite2 = Sprite([[2]], name="box")
        sprite3 = Sprite([[3]], name="player")

        # Test adding sprites
        level.add_sprite(sprite1)
        self.assertEqual(len(level.get_sprites()), 1)

        level.add_sprite(sprite2)
        level.add_sprite(sprite3)
        self.assertEqual(len(level.get_sprites()), 3)

        # Test getting sprites by name
        boxes = level.get_sprites_by_name("box")
        self.assertEqual(len(boxes), 2)
        self.assertIn(sprite1, boxes)
        self.assertIn(sprite2, boxes)

        players = level.get_sprites_by_name("player")
        self.assertEqual(len(players), 1)
        self.assertEqual(players[0], sprite3)

        # Test removing sprites
        level.remove_sprite(sprite1)
        self.assertEqual(len(level.get_sprites()), 2)
        self.assertEqual(len(level.get_sprites_by_name("box")), 1)

        # Test removing non-existent sprite (should not raise)
        level.remove_sprite(sprite1)
        self.assertEqual(len(level.get_sprites()), 2)

        # Verify get_sprites() returns a copy
        sprites = level.get_sprites()
        sprites.clear()  # Should not affect the level's sprites
        self.assertEqual(len(level.get_sprites()), 2)

    def test_sprite_list_constructor(self):
        """Test constructing a level with an initial sprite list."""
        # Create test sprites
        sprite1 = Sprite([[1]], name="box")
        sprite2 = Sprite([[2]], name="player")

        # Create level with sprites
        level = Level(sprites=[sprite1, sprite2])

        # Verify sprites were added
        self.assertEqual(len(level.get_sprites()), 2)
        self.assertEqual(len(level.get_sprites_by_name("box")), 1)
        self.assertEqual(len(level.get_sprites_by_name("player")), 1)

    def test_level_clone(self):
        """Test cloning a level with all its sprites."""
        # Create original level with sprites
        sprite1 = Sprite([[1]], name="box", x=10, y=20)
        sprite2 = Sprite([[2]], name="player", x=30, y=40)
        original = Level(sprites=[sprite1, sprite2])

        # Clone the level
        cloned = original.clone()

        # Verify same number of sprites
        self.assertEqual(len(cloned.get_sprites()), len(original.get_sprites()))

        # Get sprites by name from both levels
        orig_box = original.get_sprites_by_name("box")[0]
        clone_box = cloned.get_sprites_by_name("box")[0]

        # Verify sprites have same properties but are different objects
        self.assertNotEqual(id(orig_box), id(clone_box))  # Different objects
        self.assertEqual(orig_box.name, clone_box.name)  # Same name
        self.assertEqual(orig_box.x, clone_box.x)  # Same position
        self.assertEqual(orig_box.y, clone_box.y)

        # Modify original sprite, verify clone is unaffected
        orig_box.set_position(50, 60)
        self.assertEqual(clone_box.x, 10)  # Original position
        self.assertEqual(clone_box.y, 20)

    def test_sprite_tags(self):
        """Test sprite tag-related functionality."""
        # Create test sprites with various tags
        sprite1 = Sprite([[1]], name="enemy1", tags=["enemy", "flying"])
        sprite2 = Sprite([[2]], name="enemy2", tags=["enemy", "ground"])
        sprite3 = Sprite([[3]], name="player", tags=["player", "ground"])
        sprite4 = Sprite([[4]], name="obstacle", tags=["obstacle"])

        # Create level with sprites
        level = Level(sprites=[sprite1, sprite2, sprite3, sprite4])

        # Test get_sprites_by_tag
        enemies = level.get_sprites_by_tag("enemy")
        self.assertEqual(len(enemies), 2)
        self.assertIn(sprite1, enemies)
        self.assertIn(sprite2, enemies)

        ground_units = level.get_sprites_by_tag("ground")
        self.assertEqual(len(ground_units), 2)
        self.assertIn(sprite2, ground_units)
        self.assertIn(sprite3, ground_units)

        # Test get_sprites_by_tags (AND)
        flying_enemies = level.get_sprites_by_tags(["enemy", "flying"])
        self.assertEqual(len(flying_enemies), 1)
        self.assertEqual(flying_enemies[0], sprite1)

        ground_enemies = level.get_sprites_by_tags(["enemy", "ground"])
        self.assertEqual(len(ground_enemies), 1)
        self.assertEqual(ground_enemies[0], sprite2)

        # Test get_sprites_by_any_tag (OR)
        ground_or_flying = level.get_sprites_by_any_tag(["ground", "flying"])
        self.assertEqual(len(ground_or_flying), 3)
        self.assertIn(sprite1, ground_or_flying)  # flying
        self.assertIn(sprite2, ground_or_flying)  # ground
        self.assertIn(sprite3, ground_or_flying)  # ground

        # Test with non-existent tags
        self.assertEqual(len(level.get_sprites_by_tag("nonexistent")), 0)
        self.assertEqual(len(level.get_sprites_by_tags(["enemy", "nonexistent"])), 0)
        self.assertEqual(len(level.get_sprites_by_any_tag(["nonexistent"])), 0)

        # Test with empty tag list
        self.assertEqual(len(level.get_sprites_by_tags([])), 0)
        self.assertEqual(len(level.get_sprites_by_any_tag([])), 0)

        all_tags = level.get_all_tags()
        self.assertEqual(len(all_tags), 5)
        self.assertIn("enemy", all_tags)
        self.assertIn("flying", all_tags)
        self.assertIn("ground", all_tags)
        self.assertIn("obstacle", all_tags)
        self.assertIn("player", all_tags)

    def test_level_data(self):
        # Create level with sprites
        level = Level(sprites=[], data={"test": "test"})

        self.assertEqual(level.get_data("test"), "test")
        self.assertEqual(level.get_data("nonexistent"), None)

        level2 = level.clone()
        level._data["test"] = "test2"
        self.assertEqual(level.get_data("test"), "test2")
        self.assertEqual(level2.get_data("test"), "test")

    def test_sprite_at_location(self):
        """Test getting sprite at a given location"""
        # Create test sprites with various tags
        sprite1 = Sprite([[1, 1]], name="enemy1", tags=["enemy", "flying"], x=10, y=10)
        sprite2 = Sprite([[2], [2]], name="enemy2", tags=["enemy", "ground"], x=11, y=11)
        sprite3 = Sprite([[3]], name="player", tags=["player", "ground"], x=10, y=10)
        sprite4 = Sprite([[4]], name="obstacle", tags=["obstacle"], x=15, y=15)
        sprite5 = Sprite([[-1, 5], [5, -1]], name="partial_pixel_perfect", x=20, y=20, blocking=BlockingMode.PIXEL_PERFECT)
        sprite6 = Sprite([[-1, 6], [6, -1]], name="partial_bounding_box", x=22, y=22, blocking=BlockingMode.BOUNDING_BOX)
        sprite7 = Sprite([[7]], "below", x=25, y=25, layer=0)
        sprite8 = Sprite([[8]], "above", x=25, y=25, layer=1)

        level = Level(sprites=[sprite1, sprite2, sprite3, sprite4, sprite5, sprite6, sprite7, sprite8])

        self.assertEqual(level.get_sprite_at(5, 5), None)
        self.assertEqual(level.get_sprite_at(10, 10), sprite1)
        self.assertEqual(level.get_sprite_at(11, 10), sprite1)
        self.assertEqual(level.get_sprite_at(11, 11), sprite2)
        self.assertEqual(level.get_sprite_at(11, 12), sprite2)
        self.assertEqual(level.get_sprite_at(15, 15), sprite4)

        self.assertEqual(level.get_sprite_at(10, 10, "enemy"), sprite1)
        self.assertEqual(level.get_sprite_at(11, 11, "enemy"), sprite2)
        self.assertEqual(level.get_sprite_at(10, 10, "player"), sprite3)
        self.assertEqual(level.get_sprite_at(15, 15, "obstacle"), sprite4)

        self.assertEqual(level.get_sprite_at(20, 20), None)
        self.assertEqual(level.get_sprite_at(21, 20), sprite5)
        self.assertEqual(level.get_sprite_at(22, 22), sprite6)

        self.assertEqual(level.get_sprite_at(25, 25), sprite8)

    def test_sprite_at_with_scaling_and_rotation(self):
        """Test getting sprite at a given location with scaling and rotation"""
        # Create test sprites with various tags
        sprite1 = Sprite([[-1, 5], [5, 5]], name="partial_pixel_perfect", x=0, y=0, blocking=BlockingMode.PIXEL_PERFECT)

        level = Level(sprites=[sprite1])

        self.assertEqual(level.get_sprite_at(0, 0), None)
        self.assertEqual(level.get_sprite_at(1, 0), sprite1)
        self.assertEqual(level.get_sprite_at(0, 1), sprite1)
        self.assertEqual(level.get_sprite_at(1, 1), sprite1)

        sprite1.rotate(90)
        self.assertEqual(level.get_sprite_at(0, 0), sprite1)
        self.assertEqual(level.get_sprite_at(1, 0), None)
        self.assertEqual(level.get_sprite_at(0, 1), sprite1)
        self.assertEqual(level.get_sprite_at(1, 1), sprite1)

        sprite1.rotate(90)
        self.assertEqual(level.get_sprite_at(0, 0), sprite1)
        self.assertEqual(level.get_sprite_at(1, 0), sprite1)
        self.assertEqual(level.get_sprite_at(0, 1), sprite1)
        self.assertEqual(level.get_sprite_at(1, 1), None)

        sprite1.set_scale(2)
        self.assertEqual(level.get_sprite_at(0, 0), sprite1)
        self.assertEqual(level.get_sprite_at(1, 1), sprite1)
        self.assertEqual(level.get_sprite_at(2, 2), None)
        self.assertEqual(level.get_sprite_at(3, 3), None)
        self.assertEqual(level.get_sprite_at(2, 0), sprite1)
        self.assertEqual(level.get_sprite_at(0, 2), sprite1)

    def test_sprite_at_with_non_collidable(self):
        """Test getting sprite at a given location with scaling and rotation"""
        # Create test sprites with various tags
        sprite1 = Sprite([[5, 5], [5, 5]], name="partial_pixel_perfect", x=0, y=0, blocking=BlockingMode.PIXEL_PERFECT)
        sprite1.set_collidable(False)

        level = Level(sprites=[sprite1])

        self.assertEqual(level.get_sprite_at(0, 0), None)
        self.assertEqual(level.get_sprite_at(1, 0), None)
        self.assertEqual(level.get_sprite_at(0, 1), None)
        self.assertEqual(level.get_sprite_at(1, 1), None)

        self.assertEqual(level.get_sprite_at(0, 0, ignore_collidable=True), sprite1)
        self.assertEqual(level.get_sprite_at(1, 0, ignore_collidable=True), sprite1)
        self.assertEqual(level.get_sprite_at(0, 1, ignore_collidable=True), sprite1)
        self.assertEqual(level.get_sprite_at(1, 1, ignore_collidable=True), sprite1)

    def test_level_name_on_clone(self):
        """Test the name of a level is cloned correctly."""
        level = Level(name="test_level")
        cloned = level.clone()
        self.assertEqual(level.name, "test_level")
        self.assertEqual(cloned.name, "test_level")

    def test_collides_with(self):
        """Test the collides_with method of the level class."""
        # Create test sprites with various tags
        sprite1 = Sprite([[1, 1]], name="enemy1", tags=["enemy", "flying"], x=12, y=12)
        sprite2 = Sprite([[3]], name="player", tags=["player", "ground"], x=10, y=10)

        level = Level(sprites=[sprite1, sprite2])

        self.assertEqual(len(level.collides_with(sprite1, True)), 0)

        sprite1.move(-2, -2)

        self.assertEqual(len(level.collides_with(sprite1, True)), 1)
