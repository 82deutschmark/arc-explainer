"""Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Shared video and GIF encoding for the two animated figures of Son Pham's "Stuffing the
Turducken" special: the Context management animation (make_trim_animation.py) and the one-turn harness
player (make_turn_video.py). The Kaggle copy of the article cannot run the page's script or play the
page's 60 fps WebP reliably, so each figure also ships as
  - an MP4 (H.264, yuv420p, faststart, plays in every browser and on Kaggle as a link), and
  - a looping GIF for the Kaggle Markdown embed (GIF is the format every Markdown renderer animates).
Both read a numbered PNG frame sequence written at 60 frames a second. The GIF keeps frames 0, 3, 6, ...
(20 fps, so each frame lasts exactly 5 hundredths of a second and an 18 s loop stays 18 s), is scaled
with Lanczos to article width, and uses one palette built from the whole clip with no dithering: the
figures are flat colour and text, where dithering only adds speckle and bytes. Frames are stored as
changed rectangles only, which keeps a mostly still transcript small.
Needs ffmpeg on PATH (Homebrew).
SRP/DRY check: Pass - the only place the encoding settings live; both figure scripts call it.
"""

from pathlib import Path
import subprocess

FPS_IN = 60
GIF_FPS = 20


def mp4(pattern: str, out: Path, width: int, fps: int = FPS_IN, crf: int = 20) -> int:
    """Encode frames (an ffmpeg %04d pattern) to an H.264 MP4 `width` pixels wide. Returns bytes."""
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', pattern,
                    '-vf', f'scale={width}:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
                    '-tune', 'animation', '-crf', str(crf), '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', str(out)], check=True)
    return out.stat().st_size


def gif(pattern: str, out: Path, width: int, fps_in: int = FPS_IN, fps: int = GIF_FPS,
        colors: int = 256) -> int:
    """Encode frames to a looping GIF `width` pixels wide at `fps`. Returns bytes."""
    # Keep input frames 0, k, 2k, ... exactly (the fps filter rounds and can start on frame 1), and
    # time them in the GIF's own hundredths of a second so every frame, the last one too, lasts the same.
    k = fps_in // fps
    graph = (f'select=not(mod(n\\,{k})),settb=1/100,setpts=N*{100 // fps},scale={width}:-1:flags=lanczos,split[a][b];'
             f'[a]palettegen=max_colors={colors}:stats_mode=full[p];'
             '[b][p]paletteuse=dither=none:diff_mode=rectangle')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps_in), '-i', pattern,
                    '-filter_complex', graph, '-loop', '0', '-final_delay', str(100 // fps), str(out)],
                   check=True)
    return out.stat().st_size
