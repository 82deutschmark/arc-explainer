#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 08-November-2026
PURPOSE: Build the Kaggle-pasteable Markdown of the Turducken write-up from the live main page.
         Reads ../2026-11-06-arc3-solution-draft.html (the main page, the single source of the
         article text) and writes:
           - article-kaggle.md: plain Markdown for a Kaggle write-up (headings, bold, lists,
             simple pipe tables, links, images). Every link and image is an absolute
             https://arc.markbarney.net URL. Illustrations use their white-background copies
             (the IMAGES map imported from make_white_page.py, so both alternates stay in step).
             The context-management animation cannot play on Kaggle, so its committed still
             frame (charts/trim-poster.png) is shown, linked to the animated file, with a one-line
             pointer under it. Site-only lines (the nav and the "Review draft" banner) are dropped.
           - article-kaggle.txt: the same bytes, so browsers show it as text instead of downloading.
           - ../2026-11-06-arc3-solution-draft-kaggle.html: a tiny unlisted, noindex page with a
             Copy button, the raw Markdown, and a preview rendered from that Markdown.
         The converter knows exactly the tags the page uses and stops with a message on anything
         else (a new tag, a merged table cell, a pipe inside a cell, an unmapped illustration), so
         a later page change cannot silently produce broken Markdown.
         Run from anywhere: python3 client/public/specials/arc3-solution-draft/make_kaggle_markdown.py
         Then fast-publish the three outputs (tools/specials-publish/publish_specials.py with the
         file paths) and commit them.
SRP/DRY check: Pass -- the main page stays the single source of the text; illustration mapping is
         reused from make_white_page.py; this file only converts and wraps.
"""

from __future__ import annotations

import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True  # keep the published folder free of __pycache__
sys.path.insert(0, str(HERE))
from make_white_page import IMAGES, MAIN, PREFIX  # noqa: E402  (same folder)

BASE = "https://arc.markbarney.net/specials/"
OUT_MD = HERE / "article-kaggle.md"
OUT_TXT = HERE / "article-kaggle.txt"
OUT_PAGE = HERE.parent / "2026-11-06-arc3-solution-draft-kaggle.html"
ANIMATION = "arc3-solution-draft/charts/trim.webp"
POSTER = "arc3-solution-draft/charts/trim-poster.png"

VOID = {"img", "source", "br"}
KNOWN = {
    "main", "nav", "p", "div", "h1", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em",
    "code", "a", "span", "br", "table", "thead", "tbody", "tr", "th", "td", "figure",
    "figcaption", "img", "picture", "source", "details", "summary",
}


class Fail(Exception):
    pass


class Node:
    def __init__(self, tag: str, attrs: dict[str, str]):
        self.tag, self.attrs, self.children = tag, attrs, []

    def cls(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def kids(self) -> list["Node"]:
        return [c for c in self.children if isinstance(c, Node)]

    def find(self, tag: str) -> "Node | None":
        for c in self.kids():
            if c.tag == tag:
                return c
            hit = c.find(tag)
            if hit:
                return hit
        return None


class TreeBuilder(HTMLParser):
    """Builds a small tree of <main>; text is kept raw and unescaped by HTMLParser itself."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root: Node | None = None
        self.stack: list[Node] = []

    def handle_starttag(self, tag, attrs):
        if tag == "main" and self.root is None:
            self.root = Node(tag, dict(attrs))
            self.stack = [self.root]
            return
        if not self.stack:
            return
        if tag not in KNOWN:
            raise Fail(f"Unknown tag inside the article: <{tag}>")
        node = Node(tag, {k: v or "" for k, v in attrs})
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        if not self.stack or tag in VOID:
            return
        if self.stack[-1].tag != tag:
            raise Fail(f"Unbalanced </{tag}> (open: <{self.stack[-1].tag}>)")
        self.stack.pop()

    def handle_data(self, data):
        if self.stack:
            self.stack[-1].children.append(data)


def absolute(path: str) -> str:
    if path.startswith("https://"):
        return path
    if not path.startswith(PREFIX):
        raise Fail(f"Unexpected relative link: {path}")
    return BASE + path


