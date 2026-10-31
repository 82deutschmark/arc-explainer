# Author: Claude Sonnet 5.5 Medium
# Date: 31-October-2026
# PURPOSE: Turns a published dispatch (content/news/dispatches/<id>.json) into a standalone Weekend Magazine story page
# (client/public/specials/weekend/<slug>.html) with its own share card, so an X link carries the story's art. Usage:
#   python3.13 scripts/weekend_story_page.py <dispatch id> <slug> <image file in client/public/specials/img>
# SRP/DRY check: Pass - one job (dispatch to page); look comes from assets/magazine.css, nav copied from final-hours.html.
import html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECIALS = ROOT / 'client/public/specials'


def build(dispatch_id, slug, image):
    d = json.loads((ROOT / f'content/news/dispatches/{dispatch_id}.json').read_text())
    base = (SPECIALS / 'weekend/final-hours.html').read_text()
    nav = re.search(r'<nav class="bar">.*?</nav>', base, re.S).group(0)
    url = f'https://arc.markbarney.net/specials/weekend/{slug}.html'
    img = f'/specials/img/{image}'
    e = html.escape
    first = d['sections'][0]['text'].split('. ')[0] + '.'
    body = ''.join(f'<section><h2>{e(s["heading"])}</h2><p>{e(s["text"])}</p></section>' for s in d['sections'])
    srcs = ' · '.join(f'<a href="{e(s["url"])}">{e(s["title"])}</a>' for s in d['sources'])
    page = f'''<!doctype html>
<!--
  Author: Claude Sonnet 5.5 Medium
  Date: 31-October-2026
  PURPOSE: Weekend Magazine story page generated from dispatch {dispatch_id} by scripts/weekend_story_page.py.
  SRP/DRY check: Pass - markup only; look in assets/magazine.css.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(d["headline"])} | The ARC Daily Digest</title>
<meta name="description" content="{e(first)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(d["headline"])}">
<meta property="og:description" content="{e(first)}">
<meta property="og:image" content="https://arc.markbarney.net{img}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/specials/weekend/assets/magazine.css">
<script src="/specials/weekend/assets/magazine.js" defer></script>
</head>
<body>
{nav}
<div class="breaking" id="breaking"><div class="wrap"></div></div>
<header class="hero"><img src="{img}" width="1400" height="788" alt="{e(d["image"]["alt"])}"><div class="hero-text"><div class="wrap"><span class="kicker">Weekend magazine · Saturday report</span><h1>{e(d["headline"])}</h1></div></div></header>
<div class="wrap">
<p class="dateline"><span>Saturday, October 31, 2026</span><span>Public boards, provisional</span></p>
{body}
<p class="src">Sources: {srcs}</p>
<p class="credit">{e(d["editorNote"])} Commissioned by head editor Mark Barney.</p>
</div>
</body>
</html>
'''
    (SPECIALS / f'weekend/{slug}.html').write_text(page)
    return url


if __name__ == '__main__':
    print(build(*sys.argv[1:4]))
