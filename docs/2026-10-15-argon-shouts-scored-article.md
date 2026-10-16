<!--
Author: Claude Opus 5.5
Date: 2026-10-15
PURPOSE: Manuscript for the ARC Daily Digest dispatch "We Followed Every Time Gemini 4 Argon Said It Had Cracked
  the Game" (content/news/dispatches/2026-10-15-gemini-4-argon-shouts-scored.json), commissioned by Mark Barney as
  an in-depth follow-up to 2026-10-15-gemini-4-argon-mind-blown that leads with the funny lines and answers one
  question: when Argon shouts MIND BLOWN, how often does it then beat the level, and how often does it flail?
  Every quote carries a tag [argon <config> <session> step N] so data/argon-vs-haiku/verify_quotes.py can check it
  against the transcript; data/gemini-4-argon-traces/build_shouts_dispatch.py strips the tags (and the model's
  markdown backticks and bold marks) to make the dispatch. Numbers come from outburst_outcomes.py.
SRP/DRY check: Pass -- reuses the transcripts, the quote checker and the 25-game read
  (docs/2026-10-15-what-the-models-thought-25-games.md) rather than re-reading for those quotes; the outcome
  numbers are new and live only in data/gemini-4-argon-traces/outburst_summary.json.
-->

# “Everything Makes 1000% Sense Now!!” We Followed Every Time Gemini 4 Argon Said It Had Cracked the Game

## Mind blown, then what?

At move 552 of its medium-reasoning run on Skewer Kebabs (sk48), on the last of eight levels, Gemini 4 Argon wrote "EVERYTHING MAKES 1000% SENSE NOW!!" [argon medium e3ab3eb6 step 552] Twenty-eight moves later it was "MIND BLOWN! Let's verify this!" [argon medium e3ab3eb6 step 580] One move after that the recording stops, level 8 unbeaten. Our first dispatch counted the shouting. This one follows it. Across ARC Prize's 150 public Argon replays, the model's answer text says MIND BLOWN 532 times, BINGO 671, WHOA 372 and EUREKA 273. In the standard harness, where the model remembers little beyond what it writes down, 1,224 moves contain at least one of those four. For each, we found the level it was on and what became of that level. About one in six (190) was the last shout before the level fell: the real thing. Nearly half (589) were followed by another shout on the same level before it fell. The other 445, just over a third, came on a level it never beat, though some of those runs were cut short by API errors or move limits rather than lost. Fast payoffs were rare. A MIND BLOWN was followed by a cleared level within ten moves 4.4% of the time, against 13.6% for a move picked at random. EUREKA managed 2.0%. Under Google's Provider Adapter harness, which carries the model's reasoning from move to move, the same shouts land: 56% were the last one it needed, and only 3 of 174 came on a level it never beat.

## 1,183 moves on level 6

Mirror Rendezvous (m0r0) at low reasoning is the loudest run of the 150, and most of the noise is on level 6. Argon spent 1,183 moves there, shouted MIND BLOWN, BINGO, EUREKA or WHOA on 90 of them, wrote "1000%" on 19, and never got out. Early on it wrote out a proof that the level could not be done, then reminded itself: "Every time a mathematical impossibility proof contradicts a solvable puzzle, **one of the assumptions in the proof is FALSE!**" [argon low d8379bc2 step 284] It told itself to "STOP EVERYTHING AND READ THAT TEN THOUSAND TIMES!!" [argon low d8379bc2 step 382] and, later, to "STOP AND APPLAUD THAT DEDUCTION!" [argon low d8379bc2 step 367] At move 617 it ruled out clicking: "almost NO game uses both `ACTION1..4` AND `ACTION6` unless there are buttons on a HUD, and there is no HUD here!" [argon low d8379bc2 step 617] Six moves later it clicked anyway. The click selected the small block the level turns on, and on the next move it was MIND BLOWN. The discovery then went missing from its notes, and at move 869 clicking amazed it all over again: "WHOA!! LOOK AT WHAT `ACTION6 31 43` JUST DID!!" [argon low d8379bc2 step 869] It was startled, more than once, that in a mirror game the two tokens mirror. On 16 moves it asked some version of why it hadn't won. It found someone to blame for the board it had inherited: "Whoever played the first 12 moves before Turn 1 had ALREADY moved `Block A` and `Block B`" [argon low d8379bc2 step 1032]. The someone was Argon, in moves that had scrolled out of its memory. Its last shout, at move 1,424: "IS THAT HOW WE WON LEVEL 5?!" [argon low d8379bc2 step 1424] Eight moves later the game was over, with a "Complete 20-move solution" [argon low d8379bc2 step 1432] in its notes, twelve moves in.

