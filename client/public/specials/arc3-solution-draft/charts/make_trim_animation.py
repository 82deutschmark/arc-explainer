"""Author: Claude Opus 5.5 Medium (60 frames a second: Claude Opus 5.5 Low, 08-November-2026)
Date: 07-November-2026
PURPOSE: Render the "Trimming and swapping, animated" figure of Son Pham's "Stuffing the
Turducken" special (section 1.1, "Context management", in
client/public/specials/2026-11-06-arc3-solution-draft.html and article-draft.md). The original
Claude artifact showed a looping video (charts/trim.webm / trim.gif) that is not on this machine,
so this is a faithful recreation from that figure's archived caption and alt text:
  Left: game 1's context fills the 140k window turn by turn under the system prompt and the
  notes; when the next turn won't fit, the earliest turns are cut away, the last ~52k move up and
  are read again.
  Right: all 32 lanes on one beat as pills that grow and are cut back when full; at some trims
  the priority queue swaps a waiting game into the lane; two admitted games wait in a ninth
  column while they run python; host RAM mirrors the card's cache.
Fixed numbers are the 56.02 settings (140k window, ~52k kept, 32 lanes, 34 admitted of 110
games, 3.80M-token card cache, 24 GB host RAM copy). Turn sizes, growth and swap timing are
illustrative, exactly as the caption says.
Every animated quantity is a function of time modulo the loop length, so the last frame flows
into the first. Frames are drawn with Pillow at 2x and downsampled (anti-aliasing), in the page's
warm palette and the Bitter / Inter / JetBrains Mono fonts from charts/fonts. img2webp packs them
into an animated, looping WebP (the fast-publish API takes webp but not video files); ffmpeg
writes a webm master next to the frames.
Writes: charts/trim.webp and charts/trim-poster.png (committed); frames and trim.webm under
OUT_DIR on the Team 4TB drive (never committed).
Usage: python3.13 make_trim_animation.py [OUT_DIR]
SRP/DRY check: Pass - reuses the page's palette hex values and the shared charts/fonts files; no
other chart script draws raster animation, so the drawing lives here.
"""

from pathlib import Path
from multiprocessing import Pool
import math
import random
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = HERE / 'fonts'
OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    '/Volumes/Team 4TB/loose-goose/art/2026-11-07-turducken-trim-animation')

W, H = 1280, 960
S = 2                      # supersampling factor
FPS = 60                   # 60 frames a second (Son, 8 Nov); was 15
LOOP = 18.0                # seconds; every motion below is periodic in LOOP
NFRAMES = int(LOOP * FPS)  # 1,080; frame NFRAMES would equal frame 0, so it is not drawn
POSTER_T = 11.7            # window full and the next turn won't fit; a swap in flight on the right

# Warm "turducken workshop" palette, copied from the page's CSS overrides.
BG = '#fbf1e6'          # --panel (the figure background the image sits on)
SURFACE = '#fffaf4'     # --surface
INK, INK2, MUTED, LINE = '#2a1a12', '#5a3d2e', '#8f6f5c', '#e6cdb6'
SYS = '#efe0d0'                         # .ctxbar .sys
NOTES, NOTES_INK, NOTES_EDGE = '#f4e4ee', '#74365f', '#9c5a8e'   # .ctxbar .notes / harness
DECODE = '#4d56b8'                      # --c-decode: a turn being generated
CACHED = '#c9cbee'                      # history sitting in the card's cache (soft decode blue)
CACHED_EDGE = '#8d92cf'
KEEP, KEEP_INK, TRIM = '#f6d6c1', '#96390f', '#c4561f'           # .ctxbar .keep / --c-new
CUT = '#e3cdb8'                         # .ctxbar .old hatch
SWAP = '#d6970e'                        # --c-reread, the Swap card's colour
RAM = '#6f8a2e'                         # host RAM tier rows (exact green)

