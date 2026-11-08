"""Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Render the "One turn of the harness" figure of Son Pham's "Stuffing the Turducken" special
(section 1.1, "How the harness works", in client/public/specials/2026-11-06-arc3-solution-draft.html).
Son asked (8 Nov) for a walkthrough built from ACTUAL model output: the system prompt, the board the
model saw on the left, its reasoning, its tool calls and their real output, then the action() call
applied to the board on the right.

Everything shown comes from one saved turn of the GCP twin board run of the 56.02 package
(run 20261023_1410_daniel-candnp3-a on arc3.sonpham.net, Railway volume /srv/data/<run>/; source
gs://cellens-ai-artifacts/arc3-duck/daniel-base/runs/daniel-hicache-bint8v3sc2l32t5candnp3-a-1011):
game 24, Reaching Lurch (r11l-495a7899), level 2, step file game-24-step-10.json (the site's
"Step 11", analysis step 11), plus the first tool call of the next turn (game-24-step-11.json) for
the notes beat. Boards are the run's recorded frames (game-24-frames.json, frames 12 to 22) and the
recorded animation of the level-clearing click (the step-11 file's animation deltas).

Two stages:
  extract  python3.13 make_turn_walkthrough.py extract <SRC_DIR>
           reads the saved run files (run-overview.json and run/game-24-*.json under SRC_DIR) and
           writes charts/turn-source.json: the verbatim text sections and the boards (committed, so
           the render is reproducible and auditable without the 590 MB run).
  render   python3.13 make_turn_walkthrough.py [OUT_DIR]
           draws every beat in two layouts (wide for desktop, tall for phones) and packs them with
           img2webp into charts/turn-wide.webp and charts/turn-tall.webp, plus the still
           charts/turn-still.png (final state, for the Kaggle Markdown). Frames go under OUT_DIR on
           the Team 4TB drive (never committed).
The verbatim rule is enforced in code: every piece of model or harness text drawn must be an exact
substring of its source section in turn-source.json, and a trim is always drawn as a visible "…".
Text in coloured chips and in the yellow note box is ours (labels and explanations), never the model's.
Since 8 Nov (Round 10, Claude Opus 5.5 Medium) only the extract stage is in use: the figure is the in-page
player built by make_turn_player.py, and the image render below is retired (its webp files are deleted).
SRP/DRY check: Pass - fonts, palette and colour helpers are imported from make_trim_animation.py (the
Context management animation); packing follows its img2webp route; no other script draws this figure.
"""

from pathlib import Path
from multiprocessing import Pool
import json
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from make_trim_animation import (FONTS, BG, SURFACE, INK, INK2, MUTED, LINE, SYS, NOTES,  # noqa: E402
                                 NOTES_INK, NOTES_EDGE, DECODE, CACHED, KEEP, KEEP_INK, TRIM, SWAP,
                                 RAM, rgb, mix)

SOURCE = HERE / 'turn-source.json'
RUN = '20261023_1410_daniel-candnp3-a'
GAME_FILE = 'game-24'
STEP_FILE, NEXT_STEP_FILE = 10, 11
BEFORE_FRAME, LAST_LEVEL2_FRAME, LEVEL3_FRAME = 12, 21, 22
SUPER = 2                 # supersampling before the final downsample
OUT_SCALE = 1.5           # output pixels per design unit (sharp on retina screens)
NOTE_BG, NOTE_EDGE = '#fff4c9', '#d6a80e'   # our explanation box (not model text)
ELLIPSIS = '…'


# ---------------------------------------------------------------- extract ------------------------

