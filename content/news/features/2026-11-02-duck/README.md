<!-- Author: GPT-6 / Codex; Date: 2026-11-02; PURPOSE: reproduce and maintain the Duck feature; SRP/DRY: source map and editorial handoff, not another copy of the story. -->

# The Duck That Launched a Thousand Ships

The feature lives at [its permanent public address](https://arc.markbarney.net/specials/2026-11-02-the-duck-that-launched-a-thousand-ships.html). The news dispatch introduces it and links readers to the interactive page.

Edit `article.template.html`, then run from the repository root:

```sh
python3.13 scripts/build_duck_season.py
python3.13 scripts/build_duck_season.py --check
```

The default build is offline and deterministic. It writes the static article and `client/public/specials/data/duck-season.json`. Its data and script are embedded, so the chart needs no external library or API at reading time. Photographs reuse the public Run Record gallery. The dispatch image is an identical copy under the news image path required by that schema.

`--refresh` explicitly downloads fresh public boards, Tong Hui Kang's history and the official Qwen-author search. Review the resulting dated prose and figures before committing. It sends no messages and performs no Git operations. `--portable --output <path>` embeds the photographs for local review; never send a localhost URL or local HTML file to Discord.

## Evidence and coverage

- `sources/manifest.json` records the endpoints and check time. Compressed snapshots contain public data only.
- Tong Hui Kang's [tracker](https://arc3.huikang.dev/leaderboard/) supplies per-team daily history from March 25. Reconstruction follows the ARC3 repository's `scripts/leaderboard_backfill.py`: carry the last score forward, sort the field and take each cutoff. Missing ranks in very small fields stay missing. Retained departed/merged teams can affect reconstructed counts. These are approximate daily observations, not submission timestamps or joining dates.
- Saved full-field aggregate observations supply ARC3 medal lines from October 4 and the ARC2 sidebar history from October 8. Fixed ranks 10/100/500 use the full per-team reconstruction; no values are invented from the collector's truncated top-team trails. The incomplete current day has no fixed-rank reconstruction.
- Histograms use all rows of each current board, five-point bins `[0,5)` through `[95,100]`. They do not use the reconstructed historical team counts.
- [Franzen's write-up](https://github.com/da-fr/arc-agi-3-solution/blob/main/WRITEUP.md) explicitly credits the Duck, gives the released notebook's 27.89 and describes improvements from successive Qwen models. The equal silver threshold is a historical value, not an adoption fingerprint.
- The [completed public notebook census](../../../../docs/newsroom/2026-11-02-public-notebook-census/README.md) is the sole source for the 300/150 samples. The builder recomputes the printed counts from its committed JSON. Named and inferred evidence remain separate. Current attachments and last-run dates are not publication dates or private submissions.
- Claude's [follow-up checks](../../../../docs/newsroom/2026-11-02-public-notebook-census/CHECKS.md) supply the November 2 Copy & Edit counts: Franzen 2,113, Tamrazov 569 (Franzen with two cells changed). These are copies started, not unique teams or scored submissions. The 185 and 83 daily jumps on October 1–2 were independently reproduced from the frozen tracker here.
- Developer announcements place Qwen 3.8 27B on August 14 and Flash Next on August 26. The August 5 initial Hugging Face repository tree is saved: only README and attributes, not weights. All chart event links and date precision live in the builder/data. Coding-model releases are background context only, with no team adoption attribution.
- Kaggle's September 30 deadline is 23:59 UTC. The simultaneous notebook release and Team Turducken building on Franzen are Mark Barney's firsthand accounts. The Alibaba quotation is approved by him. Tufa's MLST remarks are paraphrased as Barney's recollection, with the listed sponsorship disclosed.
- May 6 and May 8 photo dates are supplied by Barney; both correspond to a 0.28 team best on the public Run Record. The November 2 comparison is 56.02. The builder stops if that score changes so the dated captions get reviewed.

## Editorial boundaries and next update

Cristiano Calcagno receives the idea credit directly under the opening. Mark Barney is disclosed as editor and competitor; Turducken appears in the data. The Run Record is linked, never rebuilt here. No private run notes, descriptions, lab comparisons or removed summit pages belong in this feature.

Refresh after the November 2 23:59 UTC bell, then update the ending and dated figures. The Run Record's own builder remains responsible for its page. Private results require an explicit new comparison, not relabeling these public scores. Qwen 4 is an anticipated, unreleased model at this check; zero notebook mentions are not presented as a finding.

The editor authorized the site commit/push and the rollout-channel post with a public URL and actual photo attachment. X requires his thumbs-up on the proposed picture and wording. No automatic publishing or recurring tasks were created.
