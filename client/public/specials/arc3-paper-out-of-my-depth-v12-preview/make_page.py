#!/usr/bin/env python3
"""
Author: Claude Fable 5.2
Date: 09-November-2026
PURPOSE: Build the unlisted preview page for the twelfth paper-track draft, "Out of My Depth",
         from article.md beside this file. Same plain serif reading look as the earlier previews,
         plus one strip of six kept-game pictures (real engine frames copied from the
         arc3-synthetic-games repository) wherever the body says [[games]].
         Output: client/public/specials/2026-11-09-arc3-paper-out-of-my-depth-v12-preview.html
SRP/DRY check: Pass -- page builder only; the look is the v8 preview's, publishing is
         tools/specials-publish/publish_specials.py.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "2026-11-09-arc3-paper-out-of-my-depth-v12-preview.html"
SLUG = "2026-11-09-arc3-paper-out-of-my-depth-v12-preview.html"
GAMES_SITE = "https://82deutschmark.github.io/arc3-synthetic-games/"

# Six of the kept games; captions are the catalog's own one-line teasers, shortened.
GAMES = [
    ("bl02", "Basket Lift", "Get the fruit to the basket on lifts that weigh you."),
    ("st02", "Shadow Topple", "Turn the light and the blocks topple along their shadows."),
    ("kt03", "Knot Tying", "Lay a cord over and under, then pull it tight."),
    ("dz03", "Dig Zone", "Loose sand pours, packed sand holds, quicksand slumps."),
    ("eh02", "Eroding Horizons", "Every peek with your lantern wears away the floor home."),
    ("ss01", "Shared Supply", "Thread the fruit from the tray onto the skewers, in order."),
]


def inline(text: str) -> str:
    """Escape, then turn **bold**, *italic* and bare links into tags."""
    out = html.escape(text, quote=False)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\*(.+?)\*", r"<em>\1</em>", out)
    out = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', out)
    return out


def games_strip() -> str:
    cells = "".join(
        f'<figure><img src="arc3-paper-out-of-my-depth-v12-preview/{gid}.png" alt="{html.escape(name)}" width="256" height="256">'
        f"<figcaption><strong>{html.escape(name)}.</strong> {html.escape(line)}</figcaption></figure>"
        for gid, name, line in GAMES
    )
    return (
        f'<div class="games">{cells}</div>'
        f'<p class="cap">Six of the games we kept. Real engine frames; all playable at '
        f'<a href="{GAMES_SITE}">{GAMES_SITE}</a></p>'
    )


def build() -> str:
    body: list[str] = []
    for block in (HERE / "article.md").read_text(encoding="utf-8").strip().split("\n\n"):
        block = block.strip()
        if block == "[[games]]":
            body.append(games_strip())
        elif block.startswith("# "):
            body.append(f"<h1>{inline(block[2:])}</h1>")
        elif block.startswith("## "):
            body.append(f"<h2>{inline(block[3:])}</h2>")
        elif block.startswith("> "):
            body.append(f"<blockquote><p>{inline(block[2:])}</p></blockquote>")
        else:
            body.append(f"<p>{inline(block)}</p>")
    title = "Out of My Depth (preview)"
    desc = "A game producer on ARC-AGI-3: a frozen model, a thousand machine-made games, and the capacity to acquire capacity."
    url = f"https://arc.markbarney.net/specials/{SLUG}"
    return f"""<!doctype html>
<!-- Author: Claude Fable 5.2; Date: 09-November-2026; PURPOSE: Unlisted preview of the twelfth paper-track draft, built by arc3-paper-out-of-my-depth-v12-preview/make_page.py from article.md; plain serif reading look of the earlier previews plus one strip of kept-game pictures. SRP/DRY check: Pass - static page, existing look and publisher reused. -->
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ARC Explainer">
<meta property="og:title" content="Out of My Depth">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary">
<style>
:root {{ color-scheme: light; }}
html {{ -webkit-text-size-adjust: 100%; }}
body {{ margin: 0; background: #fff; color: #1a1a1a; font: 19px/1.6 Charter, "Iowan Old Style", Georgia, "Times New Roman", serif; }}
main {{ max-width: 40rem; margin: 0 auto; padding: 48px 20px 96px; }}
.note {{ font-size: 0.85rem; color: #666; margin: 0 0 20px; }}
h1, h2 {{ font-family: -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.25; }}
h1 {{ font-size: 2rem; margin: 0 0 8px; }}
h2 {{ font-size: 1.35rem; margin: 2.2em 0 0.6em; }}
p {{ margin: 0 0 1em; overflow-wrap: anywhere; }}
a {{ color: #1a4f9c; }}
blockquote {{ margin: 0 0 1.4em; padding: 0 0 0 1em; border-left: 3px solid #ccc; color: #333; font-size: 0.95em; }}
/* Game pictures are tiny pixel frames: scale them up with hard edges, three across, two on a phone. */
.games {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 1.6em 0 0.5em; }}
.games figure {{ margin: 0; }}
.games img {{ display: block; width: 100%; height: auto; image-rendering: pixelated; background: #000; }}
.games figcaption {{ font-size: 0.78rem; line-height: 1.35; color: #444; margin-top: 6px; }}
.cap {{ font-size: 0.82rem; color: #666; margin: 0 0 1.6em; }}
@media (max-width: 520px) {{ .games {{ grid-template-columns: repeat(2, 1fr); }} }}
</style>
</head><body>
<main>
<p class="note">Preview draft, not submitted</p>
{chr(10).join(body)}
</main>
</body></html>
"""


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUT}")
