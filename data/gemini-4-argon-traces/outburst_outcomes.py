"""
Author: Claude Opus 5.5
Date: 2026-10-15
PURPOSE: Does Gemini 4 Argon's shouting pay off? For every step in the 150 public ARC-AGI-3 replays where the
  model's own answer text says MIND BLOWN, EUREKA, BINGO, WHOA, HOLD EVERYTHING or WAIT A SECOND, find the level it
  was on when it wrote that, and whether (and how many moves later) it beat that level, or never did. Compares each
  phrase with the same measure taken over every step, and checks the result within single levels so that hard
  levels (where the model both shouts more and wins less) cannot explain it away.
  Input: sessions/*.md written by fetch_traces.py (text at step N is what the model wrote before action N; the
  "levels a/b" in the step heading is the count after that action). Provider Adapter steps keep only the [output]
  part; Google's [reasoning summary] text is not the model's own answer and is left out.
  Output: outburst_steps.csv (one row per step), outburst_summary.json (the numbers the article quotes).
  No network, no model calls.
SRP/DRY check: Pass -- reads the existing transcripts like harness_stats.py and ../argon-vs-haiku/digest.py; none of
  them measures what happens after an outburst.
"""
import csv, json, re, statistics as st
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
PHRASES = {
    "MIND BLOWN": r"mind[\s-]*blown",
    "EUREKA": r"eureka",
    "BINGO": r"bingo",
    "WHOA": r"\bwhoa\b",
    "HOLD EVERYTHING": r"hold everything",
    "WAIT A SECOND": r"wait a second",
}
PATTERNS = {name: re.compile(rx, re.I) for name, rx in PHRASES.items()}
BIG_FOUR = ("MIND BLOWN", "EUREKA", "BINGO", "WHOA")  # the "I've got it" shouts
HEADING = re.compile(r"^(\d+) \| (\S+).*?\| levels (\d+)/(\d+) \| (\w+)")


def answer_text(body, adapter):
    """The model's own answer: drop the token line and, on adapter runs, Google's reasoning summary."""
    body = re.sub(r"^_tokens in .*?_\n", "", body.strip("\n"))
    if adapter and "[output]" in body:
        body = body.split("[output]", 1)[1]
    return body


def parse(path):
    text = path.read_text(encoding="utf-8")
    title, *chunks = re.split(r"\n## step ", text)
    adapter = "provider-adapter" in path.name
    steps = []
    for chunk in chunks:
        head, _, body = chunk.partition("\n")
        m = HEADING.match(head)
        if not m:
            continue
        steps.append(dict(n=int(m.group(1)), action=m.group(2), after=int(m.group(3)), total=int(m.group(4)),
                          state=m.group(5), text=answer_text(body, adapter)))
    return title, adapter, steps


def outcomes(steps):
    """For each step: the level it was attempting and how many moves (this one included) until that level fell."""
    rows, nxt = [], [None] * len(steps)
    # walk backwards so each step knows the next step at which the level count rose
    upcoming = {}
    for i in range(len(steps) - 1, -1, -1):
        before = steps[i - 1]["after"] if i else 0
        nxt[i] = upcoming.get(before)
        if i and steps[i]["after"] > before:
            for lv in range(before, steps[i]["after"]):
                upcoming[lv] = i
    for i, s in enumerate(steps):
        before = steps[i - 1]["after"] if i else 0
        rows.append(dict(level=before + 1, moves_to_clear=(nxt[i] - i + 1) if nxt[i] is not None else None))
    return rows


def bucket(moves):
    if moves is None:
        return "never"
    if moves <= 10:
        return "1-10"
    if moves <= 50:
        return "11-50"
    return "51+"


def summarise(rows):
    n = len(rows)
    if not n:
        return dict(n=0)
    cleared = [r["moves_to_clear"] for r in rows if r["moves_to_clear"] is not None]
    pct = lambda k: round(100 * k / n, 1)
    return dict(
        n=n,
        within_10=pct(sum(m <= 10 for m in cleared)),
        within_30=pct(sum(m <= 30 for m in cleared)),
        within_11_50=pct(sum(10 < m <= 50 for m in cleared)),
        after_50=pct(sum(m > 50 for m in cleared)),
        never=pct(n - len(cleared)),
        median_moves_if_cleared=st.median(cleared) if cleared else None,
    )


