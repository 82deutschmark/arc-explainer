# Author: Claude Opus 5.5 (effort: low), first version; Claude Opus 5.5 Low, adapted for the ARC Explainer special
# Date: 07-November-2026
# PURPOSE: Build the "public-25 score over time" chart for Son Pham's "Stuffing the Turducken" special
#   (client/public/specials/2026-11-06-arc3-solution-draft.html, Part 1.3 "Performance so far").
#   Reads a saved snapshot of arc3.sonpham.net/api/v1/catalog (every run Son's site holds), keeps
#   only runs that played all 25 official public games, and scores each run as the mean of its 25
#   public-game scores (copycat and generated games are ignored even when the run played them).
#   Writes public25-runs.csv (the plotted rows) plus public25-over-time.svg and .png (white
#   background, text as vector paths like the other redrawn figures) next to this script.
#   Runs are grouped by board size because a run's public-25 score depends on how many games
#   share its clock; the groups are plotted as separate dot families and never joined by a line.
#   The 3.7 MB catalog snapshot is not committed; it lives at
#   /Volumes/Team 4TB/loose-goose/art/2026-11-05-writeup-sections/rewrite/v2/arc3-catalog-snapshot-2026-11-07.json
#   Usage: python3 make_public25_chart.py <catalog-snapshot.json>
# SRP/DRY check: Pass — the site's own score-over-time page plots within-run trajectories, not
#   per-run public-25 scores by date, and the other figures here come from the original artifact.
import csv, json, re, sys
from datetime import datetime
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

HERE = Path(__file__).resolve().parent
CATALOG = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Volumes/Team 4TB/loose-goose/art/2026-11-05-writeup-sections/rewrite/v2/arc3-catalog-snapshot-2026-11-07.json")
# Official public games carry a four-character name plus an eight-hex version; copycats use a
# twelve-hex suffix, and replicas/variants add x2, p0, r0z and similar tails.
PUBLIC = re.compile(r"[a-z0-9]{4}-[0-9a-f]{8}")

def run_time(name):
    m = re.match(r"(\d{8})_(\d{4,6})", name)
    if not m:
        return None
    hhmm = (m.group(2) + "00")[:6]
    return datetime.strptime(m.group(1) + hhmm, "%Y%m%d%H%M%S")

def family(n_games):
    if n_games == 25:
        return "25-game board (public games only)"
    if n_games == 50:
        return "50-game Score Climb board (25 public + 25 copycats)"
    return "Larger mixed boards (75 to 100 games)"

rows = []
for r in json.load(open(CATALOG))["runs"]:
    pub = [g for g in r.get("per_game") or [] if PUBLIC.fullmatch(g["id"])]
    t = run_time(r["run"])
    if len(pub) != 25 or t is None:
        continue
    rows.append({"run": r["run"], "date": t, "games_in_run": r["games"],
                 "public25_score": round(sum(g["score"] for g in pub) / 25, 2),
                 "hours": round((r.get("duration_seconds") or 0) / 3600, 2),
                 "family": family(r["games"])})
rows.sort(key=lambda x: x["date"])

with open(HERE / "public25-runs.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    for x in rows:
        w.writerow({**x, "date": x["date"].strftime("%Y-%m-%d %H:%M")})

# Reference palette, first three categorical slots (validated all-pairs for scatter), plus a
# different marker per family so identity never rests on colour alone.
STYLE = {
    "25-game board (public games only)": ("#2a78d6", "o"),
    "50-game Score Climb board (25 public + 25 copycats)": ("#eb6834", "s"),
    "Larger mixed boards (75 to 100 games)": ("#1baf7a", "^"),
}
INK, INK2, GRID = "#0b0b0b", "#52514e", "#e4e3df"
# svg.fonttype "path" draws text as outlines so the SVG looks the same without the font installed.
plt.rcParams.update({"font.family": "Helvetica Neue", "font.size": 11, "svg.fonttype": "path"})
fig, ax = plt.subplots(figsize=(11, 5.9), dpi=200)
fig.patch.set_facecolor("white"); ax.set_facecolor("white")
for fam, (col, mk) in STYLE.items():
    pts = [x for x in rows if x["family"] == fam]
    ax.scatter([x["date"] for x in pts], [x["public25_score"] for x in pts], s=46, c=col, marker=mk,
               edgecolors="white", linewidths=1.2, zorder=3, label=f"{fam} — {len(pts)} runs")

ax.set_ylim(0, 80)
ax.set_xlim(datetime(2026, 9, 27), datetime(2026, 11, 1, 12))
ax.xaxis.set_major_locator(mdates.DayLocator(bymonthday=[1, 5, 10, 15, 20, 25]))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%-d %b"))
ax.set_ylabel("Mean score on the 25 public games", color=INK2)
ax.grid(axis="y", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
for s in ("top", "right"):
    ax.spines[s].set_visible(False)
for s in ("left", "bottom"):
    ax.spines[s].set_color("#b9b8b2")
ax.tick_params(colors=INK2)

# Annotations: only events stated in the draft or visible in the run names.
ax.axvline(datetime(2026, 10, 1), color="#9a9993", linewidth=1, linestyle=(0, (3, 3)), zorder=1)
ax.text(datetime(2026, 10, 1, 6), 8, "1 Oct: Daniel Franzen's\nnotebook becomes our base", color=INK2, fontsize=9.5, va="bottom")
ax.annotate("8 Oct: runs started on a 540-minute clock",
            xy=(datetime(2026, 10, 8, 22), 67.0), xytext=(datetime(2026, 10, 10, 12), 75),
            fontsize=9.5, color=INK2, arrowprops=dict(arrowstyle="-", color="#9a9993", lw=0.9))
ax.annotate("Two broken runs\n(near-zero scores)", xy=(datetime(2026, 10, 30, 15), 3.5), xytext=(datetime(2026, 10, 22, 12), 9),
            fontsize=9.5, color=INK2, arrowprops=dict(arrowstyle="-", color="#9a9993", lw=0.9))

fig.text(0.065, 0.955, "Our local public-25 board, run by run (not the Kaggle leaderboard)", fontsize=15, weight="bold", color=INK)
fig.text(0.065, 0.915, "Each dot is one local run stored on arc3.sonpham.net that played all 25 public games, scored on those 25 only. "
         "Kaggle scores 110 hidden games.", fontsize=10, color=INK2)
ax.legend(loc="upper left", bbox_to_anchor=(-0.01, -0.09), ncol=1, frameon=False, fontsize=9.5, labelcolor=INK)
fig.text(0.065, 0.025, "No complete public-25 runs on the site before 27 Sep or after 31 Oct. Runs differ in clock length and "
         "board size, so dots are not a single like-for-like series.", fontsize=8.8, color=INK2)
fig.subplots_adjust(left=0.065, right=0.98, top=0.86, bottom=0.25)
fig.savefig(HERE / "public25-over-time.png", facecolor="white")
fig.savefig(HERE / "public25-over-time.svg", facecolor="white")
print(len(rows), "runs plotted")
