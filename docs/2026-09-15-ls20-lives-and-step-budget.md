<!--
Author: Claude Opus 5
Date: 15-September-2026
PURPOSE: What LS20 (Locksmith) actually does with lives and its step meter, read line by line
         out of the live build's own source and then confirmed frame by frame against a human
         winning recording. Written because the two prior readings in this repo -- the original
         write-up and its 2026-09-12 "adversarial" correction -- were both wrong about the life
         system, in a way that changes how an agent should play the game. Corrects
         shared/arc3Games/ls20.ts, which is what the site serves.
SRP/DRY check: Pass. No existing doc covers LS20 mechanics. docs/2026-09-02-arc3-official-game-studies.md
         scopes itself to six games that do not include LS20 and is maintained as a byte-identical
         mirror of arc3games/OFFICIAL_GAME_STUDIES.md in the arena repo (see CHANGELOG 9.76.0,
         9.77.0), so it is deliberately not extended here. docs/2026-09-11-arc3-public-set-additional-games-study.md
         covers the thirteen newcomers and names LS20 only in passing.
-->

# LS20 gives you three lives on every level, and RESET buys them back

**Source read:** `ls20.py` from the live `ls20-9607627b` build, at
`arc-3/docs/static/games/src/ls20-9607627b/ls20.py` (104,880 bytes). Every line number below
was opened directly. **Tape:** the human win
`7537433d-75af-48fa-ad3d-45fd32b23c00`, committed at
`arc3/ls20-9607627b.7537433d-75af-48fa-ad3d-45fd32b23c00.jsonl`.

## The short version

- Three lives, **per level**, not per run. `ls20.py:1821` sets `aqygnziho = 3` and it sits
  inside `on_set_level` (`:1778`), so every level begins at three.
- Running the step meter out **costs one life** and soft-respawns you at the level's start
  (`:1961`).
- The **third** loss on a single level ends the **whole run** (`:1962-1963`), not the level.
- **RESET restores both the lives and the step meter**, because RESET re-runs `on_set_level`.
  It is the only mid-level way to get a life back.
- The "42-step budget" is 42 **meter units**, which is only 42 moves on levels 1, 4 and 6.
  Levels 2, 3, 5 and 7 drain two units a move, so they are really 21.

## Two separate resources, both drawn on frame row 61

`hbuhvkxlhc.render_interface` (`:1495-1530`) paints both meters into the bottom two rows of
the 64x64 frame, and they are trivially readable off any recording.

**The step meter** — `:1521-1524`. One pip per unit of `osgviligwp`, starting at `x = 13`
(`:1522`), rows 61-62 (`:1523`). Lit pips are colour `dhxmtlewyv` = **11** (`:1461`), spent
ones `iisukudgvu` = **3** (`:1453`). With `osgviligwp` of 42 the bar runs x=13..54.

**The lives** — `:1525-1529`. Exactly three pips (`for bsyrmrqsrq in range(3)`, `:1525`), each
two columns wide (`:1528`), at `x = 56 + 3 * bsyrmrqsrq` (`:1526`) — so left columns
**x=56, 59, 62** and their partners 57, 60, 63 — on rows 61-62 (`:1527`). Lit in
`tqogkgimes` = **8** (`:1458`), which is red in the ARC palette; dark in the same background
3 as a spent step pip. The test is `aqygnziho > bsyrmrqsrq` (`:1529`), so the count of red
pips **is** the life counter, directly.

## The life chain, line by line

1. **`:1821` — `self.aqygnziho = 3`.** Inside `on_set_level` (`:1778`). Three lives, set at
   level setup.
2. **`:1950` — `bkuguqrpvq = not yubyobdoss and (not self._step_counter_ui.mfyzdfvxsm())`.**
   True when the step meter has just run out on a move that was not otherwise consumed.
3. **`:1961` — `self.aqygnziho -= 1`.** Running out of steps costs a life.
4. **`:1962-1963` — `if self.aqygnziho == 0: self.lose()`.** 3 → 2 → 1 → 0. The **third**
   timeout on a single level ends the run. The prior write-up's "4th failure ending the game"
   was off by one.
5. **`:1966-1990` — surviving a timeout is a soft respawn,** not a loss: a full-screen flash
   sprite (`:1966-1968`), the avatar returned to the level's start position (**`:1972`**),
   the key's rotation state re-derived (`:1973`), removed sprites re-added (`:1974-1982`),
   door and tile visibility restored (`:1984-1988`), and at **`:1983`**
   `kbkdzqocik(osgviligwp)` refills the step meter to full.

