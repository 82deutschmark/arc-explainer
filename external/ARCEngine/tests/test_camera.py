"""Tests for the camera module."""

import unittest

import numpy as np

from arcengine import Camera, InteractionMode, Sprite, ToggleableUserDisplay


class TestCamera(unittest.TestCase):
    """Test cases for the Camera class."""

    def test_camera_initialization(self):
        """Test basic camera initialization with different parameters."""
        # Test default parameters
        camera = Camera()
        self.assertEqual(camera._x, 0)
        self.assertEqual(camera._y, 0)
        self.assertEqual(camera._width, 64)
        self.assertEqual(camera._height, 64)
        self.assertEqual(camera._background, 5)
        self.assertEqual(camera._letter_box, 5)

        # Test custom parameters
        camera = Camera(x=10, y=20, width=32, height=32, background=1, letter_box=2)
        self.assertEqual(camera._x, 10)
        self.assertEqual(camera._y, 20)
        self.assertEqual(camera._width, 32)
        self.assertEqual(camera._height, 32)
        self.assertEqual(camera._background, 1)
        self.assertEqual(camera._letter_box, 2)

        # Test invalid dimensions
        with self.assertRaises(ValueError) as ctx:
            Camera(width=65)
        self.assertIn("Camera dimensions cannot exceed 64x64 pixels", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            Camera(height=65)
        self.assertIn("Camera dimensions cannot exceed 64x64 pixels", str(ctx.exception))

    def test_camera_properties(self):
        """Test camera property getters and setters."""
        camera = Camera()

        # Test initial values
        self.assertEqual(camera.x, 0)
        self.assertEqual(camera.y, 0)
        self.assertEqual(camera.width, 64)
        self.assertEqual(camera.height, 64)

        # Test setters
        camera.x = 10
        camera.y = 20
        camera.width = 32
        camera.height = 32

        self.assertEqual(camera.x, 10)
        self.assertEqual(camera.y, 20)
        self.assertEqual(camera.width, 32)
        self.assertEqual(camera.height, 32)

        # Test invalid width
        with self.assertRaises(ValueError) as ctx:
            camera.width = 65
        self.assertIn("Width cannot exceed 64 pixels", str(ctx.exception))

        # Test invalid height
        with self.assertRaises(ValueError) as ctx:
            camera.height = 65
        self.assertIn("Height cannot exceed 64 pixels", str(ctx.exception))

        # Test type conversion
        camera.x = "10"
        camera.y = "20"
        self.assertEqual(camera.x, 10)
        self.assertEqual(camera.y, 20)

    def test_render_no_scaling(self):
        """Test rendering when no scaling is needed (64x64)."""
        camera = Camera(width=64, height=64, background=1, letter_box=2)
        rendered = camera.render([])  # Empty sprite list for now

        # Should be a 64x64 array filled with background color (no letterboxing needed)
        self.assertEqual(rendered.shape, (64, 64))
        self.assertTrue(np.all(rendered == 1))  # All pixels should be background color

    def test_render_uniform_scaling(self):
        """Test rendering with uniform scaling (same scale factor for both dimensions)."""
        # 32x32 should scale up by 2 to fill 64x64
        camera = Camera(width=32, height=32, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Should be entirely filled with background color (no letterboxing needed)
        self.assertTrue(np.all(rendered == 1))

        # 16x16 should scale up by 4 to fill 64x64
        camera = Camera(width=16, height=16, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Should be entirely filled with background color (no letterboxing needed)
        self.assertTrue(np.all(rendered == 1))

    def test_render_non_uniform_dimensions(self):
        """Test rendering with non-uniform dimensions (different width/height)."""
        # 30x15 should scale up by 2 (limited by width) to 60x30 and be centered
        camera = Camera(width=30, height=15, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Verify dimensions of scaled viewport (60x30)
        viewport = rendered[17:47, 2:62]  # Should be the 60x30 viewport region
        self.assertEqual(viewport.shape, (30, 60))
        self.assertTrue(np.all(viewport == 1))

        # Verify letterboxing
        self.assertTrue(np.all(rendered[0:17, :] == 2))  # Top letterbox
        self.assertTrue(np.all(rendered[47:, :] == 2))  # Bottom letterbox
        self.assertTrue(np.all(rendered[17:47, 0:2] == 2))  # Left letterbox
        self.assertTrue(np.all(rendered[17:47, 62:] == 2))  # Right letterbox

        # 15x30 should scale up by 2 (limited by width) to 30x60 and be centered
        camera = Camera(width=15, height=30, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Verify dimensions of scaled viewport (30x60)
        viewport = rendered[2:62, 17:47]  # Should be the 30x60 viewport region
        self.assertEqual(viewport.shape, (60, 30))
        self.assertTrue(np.all(viewport == 1))

        # Verify letterboxing
        self.assertTrue(np.all(rendered[0:2, :] == 2))  # Top letterbox
        self.assertTrue(np.all(rendered[62:, :] == 2))  # Bottom letterbox
        self.assertTrue(np.all(rendered[2:62, 0:17] == 2))  # Left letterbox
        self.assertTrue(np.all(rendered[2:62, 47:] == 2))  # Right letterbox

    def test_render_prime_dimensions(self):
        """Test rendering with prime number dimensions."""
        # 31x31 should scale up by 2 and be centered (62x62 with 1px letterbox on each side)
        camera = Camera(width=31, height=31, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Verify dimensions of scaled viewport (62x62)
        viewport = rendered[1:63, 1:63]  # Should be the 62x62 viewport region
        self.assertEqual(viewport.shape, (62, 62))
        self.assertTrue(np.all(viewport == 1))

        # Verify letterboxing (1px on each side)
        self.assertTrue(np.all(rendered[0, :] == 2))  # Top letterbox
        self.assertTrue(np.all(rendered[-1, :] == 2))  # Bottom letterbox
        self.assertTrue(np.all(rendered[:, 0] == 2))  # Left letterbox
        self.assertTrue(np.all(rendered[:, -1] == 2))  # Right letterbox

    def test_render_small_dimensions(self):
        """Test rendering with very small dimensions."""
        # 1x1 should scale up to 64x64
        camera = Camera(width=1, height=1, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Should be entirely filled with background color
        self.assertTrue(np.all(rendered == 1))

        # 2x2 should scale up to 64x64 (scale factor of 32)
        camera = Camera(width=2, height=2, background=1, letter_box=2)
        rendered = camera.render([])

        self.assertEqual(rendered.shape, (64, 64))
        # Should be entirely filled with background color (no letterboxing needed)
        self.assertTrue(np.all(rendered == 1))

    def test_render_centered_sprite(self):
        """Test rendering a single sprite centered in the viewport."""
        # Create a 4x4 sprite with some transparent pixels
        sprite = Sprite([[-1, 1, 1, -1], [1, 2, 2, 1], [1, 2, 2, 1], [-1, 1, 1, -1]], x=2, y=1)  # Position sprite to center it in 8x8 viewport

        # Create an 8x8 camera
        camera = Camera(width=8, height=8, background=0, letter_box=5)
        rendered = camera._raw_render([sprite])

        # Expected output: sprite at (2,1) in 8x8 viewport
        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 1, 2, 2, 1, 0, 0],
                [0, 0, 1, 2, 2, 1, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )

        # Verify shape and content
        self.assertEqual(rendered.shape, (8, 8))
        self.assertTrue(np.array_equal(rendered, expected))

    def test_render_with_interface(self):
        """Test rendering a single sprite centered in the viewport."""
        # Create a 4x4 sprite with some transparent pixels
        sprite = Sprite([[-1, 1, 1, -1], [1, 2, 2, 1], [1, 2, 2, 1], [-1, 1, 1, -1]], x=2, y=1)  # Position sprite to center it in 8x8 viewport

        interface1 = Sprite([[1, 1], [1, -1]], x=2, y=1, interaction=InteractionMode.INTANGIBLE)

        interface2 = Sprite([[2, 2], [2, -1]], x=1, y=1, interaction=InteractionMode.REMOVED)

        ui = ToggleableUserDisplay([(interface1, interface2)])

        # Create an 8x8 camera
        camera = Camera(width=8, height=8, background=0, letter_box=5, interfaces=[ui])
        rendered = camera.render([sprite])

        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )
        # ruff: on

        # Verify shape and content
        self.assertEqual(rendered.shape, (64, 64))
        self.assertTrue(np.array_equal(rendered, expected))

    def test_render_rotated_sprite(self):
        """Test rendering a rotated sprite."""
        # Create a 3x3 L-shaped sprite
        sprite = Sprite([[1, -1, -1], [1, -1, -1], [1, 1, 1]], x=2, y=1, rotation=180)  # Rotate 90 degrees clockwise and position explicitly

        # Create a 7x7 camera
        camera = Camera(width=7, height=7, background=0, letter_box=5)
        rendered = camera._raw_render([sprite])

        # Expected output: L-shape rotated 90° clockwise at position (2,1)
        # Original:     90° rotation:
        # 1 -1 -1      1  1  1
        # 1 -1 -1  ->  -1 -1 1
        # 1  1  1      -1 -1 1
        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 0, 0],
                [0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )

        # Verify shape and content
        self.assertEqual(rendered.shape, (7, 7))
        # Print arrays for debugging if they don't match
        if not np.array_equal(rendered, expected):
            print("\nExpected:")
            print(expected)
            print("\nActual:")
            print(rendered)
        self.assertTrue(np.array_equal(rendered, expected))

    def test_render_scaled_sprite(self):
        """Test rendering a scaled sprite."""
        # Create a 2x2 sprite that will be scaled up
        sprite = Sprite([[1, -1], [-1, 2]], x=1, y=1, scale=2)  # Scale up by 2 and position explicitly

        # Create a 6x6 camera
        camera = Camera(width=6, height=6, background=0, letter_box=5)
        rendered = camera._raw_render([sprite])

        # Expected output: sprite scaled 2x at position (1,1)
        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 0],
                [0, 1, 1, 0, 0, 0],
                [0, 0, 0, 2, 2, 0],
                [0, 0, 0, 2, 2, 0],
                [0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )

        # Verify shape and content
        self.assertEqual(rendered.shape, (6, 6))
        self.assertTrue(np.array_equal(rendered, expected))

    def test_render_multiple_sprites(self):
        """Test rendering multiple sprites with different positions and layers."""
        camera = Camera(width=32, height=32, background=0)

        # Create some test sprites
        sprite1 = Sprite([[1, 1], [1, 1]], x=5, y=5, layer=0)  # Lower layer
        sprite2 = Sprite([[2, 2], [2, 2]], x=6, y=6, layer=1)  # Higher layer
        sprite3 = Sprite([[3]], x=6, y=6, layer=2)  # Highest layer, 1x1 sprite

        rendered = camera.render([sprite1, sprite2, sprite3])
        self.assertEqual(rendered.shape, (64, 64))  # Final output is always 64x64

        # Get the raw (unscaled) output for easier testing
        raw = camera._raw_render([sprite1, sprite2, sprite3])
        self.assertEqual(raw.shape, (32, 32))

        # Check layering: sprite3 (layer 2) should be on top at (6,6)
        self.assertEqual(raw[6, 6], 3)
        # sprite2 (layer 1) should be visible at (7,7)
        self.assertEqual(raw[7, 7], 2)
        # sprite1 (layer 0) should be visible at (5,5)
        self.assertEqual(raw[5, 5], 1)

    def test_sprite_clipping(self):
        """Test sprite clipping at viewport boundaries."""
        camera = Camera(width=8, height=8, background=0)

        # Create sprites that extend beyond viewport
        sprite1 = Sprite([[1, 1], [1, 1]], x=-1, y=-1)  # Partially off-screen (top-left)
        sprite2 = Sprite([[2, 2], [2, 2]], x=7, y=7)  # Partially off-screen (bottom-right)

        raw = camera._raw_render([sprite1, sprite2])

        # Check sprite1 clipping (should only see bottom-right pixel)
        self.assertEqual(raw[0, 0], 1)  # Only visible pixel from sprite1
        self.assertEqual(raw[0, 1], 0)  # Outside sprite1

        # Check sprite2 clipping (should only see top-left pixel)
        self.assertEqual(raw[7, 7], 2)  # Only visible pixel from sprite2
        self.assertEqual(raw[6, 6], 0)  # Outside sprite2

    def test_sprite_transparency(self):
        """Test sprite transparency and overlapping."""
        camera = Camera(width=8, height=8, background=0)

        # Create overlapping sprites with transparency
        sprite1 = Sprite([[1, 1], [1, 1]], x=1, y=1, layer=0)
        sprite2 = Sprite([[2, -1], [-1, 2]], x=1, y=1, layer=1)  # Transparent diagonal

        raw = camera._raw_render([sprite1, sprite2])

        # Check that transparent pixels from sprite2 show sprite1
        self.assertEqual(raw[1, 2], 1)  # Transparent pixel shows through
        self.assertEqual(raw[2, 1], 1)  # Transparent pixel shows through
        # Check that non-transparent pixels from sprite2 are visible
        self.assertEqual(raw[1, 1], 2)  # Top-left corner
        self.assertEqual(raw[2, 2], 2)  # Bottom-right corner

    def test_camera_movement(self):
        """Test camera movement relative to sprites."""
        camera = Camera(width=8, height=8, background=0)
        sprite = Sprite([[1, 1], [1, 1]], x=10, y=10)  # Sprite outside initial view

        # Initially sprite should be outside view
        raw1 = camera._raw_render([sprite])
        self.assertTrue(np.all(raw1 == 0))  # All background

        # Move camera to see sprite
        camera.move(9, 9)
        raw2 = camera._raw_render([sprite])
        self.assertEqual(raw2[1, 1], 1)  # Sprite now visible

        # Move camera to partially see sprite
        camera.move(2, 2)
        raw3 = camera._raw_render([sprite])
        self.assertEqual(raw3[0, 0], 1)  # Only one pixel visible
        self.assertTrue(np.all(raw3[1:, 1:] == 0))  # Rest is background

    def test_render_overlapping_sprite_with_layers(self):
        """Test rendering transparent overlapping sprites with layers"""
        # Create a 4x4 sprite
        sprite1 = Sprite(
            [
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
            ],
            x=1,
            y=1,
            layer=2,
        )
        # -2 should also be transparent
        sprite2 = Sprite(
            [
                [-2, -2, -2, -1],
                [3, 3, 3, 3],
                [3, 3, 3, 3],
                [-2, -2, -2, -2],
            ],
            x=1,
            y=1,
            layer=1,
        )

        # Create a 6x6 camera
        camera = Camera(width=6, height=6, background=0, letter_box=5)
        rendered = camera._raw_render([sprite1, sprite2])

        # Expected output: sprite scaled 2x at position (1,1)
        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 3, 2, 2, 3, 0],
                [0, 3, 2, 2, 3, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )

        # Verify shape and content
        self.assertEqual(rendered.shape, (6, 6))
        self.assertTrue(np.array_equal(rendered, expected))

    def test_invisible_sprites_do_not_render(self):
        """Test that a sprite set to INVISIBLE and REMOVED to not reunder"""
        # Create a 4x4 sprite
        sprite1 = Sprite(
            [
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
                [-1, 2, 2, -1],
            ],
            x=1,
            y=1,
            layer=2,
        )
        # -2 should also be transparent
        sprite2 = Sprite(
            [
                [-2, -2, -2, -1],
                [3, 3, 3, 3],
                [3, 3, 3, 3],
                [-2, -2, -2, -2],
            ],
            x=1,
            y=1,
            layer=1,
            interaction=InteractionMode.INVISIBLE,
        )
        sprite3 = Sprite(
            [
                [-2, -2, -2, -1],
                [3, 3, 3, 3],
                [3, 3, 3, 3],
                [-2, -2, -2, -2],
            ],
            x=1,
            y=1,
            layer=1,
            interaction=InteractionMode.REMOVED,
        )

        # Create a 6x6 camera
        camera = Camera(width=6, height=6, background=0, letter_box=5)
        rendered = camera._raw_render([sprite1, sprite2, sprite3])

        # Expected output: sprite scaled 2x at position (1,1)
        expected = np.array(
            [
                [0, 0, 0, 0, 0, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 0, 2, 2, 0, 0],
                [0, 0, 0, 0, 0, 0],
            ],
            dtype=np.int8,
        )

        # Verify shape and content
        self.assertEqual(rendered.shape, (6, 6))
        self.assertTrue(np.array_equal(rendered, expected))

    def test_user_space_back_to_grid_space(self):
        """Test converting user space to grid space."""
        camera = Camera(width=64, height=64, background=0, letter_box=5)
        grid = camera.display_to_grid(5, 15)
        self.assertEqual(grid, (5, 15))  # Off screen
        grid = camera.display_to_grid(34, 30)
        self.assertEqual(grid, (34, 30))

        camera.move(10, 10)
        grid = camera.display_to_grid(5, 15)
        self.assertEqual(grid, (15, 25))  # Off screen
        grid = camera.display_to_grid(34, 30)
        self.assertEqual(grid, (44, 40))

        camera = Camera(width=6, height=6, background=0, letter_box=5)
        grid = camera.display_to_grid(0, 0)
        self.assertEqual(grid, None)  # Off screen
        grid = camera.display_to_grid(20, 30)
        self.assertEqual(grid, (1, 2))

        camera = Camera(width=32, height=64, background=0, letter_box=5)
        grid = camera.display_to_grid(15, 0)
        self.assertEqual(grid, None)  # Off screen
        grid = camera.display_to_grid(34, 30)
        self.assertEqual(grid, (18, 30))

        camera = Camera(width=16, height=32, background=0, letter_box=5)
        grid = camera.display_to_grid(15, 0)
        self.assertEqual(grid, None)  # Off screen
        grid = camera.display_to_grid(34, 30)
        self.assertEqual(grid, (9, 15))

        camera = Camera(width=30, height=15, background=0, letter_box=5)
        grid = camera.display_to_grid(5, 15)
        self.assertEqual(grid, None)  # Off screen
        grid = camera.display_to_grid(34, 30)
        self.assertEqual(grid, (16, 6))
