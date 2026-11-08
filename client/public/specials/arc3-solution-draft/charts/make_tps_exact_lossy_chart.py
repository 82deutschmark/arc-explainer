"""Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: Build the "tokens per second, exact or lossy" figure that sits under the decode chart in
section 4.2 of Son Pham's "Stuffing the Turducken" special
(client/public/specials/2026-11-06-arc3-solution-draft.html). Son asked for "the rest" of the
decode chart: how much of the whole-run speed gain was lossy and how much lossless. It is an
upward waterfall of measured whole-run tokens per second (generated tokens / wall-clock play
time, the same numbers as the ladder chart in Part 2), from Daniel Franzen's notebook (1 Oct) to
the 56.02 build (23 Oct), then one hatched bar for the 1 Nov build that came after 56.02, was
never shipped and never beat 56.02 on Kaggle.
Data: tok/s and the whole-run time split come from the TIME rows of original/source-data.json.
The kind of each build (exact only / exact and lossy with the bigger lever exact or lossy /
can't tell) is NOT re-judged here: KINDS and DROPS are imported from
make_decode_exact_lossy_chart.py, so both figures carry the same call for every build. The 1 Nov
bar's recipe is the run's own description (splice, lean turns, vocab trim); its time split is
measured and is printed in the caption by this script. The share strip covers only the climb to
56.02. Panel composition, fonts and outlining come from redraw_pdf_panels.panel(), as for the
decode chart; the PNG uses the same 2400px Sharp call.
Writes only tps-exact-lossy.svg and .png next to this script (no page, Markdown or ZIP).
Usage: python3.13 make_tps_exact_lossy_chart.py
SRP/DRY check: Pass - imports the decode chart's kinds, colours, build calls and text helpers
(that module only writes from its own main()); only the upward geometry, the 1 Nov bar and the
wording live here.
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
import make_decode_exact_lossy_chart as dec  # noqa: E402  (same kinds, colours and build calls)

NAME = 'tps-exact-lossy'
el, txt, fmt = dec.el, dec.txt, dec.fmt
INK, INK2, MUTED, GRID, LOSSY = dec.INK, dec.INK2, dec.MUTED, dec.GRID, dec.LOSSY
TPS = dec.DECODE  # same blue as the decode chart's start and end bars

# The decode chart's four kinds plus one for the build after 56.02. That build is not one of the
# decode chart's calls: its recipe is splice and vocab trim (both lossy, Part 2.4) and lean turns
# (a harness change), so it is drawn in the lossy colour but with its own lighter hatch and a
# dashed outline, and the caption spells out what is measured about it.
KINDS = dict(dec.KINDS, after=('After 56.02, never shipped', LOSSY, '#fdf0e6', True))
AFTER = ('1 Nov', 'after 56.02: splice, lean turns, vocab trim')


def load_builds():
    """The seven TIME rows: six measured builds to 56.02, then the 1 Nov build after it."""
    rows = json.loads((HERE / 'original' / 'source-data.json').read_text())['TIME']
    assert [r['d'] for r in rows] == ['1 Oct', '3 Oct', '6 Oct', '11 Oct', '18 Oct', '23 Oct', '1 Nov'], [r['d'] for r in rows]
    assert rows[-1].get('ghost') and rows[-2].get('star'), 'expected 56.02 starred and 1 Nov as the ghost row'
    return rows[:-1], rows[-1]


def plot(builds, after):
    W, top, left, right = 900, 96, 64, 8
    plot_h, label_h = 300, 62
    H = top + plot_h + label_h
    svg = ET.Element('{' + rp.NS + '}svg', {'viewBox': f'0 0 {W} {H}', 'width': str(W), 'height': str(H)})
    defs = el(svg, 'defs')
    for key, (_, ink, fill, hatched) in KINDS.items():
        if hatched:
            pat = el(defs, 'pattern', id='h-' + key, width=6, height=6, patternUnits='userSpaceOnUse',
                     patternTransform='rotate(45)')
            el(pat, 'rect', width=6, height=6, fill=fill)
            el(pat, 'line', x1=0, y1=0, x2=0, y2=6, stroke=ink, stroke_width=1.6,
               stroke_opacity=0.3 if key == 'after' else 0.55)

    def bar(x, y, w, h, key, rx=3):
        _, ink, fill, hatched = KINDS[key]
        el(svg, 'rect', x=round(x, 2), y=round(y, 2), width=round(w, 2), height=round(h, 2), rx=rx,
           fill='url(#h-%s)' % key if hatched else fill, stroke=ink, stroke_width=1.4 if key != 'after' else 1.6,
           **({'stroke_dasharray': '4 3'} if key == 'after' else {}))

    # Legend: the decode chart's two rows, plus a third row for the after-56.02 bar.
    for ri, row in enumerate([['exact', 'mexact'], ['mlossy', 'unknown'], ['after']]):
        lx = 0
        for key in row:
            bar(lx, ri * 22, 14, 14, key)
            txt(svg, lx + 21, ri * 22 + 12, KINDS[key][0], 12.5, 'start', INK2)
            lx += 21 + rp.text_width(KINDS[key][0], 12.5, 'mono') + 30

    # Share of the climb to 56.02 by kind. The 1 Nov build is outside this total on purpose.
    total = builds[-1]['tok'] - builds[0]['tok']
    by_kind = {k: 0.0 for k in dec.KINDS}
    for (_, _, kind, _), prev, cur in zip(dec.DROPS, builds, builds[1:]):
        by_kind[kind] += cur['tok'] - prev['tok']
    sx, sw = 560, 340
    txt(svg, sx, 12, f'All {fmt(total)} tok/s gained up to 56.02, by kind', 12, 'start', INK, True)
    x = sx
    for key in dec.KINDS:
        w = sw * by_kind[key] / total
        bar(x, 21, w, 16, key, rx=0)
        if w > 34:
            txt(svg, x + w / 2, 52, fmt(by_kind[key]), 11, 'middle', KINDS[key][1], True)
        x += w

    # Upward waterfall: start bar, five gains, the 56.02 total, then the 1 Nov gain floating on top.
    n = len(builds) + 2
    vmax, ticks = 3000, [0, 500, 1000, 1500, 2000, 2500, 3000]
    plot_w = W - left - right
    slot, bw = plot_w / n, min(60, plot_w / n * 0.56)
    Y = lambda v: top + plot_h - v / vmax * plot_h  # noqa: E731
    for t in ticks:
        el(svg, 'line', x1=left, x2=left + plot_w, y1=Y(t), y2=Y(t), stroke=GRID)
        txt(svg, left - 6, Y(t) + 4, fmt(t) + (' tok/s' if t == vmax else ''), 11, 'end', INK2)
    bx = lambda i: left + i * slot + (slot - bw) / 2  # noqa: E731

    def step(i, a, b, key):
        """A floating gain bar from a to b in slot i, joined to the previous bar by a dotted line."""
        el(svg, 'line', x1=bx(i - 1) + bw, x2=bx(i), y1=Y(a), y2=Y(a), stroke=MUTED, stroke_width=1, stroke_dasharray='2 3')
        bar(bx(i), Y(b), bw, max(1.5, Y(a) - Y(b)), key)
        txt(svg, bx(i) + bw / 2, Y(b) - 7, '+' + fmt(b - a), 11.5, 'middle', KINDS[key][1], True)

    first = builds[0]['tok']
    el(svg, 'rect', x=bx(0), y=Y(first), width=bw, height=Y(0) - Y(first), rx=4, fill=TPS)
    txt(svg, bx(0) + bw / 2, Y(first) - 7, fmt(first), 12, 'middle', INK, True)
    for i, ((_, _, kind, _), prev, cur) in enumerate(zip(dec.DROPS, builds, builds[1:]), start=1):
        step(i, prev['tok'], cur['tok'], kind)
    last, xe = builds[-1]['tok'], bx(len(builds))
    el(svg, 'line', x1=bx(len(builds) - 1) + bw, x2=xe, y1=Y(last), y2=Y(last), stroke=MUTED, stroke_width=1, stroke_dasharray='2 3')
    el(svg, 'rect', x=xe, y=Y(last), width=bw, height=Y(0) - Y(last), rx=4, fill=TPS)
    txt(svg, xe + bw / 2, Y(last) - 7, fmt(last), 12, 'middle', INK, True)
    txt(svg, xe + bw / 2, Y(last) - 40, '56.02', 15, 'middle', LOSSY, True)
    txt(svg, xe + bw / 2, Y(last) - 24, 'our best', 10, 'middle', INK2)
    # The 1 Nov build: more speed, bought with lossy changes, and Kaggle went down.
    step(n - 1, last, after['tok'], 'after')
    xa = bx(n - 1) + bw / 2
    txt(svg, xa, Y(after['tok']) - 41, fmt(after['tok']), 12, 'middle', INK, True)
    txt(svg, xa, Y(after['tok']) - 25, 'Kaggle went down', 10, 'middle', LOSSY)

    labels = ([('1 Oct', "start: Daniel's notebook")] + [(d, s) for d, s, _, _ in dec.DROPS]
              + [('23 Oct', 'the 56.02 build'), AFTER])
    for i, (d, s) in enumerate(labels):
        cx, yb = left + i * slot + slot / 2, top + plot_h + 18
        txt(svg, cx, yb, d, 11.5, 'middle', INK, True, mono=False)
        for j, line in enumerate(rp.wrap(s, 10.5, 'body', max_width=slot - 8)[:4]):
            txt(svg, cx, yb + 15 + j * 13, line, 10.5, 'middle', INK2, mono=False)
    return svg, by_kind, total


def figure_markup(builds, after, by_kind, total):
    share = lambda k: round(100 * by_kind[k] / total)  # noqa: E731
    b, a = builds[-1], after
    # What moved between 56.02 and 1 Nov, in ms per 1,000 tokens, straight from the time split.
    d = {k: a['p'][k] - b['p'][k] for k in b['p']}
    assert abs(d['decode']) < 5, d  # the caption's "decode didn't move" claim depends on this
    return f'''<figure>
<div class="ft">Tokens per second, build by build: exact or lossy</div>
<div class="fs">Whole-run tokens per second, from Daniel's notebook to the 56.02 build, then the build that came after it. Same builds and same colours as the decode chart, so you can see how much of the speed came from lossy changes.</div>
<figcaption>This counts the whole run, not just decode: prompt reading and idle lanes are in here too. Each build keeps the exact-or-lossy call from the decode chart; we didn't re-judge any of them. Up to 56.02, about {share('mlossy')}% of the gain came in builds where a lossy change was the bigger lever, {share('mexact')}% where an exact one was, only {share('exact')}% in the all-exact build, and the last {share('unknown')}% in the build we can't call. Then the last bar. After 56.02, decode didn't get any faster ({fmt(b['p']['decode'])} vs {fmt(a['p']['decode'])} ms per 1,000 tokens). The time we saved came from re-reading less history ({fmt(-d['reread'])} ms per 1,000 tokens, that's splice, lossy), shorter new turns ({fmt(-d['fresh'])} ms, lean turns) and fewer idle lanes ({fmt(-d['idle'])} ms). Some of that idle-lane part may be the 75-game test set this run used, which keeps lanes busier, rather than the build. The vocab trim (lossy) was in there too. It never became our final build: every build like it that we sent to Kaggle scored lower than 56.02.</figcaption>
</figure>'''


def main():
    builds, after = load_builds()
    plot_svg, by_kind, total = plot(builds, after)
    figure = BeautifulSoup(figure_markup(builds, after, by_kind, total), 'html.parser').figure
    vector, title, subtitle, caption = rp.panel(plot_svg, figure, NAME)
    (HERE / (NAME + '.svg')).write_text(vector)
    code = ("const fs=require('fs'),sharp=require(process.argv[1]);(async()=>{for(const n of JSON.parse(process.argv[2]))"
            "await sharp(fs.readFileSync(n+'.svg')).resize({width:2400}).png().toFile(n+'.png')})()"
            ".catch(e=>{console.error(e);process.exit(1)})")
    subprocess.run(['node', '-e', code, dec.SHARP, json.dumps([str(HERE / NAME)])], check=True)
    print(json.dumps({'title': title, 'subtitle': subtitle, 'caption': caption,
                      'by_kind_tok_s': {k: round(v, 1) for k, v in by_kind.items()}, 'total_tok_s': round(total, 1),
                      'after_tok_s': after['tok']}, indent=1))


if __name__ == '__main__':
    main()
