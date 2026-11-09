#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Build the unlisted PREVIEW page of the ARC Prize 2026 Paper Track write-up, version 2
         ("Universal hands, disposable languages", reframed around skill acquisition), at
         ../2026-11-08-arc3-paper-track-preview.html. Reads article.md in this folder: the title,
         subtitle and cover line, then the v2 Kaggle body (bubba-workspace
         docs/plans/2026-11-08-arc-paper-track/writeup-kaggle-body-v2.md) word for word, minus its
         authoring comment and its "DRAFT NOTE, remove before Submit" line. The page carries noindex,
         a "Preview draft, not submitted" banner and the cover image, and is not linked from any
         listing, nav or sitemap.
         The Markdown converter is the one in ../arc-paper-track-draft/make_page.py (the first
         draft's page), reused here; this script adds [text](url) links, which v2 uses and the
         first draft did not, and keeps the number check honest about them (URL digits are left
         out of the comparison because they are not visible text).
         Run from anywhere: python3 client/public/specials/arc3-paper-track-preview/make_page.py
         Then fast-publish (tools/specials-publish/publish_specials.py with the file paths) and commit.
SRP/DRY check: Pass -- converter, inline rules and look reused from the first draft's generator,
         which is left unchanged; article.md is the only copy of the text in this folder.
"""

from __future__ import annotations

import html
import importlib.util
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "article.md"
OUT = HERE.parent / "2026-11-08-arc3-paper-track-preview.html"
FOLDER = "arc3-paper-track-preview"
URL = "https://arc.markbarney.net/specials/2026-11-08-arc3-paper-track-preview.html"
COVER = f"https://arc.markbarney.net/specials/{FOLDER}/cover-universal-hands.png"
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")

# Load the first draft's generator as a module (it lives in a sibling folder, not a package).
_spec = importlib.util.spec_from_file_location("first_draft", HERE.parent / "arc-paper-track-draft" / "make_page.py")
first = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(first)
_plain_inline = first.inline


def inline(text: str) -> str:
    """The first draft's inline rules, plus [text](url) links (link text gets the same rules)."""
    out, pos = [], 0
    for m in LINK.finditer(text):
        out.append(_plain_inline(text[pos:m.start()]) if m.start() > pos else "")
        out.append(f'<a href="{html.escape(m.group(2))}">{_plain_inline(m.group(1))}</a>')
        pos = m.end()
    out.append(_plain_inline(text[pos:]) if pos < len(text) else "")
    return "".join(out)


# convert() looks up inline and FOLDER as module globals, so point them at this page's versions.
first.inline = inline
first.FOLDER = FOLDER


def main() -> None:
    md = SOURCE.read_text(encoding="utf-8")
    if "DRAFT NOTE" in md:
        sys.exit("article.md still carries the DRAFT NOTE line; it belongs in no page body")
    title, subtitle, cover, body = first.convert(md)
    full = f"{title}: {subtitle}"
    desc = ("Preview of Team Turducken's ARC Prize 2026 Paper Track write-up: people write a universal toolkit once, "
            "and a 4-bit model writes, tests and throws away its own Python skills for every ARC-AGI-3 game.")
    e = html.escape
    page = f"""<!doctype html>
<!-- Author: Claude Opus 5.5 Low; Date: 08-November-2026; PURPOSE: unlisted preview of Team Turducken's ARC Prize 2026 Paper Track write-up, version 2 (not submitted); written by make_page.py from arc3-paper-track-preview/article.md. SRP/DRY check: Pass - converter and look reused from the first draft's page. -->
<html lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1" name="viewport"><meta content="noindex, nofollow" name="robots">
<title>{e(full)} (preview)</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{URL}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ARC Explainer">
<meta property="og:title" content="{e(full)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{COVER}">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="900">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{COVER}">
<style>
/* The Turducken special's white engineering-blog look (2026-11-06-arc3-solution-draft.html), as trimmed for the first draft's page. */
:root {{ color-scheme: light; --bg: #ffffff; --panel: #f7f8f6; --ink: #15171a; --ink-2: #4c5258; --muted: #858b91;
  --line: #e3e6e1; --accent: #2b8a3e; --accent-soft: #edf6ef; --warn: #b4531f; --warn-soft: #fdf1e8;
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
/* The preview banner uses a warm tone, not the green accent, so it does not read as part of the article. */
.preview {{ border: 1px solid var(--line); border-left: 3px solid var(--warn); background: var(--warn-soft); border-radius: 8px;
  padding: 10px 16px; margin: 0 0 22px; font: 600 0.82rem/1.5 var(--mono); color: var(--warn); }}
ul, ol {{ margin: 0 0 14px; padding-left: 22px; }}
li {{ margin: 5px 0; }}
strong {{ font-weight: 600; }}
code {{ font: 0.84em var(--mono); background: var(--panel); border: 1px solid var(--line); padding: 1px 5px; border-radius: 4px; }}
figure.hero {{ margin: 18px 0 30px; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }}
figure.hero img {{ display: block; width: 100%; height: auto; }}
</style>
</head><body>
<main><nav><a href="/">ARC Explainer</a></nav>
<div class="preview" role="note">Preview draft, not submitted</div>
<h1>{inline(title)}</h1>
<p class="dek">{inline(subtitle)}</p>
<div class="byline"><b>Team Turducken</b> · ARC Prize 2026 Paper Track, ARC-AGI-3</div>
{cover}
<div class="prose">
{body}
</div>
</main>
</body></html>
"""
    OUT.write_text(page, encoding="utf-8")
    # Number check: every number in the visible source text must appear in the page the same number of times.
    # Link URLs are not visible text, so links are reduced to their text on the source side (the page side
    # loses the href when tags are stripped).
    body_text = html.unescape(re.sub(r"<[^>]+>", "", cover + body + title + subtitle))
    src_text = LINK.sub(r"\1", md)
    src_text = re.sub(r"(?m)^\d+\. ", "", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", src_text))
    if first.numbers(src_text) != first.numbers(body_text):
        sys.exit("Number check failed: page numbers differ from article.md")
    if "[" in body_text and "](" in body_text:
        sys.exit("A Markdown link was left unconverted")
    print(f"wrote {OUT.name}; number check passed ({len(first.numbers(src_text))} numbers)")


if __name__ == "__main__":
    main()
