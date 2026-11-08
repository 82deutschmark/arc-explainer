"""Author: GPT-6.1 Sol
Date: 06-November-2026
PURPOSE: Recompose the original measured Turducken charts as complete PDF-style vector
figures, with outlined typography, legends, summary cards and caveats; synchronize
ARC Explainer, Markdown and the portable article archive. Uses the existing original
renderer for all measured geometry, fontTools for exact font metrics/paths, BeautifulSoup
for document structure and Sharp for high-resolution PNG rasterization.
SRP/DRY check: Pass — reuse original data and plot renderer, not a second benchmark model.
Edited 08-November-2026 by Claude Opus 5.5 Low: panel() no longer draws the rust rail along the top edge.
"""

from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile

from bs4 import BeautifulSoup
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
CHARTS = ROOT / 'charts'
OUT = CHARTS / 'original'
SITE = Path('/Users/macmini/GitHub/arc-explainer/client/public/specials')
ASSETS = SITE / 'arc3-solution-draft'
PAGE = SITE / '2026-11-06-arc3-solution-draft.html'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
PANEL, INK, BODY, MUTED, BORDER, ACCENT = '#fbf1e6', '#2f2118', '#5a3d2e', '#8f6f5c', '#e6c2a4', '#c4561f'
WIDTH, PAD = 960, 30
FONTS = {}


def font(family='body', bold=False):
    key = family, bold
    if key not in FONTS:
        name = {'body': 'Inter', 'mono': 'JetBrainsMono', 'serif': 'Bitter'}[family]
        original = TTFont(CHARTS / 'fonts' / (name + '.ttf'))
        axes = {'wght': 700 if bold else 400}
        if name == 'Inter':
            axes['opsz'] = 18
        face = instantiateVariableFont(original, axes, inplace=False)
        FONTS[key] = face, face.getGlyphSet(), face.getBestCmap(), face['head'].unitsPerEm
    return FONTS[key]


def text_width(text, size=16, family='body', bold=False):
    face, _, cmap, units = font(family, bold)
    return sum(face['hmtx'].metrics[cmap.get(ord(c), '.notdef')][0] for c in text) * size / units


def element(parent, tag, **attrs):
    return ET.SubElement(parent, '{' + NS + '}' + tag, {k.replace('_', '-'): str(v) for k, v in attrs.items()})


def text(parent, x, y, content, size=16, family='body', bold=False, fill=BODY, anchor='start'):
    node = element(parent, 'text', x=x, y=y, font_size=size, fill=fill,
                   font_family={'body':'Inter', 'mono':'JetBrains Mono', 'serif':'Bitter'}[family],
                   font_weight=700 if bold else 400, text_anchor=anchor)
    node.text = content
    return node


def wrap(content, size=16, family='body', bold=False, max_width=900):
    lines, line = [], ''
    for word in re.sub(r'\s+', ' ', content).split():
        candidate = (line + ' ' + word).strip()
        if line and text_width(candidate, size, family, bold) > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + ([line] if line else [])


def paragraph(parent, content, y, size=16, family='body', bold=False, fill=BODY, leading=None):
    leading = leading or size * 1.55
    for line in wrap(content, size, family, bold):
        text(parent, PAD, y, line, size, family, bold, fill)
        y += leading
    return y