**The meter itself** — `mfyzdfvxsm` (`:1487-1490`) decrements `current_steps` by
`efipnixsvl` **and then** tests `>= 0`, so the last move that takes the meter below zero is
the one that fails. `nzukewekzr` (`:1492-1493`) sets it back to `osgviligwp`; `kbkdzqocik`
(`:1481-1482`) clamps into `[0, osgviligwp]`.

## Why RESET restores both

RESET runs `on_set_level` (`:1778`). That method:

- re-clones the pristine level from `_clean_levels` (**`:1780`**), discarding every change,
- sets `aqygnziho = 3` (**`:1821`**) — **all three lives back**,
- calls `wbcenorpju()` (**`:1794`**), which at `:1773-1776` reads the level's `StepCounter`
  and calls `nzukewekzr()` — **the step meter back to full**.

Because `on_set_level` also fires on `next_level()`, lives do not carry between levels either:
every level starts at three regardless of how many you burned on the last one.

So on LS20, RESET is not a concession. It is a resource, and it is the only one the game
gives you for recovering a life.

## Confirmed on tape

Reading `frame[61][56|59|62] == 8` across all 562 rows of the committed recording, the red-pip
count changes exactly seven times:

| row | pips | level being played | what |
|---|---|---|---|
| 0   | — → 3 | 1 | initial RESET |
| 36  | 3 → 2 | 2 | timeout, one life spent |
| 81  | 2 → 3 | 2 → 3 | level advance refills |
| 225 | 3 → 2 | 5 | timeout |
| 277 | 2 → 3 | 5 → 6 | level advance refills |
| 408 | 3 → 2 | 7 | timeout |
| 451 | 2 → 1 | 7 | second timeout — **one pip from `lose()`** |
| 454 | 1 → 3 | 7 | **RESET. All three back.** |

Both halves of the mechanic are visible in that table: `next_level` refills (rows 81, 277) and
RESET refills (row 454). On the final level the player was one timeout from ending the run,
spent a RESET, bought back the full step budget and both lives, and went on to win.

The run's three mid-run RESET rows are 135 (level 4), 454 and 482 (both level 7). **Row 135 is
worth its own line: the pip count stayed at 3 across it.** That is a RESET spent with no life
lost — purely to refill the step meter and re-clone the board. The mechanic gets used both ways.

## The 42 is not 42 moves

Every level carries `"StepCounter": 42` — lines 716, 843, 955, 1080, 1198, 1316, 1436, one per
level block. But `wbcenorpju` (`:1768-1772`) also reads `StepsDecrement`, **defaulting to 2**
when absent (`:1771`). `StepsDecrement: 1` appears only three times: lines **724, 1088, 1324**,
which fall inside the level blocks beginning at 584, 966 and 1209 — **levels 1, 4 and 6**.

So the meter drains at one unit per step on levels 1, 4, 6 and two units per step on levels
2, 3, 5, 7. **Confirmed independently on tape** by reading the lit-pip count of the step bar
across the first moves of each level: levels 1, 4 and 6 fall 42, 41, 40, 39…; levels 2, 3, 5
and 7 fall 42, 40, 38, 36….

Deriving the move count from `mfyzdfvxsm`'s decrement-then-test (`:1487-1490`): at decrement 1
you get 42 moves and fail on the 43rd attempt; at decrement 2, 21 moves and fail on the 22nd.
**Half the levels give you half the moves the "42-step budget" implies.**

One caveat on counting: a counted step is not the same thing as an action. On the tape, rows 6
and 7 both read 37 lit pips — a move that did not decrement the meter, because the collision
and transformation branches above `:1950` can return before the check. Do not equate step
budget with action count.

## What this means for an agent

`available_actions` on LS20 is `[1, 2, 3, 4]` (`:1765`) and is constant across all 562 rows of
this recording. There is no ACTION7 (undo) on this build. **RESET is the only recovery
primitive LS20 has** — and it is a platform primitive, never listed in `available_actions` on
any game.

The consequence is straightforward: an agent that cannot issue RESET gets exactly three
timeouts per level with no way to refill, on levels where four of seven give only 21 moves.
A human can refill at will. Whether our harness can actually reach RESET is a separate
question about the harness, deliberately not settled in this document.

## What was wrong before, and where

`shared/arc3Games/ls20.ts` is corrected in the same commit as this document. It had said the
step budget "costs one of only 3 total lives, with a 4th failure ending the game" in
`mechanicsExplanation`, and "you only get 3 lives total" in `hints[ls20-hint-3]`. Both claims
were wrong twice over — per-run instead of per-level, and fourth loss instead of third — and
both are now corrected with the same citations used above. Neither mentioned that RESET
refills anything, or that the 42 is not 42 moves on four of the seven levels.

That reading came from a pass described in the file's own header as "adversarially
re-verified". It was a source read that found the right constant and drew the wrong scope
around it. The tape is what settles it.
