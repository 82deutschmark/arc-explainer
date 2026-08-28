<!--
Author: Claude Opus 5
Date: 2026-08-28
PURPOSE: Plan for folding the autoresearch-arena synthetic ARC-AGI-3 game programme into
this repo's existing community-game platform, and record of the "/" -> /arc3/gallery
redirect shipped alongside it. Written because the two efforts were being built in
parallel without knowing about each other; this is the reference that stops that.
SRP/DRY check: Pass - searched docs/ for existing synthetic-game or playtest plans; none
exist. The community pipeline described here is reused wholesale, not rebuilt.
-->

# Synthetic ARC-AGI-3 games — integration plan

## Why this doc exists

Two efforts converged on the same goal from opposite ends:

- **This repo** already runs the platform: public no-auth play, session recording,
  `sourceHash` versioning, and a moderation queue, live at `arc.markbarney.net` with 50
  approved community games.
- **`sonpham-org/autoresearch-arena`** is generating *new* candidate ARC-AGI-3 tasks on a
  6-hour loop — an append-only idea ledger at `arc3/game-ideas/ledger.jsonl` (19 ideas
  across 15 mechanic axes), each naming a `mechanic_axis` and the `ai_failure_mode` it
  targets, plus a human-playtest harness built there.

Neither knew about the other. **The platform is this repo's; the game supply and the
playtest instrumentation are autoresearch-arena's.** Nothing here should be rebuilt there,
and nothing there should be rebuilt here.

## The decision: Option A

Generated games will be authored as **Python `ARCBaseGame` games** and submitted through
this repo's existing community pipeline — not served as standalone HTML from the arena's
Flask app.

The reason is measurement, not convenience: **humans then play on the same engine the
agent plays.** Human-vs-agent stops being two different implementations stapled together
and becomes one comparison on one environment. That comparison is the entire point of the
programme — the claim under test is "easy for a human, hard for an AI", and today the
agent half is measured while the human half is an assertion in a ledger field.

## What a generated game must satisfy

Verified against `server/services/arc3Community/CommunityGameValidator.ts` and the 50
games in `data/community-games/sonpham/`:

- One Python file; a class inheriting **`ARCBaseGame`**; imports from **`arcengine`**
  (vendored at `external/ARCEngine`, so no install step).
- 32×32 logical grid → **64×64 frame**, 2px per cell, fixed 16-colour ARC-3 palette.
- Instantiates, answers `perform_action(ActionInput(id=GameAction.RESET))` with a frame,
  and populates `_levels`.
- Validation gate is *loadability*, not winnability — so a solvability check stays the
  author's responsibility (see below).

## Work items

1. **Port `g001` Toll Gate to `ARCBaseGame`** by hand as the reference implementation.
   16×16 → 32×32; its exact solvability BFS over `(cell, charges, opened-door mask)` is
   pure logic and ports unchanged.
2. **Retarget the generator** (`tools/arc3_game_ideas.py`) to emit Python against the
   contract above instead of standalone HTML, with the ported game as its worked example.
3. **`verify.py` replaces `verify.js`.** The platform validator only proves a game loads;
   it does not prove every level is winnable. The arena's harness does, and that check has
   already caught a sealed-off decoy pocket in a shipped level. Keep it.
4. **Port the conformance gate** (`webgames/check_game.py`) to scan Python. See the
   spoiler rule below — this is the item most likely to be skipped and most costly to skip.
5. **Namespace the submissions.** The existing 50 games are `sonpham`'s; generated games
   need their own namespace or they pool into the same human-baseline statistics.
6. **Port the playtest instrumentation** the arena built, which is precisely what this
   platform lacks: a per-action event stream carrying ARC-3 action integers
   (`1=Up 2=Down 3=Left 4=Right 5=Action 6=Click 7=Undo`) so human rows join directly
   against agent `per_action_stats`; a **first-play flag**, because a person can only play
   a game blind once and that run is the only one that answers "is this easy for a human";
   and the consent line on the play page.

## The spoiler rule — the one thing that must not be lost

An ARC-AGI-3 task must tell the player **nothing**. No control legend, no goal statement,
no tutorial framing, no descriptive level names, no cost or rule readouts. A human who is
told the mechanic has been handed the answer the agent had to infer, and their run is
worthless as a baseline.

**The existing community games violate this in their docstrings.** For example
`data/community-games/sonpham/gh_00000011_gh01.py` opens with a full control list, the
goal, and a level-by-level description of what each level teaches — and
`GET /api/arc3-community/games/:gameId/source` serves that source publicly.

This is not a criticism of those games, which predate the requirement; it is a constraint
on generated ones. Generated games must carry no such docstring, and the ported
conformance gate must fail them if they do.

## Shipped with this doc

`/` now redirects to **`/arc3/gallery`**, making the game gallery the site's front door.
The resource hub previously at `/` is unchanged and served at **`/home`**; the header
brand mark and every in-app "back to hub" link were retargeted there in the same change.
`/arc3` remains the ARC-AGI-3 reference-and-history page.

## Open

- Whether a failed human check should mark the ledger entry `human_verified: false` and
  pull the game from the showcase set.
- The pass mark for "easy for a human". A first-play completion rate of ~70% is the
  working suggestion, and it is a guess until there is data. It is currently reported and
  never enforced.
- Raw event-stream retention.
