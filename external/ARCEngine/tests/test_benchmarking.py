"""
Benchmark tests for Sprite render caching.

Goal:
- Construct a game with ~10 sprites that exercises rendering every step.
- Measure time for N steps with Sprite(use_render_cache=False) vs True.
- Assert cached is at least 2x faster.

Notes:
- Benchmarks can be noisy on CI. We:
  - do a warmup
  - run multiple trials and take the best (min) time for each mode
  - use perf_counter
  - keep the test deterministic (no randomness)
"""

import os
import time
import unittest
from unittest.mock import patch

import numpy as np

from arcengine import (
    ActionInput,
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    Level,
    Sprite,
)


class RenderBenchmarkGame(ARCBaseGame):
    """
    Minimal game that renders every step.

    We intentionally call render() on all sprites each step to:
    - simulate typical frame rendering work
    - isolate the Sprite.render caching benefit
    """

    def __init__(self, game_id: str, levels: list[Level], camera: Camera | None = None) -> None:
        super().__init__(game_id=game_id, levels=levels, camera=camera)
        self._steps = 0

    def step(self) -> None:
        self._steps += 1
        # Complete immediately so perform_action collects just one frame per call
        self.complete_action()


def _make_pixels(seed: int, size: int = 16) -> np.ndarray:
    """
    Create a deterministic sprite pixel array with some transparency.
    """
    # deterministic "pattern"
    a = (np.arange(size * size, dtype=np.int8).reshape(size, size) + seed) % 10
    a = a.astype(np.int8)
    # punch some transparency holes (-1)
    a[::4, ::4] = -1
    return a


def _make_level_sys_static(
    *,
    use_render_cache: bool,
    sprite_count: int = 16,
    sys_static: bool,
) -> Level:
    """
    Build a level with sprite_count sprites.

    If sys_static=True:
      - mark sprites PIXEL_PERFECT and tag with "sys_static"
      - put all sprites on the same layer so Level construction merges them

    If sys_static=False:
      - same sprites but without "sys_static" tag (no merge)
      - still PIXEL_PERFECT to keep camera path consistent

    We keep transforms minimal here because the benchmark target is the Level merge +
    camera loop reduction; Sprite.render caching is still enabled but not the point.
    """
    sprites: list[Sprite] = []
    for i in range(sprite_count):
        pixels = _make_pixels(i, size=16)

        tags = []
        if sys_static:
            tags.append("sys_static")

        # Place sprites in a dense grid so camera work is realistic.
        # Keep within a 64x64 view.
        x = (i % 4) * 12
        y = (i // 4) * 12

        sprites.append(
            Sprite(
                pixels=pixels,  # ndarray supported
                name=f"s{i}",
                x=x,
                y=y,
                layer=0,  # IMPORTANT: same layer so sys_static merge triggers per-layer merge group
                blocking=BlockingMode.PIXEL_PERFECT,
                tags=tags,
            )
        )

    # Constructing Level triggers sys_static PIXEL_PERFECT merge (per your new Level impl).
    return Level(sprites)


class TestSysStaticBenchmark(unittest.TestCase):
    def _time_steps(self, *, sys_static: bool, steps: int, trials: int = 5) -> float:
        """
        Time 'steps' iterations of Camera.render().
        Returns best (minimum) duration across trials.
        """
        level = _make_level_sys_static(
            use_render_cache=True,
            sprite_count=16,
            sys_static=sys_static,
        )
        game = RenderBenchmarkGame("bench_sys_static", [level], camera=Camera(width=64, height=64))

        # Warm-up
        warm = min(50, max(5, steps // 10))
        for _ in range(warm):
            game.perform_action(ActionInput(id=GameAction.ACTION1))

        best = float("inf")
        for _ in range(trials):
            t0 = time.perf_counter()
            for _ in range(steps):
                game.perform_action(ActionInput(id=GameAction.ACTION1))
            dt = time.perf_counter() - t0
            if dt < best:
                best = dt
        return best

    def test_sys_static_is_faster(self):
        steps = int(os.getenv("SYS_STATIC_BENCH_STEPS", "1000"))
        trials = int(os.getenv("SYS_STATIC_BENCH_TRIALS", "5"))

        # Recommended default: modest threshold because CI noise + cache effects.
        # You can bump this locally if you want.
        required_speedup = float(os.getenv("SYS_STATIC_BENCH_REQUIRED_SPEEDUP", "1.5"))

        if os.getenv("SKIP_BENCHMARKS", "0") == "1":
            self.skipTest("Benchmarks skipped (SKIP_BENCHMARKS=1)")

        with patch.dict(os.environ, {}, clear=False):
            t_non_static = self._time_steps(sys_static=False, steps=steps, trials=trials)
            t_static = self._time_steps(sys_static=True, steps=steps, trials=trials)

        self.assertGreater(t_non_static, 0.0)
        self.assertGreater(t_static, 0.0)

        speedup = t_non_static / t_static

        msg = f"sys_static speedup too low: {speedup:.2f}x (non_static={t_non_static:.4f}s, static={t_static:.4f}s, steps={steps}, trials={trials}, required={required_speedup:.2f}x)"
        self.assertGreaterEqual(speedup, required_speedup, msg)