# Token sizes in thousands (k). Window and keep are 56.02 settings; the rest is illustrative.
WINDOW, KEEP_K, SYS_K, NOTES_K = 140, 52, 6, 4
HEAD = SYS_K + NOTES_K
GROW = WINDOW - HEAD - KEEP_K           # 78k of new turns fill the window from a fresh trim
KEPT_TURNS = [11, 9, 12, 10, 10]        # the kept ~52k, as turns
NEW_TURNS = [7, 9, 10, 11, 9, 12, 10] + KEPT_TURNS[-1:]   # 78k; last five equal KEPT_TURNS
assert sum(KEPT_TURNS) == KEEP_K and sum(NEW_TURNS) == GROW
assert NEW_TURNS[3:] == KEPT_TURNS      # so the frame after the trim matches frame 0
NEXT_TURN = 9


def font(name, size, weight=None):
    f = ImageFont.truetype(str(FONTS / name), size * S)
    if weight is not None:   # all three files are variable fonts with one weight axis
        f.set_variation_by_axes([weight])
    return f


F = {
    'h': font('Bitter.ttf', 29, 700),
    'sub': font('Inter.ttf', 19, 400),
    'lab': font('Inter.ttf', 20, 500),
    'labb': font('Inter.ttf', 20, 700),
    'cap': font('Inter.ttf', 22, 500),
    'small': font('Inter.ttf', 17, 600),
    'mono': font('JetBrainsMono.ttf', 18, 500),
    'monob': font('JetBrainsMono.ttf', 18, 700),
    'leg': font('Inter.ttf', 18, 500),
}


