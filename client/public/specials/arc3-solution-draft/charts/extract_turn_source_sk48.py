#!/usr/bin/env python3
"""Author: Claude Sonnet 5.5 Low
Date: 08-November-2026
PURPOSE: Extract the SK48 (Skewer Kebabs) turn for the second "one turn" figure of the Turducken special into
charts/turn-source-sk48.json. It is the same saved run as the LS20 figure (20261023_1410_daniel-candnp3-a, the
56.02 package's twin, read from the Railway volume with the arc3-site-access route A), game index 33. The turn is
step file game-33-step-29.json: the model works out that the strip along the bottom of the screen is the goal picture,
plans six moves and clears level 1 on the sixth.
Boards: moves 1 to 5 are the run's recorded frames 133 to 137 (game-33-frames.json). The recording keeps one frame per move,
so the clearing move's own frames come from replaying the run's recorded level-1 actions on the real SK48 engine
(arcengine plus the public game file); the replay is checked frame by frame against the recording, and its last frame
must equal the recorded level-2 board. The clearing move returns the engine's real animation (the three blocks blink, then
level 2), stored here as frame deltas.
Usage: python3.14 extract_turn_source_sk48.py <RUN_DIR> <SK48_GAME_PY>   (needs the arcengine package)
SRP/DRY check: Pass - extract only; make_turn_player_sk48.py reads the file this writes.
"""
import importlib.util, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
run, game_py = Path(sys.argv[1]), sys.argv[2]
STEP_FILE, FIRST, CLEAR = 29, 133, 138      # step file; first move's frame index; the clearing move's frame index
ov = json.loads((run / 'run-overview.json').read_text())
chars = ov['color_chars']
asc = lambda b: '\n'.join(''.join(chars[v] for v in row) for row in b)
frames = json.loads((run / 'game-33-frames.json').read_text())['frames']
step = json.loads((run / f'game-33-step-{STEP_FILE}.json').read_text())['step']
secs = {s['label']: s['content'] for s in step['context']['sections']}
assert list(secs) == ['SYSTEM PROMPT', 'USER PROMPT', 'THINKING', 'TOOL CALL: python', 'TOOL RESULT: python']
assert asc(step['absorbedFrames'][0]['board']) == frames[FIRST - 1]['board_ascii'], 'turn board is not the frame before move 1'
rec = frames[FIRST:CLEAR + 1]
assert [f['analysis_step'] for f in rec] == [30] * 6 and rec[-1]['level_completed'] and rec[-1]['level'] == 2

spec = importlib.util.spec_from_file_location('sk48mod', game_py)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
from arcengine import ActionInput, GameAction
cls = next(v for v in vars(mod).values() if isinstance(v, type) and issubclass(v, mod.ARCBaseGame) and v is not mod.ARCBaseGame)
game = cls()
names = {'UP': GameAction.ACTION1, 'DOWN': GameAction.ACTION2, 'LEFT': GameAction.ACTION3, 'RIGHT': GameAction.ACTION4, 'UNDO': GameAction.ACTION7}
for f in frames[:CLEAR + 1]:
    a = f['action_display']
    if a == 'RESET':
        continue
    m = re.match(r'MOUSE\(row=(\d+), col=(\d+)\)', a)
    inp = ActionInput(id=GameAction.ACTION6, data={'x': int(m.group(2)), 'y': int(m.group(1))}) if m else ActionInput(id=names[a])
    res = game.perform_action(inp, raw=False)
    if f['frameIndex'] < CLEAR:
        assert asc(res.frame[-1]) == f['board_ascii'], f'engine differs from the recording at frame {f["frameIndex"]}'
assert asc(res.frame[-1]) == frames[CLEAR]['board_ascii'], 'engine level-2 frame differs from the recording'

ef = [asc(x) for x in res.frame]            # the clearing move's frames, first to last
delta = lambda a, b: [[r, q, b.split('\n')[r][q]] for r in range(64) for q in range(64) if a.split('\n')[r][q] != b.split('\n')[r][q]]
moves = [{'action': f['action_display'], 'board': f['board_ascii']} for f in rec[:5]] + [{'action': 'RIGHT', 'board': ef[0]}]
anim = [delta(ef[i - 1], ef[i]) for i in range(1, len(ef))]
pal = list(ov['arc_palette'])
T = {'system': secs['SYSTEM PROMPT'], 'user': secs['USER PROMPT'], 'think': secs['THINKING'],
     'call': secs['TOOL CALL: python'], 'result': secs['TOOL RESULT: python']}
(HERE / 'turn-source-sk48.json').write_text(json.dumps({
    'provenance': {'run': run.name, 'site': 'arc3.sonpham.net, Railway volume /srv/data/' + run.name + '/', 'game': 'sk48-d8078629',
                   'step_file': f'game-33-step-{STEP_FILE}.json', 'frames': 'game-33-frames.json frames 133 to 138, clearing move from an engine replay'},
    'palette': pal, 'color_chars': chars, 'text': T, 'before': frames[FIRST - 1]['board_ascii'],
    'moves': moves, 'anim': anim, 'next': ef[-1].replace('\n', '')}, separators=(',', ':')))
print('wrote turn-source-sk48.json', len(ef), 'engine frames,', sum(len(a) for a in anim), 'animation cells')
