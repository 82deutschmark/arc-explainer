# Game feedback — 12 September 2026

All four feedback rounds are implemented in two draft pull requests. The changes cover
33 games and 245 levels, including 24 additional levels across the combined update.
G006 gameplay is preserved. These changes have not been merged or deployed to arc.markbarney.net.

| Previous | Public ID | Levels | Result |
|---|---|---:|---|
| G006 | `bn06` | unchanged | Gameplay preserved. |
| G009 | `xs09` | 6 | Distinct Y splitters, travelling beams, and direct tray selection. |
| G010 | `vj10` | 6 | Six original lantern maps and oil budgets with wider exploration: radius four at full light, three when dim, one at low fuel. Hidden terrain remains hidden until explored. |
| G011 | `np11` | 9 | Native one-pixel slide animation with moving stones. The original seven tile maps remain; two later maps use a 64x64 collision grid with one- and two-pixel obstacles and off-grid resting goals. |
| G012 | `zk12` | 8 | Original six levels retained; two scrolling levels with solid snake bodies that block routes. |
| G013 | `eo13` | 6 | Square movement and growth; timed sowing, dead branches, and up to three planted crossings. |
| G014 | `bh14` | 6 | A block collapses into its directional shadow and raises every covered ground cell by one. White pips expose block height, blue inset edges expose depressions, and a pixel sweep shows the collapse. Six original puzzles. |
| G015 | `uq15` | 7 | Screen-direction triangle controls; fire, take, and wait remain available. |
| G016 | `vn16` | 9 | Different speeds, ordering marks, bent and crossing routes, and two new scheduling levels. |
| G017 | `yb17` | 7 | Restored seven square causeway puzzles with ten-turn bead countdowns and ordering traps. |
| G018 | `au18` | 10 | Eight original woven-height/tide puzzles, followed by two embroidered-piece puzzles. Irregular cloth pieces rotate and fit sockets only when both geometry and cell weave match. The final three-gate route requires rotation and each installation. |
| G019 | `ha19` | 5 | Square movement, sound propagation, and ballast transfer; five refitted bell-and-plate puzzles. |
| G020 | `cv20` | 6 | Square movement, six-pixel tiles with the requested one-pixel row offset, paired pulse/seal colors, and waves. |
| G021 | `wd21` | 10 | Left/right pan placement, explicit left-pan target, and two volatile-material puzzles. |
| G022 | `lz22` | 5 | Screen-direction triangle controls. |
| G024 | `kc24` | 8 | Control wrappers compose: double, turn, reverse and loop alter a directional action. Four new branching opening mazes need 14, 19, 22 and 41 actions; the later four pocket/reordering puzzles remain. |
| G026 | `qx26` | 7 | Persistent obstacle warnings, visible collision response, and a seventh timed bottleneck. |
| G027 | `rt27` | 6 | Screen-direction triangle controls, brake, and type switch. |
| G028 | `hf28` | 8 | Smaller tutorial, crease and landing previews, movement before ordered three folds, and a four-fold finale. |
| G034 | `pk34` | 8 | Placement grid, full-size target comparison, direct tray selection, and mismatch markers. |
| G035 | `zs35` | 9 | Layer clothing from inside out to pass colored hazards. Dark walls and five-pixel artwork sit over three-pixel movement cells. Two added chapters use shears and doors that require the exact remaining layer pattern, including holes and colors. |
| G036 | `mt36` | 10 | Lay an over/under cord along continuous tube paths. The second strand across a marked crossing must match its requested horizontal or vertical orientation. A six-move anchor lesson and a compact crossing lesson precede the original eight puzzles. |
| G043 | `dy43` | 7 | Square four-direction movement for both characters; exit gates and portal traps remain necessary. |
| G044 | `uc44` | 7 | Scrolling cube net with seven-pixel tiles, matching seam colors, heading cues, keys, minimap, and crossing particles. |
| G045 | `jm45` | 7 | Six-pixel scrolling harbor, visible portal schedule, ornate destination, and explicit wait action. |
| G046 | `ts46` | 7 | Restored square patrol rooms; grid seams distinguish live sightings from hollow stale memories. |
| G047 | `jr47` | 7 | White exploration map, always-visible player, persistent revealed terrain, colored beams, and simple mirror controls; removed side panels and clutter. |
| G050 | `fx50` | 9 | Larger scrolling ash maps, clearer terrain, and two coolant retrieval puzzles with single-use ash crossings. |
| G136 | `ak36` | 7 | Five-pixel square tiles, framed board, clear hazards on both paired appearances, and warning corners. |
| G155 | `om55` | 8 | Circular persistent fog, one-way water currents, and magma cooled by eating cyan blocks; original six levels retained. |
| G162 | `ez62` | 6 | Original puzzles retained; expanding sound waves and dramatic wake-up frames resolve without extra actions. |
| G171 | `yu71` | 9 | Automatic pixel BFS water flow, framed map and tanks, plus three mixing puzzles with removable plugs and exact ratios. |
| G178 | `nv78` | 7 | Mouse-only ball routing, six-pixel rails on black, and a new branching finale with three-charge receivers. |
| G512 | `pm12` | 8 | Additional published hex game converted to square; eight routes preserve keys, doors, collapsing bridges, and essential reveal apertures. |

