# Chart evidence and reproduction

These are archived observations, not current runs or final submission results. No new Kaggle requests.

- speed-score.png: arc3-speed/README.md, “Where we are (11-Oct-2026)”. Score Climb 2: 25 official + 25 copycat games, 132 minutes, mean of 50. Wall-clock throughput includes prompt reading. Baseline shown as midpoint 1366.5 of reported range 1353–1380, with range error bar. Baseline one run; 28-lane arms four runs; 48-lane count unspecified. Configurations differ in precision, experts and context: not a controlled concurrency ablation. No score error bars were available.
- lane-ladder.png: same archived README, 75-game ladder, two runs per arm. Separate suite from Score Climb 2; never compare its absolute scores to that chart. Values 24/28/32 lanes = 34.5/35.9/39.1. No uncertainty supplied.
- rl-all16.png: arc-3/docs/static/data/rl4-live.json, snapshot 2026-10-19T16:02:00Z, trend_charts.all16.points. Seven hard official games + nine copycats, held out from training per archived dashboard. Displayed as checkpoint categories, not a chronological learning curve (source orders R6b before R5). Selected checkpoints, no error bars or variance available; not Kaggle scores and not proof of final submission improvement.

chart-data.json contains exactly the plotted aggregates. generate_charts.py reproduces all PNGs with matplotlib. Private serving implementation is not copied; only the aggregate measurements requested for the article are exported.

Harness comparison: harness-local-kaggle.png is reconstructed from the adjacent Claude-authored harness-source-manifest.md (October 17), not a recovered original draft chart. Data are in chart-data.json; missing Kaggle results are intentionally absent.
