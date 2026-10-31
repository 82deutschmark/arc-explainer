# Research note: the Kaggle submission and capacity crisis, final weekend of ARC Prize 2026

Author: Claude Sonnet 5.5 Medium · 31 October 2026 (read between about 1 pm and 3 pm Eastern; the contest
shows "2 days to go", deadline Monday 2 November 11:59 pm UTC). Written for the Saturday special and for any
later research helper, so nobody has to re-find this. Everything below was read on the public pages
named; attributed paraphrase, short quotes only. Nothing here is a confirmed diagnosis.

## The short version

- **ARC-3** (the one with the Docker/model-server notebooks): many teams could not submit at all in the last
  two weeks. Failures were "Kaggle Error" / "A system error", or runs that finished "COMPLETE" with a **0.00** after
  about half an hour instead of nine hours. Kaggle staff acknowledged "platform issues", cleared a "poisoned cache",
  and said they could not look at individual submissions "due to capacity constraints".
- **ARC-2**: scoring queues of 12+ hours and scores taking 24+ hours, so a last-day submission may never score before
  the close. Kaggle staff declined to change the deadline or the process in the last three days (that reply is
  heavily downvoted).
- **No extension.** Our own edition said so on 30 October (`2026-10-30-special-arc-deadline-no-extension`).
- **CPMP (Jean-François Puget, `cpmpml`, @JFPuget) is the loudest, sharpest voice**, on both Kaggle and X. See below.
  He is on NVARC3 in ARC-3 and on nvbanana in ARC-2, so he has skin in both fights.

## What CPMP actually said (primary sources)

Kaggle, ARC-3 thread "Model mount error." (`.../arc-agi-3/discussion/752147`, posted about 23 Oct, 17 votes):
- Reported that submitting gave an immediate error, and that saving the notebook failed roughly two times in three
  with the same error: `ERRORED_MOUNTING_DATASET ... retry budget exhausted (30 attempts)` on a **Kaggle Models**
  mount. His line: "I am demanding a submission back."
- To Kaggle's engineer: he saved the notebook six times, every failure a mount failure, and submitted anyway "hoping to
  get the 1/3 chance of getting through. I didn't. We can't work that way."
- Kaggle staff (Dustin) replied that leftover "poisoned cache entries" in one region were cleared and the cache was
  being defragmented. CPMP's follow-up: will you rescore that one?
- He also kept a user honest: when another competitor described slow loading, CPMP replied that he was discussing
  something different, a failure that "happens before any loading".
- He had earlier threads on the same board: "Dataset error" (747438), "How come D Franzen score does not appear on LB?"
  (746010). On ARC-2 he asked whether dataset download time counts against the run (750234).

Kaggle, ARC-3 thread "Scoring 0 possibly due to dataset loading issues" (`751598`, 90 comments): he asked, about four
days before this note, whether extending the competition was being discussed ("many teams lost submissions repeatedly";
13 votes). Teammate "ivan" (8th, almost certainly Ivan Sorokin, `sorokin`; display "ivan" only, not confirmed) asked why
Kaggle did not freeze the platform instead of "silently" fixing it. Son Pham (4th) suggested reruns or a freeze.

Kaggle, ARC-3 thread "Is everything back to normal" (`753843`): Jeroen Cottaar (Tufa Labs, 2nd) reported that every
submission seemed to lose about 40 minutes to a late notebook start that still counted against the nine-hour budget;
CPMP replied that a delay before a notebook runs "is not uncommon" and asked whether he was describing something else.
Cottaar answered with an empty-notebook experiment. Yi-Chia Chen (1st) said her scores were fluctuating and she could
not tell infrastructure from ordinary variance. Treat Cottaar's 40 minutes as his team's probing, not a confirmed fault.

Kaggle, ARC-2 thread "Scoring 24h+ - proposal if delays persist" (`.../arc-agi-2/discussion/753723`): masspeaks proposed
a fixed selection window after the deadline for submissions made 12 hours or more before it. CPMP (then 3rd) backed
a **fixed** window and listed two flaws in "close when the last score lands" (nobody knows when it ends; the team with
the last scored submission has no time to choose). Kaggle staff (María Cruz) said no change to the deadline or process in
the final three days. Chan Kha Vu (V | A | M, then 9th) replied that with queues of 12+ hours and 24+ hour scoring "last
day submission is invalid" and that the team was not asking for more submissions, only time to choose.

X, @JFPuget, 31 October:
- Quote-posting our own **@82deutschmark "No extension"** item: "The ARC AGI competitions on @kaggle turned into a circus as
  most teams can't submit in ARC3, and scoring taking more than 24 hours on ARC2." He added that people who do submit see
  big running-speed differences and large score swings, and that he had never seen the Kaggle platform "so bad" since
  he started. (`https://x.com/JFPuget/status/2116495385858277754`; about 3,000 views when read.)
- His theory, stated in replies and **his own, not confirmed by Kaggle**: the compute shortage on ARC-2 comes from the
  new Gemma competition starting on the same L4 GPU pool before ARC-AGI-2 ended; ARC-3's trouble is storage, "probably
  due to the very large number of flash next variants used by candidates"; the root cause is a competition starting
  before ARC-2 ended; "nor the storage, nor homogeneous compute fleet" was his reply when Jack Cole (@MindsAI_Jack)
  said Kaggle probably "just don't have the GPUs". On whether swings reorder the leaderboard: "We'll know after deadline
  when people will report swing between private and public leaderboards."
