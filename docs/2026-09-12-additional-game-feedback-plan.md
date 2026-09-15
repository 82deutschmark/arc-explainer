# Additional game feedback — 12 September 2026

Completed in the existing draft PRs. Seven additional games contain 58 verified levels,
including eight new levels. G017, G019, and G043 retain square movement.

## Fourth feedback round

G017, G019, and G043 retain their already-verified square movement. The shared action
animation also remains enabled throughout the community player.

G036 now starts with a six-move cord path and a green anchor: press Space at the anchor to
pull tight. A browser replay reaches lesson two after six moves and Space. The second lesson teaches one crossing. Both strands must pass through it;
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


Production build, publication integrity, aliases, and animation tests pass. Full TypeScript checking still reports the same 12 errors in unchanged files. See `2026-09-12-game-feedback-plan.md` for combined results and the 34 public names. The September 14 publication is recorded in `2026-09-14-reviewed-games-release-plan.md` and PR 463.
