# Chart evidence and reproduction

These are archived observations, not current runs or final submission results. No new Kaggle requests.

- speed-score.png: arc3-speed/README.md, “Where we are (11-Oct-2026)”. Score Climb 2: 25 official + 25 copycat games, 132 minutes, mean of 50. Wall-clock throughput includes prompt reading. Baseline shown as midpoint 1366.5 of reported range 1353–1380, with range error bar. Baseline one run; 28-lane arms four runs; 48-lane count unspecified. Configurations differ in precision, experts and context: not a controlled concurrency ablation. No score error bars were available.
- lane-ladder.png: same archived README, 75-game ladder, two runs per arm. Separate suite from Score Climb 2; never compare its absolute scores to that chart. Values 24/28/32 lanes = 34.5/35.9/39.1. No uncertainty supplied.
- rl-all16.png: arc-3/docs/static/data/rl4-live.json, snapshot 2026-10-19T16:02:00Z, trend_charts.all16.points. Seven hard official games + nine copycats, held out from training per archived dashboard. Displayed as checkpoint categories, not a chronological learning curve (source orders R6b before R5). Selected checkpoints, no error bars or variance available; not Kaggle scores and not proof of final submission improvement.

chart-data.json contains exactly the plotted aggregates. generate_charts.py reproduces all PNGs with matplotlib. Private serving implementation is not copied; only the aggregate measurements requested for the article are exported.

Harness comparison: harness-local-kaggle.png is reconstructed from the adjacent Claude-authored harness-source-manifest.md (October 17), not a recovered original draft chart. Data are in chart-data.json; missing Kaggle results are intentionally absent.


## PDF-reference redraw (current figures)

`original/*.svg` and `.png` now contain full static vector figure compositions matching Son’s supplied PDF style: original measured plot marks plus integrated title, subtitle, legends, summary cards and caveats. SVG type is outlined for consistent typography, with 2400px PNG companions. These are vector redraws, not PDF screenshots. Data are unchanged; `original/redraw-manifest.json` records the source hash and eleven figures. The older charts above remain archived alternatives, not the current original-article figures.

Canonical regeneration: `python3.13 charts/redraw_pdf_panels.py` from the report root. It first runs the preserved `static_original.cjs` against the locally archived original HTML, then composes final vector panels and synchronizes the page, Markdown and ZIP. Requires Python 3.13 fontTools/BeautifulSoup and installed JS DOM/Sharp dependencies as recorded in the scripts. `fonts/` contains the original SIL-OFL typefaces and licenses. Raw Claude runtime HTML is deliberately not distributed.


## Local public-25 board over time (added 7 November 2026)

`public25-over-time.svg` / `.png` and `public25-runs.csv` (every plotted run). Source: a saved snapshot of arc3.sonpham.net/api/v1/catalog read on 7 November 2026; runs kept only if they played all 25 official public games, scored as the mean of those 25. This is the local board, not the Kaggle leaderboard. Regenerate with `python3 make_public25_chart.py <snapshot.json>`; the snapshot itself stays on the Team 4TB drive (path in the script header).


## Offline evaluation wording (added 7 November 2026, Claude Opus 5.5 Low)

Son asked that the charts stop saying "board" and say "offline evaluation". `reword_offline_charts.py` re-renders delta2, ladder, lanes, think, time and wf-overhead from the archived original frame with an exact list of wording swaps, then rebuilds only their SVG and 2400px PNG (no page, Markdown, data or ZIP writes). With the swaps removed it reproduces the previous SVGs byte for byte. `make_public25_chart.py` now draws "offline evaluation" too; its CSV family names are unchanged. Running the older canonical `redraw_pdf_panels.py` would bring the old wording back, so use `python3.13 charts/reword_offline_charts.py` for these six figures.


## Decode, exact or lossy (added 7 November 2026, Claude Opus 5.5 Low)

