#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Build the unlisted review-draft page for the ARC Prize 2026 Paper Track write-up
         ("Universal hands, disposable languages"), posted under Mark Barney for Team Turducken.
         Reads article.md in this folder (the single source of the text: the Kaggle write-up body
         carried over word for word, minus its "DRAFT NOTE" line) and writes
         ../2026-11-08-arc-paper-track-draft.html in the Turducken special's white look, with
         noindex, a "Review draft" banner listing the open items, and the cover image.
         The converter knows only what article.md uses (# / ## headings, paragraphs, - and 1. lists,
         **bold**, *italic*, `code`, one leading image) and stops on anything else, so a later edit
         cannot silently drop text. After running it, the script checks that every number in
         article.md also appears in the page, the same number of times.
         Run from anywhere: python3 client/public/specials/arc-paper-track-draft/make_page.py
         Then fast-publish (tools/specials-publish/publish_specials.py with the file paths) and commit.
SRP/DRY check: Pass -- page look copied from 2026-11-06-arc3-solution-draft.html (the Turducken
         special); article.md stays the only copy of the text; no listing, sitemap or route changes.
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "article.md"
OUT = HERE.parent / "2026-11-08-arc-paper-track-draft.html"
URL = "https://arc.markbarney.net/specials/2026-11-08-arc-paper-track-draft.html"
CARD = "https://arc.markbarney.net/specials/arc-paper-track-draft/card-universal-hands-1120x560.png"
FOLDER = "arc-paper-track-draft"

# The items the Kaggle body's "DRAFT NOTE, remove before Submit" line listed; shown in the banner
# instead of the article text until the team settles them.
OPEN_ITEMS = (
    "confirm the Kaggle submission ID and that script version 363005415 is the 28-Oct 53.70 submission; "
    "say what the 5-Nov 56.77 submission was; add credits (Daniel Franzen, Tufa Labs, Intel AutoRound, "
    "team members); add the harness tree link; make the notebook public."
)


def inline(text: str) -> str:
    """Escape, then apply `code`, **bold** and *italic*; code spans are protected from the other two."""
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if part.startswith("`") and part.endswith("`") and len(part) > 1:
            out.append(f"<code>{html.escape(part[1:-1], quote=False)}</code>")
            continue
        if "`" in part:
            sys.exit(f"Unpaired backtick in: {text!r}")
        s = html.escape(part, quote=False)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
        if "*" in s:
            sys.exit(f"Unconverted asterisk in: {text!r}")
        out.append(s)
    return "".join(out)


def convert(md: str) -> tuple[str, str, str, str]:
    """Return (title, subtitle, cover img tag, body html)."""
    blocks = [b for b in md.strip("\n").split("\n\n")]
    title_line, subtitle_line, image_line, *rest = blocks
    if not title_line.startswith("# "):
        sys.exit("article.md must start with '# title'")
    m = re.fullmatch(r"\*([^*]+)\*", subtitle_line)
    if not m:
        sys.exit("second block must be the *subtitle*")
    img = re.fullmatch(r"!\[([^\]]+)\]\(([^)]+)\)", image_line)
    if not img:
        sys.exit("third block must be the cover image")
    cover = (f'<figure class="hero"><img src="{FOLDER}/{html.escape(img.group(2))}" width="1600" height="900" '
             f'alt="{html.escape(img.group(1))}" loading="eager"></figure>')
    body = []
    for block in rest:
        lines = block.split("\n")
        if len(lines) == 1 and block.startswith("## "):
            body.append(f"<h2>{inline(block[3:])}</h2>")
        elif all(l.startswith("- ") for l in lines):
            body.append("<ul>" + "".join(f"<li>{inline(l[2:])}</li>" for l in lines) + "</ul>")
        elif all(re.match(r"\d+\. ", l) for l in lines):
            items = [re.sub(r"^\d+\. ", "", l) for l in lines]
            body.append("<ol>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ol>")
        elif len(lines) == 1 and not re.match(r"[#>|!]|- |\d+\. ", block):
            body.append(f"<p>{inline(block)}</p>")
        else:
            sys.exit(f"Unknown block shape, stopping:\n{block}")
    return title_line[2:], m.group(1), cover, "\n".join(body)


def numbers(text: str) -> list[str]:
    return sorted(re.findall(r"\d[\d,.]*\d|\d", text))


