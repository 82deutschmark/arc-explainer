"""Author: Claude Opus 5.5 Medium (Round 12 light theme re-film, new output folder: Claude Opus 5.5 Low)
Date: 08-November-2026
PURPOSE: Film the "One turn of the harness" player (make_turn_player.py; the game Locksmith, level 1,
from the saved run 20261023_1410_daniel-candnp3-a) into an MP4 and a looping GIF for the Kaggle copy of
Son Pham's "Stuffing the Turducken" special, which cannot run the page's script. The Boss (8 Nov): "I am
sure that you could use blender or something". A headless browser filming the real page is the better
tool here: the player is HTML, so the video shows exactly what the page shows, sharp text included.

How: Playwright opens the built article page with #turn-capture (the player resets and does not
autoplay), waits for the inlined font, hides the Play/Restart/Skip buttons (meaningless in a video),
then drives the player through window.__turnPlayer.step(dt) with a fixed 1/60 s per frame and
screenshots the figure after each step at twice the pixel density. So every run of this script films
the same frames, unaffected by how fast the machine is. After the stream ends the final state is held
for HOLD seconds, then the GIF loops back to the empty start, which opens the film for LEAD seconds. media_encode.py writes:
  - charts/turn.mp4 (1280 px wide, 60 fps) and charts/turn.gif (960 px, 20 fps), committed;
  - frames and a full-quality MP4 master under OUT_DIR on the Team 4TB drive (never committed).
The words are the page's, so the verbatim checks in make_turn_player.py cover the video too; run that
script first if the transcript or styles changed.
Usage: python3.14 make_turn_video.py [ls20|sk48] [OUT_DIR]   (needs Playwright with Chromium, and ffmpeg)
SRP/DRY check: Pass - make_turn_player.py builds the figure, media_encode.py holds the encoding; this
only films.
"""

from pathlib import Path
import shutil
import sys

import media_encode
from make_turn_player import launch_browser

# which figure to film: python3 make_turn_video.py [ls20|sk48] [OUT_DIR]
FIGS = {'ls20': ('fig-turn', '__turnPlayer', 'turn'), 'sk48': ('fig-turn-sk48', '__turnPlayerSk48', 'turn-sk48')}
WHICH = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in FIGS else 'ls20'
FIG_ID, GLOB, STEM = FIGS[WHICH]

HERE = Path(__file__).resolve().parent
PAGE = HERE.parent.parent / '2026-11-08-turducken-opening-pass.html'   # the Boss's opening pass; Son's page 2026-11-06-arc3-solution-draft.html is left as it was
OUT_DIR = Path(sys.argv[-1]) if len(sys.argv) > 2 else Path('/Volumes/Team 4TB/data/turducken-r16/' + STEM + '-video')   # light film (Round 12)
FPS = media_encode.FPS_IN
LEAD = 0.6          # seconds on the empty start (board before the turn) so the first frame is a clean one
HOLD = 3.0          # seconds the final state stays on screen before the loop restarts
VIEWPORT = 900      # same page width as the Kaggle still: the figure is about 777 CSS px wide
MAX_FRAMES = 60 * FPS


def main():
    from playwright.sync_api import sync_playwright
    frames = OUT_DIR / 'frames'
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)
    n = lead = round(LEAD * FPS)
    with sync_playwright() as pw:
        b = launch_browser(pw)
        pg = b.new_page(viewport={'width': VIEWPORT, 'height': 900}, device_scale_factor=2)
        pg.goto(PAGE.as_uri() + '#turn-capture')
        pg.wait_for_function(f'window.{GLOB} !== undefined')
        pg.evaluate('document.fonts.ready')
        pg.evaluate('''(id) => {
          const tp = document.querySelector("#" + id + " .tp");
          tp.querySelector(".tp-ctl").style.display = "none";
          tp.scrollIntoView({block: "center"});
        }''', FIG_ID)
        fig = pg.locator(f'#{FIG_ID} .tp')
        done = False
        while not done:
            fig.screenshot(path=str(frames / f'f{n:04d}.png'), animations='disabled')
            n += 1
            if n > MAX_FRAMES:
                raise SystemExit('The player did not finish within a minute of film; check the page.')
            done = pg.evaluate(f'window.{GLOB}.step({1000 / FPS})')
        fig.screenshot(path=str(frames / f'f{n:04d}.png'), animations='disabled')   # the final state
        b.close()
    for k in range(lead):
        shutil.copy(frames / f'f{lead:04d}.png', frames / f'f{k:04d}.png')
    last = frames / f'f{n:04d}.png'
    for k in range(1, round(HOLD * FPS)):
        shutil.copy(last, frames / f'f{n + k:04d}.png')
    total = n + round(HOLD * FPS)
    pattern = str(frames / 'f%04d.png')
    sizes = {
        f'{STEM}.mp4': media_encode.mp4(pattern, HERE / f'{STEM}.mp4', 1280),
        f'{STEM}.gif': media_encode.gif(pattern, HERE / f'{STEM}.gif', 960),
        'master': media_encode.mp4(pattern, OUT_DIR / f'{STEM}-master.mp4', 1554, crf=12),
    }
    shutil.copy(__file__, OUT_DIR / Path(__file__).name)
    print('frames', total, f'({total / FPS:.1f} s)', sizes)


if __name__ == '__main__':
    main()
