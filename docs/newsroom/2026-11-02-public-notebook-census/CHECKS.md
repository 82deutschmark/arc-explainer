<!--
Author: Claude Opus 5.5
Date: 02-November-2026
PURPOSE: A sceptical check of the wrap-up's strongest claims, with the wording an honest article can use. Our internal lab figure in it needs the Boss's approval before printing.
SRP/DRY check: Pass - the check only; the census itself is in README.md beside it.
-->

**Scepticism check of the Qwen story. Re-derived 2 Nov about 05:40 UTC from saved files, plus one live check of Hugging Face, OpenRouter and five Kaggle pages. Nothing downloaded was run.**

Scripts are in `/private/tmp/claude-501/-Users-macmini-GitHub-arc-3--claude-worktrees-competent-mcnulty-6c57d4/f9f7ba86-12a5-44f9-ae2e-a5a342412475/scratchpad/wrapup/check/`.

**Verdicts at a glance**

| Claim | Verdict |
|---|---|
| Most teams run Qwen 3.8 27B or Flash Next | Wrong for teams; holds for public ARC-3 notebooks that name a model |
| Public notebooks represent the top teams | Wrong |
| Franzen's notebook is the source of the ARC-3 pile | Holds as the main public door; wrong as a score fingerprint |
| Teams jumping into the pile copied a notebook | Holds for the crowd; weak for any single team |
| Qwen 4 was not released | Holds, with a timestamp |
| The biggest step came with no new model | Holds; share of credit unknown |

**1. "Most teams run Qwen 3.8 27B or Flash Next": wrong for teams, holds for public ARC-3 notebooks that name a model**
- **Deciding fact:** on the 2 Nov 04:43 UTC ARC-3 board, 2,005 of 5,037 teams (40%) score under 0.5 and 49% score under 2. Those scores sit at or near the official sample's 0.25 (seen on its page).
- **Other board counts:** 2,520 teams (50%) reach 2.5 or more, and 2,045 (41%) reach 25 or more.
- **Inference:** the best public 27B score I have on ARC-3 is 3.11 (Models tab, read 2 Nov), so the 25-plus crowd probably runs Flash Next. No file names a model for any of those teams as a group.
- **27B and Flash Next should not be merged.**
  - Of the 83 notebooks last run since 1 Sep and not filed as empty, opaque or off-topic, Flash Next has 70 and 3.8 27B has 5.
  - Those 70 come from about two recipes, so they are not 70 separate decisions.
  - In the 800 ARC-3 notebooks outside the census, titles lean the same way: 24 mention flash, next or nvfp4, and 8 mention 27B. This is a title scan only.
- **ARC-2 fails separately:** the public recipe is a fine-tuned Qwen 3 4B. 891 of 3,593 teams sit at exactly 0, and the top teams' models are unknown.
- **Article wording:** "Among public ARC-3 notebooks that name a model, Flash Next has been the clear favourite since September. About half the board scores too low to suggest any of this, and what most teams actually run is not public."

**2. "Public notebooks represent the top teams": wrong**
- **Deciding fact:** the best public score I have is 35.35, and 78 teams are in or above the 35 band (69 at 35 to 50, 9 at 50-plus). No public notebook reaches rank 1's 75.56.
- **Join of team member names to census notebook owners (top 300 notebooks by votes):**
  - Top 20: 6 teams have a censused notebook owner, 3 of them a Flash Next one (Turducken, ARChitects, rellik13).
  - Top 50: 5 have a Flash Next owner.
  - Ranks 1, 3 and 4 have no censused notebook owner at all.
- **Published notebooks go stale:**
  - Tufa's public notebook is the June 3.6 27B one, but Cottaar's post mentions a 100.5 GiB checkpoint.
  - Murad's public notebook is Gemma, while his team now scores 39.52.
- **The pile is not represented either:** only 73 of 1,967 pile teams own a censused notebook. Public notebooks show the source people copied, not a sample of the teams.
- **Article wording:** "Public notebooks show what was available to copy. No public notebook gets near the top of the board, and the leaders' current models are not public."

**3. "Franzen's notebook is the source of the ARC-3 pile": holds as the main public door, wrong as a score fingerprint**
- **Deciding fact, Copy & Edit counts read 2 Nov:**

| Notebook | Copies started |
|---|---|
| Franzen | 2,113 |
| Lord Han Solo | 77 |
| rellik13 | 39 |
| Tamrazov | 569 |
| Keith (earlier wave) | 290 |
| heliosli | 167 |

- Tamrazov's copy is itself Franzen's notebook with two cells changed. heliosli's notebook is in the Flash Next group, but I did not check its lineage.
- These counts are copies started, not submissions, and one person can start many. Franzen's notebook also carries Tufa's Duck inside it.
- **What the score says:**
  - First landings at 20 or more since 1 Oct: 2,318, median 26.28, spread (standard deviation) 2.83.
  - 71% land below 27.89, and 0.35% land above 33.68.
  - That median stays near 26 from 1 Oct through late October, with a dip to about 25.2 in the last days sampled.
  - So the pile does not sit on his score, and the score cannot separate him from the other two notebooks.
- **Article wording:** "Franzen's notebook, built on Tufa's Duck, was by far the most copied door into the pile. Scores alone cannot prove which notebook any team used."

**4. "Teams jumping into the pile copied a notebook": holds for the crowd, weak for any single team**
- **Deciding fact:**
  - There were zero jumps from under 10 into 25-to-35 before 30 Sep.
  - Then 3 on 30 Sep, 185 on 1 Oct and 83 on 2 Oct; 892 in all on my per-day recount (the earlier report said 897).
  - Only 15 teams sit between 5 and 10 today, so the board has a real gap rather than a slope.