def escape_text(text: str) -> str:
    # The only Markdown-active character in the article's prose is "~" (as in "~52k"); some
    # renderers read a pair of single tildes as strikethrough. Backslashes and stars are checked.
    if re.search(r"[*_`\\\[\]<>|#]", text):
        raise Fail(f"Text needs escaping this script does not do yet: {text[:60]!r}")
    return text.replace("~", r"\~")


def inline(node: Node, in_cell: bool = False) -> str:
    out = []
    for c in node.children:
        if isinstance(c, str):
            out.append(escape_text(re.sub(r"\s+", " ", c)))
            continue
        if c.tag in ("strong", "b"):
            out.append(f"**{inline(c, in_cell).strip()}**")
        elif c.tag == "em":
            out.append(f"*{inline(c, in_cell).strip()}*")
        elif c.tag == "code":
            out.append(f"`{''.join(t for t in c.children if isinstance(t, str))}`")
        elif c.tag == "a":
            out.append(f"[{inline(c, in_cell).strip()}]({absolute(c.attrs['href'])})")
        elif c.tag == "span":
            out.append(inline(c, in_cell))
        elif c.tag == "br":
            out.append("\n")
        else:
            raise Fail(f"<{c.tag}> inside running text")
    text = "".join(out)
    if in_cell and "|" in text:
        raise Fail(f"Pipe inside a table cell: {text[:60]!r}")
    return text


def para(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text).strip()
    # A block that starts like a list marker or heading would change meaning.
    if re.match(r"([-+>#]|\d+\.)\s", text):
        raise Fail(f"Paragraph starts like Markdown syntax: {text[:40]!r}")
    return text


def render_list(node: Node, depth: int = 0) -> list[str]:
    lines, n = [], 0
    for li in node.kids():
        if li.tag != "li":
            raise Fail(f"<{li.tag}> directly inside a list")
        n += 1
        marker = f"{n}." if node.tag == "ol" else "-"
        text_part = Node("li", {})
        text_part.children = [c for c in li.children if not (isinstance(c, Node) and c.tag in ("ul", "ol"))]
        lines.append("    " * depth + f"{marker} {para(inline(text_part))}")
        for sub in li.kids():
            if sub.tag in ("ul", "ol"):
                lines.extend(render_list(sub, depth + 1))
    return lines


def render_table(table: Node) -> str:
    rows = []
    for tr in [n for part in table.kids() for n in part.kids()]:
        cells = []
        for cell in tr.kids():
            if cell.attrs.get("colspan") or cell.attrs.get("rowspan"):
                raise Fail("Merged table cell; Kaggle tables need one cell per column")
            cells.append(para(inline(cell, in_cell=True)) if cell.children else "")
        rows.append(cells)
    width = len(rows[0])
    if any(len(r) != width for r in rows):
        raise Fail("Table rows have different lengths")
    lines = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join(r) + " |" for r in rows[1:]]
    return "\n".join(lines)


def image(src_rel: str, alt: str, link: str | None = None) -> str:
    img = f"![{alt}]({absolute(src_rel)})"
    return f"[{img}]({absolute(link)})" if link else img