def main() -> None:
    md = SOURCE.read_text(encoding="utf-8")
    title, subtitle, cover, body = convert(md)
    full = f"{title}: {subtitle}"
    desc = ("Team Turducken's ARC Prize 2026 Paper Track write-up: the harness gives a 4-bit model universal hands, "
            "and the model writes its own small language of Python functions for every ARC-AGI-3 game.")
    e = html.escape
    page = f"""<!doctype html>
<!-- Author: Claude Opus 5.5 Low; Date: 08-November-2026; PURPOSE: unlisted review draft of Team Turducken's ARC Prize 2026 Paper Track write-up, posted under Mark Barney; written by make_page.py from arc-paper-track-draft/article.md. SRP/DRY check: Pass - look copied from the Turducken special. -->
<html lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1" name="viewport"><meta content="noindex" name="robots">
<title>{e(full)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{URL}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ARC Explainer">
<meta property="og:title" content="{e(full)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{CARD}">
<meta property="og:image:width" content="1120">
<meta property="og:image:height" content="560">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{CARD}">
<style>
/* The Turducken special's white engineering-blog look (2026-11-06-arc3-solution-draft.html), trimmed to what this page uses. */
:root {{ color-scheme: light; --bg: #ffffff; --panel: #f7f8f6; --ink: #15171a; --ink-2: #4c5258; --muted: #858b91;
  --line: #e3e6e1; --accent: #2b8a3e; --accent-soft: #edf6ef;
  --display: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace; }}
* {{ box-sizing: border-box; }}
html {{ -webkit-text-size-adjust: 100%; background: var(--bg); }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.65 var(--body); }}
main {{ max-width: 860px; margin: 0 auto; padding: 44px 20px 80px; }}
.prose {{ max-width: 680px; }}
nav {{ font: 0.8rem var(--mono); color: var(--muted); margin-bottom: 18px; }}
h1, h2 {{ font-family: var(--display); font-weight: 700; text-wrap: balance; line-height: 1.2; letter-spacing: -0.015em; }}
h1 {{ font-size: 2.2rem; margin: 6px 0 6px; }}
.dek {{ font-size: 1.12rem; color: var(--ink-2); margin: 0 0 14px; }}
h2 {{ font-size: 1.45rem; margin: 48px 0 10px; }}
p {{ margin: 0 0 14px; }}
a {{ color: var(--accent); text-underline-offset: 2px; }}
.byline {{ font: 0.82rem var(--mono); color: var(--muted); margin-bottom: 22px; }}
.byline b {{ color: var(--ink-2); font-weight: 500; }}
.draft {{ border: 1px solid var(--line); border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 8px;
  padding: 12px 16px; margin: 0 0 22px; font: 0.8rem/1.55 var(--mono); color: var(--ink-2); }}
ul, ol {{ margin: 0 0 14px; padding-left: 22px; }}
li {{ margin: 5px 0; }}
strong {{ font-weight: 600; }}
code {{ font: 0.84em var(--mono); background: var(--panel); border: 1px solid var(--line); padding: 1px 5px; border-radius: 4px; }}
figure.hero {{ margin: 18px 0 30px; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }}
figure.hero img {{ display: block; width: 100%; height: auto; }}
</style>
</head><body>
<main><nav><a href="/">ARC Explainer</a> · <a download="" href="{FOLDER}/article.md">Markdown</a></nav>
<p class="byline">Review draft · not submitted · Paper Track write-up, the same text as the Kaggle draft on Mark Barney's account</p>
<h1>{inline(title)}</h1>
<p class="dek">{inline(subtitle)}</p>
<div class="byline"><b>Mark Barney</b> · for Team Turducken (Son Pham's ARC-AGI-3 submission) · ARC Prize 2026 Paper Track, ARC-AGI-3</div>
<div class="draft"><b>Still open before Submit:</b> {e(OPEN_ITEMS)}</div>
{cover}
<div class="prose">
{body}
</div>
</main>
</body></html>
"""
    OUT.write_text(page, encoding="utf-8")
    # Number check: every number in the source text must appear in the page body the same number of times.
    body_text = html.unescape(re.sub(r"<[^>]+>", "", cover + body + title + subtitle))
    # Ordered-list markers ("1. ") become <ol> numbering, so they are left out of the comparison.
    src_text = re.sub(r"(?m)^\d+\. ", "", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md))
    if numbers(src_text) != numbers(body_text):
        sys.exit("Number check failed: page numbers differ from article.md")
    print(f"wrote {OUT.name}; number check passed ({len(numbers(src_text))} numbers)")


if __name__ == "__main__":
    main()