def outline_texts(root):
    """Convert font-dependent text to vector paths, retaining readable SVG labels.

    This prevents the PDF's intended typography from falling back to DejaVu/Verdana
    on the server, in Kaggle's image viewer or when the standalone SVG is downloaded.
    """
    def visit(parent, inherited):
        for node in list(parent):
            state = dict(inherited)
            state.update(node.attrib)
            if node.tag != '{' + NS + '}text':
                visit(node, state)
                continue
            content = ''.join(node.itertext())
            family_name = state.get('font-family', '').lower()
            family = 'serif' if 'bitter' in family_name else 'mono' if any(s in family_name for s in ('mono', 'jetbrains')) else 'body'
            size = float(state.get('font-size', '12'))
            bold = state.get('font-weight', '400') in ('600', '700', 'bold')
            face, glyphs, cmap, units = font(family, bold)
            scale = size / units
            x, y = float(state.get('x', '0')), float(state.get('y', '0'))
            width = text_width(content, size, family, bold)
            anchor = state.get('text-anchor', 'start')
            x -= width / 2 if anchor == 'middle' else width if anchor == 'end' else 0
            group = ET.Element('{' + NS + '}g', {'aria-label': content, 'role': 'img', 'fill': state.get('fill', BODY)})
            for key in ('opacity', 'transform'):
                if key in node.attrib:
                    group.set(key, node.attrib[key])
            advance = 0
            for char in content:
                glyph_name = cmap.get(ord(char), '.notdef')
                pen = SVGPathPen(glyphs)
                glyphs[glyph_name].draw(pen)
                if pen.getCommands():
                    element(group, 'path', d=pen.getCommands(), transform=f'translate({x + advance * scale:.4f} {y}) scale({scale:.6f} {-scale:.6f})')
                advance += face['hmtx'].metrics[glyph_name][0]
            parent.insert(list(parent).index(node), group)
            parent.remove(node)
    visit(root, {'font-family': 'JetBrains Mono', 'font-size': '12', 'fill': BODY})


def panel(plot, figure, name):
    root = ET.Element('{' + NS + '}svg', {'role':'img', 'aria-labelledby': name + '-title ' + name + '-desc'})
    title = figure.select_one('.ft').get_text(' ', strip=True)
    subtitle = figure.select_one('.fs').get_text(' ', strip=True)
    caption = figure.select_one('figcaption').get_text(' ', strip=True)
    element(root, 'title', id=name + '-title').text = title
    element(root, 'desc', id=name + '-desc').text = subtitle + ' ' + caption
    contents = element(root, 'g')
    y = paragraph(contents, title, 51, 23, 'serif', True, INK, 31) + 2
    y = paragraph(contents, subtitle, y, 16, 'body', leading=25) + 8
    tiles = figure.select('.d2tiles .tile')
    if tiles:
        for index, tile in enumerate(tiles):
            x, card_w = PAD + index * 306, 288
            color = ACCENT if 'flip' in tile.get('class', []) else BORDER
            element(contents, 'rect', x=x, y=y, width=card_w, height=115, rx=12, fill=PANEL, stroke=BORDER)
            element(contents, 'path', d=f'M{x+12} {y+1} H{x+card_w-12}', stroke=color, stroke_width=3, fill='none')
            text(contents, x+18, y+29, tile.select_one('.k').get_text().upper(), 13, 'mono', fill=BODY)
            text(contents, x+18, y+72, tile.select_one('.v').get_text(), 36, 'mono', True, ACCENT if 'flip' in tile.get('class', []) else INK)
            text(contents, x+18, y+99, tile.select_one('.s').get_text(), 14, 'mono', fill=MUTED)
        y += 141
    legend = figure.select_one('.legend')
    if legend:
        x = PAD
        for item in legend.select('span'):
            label = item.get_text(' ', strip=True)
            item_width = 26 + text_width(label, 14, 'mono') + 21
            if x > PAD and x + item_width > WIDTH - PAD:
                x = PAD
                y += 27
            icon = item.select_one('i')
            style = icon.get('style', '')
            match = re.search(r'(?:background|border-color):\s*([^;]+)', style)
            color = match.group(1).strip() if match else MUTED
            if color.startswith('var'):
                color = {'--c-decode':'#4d56b8','--c-new':ACCENT,'--c-reread':'#d6970e','--c-perread':'#9c5a8e','--c-yellow':'#6f8a2e','--c-orange-soft':'#f6d6c1','--c-blue-soft':'#e5e6f5','--c-grid':'#efdecb'}.get(color[4:-1], MUTED)
            cls = icon.get('class', [])
            if 'dot' in cls or 'ring' in cls:
                element(contents, 'circle', cx=x+7, cy=y-5, r=6, fill=PANEL if 'ring' in cls else color, stroke=color, stroke_width=2)
            elif 'dashed' in style:
                element(contents, 'line', x1=x, x2=x+15, y1=y-5, y2=y-5, stroke=MUTED, stroke_width=2, stroke_dasharray='4 3')
            else:
                element(contents, 'rect', x=x, y=y-12, width=14, height=14, rx=3, fill='#e6d3c1' if 'hatch' in cls else color)
                if 'hatch' in cls:
                    for j in range(3):
                        element(contents, 'line', x1=x+j*4, y1=y+1, x2=x+j*4+5, y2=y-11, stroke=MUTED, stroke_width=1)
            text(contents, x+23, y, label, 14, 'mono')
            x += item_width
        y += 31
    else:
        y += 4
    plot_height = float(plot.get('height'))
    plot.set('x', str(PAD))
    plot.set('y', str(y))
    plot.set('width', '900')
    plot.set('overflow', 'visible')
    # Restore the intended PDF fonts before outlining original measured marks.
    plot.set('font-family', 'JetBrains Mono')
    for node in plot.iter():
        family = node.get('font-family', '')
        if 'DejaVu Sans Mono' in family:
            node.set('font-family', 'JetBrains Mono')
        elif 'DejaVu Sans' in family:
            node.set('font-family', 'Inter')
        for key in list(node.attrib):
            if key.startswith('data-') or key == 'style':
                del node.attrib[key]
    contents.append(plot)
    y += plot_height + 31
    y = paragraph(contents, caption, y, 14, 'mono', fill=MUTED, leading=22) + 13
    height = int(y)
    root.set('viewBox', f'0 0 {WIDTH} {height}')
    root.set('width', str(WIDTH))
    root.set('height', str(height))
    background = ET.Element('{' + NS + '}rect', {'x':'1','y':'1','width':str(WIDTH-2),'height':str(height-2),'rx':'14','fill':PANEL,'stroke':BORDER,'stroke-width':'1.2'})
    root.insert(2, background)
    # No accent rail across the top: Son asked on 8 Nov to drop the brown top edge of each chart.
    outline_texts(root)
    return ET.tostring(root, encoding='unicode'), title, subtitle, caption


