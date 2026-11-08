"""Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Extract the saved turn shown by the "One turn of the harness" player in Son Pham's "Stuffing the
Turducken" special (make_turn_player.py) into charts/turn-source.json. Son's fourth note on the figure
(8 Nov): use a simpler game, like LS20. So the figure now shows the game Locksmith (ls20-9607627b), level 1,
from the same saved run as before, run 20261023_1410_daniel-candnp3-a on arc3.sonpham.net (the GCP twin of
the 56.02 package; Railway volume /srv/data/<run>/, read with the arc3-site-access route A):
  - turn A: step file game-18-step-14.json (the site's "Step 15"): the model counts its step budget and walks
    the block six moves up to the locked box, one action() per move, printing each move's result;
  - turn B: game-18-step-15.json ("Step 16"): it guesses the matching code unlocks the box and spends its
    last move on UP, which clears level 1.
Boards are the run's recorded frames (game-18-frames.json frames 39 to 45) and, for the clearing move, the
first frame of its recorded animation (game-18-step-16.json), the block inside the box; the last animation
frame is already level 2.

Usage: python3 extract_turn_source.py <SRC_DIR>
  SRC_DIR holds run-overview.json, PUBLISH_RECEIPT.json and the game-18-*.json files (working copy:
  /Volumes/Team 4TB/data/turducken-r11/src). The output is committed, so the player is reproducible and
  auditable without the run.
SRP/DRY check: Pass - replaces the extract stage of the retired make_turn_walkthrough.py (Reaching Lurch,
with a retired image render); make_turn_player.py only reads the file this writes.
"""

from pathlib import Path
import json
import sys

HERE = Path(__file__).resolve().parent
OUT = HERE / 'turn-source.json'
RUN = '20261023_1410_daniel-candnp3-a'
GAME = 'game-18'
TURN_A, TURN_B = 14, 15            # step files; the site titles them "Step 15" and "Step 16"
LABELS = ['SYSTEM PROMPT', 'USER PROMPT', 'THINKING', 'TOOL CALL: python', 'TOOL RESULT: python']


def main(src: Path):
    ov = json.loads((src / 'run-overview.json').read_text())
    chars = ov['color_chars']
    load = lambda n: json.loads((src / f'{GAME}-step-{n}.json').read_text())['step']
    a, b, c = load(TURN_A), load(TURN_B), load(TURN_B + 1)
    fr = json.loads((src / f'{GAME}-frames.json').read_text())
    frames = {f['frameIndex']: f for f in fr['frames']}

    text = {}
    for turn, pre in ((a, ''), (b, 'next_')):
        secs = turn['context']['sections']
        assert [s['label'] for s in secs] == LABELS, [s['label'] for s in secs]
        for key, s in zip(['system', 'user', 'think', 'call', 'result'], secs):
            text[pre + key] = s['content']
    # One system prompt for the game: both turns carry the same text, shown once.
    assert text.pop('next_system') == text['system']

    ascii_of = lambda board: '\n'.join(''.join(chars[v] for v in row) for row in board)
    moves = [f for f in fr['frames'] if f.get('analysis_step') == a['analysisStep']]
    clear = [f for f in fr['frames'] if f.get('analysis_step') == b['analysisStep']]
    assert len(moves) == 6 and len(clear) == 1 and clear[0]['level_completed'], (len(moves), len(clear))
    first = moves[0]['frameIndex']
    # The board attached to turn A is the recorded frame before its first move; turn B's is A's last.
    assert ascii_of(a['absorbedFrames'][0]['board']) == frames[first - 1]['board_ascii']
    assert ascii_of(b['absorbedFrames'][0]['board']) == moves[-1]['board_ascii']

    # The clearing UP animates; its recorded frame is already level 2. Rebuild the animation from its
    # deltas ([row, col, colour index] triples per frame) and show its first frame: the block in the box.
    anim = c['animation']
    assert anim['actionNum'] == clear[0]['action_num'] and anim['before'] == moves[-1]['board_ascii']
    grid = [list(r) for r in anim['before'].split('\n')]
    boards = []
    for dl in anim['deltas']:
        for i in range(0, len(dl), 3):
            r, q, v = dl[i:i + 3]
            grid[r][q] = chars[v]
        boards.append('\n'.join(''.join(r) for r in grid))
    assert boards[-1] == clear[0]['board_ascii']

    out = {
        'provenance': {
            'run': RUN,
            'site': f'arc3.sonpham.net, Railway volume /srv/data/{RUN}/',
            'gcs_source': json.loads((src / 'PUBLISH_RECEIPT.json').read_text())['source'],
            'game_id': fr['game_id'], 'game_name': 'Locksmith', 'level': a['level'],
            'turn_a': {'step_file': f'{GAME}-step-{TURN_A}.json', 'site_step_title': a['title'],
                       'trace_timestamp_worker_clock': a['traceTimestamp']},
            'turn_b': {'step_file': f'{GAME}-step-{TURN_B}.json', 'site_step_title': b['title'],
                       'trace_timestamp_worker_clock': b['traceTimestamp']},
            'trace_provenance': a['traceProvenance'], 'trace_input_exact': a['traceInputExact'],
            'frames': f'{GAME}-frames.json frames {first - 1}-{clear[0]["frameIndex"]}; '
                      f'cleared board from the animation in {GAME}-step-{TURN_B + 1}.json',
        },
        'palette': ov['arc_palette'], 'color_chars': chars,
        'text': text,
        'before': frames[first - 1]['board_ascii'],
        # One entry per move, in order: six from turn A, then turn B's clearing move.
        'moves': [{'action': f['action_display'], 'board': f['board_ascii']} for f in moves]
                 + [{'action': clear[0]['action_display'], 'board': boards[0]}],
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print('wrote', OUT, OUT.stat().st_size, 'bytes')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