def extract(src: Path):
    """Copy the verbatim sections and boards of the chosen turn into turn-source.json."""
    ov = json.loads((src / 'run-overview.json').read_text())
    run = src / 'run'
    step = json.loads((run / f'{GAME_FILE}-step-{STEP_FILE}.json').read_text())['step']
    nxt = json.loads((run / f'{GAME_FILE}-step-{NEXT_STEP_FILE}.json').read_text())['step']
    frames = {f['frameIndex']: f for f in json.loads((run / f'{GAME_FILE}-frames.json').read_text())['frames']}
    chars = ov['color_chars']

    secs = step['context']['sections']
    labels = [s['label'] for s in secs]
    assert labels == ['SYSTEM PROMPT', 'USER PROMPT', 'THINKING', 'TOOL CALL: python', 'TOOL RESULT: python',
                      'THINKING', 'TOOL CALL: python', 'TOOL RESULT: python'], labels
    names = ['system', 'user', 'think1', 'call1', 'result1', 'think2', 'call2', 'result2']
    text = {n: s['content'] for n, s in zip(names, secs)}
    nsecs = nxt['context']['sections']
    text['next_user'] = nsecs[1]['content']
    text['next_call'] = next(s['content'] for s in nsecs if s['label'].startswith('TOOL CALL'))

    def ascii_of(board):
        return '\n'.join(''.join(chars[v] for v in row) for row in board)

    # The board attached to the model's turn must be the recorded frame we call "before".
    assert ascii_of(step['absorbedFrames'][0]['board']) == frames[BEFORE_FRAME]['board_ascii']
    clicks = [frames[i] for i in range(BEFORE_FRAME + 1, LEVEL3_FRAME + 1)]
    assert all(f['analysis_step'] == step['analysisStep'] for f in clicks)

    # The level-clearing click animates; frame 22 is already level 3. Rebuild the recorded animation
    # from its deltas ([row, col, colour index] triples per animation frame) to get the solved board.
    anim = nxt['animation']
    assert anim['before'] == frames[LAST_LEVEL2_FRAME]['board_ascii']
    grid = [list(r) for r in anim['before'].split('\n')]
    anim_boards = []
    for dl in anim['deltas']:
        for i in range(0, len(dl), 3):
            r, c, v = dl[i:i + 3]
            grid[r][c] = chars[v]
        anim_boards.append('\n'.join(''.join(r) for r in grid))
    assert anim_boards[-1] == frames[LEVEL3_FRAME]['board_ascii']

    out = {
        'provenance': {
            'run': RUN,
            'site': f'arc3.sonpham.net, Railway volume /srv/data/{RUN}/',
            'gcs_source': json.loads((src / 'PUBLISH_RECEIPT.json').read_text())['source'],
            'game_index': 24, 'game_id': json.loads((run / f'{GAME_FILE}-frames.json').read_text())['game_id'],
            'step_file': f'{GAME_FILE}-step-{STEP_FILE}.json', 'site_step_title': step['title'],
            'analysis_step': step['analysisStep'], 'level': step['level'],
            'trace_timestamp_worker_clock': step['traceTimestamp'],
            'trace_provenance': step['traceProvenance'], 'trace_input_exact': step['traceInputExact'],
            'next_step_file': f'{GAME_FILE}-step-{NEXT_STEP_FILE}.json',
            'frames': f'{GAME_FILE}-frames.json frames {BEFORE_FRAME}-{LEVEL3_FRAME}',
        },
        'palette': ov['arc_palette'], 'color_chars': chars,
        'text': text,
        'before': frames[BEFORE_FRAME]['board_ascii'],
        'clicks': [{'action': f['action_display'], 'board': f['board_ascii'], 'level': f['level']}
                   for f in clicks],
        'solved': anim_boards[1],   # first animation frame after the click: both knobs in their rings
    }
    SOURCE.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print('wrote', SOURCE, SOURCE.stat().st_size, 'bytes')


# ---------------------------------------------------------------- content ------------------------
# A beat is one panel of the walkthrough. Its items are drawn top to bottom in the text panel:
#   ('chip', label, colour)   our label for the part that follows (not model text)
#   ('prose'|'code'|'out', section, text)   verbatim text; must be a substring of SRC['text'][section]
#   ('cut',)                  a visible trim: "…"
# 'note' is our explanation box; 'right' says what the right-hand board shows.

