"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Turn the JSONL written by hypothesis_sweep.py into something a person can actually
         compare: the hypothesis labels from every run, grouped by sampler cell, side by side.
         The research question is what different thoughts the model has about the same frame,
         so laying the labels next to each other IS the analysis; the counts here only tell you
         where to look.

         Reads any number of JSONL files (including from both machines at once - every row
         carries its own host, model id and full sampler config, so they can be pooled and
         split back apart by cell). Writes a Markdown digest for hand review.

         On the numbers it prints: format adherence, truncation and empty-content rates are
         mechanical facts and are reported as such. The collapse column is an unreliable HINT,
         not a verdict - see the note in `collapse_hint`. Every count is shown with its n, and
         every hint is shown beside the text that triggered it, because the one lesson that
         transfers from the earlier sampler work is that a classifier tuned on one model is
         wrong quietly on the next. Hand-label before citing anything.
SRP/DRY check: Pass - reads and summarises; runs nothing and calls no model. Prompt text lives
         in hypothesis_prompts.py and execution in hypothesis_sweep.py.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

# The Windows console defaults to cp1252, which cannot encode most of what a model emits -
# arrows, dashes, and above all the dense symbol runs that characterise the glossolalic failure
# mode. Printing a flagged run would then raise UnicodeEncodeError, i.e. the tool would crash
# precisely on the output it exists to show. Replace unencodable characters instead; the JSONL
# and the Markdown digest are written as UTF-8 and keep the exact text.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # already wrapped, or not a real console
        pass

# Matches "H1: label", "1. label", "1) label", "**H1 -- label**", "### 3. label" and friends.
#
# Permissive on purpose. The prompt asks for numbered hypotheses in one sentence and does not
# impose an output contract, because a contract strict enough to guarantee clean parsing would
# also prevent the model from producing the malformed and glossolalic answers this experiment
# is trying to measure. So the looseness is pushed here, into the reader, where being wrong is
# recoverable: a hypothesis this misses is still in `content`, and `--show` prints the raw text.
# The trailing (?=\s) after a bare number keeps it from swallowing decimals and grid coordinates.
LABEL_RE = re.compile(
    r"^[ \t]*[*_#>\s]*(?:H\s*(\d+)|(\d+))[ \t]*[:.\)\-–—][ \t]*(.+?)[ \t]*[*_]*[ \t]*$",
    re.MULTILINE,
)
FIELD_RE = re.compile(r"^\s*[*_\s]*(Evidence|Predicts|Test)\s*[:.]\s*(.+)$", re.IGNORECASE | re.MULTILINE)

STOPWORDS = {
    "the", "a", "an", "of", "to", "and", "or", "is", "are", "in", "on", "at", "by", "with",
    "for", "as", "that", "this", "it", "its", "be", "must", "you", "your",
}


def cell_label(row: dict) -> str:
    """Human-readable identity of a sampler cell, used as the grouping key."""
    return (
        f"think={row.get('thinking')} temp={row.get('temperature')} "
        f"top_k={row.get('top_k')} top_p={row.get('top_p')} "
        f"min_p={row.get('min_p')} prompt={row.get('prompt_variant')}"
    )


def parse_hypotheses(content: str) -> list[dict]:
    """Extract H<n> labels and their Evidence/Predicts/Test fields, in document order."""
    hypotheses = []
    matches = list(LABEL_RE.finditer(content or ""))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        block = content[match.start():end]
        fields = {k.lower(): v.strip() for k, v in FIELD_RE.findall(block)}
        number = match.group(1) or match.group(2)
        label = match.group(3).strip().rstrip(":").strip("*_ ")
        # A "label" that runs on for a paragraph means the model wrote prose rather than a
        # name. Keep the opening clause so it can still be clustered, and let the digest and
        # --show carry the rest.
        if len(label) > 120:
            label = label[:120].rsplit(" ", 1)[0] + "..."
        hypotheses.append(
            {
                "n": int(number),
                "label": label,
                "evidence": fields.get("evidence", ""),
                "predicts": fields.get("predicts", ""),
                "test": fields.get("test", ""),
            }
        )
    return hypotheses