# ---------- small helpers ----------

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ramp(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def rgb(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, k):
    """Colour k of the way from a to b (k=0 -> a)."""
    a, b = rgb(a), rgb(b)
    return '#%02x%02x%02x' % tuple(round(x + (y - x) * clamp(k)) for x, y in zip(a, b))


def sc(*v):
    return [round(x * S) for x in v]


class Canvas:
    def __init__(self):
        self.im = Image.new('RGB', (W * S, H * S), BG)
        self.d = ImageDraw.Draw(self.im)

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, width=1, r=0):
        if x1 - x0 < 0.3 or y1 - y0 < 0.3:
            return
        r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
        self.d.rounded_rectangle(sc(x0, y0, x1, y1), radius=round(r * S), fill=fill,
                                 outline=outline, width=round(width * S) if outline else 0)

    def hatch(self, x0, y0, x1, y1, color, bg, r=0, step=6):
        """Diagonal hatching like the page's .ctxbar .old segment."""
        if x1 - x0 < 1 or y1 - y0 < 1:
            return
        w, h = round((x1 - x0) * S), round((y1 - y0) * S)
        tile = Image.new('RGB', (w, h), bg)
        td = ImageDraw.Draw(tile)
        for k in range(-h, w + h, step * S):
            td.line([(k, h), (k + h, 0)], fill=color, width=round(1.6 * S))
        mask = Image.new('L', (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=round(r * S), fill=255)
        self.im.paste(tile, (round(x0 * S), round(y0 * S)), mask)

    def line(self, pts, fill, width=1.5, dash=None):
        p = [(x * S, y * S) for x, y in pts]
        if not dash:
            self.d.line(p, fill=fill, width=round(width * S))
            return
        (xa, ya), (xb, yb) = p
        n = math.hypot(xb - xa, yb - ya)
        on, off = dash[0] * S, dash[1] * S
        s = 0.0
        while s < n:
            e = min(n, s + on)
            self.d.line([(xa + (xb - xa) * s / n, ya + (yb - ya) * s / n),
                         (xa + (xb - xa) * e / n, ya + (yb - ya) * e / n)],
                        fill=fill, width=round(width * S))
            s += on + off

    def dashed_rect(self, x0, y0, x1, y1, color, width=1.6, dash=(6, 4)):
        for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
            self.line([a, b], color, width, dash)

    def text(self, x, y, s, f, fill=INK, anchor='la'):
        self.d.text((x * S, y * S), s, font=F[f], fill=fill, anchor=anchor)

    def tw(self, s, f):
        return self.d.textlength(s, font=F[f]) / S

    def out(self):
        return self.im.resize((W, H), Image.LANCZOS)


# ---------- game 1: the left panel's script ----------
# Times in seconds within the loop.
T_TURN0, T_TURN_GAP = 1.2, 1.2                      # 8 turns, 1.2 s apart
T_GHOST = T_TURN0 + T_TURN_GAP * len(NEW_TURNS)     # 10.8: the next turn won't fit
T_CUT, T_SLIDE, T_READ, T_DONE = 12.3, 13.8, 14.8, 16.8


def game1(t):
    """Blocks of game 1's history: dicts with kind, y (k from the top of the window), size (k),
    plus newness / fade / dx. Kinds: cached, new, cut, keep (waiting to be read again)."""
    blocks = []
    y = HEAD
    cut_ids = len(KEPT_TURNS) + 3            # old kept turns plus the first three new ones
    turns = [(s, -1.0) for s in KEPT_TURNS] + [
        (s, T_TURN0 + i * T_TURN_GAP) for i, s in enumerate(NEW_TURNS)]
    slide = ease(ramp(t, T_SLIDE, T_SLIDE + 1.0)) * (GROW)   # kept turns move up 78k
    sweep = ramp(t, T_READ, T_DONE)                         # re-read progress over the kept 52k
    for i, (size, born) in enumerate(turns):
        if t < born:
            break
        grow = ease(ramp(t, born, born + 0.35)) if born >= 0 else 1.0
        h = size * grow
        b = {'y': y, 'size': h, 'dx': 0.0, 'fade': 0.0}
        if t >= T_CUT and i < cut_ids:
            b['kind'] = 'cut'
            b['hatch'] = ramp(t, T_CUT, T_CUT + 0.35)
            b['dx'] = -150 * ease(ramp(t, T_CUT + 0.6, T_SLIDE + 0.2))
            b['fade'] = ease(ramp(t, T_CUT + 0.6, T_SLIDE + 0.2))
        elif t >= T_CUT:
            b['y'] = y - slide
            b['kind'] = 'keep'
            b['k_in'] = ramp(t, T_CUT, T_CUT + 0.35)
            # portion above the sweep line has been read again
            top = (y - GROW - HEAD) / KEEP_K
            bot = top + size / KEEP_K
            b['read'] = clamp((sweep - top) / (bot - top))
        else:
            b['kind'] = 'cached'
            b['new'] = 0.0 if born < 0 else 1 - ramp(t, born + 0.6, born + 1.1)
        if b['fade'] < 1:
            blocks.append(b)
        y += size * (grow if i >= len(KEPT_TURNS) else 1)
    if t >= T_DONE:   # identical to the loop's opening state
        blocks = [{'y': HEAD + sum(KEPT_TURNS[:j]), 'size': s, 'dx': 0.0, 'fade': 0.0,
                   'kind': 'cached', 'new': 0.0} for j, s in enumerate(KEPT_TURNS)]
    return blocks


def game1_level(t):
    """Total fill (k) of game 1 for its lane pill and the cache bar."""
    return HEAD + sum(b['size'] * (1 - b['fade']) for b in game1(t))


# ---------- the other 33 admitted games: periodic lanes ----------

def make_lanes():
    rnd = random.Random(5602)
    lanes = []
    golden = 0.6180339887
    for i in range(32):
        if i == 0:
            lanes.append(None)     # lane 1 is game 1
            continue
        cycles = 2 if i % 3 == 1 else 1           # two trims per loop for some lanes
        n = rnd.randint(6, 9)
        cuts = sorted(rnd.sample(range(1, GROW), n - 1))
        sizes = [b - a for a, b in zip([0] + cuts, cuts + [GROW])]
        lanes.append({'cycles': cycles, 'phase': (i * golden) % 1.0, 'sizes': sizes})
    return lanes


LANES = make_lanes()
REREAD = 1.4     # seconds a lane spends reading its kept 52k again
TRIM_LEN = 0.8   # seconds: cut part hatched, then gone


def lane_state(i, t):
    """(segments, trim_start_time_in_loop) for lane i at time t. Segments run top-down after the
    system prompt and notes: list of (kind, k, extra)."""
    if i == 0:
        segs = []
        for b in game1(t):
            if b['kind'] == 'cut':
                segs.append(('cut', b['size'] * (1 - b['fade']), b['hatch']))
            elif b['kind'] == 'keep':
                segs.append(('keep', b['size'], b['read']))
            else:
                segs.append(('cached', b['size'], b['new']))
        return segs
    ln = LANES[i]
    L = LOOP / ln['cycles']
    tau = (t + ln['phase'] * LOOP) % L
    if tau < REREAD:
        return [('keep', KEEP_K, tau / REREAD)]
    grow_end = L - TRIM_LEN
    if tau >= grow_end:
        u = (tau - grow_end) / TRIM_LEN
        cut = GROW * (1 - ease(ramp(u, 0.45, 1.0)))
        return [('cut', cut, ramp(u, 0, 0.3)), ('keep', KEEP_K, 0.0)]
    segs = [('cached', KEEP_K, 0.0)]
    sizes = ln['sizes']
    gap = (grow_end - 0.4 - REREAD) / len(sizes)
    for j, s in enumerate(sizes):
        born = REREAD + 0.2 + j * gap
        if tau < born:
            break
        segs.append(('cached', s * ease(ramp(tau, born, born + 0.3)), 1 - ramp(tau, born + 0.5, born + 0.9)))
    return segs


def lane_trims(i):
    """Loop times at which lane i's trim ends (its swap moment)."""
    ln = LANES[i]
    L = LOOP / ln['cycles']
    base = (-ln['phase'] * LOOP) % L
    return [(base + k * L) % LOOP for k in range(ln['cycles'])]


# Swaps: at these lanes' trims the queue hands the slot to a waiting game (illustrative choice).
# Lane 1 never swaps: the left panel follows game 1 through its trim.
SWAP_LANES = [9, 14, 20, 27, 5]
SWAPS = []
for k, ln_i in enumerate(SWAP_LANES):
    SWAPS.append({'lane': ln_i, 't': lane_trims(ln_i)[0], 'slot': [5, 22, 41, 13, 58][k]})
SWAP_LEN = 1.4


def swap_phase(sw, t):
    """Progress 0..1 of a swap's chip flight, or None when not active (periodic in LOOP)."""
    d = (t - sw['t'] + 0.3) % LOOP     # starts 0.3 s before the trim ends
    return d / SWAP_LEN if d < SWAP_LEN else None


# ---------- layout ----------
COL_X0, COL_X1 = 128, 292        # game 1's window column
COL_Y0, COL_Y1 = 112, 770
KPX = (COL_Y1 - COL_Y0) / WINDOW  # px per k on the left

GX0, PW, PG = 556, 50, 20         # lane grid: first x, pill width, gap
PY0, PH, RP = 150, 112, 138       # first pill top, pill height, row pitch
NINTH_X = GX0 + 8 * (PW + PG) + 26
Q_Y = 712                          # queue chips top
Q_PITCH, Q_CH, Q_PER_ROW = 17, 13, 38
MEM_Y = 790


def pill_xy(i):
    r, c = divmod(i, 8)
    return GX0 + c * (PW + PG), PY0 + r * RP


def slot_xy(j):
    r, c = divmod(j, Q_PER_ROW)
    return GX0 + c * Q_PITCH, Q_Y + r * (Q_CH + 6)


def draw_segments(cv, x0, x1, ytop, kpx, segs, r=3, edges=True):
    """Draw history segments top-down from ytop. Returns y after the last segment."""
    y = ytop
    for kind, k, extra in segs:
        h = k * kpx
        if h < 0.4:
            continue
        if kind == 'cut':
            base = mix(CACHED, SURFACE, 0.4)
            cv.rect(x0, y, x1, y + h, fill=base, r=r)
            if extra > 0:
                cv.hatch(x0, y, x1, y + h, mix(base, '#c9a98c', extra), base, r=r)
        elif kind == 'keep':
            read = extra
            yr = y + h * read
            cv.rect(x0, y, x1, y + h, fill=KEEP, outline=TRIM if edges else None, width=1.2, r=r)
            if read > 0:
                cv.rect(x0, y, x1, yr, fill=CACHED, r=r)
            if 0 < read < 1:
                cv.line([(x0 - 3, yr), (x1 + 3, yr)], TRIM, 2.4)
        else:
            cv.rect(x0, y, x1, y + h, fill=mix(CACHED, DECODE, extra),
                    outline=CACHED_EDGE if edges else None, width=1, r=r)
        y += h
    return y


def draw_left(cv, t):
    cv.text(30, 22, 'One game', 'h')
    cv.text(30, 60, "Game 1's context in the 140k window", 'sub', MUTED)
    x0, x1 = COL_X0, COL_X1
    # window frame and axis
    cv.rect(x0, COL_Y0, x1, COL_Y1, fill=SURFACE, outline=LINE, width=1.5, r=6)
    for k, lab in ((0, '0'), (70, '70k'), (140, '140k')):
        y = COL_Y0 + k * KPX
        cv.line([(x0 - 10, y), (x0 - 2, y)], MUTED, 1.4)
        cv.text(x0 - 16, y, lab, 'mono', MUTED, 'rm')
    # system prompt and notes stay put through everything
    ys, yn, yh = COL_Y0, COL_Y0 + SYS_K * KPX, COL_Y0 + HEAD * KPX
    cv.rect(x0 + 3, ys + 3, x1 - 3, yn - 1, fill=SYS, r=3)
    cv.rect(x0 + 3, yn + 1, x1 - 3, yh - 1, fill=NOTES, outline=NOTES_EDGE, width=1.4, r=3)
    cv.text(x1 + 14, (ys + yn) / 2 - 3, 'system prompt', 'lab', INK2, 'lm')
    cv.text(x1 + 14, (yn + yh) / 2 + 6, 'notes', 'labb', NOTES_INK, 'lm')

    blocks = game1(t)
    last_bottom = yh
    for b in blocks:
        ya = COL_Y0 + b['y'] * KPX + 1
        yb = ya + b['size'] * KPX - 2
        xa, xb = x0 + 3 + b['dx'], x1 - 3 + b['dx']
        if b['kind'] == 'cut':
            base = mix(mix(CACHED, SURFACE, 0.4 * b['hatch']), BG, b['fade'])
            cv.rect(xa, ya, xb, yb, fill=base, r=3)
            cv.hatch(xa, ya, xb, yb, mix(mix(base, '#b8977a', b['hatch']), BG, b['fade']), base, r=3)
        elif b['kind'] == 'keep':
            fillc = mix(CACHED, KEEP, b['k_in'])
            edge = mix(CACHED_EDGE, TRIM, b['k_in'])
            cv.rect(xa, ya, xb, yb, fill=fillc, outline=edge, width=1.4, r=3)
            if b['read'] > 0:
                cv.rect(xa, ya, xb, ya + (yb - ya) * b['read'], fill=CACHED, outline=CACHED_EDGE, width=1, r=3)
            if 0 < b['read'] < 1:   # the read-again sweep line
                yr = ya + (yb - ya) * b['read']
                cv.line([(xa - 8, yr), (xb + 8, yr)], TRIM, 3)
        else:
            cv.rect(xa, ya, xb, yb, fill=mix(CACHED, DECODE, b['new']),
                    outline=mix(CACHED_EDGE, DECODE, b['new']), width=1, r=3)
        if b['kind'] != 'cut':
            last_bottom = max(last_bottom, yb)

    # the 140k limit
    cv.line([(x0 - 4, COL_Y1), (x1 + 4, COL_Y1)], TRIM, 2.2)

    # annotations by phase
    lx = x1 + 18
    if T_TURN0 <= t < T_GHOST + 0.2:
        a = 1 - ramp(t, T_GHOST - 0.3, T_GHOST + 0.2)
        newest = [b for b in blocks if b['kind'] == 'cached' and b.get('new', 0) > 0.05]
        if newest and a > 0:
            b = newest[-1]
            yc = COL_Y0 + (b['y'] + b['size'] / 2) * KPX
            cv.line([(lx - 10, yc), (lx - 2, yc)], DECODE, 2)
            cv.text(lx + 2, yc, 'new turn', 'labb', mix(DECODE, BG, 1 - a), 'lm')
    if T_GHOST <= t < T_CUT + 0.5:
        a = ease(ramp(t, T_GHOST, T_GHOST + 0.35)) * (1 - ramp(t, T_CUT, T_CUT + 0.5))
        ya = COL_Y1 + 2
        yb = ya + NEXT_TURN * KPX
        col = mix(BG, DECODE, a)
        cv.dashed_rect(x0 + 3, ya + 2, x1 - 3, yb, col, 2)
        cv.text((x0 + x1) / 2, (ya + yb) / 2 + 1, 'next turn', 'small', col, 'mm')
        cv.text(lx, COL_Y1 - 10, "won't fit", 'labb', mix(BG, TRIM, a), 'lb')
    if T_CUT <= t < T_SLIDE + 0.4:
        a = ease(ramp(t, T_CUT + 0.1, T_CUT + 0.4)) * (1 - ramp(t, T_SLIDE, T_SLIDE + 0.4))
        ya, yb = COL_Y0 + HEAD * KPX + 14, COL_Y0 + (HEAD + GROW) * KPX
        c = mix(BG, INK2, a)
        cv.line([(lx - 6, ya + 2), (lx - 6, yb - 2)], c, 2)
        cv.text(lx + 4, (ya + yb) / 2 - 14, 'earliest turns', 'labb', c, 'lm')
        cv.text(lx + 4, (ya + yb) / 2 + 12, 'cut away', 'labb', c, 'lm')
    if T_CUT <= t < T_DONE + 0.5:
        a = ease(ramp(t, T_CUT + 0.2, T_CUT + 0.5)) * (1 - ramp(t, T_DONE, T_DONE + 0.5))
        top = HEAD + GROW - ease(ramp(t, T_SLIDE, T_SLIDE + 1.0)) * GROW
        ya, yb = COL_Y0 + top * KPX, COL_Y0 + (top + KEEP_K) * KPX
        ya = max(ya, COL_Y0 + HEAD * KPX + 14)   # clear of the notes label
        c = mix(BG, KEEP_INK, a)
        cv.line([(lx - 6, ya + 2), (lx - 6, yb - 2)], c, 2)
        cv.text(lx + 4, (ya + yb) / 2 - 14, 'last ~52k', 'labb', c, 'lm')
        if t < T_READ:
            cv.text(lx + 4, (ya + yb) / 2 + 12, 'kept, moves up', 'lab', c, 'lm')
        else:
            cv.text(lx + 4, (ya + yb) / 2 + 12, 'read again', 'lab', c, 'lm')
    # phase caption under the column
    if t < T_TURN0 - 0.05 or t >= T_DONE:
        cap = ['Game 1 plays on from its notes', 'and its kept history.']
    elif t < T_GHOST:
        cap = ['Each turn adds to the history,', 'kept in the card’s cache.']
    elif t < T_CUT:
        cap = ['The next turn won’t fit', 'in the 140k window.']
    elif t < T_SLIDE:
        cap = ['Trim: the earliest turns are cut.', 'System prompt and notes stay.']
    elif t < T_READ:
        cap = ['The last ~52k move up', 'under the notes.']
    else:
        cap = ['The front changed, so the cache', 'no longer matches: read again.']
    cv.text(30, 846, cap[0], 'cap', INK)
    cv.text(30, 876, cap[1], 'cap', INK)


def draw_pill(cv, i, t, x, y, swap_k=0.0):
    segs = lane_state(i, t)
    kp = PH / WINDOW
    cv.rect(x, y, x + PW, y + PH, fill=SURFACE, outline=mix(LINE, SWAP, swap_k),
            width=1.4 + 1.6 * swap_k, r=9)
    # system prompt and notes cap
    cv.rect(x + 3, y + 3, x + PW - 3, y + SYS_K * kp + 2, fill=SYS, r=2)
    cv.rect(x + 3, y + SYS_K * kp + 2, x + PW - 3, y + HEAD * kp + 2, fill=NOTES_EDGE, r=1)
    draw_segments(cv, x + 3, x + PW - 3, y + HEAD * kp + 3, kp, segs, r=2, edges=False)


def draw_right(cv, t):
    cv.text(536, 22, 'The whole card, one beat', 'h')
    cv.text(536, 60, "Each pill is one game's context; 32 decode at once", 'sub', MUTED)
    cv.line([(510, 30), (510, 930)], LINE, 1.5, (5, 5))
    gx1 = GX0 + 8 * PW + 7 * PG
    cv.text((GX0 + gx1) / 2, 118, '32 lanes', 'labb', INK2, 'mm')
    cv.text(NINTH_X + PW / 2, 118, 'python', 'labb', INK2, 'mm')
    cv.line([(NINTH_X - 13, 104), (NINTH_X - 13, PY0 + 3 * RP + PH)], LINE, 1.5, (4, 4))

    active = {}
    for sw in SWAPS:
        p = swap_phase(sw, t)
        if p is not None:
            active[sw['lane']] = (sw, p)

    for i in range(32):
        x, y = pill_xy(i)
        k = 0.0
        if i in active:
            p = active[i][1]
            k = ease(ramp(p, 0, 0.15)) * (1 - ease(ramp(p, 0.85, 1.0)))
        draw_pill(cv, i, t, x, y, k)
        if i in active and k > 0:
            cv.text(x + PW / 2, y - 12, 'swap', 'small', mix(BG, SWAP, k), 'mm')
    # game 1 marker
    x, y = pill_xy(0)
    cv.rect(x - 4, y - 4, x + PW + 4, y + PH + 4, outline=INK, width=2, r=12)

    # ninth column: two admitted games paused while their python runs
    for j, level in enumerate((96, 121)):
        x, y = NINTH_X, PY0 + j * RP
        kp = PH / WINDOW
        cv.rect(x, y, x + PW, y + PH, fill=SURFACE, r=9)
        cv.dashed_rect(x, y, x + PW, y + PH, MUTED, 1.4, (5, 4))
        cv.rect(x + 3, y + 3, x + PW - 3, y + SYS_K * kp + 2, fill=SYS, r=2)
        cv.rect(x + 3, y + SYS_K * kp + 2, x + PW - 3, y + HEAD * kp + 2, fill=NOTES_EDGE, r=1)
        cv.rect(x + 3, y + HEAD * kp + 3, x + PW - 3, y + level * kp, fill=mix(CACHED, SURFACE, 0.35), r=2)
        # three dots blink in turn: the python tool is running (period divides the loop)
        for d in range(3):
            on = (math.floor(t / 0.5) % 3) == d
            cv.rect(x + 11 + d * 11, y + PH - 16, x + 18 + d * 11, y + PH - 9,
                    fill=INK2 if on else LINE, r=3.5)
    cv.text(NINTH_X + PW / 2, PY0 + 2 * RP + 22, 'waiting', 'small', MUTED, 'mm')
    cv.text(NINTH_X + PW / 2, PY0 + 2 * RP + 44, 'on', 'small', MUTED, 'mm')
    cv.text(NINTH_X + PW / 2, PY0 + 2 * RP + 66, 'python', 'small', MUTED, 'mm')

    # the priority queue: 76 waiting games
    cv.text(GX0, Q_Y - 30, 'Priority queue: 76 waiting', 'labb', INK)
    cv.text(GX0 + Q_PER_ROW * Q_PITCH - 4, Q_Y - 30, '34 admitted of 110 games', 'mono', INK2, 'ra')
    flying = {sw['slot']: (sw, p) for sw, p in active.values()}
    for j in range(76):
        x, y = slot_xy(j)
        fill = '#b9a28f'
        if j in flying:
            p = flying[j][1]
            fill = mix(fill, SWAP, ease(ramp(p, 0, 0.15)) * (1 - ramp(p, 0.85, 1.0)))
            if 0.15 < p < 0.85:
                fill = BG if p < 0.5 else mix(BG, SWAP, ramp(p, 0.5, 0.85))
                cv.rect(x, y, x + Q_CH, y + Q_CH, outline=LINE, width=1, r=3)
        cv.rect(x, y, x + Q_CH, y + Q_CH, fill=fill, r=3)
    # chips in flight: the waiting game goes up to the lane, the trimmed game drops into its slot
    for sw, p in active.values():
        q = ease(ramp(p, 0.15, 0.85))
        if q <= 0 or q >= 1:
            continue
        sx, sy = slot_xy(sw['slot'])
        px, py = pill_xy(sw['lane'])
        lx, ly = px + PW / 2 - Q_CH / 2, py + PH / 2
        for (ax, ay), (bx, by), col in (((sx, sy), (lx, ly), SWAP), ((lx + 0, ly), (sx, sy), INK2)):
            cx, cy = ax + (bx - ax) * q, ay + (by - ay) * q - math.sin(q * math.pi) * 18
            cv.rect(cx - 2, cy - 2, cx + Q_CH + 2, cy + Q_CH + 2, fill=col, outline=SURFACE, width=1.5, r=4)

    # memory: the card's history cache and its write-through copy in host RAM
    used = game1_level(t)
    for i in range(1, 32):
        used += HEAD + sum(k for _, k, _ in lane_state(i, t))
    used += 96 + 121                           # the two games running python keep their cache
    frac = used / 3800.0                       # 3.80M tokens
    bx0, bx1 = GX0, GX0 + Q_PER_ROW * Q_PITCH - 4
    for row, (label, right, col, edge) in enumerate((
            ('Card: history cache', '3.80M tokens', CACHED, DECODE),
            ("Host RAM: write-through copy of the card's cache", '24 GB', mix(RAM, SURFACE, 0.6), RAM))):
        y = MEM_Y + row * 66
        cv.text(bx0, y, label, 'lab', INK)
        cv.text(bx1, y, right, 'monob', INK2, 'ra')
        cv.rect(bx0, y + 28, bx1, y + 48, fill=SURFACE, outline=LINE, width=1.2, r=4)
        cv.rect(bx0 + 2, y + 30, bx0 + 2 + (bx1 - bx0 - 4) * frac, y + 46, fill=col, r=3)
        cv.line([(bx0 + 2 + (bx1 - bx0 - 4) * frac, y + 26), (bx0 + 2 + (bx1 - bx0 - 4) * frac, y + 50)], edge, 2)


def draw_legend(cv):
    items = [('system prompt', 'sys'), ('notes', 'notes'), ('history in cache', 'cached'),
             ('new turn', 'new'), ('read again', 'keep'), ('cut away', 'cut'), ('swap', 'swap')]
    y = 930
    widths = [22 + 8 + cv.tw(lab, 'leg') for lab, _ in items]
    gap = (W - 60 - sum(widths)) / (len(items) - 1)
    x = 30
    for (lab, kind), w in zip(items, widths):
        box = (x, y - 9, x + 20, y + 9)
        if kind == 'sys':
            cv.rect(*box, fill=SYS, r=3)
        elif kind == 'notes':
            cv.rect(*box, fill=NOTES, outline=NOTES_EDGE, width=1.4, r=3)
        elif kind == 'cached':
            cv.rect(*box, fill=CACHED, outline=CACHED_EDGE, width=1, r=3)
        elif kind == 'new':
            cv.rect(*box, fill=DECODE, r=3)
        elif kind == 'keep':
            cv.rect(*box, fill=KEEP, outline=TRIM, width=1.4, r=3)
        elif kind == 'cut':
            base = mix(CACHED, SURFACE, 0.4)
            cv.rect(*box, fill=base, r=3)
            cv.hatch(*box, '#b8977a', base, r=3, step=5)
        else:
            cv.rect(*box, fill=SURFACE, outline=SWAP, width=2.6, r=4)
        cv.text(x + 28, y, lab, 'leg', INK2, 'lm')
        x += w + gap


def render(t):
    cv = Canvas()
    draw_left(cv, t)
    draw_right(cv, t)
    draw_legend(cv)
    return cv.out()


def _frame(n):
    render(n / FPS).save(OUT_DIR / 'frames' / f'f{n:04d}.png')
    return n


def main():
    frames = OUT_DIR / 'frames'
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)
    with Pool(8) as pool:
        pool.map(_frame, range(NFRAMES))
    render(POSTER_T).save(HERE / 'trim-poster.png', optimize=True)
    files = [str(frames / f'f{n:04d}.png') for n in range(NFRAMES)]
    # WebP frame durations are whole milliseconds and 1000/60 is not, so each frame gets the
    # cumulative-rounded share of the loop (16 or 17 ms) and the loop still lasts exactly LOOP s.
    args = []
    for n, f in enumerate(files):
        d = round((n + 1) * 1000 / FPS) - round(n * 1000 / FPS)
        args += ['-d', str(d), f]
    # lossless: flat art compresses better than lossy here, and lossy left faint ghosts of
    # earlier frames' labels in the blended sub-frames
    subprocess.run(['img2webp', '-loop', '0', '-lossless', '-m', '4', *args,
                    '-o', str(HERE / 'trim.webp')], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i',
                    str(frames / 'f%04d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p',
                    '-b:v', '0', '-crf', '28', str(OUT_DIR / 'trim.webm')], check=True)
    shutil.copy(__file__, OUT_DIR / Path(__file__).name)
    print('frames', NFRAMES, 'webp bytes', (HERE / 'trim.webp').stat().st_size)


if __name__ == '__main__':
    main()
