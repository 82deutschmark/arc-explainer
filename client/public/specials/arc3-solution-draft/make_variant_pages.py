#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low (round 9 1950s set: Claude Opus 5.5 Low; round 13 art decision, main page on the
        1950s art and every alternate built from one art table: Claude Opus 5.5 Low)
Date: 08-November-2026
PURPOSE: Build every art alternate of the Turducken write-up from the main page.
         Round 13 (Son's decision): the main page, 2026-11-06-arc3-solution-draft.html, shows the 1950s
         pulp science-fiction art (1950s/*-r9.webp, generated fresh in round 9 with ngyzly drawn as his
         cat) inside the newsprint theme, and stays the single source of the article text. This script
         writes the alternates, each with identical text:
           - classic: the original painted art on its own backgrounds (the pictures the main page used
             until round 13), on the plain white page theme. Also the art set of the Kaggle copy.
           - white: the original art cut out onto plain white (white/), white page background.
           - cat: the original art with ngyzly redrawn as his cat (cat/).
           - 1950s: the same art and theme as the main page, kept so old links still work.
         Only these things differ from the main page: each illustration's image reference (the ART
         table below, one row per picture slot; charts and the animations are untouched), the
         newsprint theme block (kept only by the 1950s alternate), a little page CSS, the title
         suffix, and robots noindex, nofollow.
         Tolerant of text edits: it never touches text, only image references and the head. It stops
         without writing anything if the main page does not carry exactly the six main-set pictures,
         if a picture is not rewritten, if a mapped file is missing, or if the theme block's markers
         are gone, so a new or renamed picture cannot slip through on the wrong art.
         Run from anywhere after any edit to the main page:
           python3 client/public/specials/arc3-solution-draft/make_variant_pages.py [classic white cat 1950s]
         Working and full-size files live on the Team 4TB drive (loose-goose/art/2026-11-08-turducken-white,
         -cat-1950s and -r9; MANIFEST.txt in each); only web-size copies live here.
SRP/DRY check: Pass -- the main page stays the single source of the article text; the ART table is the one
         record of which picture belongs to which set (make_white_page.py and make_kaggle_markdown.py import
         it); this only swaps image references and adds page-level CSS and metadata.
"""

from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
MAIN = HERE.parent / "2026-11-06-arc3-solution-draft.html"
PREFIX = "arc3-solution-draft/"
MAIN_SET = "1950s"

# One row per illustration slot, in page order. Add a row (with a copy for every set) when the article
# gets a new picture. The classic column is the original painted art; the closing portrait was already on
# white, so its white copy is the same file.
ART = {
    "hero": {
        "classic": "00-turducken-texture-v10.png",
        "white": "white/00-turducken-white.png",
        "cat": "cat/00-turducken-cat.webp",
        "1950s": "1950s/00-turducken-1950s-r9.webp",
    },
    "harness": {
        "classic": "01-harness-garage-v2-corners-only.png",
        "white": "white/01-harness-white.png",
        "cat": "cat/01-harness-cat.webp",
        "1950s": "1950s/01-harness-1950s-r9.webp",
    },
    "inference": {
        "classic": "02-inference-v2-corners-only.png",
        "white": "white/02-inference-v2-white.png",
        "cat": "cat/02-inference-cat.webp",
        "1950s": "1950s/02-inference-1950s-r9.webp",
    },
    "rl": {
        "classic": "03-rl-v1-corners-only.png",
        "white": "white/03-rl-white.png",
        "cat": "cat/03-rl-cat.webp",
        "1950s": "1950s/03-rl-1950s-r9.webp",
    },
    "speed": {
        "classic": "04-speed-plateau-v2-corners-only.png",
        "white": "white/04-speed-plateau-v2-white.png",
        "cat": "cat/04-speed-plateau-cat.webp",
        "1950s": "1950s/04-speed-plateau-1950s-r9.webp",
    },
    "closing": {
        "classic": "05-family-white-original-texture-v3.png",
        "white": "05-family-white-original-texture-v3.png",
        "cat": "cat/05-family-cat.webp",
        "1950s": "1950s/05-family-1950s-r9.webp",
    },
}

# The newsprint theme lives in the main page's head between these markers; only the 1950s alternate keeps it.
THEME = re.compile(r"<!-- 1950s-theme:start -->.*?<!-- 1950s-theme:end -->\n?", re.S)

WHITE_CSS = (
    "<style>/* White-background alternate (made by arc3-solution-draft/make_variant_pages.py) */\n"
    ":root{--bg:#ffffff;--surface:#ffffff}html,body{background:#ffffff}"
    "figure.hero{background:#ffffff;border:0;border-radius:0}</style>\n"
)

VARIANTS = {
    "classic": {"out": "2026-11-06-arc3-solution-draft-classic.html", "title": "classic illustrated version",
                "theme": False, "css": ""},
    "white": {"out": "2026-11-06-arc3-solution-draft-white.html", "title": "white-background version",
              "theme": False, "css": WHITE_CSS},
    "cat": {"out": "2026-11-06-arc3-solution-draft-cat.html", "title": "cat version", "theme": False, "css": ""},
    "1950s": {"out": "2026-11-06-arc3-solution-draft-1950s.html", "title": "1950s science-fiction version",
              "theme": True, "css": ""},
}

# Any image directly under arc3-solution-draft/ or one folder down, except the charts (and animations) in charts/.
ILLUSTRATION = re.compile(r'src="' + re.escape(PREFIX) + r'((?!charts/)(?:[\w-]+/)?[^"/]+\.(?:png|webp))"')


def art_map(target: str) -> dict[str, str]:
    """Main-page picture path (under PREFIX) -> the same slot's picture in the target set."""
    return {row[MAIN_SET]: row[target] for row in ART.values()}


def illustrations(html: str) -> set[str]:
    """The main-set pictures on the page. Stops unless every slot appears and nothing else does."""
    found = set(ILLUSTRATION.findall(html))
    expected = {row[MAIN_SET] for row in ART.values()}
    if found != expected:
        raise SystemExit("Main page illustrations do not match the ART table's " + MAIN_SET + " column. "
                         f"Unexpected: {sorted(found - expected)}; missing: {sorted(expected - found)}")
    return found


def swap_art(name: str, target: str, html: str) -> str:
    mapping = art_map(target)
    found = illustrations(html)
    swapped = 0
    for src in found:
        new = mapping[src]
        if not (HERE / new).is_file():
            raise SystemExit(f"[{name}] mapped file missing on disk: {new}")
        html, n = re.subn(re.escape(f'src="{PREFIX}{src}"'), f'src="{PREFIX}{new}"', html)
        if n < 1:
            raise SystemExit(f"[{name}] picture not rewritten: {src}")
        swapped += 1
    if swapped != len(ART):
        raise SystemExit(f"[{name}] rewrote {swapped} pictures, expected {len(ART)}")
    return html


def build(name: str, spec: dict, html: str) -> str:
    html = swap_art(name, name, html)
    if not spec["theme"]:
        html, n = THEME.subn("", html)
        if n != 1:
            raise SystemExit(f"[{name}] the 1950s theme markers in the main page's head are missing")

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
    unknown = [w for w in which if w not in VARIANTS]
    if unknown:
        raise SystemExit("Unknown variant: " + ", ".join(unknown) + "; choose from " + ", ".join(VARIANTS))
    # Build everything first so a failure in one variant writes nothing.
    built = {name: build(name, VARIANTS[name], html) for name in which}
    for name, page in built.items():
        out = HERE.parent / VARIANTS[name]["out"]
        out.write_text(page, encoding="utf-8")
        print(f"Wrote {out.name}: {len(ART)} illustrations swapped to {name} copies.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
