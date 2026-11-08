#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Build the two re-illustrated alternates of the Turducken write-up from the main page:
           - 2026-11-06-arc3-solution-draft-cat.html: the same art, with ngyzly drawn as his cat
             (pictures in cat/);
           - 2026-11-06-arc3-solution-draft-1950s.html: every illustration re-painted in the Boss's
             1950s pulp science-fiction style (pictures in 1950s/), with a matching newsprint page
             theme and chart frames.
         Reads ../2026-11-06-arc3-solution-draft.html (the main page, which other edits keep changing)
         and writes each alternate with identical text. Only these things differ: each illustration's
         image reference (the VARIANTS maps below; charts and the trim animation are untouched), a
         block of page-level CSS, the title suffix, and robots noindex, nofollow.
         Tolerant of text edits: it never touches text, only image references it recognises and the
         head. It refuses to write if the main page gains an illustration a variant has no copy for,
         or a mapped file is missing, so a new or renamed picture cannot slip through unchanged.
         Run from anywhere after any edit to the main page:
           python3 client/public/specials/arc3-solution-draft/make_variant_pages.py
         Working and full-size files live on the Team 4TB drive
         (loose-goose/art/2026-11-08-turducken-cat-1950s, MANIFEST.txt there); only web-size copies
         live in cat/ and 1950s/. Same shape as make_white_page.py, which builds the white alternate.
SRP/DRY check: Pass -- the main page stays the single source of the article text; this only swaps
         image references and adds page-level CSS and metadata, like make_white_page.py.
"""

from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
MAIN = HERE.parent / "2026-11-06-arc3-solution-draft.html"
PREFIX = "arc3-solution-draft/"

# The 1950s theme: newsprint paper, pulp-cover red and blue, heavy ink rules, condensed display type.
# Appended after the main page's own theme so it overrides those tokens. Charts keep their own
# cream background and sit on a paper panel with a thick ink frame, like a comic panel.
PULP_CSS = """<style>/* 1950s pulp science-fiction alternate (made by arc3-solution-draft/make_variant_pages.py) */
:root{--bg:#efe4cc;--surface:#f8f1e0;--panel:#f6ecd6;--ink:#1d1a1c;--ink-2:#3d3438;--muted:#6f6158;
--line:#cdb994;--accent:#c4302b;--accent-soft:#f6dccf;
--display:"Futura","Avenir Next Condensed","Trebuchet MS","Arial Narrow",sans-serif}
html,body{background:#efe4cc}
body{background-image:radial-gradient(rgba(60,40,20,.07) 1px,transparent 1.2px);background-size:5px 5px}
h1{font-family:var(--display);font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:#1f3a73;
text-shadow:2px 2px 0 #f2c230}
main>h2{font-family:var(--display);text-transform:uppercase;letter-spacing:.03em;color:#1f3a73;
border-bottom:3px solid #c4302b}
main>h3{color:#c4302b}
figure{background:var(--panel);border:3px solid #1d1a1c;border-radius:2px;box-shadow:5px 5px 0 #1f3a73}
figure.hero{background:var(--panel)}
figure img{border-radius:0}
.tldr{border:2px solid #1d1a1c;border-left:6px solid #c4302b;border-radius:2px;background:#f8f1e0}
</style>
"""

VARIANTS = {
    "cat": {
        "out": "2026-11-06-arc3-solution-draft-cat.html",
        "title": "cat version",
        "css": "",
        # Illustration on the main page -> its cat version. ngyzly appears in all six.
        "images": {
            "00-turducken-texture-v10.png": "cat/00-turducken-cat.webp",
            "01-harness-garage-v2-corners-only.png": "cat/01-harness-cat.webp",
            "02-inference-v2-corners-only.png": "cat/02-inference-cat.webp",
            "03-rl-v1-corners-only.png": "cat/03-rl-cat.webp",
            "04-speed-plateau-v2-corners-only.png": "cat/04-speed-plateau-cat.webp",
            "05-family-white-original-texture-v3.png": "cat/05-family-cat.webp",
        },
    },
    "1950s": {
        "out": "2026-11-06-arc3-solution-draft-1950s.html",
        "title": "1950s science-fiction version",
        "css": PULP_CSS,
        "images": {
            "00-turducken-texture-v10.png": "1950s/00-turducken-1950s.webp",
            "01-harness-garage-v2-corners-only.png": "1950s/01-harness-1950s.webp",
            "02-inference-v2-corners-only.png": "1950s/02-inference-1950s.webp",
            "03-rl-v1-corners-only.png": "1950s/03-rl-1950s.webp",
            "04-speed-plateau-v2-corners-only.png": "1950s/04-speed-plateau-1950s.webp",
            "05-family-white-original-texture-v3.png": "1950s/05-family-1950s.webp",
        },
    },
}


def build(name: str, spec: dict, html: str) -> str:
    # Every illustration is a direct child image of arc3-solution-draft/ (charts live in charts/).
    found = set(re.findall(r'src="' + re.escape(PREFIX) + r'([^"/]+\.png)"', html))
    images = spec["images"]
    unknown = sorted(found - images.keys())
    if unknown:
        raise SystemExit(f"[{name}] no copy mapped for: " + ", ".join(unknown))
    for src in found:
        if not (HERE / images[src]).is_file():
            raise SystemExit(f"[{name}] mapped file missing on disk: {images[src]}")
        html = html.replace(f'src="{PREFIX}{src}"', f'src="{PREFIX}{images[src]}"')

    # Page-level changes, each must match exactly once.
    edits = [
        (r'<meta content="noindex" name="robots">', '<meta content="noindex, nofollow" name="robots">'),
        (r"<title>(.*?)</title>", r"<title>\1 (" + spec["title"] + ")</title>"),
        (r"</head>", spec["css"].replace("\\", "\\\\") + "</head>"),
    ]
    for pattern, repl in edits:
        html, n = re.subn(pattern, repl, html, count=1, flags=re.S)
        if n != 1:
            raise SystemExit(f"[{name}] page edit did not match: {pattern}")
    # Social cards, structured data and canonical keep pointing at the main page.
    return html


def main() -> int:
    html = MAIN.read_text(encoding="utf-8")
    which = sys.argv[1:] or list(VARIANTS)
    # Build everything first so a failure in one variant writes nothing.
    built = {name: build(name, VARIANTS[name], html) for name in which}
    for name, page in built.items():
        out = HERE.parent / VARIANTS[name]["out"]
        out.write_text(page, encoding="utf-8")
        print(f"Wrote {out.name}: illustrations swapped to {name} copies.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