- He answered our own account directly: "gemma comp on same L4 pool is a simpler explanation" than agents causing the
  load, adding that if agents were the issue every competition would be hit.
- Kaggle's side, from Kaggle staff Walter Reade (@WalterReade) in the same thread: resource use across Kaggle is up
  roughly two to three times since the ARC competitions launched, which he attributed to agents lowering the barrier
  to entry and to competitions getting more complex. (Read from the thread preview; open the post for his full wording.)

## The two stories side by side

| | ARC-2 | ARC-3 |
|---|---|---|
| Symptom | scoring queue 12h+, scores 24h+; last-day submissions may not score before the close | submissions erroring, or "COMPLETE" with 0.00 after about 30 minutes; saves failing on model mounts |
| Kaggle's answer | no change to deadline or process | acknowledged platform issues, cleared poisoned cache, cannot investigate individual runs |
| What teams ask | fixed selection window after the close; rerun of final picks | rerun or restored slots for the 0.00 runs; some ask for a freeze or extension |
| CPMP's read | GPU shortage; Gemma competition on the same pool | storage trouble; too many large-model variants |

Wider ask by many competitors (not CPMP alone): extension, or at least guaranteed scoring and a fixed selection window.
Counter-voices exist: one competitor argued that rerunning only the 0.00s would be unfair because all runs lost time.

## Who is on which side of the argument (the Marvel/X-Men angle, handle with care)

This is not good versus evil. It is **a field of rivals, all furious at the same landlord**, who still disagree on cause
and remedy.
- The **NVIDIA crew** (CPMP, Darragh, Giba, Ivan Sorokin and Elad Sarafian, Gal Kaplun, Yeyin Zhu): the loud public critics, with a
  worked theory. Their ARC-3 team NVARC3 sat eighth at the Saturday snapshot.
- **Tufa Labs** (Cottaar, Viel, Smit, Pressman, per the Tufa team page) and **Yi-Chia Chen**: first and second on ARC-3; they are
  probing the infrastructure and warning of variance rather than shouting.
- **Team Turducken** (ours: Son Pham 4th on ARC-3 in one thread; the Boss) lost a score to a 0.00 and asked for reruns. The desk should
  disclose that connection when covering the dispute.
- **V | A | M** (Chan Kha Vu, Anastasia, Manh Nguyen): ninth in ARC-2; Chan, in the thread, fighting for the last-day submissions.
- **Kaggle staff** (María Cruz, Dustin, Walter Reade) and **ARC Prize** (Greg Kamradt, @arcprize): not villains; stretched.

Rule: attribute every cause to the person who said it. Nobody here has proved a cause.

## V | A | M teammates (Kaggle pages, read 31 Oct)

- **`nguyennguyen599` ("Nguyen")**, probable X **@nguyen_manh599** (Manh Nguyen). Kaggle Competitions Expert, rank 1,165 of 225,015
  (highest ever 575), 19 competitions, joined about a year ago. Best finishes shown: **1st of 1,075 at WiDS Datathon 2025**
  (community), **2nd of 6** at AIMO Proof Pilot (community), 22nd of 1,282 at Make Data Count, 24th of 617 at the Konwinski Prize,
  124th of 1,120 in the FIDE and Google Efficient Chess AI Challenge, 146th of 1,455 in ARC Prize 2025. Followers include
  Yi-Chia Chen. Active: ARC-AGI-2 only.
- **`arazzd` ("Anastasia")**, probable X **@razdaibi** (Anastasia Razdaibiedina, arazd.github.io). Her X bio (31 Oct): research
  scientist at Google DeepMind, PhD from the University of Toronto, formerly Meta AI, "efficient ML, data, lifelong learning, AI
  agents". Kaggle: a quiet account joined about seven years ago, three competitions, one finished (Ion Switching, 828th of 2,618),
  and **active in both ARC-AGI-2 and ARC-AGI-3**. Careful: an ARC-3 entry on her profile is not an ARC-3 team on our board; V | A | M is
  recorded in ARC-2 only.
- **Chan Kha Vu (`chankhavu`)**: already on his card; 9th in ARC-2 in the Saturday thread; he had posted the 50-to-76 climb on 30 Oct
  and tagged both teammates and @kaggle.
- Both X-to-Kaggle matches are **probable, not confirmed** (see `content/news/handle-candidates.json`). Do not print the pairing as
  fact, and do not state a teammate's employer as part of the team.

## Leads the next researcher should follow (not done)

1. The ARC-2 and ARC-3 official host posts after 28 October (open ARC-AGI-2 `753659` and `753315`; read María Cruz's full replies).
2. Whether CPMP's Gemma-pool theory is supported or answered by Kaggle staff; read Walter Reade's whole reply on X.
3. Chris Deotte (`cdeotte`) and Giba (`titericz`) are on NVIDIA's Grandmaster team and appear unmapped in the crosswalk; verify before using.
4. After the deadline: private-versus-public board swings (CPMP's own test of the "lucky node" theory).