def render_figure(fig: Node) -> list[str]:
    blocks: list[str] = []
    if "hero" in fig.cls():
        img = fig.find("img")
        name = img.attrs["src"].removeprefix(PREFIX)
        if name not in IMAGES:
            raise Fail(f"No white copy mapped for illustration {name} (add it in make_white_page.py)")
        if not (HERE / IMAGES[name]).is_file():
            raise Fail(f"White copy missing on disk: {IMAGES[name]}")
        alt = html.unescape(img.attrs["alt"])
        blocks.append(image(PREFIX + IMAGES[name], alt))
        cap = fig.find("figcaption")
        if cap:
            # Line breaks in a caption become separate italic lines.
            for line in inline(cap).split("\n"):
                blocks.append(f"*{para(line)}*")
        else:
            blocks.append(f"*{alt}*")
        return blocks
    if fig.attrs.get("id") == "fig-trim":
        img = fig.find("img")
        if img.attrs["src"] != ANIMATION or not (HERE.parent / POSTER).is_file():
            raise Fail("The animation figure changed; check the poster and animation paths")
        for div in fig.kids():
            if div.tag == "div" and "ft" in div.cls():
                blocks.append(f"**{para(inline(div))}**")
            elif div.tag == "div" and "fs" in div.cls():
                blocks.append(para(inline(div)))
        blocks.append(image(POSTER, html.unescape(img.attrs["alt"]), ANIMATION))
        blocks.append(f"*{para(inline(fig.find('figcaption')))}*")
        # An explicit link, not a bare URL, so no renderer swallows the closing star into the address.
        blocks.append(f"*This is a still frame from an animation: [watch the animation]({absolute(ANIMATION)}).*")
        return blocks
    if "redrawn-figure" in fig.cls():
        for child in fig.kids():
            if child.tag == "div" and "chart" in child.cls():
                a, img = child.find("a"), child.find("img")
                alt = html.unescape(img.attrs["alt"])
                blocks.append(image(img.attrs["src"], alt, a.attrs["href"]))
                blocks.append(f"*{alt}*")
            elif child.tag == "p" and "chart-download" in child.cls():
                blocks.append(para(inline(child)))
            elif child.tag == "details":
                # Kaggle Markdown has no collapsible block; the table is shown under a label.
                blocks.append("**Chart data**")
                blocks.append(render_table(child.find("table")))
            else:
                raise Fail(f"Unexpected <{child.tag}> in a chart figure")
        return blocks
    raise Fail(f"Unknown figure: {fig.attrs}")


def render(node: Node) -> list[str]:
    blocks: list[str] = []
    for c in node.children:
        if isinstance(c, str):
            if c.strip():
                raise Fail(f"Loose text in a block: {c.strip()[:60]!r}")
            continue
        tag, cls = c.tag, c.cls()
        if tag == "nav":
            continue  # site navigation
        if tag == "p" and "byline" in cls and "".join(map(str, c.children)).startswith("Review draft"):
            continue  # review banner, meaningful only on our site
        if tag in ("h1", "h2", "h3", "h4"):
            blocks.append("#" * int(tag[1]) + " " + para(inline(c)))
        elif tag == "p" or (tag == "div" and "byline" in cls):
            blocks.append(para(inline(c)))
        elif tag in ("ul", "ol"):
            blocks.append("\n".join(render_list(c)))
        elif tag == "figure":
            blocks.extend(render_figure(c))
        elif tag == "div" and ("tablewrap" in cls) and c.find("table"):
            blocks.append(render_table(c.find("table")))
        elif tag == "div" and "tldr" in cls:
            blocks.extend(render(c))
        else:
            raise Fail(f"Unexpected block <{tag} class='{' '.join(cls)}'>")
    return blocks


# ---- Preview: a small renderer for exactly the Markdown written above --------------------------

def md_inline(text: str) -> str:
    text = html.escape(text, quote=False).replace(r"\~", "~")
    codes: list[str] = []
    text = re.sub(r"`([^`]+)`", lambda m: codes.append(m.group(1)) or f"\x00{len(codes)-1}\x00", text)
    text = re.sub(r"\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)",
                  r'<a href="\3"><img alt="\1" src="\2"></a>', text)
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img alt="\1" src="\2">', text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", text)
    text = re.sub(r"(https://[^\s<\"]+)(?![^<]*>)(?![^<]*</a>)", r'<a href="\1">\1</a>', text)
    return re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", text)


def md_list(lines: list[str]) -> str:
    out, stack = [], []  # stack of (indent, tag)
    for line in lines:
        indent = len(line) - len(line.lstrip(" "))
        m = re.match(r"\s*(-|\d+\.) (.*)", line)
        tag = "ul" if m.group(1) == "-" else "ol"
        while stack and stack[-1][0] > indent:
            out.append(f"</li></{stack.pop()[1]}>")
        if not stack or stack[-1][0] < indent:
            stack.append((indent, tag))
            out.append(f"<{tag}>")
        else:
            out.append("</li>")
        out.append(f"<li>{md_inline(m.group(2))}")
    while stack:
        out.append(f"</li></{stack.pop()[1]}>")
    return "".join(out)


