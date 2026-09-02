# ARC-AGI-3 play surface: the board as a click target, and a spoiler guide

Author: Claude Opus 5
Date: 2026-09-02
PURPOSE: Objectives and TODOs for two connected pieces of work on `/arc3/play/:gameId` —
         making ACTION6 a real spatial click, and giving reviewers a per-game mechanic
         reference so auditing the synthetic set does not depend on asking in Discord.
SRP/DRY check: Pass — a plan document. The click work reuses the coordinate path that
         already existed end to end; the guide reuses the AST tooling written for the
         legibility gate rather than adding a second parser.

## 1. The click fix (done)

### What was broken

`t99e8274e` declares `available_actions=[5, 6, 7]`. There is no d-pad. The entire game is
clicking cells to fill and unfill them:

```python
if action == GameAction.ACTION6:
    self._toggle(int(self.action.data.get("x", -1)),
                 int(self.action.data.get("y", -1)))
```

The play page's only route to ACTION6 was a deck button that sent the action with **no
coordinates**, so the game read the `-1` default and `_toggle` returned early on the
bounds check. Not a laggy control or a confusing one — a guaranteed no-op, every time,
on the seven tasks in our set where ACTION6 is spatial.

The canvas had been made deliberately inert in a previous pass, to protect the
commit-style tasks where pressing ACTION6 early ends the level. That protected the
smaller group and broke the larger one.

### Coordinate space

Frame cells, confirmed against the engine rather than assumed:
`external/ARCEngine/arcengine/base_game.py:517` builds
`ActionInput(id=GameAction.ACTION6.value, data={"x": x * scale + x_offset, "y": ...})` —
coordinates in the rendered frame, which is exactly what our canvas draws. The game then
divides down to its own board (`gx, gy = px // CELL, py // CELL`).

Nothing server-side needed changing. `pyodide.step(action, data)` → worker
(`_data = dict(_step_action_data)`) → `ActionInput` already carried a data dict, and
`HumanPlayRepository` already had `x_coord` / `y_coord` columns waiting — with a comment
noting no backfill was possible "because the coordinates of past clicks were never
transmitted". This change is the first time that column ever receives a value.

### What was built

All in `client/src/pages/arc3-community/CommunityGamePlay.tsx`. `Arc3Console` needed no
change at all: it takes the screen as a `ReactNode`, so the canvas and its handlers
already belonged to the page.

- `cellFromPointer` maps pointer position to a frame cell **proportionally against
  `getBoundingClientRect()`**, not via a cell size derived from `canvas.width`. The
  console screen is a fixed square and the canvas is stretched to fill it, so the drawn
  pixel size (512) and the displayed pixel size (454 on a laptop) are different numbers.
  Dividing by the drawn one lands on the wrong cell on any non-square grid. This is why
  the existing mapping in `Arc3GridVisualization` was not reused verbatim — that
  component sizes its canvas `h-auto` to preserve aspect, so the cell-size form is
  correct there and wrong here.
- Dimensions come from `displayedGrid`, the frame at the current `displayFrameIndex`, not
  `frame.frame[0]`. `applyFrame` walks multi-frame responses on a 200ms timer, so a click
  landing mid-animation must map against the grid the player is looking at.
- Clicks are gated exactly as the deck controls are: `canSend('ACTION6')`,
  `gameState === 'playing'`, and `!pyodide.isActing` so a fast clicker cannot queue steps
  against a worker mid-step.
- A hover outline is drawn **into the canvas** in the same effect that draws the grid,
  rather than as a positioned overlay div — an overlay would have to repeat the same
  proportional maths a second time and could drift from it.
- When ACTION6 is unavailable the board has no crosshair, no hover outline and ignores
  clicks. An inert board must look inert or it invites a move the dispatcher refuses.

### Verified in the running app

- `t99e8274e`: clicking board cell (0,0) fills it (canvas hash changes); clicking the
  same cell again returns the canvas to a byte-identical state. Step counter advances on
  each. A wrong coordinate mapping would land on a non-fillable cell and change nothing.
- Telemetry: the posted event carries `{action: "ACTION6", x: 25, y: 17}` — the exact
  cell clicked.
- The deck CLICK button still posts `{action: "ACTION6", x: null, y: null}`, so the two
  moves stay distinguishable in the data.
- `t0bf293c2` (`available_actions=[1,2,3,4,5,7]`): no crosshair, no hover outline, and a
  click on the board does not advance the step counter.

## 2. The deck CLICK button — OPEN QUESTION, do not tidy away

The button stays. It is the only way to send a coordinate-free ACTION6, which is what the
commit-style tasks want: press to declare "I am finished", with the game never reading
`data`.

**Whether that mechanic belongs in our synthetic set at all is undecided.** An action id
that means "click here" in one task and "submit my answer" in another is why this page has
now been wrong in both directions — first offering a board click that killed people, then
withholding one that seven tasks require. The candidates if we revisit it:

- keep it, and accept that ACTION6 is overloaded, as upstream does;
- retire commit-style ACTION6 from our own generator and leave ACTION6 spatial everywhere
  in our set, treating upstream's usage as theirs;
- give the commit tasks a different action id so the two never share one control.

Nothing here is decided. Until it is, the button is deliberately retained and this
document is what the code comments point at. The header of `CommunityGamePlay.tsx`
(point 7) and the comment above `ctl` both say so, so a future reader tidying up an
apparently redundant control hits the note first.

## 3. The mechanic guide (TODO)

### Objective

A reviewer auditing the synthetic set should be able to look up what a task actually is,
without asking in Discord. Two surfaces, one source of truth:

- an unlisted page listing all 50, for auditing and for handing to collaborators;
- a reveal on the play page after feedback is submitted, showing the mechanic for the task
  just played.

### Scope

The **50 local games** in `server/data/arc3-games/`. Son's upstream set is not covered:
its source is remote and there is no prose for it. If that changes the generator below
works on any source it is handed.

### Approach — derive, do not transcribe

`scripts/arc3/legibility_gate.py` already parses these exact sources with `ast` and
classifies their win/lose conditions. **It must not be modified**: it is byte-identical
by contract with the copy in the authoring repo, with the expected `shasum` recorded in
`scripts/arc3/README-legibility.md`. A sibling `scripts/arc3/mechanic_digest.py` emits
per game:

- `available_actions`
- whether ACTION6 reads `data["x"]` / `data["y"]` (a real xy-click) or ignores `data`
  (a plain button) — the distinction that matters most and is mechanically decidable
- board dimensions and cell scale
- which branches `step()` has and what each calls
- the win condition's source expression

**Acceptance test before any prose is written**: the ACTION6 rule must select exactly
`t99e8274e`, `t64b427c7`, `t521bcd1b`, `td6b934b7`, `t999ce20d`, `t35352a03`, `t74db26e1`
as xy-click, and exactly two others as plain-button. That is the independent
classification we already have. If the rule disagrees, the rule is wrong, and every prose
note built on it would inherit the error.

Prose is then one human sentence per game written against extracted facts, in a checked-in
JSON — not a reverse-engineering job per file.

### Access

The page is **unlisted, not private**: no nav link, no sitemap entry, `noindex`. The route
and the API behind it are public, like every other route on the site. Anyone with the URL
can read it. This is stated here so nobody later mistakes it for an access control.