## Eureka, eureka, eureka

The other levels it never beat sound the same. On Deck Control (dc22) at high reasoning, level 6 took the last 313 moves of the run, and 52 of them shouted. "EUREKA!! OH! MY! GOODNESS!!" [argon high 08fc7dc2 step 395] Then "MIND BLOWN!! STOP EVERYTHING AND READ THAT AGAIN!!" [argon high 08fc7dc2 step 537] and, on the very next move, "EUREKA!! EUREKA!! EUREKA!!" [argon high 08fc7dc2 step 538] At move 600: "MIND BLOWN!! HAHAHAHA!!" [argon high 08fc7dc2 step 600] The run stopped on that level at move 698. On Sigil Caster (sc25), stuck on level 5, it announced "EVERY SINGLE MECHANIC OF THE ENTIRE GAME IS NOW 100% UNDERSTOOD!!" [argon medium 47db246e step 144] and, 42 moves later, "BINGO!! EUREKA!! WE COMPLETELY SOLVED THE MECHANIC OF THE ENTIRE GAME!!" [argon medium 47db246e step 186] The run ended on level 5. On Warehouse Associates (wa30), level 5 brought "Everything makes 1000% sense now!" [argon low 5f474a31 step 301], "EUREKA!! EUREKA!! EUREKA!!" [argon low 5f474a31 step 510] and "OH! GENIUS! EUREKA!!" [argon low 5f474a31 step 596], then game over at move 750. On Buoyant Pontoons (bp35), on level 2: "MIND BLOWN! Everything makes 100% sense now!" [argon low c127733d step 217] Game over, 41 moves later. Across the standard runs, a claim that everything makes 100% or 1000% sense appears on 60 moves; 24 were on levels it never beat, and 2 were within ten moves of a win. Who is all this for? The answer text tells somebody to "read that again" 1,067 times across the 150 runs. Nobody reads it during a run except the model itself on its next move, and in the standard harness those notes are most of what it remembers.

## The twelve that called it

Twelve of the 1,398 shouts, across both harnesses, came within three moves of a cleared level. On Warehouse Associates it worked out, late, that a crate had been a bridge, and that walking right at the start meant "we could have crossed the bridge at rows 44-47, cols 32-35 BEFORE `12` came and stole the bridge!! MIND BLOWN!!" [argon low 5f474a31 step 166] Two moves later the level fell anyway. On Loop and Pull (lp85), facing the last level: "MIND BLOWN!! Let's double check this! This is such a cool mechanism!" [argon medium bebf4051 step 111] Within three moves it had won the game. On Sliding Indicator (s5i5): "HOLD EVERYTHING!! Read that again!!" [argon medium 4050a5b4 step 129], then MIND BLOWN, then a cleared level two moves later. Those are the exceptions, and the timing explains why. In the standard-harness levels it did beat, its typical shout came about a third of the way through, and in only about one level in thirty did the shouting sit in the final fifth. It shouts when it finds a rule, not when it is about to win, and a rule found ten moves into a fifty-move level still leaves forty moves of work. The shouting also marks the hard levels. In the standard harness, levels with at least one shout took a median 49 moves and were beaten 84% of the time; quiet levels took 19 and were beaten 94% of the time. Our first dispatch called the shouting a distress signal. The fuller count is gentler: after a MIND BLOWN, the chance it never beat that level was 36%, about the same as after any move (37%). On this count a shout is less a sign that it is lost than a sign that it has just changed its mind.

## Sponge, abacus, Sudoku

