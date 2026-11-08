"""Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: Re-render the six original Turducken figures whose visible wording said "board"
(delta2, ladder, lanes, think, time, wf-overhead) so they say "offline evaluation", per
Son Pham's 7-Nov instruction. It applies an exact, asserted list of wording swaps to the
archived original article frame (claude-original-frame.html in the shared report folder),
runs the original chart definitions offline in jsdom exactly as static_original.cjs does,
then composes each full panel with redraw_pdf_panels.panel() and rasterizes a 2400px PNG
with Sharp, the same way redraw_pdf_panels.py does. Only the SVG and PNG of those six
figures are written: unlike the canonical pipeline it never rewrites the article page,
Markdown, source-data.json, the manifest or the ZIP. Measurements, colors and geometry come
unchanged from the original renderer; only label strings change.
Usage (from anywhere): python3.13 reword_offline_charts.py
SRP/DRY check: Pass — reuses the original renderer and the existing panel/outline code;
this file only holds the wording swaps and a narrow write path.
"""

from pathlib import Path
import json
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
import redraw_pdf_panels as rp  # noqa: E402  (panel composition, fonts, outlining)

FRAME = Path('/Users/macmini/bubba-workspace/reports/arc3-kaggle-images-2026-11-06/claude-original-frame.html')
OUT = Path(__file__).resolve().parent / 'original'
JSDOM = '/Volumes/Team 4TB/loose-goose/test-runtime/node_modules/jsdom'
SHARP = '/Users/macmini/GitHub/arc-explainer/node_modules/sharp'
CHARTS = ['delta2', 'ladder', 'lanes', 'think', 'time', 'wf-overhead']

# Exact swaps: each old string must occur exactly once in the frame. Only text that is drawn
# into a chart (title, subtitle, tile, legend, caption, in-plot label) is listed; hover-only
# tooltip strings and the article body are left alone.
SWAPS = [
    # delta2: title, subtitle, tile, legend, caption
    ('<div class="ft">Our board liked 12 of these ideas.',
     '<div class="ft">Offline evaluation liked 12 of these ideas.'),
    ('The filled dot is what our board said;', 'The filled dot is what offline evaluation said;'),
    ('Orange rows: the board said better, Kaggle said worse.',
     'Orange rows: offline evaluation said better, Kaggle said worse.'),
    ('<div class="k">Board said better</div>', '<div class="k">Offline evaluation said better</div>'),
    ('label: "Our board", c: "--c-decode"', 'label: "Offline evaluation", c: "--c-decode"'),
    ('label: "Board said better, Kaggle said worse"', 'label: "Offline evaluation said better, Kaggle said worse"'),
    ('label: "Board noise, 1 SD"', 'label: "Offline evaluation noise, 1 SD"'),
    ('<figcaption>Board deltas compare board runs of the idea',
     '<figcaption>Offline evaluation deltas compare offline evaluation runs of the idea'),
    # ladder caption
    ('on our 25 to 75-game offline board.</figcaption>', 'on our 25 to 75-game offline evaluation.</figcaption>'),
    # time: bar label and caption
    ('s: "splice, Lean turns, vocab trim; 75-game board"', 's: "splice, Lean turns, vocab trim; 75-game offline evaluation"'),
    ('Our board has 25 to 75 games, so lanes', 'Our offline evaluation has 25 to 75 games, so lanes'),
    # lanes caption
    ('got too small and the board score dropped.', 'got too small and the offline evaluation score dropped.'),
    # think: subtitle, in-plot band label (short, it sits inside the plot), legend
    ('The grey band is one SD of board noise.', 'The grey band is one SD of offline evaluation noise.'),
    ('"board noise, 1 SD", "end"', '"offline noise, 1 SD", "end"'),
    ('label: "Board noise (1 SD)"', 'label: "Offline evaluation noise (1 SD)"'),
    # wf-overhead step label (wrapped inside a narrow bar column, so the short form)
    ('"longer board runs: more idle lanes"', '"longer offline runs: more idle lanes"'),
]

# Node half: same offline evaluation of the original chart script as static_original.cjs,
# but it writes raw plot SVGs to a scratch folder and nothing else.
RENDER_JS = r"""
const fs=require('fs'),path=require('path');
const {JSDOM}=require(process.argv[1]);
const raw=fs.readFileSync(process.argv[2],'utf8'), out=process.argv[3];
const scripts=[...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
const chart=scripts.at(-1)[1];
if(!chart.includes('var TIME =')||!chart.includes('function drawAll()'))throw Error('Original renderer not found');
const dom=new JSDOM(raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only'}),w=dom.window,d=w.document;
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 900;}});
w.eval(chart.slice(0,chart.indexOf('/* ---------------- build-in animations'))+'\ndrawDelta2(); drawWF("decode"); drawWF("prefill"); drawWF("overhead"); drawThink(); drawLadder(); drawTime(); drawStep(); drawLanes(); drawMemory(); drawKaggle();\n})();');
for(const box of d.querySelectorAll('.chart')){
  const svg=box.querySelector('svg');if(!svg)continue;
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('font-family','DejaVu Sans Mono, monospace');
  const txt=svg.outerHTML.replace(/JetBrains Mono/g,'DejaVu Sans Mono').replace(/Inter/g,'DejaVu Sans');
  fs.writeFileSync(path.join(out,box.id.replace(/^chart-/,'')+'.svg'),txt);
}
fs.writeFileSync(path.join(out,'frame.html'),d.documentElement.outerHTML);
"""


def main():
    raw = FRAME.read_text()
    for old, new in SWAPS:
        count = raw.count(old)
        assert count == 1, f'{count} matches for {old!r}'
        raw = raw.replace(old, new)
    with tempfile.TemporaryDirectory() as scratch:
        scratch = Path(scratch)
        (scratch / 'frame-src.html').write_text(raw)
        subprocess.run(['node', '-e', RENDER_JS, JSDOM, str(scratch / 'frame-src.html'), str(scratch)], check=True)
        # Legends and tiles are filled in by the chart script, so read figures from the rendered DOM.
        soup = BeautifulSoup((scratch / 'frame.html').read_text(), 'html.parser')
        for name in CHARTS:
            figure = soup.select_one('#chart-' + name).find_parent('figure')
            plot = ET.fromstring((scratch / (name + '.svg')).read_text())
            vector, title, subtitle, caption = rp.panel(plot, figure, name)
            (OUT / (name + '.svg')).write_text(vector)
            print(json.dumps({'chart': name, 'title': title, 'subtitle': subtitle, 'caption': caption}))
    code = ("const fs=require('fs'),sharp=require(process.argv[1]);(async()=>{for(const n of JSON.parse(process.argv[2]))"
            "await sharp(fs.readFileSync(n+'.svg')).resize({width:2400}).png().toFile(n+'.png')})()"
            ".catch(e=>{console.error(e);process.exit(1)})")
    subprocess.run(['node', '-e', code, SHARP, json.dumps([str(OUT / n) for n in CHARTS])], check=True)


if __name__ == '__main__':
    main()