def beats(src):
    T = src['text']
    res2 = T['result2'].split('\n')
    return [
        dict(key='prompt', title='System prompt', sub='The top of this game\'s conversation (excerpt)',
             items=[
                 ('chip', 'game rules', SYS),
                 ('prose', 'system', 'You are a coding agent solving a grid-based puzzle game.'),
                 ('prose', 'system', '- Your job is to solve the entire game by clearing every level, not just the current screen.'),
                 ('cut',),
                 ('chip', 'notes memory', NOTES),
                 ('prose', 'system', 'NOTES FOR THE WHOLE GAME: in every python call, `notes` is one markdown text that persists for this game'),
                 ('cut',),
                 ('prose', 'system', 'It survives tool timeouts, level changes, summaries and history trims; ordinary variables and files do not.'),
                 ('cut',),
                 ('chip', 'one tool, own functions', CACHED),
                 ('prose', 'system', '- You have exactly one tool: `python`.'),
                 ('prose', 'system', 'Eligible functions you define are retained automatically for later calls throughout this game, including across level changes'),
                 ('cut',),
             ],
             note='The system prompt opens every game\'s conversation and is kept through every trim. The chips mark the parts the harness features below depend on.'),
        dict(key='turn', title='The turn message and the board', sub='What the harness sends this turn (excerpt)',
             items=[
                 ('prose', 'user', 'Current state: step 13, level 2.'),
                 ('prose', 'user', 'Valid actions right now: MOUSE.'),
                 ('cut',),
                 ('chip', 'own functions, listed back', CACHED),
                 ('prose', 'user', 'Your retained functions from earlier Python calls in this game: center_of(n), centers(frame), snap(f), build(frames), blocked_set(), diamond(c, r=2), blob5(c), ok_cell(c, b, kind), fl_mean(pts), sep(a, b, d=6).'),
                 ('cut',),
                 ('prose', 'user', 'Current grid image:'),
                 ('prose', 'user', '[image attached]'),
             ],
             note='Own functions: ten helpers the model wrote on earlier turns come back by name, still defined. The board on the left is the image it gets.'),
        dict(key='think1', title='The model reasons', sub='Its thinking, verbatim',
             items=[('prose', 'think1', line) for line in T['think1'].split('\n') if line.strip()],
             note='It plans to write two new helpers in a form the harness can keep for later turns.'),
        dict(key='call1', title='Tool call: python, then it runs', sub='The snippet it sent, and what came back',
             items=[
                 ('chip', 'tool call: python', DECODE),
                 ('code', 'call1', 'def masks():'),
                 ('code', 'call1', '    B=blocked_set()'),
                 ('cut',),
                 ('code', 'call1', 'def simulate(clicks,B,K):'),
                 ('code', 'call1', "    slots={'A':(6,17),'B':(9,49),'C':(21,8),'D':(26,10),'E':(48,54)}"),
                 ('cut',),
                 ('code', 'call1', 'clicks=[(48,54),(13,57),(26,10),(23,57),(6,17),(58,42),(9,49),(34,40),(21,8),(61,38)]'),
                 ('code', 'call1', 'st,sel,log=simulate(clicks,B,K)'),
                 ('cut',),
                 ('chip', 'result', RAM),
                 ('out', 'result1', "('select', 'E')"),
                 ('out', 'result1', "('move', 'E', (13, 57), 'ko', (12, 24), 'kp', (19, 33))"),
                 ('cut',),
                 ('out', 'result1', 'FINAL ko (51, 40) kp (18, 57)'),
             ],
             note='It tests the plan in its own simulator, built on helpers from earlier turns. No move is played yet; masks() and simulate() are kept for later turns.'),
        dict(key='think2', title='The model reasons again', sub='Its thinking, verbatim (trimmed)',
             items=[
                 ('prose', 'think2', 'The simulation says the plan works: final ko = (51,40) (orange ring) and kp = (18,57) (purple ring).'),
                 ('prose', 'think2', 'Now execute with run_checked and expectations:'),
                 ('cut',),
                 ('prose', 'think2', 'One risk: the expectation checks happen after each action; if the game rejects a move (my model wrong), the check fails and run_checked stops ✓.'),
                 ('prose', 'think2', 'Let me go.'),
             ],
             note='Checked play: it writes down what each click should change, so a wrong rule stops the batch instead of wasting moves.'),
        dict(key='call2', title='Tool call: the moves, through action()', sub='run_checked plays each move with one action() call',
             items=[
                 ('chip', 'tool call: python', DECODE),
                 ('code', 'call2', "M=lambda r,c:{'action':'MOUSE','row':r,'col':c}"),
                 ('code', 'call2', 'clicks=[(48,54),(13,57),(26,10),(23,57),(6,17),(58,42),(9,49),(34,40),(21,8),(61,38)]'),
                 ('code', 'call2', "exp=[ {(12,24):'M',(37,32):'M'}, {(19,33):'M'}, {(19,33):'M'}, {(18,57):'M'},"),
                 ('cut',),
                 ('code', 'call2', 'moves=[(M(*c),e) for c,e in zip(clicks,exp)]'),
                 ('code', 'call2', 'print(run_checked(moves))'),
                 ('cut',),
             ],
             note='Each click is one action() call. The right board will show the real recorded game after each one.'),
        dict(key='run2', title='The moves run on the game', sub='Real output, one line per action(); the board on the right is the recorded game',
             items=[('chip', 'result', RAM)] + [('out', 'result2', line) for line in res2[:10]] + [
                 ('out', 'result2', res2[10]),
                 ('cut',),
             ],
             note='Each output line is one action() call. The right board is the recorded game after it; the orange box marks what changed.',
             note_done='Level cleared: both knobs sit in their rings. The nine expectations it checked all held; the tenth click cleared the level.'),
        dict(key='notes', title='Next turn: the notes', sub='The first tool call of the next turn, on level 3 (excerpt)',
             items=[
                 ('chip', 'notes memory', NOTES),
                 ('code', 'next_call', 'notes.append("""## Level 3 layout'),
                 ('cut',),
                 ('code', 'next_call', '- Same mechanics as L2 (knob=floor(mean), knob blob must avoid S/outside, click anchor=select, click empty=move selected slot).'),
                 ('cut',),
                 ('chip', 'own functions, listed back', CACHED),
                 ('prose', 'next_user', 'Your retained functions from earlier Python calls in this game:'),
                 ('cut',),
                 ('prose', 'next_user', 'masks(), simulate(clicks, B, K),'),
                 ('cut',),
             ],
             right='level3',
             note='What it learned on level 2 goes into its notes, and the new helpers are listed back. When context management trims old turns, notes and functions are what remain.'),
    ]