def markdown(node):
    if isinstance(node, str):
        return str(node)
    tag = node.name
    if tag in ('nav', 'style', 'script'):
        return ''
    value = ''.join(markdown(child) for child in node.children)
    if tag in ('h1','h2','h3'):
        return '\n\n' + '#' * int(tag[1]) + ' ' + value + '\n\n'
    if tag == 'img':
        return '\n\n![' + node.get('alt','') + '](' + node['src'].replace('arc3-solution-draft/','') + ')\n\n'
    if tag == 'a':
        return '[' + value + '](' + node.get('href','').replace('arc3-solution-draft/','') + ')'
    if tag in ('b','strong'):
        return '**' + value + '**'
    if tag == 'code':
        return '`' + value + '`'
    if tag == 'li':
        return '\n- ' + value.strip()
    if tag == 'table':
        rows = [[re.sub(r'\s+',' ', cell.get_text(' ',strip=True)).replace('|','/') for cell in row.find_all(['td','th'],recursive=False)] for row in node.select('tr')]
        return '\n\n' + '\n'.join('| ' + ' | '.join(row) + ' |' + ('\n| ' + ' | '.join('---' for _ in row) + ' |' if i == 0 else '') for i,row in enumerate(rows)) + '\n\n'
    if tag == 'summary':
        return '\n\n**Chart data**\n\n'
    return '\n\n' + value + '\n\n' if tag in ('p','div','figure','ul','ol','figcaption','details') else value


