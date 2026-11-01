#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol
# Date: 07-October-2026
# PURPOSE: Preserve Kaggle snapshots, score events, and continuous history for the
# public leaderboard's leaders, pinned team, and featured competitors at any rank.
# SRP/DRY check: Pass — extends the existing snapshot collector and publishing pipeline.
"""Pull a public ARC Kaggle leaderboard and keep its observed history.

Writes into $LEADERBOARD_DATA_DIR (default ~/.cache/arc3-leaderboard-data; kept out of git
since 05-Oct-2026, when the page moved to ARC Explainer). ARC-2 uses its arc-2/ child
directory; select it with LEADERBOARD_COMPETITION=arc-prize-2026-arc-agi-2:
  latest.json   every team right now (+ where each stood at the end of the previous UTC day)
  history.json  one line per snapshot, plus a score/rank trail for the top teams and ours
  events.json   who changed score between snapshots (feed on the page)
  base.json     end-of-previous-day standings, for the "today" columns
Prints ALERT lines for things worth a notification; leaderboard_publish.sh shows them.
Run on a schedule; leaderboard_push_explainer.py then sends them to the public page at
https://arc.markbarney.net/kaggle-leaderboard.
"""
import csv, io, json, subprocess, sys, tempfile, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from leaderboard_config import COMP, DATA, OUR_TEAM_ID, PINNED_TEAM_IDS, FEATURED_TEAM_IDS, check_competition

TRAIL_TOP = 300                   # teams with a kept score/rank trail
EVENT_RANK = 500                  # score changes kept in the feed when the team is this high
EVENT_CAP = 3000
BIG_JUMP = 3.0                    # a top-20 team gaining this many points raises an alert
OUT = DATA


def medal_ranks(n):
    """Kaggle medal cut-offs: gold is top ten plus a fifth of a percent, silver 5%, bronze 10%."""
    return {"gold": 10 + int(n * 0.002), "silver": int(n * 0.05), "bronze": int(n * 0.10)}


def medal(rank, cuts):
    return "gold" if rank <= cuts["gold"] else "silver" if rank <= cuts["silver"] else "bronze" if rank <= cuts["bronze"] else None


def fetch_rows():
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["kaggle", "competitions", "leaderboard", "-c", COMP, "--download", "-p", d],
                       check=True, capture_output=True)
        z = next(Path(d).glob("*.zip"))
        with zipfile.ZipFile(z) as zf:
            raw = zf.read(zf.namelist()[0]).decode("utf-8-sig")
    return [[int(r["Rank"]), r["TeamId"], r["TeamName"], r["LastSubmissionDate"],
             float(r["Score"]), int(r["SubmissionCount"]), r["TeamMemberUserNames"]]
            for r in csv.DictReader(io.StringIO(raw))]


def load(p, default):
    return json.loads(p.read_text()) if p.exists() else default


def main():
    rows = fetch_rows()
    if len(rows) < 100:
        sys.exit(f"only {len(rows)} rows came back; refusing to overwrite the leaderboard")
    rows = [r for r in rows if r[0] > 0]   # rank 0 = host baseline entries, not competitors
    assert [r[0] for r in rows] == list(range(1, len(rows) + 1)), "ranks are not contiguous"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    n = len(rows)
    cuts = medal_ranks(n)
    by_rank = {r[0]: r[4] for r in rows}
    OUT.mkdir(parents=True, exist_ok=True)
    lp, bp, hp, ep = (OUT / f for f in ("latest.json", "base.json", "history.json", "events.json"))
    prev = load(lp, None)
    check_competition(prev)
    if prev is None and any(p.exists() for p in (bp, hp, ep)):
        raise ValueError("saved history has no latest.json to establish its competition")
    prev_by_id = {r[1]: r for r in prev["rows"]} if prev else {}

    # "Today" baseline: standings at the end of the previous UTC day. Rolls forward once per UTC day.
    today = now[:10]
    base = load(bp, None)
    if base is None or base["date"] != today:
        yesterday = (datetime.fromisoformat(now.replace("Z", "+00:00")) - timedelta(days=1)).date().isoformat()
        # No previous-day observation means an unknown comparison, not zero movement.
        src = prev["rows"] if prev and prev["fetched"][:10] == yesterday else []
        base = {"date": today, "ranks": {r[1]: [r[0], r[4]] for r in src}}
        bp.write_text(json.dumps(base, separators=(",", ":")))
    for r in rows:
        b = base["ranks"].get(r[1])
        r.extend([b[0], b[1]] if b else [None, None])

    # Feed: every score change since the last snapshot, for teams high enough to matter.
    events, alerts = load(ep, []), []
    if prev:
        old_cuts = prev["medalRanks"]
        for r in rows:
            o = prev_by_id.get(r[1])
            if o and o[4] == r[4]:
                continue
            if not o and r[0] > EVENT_RANK and r[1] not in FEATURED_TEAM_IDS:
                continue
            if o and r[0] > EVENT_RANK and o[0] > EVENT_RANK and r[1] not in FEATURED_TEAM_IDS:
                continue
            events.append({"t": now, "id": r[1], "name": r[2], "from": o[4] if o else None, "to": r[4],
                           "rankFrom": o[0] if o else None, "rankTo": r[0]})
            if r[1] == OUR_TEAM_ID and o and medal(o[0], old_cuts) != medal(r[0], cuts):
                alerts.append(f"{r[2]} is now {medal(r[0], cuts) or 'outside the medals'} (rank {r[0]}, score {r[4]:.2f})")
            elif o and r[0] <= 20 and r[4] - o[4] >= BIG_JUMP:
                alerts.append(f"{r[2]} jumped {o[4]:.2f} -> {r[4]:.2f} (rank {o[0]} -> {r[0]})")
            elif not o and r[0] <= 50:
                alerts.append(f"New team {r[2]} enters at rank {r[0]} with {r[4]:.2f}")
    ep.write_text(json.dumps(events[-EVENT_CAP:], separators=(",", ":")))

    lp.write_text(json.dumps({"competition": COMP, "fetched": now, "teams": n, "medalRanks": cuts, "ourTeamId": OUR_TEAM_ID,
                              "pinnedTeamIds": PINNED_TEAM_IDS,
                              "rows": rows}, separators=(",", ":")))

    hist = load(hp, {"snaps": [], "trails": {}})
    hist["snaps"].append({"t": now, "teams": n, "top": rows[0][4], "gold": by_rank.get(cuts["gold"]),
                          "silver": by_rank.get(cuts["silver"]), "bronze": by_rank.get(cuts["bronze"])})
    for r in rows:
        if r[0] <= TRAIL_TOP or r[1] in FEATURED_TEAM_IDS:
            trail = hist["trails"].setdefault(r[1], {"name": r[2], "pts": []})
            trail["name"] = r[2]
            if not trail["pts"] or trail["pts"][-1][1:] != [r[4], r[0]]:
                trail["pts"].append([now, r[4], r[0]])
    hp.write_text(json.dumps(hist, separators=(",", ":")))
    print(f"{now}: {n} teams, top {rows[0][4]}, gold line {by_rank.get(cuts['gold'])} (rank {cuts['gold']})")
    for a in alerts:
        print("ALERT", a)


if __name__ == "__main__":
    main()
