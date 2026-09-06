# Why the contributed glow-up games (g500–g543) feel unresponsive

**Date:** 05-September-2026
**Status:** diagnosis complete; one defect fixed, the main issue deliberately left open
**Audience:** the next coding assistant picking this up

---

## Spoiler discipline — read first

These games exist to collect a **blind human baseline**. A player is meant to infer the
rules from the frame alone. That is why they are published under bare ids with no title, no
tags and no description, and why `import_authored_games.py` strips authoring prose and
renames mechanic-named classes.

**This document therefore names no mechanic, no level name and no puzzle content, and
neither should anything you add to it.** Everything below is structural and can be
discussed safely. If you need to understand what a specific game *does*, read its module —
do not write what you learned into a tracked file.

---

## The report

All 44 contributed glow-up games render beautifully but feel like the controls are not
connected. Pressing movement keys appears to do nothing. The reference point is the
hand-authored arena set (`g001`–`g178`), which feels responsive on the same page, same
worker, same engine.

## What this is NOT — do not re-investigate these

Each of the following was checked and cleared. They look plausible and they all cost time.

- **Not the engine.** The wheel published to PyPI and the `external/ARCEngine` submodule are
  the same version with identical `base_game.py` and `enums.py`. **Do not pin the
  submodule.** There is no divergence to pin against.
- **Not the constructor.** These modules pass their arguments to `ARCBaseGame.__init__`
  positionally rather than by keyword. That binding is correct against the real signature,
  and the available-action list arrives intact.
- **Not the action enum.** `GameAction` members set their own integer value, so reading
  `.value` off an action yields the integer the game expects.
- **Not the worker's dispatch.** `pyodide-game-worker.js` resolves actions via
  `GameAction.from_id`, which is correct, and marshals click data into a real dict.
- **Not the catalog or class names.** The mirror serves the correct source and class name for
  every one of these, byte-identical to what is on disk, with support modules inlined where
  a module needs them.
- **Not a load failure.** These games load and render their opening frame. That is *why* they
  look good. The failure is only ever in stepping.

## What was actually wrong, and what is fixed

### Fixed: every one of the 44 reported the wrong game id

All 44 handed the engine the contributor's own id (`q001`–`q200`) instead of the id they
were published under (`g500`–`g543`), so `FrameData.game_id` echoed the wrong name into
human-play telemetry, feedback rows and triage.

Root cause: `rewrite()` in `scripts/arc3/import_authored_games.py` accepted the published id
but only used it for the header comment — it never rewrote the id literal the module hands
the engine. The first fifty were authored in this project's own numbering, so their literal
already matched and the gap was invisible.

Three changes shipped together:

1. `import_authored_games.py` now rewrites that literal, anchored to the `super().__init__`
   call so it cannot match anything else. Handles the positional and keyword forms, and
   calls split across lines.
2. All 44 published modules corrected in place.
3. `check_publish_integrity.py` grew a `check_self_reported_ids` guard so a module that
   drifts from its published id fails the publish rather than shipping.

This was a real provenance bug worth fixing, but **it is not why the games feel dead.**
Do not expect the controls to improve because of it.

### Open: the games are mute, not dead

The games do respond. Actions arrive, the state machine runs, and legal moves change the
board. Two things combine to make that invisible.

**1. Rejection is silent and the settled frame is identical.**

Each of these games routes every input through a pure transition function over a private
state tuple. When a move is illegal, that function returns the *same state object*, the
display redraws from it, and the resulting frame is pixel-identical to the one before.

Some of these transition functions have upwards of a dozen distinct early-exit paths.
A few games have a whole class of level where nearly every input is refused until one
specific precondition is met. So a meaningful share of presses are legal no-ops by design —
and a no-op is presented exactly as a dropped input would be.

Where an explicit rejection animation exists at all, it is a few frames of a small element
shifting by a pixel or two on a dense, heavily textured background, after which everything
returns to precisely where it started. Nothing accumulates.

**2. There is no per-action heartbeat.**

This is the sharpest contrast with the arena set. Every working arena game advances a
counter on *every* action, before it evaluates anything, and repaints decorative elements
from that counter. The change persists. So even a completely illegal move visibly moves the
world, and the player always knows the input was received.

None of the 44 do this. Nothing in them is a function of "how many actions have been taken"
— only of the puzzle state itself. Refuse the move and the frame cannot change.

That is the whole difference. The arena games are not more permissive; they are more
talkative.

## The architectural difference underneath

Every one of the 44 constructs its levels with an empty sprite list and paints the entire
frame itself, each render, from its private state tuple. The engine holds no game objects
at all; it is being used as a canvas.

Every arena game does the opposite: it builds real sprites, and on each action mutates
those sprites' pixels and positions, letting the engine render the board. Its display layer
draws only overlays on top.

This is legal and it renders correctly, but it has consequences past the feel problem:

- Anything downstream that inspects sprites gets an empty list for all 44. Any tooling,
  telemetry or analysis that reasons about board contents through the engine's object model
  sees nothing in these games.
- The engine's own movement and collision helpers are unused, so each game reimplements
  that logic privately, which is where the many silent-refusal paths come from.

Decide deliberately whether the contributed set is allowed to use the engine this way. That
is a policy call, not a bug, and it should be made explicitly rather than by default.

## Suggested fixes, cheapest first

1. **Add a heartbeat.** Give each of the 44 a per-action counter, incremented at the top of
   `step()` regardless of outcome, and make some small persistent element of the drawing a
   function of it. This is close to mechanical, matches what the arena set already does, and
   alone would remove most of the "controls are broken" impression.
2. **Make refusal legible.** Where the transition function returns state unchanged, play a
   rejection animation that is actually visible at this canvas size — and make it consistent
   across all 44 so players learn it once. Several already have the hook; it is too subtle.
3. **Audit the refusal-heavy levels.** Some levels refuse nearly every input until one
   precondition is satisfied. For a blind player with no instructions that is
   indistinguishable from a broken build. Either signal the precondition on the frame or
   move that gating later in the progression.

Fixes one and two are worth doing across the whole set at once; they are the same edit
repeated, and they are what makes these playable blind.

## How to approach this

**Read the game modules.** The answer to every question in this document was in the game
source. Read one of the 44 end to end, then read an arena game end to end, and the contrast
is obvious.

Do not start with commit archaeology, engine version comparisons, headless probes, or
driving the deployed site and comparing frames. The failure is already reported and
reproducing it proves nothing that reading does not tell you faster.
