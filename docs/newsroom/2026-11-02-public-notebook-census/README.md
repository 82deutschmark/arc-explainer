<!--
Author: Claude Opus 5.5
Date: 02-November-2026
PURPOSE: The public notebook census for the ARC Prize wrap-up: which models the most-voted public ARC-3 and ARC-2 notebooks attach. Evidence for the Daily Digest; read the limits before quoting it.
SRP/DRY check: Pass - one report and its data files; nothing else holds this census.
-->

**Census of public notebooks: which models teams attach (Kaggle, 1 Nov 2026)**

**Bottom line**
- **ARC-3:** the premise holds for public notebooks, and in time order.
  - Duck notebooks from June to August probably ran Qwen 3.6 27B, but this is mostly inferred.
  - Qwen 3.8 27B appears from mid-August (named).
  - Flash Next takes over from September: 70 of the 79 LLM notebooks last run since 1 September.
- **ARC-2:** the premise fails. The public field runs a fine-tuned Qwen 3 4B (named, 77 of 150 notebooks, 81% of votes). No notebook attaches Flash Next or a named 3.6 27B.
- **Qwen 4:** no attachment or title in either contest mentions it.
- **Also absent:** Qwen 3.7, Nemotron, GLM and Kimi have no attachments or titles. DeepSeek appears once, a distill model in rudraismewhocodes/sita-ram (3 votes).
- **What this can't show:** what private top teams run, or whether "pretty much every team" is true.

**Scope (observed, Kaggle CLI, 1 Nov 2026)**
- **ARC-3:** top 300 by votes of 1,100 listed. They hold 11,201 of 12,162 votes. The 1,100 is suspiciously round, and the list may be capped.
- **ARC-2:** top 150 of 651 listed, holding 5,179 of 5,670 votes.
- **Fetches:** all 450 metadata pulls worked, with no rate limits. Three notebooks appear in both contests.
- **Code:** the CLI's metadata pull also writes the notebook file. I deleted each one unread, so 0 remain. Nothing downloaded was run.

**Limits on all of this**
- Metadata shows each notebook's current attachments only.
- lastRunTime is the last run, not the publication date, and some are UTC dates that read 2 Nov.
- Votes favour old and official notebooks.
- Public notebooks are not what private teams submit.

**Matching rules**
- **Where:** I matched on the name after the owner, across model, dataset and kernel sources.
- **Decimals:** names flatten them, so qwen3-8-27b counts as 3.8 at 27B, while qwen3-8b counts as Qwen 3 at 8B.
- **Flash Next:** any Qwen name with flash or next, or a bare flashnext (one dataset, swift15-flashnext, which holds weight files and a Qwen licence).
- **Named:** weights are named in a model source or a weights-like dataset.
- **Runtime names:** datasets named runtime, smoke, serving, vllm, sglang, wheel or bundle do not count as weights.
- **Off-topic:** a hand-written name filter (image, retrieval, translation data), and it is imperfect. For example, xvmhieu/llmembed-reproduction-baselines-table2 slipped through as Llama.
- **One label per notebook:** tables (a) and (b) assign one each. census_tally.json has the version that counts a notebook once per model.

**Blank attachments change the reading**
- **Observed:** an empty list and a list containing a blank string are different things. ARC-3 has 27 notebooks with a blank model and 59 with a blank dataset. ARC-2 has 2 and 10.
- **Tufa's June 30 notebook:** the API now returns two blanks. Our repo copy (kaggle/kernel-metadata.json, committed 11 Jul 2026) names driessmit1/vrfai-qwen3-6-27b-fp8-hf-snapshot and a wheelhouse in those places. The notebook's own text names vrfai/Qwen3.6-27B-FP8.
- **Cause not proven:**
  - Those two driessmit1 datasets are still listable today, with files dated 5 Oct, so private isn't the explanation there. A replaced version is my guess.
  - keithtyser/qwen3-8-flash-next-nvfp4 returns 403 while two control models return data, so that one looks private or removed.
- **Consequence:** a Qwen 3.6 27B count of zero by name would be false.

**(a) and (b) ARC-3, 300 notebooks, 11,201 votes.** The last column drops the three official samples (1,650 votes).