def check_verbatim(src, all_beats):
    """Refuse to draw anything that is not an exact piece of the saved trace."""
    for b in all_beats:
        for it in b['items']:
            if it[0] in ('prose', 'code', 'out'):
                sec, text = it[1], it[2]
                if text not in src['text'][sec]:
                    raise SystemExit(f'Not verbatim in {sec}: {text[:80]!r}')


# ---------------------------------------------------------------- drawing ------------------------

def load_font(name, size, weight, k):
    f = ImageFont.truetype(str(FONTS / name), max(1, round(size * k)))
    f.set_variation_by_axes([weight])
    return f


LAYOUTS = {
    # design units; text panel and boards placed per layout
    'wide': dict(W=1280, H=720, cell=5, prose=19, mono=17, title=27, sub=16, note=17, chip=13, line=1.42, lab=15,
                 left=(28, 116), right=(932, 116), text=(372, 96, 908, 640), note_box=(28, 470, 348, 640),
                 info=(932, 470, 1252, 640), prog=(28, 668, 1252, 704)),
    'tall': dict(W=720, H=1350, cell=5, prose=25, mono=22, title=30, sub=18, note=22, chip=16, line=1.38,
                 lab=17, left=(30, 128), right=(370, 128), text=(14, 474, 706, 1160),
                 note_box=(14, 1170, 706, 1290), info=None, prog=(20, 1304, 700, 1336)),
}


class Painter:
    def __init__(self, L, palette, chars):
        self.L = L
        self.k = OUT_SCALE * SUPER
        self.im = Image.new('RGB', (round(L['W'] * self.k), round(L['H'] * self.k)), BG)
        self.d = ImageDraw.Draw(self.im)
        self.pal = {ch: tuple(int(x) for x in c[4:-1].split(',')) for ch, c in zip(chars, palette)}
        k = self.k
        self.f = {
            'title': load_font('Bitter.ttf', L['title'], 700, k),
            'sub': load_font('Inter.ttf', L['sub'], 450, k),
            'prose': load_font('Inter.ttf', L['prose'], 450, k),
            'mono': load_font('JetBrainsMono.ttf', L['mono'], 450, k),
            'note': load_font('Inter.ttf', L['note'], 500, k),
            'chip': load_font('Inter.ttf', L['chip'], 700, k),
            'lab': load_font('Inter.ttf', L['lab'], 650, k),
            'small': load_font('Inter.ttf', 13.5, 500, k),
            'num': load_font('Inter.ttf', 13, 700, k),
        }

    def s(self, *v):
        return [round(x * self.k) for x in v]

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, width=1, r=0):
        self.d.rounded_rectangle(self.s(x0, y0, x1, y1), radius=round(r * self.k), fill=fill,
                                 outline=outline, width=max(1, round(width * self.k)))

    def text(self, x, y, s, f, fill=INK, anchor='la'):
        self.d.text(self.s(x, y), s, font=self.f[f], fill=fill, anchor=anchor)

    def tw(self, s, f):
        return self.d.textlength(s, font=self.f[f]) / self.k

    def wrap(self, s, f, width):
        """Wrap s to width, breaking at spaces, or anywhere for long code tokens."""
        out = []
        for para in s.split('\n'):
            body = para.lstrip(' ')
            indent = para[:len(para) - len(body)]     # keep code indentation on the first line
            cur = indent
            for word in body.split(' '):
                cand = cur + word if not cur.strip() else cur + ' ' + word
                if self.tw(cand, f) <= width:
                    cur = cand
                    continue
                if cur:
                    out.append(cur)
                cur = word
                while self.tw(cur, f) > width:          # a single token wider than the line
                    n = len(cur)
                    while n > 1 and self.tw(cur[:n], f) > width:
                        n -= 1
                    out.append(cur[:n])
                    cur = cur[n:]
            out.append(cur)
        return out

    def board(self, x, y, ascii_, cell, dim=0.0):
        rows = ascii_.split('\n')
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                col = self.pal[ch]
                if dim:
                    col = rgb(mix('#%02x%02x%02x' % col, BG, dim))
                self.d.rectangle(self.s(x + c * cell, y + r * cell, x + (c + 1) * cell, y + (r + 1) * cell), fill=col)

    def out(self):
        L = self.L
        return self.im.resize((round(L['W'] * OUT_SCALE), round(L['H'] * OUT_SCALE)), Image.LANCZOS)