`decode-exact-lossy.svg` / `.png`, built by `python3.13 make_decode_exact_lossy_chart.py`. Bar heights are the TIME decode values in `original/source-data.json`. Each drop's colour is a reading of that build's recipe (sources listed in the script's DROPS comment), not a computed millisecond split. Writes only those two files.


## Tokens per second, exact or lossy (added 7 November 2026, Claude Opus 5.5 Low)

`tps-exact-lossy.svg` / `.png`, built by `python3.13 make_tps_exact_lossy_chart.py`. Bars are the whole-run tok/s of the TIME rows in `original/source-data.json` (the ladder chart's numbers). Each build's colour is imported from `make_decode_exact_lossy_chart.py`, so the two charts never disagree; the 1 Nov bar (after 56.02, never shipped) is its own kind, and its caption numbers come from the measured time split. Writes only those two files.


## Trimming and swapping, animated (added 7 November 2026, Claude Opus 5.5 Medium)

`trim.webp` (animated, looping, 1280x980, 60 fps since 8 Nov, 18 s, about 6.9 MB lossless), `trim-poster.png`, and for the Kaggle copy `trim.mp4` (H.264, 60 fps, about 1.2 MB) and `trim.gif` (960 px, 20 fps, about 2.2 MB), built by `python3.13 make_trim_animation.py`. Since Round 11 it is drawn in the one-turn player's look (dark navy surfaces, JetBrains Mono, top bar with a loop progress bar, legend row, uppercase label bars), so the two figures read as one family; content, geometry and timing are unchanged. A recreation of the original artifact's lost trim video from its archived caption and alt text, not the original file. Fixed numbers are the 56.02 settings; turn sizes, growth and swap timing are illustrative. Frames and a full-quality MP4 master go to the Team 4TB drive (path in the script header), never to git.

The "One turn of the harness" figure is an in-page player (Son's notes of 8 Nov: one continuous colour-coded monospace transcript streaming fast with the newest text in view, tool calls as yellow pills holding one real line of the call, reasoning shortened to real key lines, one game board stepping with each move; and, in his fourth note, a simpler game). It shows Locksmith, level 1, from run 20261023_1410_daniel-candnp3-a on arc3.sonpham.net: the site's step 15 (six moves up to the locked box, one action() each) and step 16 (one more UP clears the level). `python3 extract_turn_source.py <dir>` copies the two turns and their recorded boards from the saved run into `turn-source.json` (working copy under /Volumes/Team 4TB/data/turducken-r11/src). `python3 make_turn_player.py --still` (Playwright for the still) writes the player into the article page between the turn-player markers (style, transcript as HTML, board data and script all inline, since fast publish takes no .js or .css), `turn-board-cleared.png` (the no-JavaScript board) and `turn-still.png` (the final state, for the Kaggle copy). Real trace only: every shown line must be an exact substring of its saved section, in order; whole sections must reassemble exactly; each pill line must be a whole line of its call; each board step sits on the result line of that move. The Reaching Lurch version and its retired image renderer (`make_turn_walkthrough.py`) are in git history. (Claude Opus 5.5 Low, then Claude Opus 5.5 Medium, 8 Nov 2026.)

The player inlines a subset of `fonts/JetBrainsMono.ttf` (about 25 KB) so it shows the same typeface as the animation. `python3 make_turn_video.py` films it for the Kaggle copy: a headless Chromium (Playwright) opens the built page with `#turn-capture`, steps the player a fixed 1/60 s per frame through `window.__turnPlayer.step`, and screenshots each frame at twice the pixel density, so the film repeats exactly; it writes `turn.mp4` (1280 px, 60 fps, about 4.6 MB) and `turn.gif` (960 px, 20 fps, about 5.8 MB, 0.6 s on the empty start, 3 s on the end). Encoding settings for both figures live in `media_encode.py`. The Kaggle Markdown embeds the GIFs from the public GitHub repository, since fast publish takes no .gif or .mp4; its MP4 links go to the unlisted `/specials/2026-11-06-arc3-solution-draft-videos.html`, which plays the raw files. (Claude Opus 5.5 Medium, Round 11, 8 Nov 2026.)