def md_to_html(md: str) -> str:
    out = []
    for block in md.strip().split("\n\n"):
        lines = block.split("\n")
        if m := re.match(r"(#{1,4}) (.*)", block):
            n = len(m.group(1))
            out.append(f"<h{n}>{md_inline(m.group(2))}</h{n}>")
        elif block.startswith("| "):
            cells = [[c.strip() for c in ln.strip("|").split(" | ")] for ln in lines]
            head = "".join(f"<th>{md_inline(c)}</th>" for c in cells[0])
            body = "".join("<tr>" + "".join(f"<td>{md_inline(c)}</td>" for c in r) + "</tr>"
                           for r in cells[2:])
            out.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
        elif re.match(r"(-|\d+\.) ", block):
            out.append(md_list(lines))
        else:
            out.append(f"<p>{md_inline(block)}</p>")
    return "\n".join(out)


PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta content="noindex, nofollow" name="robots">
<title>Stuffing the Turducken: Markdown for Kaggle</title>
<!-- Made by arc3-solution-draft/make_kaggle_markdown.py from the main page; do not edit by hand. -->
<style>
body{{margin:0;background:#fff;color:#1d1a17;font:16px/1.55 Georgia,serif}}
header{{position:sticky;top:0;background:#f4efe6;border-bottom:1px solid #d9cfc0;padding:12px 20px;
display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:14px}}
button{{font:600 15px system-ui,sans-serif;padding:8px 18px;border:1px solid #7a3d17;background:#8f4a1d;
color:#fff;border-radius:4px;cursor:pointer}}
#status{{color:#5b5248}} header a{{color:#7a3d17}}
main{{max-width:860px;margin:0 auto;padding:20px}}
details{{margin:0 0 24px}} summary{{cursor:pointer;font-family:system-ui,sans-serif}}
textarea{{width:100%;height:320px;font:13px/1.4 ui-monospace,Menlo,monospace;box-sizing:border-box}}
.preview img{{max-width:100%;height:auto}}
.preview table{{border-collapse:collapse;font-size:13px;display:block;overflow-x:auto}}
.preview th,.preview td{{border:1px solid #d9cfc0;padding:4px 7px;text-align:left;vertical-align:top}}
.preview code{{background:#f4efe6;padding:0 3px}}
</style></head>
<body>
<header><button id="copy" type="button">Copy Markdown</button><span id="status">Copies the whole write-up,
ready to paste into a Kaggle write-up.</span> <a href="arc3-solution-draft/article-kaggle.txt">Raw file</a></header>
<main>
<details><summary>Show the raw Markdown</summary><textarea id="md" readonly>{md_escaped}</textarea></details>
<div class="preview">
{preview}
</div>
</main>
<script>
document.getElementById('copy').addEventListener('click', async () => {{
  const box = document.getElementById('md'), status = document.getElementById('status');
  try {{ await navigator.clipboard.writeText(box.value); }}
  catch (e) {{ box.closest('details').open = true; box.select(); document.execCommand('copy'); }}
  status.textContent = 'Copied. Paste it into the Kaggle write-up editor.';
}});
</script>
</body></html>
"""


def main() -> int:
    builder = TreeBuilder()
    try:
        builder.feed(MAIN.read_text(encoding="utf-8"))
        if builder.root is None:
            raise Fail("No <main> in the main page")
        md = "\n\n".join(render(builder.root)) + "\n"
    except Fail as err:
        print(f"Stopped: {err}", file=sys.stderr)
        return 1
    if re.search(r"\]\((?!https://)", md) or re.search(r"</?\w", md):
        print("Stopped: a relative link or an HTML tag survived", file=sys.stderr)
        return 1
    OUT_MD.write_text(md, encoding="utf-8")
    OUT_TXT.write_text(md, encoding="utf-8")
    OUT_PAGE.write_text(PAGE.format(md_escaped=html.escape(md), preview=md_to_html(md)), encoding="utf-8")
    images = len(re.findall(r"!\[", md))
    print(f"Wrote {OUT_MD.name}, {OUT_TXT.name} and {OUT_PAGE.name}: {images} images, all links absolute.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
