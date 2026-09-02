<!--
Author: Claude Fable 5.1
Date: 02-September-2026
PURPOSE: Senior review of /arc3/mechanics (commits a163659d, 3a4df853) and a short
         remediation plan. The Boss's verdict: incomplete, reads as AI slop, not what was
         envisioned. This names why and says what to do in the fewest steps.
SRP/DRY check: Pass. The handoff doc asks four open questions; this answers the one about
         the mechanics page and leaves the rest alone.
-->

# /arc3/mechanics: what went wrong and how to fix it

## The verdict in one line

The page is a **wall of self-written prose about engine internals**, not a review tool.
It tells you what the same AI that built the game *says* the game is. It shows you
nothing, and it measures nothing a reviewer cares about.

## What is wrong, specifically

1. **The prose is unverified self-report.** All 50 notes were written by the model
   reading its own source. The second commit's cross-check caught three wrong notes on
   first run, including a wrong *mechanic* (tc6f8ee4c). There is no reason to think the
   other 47 are right. A reviewer will trust this field instead of playing, which is
   worse than having no field.
2. **It is text-only.** Not one image. A mechanic page for a *visual* puzzle set with no
   frame of any level is incomplete on its face. You cannot judge "formulaic" or "big
   empty screen" from a paragraph.
3. **It foregrounds the wrong numbers.** The four hero tiles are ACTION6 plumbing
   (xy-click / button / inert). That is a bug tracker's view, not a quality view. Nothing
   on the page says how the game was received, whether anyone cleared a level, or where
   it sits in the funnel.
4. **The feedback is invisible.** 36 responses exist in the database and the only way to
   read them is a SQL query (feedback synthesis doc, section d). The page that is
   supposed to be the reviewer's reference does not show the reviewer's own notes.
5. **The prose is samey.** 14 of 50 controls fields are the literal string "D-pad only."
   15 mechanics open "D-pad walks". 11 goals open "Reach the exit/goal". That is what
   "AI slop" looks like from the outside: correct, uniform, and empty.
6. **Reveal-on-feedback spoils the next play.** After one submit the player sees the
   answer key for that task. Sessions are not tied to people, so a second attempt by the
   same person is now poisoned, and the page cannot tell.

## What the page should be (stated assumption)

I am assuming the Boss wanted a **per-game review sheet**: look at a game, see what it
looks like, see what people said, decide keep / polish / cull. If that is wrong, the plan
below still removes the slop; only step 3 changes.

## Remediation, in order

Each step is small and independently shippable.

### 1. Put a picture on every card (half a day)

Render level 1 of every game headlessly with the engine and store a PNG per game
under `server/data/arc3-games/frames/`. The probe already executes every game; add a
frame dump to `scripts/arc3/mechanic_digest.py`'s sibling, not to the digest itself.
Show it at the top of each card. Later: one thumbnail per level in a strip.

*Done:* every card has a real frame. A reviewer can see "big empty screen" without playing.

### 2. Join the feedback to the card (half a day)

Add a read endpoint on `Arc3FeedbackRepository` that aggregates per game: responses,
enjoyed / solved / never-understood / broken counts, max level reached, median actions,
and the raw notes. Show the counts as badges and the notes verbatim under the card.
This endpoint is spoiler-bearing and lives under the same unlisted route as the page.

*Done:* the 36 responses are readable on the page, per game.

### 3. Replace the hero tiles (an hour)

Swap the four ACTION6 tiles for: **played / never played**, **enjoyed**, **cleared a
level**, **flagged broken**. Keep the ACTION6 facts as a small badge row on each card.
Add a filter for "has feedback".

*Done:* the first thing on the page is reception, not plumbing.

### 4. Mark prose as unverified until a human confirms it (an hour)

Add a `verified_by` field to `mechanics-notes.json`, default null. Render unverified
prose in muted text with an "unverified, model-written" tag. Add a one-click "this is
right / this is wrong" control on the card for the Boss, which writes the field.

*Done:* the reader can tell self-report from confirmed fact. Wrong notes get caught by
the person playing, at the moment they notice.

### 5. Kill the generic strings (an hour, model work)

Reject any controls note equal to "D-pad only." and any goal starting "Reach the". Each
must say what is *specific* about this game's controls and win, or say nothing. A note
that could describe ten games describes none.

*Done:* no two notes share a first sentence.

### 6. Stop revealing on feedback (30 minutes)

Replace the in-place reveal with a link to the card on the unlisted page, shown only to
the Boss's session (or behind a query flag). A blind tester's second attempt should stay
blind.

*Done:* submitting feedback never puts the solution on the play surface.

## What to leave alone

`mechanic_digest.py` and its self-test are good and should stay. The derived facts
(actions read, geometry, level count, calls-lose) are the one part of this that is
trustworthy. The problem is what was built on top of them, not the digest.

## Not in scope

The four open questions in the handoff doc other than this one. The ACTION6 overload
question belongs in the authoring contract, not this page, and is a separate decision.