def changed_bbox(a, b):
    ra, rb = a.split('\n'), b.split('\n')
    cells = [(r, c) for r in range(64) for c in range(64) if ra[r][c] != rb[r][c]]
    if not cells:
        return None
    rs, cs = [p[0] for p in cells], [p[1] for p in cells]
    return min(rs), min(cs), max(rs), max(cs)


def draw_frame(L, src, all_beats, bi, reveal, right_state, highlight=None, click=None):
    """One frame: beat bi with its first `reveal` text lines shown; right_state names the right board."""
    p = Painter(L, src['palette'], src['color_chars'])
    beat = all_beats[bi]
    W, cell = L['W'], L['cell']
    gsz = 64 * cell

    # header
    hx = 28 if L is LAYOUTS['wide'] else 20
    p.rect(hx, 22, hx + 34, 56, fill=INK, r=7)
    p.text(hx + 17, 39, str(bi + 1), 'title', '#fffaf4', 'mm')
    p.text(hx + 46, 22, beat['title'], 'title', INK)
    p.text(hx + 46, 58, beat['sub'], 'sub', INK2, 'lm' if False else 'la')

    # boards
    lx, ly = L['left']
    rx, ry = L['right']
    p.text(lx, ly - 22, 'Board the model sees' if right_state != 'level3' else 'This turn\'s board (level 2)', 'lab', INK2)
    rlab = {'level3': 'Next turn: level 3', 'solved': 'After action(): level 2 cleared'}.get(right_state, 'After action()')
    p.text(rx, ry - 22, rlab, 'lab', KEEP_INK if right_state == 'solved' else INK2)
    p.rect(lx - 4, ly - 4, lx + gsz + 4, ly + gsz + 4, fill=SURFACE, outline=LINE, width=1.2, r=6)
    p.board(lx, ly, src['before'], cell)
    p.rect(rx - 4, ry - 4, rx + gsz + 4, ry + gsz + 4, fill=SURFACE, outline=LINE, width=1.2, r=6)
    if right_state is None:
        p.board(rx, ry, src['before'], cell, dim=0.78)
        p.text(rx + gsz / 2, ry + gsz / 2, 'no move yet', 'lab', MUTED, 'mm')
    else:
        board = {'solved': src['solved'], 'level3': src['clicks'][-1]['board'],
                 'before': src['before']}.get(right_state)
        if board is None:
            board = src['clicks'][right_state]['board']
        p.board(rx, ry, board, cell)
        if highlight:
            r0, c0, r1, c1 = highlight
            p.rect(rx + c0 * cell - 3, ry + r0 * cell - 3, rx + (c1 + 1) * cell + 3, ry + (r1 + 1) * cell + 3,
                   outline=TRIM, width=2.6, r=4)
        if click:
            r, c = click
            cx, cy = rx + (c + 0.5) * cell, ry + (r + 0.5) * cell
            p.d.ellipse(p.s(cx - 9, cy - 9, cx + 9, cy + 9), outline=rgb('#ffffff'), width=round(2.4 * p.k))
            p.d.ellipse(p.s(cx - 12, cy - 12, cx + 12, cy + 12), outline=rgb(TRIM), width=round(2 * p.k))
    # arrow between boards (tall layout: boards side by side)
    if L is LAYOUTS['tall']:
        ax = lx + gsz + (rx - lx - gsz) / 2
        p.text(ax, ly + gsz / 2, '→', 'title', MUTED, 'mm')

    # text panel
    x0, y0, x1, y1 = L['text']
    p.rect(x0, y0, x1, y1, fill=SURFACE, outline=LINE, width=1.2, r=8)
    tx, ty, tw = x0 + 16, y0 + 14, x1 - x0 - 32
    shown = 0
    for it in beat['items']:
        if shown >= reveal:
            break
        if it[0] == 'chip':
            w = p.tw(it[1].upper(), 'chip') + 16
            p.rect(tx, ty + 2, tx + w, ty + L['chip'] + 12, fill=it[2], r=4)
            ink = '#ffffff' if it[2] in (DECODE, RAM) else (NOTES_INK if it[2] == NOTES else INK2)
            p.text(tx + 8, ty + 2 + (L['chip'] + 10) / 2, it[1].upper(), 'chip', ink, 'lm')
            ty += L['chip'] + 20
            shown += 1
            continue
        if it[0] == 'cut':
            p.text(tx, ty, ELLIPSIS, 'prose', MUTED)
            ty += L['prose'] * L['line']
            shown += 1
            continue
        f = 'prose' if it[0] == 'prose' else 'mono'
        size = L['prose'] if f == 'prose' else L['mono']
        lines = p.wrap(it[2], f, tw - (14 if f == 'mono' else 0))
        for j, ln in enumerate(lines):
            if shown >= reveal:
                break
            ink = INK if it[0] != 'out' else '#3f5520'
            p.text(tx + (14 if j and f == 'mono' else 0), ty, ln, f, ink)
            if j and f == 'mono':   # continuation of a wrapped line: a short bar in the margin
                p.rect(tx + 2, ty + size * 0.25, tx + 5, ty + size * 1.05, fill=LINE, r=1)
            ty += size * L['line']
            shown += 1
        ty += 3
    if ty > y1 - 6:
        raise SystemExit(f'Text overflows the panel in beat {bi + 1} ({beat["key"]}), layout {L["W"]}')

    # our note
    nx0, ny0, nx1, ny1 = L['note_box']
    p.rect(nx0, ny0, nx1, ny1, fill=NOTE_BG, outline=NOTE_EDGE, width=1.4, r=8)
    note = beat.get('note_done') if right_state == 'solved' and beat.get('note_done') else beat['note']
    nlines = p.wrap(note, 'note', nx1 - nx0 - 28)
    ny = ny0 + 12
    for ln in nlines:
        p.text(nx0 + 14, ny, ln, 'note', INK)
        ny += L['note'] * 1.36
    if ny > ny1 - 4:
        raise SystemExit(f'Note overflows in beat {bi + 1}, layout {L["W"]}')

    # source line (wide layout has room beside the note)
    info = ('Real trace, not a mock-up: Reaching Lurch, level 2, one turn of the 56.02 twin run '
            f'{RUN} (site step 11). Chips and the yellow notes are ours; "…" marks a cut.')
    if L['info']:
        ix0, iy0, ix1, iy1 = L['info']
        iy = iy0 + 4
        for ln in p.wrap(info, 'small', ix1 - ix0):
            p.text(ix0, iy, ln, 'small', MUTED)
            iy += 19

    # progress: one dot per beat
    px0, py0, px1, py1 = L['prog']
    n = len(all_beats)
    step = (px1 - px0) / n
    for i, b in enumerate(all_beats):
        cx = px0 + step * (i + 0.5)
        on = i == bi
        p.d.ellipse(p.s(cx - 11, py0 + 7, cx + 11, py0 + 29), fill=rgb(INK if on else (LINE if i > bi else '#cdb49d')))
        p.text(cx, py0 + 18, str(i + 1), 'num', '#fffaf4' if on or i < bi else INK2, 'mm')
    return p.out()


