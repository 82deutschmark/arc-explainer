"""Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: Build the "decode time, exact or lossy" figure that opens section 4.2 of Son Pham's
"Stuffing the Turducken" special (client/public/specials/2026-11-06-arc3-solution-draft.html).
It is a waterfall of measured decode time per 1,000 generated tokens, build by build, from
Daniel Franzen's notebook (1 Oct, 1,138 ms) to the 56.02 build (23 Oct, 330 ms), with each
build's drop coloured by the kind of change that went into it: exact only, exact and lossy
together with the bigger lever exact, the same with the bigger lever lossy, or can't tell.
Data: the decode values are the TIME rows of original/source-data.json (whole-run server-log
splits). The kind of each drop is a judgement read off each build's recipe, NOT a computed
millisecond split; see DROPS below for the evidence behind each call. The plot is drawn here as
a plain SVG and handed to redraw_pdf_panels.panel(), so title, fonts, panel colour, accent rule
and outlined type match the other redrawn figures; the PNG uses the same 2400px Sharp call.
Writes only decode-exact-lossy.svg and .png next to this script (no page, Markdown or ZIP).
Usage: python3.13 make_decode_exact_lossy_chart.py
SRP/DRY check: Pass - reuses source-data.json for the numbers and redraw_pdf_panels for panel
composition and typography; only the new plot geometry and wording live here.
"""

from pathlib import Path
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import redraw_pdf_panels as rp  # noqa: E402  (panel composition, fonts, outlining)

NAME = 'decode-exact-lossy'
SHARP = '/Users/macmini/GitHub/arc-explainer/node_modules/sharp'
NS = rp.NS

# Page colours: the warm theme's ink, muted and grid, plus the .tag.exact / .tag.lossy colours.
INK, INK2, MUTED, GRID, PANEL = '#2a1a12', '#5a3d2e', '#8f6f5c', '#efdecb', '#fbf1e6'
DECODE = '#4d56b8'
EXACT, EXACT_SOFT = '#6f8a2e', '#eef2df'
LOSSY, LOSSY_SOFT = '#c4561f', '#f6d6c1'

# kind -> (legend label, stroke/ink colour, fill, hatched)
KINDS = {
    'exact': ('Exact changes only', EXACT, EXACT, False),
    'mexact': ('Exact and lossy, bigger lever exact', EXACT, EXACT_SOFT, True),
    'mlossy': ('Exact and lossy, bigger lever lossy', LOSSY, LOSSY_SOFT, True),
    'unknown': ("Exact and lossy, can't tell", MUTED, '#f1e2d3', True),
}

# One row per measured build after the start. The kind is read off the build recipes:
#  3 Oct  host-RAM cache tier + tuned drafter (+ harness feed); drafting is verified, so exact.
#  6 Oct  the three measured levers: games 10 -> 12 (a 16-bit-weight build ran 12 games the same
#         day, so this did not need the lossy 8-bit weights), tokens per pass 2.89 -> 3.06 (new
#         drafter, exact) and step 32.7 -> 28.3 ms (lossy 8-bit dense weights mixed with exact
#         kernels). The two exact levers are the larger share of the drop.
# 11 Oct  games 12 -> 32 carries the whole drop; the history cache grew 1.01M -> 3.80M tokens only
#         because a third of the experts were cut and the cache went to 4 bits (both lossy).
#         Batch-aware routing (lossy) and exact big-batch kernels came in too.
# 18 Oct  only the step moved (37.8 -> 36.6 ms): lossy 8-bit activations and 16-row expert blocks
#         landed with exact routing fusions and 180 Mamba slots. Not separable.
# 23 Oct  tokens per pass 3.05 -> 3.25 from per-game verify depth and 4 draft steps (lossy) is the
#         larger lever; the step also got 3 guaranteed experts (lossy) next to exact fused kernels.
DROPS = [
    ('3 Oct', 'tuned drafter, RAM cache tier', 'exact',
     'Host-RAM cache tier and a drafter tuned on our games. Drafting is checked by the big model, so the output is unchanged.'),
    ('6 Oct', '12 games, new drafter, 8-bit weights', 'mexact',
     'Two more games at once and a better drafter (both exact; a 16-bit build ran 12 games the same day). Faster steps came partly from lossy 8-bit dense weights.'),
    ('11 Oct', '32 games: experts cut, 4-bit cache', 'mlossy',
     '32 games at once, which only fit because a third of the experts were cut and the history cache went to 4 bits (both lossy). Exact big-batch kernels came in too.'),
    ('18 Oct', '8-bit activations, kernel fusions', 'unknown',
     'Lossy 8-bit activations and 16-row expert blocks landed with exact routing fusions and 180 Mamba slots.'),
    ('23 Oct', 'verify depth, 4 draft steps, 3 experts', 'mlossy',
     'More tokens per pass from per-game verify depth and 4 draft steps (lossy), plus 3 guaranteed experts (lossy) next to exact fused kernels.'),
]