def main():
    source_hash = hashlib.sha256((OUT / 'source-data.json').read_bytes()).hexdigest()
    # Re-run the preserved renderer first: our inputs are fresh measured vector plots,
    # never a previous panel or a screenshot of Son's PDF.
    subprocess.run(['node', str(CHARTS / 'static_original.cjs')], check=True)
    assert hashlib.sha256((OUT / 'source-data.json').read_bytes()).hexdigest() == source_hash
    soup = BeautifulSoup(PAGE.read_text(), 'html.parser')
    results = []
    for box in soup.select('.chart'):
        image = box.select_one('img')
        if image is None:
            continue
        name = box['id'].removeprefix('chart-')
        figure = box.find_parent('figure')
        plot = ET.fromstring((OUT / (name + '.svg')).read_text())
        vector, title, subtitle, caption = panel(plot, figure, name)
        (OUT / (name + '.svg')).write_text(vector)
        # Recompose the full figure instead of repeating its title/legend/caveat
        # outside the downloadable graphic. Keep numerical tables in HTML.
        for child in list(figure.children):
            if getattr(child, 'name', None) and child is not box and child.name != 'details':
                child.decompose()
        figure['class'] = ['redrawn-figure']
        box['tabindex'] = '0'
        box['role'] = 'region'
        box['aria-label'] = title + '; scroll horizontally on narrow screens'
        image['alt'] = title + '. ' + subtitle
        image['width'] = str(WIDTH)
        image['height'] = ET.fromstring(vector).get('height')
        picture = soup.new_tag('picture')
        source = soup.new_tag('source', type='image/svg+xml', srcset=image['src'].replace('.png','.svg'))
        image.wrap(picture)
        picture.insert(0, source)
        link = soup.new_tag('p', attrs={'class':'chart-download'})
        link.append('Open or download: ')
        for extension, label in [('svg','vector SVG'),('png','high-resolution PNG')]:
            if extension == 'png':
                link.append(' · ')
            anchor = soup.new_tag('a', href=f'arc3-solution-draft/charts/original/{name}.{extension}')
            anchor.string = label
            link.append(anchor)
        box.insert_after(link)
        results.append(name)
    css = soup.new_tag('style')
    css.string = '''/* Son's PDF-style full vector panels; numerical tables remain HTML. */
.redrawn-figure{padding:0;border:0;background:transparent;overflow:hidden;border-radius:0}
.redrawn-figure .chart{overflow-x:auto;padding:0 0 4px;scrollbar-color:#c99b77 #fbf1e6}
.redrawn-figure .chart picture{display:block;min-width:720px}
.redrawn-figure .chart img{width:100%;max-width:none;height:auto}
.chart-download{font-size:12px;margin:6px 0 10px;color:#8f6f5c}
@media print{.redrawn-figure .chart{overflow:visible}.redrawn-figure .chart picture{min-width:0}.chart-download{display:none}}
'''
    soup.head.append(css)
    PAGE.write_text(str(soup))
    # Rasterization uses outlined paths, so PNG and SVG typography are identical.
    sharp = '/Users/macmini/GitHub/arc-explainer/node_modules/sharp'
    code = "const fs=require('fs'),sharp=require(process.argv[1]);(async()=>{for(const n of JSON.parse(process.argv[2]))await sharp(fs.readFileSync(n+'.svg')).resize({width:2400}).png().toFile(n+'.png')})().catch(e=>{console.error(e);process.exit(1)})"
    subprocess.run(['node','-e',code,sharp,json.dumps([str(OUT / name) for name in results])], check=True)
    shutil.copytree(OUT, ASSETS / 'charts' / 'original', dirs_exist_ok=True)
    for path in (CHARTS / 'redraw_pdf_panels.py', CHARTS / 'static_original.cjs'):
        shutil.copy2(path, ASSETS / 'charts' / path.name)
    shutil.copytree(CHARTS / 'fonts', ASSETS / 'charts' / 'fonts', dirs_exist_ok=True)
    article = re.sub(r'\n{3,}','\n\n',re.sub(r'\n[ \t]+','\n',markdown(soup.main))).strip() + '\n'
    (ROOT / 'article-draft.md').write_text(article)
    shutil.copy2(ROOT / 'article-draft.md', ASSETS / 'article-draft.md')
    manifest = {'reference':'Son’s supplied stuffing-the-turducken.pdf, 06-November-2026','charts':results,'source_data_sha256':source_hash,'format':'Full vector panels with outlined Bitter, Inter and JetBrains Mono typography; 2400px PNGs','animation':False}
    (OUT / 'redraw-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copy2(OUT / 'redraw-manifest.json', ASSETS / 'charts' / 'original' / 'redraw-manifest.json')
    with zipfile.ZipFile(ROOT / 'kaggle-article-draft.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ASSETS.rglob('*')):
            if path.is_file():
                archive.write(path,path.relative_to(ASSETS))
    print(json.dumps(manifest,indent=2))


if __name__ == '__main__':
    main()