def normalise(label: str) -> frozenset[str]:
    """Content words of a label, for crude near-duplicate detection between runs."""
    words = re.findall(r"[a-z]+", label.lower())
    return frozenset(w for w in words if w not in STOPWORDS and len(w) > 2)


def distinct_count(labels: list[str], threshold: float = 0.6) -> int:
    """
    Greedy clustering of labels by content-word overlap.

    A blunt instrument, and it is meant to be: it exists to rank cells by roughly how varied
    their answers were, so a human knows which cell to read first. It will merge two genuinely
    different mechanics that happen to share vocabulary, and split one mechanic described two
    ways. Do not report this number as a finding.
    """
    clusters: list[frozenset[str]] = []
    for label in labels:
        tokens = normalise(label)
        if not tokens:
            continue
        for existing in clusters:
            union = tokens | existing
            if union and len(tokens & existing) / len(union) >= threshold:
                break
        else:
            clusters.append(tokens)
    return len(clusters)


def collapse_hint(content: str) -> tuple[bool, str]:
    """
    Cheap flag for the glossolalic failure mode seen on 01-Sep-2026.

    It looks for a high ratio of non-alphabetic characters, which is what that output had
    (`H≈MathOx(hd8±₁^η ζᵥ)`). This is a HINT ONLY. It was tuned by eye on a single example from
    a single model and it will be wrong on another model without announcing it - it will miss a
    fluent-but-nonsensical answer entirely, which is the more dangerous failure. The evidence
    string is returned with it so a human can confirm or reject every flag.
    """
    text = (content or "").strip()
    if not text:
        return False, ""
    letters = sum(c.isalpha() or c.isspace() for c in text)
    ratio = 1 - (letters / len(text))
    non_ascii = sum(ord(c) > 0x2000 for c in text)
    if ratio > 0.18 or non_ascii > 12:
        worst = max(
            (line for line in text.splitlines() if line.strip()),
            key=lambda line: sum(ord(c) > 0x2000 or not (c.isalnum() or c.isspace()) for c in line),
            default="",
        )
        return True, worst.strip()[:160]
    return False, ""


def load_rows(paths: list[Path]) -> list[dict]:
    rows = []
    for path in paths:
        if not path.exists():
            raise SystemExit(f"No such results file: {path}")
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"  warning: {path.name}:{line_number} is not valid JSON, skipped",
                      file=sys.stderr)
    return rows


def summarise(rows: list[dict]) -> list[dict]:
    by_cell: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        by_cell[(row.get("host"), row.get("model_id"), row.get("game_id"), cell_label(row))].append(row)

    summaries = []
    for (host, model, game, cell), cell_rows in sorted(by_cell.items(), key=lambda kv: str(kv[0])):
        good = [r for r in cell_rows if r.get("ok")]
        labels, per_run, flagged = [], [], []
        for row in good:
            hypotheses = parse_hypotheses(row.get("content", ""))
            per_run.append(len(hypotheses))
            labels.extend(h["label"] for h in hypotheses)
            collapsed, evidence = collapse_hint(row.get("content", ""))
            if collapsed:
                flagged.append((row.get("replicate"), evidence))
        summaries.append(
            {
                "host": host, "model": model, "game": game, "cell": cell,
                "n": len(cell_rows),
                "ok": len(good),
                "failed": sum(1 for r in cell_rows if not r.get("ok")),
                "truncated": sum(1 for r in good if r.get("finish_reason") == "length"),
                "empty": sum(1 for r in good if not (r.get("content") or "").strip()),
                "five": sum(1 for count in per_run if count == 5),
                "labels": labels,
                "distinct": distinct_count(labels),
                "collapse_flags": flagged,
                "median_s": statistics.median(
                    [r.get("elapsed_ms", 0) / 1000 for r in good]
                ) if good else 0,
            }
        )
    return summaries