- **Two different waves (entries are all-time totals):**
  - Landers on 1 to 2 Oct: median 31 entries, only 12 with 2 or fewer. These are experienced teams, 20% with more than one member, not fresh copiers.
  - Landers on 23 to 29 Oct: median 5 entries, 85 with 2 or fewer.
  - Overall, 358 of 2,253 landers still on the board have made 2 or fewer entries ever. That suggests they arrived with something finished.
- **Rivals not excluded:** private sharing, or building from the write-ups rather than copying the file. No data links any team to a notebook.
- **Article wording:** "Hundreds of teams leapt from single digits to the high twenties within days of the Milestone 2 solutions going public, and nothing like it had happened before. The timing points to shared public methods, but we cannot say how any particular team got there."

**5. "Qwen 4 was not released": holds, with a timestamp**
- **Deciding fact, live at 05:40 UTC on 2 Nov:**
  - The newest repo in the Qwen Hugging Face organisation is an image model from 9 Oct.
  - OpenRouter lists no Qwen 4 among 452 models.
  - No title in any of the 1,100 ARC-3 and 651 ARC-2 listings mentions it.
- **Limits:**
  - Attachments were read only for the top 300 and 150 notebooks.
  - I cannot see private models.
  - Curl of qwen.ai/research returned a junk keyword page, so I could not re-verify the Qwen index.
  - The "next week" window is open and the contest closes 23:59 UTC. Recheck immediately before publishing.
- **Traps that are not releases:**
  - IteraCompute/Qwen4-27B-NVFP4 and Harsha001/Qwen4-Flash-Next-ROCmFPX are third-party names; I did not open them.
  - stealth-model repos and hf-tiny-v2 Qwen4Exp test repos are not Qwen releases either.
  - Qwen4Exp is Flash Next's architecture tag (Hugging Face tag and the Qwen post), and rellik13's serving code uses it.
- **Article wording:** "As of early 2 Nov UTC, Qwen had published no Qwen 4 weights. Flash Next, which Qwen described on 26 Aug as an early preview of the architecture, is as close as the field got."

**6. "The biggest step came with no new model": holds, share of credit unknown**
- **Deciding fact:** rank 250 went from 4.31 on 30 Sep to 24.25 on 1 Oct, then 29.49 on 5 Oct, with no new weights since 26 Aug.
- **Flash Next existed before the pile did, but that does not make the model irrelevant:**
  - After 1 Oct, 146 new personal bests still landed between 1 and 10, median 3.51, so the older setups kept scoring low.
  - Our own lab note has Flash Next at 18.01 and 3.8 27B at 2.67 on one harness, one roll each. That points to a large model effect too. It is internal, so get approval before printing it.
- **Article wording:** "A better model made the leap possible, and shared engineering delivered it to the crowd. No source separates the two."

**Rival explanations tested**
- **Mass rescoring in October: refuted.**
  - On 30 Sep, 3,545 teams were under 10.
  - Only 332 changed on 1 Oct.
  - 2,318 hold the identical score today.
  - All score drops fall in May and June, mostly 5 to 11 Jun, which fits Tufa's retraction story. The June cause is otherwise unconfirmed.
- **Scoring change for new submissions only: not supported.** The 146 new bests above stay near old levels, and top teams were already climbing before 30 Sep (Tufa 45.33 on 29 Sep). This is indirect, and no rules page was checked.
- **Retries: real inside the pile, not the way in.**
  - Landing median is flat across entry bands (26.45, 26.18, 26.52, 26.30, 26.04, 26.20), which removes much of the skill confound.
  - Current median rises from 26.91 at 1 to 2 entries to 31.53 at 51-plus.
  - My rough maths: 50 draws with a spread of 2.83 would give about 32.7, so pure re-rolling could explain the climb within the pile.
  - Reaching 35-plus (0.3% rising to 11.2% across those bands) exceeds my rough estimate for re-rolling alone, so some real work is likely above the pile.
  - Entries cannot separate retries from small tweaks.
- **Sample notebooks: they explain the bottom, not the pile.** 1,609 teams are at or below 0.25. Only 53 sit at exactly 0.25, so this is not one notebook's fingerprint.
- **Mergers: small.**
  - 175 team IDs vanished, 103 of them last seen in October.
  - 38 were last seen on 24 to 25 Oct, which looks like a merger deadline. I did not find that date, and bans or deletions are also possible.
  - 67 of the vanished had 20 or more. Against 2,253 landers this is a side effect, but it does affect single-team stories such as the 26 Oct ARChitects jump.

**Corrections to the reports**
- **Pile size:** 1,967 on the 04:43 board; the monitor file gives 1,969 of 5,041, and the report said 1,966.
- **Monitor rank field:** the history's second field is rank, not entries, so it cannot test score changes against new entries. My first rescoring test was invalid and I discarded it.
- **Tufa's "incredible":** still unfound. The 3.6, 3.8, Flash Next progression is Franzen's account, not Tufa's.
- **Do not print without the Boss's approval:** our submission log entries and the lab results.

**Three biggest unknowns, cheapest way to find each**
1. **What the top teams run now.** Read the write-ups after the close (Cottaar promised Tufa's final solution then). Before that, the only route is someone asking them directly.
2. **How many pile teams really ran Franzen's weights rather than a rival's.** Read the download counts on the mirrors of Franzen's, Lord Han Solo's and rellik13's weights, about three Kaggle pages. Downloads are not teams, but they count runs better than copies do.
3. **How much the same notebook varies run to run.** This decides how much of the pile's width and climb is just luck.
   - Cheap first pass: read the per-version scores on Tamrazov's 86-version page.
   - Proper test: resubmit one unchanged version several times after the close, if late submissions are allowed. That needs the Boss's go-ahead.