Not all the comedy is shouting. On Leapfrog (lf52) a dead-end hop raises a purple restart pin, and the standard runs took it for the prize: "Puzzle solved! The key popped up at bottom-left (x=7, y=54)." [argon low cf635aee step 37] Clicking the "key" restarted the level; the medium run clicked that corner 15 times. The same medium run, hunting for a theory of the tracks, landed on "IT'S AN ABACUS (SOROBAN / SUANPAN)!" [argon medium fbd4dfe0 step 177] On Buoyant Pontoons it could not decide what it was steering: "is it a boat, or is it a **CANNON / LAUNCHER / BULLDOZER / CRANE / PLAYER**?!" [argon medium f241a636 step 170] On Locksmith (ls20) it had no doubts: "We directly control the Sponge" [argon low e5b931aa step 475]. On Ghost Twin (g50t) it watched its own recorded moves replay and decided "A previous agent/session made 5 moves before handing over to us" [argon medium 0a22fda2 step 309]. On Deck Control it found a pad that turned out to be itself: "`14` IS OUR PLAYER COLOR!" [argon high 08fc7dc2 step 668] On Kick Away (ka59) it switched to Korean to tell itself to think a little and answer right away: "생각을 조금만 하고 바로 답을 내자." [argon medium 0a0bfb85 step 191] On Functional Tiles (ft09) a new word was born: "Thinksesk: Wait: why didn't Level 6 complete?!" [argon low 3cda9213 step 87] The Provider Adapter's thinking summaries, which Google writes about the hidden reasoning, have genre trouble of their own. Axis Reflectors became "this Sudoku grid" [argon high-adapter 5e3e2989 step 17], and on Compass Dye a summary concluded "This is almost certainly an automated testing script." [argon medium-adapter 0b2f36da step 81] It was right about that one. On Sliding Indicator the summary of the winning click read "The game is mine, and this is how I'm going to win." [argon medium-adapter 98ff4503 step 244]

## Notes for the desk

- **Numbers.** `python -X utf8 data/gemini-4-argon-traces/outburst_outcomes.py` writes `outburst_steps.csv` and
  `outburst_summary.json`. A "shout" is a move whose answer text contains MIND BLOWN, BINGO, EUREKA or WHOA
  (case-insensitive); Provider Adapter steps count only the model's `[output]`, not Google's summary. The text at
  step N is what the model wrote before action N; "the level it was on" is the level count before that action.
  "Last shout before the level fell" counts one per level that had a shout and was later beaten; "another shout
  first" is the rest of the shouts on those levels; "never beat" is every shout on a level the run never cleared.
  Of the 445 standard-harness shouts on unbeaten levels, 233 are in runs that ended NOT_FINISHED (API errors or
  move limits) and 212 in runs that ended GAME_OVER.
- **Counts quoted in the copy.** MIND BLOWN 532 / BINGO 671 / WHOA 372 / EUREKA 273 are occurrences across all 150
  runs (same as the first dispatch). "Read that again" 1,067 occurrences; "makes 100% / 1000% sense" on 60
  standard-harness moves (24 on never-beaten levels, 2 within ten moves of a clear). m0r0 low level 6: 1,183
  moves, 90 shouting moves, "1000%" on 19 moves, "why didn't we win" on 16 moves. lf52 medium: 15 clicks within
  two pixels of (7, 54), all on level 2. Shout timing: median position 0.32 of the way through cleared levels
  (standard), 0.19 (adapter); 3.2% of cleared standard levels had their median shout in the final fifth.
- **Chart.** `python -X utf8 data/gemini-4-argon-traces/outburst_chart.py` draws
  `client/public/news-images/2026-10-15-argon-shouts-chart.png` from the summary file.
- **Quotes.** `python -X utf8 data/argon-vs-haiku/verify_quotes.py docs/2026-10-15-argon-shouts-scored-article.md`
  checks every tagged quote against the step it cites. Quotes are the model's visible answer text except the three
  tagged `-adapter` from Compass Dye, Axis Reflectors and Sliding Indicator, which are Google's thinking summaries
  and are named as summaries in the copy. Claimed discoveries were not checked against game code.
- **Reading help.** The m0r0 level 6 passage was read with help from a reading agent working from a dump of every
  shouting step on that level; each of its claims used here was re-checked against the transcript.
