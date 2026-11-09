#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 09-November-2026
PURPOSE: Build the unlisted PREVIEW page of Team Turducken's FOURTH ARC Prize 2026 Paper Track
         write-up, the Boss-led v4 ("Slop Breaks a Rule"), at
         ../2026-11-09-arc3-paper-track-boss-v4-preview.html. Reads article.md in this folder, which is
         the body of bubba-workspace docs/plans/2026-11-08-arc-paper-track/writeup-boss-v4.md
         word for word (the part between its two horizontal rules), minus its authoring comment and
         the "Reviewer notes" after the body.
         Same plain reading look as the first two previews: one narrow column of system serif text,
         the small "Preview draft, not submitted" line, title, subtitle, body. No cover image, nav,
         byline, cards or colours. noindex, and not linked from any listing, nav or sitemap.
         Run from anywhere: python3 client/public/specials/arc3-paper-track-boss-v4-preview/make_page.py
         Then fast-publish (tools/specials-publish/publish_specials.py with the file path) and commit.
SRP/DRY check: Pass -- copied from ../arc3-paper-track-boss-preview/make_page.py with new paths and text; block converter, inline rules and number check reused from
         ../arc-paper-track-draft/make_page.py (unchanged); the style block matches the first preview.
"""

from __future__ import annotations

import html
import importlib.util
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "article.md"
OUT = HERE.parent / "2026-11-09-arc3-paper-track-boss-v4-preview.html"
URL = "https://arc.markbarney.net/specials/2026-11-09-arc3-paper-track-boss-v4-preview.html"

# Load the first draft's generator as a module (it lives in a sibling folder, not a package).
_spec = importlib.util.spec_from_file_location("first_draft", HERE.parent / "arc-paper-track-draft" / "make_page.py")
first = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(first)


def convert(md: str) -> tuple[str, str, str]:
    """Return (title, subtitle, body html).

    first.convert() insists on a cover image as the third block. This page has none, so a
    placeholder image block is slipped in after the subtitle and its figure is thrown away.
    """
    blocks = md.strip("\n").split("\n\n")
    if len(blocks) < 3:
        sys.exit("article.md needs a title, a subtitle and a body")
    # The first draft's converter knows no block quotes (this draft opens on a one-line epigraph). Each quote
    # block is swapped for a marker paragraph, converted, then put back as a <blockquote>.
    quotes = []
    for i, b in enumerate(blocks):
        if b.startswith("> "):
            quotes.append(b[2:])
            blocks[i] = f"QUOTEBLOCK{len(quotes) - 1}"
    with_cover = "\n\n".join(blocks[:2] + ["![none](none)"] + blocks[2:])
    title, subtitle, _cover, body = first.convert(with_cover)
    for n, q in enumerate(quotes):
        marker = f"<p>QUOTEBLOCK{n}</p>"
        if marker not in body:
            sys.exit(f"quote marker {n} lost in conversion")
        body = body.replace(marker, f"<blockquote><p>{first.inline(q)}</p></blockquote>")
    return title, subtitle, body


def main() -> None:
    md = SOURCE.read_text(encoding="utf-8")
    if "Reviewer notes" in md or "Notes for reviewers" in md or "DRAFT NOTE" in md:
        sys.exit("article.md still carries reviewer notes; they belong in no page body")
    title, subtitle, body = convert(md)
    inline = first.inline
    desc = ("Preview of Team Turducken's Boss-led ARC Prize 2026 Paper Track write-up, fourth version: slop breaks a "
            "rule, and a small open model on ARC-AGI-3 lets the live game frame say no.")
    e = html.escape
    page = f"""<!doctype html>
<!-- Author: Claude Opus 5.5 Low; Date: 09-November-2026; PURPOSE: unlisted preview of Team Turducken's Boss-led ARC Prize 2026 Paper Track write-up, fourth version (not submitted); written by make_page.py from arc3-paper-track-boss-v4-preview/article.md. SRP/DRY check: Pass - converter reused from the first draft's page; plain reading look matches the first two previews. -->
<html lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1" name="viewport"><meta content="noindex, nofollow" name="robots">
<title>{e(title)} (preview)</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{URL}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ARC Explainer">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{URL}">
<meta name="twitter:card" content="summary">
<style>
/* Plain reading look, same as the first preview: one narrow column, system serif body, real headings,
   no cards, colours, borders or decoration. */
:root {{ color-scheme: light; }}
html {{ -webkit-text-size-adjust: 100%; }}
body {{ margin: 0; background: #fff; color: #1a1a1a; font: 19px/1.6 Charter, "Iowan Old Style", Georgia, "Times New Roman", serif; }}
main {{ max-width: 40rem; margin: 0 auto; padding: 48px 20px 96px; }}
.note {{ font-size: 0.85rem; color: #666; margin: 0 0 20px; }}
h1, h2 {{ font-family: -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.25; }}
h1 {{ font-size: 2rem; margin: 0 0 8px; }}
.subtitle {{ font-size: 1.15rem; font-style: italic; color: #444; margin: 0 0 28px; }}
h2 {{ font-size: 1.35rem; margin: 2.2em 0 0.6em; }}
p, ul, ol {{ margin: 0 0 1em; }}
ul, ol {{ padding-left: 1.4em; }}
li {{ margin: 0 0 0.5em; }}
a {{ color: #1a4f9c; }}
blockquote {{ margin: 0 0 1.4em; padding: 0 0 0 1em; border-left: 3px solid #ccc; color: #333; }}
code {{ font: 0.85em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
</style>
</head><body>
<main>
<p class="note">Preview draft, not submitted</p>
<h1>{inline(title)}</h1>
<p class="subtitle">{inline(subtitle)}</p>
{body}
</main>
</body></html>
"""
    OUT.write_text(page, encoding="utf-8")
    # Number check: every number in the source text must appear in the page the same number of times.
    # Numbered headings ("## 1. Submission") keep their numbers on the page, so nothing is stripped here.
    page_text = html.unescape(re.sub(r"<[^>]+>", "", body + title + subtitle))
    if first.numbers(md) != first.numbers(page_text):
        sys.exit("Number check failed: page numbers differ from article.md")
    print(f"wrote {OUT.name}; number check passed ({len(first.numbers(md))} numbers)")


if __name__ == "__main__":
    main()