# ---------------------------------------------------------------- timeline -----------------------

def item_units(L, src, beat):
    """Cumulative reveal units (chips, cuts and wrapped lines) after each item, for this layout."""
    p = Painter(L, src['palette'], src['color_chars'])
    tw = L['text'][2] - L['text'][0] - 32
    n, cum = 0, []
    for it in beat['items']:
        if it[0] in ('chip', 'cut'):
            n += 1
        else:
            f = 'prose' if it[0] == 'prose' else 'mono'
            n += len(p.wrap(it[2], f, tw - (14 if f == 'mono' else 0)))
        cum.append(n)
    return cum


def click_cell(action):
    """'MOUSE(row=48, col=54)' -> (48, 54)"""
    inner = action[action.index('(') + 1:-1]
    return tuple(int(part.split('=')[1]) for part in inner.split(', '))


def timeline(L, src, all_beats):
    """List of (frame args, duration ms). Lines appear one by one, then the beat holds to be read.
    Frame args: (beat, lines revealed, right board, changed-cells box, clicked cell)."""
    out = []
    for bi, b in enumerate(all_beats):
        cum = item_units(L, src, b)
        n = cum[-1]
        if b['key'] == 'run2':
            # One output line per click; the right board steps through the recorded frames.
            # Items: chip, ten '[action] ...' lines, the run_checked summary, a cut.
            prev = src['before']
            out.append(((bi, cum[0], 'before', None, None), 900))
            boards = [c['board'] for c in src['clicks'][:-1]] + [src['solved']]
            states = list(range(len(src['clicks']) - 1)) + ['solved']
            for ci, (board, state) in enumerate(zip(boards, states)):
                cell = click_cell(src['clicks'][ci]['action'])
                out.append(((bi, cum[ci], states[ci - 1] if ci else 'before', None, cell), 380))
                out.append(((bi, cum[ci + 1], state, changed_bbox(prev, board), cell), 700))
                prev = board
            out[-1] = (out[-1][0], 1800)
            out.append(((bi, n, 'solved', None, None), 4500))
            continue
        right = b.get('right')
        for k in range(1, n + 1):
            out.append(((bi, k, right, None, None), 170))
        chars = sum(len(it[2]) for it in b['items'] if it[0] in ('prose', 'code', 'out'))
        out[-1] = (out[-1][0], max(4500, min(9000, 2000 + chars * 22)))
    return out