## Square boards and animation

All hex movement games found in the 94-entry local published catalog are now square:
G013, G017, G019, G020, G046, and contributed G512. G043 is square too.
The remaining triangular movement games, G015/G022/G027, use left/right along the row
and up/down across the adjacent vertical edge. G009 retains its optical triangles.

The shared community player now animates actions that previously changed instantly:
changed pixels settle in stages, moving objects leave short trails, and unchanged actions
get a brief border pulse. Games' native animation sequences play in their original order.
Reduced-motion preferences bypass added animation. Reset, undo, initial loading, and silent
live ticks settle immediately. Presentation frames do not change physics, scoring, or engine
observations. Input waits for playback to settle; reset and undo can cancel it.

Control-map requests use the loaded source version, preventing an old browser cache from
offering keyboard controls or blocking mouse input after a game changes its controls.
Short control/objective hints appear on the games whose rules were especially unclear.

## Fourth feedback round

G017, G019, and G043 retain their already-verified square movement. The shared action
animation also remains enabled throughout the community player.

G036 now starts with a six-move cord path and a green anchor: press Space at the anchor to
pull tight. The second lesson teaches one crossing. Both strands must pass through it;
the strand laid second must match the marked direction. Continuous tube silhouettes round
only exposed ends, so neither horizontal nor vertical seams pinch in at every tile.

G035 keeps three-pixel movement cells and uses five-pixel artwork. Its two added puzzles
introduce white shears: Space removes the outermost layer and returns it to its rack.
Framed doors compare the exact remaining pattern, including uncovered holes. A swatch
at the bottom lets the player compare directly; matching color alone is insufficient.

G018 preserves the original woven-height/tide chapters and adds two cloth chapters.
Stand beside an orange cloth and click to carry it. Space rotates it; click a nearby cyan
socket to install it. Shape and weave must match. The finale has three linked gates and
needs rotation and every installation. Shapes and layouts stay fixed on reset so observation
is useful; they are irregular pieces rather than new random answers on each attempt.

G014's red blocks cast shadows away from the sun. Clicking one collapses it and raises
every cell in its shadow by one layer. White pips show height; blue inset edges mark
depressions. Flatten the whole board. Space rotates the sun; a collapse rotates it too.
The larger board and pixel sweep show where material goes.

G024's first four mazes take 14, 19, 22, and 41 actions in the solver. Each requires its
control-changing wrappers. The later four pocket puzzles still require removing and
reordering wrappers. G010 starts with a radius-four view (49 cells), then shrinks to three
and one as oil falls; all six maps and fuel budgets remain.

G011's native frames move one pixel at a time. Seven tile maps lead into two 64-by-64
collision maps with thin barriers and stopping points between the former tile boundaries.
Those two maps need 12 and 13 slides. The website locks input during computation and
playback, including rapid key presses before React has updated the buttons. The browser
check sent Right then Down immediately: only one action was accepted and the movement
buttons stayed disabled during the slide.

The seven newly changed games contain 58 levels. Each passes source and packaged engine
replays. Focused tests reject the narrower lantern view, discontinuous tubes, changed
crossing order, missing wrappers, removed shears, wrong same-color shapes, and mismatched
cloth weaves. The new cloth finale cannot win without rotation or installation.

## How G047 works

