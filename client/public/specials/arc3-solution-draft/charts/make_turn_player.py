"""Author: Claude Opus 5.5 Medium (pills, short reasoning and faster stream: Son's third note, same day; Locksmith turn: his fourth note)
        (inlined JetBrains Mono and the frame-step hook for make_turn_video.py: Claude Opus 5.5 Medium, Round 11)
        (light theme, Son's "I would prefer that the animations are light theme": Claude Opus 5.5 Low, Round 12)
Date: 08-November-2026
PURPOSE: Build the "One turn of the harness" figure of Son Pham's "Stuffing the Turducken" special
(section 1.1 of client/public/specials/2026-11-06-arc3-solution-draft.html) as a live in-page player.
Son's second note on the figure (8 Nov): one continuous transcript, colour-coded by block (system prompt
black, user prompt green, reasoning blue, tool call yellow, tool result a different yellow), monospace,
no page switching, streaming fast with the newest text always in view, and ONE game canvas that steps
through the recorded game as each move is reached. Look and feel follow the arc3.sonpham.net
run viewer's Decision pane (its "Review" trace: uppercase label bar tinted with the block colour, a
coloured left spine on a monospace pre-wrap body, the same colour roles and monospace stack).
Son's third note (8 Nov): show the text flowing really fast (the feel of how much goes by, about 15-25
seconds for the turn), tool calls as compact pills, reasoning shortened. So: every block types out at a
high rate; each tool call plays as a yellow pill holding the call name and ONE real line of its code
(click the pill to open the full verbatim call); reasoning keeps its real key lines with "…" for the rest.
The pills are a script-only view: without JavaScript each call shows as its full code block.
Round 12 (Son, 8 Nov): light theme from the article page's tokens. On light the hue moves from the label
text into the label bar fill (near-black label text), each body is a very light tint with a strong coloured
spine, the system block stays black, and the two yellows differ by darkness and spine style (bright gold
solid for the tool call, dark ochre dashed for the tool result).

Data: charts/turn-source.json (written by extract_turn_source.py from the saved run
20261023_1410_daniel-candnp3-a). Since Son's fourth note (8 Nov, "use a simpler game, like LS20") it is the
game Locksmith, level 1: the site's step 15 (six moves up to the locked box, one action() each) and step 16
(one more UP clears the level). Before that it was Reaching Lurch, level 2. Nothing here reads the run itself.

What it writes (run from anywhere: python3 make_turn_player.py):
  - the article page, between the turn-player markers: a <style> block in the head, and in the body
    the figure (full transcript as real HTML, a board fallback image, inline board data, inline player
    script). Without JavaScript (the review page strips scripts) the whole transcript and the cleared
    board still show. Inline because the fast-publish route does not accept .js or .css files.
  - charts/turn-board-cleared.png: the cleared level-2 board (no-JS fallback for the canvas).
  - charts/turn-still.png (with --still, needs Playwright): a screenshot of the player's final state for
    the Kaggle Markdown. Taken from the real page so there is one renderer.

The verbatim rule is enforced in code: every transcript line must be an exact substring of its saved
section, whole sections must reassemble exactly, and every trim is a visible "…" line. Block labels are
the trace's own section labels. Our own words (legend, board caption, harness notes in the label bars,
the stored-transcript notice) sit outside the block bodies.
SRP/DRY check: Pass - turn-source.json comes from extract_turn_source.py; no other script builds this figure.
"""

from html import escape
from pathlib import Path
import json
import re
import subprocess
import base64
import io
import sys

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = json.loads((HERE / 'turn-source.json').read_text())
PAGE = HERE.parent.parent / '2026-11-06-arc3-solution-draft.html'
BOARD_PNG = HERE / 'turn-board-cleared.png'
STILL_PNG = HERE / 'turn-still.png'
CUT = '…'
T = SRC['text']

# ---------------------------------------------------------------- transcript --------------------
# A block: (css kind, trace label, harness note or '', lines). A line is (section, text) for verbatim
# text, CUT for a visible trim, or ('step', k, section, text) for the result line of move k.
# A tool call block carries a fifth item: the one real line of its code shown in its pill.


def whole(sec):
    """A section shown in full, line by line."""
    return [(sec, ln) for ln in T[sec].split('\n')]


