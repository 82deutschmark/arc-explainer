#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Build the white-background alternate of the Turducken write-up from the main page.
         Reads ../2026-11-06-arc3-solution-draft.html (the main page, which other edits keep
         changing) and writes ../2026-11-06-arc3-solution-draft-white.html, identical except:
           - each illustration's image reference points at its white-background copy in white/
             (the IMAGES map below; charts and the trim animation are untouched);
           - the page background is plain white;
           - the title says this is the alternate, and robots is noindex, nofollow.
         Every text edit to the main page carries over by re-running this script. It refuses to
         write if an illustration on the main page has no white copy in IMAGES, or if a mapped
         white file is missing, so a new or renamed picture cannot slip through on its old
         background.
         Run from anywhere: python3 client/public/specials/arc3-solution-draft/make_white_page.py
         White copies are made on the Team 4TB drive (loose-goose/art/2026-11-08-turducken-white,
         transplant_white.py and MANIFEST.txt there); only web-size copies live in white/.
SRP/DRY check: Pass -- the main page stays the single source of the article text; this only
         swaps image references and adds a few lines of page-level CSS and metadata.
"""

from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
MAIN = HERE.parent / "2026-11-06-arc3-solution-draft.html"
OUT = HERE.parent / "2026-11-06-arc3-solution-draft-white.html"
PREFIX = "arc3-solution-draft/"

# Illustration on the main page -> its white-background copy. Add a line here when the main page
# gets a new or replaced illustration (and make its white copy with transplant_white.py).
IMAGES = {
    "00-turducken-texture-v10.png": "white/00-turducken-white.png",
    "01-harness-garage-v2-corners-only.png": "white/01-harness-white.png",
    "02-inference-v2-corners-only.png": "white/02-inference-v2-white.png",
    "03-rl-v1-corners-only.png": "white/03-rl-white.png",
    "04-speed-plateau-v2-corners-only.png": "white/04-speed-plateau-v2-white.png",
    "05-family-white-original-texture-v3.png": "05-family-white-original-texture-v3.png",  # already white
}

WHITE_CSS = (
    "<style>/* White-background alternate (made by arc3-solution-draft/make_white_page.py) */\n"
    ":root{--bg:#ffffff;--surface:#ffffff}html,body{background:#ffffff}"
    "figure.hero{background:#ffffff;border:0;border-radius:0}</style>\n"
)


def main() -> int:
    html = MAIN.read_text(encoding="utf-8")

    # Every illustration is a direct child image of arc3-solution-draft/ (charts live in charts/).
    found = set(re.findall(r'src="' + re.escape(PREFIX) + r'([^"/]+\.png)"', html))
    unknown = sorted(found - IMAGES.keys())
    if unknown:
        print("No white copy mapped for: " + ", ".join(unknown), file=sys.stderr)
        return 1
    for name in found:
        if not (HERE / IMAGES[name]).is_file():
            print(f"White copy missing on disk: {IMAGES[name]}", file=sys.stderr)
            return 1
        html = html.replace(f'src="{PREFIX}{name}"', f'src="{PREFIX}{IMAGES[name]}"')

    # Page-level changes, each must match exactly once.
    edits = [
        (r'<meta content="noindex" name="robots">', '<meta content="noindex, nofollow" name="robots">'),
        (r"<title>(.*?)</title>", r"<title>\1 (white-background version)</title>"),
        (r"</head>", WHITE_CSS + "</head>"),
    ]
    for pattern, repl in edits:
        html, n = re.subn(pattern, repl, html, count=1, flags=re.S)
        if n != 1:
            print(f"Page edit did not match: {pattern}", file=sys.stderr)
            return 1

    # Social cards and structured data keep pointing at the main page; canonical stays the main page.
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT.name}: {len(found)} illustrations swapped to white copies.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