def load_builds():
    """The six measured builds from the original chart data (decode ms, games, tokens per pass, step ms)."""
    rows = json.loads((HERE / 'original' / 'source-data.json').read_text())['TIME']
    rows = [r for r in rows if not r.get('ghost')]
    assert [r['d'] for r in rows] == ['1 Oct', '3 Oct', '6 Oct', '11 Oct', '18 Oct', '23 Oct'], [r['d'] for r in rows]
    return rows


def el(parent, tag, **attrs):
    return ET.SubElement(parent, '{' + NS + '}' + tag, {k.replace('_', '-'): str(v) for k, v in attrs.items()})


def txt(parent, x, y, content, size=11, anchor='middle', fill=INK, bold=False, mono=True):
    node = el(parent, 'text', x=round(x, 2), y=round(y, 2), font_size=size, fill=fill, text_anchor=anchor,
              font_weight=700 if bold else 400, font_family='JetBrains Mono' if mono else 'Inter')
    node.text = content
    return node


def fmt(v):
    return f'{v:,.0f}'


def plot(builds):
    W, top, left, right = 900, 74, 52, 8
    plot_h, label_h = 300, 62
    H = top + plot_h + label_h
    svg = ET.Element('{' + NS + '}svg', {'viewBox': f'0 0 {W} {H}', 'width': str(W), 'height': str(H)})
    defs = el(svg, 'defs')
    for key, (_, ink, fill, hatched) in KINDS.items():
        if hatched:
            pat = el(defs, 'pattern', id='h-' + key, width=6, height=6, patternUnits='userSpaceOnUse',
                     patternTransform='rotate(45)')
            el(pat, 'rect', width=6, height=6, fill=fill)
            el(pat, 'line', x1=0, y1=0, x2=0, y2=6, stroke=ink, stroke_width=1.6, stroke_opacity=0.55)

    def swatch(x, y, key, w=14, h=14):
        _, ink, fill, hatched = KINDS[key]
        el(svg, 'rect', x=x, y=y, width=w, height=h, rx=3, fill='url(#h-%s)' % key if hatched else fill,
           stroke=ink, stroke_width=1.3)

    # Legend in two rows, drawn here because the shared panel legend has no hatched colour swatches.
    for ri, row in enumerate([['exact', 'mexact'], ['mlossy', 'unknown']]):
        lx = 0
        for key in row:
            swatch(lx, ri * 22, key)
            txt(svg, lx + 21, ri * 22 + 12, KINDS[key][0], 12.5, 'start', INK2)
            lx += 21 + rp.text_width(KINDS[key][0], 12.5, 'mono') + 30

    # Share of the whole drop by kind: a single strip on the right of the legend.
    total = builds[0]['p']['decode'] - builds[-1]['p']['decode']
    by_kind = {k: 0.0 for k in KINDS}
    for (d, _, kind, _), prev, cur in zip(DROPS, builds, builds[1:]):
        by_kind[kind] += prev['p']['decode'] - cur['p']['decode']
    sx, sw = 560, 340
    txt(svg, sx, 12, f'All {fmt(total)} ms saved, by kind of build', 12, 'start', INK, True)
    x = sx
    for key in KINDS:
        w = sw * by_kind[key] / total
        _, ink, fill, hatched = KINDS[key]
        el(svg, 'rect', x=round(x, 2), y=21, width=round(w, 2), height=16, fill='url(#h-%s)' % key if hatched else fill,
           stroke=ink, stroke_width=1)
        if w > 34:
            txt(svg, x + w / 2, 52, fmt(by_kind[key]), 11, 'middle', ink, True)
        x += w

    # Waterfall.
    n = len(builds) + 1
    vmax, ticks = 1200, [0, 300, 600, 900, 1200]
    plot_w = W - left - right
    slot, bw = plot_w / n, min(60, plot_w / n * 0.56)
    Y = lambda v: top + plot_h - v / vmax * plot_h  # noqa: E731
    for t in ticks:
        el(svg, 'line', x1=left, x2=left + plot_w, y1=Y(t), y2=Y(t), stroke=GRID)
        txt(svg, left - 6, Y(t) + 4, fmt(t) + (' ms' if t == vmax else ''), 11, 'end', INK2)
    bx = lambda i: left + i * slot + (slot - bw) / 2  # noqa: E731

    first = builds[0]['p']['decode']
    el(svg, 'rect', x=bx(0), y=Y(first), width=bw, height=Y(0) - Y(first), rx=4, fill=DECODE)
    txt(svg, bx(0) + bw / 2, Y(first) - 7, fmt(first), 12, 'middle', INK, True)
    for i, ((d, short, kind, _), prev, cur) in enumerate(zip(DROPS, builds, builds[1:]), start=1):
        a, b = prev['p']['decode'], cur['p']['decode']
        _, ink, fill, hatched = KINDS[kind]
        el(svg, 'line', x1=bx(i - 1) + bw, x2=bx(i), y1=Y(a), y2=Y(a), stroke=MUTED, stroke_width=1, stroke_dasharray='2 3')
        el(svg, 'rect', x=bx(i), y=Y(a), width=bw, height=max(1.5, Y(b) - Y(a)), rx=3,
           fill='url(#h-%s)' % kind if hatched else fill, stroke=ink, stroke_width=1.4)
        txt(svg, bx(i) + bw / 2, Y(a) - 7, '−' + fmt(a - b), 11.5, 'middle', ink, True)
    last = builds[-1]['p']['decode']
    xe = bx(n - 1)
    el(svg, 'line', x1=bx(n - 2) + bw, x2=xe, y1=Y(last), y2=Y(last), stroke=MUTED, stroke_width=1, stroke_dasharray='2 3')
    el(svg, 'rect', x=xe, y=Y(last), width=bw, height=Y(0) - Y(last), rx=4, fill=DECODE)
    txt(svg, xe + bw / 2, Y(last) - 7, fmt(last), 12, 'middle', INK, True)
    # The 56.02 marker: the build Part 4.1's chart calls our best Kaggle score.
    txt(svg, xe + bw / 2, Y(last) - 40, '56.02', 15, 'middle', LOSSY, True)
    txt(svg, xe + bw / 2, Y(last) - 24, 'our best', 10, 'middle', INK2)

    labels = [('1 Oct', "start: Daniel's notebook")] + [(d, s) for d, s, _, _ in DROPS] + [('23 Oct', 'the 56.02 build')]
    for i, (d, s) in enumerate(labels):
        cx, yb = left + i * slot + slot / 2, top + plot_h + 18
        txt(svg, cx, yb, d, 11.5, 'middle', INK, True, mono=False)
        for j, line in enumerate(rp.wrap(s, 10.5, 'body', max_width=slot - 8)[:4]):
            txt(svg, cx, yb + 15 + j * 13, line, 10.5, 'middle', INK2, mono=False)
    return svg, by_kind, total