def render_args(args):
    L_name, idx, fa = args
    L = LAYOUTS[L_name]
    src = json.loads(SOURCE.read_text())
    b = beats(src)
    bi, reveal, right, hl, click = fa
    im = draw_frame(L, src, b, bi, reveal, right, hl, click)
    path = OUT_DIR / L_name / f'f{idx:04d}.png'
    im.save(path)
    return idx


def main():
    src = json.loads(SOURCE.read_text())
    b = beats(src)
    check_verbatim(src, b)
    jobs, plans = [], {}
    for name in LAYOUTS:
        d = OUT_DIR / name
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        plan = timeline(LAYOUTS[name], src, b)
        plans[name] = plan
        jobs += [(name, i, fa) for i, (fa, _) in enumerate(plan)]
    with Pool(8) as pool:
        pool.map(render_args, jobs)
    for name, plan in plans.items():
        args = []
        for i, (_, dur) in enumerate(plan):
            args += ['-d', str(max(20, dur)), str(OUT_DIR / name / f'f{i:04d}.png')]
        target = HERE / f'turn-{name}.webp'
        subprocess.run(['img2webp', '-loop', '0', '-lossless', '-m', '4', *args, '-o', str(target)],
                       check=True, capture_output=True)
        print(name, 'frames', len(plan), 'seconds', round(sum(d for _, d in plan) / 1000, 1),
              'bytes', target.stat().st_size)
    # Still for the Kaggle Markdown: the wide layout at the end of the moves (level cleared).
    run_bi = next(i for i, x in enumerate(b) if x['key'] == 'run2')
    n = item_units(LAYOUTS['wide'], src, b[run_bi])[-1]
    draw_frame(LAYOUTS['wide'], src, b, run_bi, n, 'solved').save(HERE / 'turn-still.png', optimize=True)
    shutil.copy(__file__, OUT_DIR / Path(__file__).name)


OUT_DIR = Path('/Volumes/Team 4TB/data/turducken-r7/frames')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'extract':
        extract(Path(sys.argv[2]))
    else:
        if len(sys.argv) > 1:
            OUT_DIR = Path(sys.argv[1])
        main()