def main():
    index = {r["file"]: r for r in csv.DictReader(open(HERE / "index.csv", encoding="utf-8"))}
    out_rows, occurrences = [], defaultdict(lambda: defaultdict(int))
    for path in sorted((HERE / "sessions").glob("*.md")):
        meta = index[path.name]
        _, adapter, steps = parse(path)
        harness = "adapter" if adapter else "standard"
        effort = meta["config"].replace("google-barium-bb3-", "").replace("-provider-adapter", "")
        for s, o in zip(steps, outcomes(steps)):
            if s["action"] == "RESET" and not s["text"].strip():
                continue  # the harness's opening reset, nothing written
            hits = {name: len(rx.findall(s["text"])) for name, rx in PATTERNS.items()}
            for name, k in hits.items():
                occurrences[harness][name] += k
            out_rows.append(dict(game=meta["game"], harness=harness, effort=effort, session=meta["session"],
                                 step=s["n"], action=s["action"], level=o["level"], levels_total=s["total"],
                                 moves_to_clear=o["moves_to_clear"] if o["moves_to_clear"] is not None else "",
                                 final_state=meta["state"],
                                 **{name.lower().replace(" ", "_"): k for name, k in hits.items()}))

    with open(HERE / "outburst_steps.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0]))
        w.writeheader()
        w.writerows(out_rows)

    def mtc(r):
        return dict(moves_to_clear=r["moves_to_clear"] if r["moves_to_clear"] != "" else None)

    key = lambda name: name.lower().replace(" ", "_")
    summary = dict(occurrences={h: dict(v) for h, v in occurrences.items()}, by_harness={})
    for harness in ("standard", "adapter", "all"):
        rows = [r for r in out_rows if harness == "all" or r["harness"] == harness]
        block = dict(every_step=summarise([mtc(r) for r in rows]))
        for name in PHRASES:
            block[name] = summarise([mtc(r) for r in rows if r[key(name)]])
        block["any of the big four"] = summarise([mtc(r) for r in rows if any(r[key(p)] for p in BIG_FOUR)])
        summary["by_harness"][harness] = block

    # Within-level check: on levels where the model shouted at least once, compare its shouting steps with its
    # quiet steps on the SAME level. Removes "hard levels have more shouting" from the comparison.
    episodes = defaultdict(list)
    for r in out_rows:
        episodes[(r["session"], r["level"])].append(r)
    paired, loud_levels, quiet_levels = [], [], []
    for (session, level), rows in episodes.items():
        loud = [r for r in rows if any(r[key(p)] for p in BIG_FOUR)]
        cleared = rows[0]["moves_to_clear"] != "" or any(r["moves_to_clear"] != "" for r in rows)
        density = len(loud) / len(rows)
        (loud_levels if loud else quiet_levels).append(dict(cleared=cleared, moves=len(rows), harness=rows[0]["harness"],
                                                            shouts=len(loud), density=density))
        if loud and cleared and len(rows) > len(loud):
            first = int(rows[0]["step"])
            span = len(rows)
            # where in the level (0 = first move on it, 1 = the move that beat it) do the shouts fall?
            pos = [(int(r["step"]) - first) / max(1, span - 1) for r in loud]
            paired.append(dict(harness=rows[0]["harness"], median_pos=st.median(pos), span=span))
    pct = lambda xs, f: round(100 * sum(map(f, xs)) / len(xs), 1) if xs else None
    summary["levels"] = {
        h: dict(
            levels_with_big_four=len([e for e in loud_levels if h == "all" or e["harness"] == h]),
            cleared_pct_with_big_four=pct([e for e in loud_levels if h == "all" or e["harness"] == h], lambda e: e["cleared"]),
            levels_without=len([e for e in quiet_levels if h == "all" or e["harness"] == h]),
            cleared_pct_without=pct([e for e in quiet_levels if h == "all" or e["harness"] == h], lambda e: e["cleared"]),
            median_moves_on_level_with=st.median([e["moves"] for e in loud_levels if h == "all" or e["harness"] == h] or [0]),
            median_moves_on_level_without=st.median([e["moves"] for e in quiet_levels if h == "all" or e["harness"] == h] or [0]),
        ) for h in ("standard", "adapter", "all")
    }
    # What became of each "I've got it" shout: the last one before the level fell, one followed by another shout on
    # the same level before it fell (a false dawn), or one on a level the run never beat.
    fates = {h: dict(last_before_win=0, shouted_again_first=0, level_never_beaten=0, never_by_end_state={})
             for h in ("standard", "adapter")}
    for (session, level), rows in episodes.items():
        loud = sum(1 for r in rows if any(r[key(p)] for p in BIG_FOUR))
        if not loud:
            continue
        f = fates[rows[0]["harness"]]
        if rows[0]["moves_to_clear"] == "":
            f["level_never_beaten"] += loud
            end = rows[0]["final_state"]
            f["never_by_end_state"][end] = f["never_by_end_state"].get(end, 0) + loud
        else:
            f["last_before_win"] += 1
            f["shouted_again_first"] += loud - 1
    for f in fates.values():
        total = f["last_before_win"] + f["shouted_again_first"] + f["level_never_beaten"]
        f["shouts"] = total
        f["pct"] = {k: round(100 * f[k] / total, 1) for k in ("last_before_win", "shouted_again_first", "level_never_beaten")}
    summary["fate_of_each_shout"] = fates
    summary["called_it_within_3_moves"] = sum(
        1 for r in out_rows if any(r[key(p)] for p in BIG_FOUR) and r["moves_to_clear"] != "" and r["moves_to_clear"] <= 3)
    summary["shout_position_in_cleared_levels"] = {
        h: dict(levels=len(sel), median_position=round(st.median([p["median_pos"] for p in sel]), 2) if sel else None,
                in_last_fifth_pct=pct(sel, lambda p: p["median_pos"] >= 0.8))
        for h in ("standard", "adapter", "all")
        for sel in [[p for p in paired if h == "all" or p["harness"] == h]]
    }
    (HERE / "outburst_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