def print_console(summaries: list[dict]) -> None:
    print()
    header = (
        f"{'game':<11} {'cell':<58} {'n':>3} {'5/5':>4} {'trunc':>6} "
        f"{'empty':>6} {'collapse?':>10} {'labels':>7} {'distinct':>9} {'med s':>6}"
    )
    print(header)
    print("-" * len(header))
    for s in summaries:
        print(
            f"{s['game']:<11} {s['cell']:<58} {s['ok']:>3} {s['five']:>4} {s['truncated']:>6} "
            f"{s['empty']:>6} {len(s['collapse_flags']):>10} {len(s['labels']):>7} "
            f"{s['distinct']:>9} {s['median_s']:>6.0f}"
        )
    print(
        "\n'collapse?' and 'distinct' are HINTS from crude heuristics, not measurements.\n"
        "Read the Markdown digest and hand-label before citing either."
    )


def write_markdown(summaries: list[dict], rows: list[dict], out_path: Path) -> None:
    lines = ["# ARC-3 hypothesis sweep — digest", ""]
    hosts = sorted({r.get("host") for r in rows if r.get("host")})
    models = sorted({r.get("model_id") for r in rows if r.get("model_id")})
    lines += [
        f"Rows: {len(rows)}  |  hosts: {', '.join(hosts)}  |  models: {', '.join(models)}",
        "",
        "Counts below are mechanical. The collapse flags are heuristic hints shown with their "
        "triggering text so they can be confirmed or rejected by eye. Nothing here is a finding "
        "until it has been hand-labelled.",
        "",
    ]

    for s in summaries:
        lines += [
            f"## {s['game']} — {s['cell']}",
            "",
            f"- host `{s['host']}`, model `{s['model']}`",
            f"- runs {s['ok']} ok, {s['failed']} failed, {s['truncated']} truncated, "
            f"{s['empty']} empty content",
            f"- format: {s['five']}/{s['ok']} produced exactly five hypotheses",
            f"- {len(s['labels'])} labels, ~{s['distinct']} distinct by crude overlap",
            f"- median {s['median_s']:.0f}s per run",
            "",
        ]
        if s["collapse_flags"]:
            lines.append("**Possible collapse — confirm by eye:**")
            lines += [f"- replicate {rep}: `{ev}`" for rep, ev in s["collapse_flags"]]
            lines.append("")

        counts = Counter(s["labels"])
        lines += ["| count | hypothesis label |", "|---|---|"]
        lines += [f"| {c} | {label} |" for label, c in counts.most_common()]
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\ndigest -> {out_path}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Compare the hypotheses a sweep produced, grouped by sampler cell."
    )
    parser.add_argument("results", nargs="+", type=Path,
                        help="One or more JSONL files from hypothesis_sweep.py.")
    parser.add_argument("--out", type=Path, default=None,
                        help="Markdown digest path (default: beside the first results file).")
    parser.add_argument("--show", default=None,
                        help="Print the full text of runs for one game id, for close reading.")
    args = parser.parse_args(argv)

    rows = load_rows(args.results)
    if not rows:
        raise SystemExit("No rows found.")

    if args.show:
        for row in rows:
            if row.get("game_id") != args.show or not row.get("ok"):
                continue
            print("=" * 100)
            print(f"{cell_label(row)}  replicate={row.get('replicate')} "
                  f"finish={row.get('finish_reason')} host={row.get('host')}")
            print("=" * 100)
            print(row.get("content") or "(empty content)")
            print()
        return 0

    summaries = summarise(rows)
    print_console(summaries)
    out = args.out or args.results[0].with_suffix(".digest.md")
    write_markdown(summaries, rows, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