RES = T['result'].split('\n')
NRES = T['next_result'].split('\n')
MOVES = SRC['moves']          # six moves in turn A, then turn B's clearing UP

BLOCKS = [
    ('system', 'SYSTEM PROMPT', 'harness: game rules · notes memory · one tool · own functions', [
        ('system', 'You are a coding agent solving a grid-based puzzle game.'),
        CUT,
        ('system', '- Your job is to solve the entire game by clearing every level, not just the current screen.'),
        CUT,
        ('system', 'NOTES FOR THE WHOLE GAME: in every python call, `notes` is one markdown text that persists for this game'),
        CUT,
        ('system', 'It survives tool timeouts, level changes, summaries and history trims; ordinary variables and files do not.'),
        CUT,
        ('system', '- You have exactly one tool: `python`.'),
        CUT,
        ('system', 'Eligible functions you define are retained automatically for later calls throughout this game, including across level changes'),
        CUT,
    ]),
    ('user', 'USER PROMPT', 'harness: own functions listed back · diff image', [
        ('user', 'The code executed 4 actions in the previous sequence.'),
        ('user', 'Executed actions: DOWN, UP, DOWN, UP.'),
        CUT,
        ('user', 'You are still on the same level.'),
        ('user', 'Current state: step 40, level 1.'),
        ('user', 'Valid actions right now: UP, DOWN, LEFT, RIGHT.'),
        CUT,
        ('user', 'Your retained functions from earlier Python calls in this game: blockpos(frame), icon3(frame), win3(frame), pluscell(frame), cell(frame), nodesig(f). These are your previous definitions, available to call directly.'),
        CUT,
        ('user', 'Current grid image:'),
        ('user', ''),
        ('user', '[image attached]'),
        ('user', ''),
        ('user', 'Diff image (step 35 -> 39): cells that changed since your previous analyzer turn in their new true color; unchanged cells dimmed to dark navy (an off-palette color).'),
        ('user', ''),
        ('user', '[image attached]'),
    ]),
    ('think', 'THINKING', 'shortened', [
        ('think', "Now the icon is B (111001101) = the window's logo. 5 presses. Yellow = 20 - 4*2 = 12 px = 6 cols. So 6 actions left!"),
        ('think', 'Hmm, tight. To reach the neck from (1,1): UP (0,1), RIGHT (0,2), RIGHT (0,3), RIGHT (0,4), UP (neck), UP (top) = 6 actions exactly. Let\'s do it! If the win triggers, great.'),
        CUT,
        ('think', 'Let me just directly measure: yellow now = 12 px = 6 cols. If each successful action costs 1 col, we have 6 actions left. Let\'s use them wisely: the 6-action path to the neck top.'),
        ('think', "If we die, the level restarts and I'll know the budget better."),
        ('think', 'Let me go: UP, RIGHT, RIGHT, RIGHT, UP, UP.'),
        CUT,
        ('think', 'Let me execute one at a time to catch the win and stop early.'),
    ]),
    ('call', 'TOOL CALL: python', 'harness: one action() per move', whole('call'), "seq=['UP','RIGHT','RIGHT','RIGHT','UP','UP']"),
    # Every "[action]" line is one move on the game: the board steps there.
    ('result', 'TOOL RESULT: python', 'each [action] line is one move on the game', [
        ('step', n // 2, 'result', ln) if n % 2 == 0 else ('result', ln) for n, ln in enumerate(RES)
    ]),
    'NEXT',
    ('user', 'USER PROMPT', '', [
        ('next_user', 'The code executed 6 actions in the previous sequence.'),
        ('next_user', 'Executed actions: UP, RIGHT, RIGHT, RIGHT, UP, UP.'),
        ('next_user', 'You are still on the same level.'),
        ('next_user', 'Current state: step 46, level 1.'),
        CUT,
    ]),
    ('think', 'THINKING', 'shortened', [
        ('next_think', 'Yellow = 2 px = 1 col. The block is at the neck top with the logo matching the window. No win. So the "code + exit" hypothesis is wrong (or the exit is elsewhere).'),
        CUT,
        ('next_think', 'Hmm, so maybe the puzzle is: the glyph inside the box must be REMOVED so the block can enter the box and reach the top. How to remove the glyph? Maybe by pressing the plus (the code)? Hmm! Maybe the code (logo matching the window) unlocks the box, and then the block can enter!'),
        CUT,
        ('next_think', "Yellow = 2 px = 1 col. Let me spend it on UP. If it's blocked, we're at 0 → maybe game over → restart."),
        ('next_think', 'Let me do UP and see.'),
    ]),
    ('call', 'TOOL CALL: python', '', whole('next_call'), "r=action(['UP'])"),
    ('result', 'TOOL RESULT: python', '', [
        ('step', len(MOVES) - 1, 'next_result', NRES[0]),
        ('next_result', NRES[1]),
        CUT,
        ('next_result', NRES[-1]),
    ]),
]

LEGEND = [('system', 'System prompt'), ('user', 'User prompt'), ('think', 'Reasoning'),
          ('call', 'Tool call'), ('result', 'Tool result')]


def check_verbatim():
    """Refuse to build anything that is not an exact piece of the saved trace."""
    for b in BLOCKS:
        if b == 'NEXT':
            continue
        pos = {}
        for ln in b[3]:
            if ln == CUT:
                continue
            sec, text = ln[-2], ln[-1]
            if text not in T[sec]:
                raise SystemExit(f'Not verbatim in {sec}: {text[:80]!r}')
            at = T[sec].find(text, pos.get(sec, 0))   # shown lines keep the trace's order
            if at < 0:
                raise SystemExit(f'Out of order in {sec}: {text[:80]!r}')
            pos[sec] = at + len(text)
        if b[0] == 'call':
            pill, sec = b[4], b[3][0][-2]
            if pill not in T[sec].split('\n'):
                raise SystemExit(f'Pill line is not a whole line of {sec}: {pill!r}')
        secs = {ln[-2] for ln in b[3] if ln != CUT}
        if CUT not in b[3] and len(secs) == 1:
            sec = secs.pop()
            if '\n'.join(ln[-1] for ln in b[3]) != T[sec]:
                raise SystemExit(f'Whole section {sec} does not reassemble exactly')
    steps = [ln for b in BLOCKS if b != 'NEXT' for ln in b[3] if ln != CUT and ln[0] == 'step']
    assert [ln[1] for ln in steps] == list(range(len(MOVES))), [ln[1] for ln in steps]
    for ln in steps:   # each step line is the result line of that move
        assert ln[3].startswith(f"[action] {MOVES[ln[1]]['action']} -> "), ln


# ---------------------------------------------------------------- boards ------------------------

def board_data():
    """Boards as 64x64 strings of colour letters; each move as the cells it changed."""
    rows = lambda b: b.split('\n')
    prev, steps = SRC['before'], []
    for m in MOVES:
        pr, cr = rows(prev), rows(m['board'])
        delta = [[r, q, cr[r][q]] for r in range(64) for q in range(64) if pr[r][q] != cr[r][q]]
        steps.append({'a': m['action'], 'd': delta})
        prev = m['board']
    pal = {ch: [int(x) for x in rgb[4:-1].split(',')] for ch, rgb in zip(SRC['color_chars'], SRC['palette'])}
    return {'chars': SRC['color_chars'], 'pal': [pal[ch] for ch in SRC['color_chars']],
            'before': SRC['before'].replace('\n', ''), 'steps': steps}


def write_board_png():
    pal = {ch: tuple(int(x) for x in rgb[4:-1].split(',')) for ch, rgb in zip(SRC['color_chars'], SRC['palette'])}
    im = Image.new('RGB', (64, 64))
    im.putdata([pal[ch] for ch in MOVES[-1]['board'].replace('\n', '')])
    im.resize((512, 512), Image.NEAREST).save(BOARD_PNG, optimize=True)


# ---------------------------------------------------------------- html --------------------------

FONT_TTF = HERE / 'fonts' / 'JetBrainsMono.ttf'
# Latin, Latin-1, general punctuation (… · ’ “ ” — –), arrows (→) and the pill triangles (▸ ▾).
FONT_UNICODES = [*range(0x20, 0x7F), *range(0xA0, 0x100), *range(0x2010, 0x2028), *range(0x2190, 0x2194),
                 0x25B8, 0x25BE, 0x2212]


def font_face():
    """JetBrains Mono, subset and inlined as a data URI, so the player draws in the same typeface as the
    Context management animation (make_trim_animation.py bakes the same file). Inline because the
    fast-publish route takes no font files; the subset with its weight axis is about 25 KB of base64."""
    from fontTools import subset
    from fontTools.ttLib import TTFont
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = []
    font = TTFont(FONT_TTF)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=FONT_UNICODES)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return ('@font-face{font-family:"TP Mono";font-style:normal;font-weight:100 800;font-display:swap;'
            f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')


CSS = r'''
/* One turn of the harness: live transcript player (make_turn_player.py). Block look borrowed from the
   arc3.sonpham.net run viewer's Decision pane: label bar tinted with the block colour, coloured spine,
   monospace pre-wrap body. */
.tp{--tp-bg:#f1f3ef;--tp-panel:#fafbf9;--tp-chrome:#e9ece6;--tp-line:#d5d9d2;--tp-text:#15171a;--tp-dim:#3d434a;
  --tp-muted:#5f666d;--tp-sys:#000;--tp-user:#16a34a;--tp-think:#2563eb;--tp-call:#facc15;--tp-result:#b7791f;
  --tp-mono:"TP Mono","JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  background:var(--tp-bg);color:var(--tp-text);border:1px solid #a9b0a6;border-radius:6px;font:12px/1.5 var(--tp-mono);
  overflow:hidden;margin:4px 0 0}
.tp *{box-sizing:border-box}
.tp-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:7px 10px;background:var(--tp-chrome);border-bottom:1px solid var(--tp-line)}
.tp-run{color:var(--tp-text);font-weight:600;letter-spacing:.3px}
.tp-run span{color:var(--tp-muted);font-weight:400}
.tp-ctl{display:none;gap:6px;margin-left:auto}
.tp.tp-js .tp-ctl{display:flex}
.tp-ctl button{font:11px/1 var(--tp-mono);color:var(--tp-text);background:#fff;border:1px solid #a9b0a6;border-radius:4px;padding:5px 9px;cursor:pointer}
.tp-ctl button:hover{background:var(--tp-bg)}
.tp-ctl button:focus-visible{outline:2px solid var(--tp-think);outline-offset:1px}
.tp-legend{display:flex;flex-wrap:wrap;gap:4px 14px;padding:6px 10px;border-bottom:1px solid var(--tp-line);color:var(--tp-dim);font-size:11px}
.tp-legend i{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.tp-legend .k-system i{background:#000}
.tp-legend .k-user i{background:var(--tp-user)}.tp-legend .k-think i{background:var(--tp-think)}
.tp-legend .k-call i{background:var(--tp-call)}.tp-legend .k-result i{background:var(--tp-result)}
.tp-main{display:grid;grid-template-columns:290px 1fr;min-height:0}
.tp-board{padding:10px;border-right:1px solid var(--tp-line);background:var(--tp-panel)}
.tp-board img,.tp-board canvas{display:block;width:100%;height:auto;aspect-ratio:1;image-rendering:pixelated;border:1px solid var(--tp-line);border-radius:2px}
.tp-cap{margin-top:8px;color:var(--tp-dim);font-size:11px;min-height:3em}
.tp-cap b{color:var(--tp-text);font-weight:600}
.tp-log{height:470px;overflow-y:auto;overscroll-behavior:contain;background:var(--tp-panel);scrollbar-width:thin}
.tp-log:focus-visible{outline:2px solid var(--tp-think);outline-offset:-2px}
.tb{border-bottom:1px solid var(--tp-line)}
.tb-h{display:flex;gap:8px;align-items:baseline;padding:5px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
.tb-h .tb-n{margin-left:auto;text-transform:none;letter-spacing:0;font-weight:400;font-style:italic;opacity:.85;color:var(--tp-muted);text-align:right}
.tb-b{margin:0;padding:7px 10px 8px 12px;white-space:pre-wrap;word-break:break-word;font:12px/1.5 var(--tp-mono);color:var(--tp-dim);border-left:3px solid}
.tb-b .cut{color:var(--tp-muted)}
.tb-system .tb-h{background:#000;color:#fff}
.tb-system .tb-h .tb-n{color:#b4bac1}
.tb-system .tb-b{background:#111315;border-left-color:#000;color:#e4e7eb}
.tb-system .tb-b .cut{color:#a3aab2}
.tb-user .tb-h{background:color-mix(in srgb,var(--tp-user) 30%,#fff);color:#0b3d1d}
.tb-user .tb-b{background:color-mix(in srgb,var(--tp-user) 7%,#fff);border-left-color:var(--tp-user);color:#1c2a20}
.tb-think .tb-h{background:color-mix(in srgb,var(--tp-think) 24%,#fff);color:#0b2560}
.tb-think .tb-b{background:color-mix(in srgb,var(--tp-think) 6%,#fff);border-left-color:var(--tp-think);color:#1b2333}
.tb-call .tb-h{background:var(--tp-call);color:#1a1400}
.tb-call .tb-h .tb-n{color:#4d4006}
.tb-call .tb-b{background:color-mix(in srgb,var(--tp-call) 16%,#fff);border-left-color:#eab308;color:#2e2600}
.tb-result .tb-h{background:color-mix(in srgb,var(--tp-result) 34%,#fff);color:#3a2404}
.tb-result .tb-h .tb-n,.tb-user .tb-h .tb-n,.tb-think .tb-h .tb-n{color:#40464d}
.tb-result .tb-b{background:color-mix(in srgb,var(--tp-result) 9%,#fff);border-left-color:#8a5a12;border-left-style:dashed;color:#2f2414}
.tb-b .ln.step-on{background:color-mix(in srgb,var(--tp-result) 30%,transparent)}
.tp-next{padding:8px 10px;color:var(--tp-muted);font-size:11px;text-align:center;letter-spacing:.4px;border-bottom:1px solid var(--tp-line)}
.tp-note{padding:6px 10px;border-top:1px solid var(--tp-line);border-left:3px solid #d29922;background:var(--tp-chrome);color:var(--tp-dim);font-size:11px}
.tp-bar{height:3px;background:#dde1da}.tp-bar i{display:block;height:100%;width:0;background:var(--tp-think)}
.tp.tp-js .tb.tp-hide,.tp.tp-js .tp-next.tp-hide{display:none}
/* Tool calls as pills (script only; without it the full call block shows). */
.tb-prow{display:none}
.tp.tp-js .tb-call{border-bottom:0;padding:6px 10px 6px 12px;background:var(--tp-panel)}
.tp.tp-js .tb-call .tb-h,.tp.tp-js .tb-call .tb-b{display:none}
.tp.tp-js .tb-call.open .tb-b{display:block;margin-top:6px;border-radius:3px}
.tp.tp-js .tb-prow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-width:0}
.tb-pill{display:inline-flex;flex:0 0 auto;align-items:center;gap:8px;max-width:100%;font:12px/1.4 var(--tp-mono);color:#1a1400;
  background:var(--tp-call);border:0;border-radius:999px;padding:3px 12px 3px 4px;cursor:pointer;text-align:left}
.tb-pill:hover{background:#fde047}
.tb-pill:focus-visible{outline:2px solid #1a1400;outline-offset:2px}
.tb-pk{flex:0 0 auto;white-space:nowrap;background:#1a1400;color:var(--tp-call);border-radius:999px;padding:1px 8px;font-size:10px;letter-spacing:.6px;text-transform:uppercase;font-weight:600}
.tb-pk::before{content:"\25B8  "}
.tb-call.open .tb-pk::before{content:"\25BE  "}
.tp .tb-pill code{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;white-space:pre-wrap;word-break:break-word;min-width:0}
.tb-pn{flex:1 1 auto;min-width:0;color:var(--tp-muted);font-size:10.5px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:640px){
  .tp-main{grid-template-columns:1fr}
  .tp-board{border-right:0;border-bottom:1px solid var(--tp-line);display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:start;padding:8px}
  .tp-cap{margin-top:0}
  .tp-log{height:min(62vh,460px)}
  .tb-h .tb-n,.tb-pn{display:none}
  .tp-ctl{margin-left:0}
}
'''

JS = r'''
(function () {
  // One turn of the harness: streams the transcript and steps the board (make_turn_player.py).
  var root = document.querySelector('#fig-turn .tp');
  var dataEl = document.getElementById('turn-player-data');
  if (!root || !dataEl || root.classList.contains('tp-js')) return;
  var D = JSON.parse(dataEl.textContent);
  root.classList.add('tp-js');
  var log = root.querySelector('.tp-log'), cap = root.querySelector('.tp-cap'), bar = root.querySelector('.tp-bar i');
  var img = root.querySelector('.tp-board img');
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', img.getAttribute('alt'));
  img.replaceWith(cv);
  var g = cv.getContext('2d');
  var idx = {}; for (var i = 0; i < D.chars.length; i++) idx[D.chars[i]] = i;
  var grid = [];

  function paint() {
    for (var r = 0; r < 64; r++) for (var c = 0; c < 64; c++) {
      var p = D.pal[idx[grid[r * 64 + c]]];
      g.fillStyle = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')'; g.fillRect(c * 8, r * 8, 8, 8);
    }
  }
  var LAST = D.steps.length - 1;
  function setBoard(k) {   // k = -1: the board attached to the turn; k = 0..LAST: after move k
    grid = D.before.split('');
    for (var s = 0; s <= k; s++) D.steps[s].d.forEach(function (e) { grid[e[0] * 64 + e[1]] = e[2]; });
    paint();
    cap.innerHTML = k < 0 ? D.capStart
      : '<b>Move ' + (k + 1) + ' of ' + (LAST + 1) + '</b> · ' + D.steps[k].a
        + '<br>' + (k === LAST ? D.capEnd : k === LAST - 1 ? D.capWait : D.capStep);
  }

  // The stream: every line of every block, in order, typed out fast (the point is the feel of how
  // much text goes by); a tool call plays as its pill's one line; each action() result line steps
  // the board. Clicking a pill opens the full verbatim call.
  var units = [];
  [].forEach.call(log.children, function (el) {
    if (el.classList.contains('tp-next')) { units.push({ el: el, div: true }); return; }
    var kind = el.dataset.kind;
    if (kind === 'call') {
      var pb = el.querySelector('.tb-pill');
      pb.addEventListener('click', function () {
        var open = el.classList.toggle('open'); pb.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    [].forEach.call(el.querySelectorAll(kind === 'call' ? '.tb-pill .ln' : '.ln'), function (ln, n) {
      units.push({ el: ln, block: el, first: n === 0, text: ln.textContent, kind: kind,
                   step: ln.dataset.step === undefined ? null : +ln.dataset.step });
    });
  });
  // Characters per second by block kind; STEP is the beat on each move, GAP the beat between blocks.
  var CPS = { system: 900, user: 900, think: 200, call: 90, result: 700 }, STEP = 650, GAP = 240;
  var u = 0, shown = 0, wait = 0, playing = false, last = 0, follow = true, done = false;

  function reset() {
    units.forEach(function (x) {
      if (x.div) { x.el.classList.add('tp-hide'); return; }
      x.el.textContent = ''; x.opened = false; x.el.classList.remove('step-on'); x.block.classList.add('tp-hide');
      x.block.classList.remove('open');
    });
    u = 0; shown = 0; wait = 0; done = false; follow = true; setBoard(-1); log.scrollTop = 0; bar.style.width = '0';
  }
  function finish() {
    units.forEach(function (x) {
      if (x.div) { x.el.classList.remove('tp-hide'); return; }
      x.el.textContent = x.text; x.el.classList.remove('step-on'); x.block.classList.remove('tp-hide');
    });
    u = units.length; done = true; setBoard(LAST); bar.style.width = '100%'; log.scrollTop = log.scrollHeight;
    setPlaying(false); btnPlay.textContent = 'Replay';
  }
  // advance(dt): move the stream on by dt milliseconds. The page drives it from requestAnimationFrame;
  // the video capture (make_turn_video.py) drives it with a fixed dt per frame, so renders repeat exactly.
  function advance(dt) {
    var budget = dt;
    while (budget > 0 && u < units.length) {
      if (wait > 0) { var w = Math.min(wait, budget); wait -= w; budget -= w; continue; }
      var x = units[u];
      if (x.div) { x.el.classList.remove('tp-hide'); wait = GAP; u++; continue; }
      if (x.first && !x.opened) {   // a new block: show its label bar, then a short beat
        x.opened = true; x.block.classList.remove('tp-hide');
        if (u) { wait = GAP; continue; }
      }
      var cps = CPS[x.kind] || 600;                       // typed out
      var n = Math.min(x.text.length - shown, Math.max(1, Math.floor(budget * cps / 1000)));
      shown += n; budget -= n * 1000 / cps; x.el.textContent = x.text.slice(0, shown);
      if (shown < x.text.length) break;
      if (x.step !== null) {
        units.forEach(function (y) { if (y.el.classList) y.el.classList.remove('step-on'); });
        x.el.classList.add('step-on'); setBoard(x.step); wait = STEP;
      }
      u++; shown = 0;
    }
    bar.style.width = (100 * u / units.length) + '%';
    if (follow) log.scrollTop = log.scrollHeight;
    if (u >= units.length && wait <= 0) { finish(); return false; }
    return true;
  }
  function tick(now) {
    if (!playing) return;
    var dt = Math.min(100, now - last); last = now;
    if (advance(dt)) requestAnimationFrame(tick);
  }
  function setPlaying(p) {
    playing = p; btnPlay.textContent = p ? 'Pause' : 'Play';
    if (p) { last = performance.now(); requestAnimationFrame(tick); }
  }
  // Follow the newest text unless the reader scrolls up; scrolling back down resumes it.
  log.addEventListener('scroll', function () {
    follow = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
  });
  var ctl = root.querySelector('.tp-ctl');
  var btnPlay = ctl.querySelector('[data-a=play]');
  btnPlay.addEventListener('click', function () {
    if (done) { reset(); setPlaying(true); } else { if (!playing) follow = true; setPlaying(!playing); }
  });
  ctl.querySelector('[data-a=restart]').addEventListener('click', function () { reset(); setPlaying(true); });
  ctl.querySelector('[data-a=end]').addEventListener('click', finish);
  window.__turnPlayer = { finish: finish, reset: reset, play: function () { setPlaying(true); },
    step: function (dt) { playing = false; if (!done) advance(dt); return done; } };

  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || location.hash === '#turn-end') { finish(); return; }
  if (location.hash === '#turn-capture') { reset(); return; }   // frame-by-frame capture: no autoplay
  reset();
  var started = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es, ob) {
      es.forEach(function (e) { if (e.isIntersecting && !started) { started = true; ob.disconnect(); setPlaying(true); } });
    }, { threshold: 0.35 }).observe(root);
  } else { started = true; setPlaying(true); }
})();
'''


def line_html(ln):
    if ln == CUT:
        return f'<span class="ln cut">{CUT}\n</span>'
    step = f' data-step="{ln[1]}"' if ln[0] == 'step' else ''
    return f'<span class="ln"{step}>{escape(ln[-1], quote=False)}\n</span>'


def figure_html():
    p = SRC['provenance']
    out = ['<div class="tp" role="group" aria-label="One turn of the harness: the saved transcript and the recorded game board">',
           '<div class="tp-top"><span class="tp-run">Locksmith <span>· level 1 · steps 15 and 16 · run '
           f'{escape(p["run"])}</span></span>'
           '<span class="tp-ctl"><button type="button" data-a="play">Play</button>'
           '<button type="button" data-a="restart">Restart</button>'
           '<button type="button" data-a="end">Skip to end</button></span></div>',
           '<div class="tp-bar"><i></i></div>',
           '<div class="tp-legend">' + ''.join(f'<span class="k-{k}"><i></i>{n}</span>' for k, n in LEGEND) + '</div>',
           '<div class="tp-main">',
           '<div class="tp-board"><img src="arc3-solution-draft/charts/turn-board-cleared.png" width="512" height="512" '
           'loading="lazy" alt="The recorded Locksmith board: level 1 cleared, the block inside the locked box at the top.">'
           '<div class="tp-cap"><b>Level 1 cleared</b> on the seventh move. The recorded game board.</div></div>',
           '<div class="tp-log" tabindex="0" aria-label="Transcript of the turn">']
    for b in BLOCKS:
        if b == 'NEXT':
            out.append('<div class="tp-next">next turn · still level 1</div>')
            continue
        kind, label, note, lines = b[:4]
        n = f'<span class="tb-n">{escape(note)}</span>' if note else ''
        body = ''.join(line_html(ln) for ln in lines)
        pill = ''
        if kind == 'call':   # script-only pill: the call name and one real line; click opens the full call
            pn = f'<span class="tb-pn">{escape(note)}</span>' if note else ''
            pill = (f'<div class="tb-prow"><button type="button" class="tb-pill" aria-expanded="false" '
                    f'title="Show the full tool call"><span class="tb-pk">python</span>'
                    f'<code class="ln">{escape(b[4], quote=False)}</code></button>{pn}</div>')
        out.append(f'<section class="tb tb-{kind}" data-kind="{kind}"><div class="tb-h"><span>{escape(label)}</span>{n}</div>'
                   f'{pill}<pre class="tb-b">{body}</pre></section>')
    out += ['</div>', '</div>',
            '<div class="tp-note">Stored transcript: this turn\'s input is rebuilt from the run\'s saved transcripts, '
            'so it is not guaranteed to be the exact prompt bytes. Every word in the coloured blocks is copied from it; '
            '"…" marks a cut.</div>',
            '</div>']
    data = board_data()
    data['capStart'] = '<b>Before the turn</b> · the board attached to the turn message (recorded frame)'
    data['capStep'] = 'The recorded game after this move; the yellow bar at the bottom is the step budget.'
    data['capWait'] = 'At the top, under the locked box. No win yet; one step of budget left.'
    data['capEnd'] = '<b>Level 1 cleared</b>: the block went into the box.'
    js_data = json.dumps(data, separators=(',', ':')).replace('</', '<\\/')
    return '\n'.join([
        '<figure id="fig-turn">',
        '<div class="ft">One turn of the harness, from a saved run</div>',
        '<div class="fs">The transcript streams fast, in the order the turns went: the system prompt, the turn message, '
        'the model\'s reasoning (shortened), each python call as a yellow pill (click one for the full code), the '
        'output, then the next turn. The board steps through the recorded game as each move lands.</div>',
        *out,
        f'<script type="application/json" id="turn-player-data">{js_data}</script>',
        f'<script>{JS}</script>',
        '<figcaption>Real trace, not a mock-up: the game Locksmith, level 1, steps 15 and 16 of run '
        f'<code>{escape(p["run"])}</code>, an offline-evaluation run of the 56.02 package. Prompt text, reasoning, code '
        'and output are verbatim, cut only where "…" shows (the reasoning keeps its key lines), and the board is the '
        'run\'s recorded frames. The model walks the block to the locked box with its last six steps of budget; '
        'nothing happens, and on the next turn it spends its final step on one more UP. The legend, board captions and the grey notes in the label '
        'bars are ours.</figcaption>',
        '</figure>',
    ])


def splice(page, start, end, new):
    i, j = page.find(start), page.find(end)
    if i < 0 or j < i:
        raise SystemExit(f'Markers {start!r} / {end!r} not found in the article page')
    return page[:i + len(start)] + '\n' + new + '\n' + page[j:]


def launch_browser(pw):
    """Playwright's own Chromium, else the installed Google Chrome (the bundled build goes missing when
    the Python package is updated without "playwright install")."""
    try:
        return pw.chromium.launch()
    except Exception:
        return pw.chromium.launch(channel='chrome')


def take_still():
    """Screenshot the live player's final state from the built page (needs Playwright)."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = launch_browser(pw)
        pg = b.new_page(viewport={'width': 900, 'height': 900}, device_scale_factor=2)
        pg.goto(PAGE.as_uri() + '#turn-end')
        pg.wait_for_function('window.__turnPlayer !== undefined')
        # Final state, controls hidden, the transcript scrolled to the first turn's python pill, so its six
        # moves, the next turn's reasoning and the clearing UP follow.
        pg.evaluate('''() => {
          window.__turnPlayer.finish();
          const tp = document.querySelector("#fig-turn .tp"), log = tp.querySelector(".tp-log");
          tp.querySelector(".tp-ctl").style.display = "none";
          log.style.height = "860px";
          const th = log.querySelector(".tb-call");
          log.scrollTop = th.offsetTop - log.offsetTop;
        }''')
        pg.locator('#fig-turn .tp').screenshot(path=str(STILL_PNG))
        b.close()
    subprocess.run(['python3', '-c', f'from PIL import Image; im=Image.open("{STILL_PNG}"); '
                    f'im.convert("RGB").save("{STILL_PNG}", optimize=True)'], check=True)
    print('wrote', STILL_PNG)


def main():
    check_verbatim()
    write_board_png()
    page = PAGE.read_text()
    page = splice(page, '<!-- turn-player-css:start -->', '<!-- turn-player-css:end -->', f'<style>{font_face()}{CSS}</style>')
    page = splice(page, '<!-- turn-player:start -->', '<!-- turn-player:end -->', figure_html())
    PAGE.write_text(page)
    print('wrote', PAGE)
    if '--still' in sys.argv:
        take_still()


if __name__ == '__main__':
    main()