Move the red character with the arrow keys. Touch a colored station to select its mirror.
Space turns the selected mirror clockwise; it stays selected when you walk away.
Its colored beam extends in a straight line until a wall stops it. Aim a live beam at the
green exit, then walk onto the exit. Exploration remains visible, so you can plan the route.
The mirrors reveal and illuminate paths; they do not teleport the character.

The board is now white and the player remains visible outside beams. Duplicated reflection
panels and unrelated decorative clutter were removed. The seven puzzles preserve their
progression from simple exploration to coordinated mirror turns.

## How G044 works

The map is the six faces of a cube laid flat. Walking across certain outer edges moves
you to the edge that would touch it when the cube is folded. Matching colors mark those
paired edges. Your heading rotates with the crossing, which explains the apparent teleport.
Collect all six orange keys and enter the green exit. Blue arrow tiles accept entry only
in the arrow's direction. The minimap keeps your current face visible while the larger board scrolls.

Level 3's key placement was adjusted. A counterfactual solver that disables folded-edge
crossings cannot finish it; the one-way lips also increase its required route length.
The underlying cube mechanic already mattered before this update; the main change makes it legible.

## Validation

- All 237 levels in the 32 changed canonical games pass their solvers and real ARCEngine
  replays in both source and packaged form. G512's eight levels pass real engine replays,
  exact reveal-budget checks, and omission tests for every required aperture: 245 levels total.
- Focused checks cover variable speeds and crossing collisions, snake body blocking,
  volatile mass loss, triangle adjacency, fold order, painting progression, beam splitting,
  ferry waiting, currents/magma, coolant, automatic water flow, mixed recipes, and wake-up timing.
- Square-topology checks, G013/G020 mutation checks, G178's new finale checks, cube camera
  visibility on every solution step, and G047's persistent exploration checks pass.
- Publication integrity passes for all 94 local catalog entries. All 44 contributed games
  pass their smoke check. Generated sources, frames, action maps, mechanics, and registry agree.
- Public-ID tests pass against all 94 local and 931 fetched upstream entries. Four animation
  unit tests cover final-frame fidelity, immutability, native sequences, and bypass behavior.
- Production build passes. Boards were rendered and visually inspected. Browser checks use
  the built client and real catalog/router; painting progression, triangle movement, mirror
  movement/undo, and mouse-only ball routing were exercised. G036 advances from its
  six-move opening into lesson two; G011 rejects extra keys during native slide playback.
- The full TypeScript check reports 12 errors in unchanged SnakeBench, ingestion, repository,
  stream-test, test-setup, and placement-test files. It reports none in the changed files.

## Findings and design choices

G026's original level 6 passed its engine verifier. The update makes active danger and
collisions clear, improves teaching, and adds a harder seventh level.

G034's reported progression bug was not reproduced: the live site advanced from level 1 to
level 2, and all eight levels advance in local engine replays. The added comparison and
mismatch feedback makes an incorrect stamp easier to find; exact equality still advances automatically.

G045 has a changing portal schedule, not a character-facing requirement. Step into a mouth
to cross; Space waits in place without crossing. G045/G178 use six-pixel cells, G136 uses
five-pixel cells, and G044 uses seven-pixel cells. Larger maps use scrolling where needed;
these sizes describe tiles rather than replacing every puzzle with a 5-by-5 board.

G155 is the corrected ID for the fog-and-biting feedback originally labeled G115. G171
uses the suggested mixing and removable-plug mechanics; a race mode was not added.
G162 keeps the original body sizes and puzzles while expanding its wake-up presentation.

## Public names and delivery

The 34 names above follow the requested two-letter/two-digit format. Gallery labels, player
headers, Next links, and page metadata use them. Old URLs still work; canonical engine IDs,
saves, and telemetry retain their identities. No collisions were found in the checked catalogs.

- [Canonical game changes — PR 26](https://github.com/sonpham-org/autoresearch-arena/pull/26)
- [Website, animations, and public names — PR 463](https://github.com/82deutschmark/arc-explainer/pull/463)

Both branches are `codex/game-feedback-20260912`. Canonical baseline: `00bb23a`.
Website baseline at review: `0fdbc177`. The user authorized publication on September 14.
See `2026-09-14-reviewed-games-release-plan.md` for integration with the current site and
the final release checks; the linked PRs record merge status.