def figure_markup(by_kind, total):
    share = lambda k: round(100 * by_kind[k] / total)  # noqa: E731
    return f'''<figure>
<div class="ft">Decode time, build by build: exact or lossy</div>
<div class="fs">Milliseconds of decode per 1,000 generated tokens, from Daniel's notebook to the 56.02 build. Each drop is coloured by the kind of change that made it. Only the first drop was exact all the way through.</div>
<figcaption>How we split it: we read each build's recipe and tagged its changes exact or lossy, as in Part 2. A build that mixed both can't be split by milliseconds from our logs, so we name the lever that did most of the work, from what moved: games at once, tokens per pass or step time. At 6 Oct that was two more games and a better drafter (exact). At 11 Oct it was 32 games at once, which only fit because experts were cut and the history cache went to 4 bits (lossy). At 23 Oct it was more tokens per pass from verify depth and 4 draft steps (lossy). At 18 Oct we can't tell. From 6 Oct on, every build already carried lossy changes, so the 330 ms was never an exact number. Same runs as the time chart in Part 2; about {share('mlossy')}% of the drop came in lossy-led builds and {share('exact')}% in the all-exact one.</figcaption>
</figure>'''


def main():
    builds = load_builds()
    plot_svg, by_kind, total = plot(builds)
    figure = BeautifulSoup(figure_markup(by_kind, total), 'html.parser').figure
    vector, title, subtitle, caption = rp.panel(plot_svg, figure, NAME)
    (HERE / (NAME + '.svg')).write_text(vector)
    code = ("const fs=require('fs'),sharp=require(process.argv[1]);(async()=>{for(const n of JSON.parse(process.argv[2]))"
            "await sharp(fs.readFileSync(n+'.svg')).resize({width:2400}).png().toFile(n+'.png')})()"
            ".catch(e=>{console.error(e);process.exit(1)})")
    subprocess.run(['node', '-e', code, SHARP, json.dumps([str(HERE / NAME)])], check=True)
    print(json.dumps({'title': title, 'subtitle': subtitle, 'caption': caption,
                      'by_kind_ms': {k: round(v, 1) for k, v in by_kind.items()}, 'total_ms': round(total, 1)}, indent=1))


if __name__ == '__main__':
    main()