| Model | Notebooks | Named / inferred | Authors | Votes | Vote % | % without samples |
|---|---|---|---|---|---|---|
| Qwen 3.8 Flash Next | 70 | 49 / 21 | 56 | 4,265 | 38.1 | 44.7 |
| Nothing attached | 114 | n/a | 80 | 3,657 | 32.6 | 22.4 |
| Duck, weights unnamed (likely 3.6 27B) | 27 | 0 / 27 | 21 | 1,424 | 12.7 | 14.9 |
| Qwen 3.8 27B | 19 | 17 / 2 | 19 | 774 | 6.9 | 8.1 |
| Opaque attachments, no model name | 29 | n/a | 21 | 405 | 3.6 | 2.9 |
| Gemma 4 31B | 7 | 7 / 0 | 7 | 277 | 2.5 | 2.9 |
| Off-topic work | 18 | n/a | 16 | 145 | 1.3 | |
| Duck, 3.6 or 3.8 unresolved | 4 | 0 / 4 | 4 | 142 | 1.3 | |

- **The remaining 12 notebooks:**
  - Qwen 3 4B: 2 notebooks.
  - One each: gpt-oss, Llama, Qwen 2.5 7B, 2.5 3B, 2.5 32B, 3.1 7B, 3 30B, 3 1.7B and 3.6 35B.
  - One hidden model of unknown family.
- **Qwen share:** 139 notebooks show an LLM, named or inferred. 129 are Qwen, and 120 are the Flash Next, 3.8 27B and duck groups.
- **The 27 likely-3.6 notebooks are weak evidence:**
  - Only 1 has a direct record, and only 2 titles say 3.6 (yw8837, tanakaai24).
  - 13 share Tufa's exact attachment set, and 19 use a jeroencottaar bundle.
  - Do not print 27 as a 3.6 count. nihilisticneuralnet/arc-agi-3-qwen3-8-27b-bf16 has that same bundle and its title says 3.8.
- **The 21 inferred Flash Next notebooks are better grounded:**
  - All have a blank model plus Keith's runtime, qwen38-flash-next-vllm-nvfp4-runtime-v1.
  - Our repo's records pair that runtime with Keith's Flash Next model (kaggle/experiments/sparse-deletion, committed 16 Sep 2026).
  - 11 titles mention flash, next or nvfp4; 9 mention 3.8.
  - Still inferred, because no weights are named.
