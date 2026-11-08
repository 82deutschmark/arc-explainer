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

`trim.webp` (animated, looping, 1280x960, 60 fps since 8 Nov, 18 s, about 6.4 MB lossless) and `trim-poster.png`, built by `python3.13 make_trim_animation.py`. A recreation of the original artifact's lost trim video from its archived caption and alt text, not the original file. Fixed numbers are the 56.02 settings; turn sizes, growth and swap timing are illustrative. Frames and a webm master go to the Team 4TB drive (path in the script header), never to git. Writes only those two files here.
