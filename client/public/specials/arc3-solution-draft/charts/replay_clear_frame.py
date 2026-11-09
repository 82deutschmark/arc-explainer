#!/usr/bin/env python3
"""Author: Claude Sonnet 5.5 Low
Date: 08-November-2026
PURPOSE: Make charts/clear-frame.json for the one-turn figure: the first frame of level 2, the frame that follows the level-1
clearing move. This replays the run's recorded level-1
actions (game-18-frames.json from the saved run 20261023_1410_daniel-candnp3-a) on the real LS20 engine (arcengine plus the
public LS20 game file), checks both engine frames of the clearing move against the recording and the figure, and writes the level-2 frame.
Run: python3.14 replay_clear_frame.py <FRAMES_JSON> <LS20_GAME_PY>   (needs the arcengine package)
SRP/DRY check: Pass - only this step; make_turn_player.py reads the json it writes.
"""
import importlib.util, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
frames_json, game_py = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location('ls20mod', game_py)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
from arcengine import ActionInput, GameAction
ts = json.loads((HERE / 'turn-source.json').read_text()); ch = ts['color_chars']
names = {'UP': GameAction.ACTION1, 'DOWN': GameAction.ACTION2, 'LEFT': GameAction.ACTION3, 'RIGHT': GameAction.ACTION4}
rec = json.loads(Path(frames_json).read_text())['frames']
game = mod.Ls20()
for f in rec:
    if f['action_display'] not in names:      # the RESET frame
        continue
    res = game.perform_action(ActionInput(id=names[f['action_display']]), raw=False)
    if f.get('level_completed'):
        break
asc = lambda b: '\n'.join(''.join(ch[v] for v in row) for row in b)
# The recording keeps one frame per move: for the clearing move that is the settled level-2 frame (engine frame 2); the engine
# also returns the frame with the player at the door (frame 1), which the figure already shows from the run's step file.
assert len(res.frame) == 2 and asc(res.frame[1]) == f['board_ascii'], 'engine does not match the recording'
assert asc(res.frame[0]) == ts['moves'][-1]['board'], 'engine door frame does not match the figure'
(HERE / 'clear-frame.json').write_text(json.dumps({
    'about': "First frame of LS20 level 2, as returned by the real LS20 engine right after the level-1 clearing move.",
    'board': asc(res.frame[1])}, indent=1))
print('wrote clear-frame.json')