- **Harness bundles:** the taaf bundles and pennyroyal-v253 look like code and wheels from their file names, with no weights visible. Their file lists were read only up to the first 200 entries.
- **Gemma 4:** titles hint it did well in Milestone 1 (ruichardliu/milestone1-2nd-solution, mbmmurad's 3rd-place candidate). That is title evidence only.

**(a) and (b) ARC-2, 150 notebooks, 5,179 votes (all named, no inference)**

| Model | Notebooks | Authors | Votes | Vote % |
|---|---|---|---|---|
| Qwen 3 4B | 77 | 57 | 4,206 | 81.2 |
| Nothing attached | 50 | 39 | 505 | 9.8 |
| Qwen 3.8 27B | 7 | 6 | 166 | 3.2 |
| Opaque attachments | 6 | 5 | 121 | 2.3 |
| Qwen 3 2B | 3 | 3 | 95 | 1.8 |
| Qwen 3 1.7B | 2 | 1 | 46 | 0.9 |

- **The remaining 5 notebooks:** one each of gpt-oss, Qwen 2.5 7B, Llama, Qwen 3.6 35B, and a hidden model.
- **Counting each notebook once per model:** Qwen 3 4B rises to 81, gpt-oss to 2 and Qwen 3.6 35B to 2. Qwen 3.5 4B has 1 and Qwen 3 8B has 1.
- **Where it comes from:** sorokin/qwen3_4b_grids15_sft139 alone is in 75 notebooks from 59 authors. Many titles mention NVARC or last year's winning solution, so I infer the public field is copying that recipe.

**(c) By month of lastRunTime, ARC-3** (a recent run does not mean a recent adoption)

| Month | Flash Next | 3.8 27B | Duck, likely 3.6 | Duck, unresolved | Gemma 4 | Other LLM | Nothing | Opaque, off-topic or hidden | Total |
|---|---|---|---|---|---|---|---|---|---|
| Mar | 0 | 0 | 0 | 0 | 0 | 0 | 28 | 4 | 32 |
| Apr | 0 | 0 | 0 | 0 | 0 | 1 | 18 | 4 | 23 |
| May | 0 | 0 | 0 | 0 | 0 | 1 | 19 | 5 | 25 |
| Jun | 0 | 0 | 1 | 0 | 3 | 2 | 20 | 7 | 33 |
| Jul | 0 | 0 | 19 | 0 | 3 | 2 | 7 | 6 | 37 |
| Aug | 0 | 14 | 6 | 4 | 0 | 3 | 3 | 7 | 37 |
| Sep | 21 | 4 | 1 | 0 | 1 | 0 | 10 | 4 | 41 |
| Oct | 46 | 1 | 0 | 0 | 0 | 2 | 9 | 10 | 68 |
| Nov | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 4 |

First and last run dates:
- **Likely 3.6:** 30 Jun to 7 Sep.
- **3.8 27B:** 15 Aug to 22 Oct.
- **Flash Next:** 1 Sep onward.

**By month, ARC-2** (Qwen 3 4B / 3.8 27B / nothing / other)
- Mar: 3 / 0 / 14 / 4
- Apr: 17 / 0 / 10 / 1
- May: 3 / 0 / 4 / 2
- Jun: 4 / 0 / 4 / 2
- Jul: 14 / 0 / 6 / 1
- Aug: 12 / 1 / 0 / 0
- Sep: 6 / 1 / 2 / 4
- Oct: 17 / 5 / 10 / 2
- Nov: 1 / 0 / 0 / 0

**(d) kernel_sources: a correction to the brief**
These are not fork parents. They are notebooks whose output is mounted as input, and going by their names they are mostly install helpers. Metadata does not record who a notebook was forked from.
- **ARC-3:** only 21 of 300 have any.
  - philipvonderlind/vllm-deps: 8 notebooks.
  - mbmmurad/vllm-0-23-0-tf5-wheelhouse: 3.
  - Blank: 3.
  - Everything else: 2 or fewer.
- **ARC-2:** 80 of 150 have any.
  - sorokin/pip-install-unsloth-flash-patch: 72 notebooks, 56 authors.
  - mirzamilanfarabi/qwen3-4b-grids15-sft139: 4.
  - konstantinboyko's unsloth patch: 2.
  - mirzamilanfarabi/pip-install-unsloth-flash-patch: 2.
  - Blank: 2.

A better copying measure is notebooks with an identical set of attachments:

| Contest | Recipe | Notebooks | Authors | Votes | Top notebook |
|---|---|---|---|---|---|
| ARC-3 | Daniel Franzen Flash Next | 43 | 36 | 2,769 | dfranzen/arc-agi-3-milestone-2-solution |
| ARC-3 | Keith Flash Next (blank model) | 20 | 17 | 1,277 | wuliao0/duck-qwen3-8-anim-base |
| ARC-3 | Tufa share bundle plus 2 blanks | 13 | 11 | 890 | jeroencottaar/tufa-labs-duck-harness-june-30-milestone-winner |
| ARC-3 | Tufa source bundle plus 2 blanks | 6 | 6 | 389 | jeroencottaar/taaf-duck-harness-kaggle |
| ARC-2 | sorokin fine-tune alone | 56 | 46 | 3,540 | koushikrudra/failed-in-aimo |

So 69 of the 70 Flash Next notebooks trace to two recipes: Daniel's 46 and Keith's 23, counting near-matches. Treat that as one or two adoption decisions copied many times, not 70 independent ones. There are 77 distinct attachment sets in ARC-3 and 33 in ARC-2. Our own best notebook's repo metadata attaches Daniel's two models, which is one data point about a non-public team. It's internal, so don't print it without the Boss's approval.

**(e) Top 25, ARC-3** (votes, last run, model; "inferred" means no weights named)
1. dfranzen/arc-agi-3-milestone-2-solution: 1191, 3 Oct, Flash Next
2. inversion/arc3-sample-submission-random-agent: 768, 24 Mar, nothing
3. inversion/arc3-sample-submission-stochastic-goose: 751, 24 Mar, nothing
4. jeroencottaar/tufa-labs-duck-harness-june-30-milestone-winner: 396, 1 Jul, Qwen 3.6 27B (direct record)
5. romantamrazov/the-agi-boys-i-am-better: 391, 21 Oct, Flash Next
6. foysalemonshanto/lb-9-arc3-duck-v12-with-qwen-3-8-27b: 297, 18 Aug, 3.8 27B
7. wuliao0/duck-qwen3-8-anim-base: 294, 18 Sep, Flash Next inferred
8. jeroencottaar/taaf-duck-harness-kaggle: 268, 30 Jun, likely 3.6 inferred
9. boristown/agi-duck-harness-fast-eval: 265, 22 Jul, likely 3.6 inferred
10. ashvinsingh/ash-s-arc-agi-3-agent: 242, 10 Jun, nothing
11. chiakazirim/duck-qwen3-8-tuned: 220, 4 Sep, Flash Next inferred
12. keithtyser/duck-qwen3-8-flash-next-nvfp4-mtp: 212, 1 Sep, Flash Next inferred
13. scottlegrand/taaf-flashnext-sheetu12b-0922: 197, 22 Sep, Flash Next inferred
14. projectforty2/forge-arc-agi-3-agent: 167, 31 Mar, nothing
15. nihilisticneuralnet/0-46-arc-agi-3-persistent-memory-bfs-arc-solver: 153, 29 May, nothing
16. rokaiyasomapti/taaf-duck-harness-kaggle-share-resubmission: 152, 5 Jul, likely 3.6 inferred
17. jingshuifu/arc3-m2-solution: 139, 11 Oct, Flash Next
18. inversion/arc3-sample-submission-just-explore: 131, 24 Mar, opaque, no LLM named
19. heliosli/try-merging-it-you-might-get-lucky-and-win-gold: 129, 26 Oct, Flash Next
20. jeroencottaar/simplified-submission-approach: 122, 2 May, nothing
21. jakobbrggen/taaf-anim-arc-agi-3-solver: 121, 7 Aug, duck, unresolved
22. romantamrazov/arc-real-agi-solution: 111, 29 Aug, 3.8 27B
23. vickyfym/arc-agi-3-lalalia-final: 107, 24 Oct, Flash Next
24. pscamillo/arc-prize-2026-arc-agi-3-starter: 107, 3 Jul, nothing
25. keithtyser/duck-qwen3-8-27b-fp8: 106, 17 Aug, 3.8 27B

**Top 25, ARC-2** (Qwen 3 4B unless noted)
1. koushikrudra/failed-in-aimo: 1080, 3 Aug
2. chiakazirim/learned-from-aimo: 260, 11 Jul
3. mikelou1/arc-agi2-lb33-89-minimal-perfpatch: 234, 14 Jul
4. nihilisticneuralnet/baseline-nvarc-arc-25-winning-solution-for-t4x2: 230, 3 Apr
5. yiheng/reproduce-nvarc-2025-results: 191, 8 Apr
6. junaid512/arc-agi-31-11: 152, 29 Oct
7. evgendvorkin/arc-2-2026-6-6-local-boyko-nvarc: 138, 1 Nov
8. koushikrudra/arc-agi2-original-kg: 132, 2 Sep, plus gpt-oss
9. luxluxshan/arc2-nvarc-v1: 122, 8 Sep
10. yusuketogashi/arc-baseline-rebuild: 111, 13 Oct
11. rokaiyasomapti/reproduce-nvarc-2025-results: 95, 31 Jul
12. albartrose/nvarc-winning-2025-for-2xt4s-best-score-19-17: 83, 7 Apr, plus Qwen 3 2B
13. pragnyanramtha/11-25-lb-5: 77, 6 Apr
14. baidalinadilzhan/prev-year-s-compressarc-method-p100-gpu-lb-1-67: 75, 27 Mar, no LLM named
15. mirzamilanfarabi/arc-2-2026-qwen3-unsloth-mar-26: 69, 27 Mar
16. sigmaborov/arc-agi-2-baseline-starter: 67, 25 Mar
17. woguoat/arc2-nvarc-full-cost-sota-triple-pass: 62, 23 Oct
18. qiuqiuh/arc-highscore-lb3389-replica: 62, 23 Sep
19. kaiserm/nvarc-winning-solution-2025-4xl4s: 61, 8 Apr
20. fayche/arc-prize-2026-solver: 59, 27 Aug
21. christopherdaleman/arc-2026-nvarc-trm-evidence-cost-v1: 56, 24 Jul
22. foysalemonshanto/arc-2026d: 54, 26 Apr
23. madarshbb/arc-qwen-3-8-27b-agent: 51, 9 Oct, Qwen 3.8 27B
24. karnakbaevarthur/logic-profiler-for-each-task: 48, 26 Apr
25. dajaistewart/twin-lb33-verbatim: 44, 8 Aug

**Could not find**
- What fills the blanks in general, or why they are blank.
- The contents of Keith's runtime image. Its file names are opaque container layers, so I can't say whether weights are inside.
- The real weights behind the 4 unresolved duck notebooks.
- True fork parents.
- Any link between a model and a score: this census has no scores in it.
- Release dates for the models, which this step did not look up.

**Extra read-only lookups, all one at a time**
- File-name lists for 16 datasets.
- 3 model lookups.
- Reading our own repo's metadata records and one line of the Tufa notebook copy.

Files are in /private/tmp/claude-501/-Users-macmini-GitHub-arc-3--claude-worktrees-competent-mcnulty-6c57d4/f9f7ba86-12a5-44f9-ae2e-a5a342412475/scratchpad/wrapup:
- census.json
- census_tally.json
- census_lineage.json
