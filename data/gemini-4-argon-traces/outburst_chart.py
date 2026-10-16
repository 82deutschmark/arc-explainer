"""
Author: Claude Opus 5.5
Date: 2026-10-15
PURPOSE: Draws the chart for the ARC Daily Digest dispatch on Gemini 4 Argon's outbursts. Top panel: what became of
  each MIND BLOWN / BINGO / EUREKA / WHOA shout (the last shout before the level fell, followed by another shout
  first, or on a level never beaten), standard harness vs Provider Adapter. Bottom panel: how often the level fell
  within 10 moves of each phrase in the standard harness, against any move. Reads outburst_summary.json (written by
  outburst_outcomes.py) and writes client/public/news-images/2026-10-15-argon-shouts-chart.png.
  Palette (blue / amber / red on the paper surface) checked with the dataviz validator, adjacent and all pairs.
SRP/DRY check: Pass -- every number comes from outburst_summary.json; this file only draws.
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "client" / "public" / "news-images" / "2026-10-15-argon-shouts-chart.png"

SURFACE, INK, MUTED, HAIR = "#fbf8f1", "#171512", "#6b6457", "#e3dccb"
WON, AGAIN, NEVER, BASELINE = "#256abf", "#d99a1e", "#a8251b", "#a39a88"
FONT = ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"]
GAP = 0.004  # surface gap between stacked segments, in axis fraction


def bar(ax, x0, width, y, height, color):
    """One stacked segment; segments are separated by the surface gap, not a stroke."""
    if width > 0:
        ax.add_patch(Rectangle((x0, y), width, height, fc=color, ec="none"))


def main():
    s = json.loads((HERE / "outburst_summary.json").read_text(encoding="utf-8"))
    fates = s["fate_of_each_shout"]
    std = s["by_harness"]["standard"]

    plt.rcParams.update({"font.family": "sans-serif", "font.sans-serif": FONT})
    fig = plt.figure(figsize=(8, 9.4), dpi=150, facecolor=SURFACE)

    fig.text(0.06, 0.955, "When Gemini 4 Argon shouts “I’ve got it!”", fontsize=19, weight="bold", color=INK)
    fig.text(0.06, 0.922, "MIND BLOWN, BINGO, EUREKA or WHOA in its answer text, 150 public ARC-AGI-3 replays",
             fontsize=10.5, color=MUTED)

    # Panel 1: the fate of every shout
    fig.text(0.06, 0.865, "What became of each shout", fontsize=13.5, weight="bold", color=INK)
    legend = [(WON, "It was the last shout before the level fell"),
              (AGAIN, "It shouted again before the level fell"),
              (NEVER, "It never beat that level")]
    for i, (c, label) in enumerate(legend):
        y = 0.832 - i * 0.026
        fig.patches.append(Rectangle((0.06, y - 0.004), 0.016, 0.014, fc=c, ec="none", transform=fig.transFigure, figure=fig))
        fig.text(0.084, y - 0.001, label, fontsize=10.5, color=INK, va="bottom")

    ax = fig.add_axes([0.06, 0.565, 0.88, 0.2])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    rows = [("Standard harness", fates["standard"]), ("Provider Adapter", fates["adapter"])]
    for i, (name, f) in enumerate(rows):
        y = 0.56 - i * 0.5
        ax.text(0, y + 0.3, f"{name}  ·  {f['shouts']:,} shouts", fontsize=11, weight="bold", color=INK, va="bottom")
        x = 0.0
        parts = [(f["pct"]["last_before_win"], WON, "white"), (f["pct"]["shouted_again_first"], AGAIN, INK),
                 (f["pct"]["level_never_beaten"], NEVER, "white")]
        for j, (p, c, tc) in enumerate(parts):
            w = p / 100
            seg = w - (GAP if j < len(parts) - 1 else 0)
            bar(ax, x, seg, y, 0.26, c)
            if seg > 0.07:
                ax.text(x + seg / 2, y + 0.13, f"{p:.0f}%", ha="center", va="center", fontsize=12.5, weight="bold", color=tc)
            elif p > 0:
                ax.text(x + seg + 0.008, y - 0.06, f"{p:.0f}%", ha="right", va="top", fontsize=10, color=MUTED)
            x += w

    # Panel 2: level fell within 10 moves, by phrase (standard harness)
    fig.text(0.06, 0.51, "How often the level fell within 10 moves", fontsize=13.5, weight="bold", color=INK)
    fig.text(0.06, 0.487, "Standard harness, per move that contains the phrase", fontsize=10.5, color=MUTED)
    phrases = sorted(["WHOA", "BINGO", "WAIT A SECOND", "MIND BLOWN", "HOLD EVERYTHING", "EUREKA"],
                     key=lambda p: -std[p]["within_10"])
    items = [("Any move", std["every_step"]["within_10"], std["every_step"]["n"], BASELINE)] + \
            [(p, std[p]["within_10"], std[p]["n"], WON) for p in phrases]
    ax2 = fig.add_axes([0.06, 0.085, 0.88, 0.37], facecolor=SURFACE)
    top = 15.0
    ax2.set_xlim(0, top)
    ax2.set_ylim(-0.6, len(items) - 0.4)
    ax2.invert_yaxis()
    for spine in ax2.spines.values():
        spine.set_visible(False)
    ax2.set_yticks([])
    ax2.set_xticks([0, 5, 10, 15])
    ax2.set_xticklabels(["0%", "5%", "10%", "15%"], fontsize=9.5, color=MUTED)
    ax2.tick_params(axis="x", length=0, pad=4)
    for t in (5, 10, 15):
        ax2.axvline(t, color=HAIR, lw=1, zorder=0)
    ax2.axvline(0, color="#c3b9a3", lw=1, zorder=0)
    label_x = 4.9  # phrase names sit in a column left of the bars
    ax2.set_xlim(-label_x, top)
    ax2.set_xticks([0, 5, 10, 15])
    for i, (name, v, n, c) in enumerate(items):
        h = 0.5
        ax2.add_patch(Rectangle((0, i - h / 2), v, h, fc=c, ec="none", zorder=2))
        ax2.text(v + 0.25, i, f"{v:.1f}%", va="center", fontsize=11, weight="bold", color=INK)
        ax2.text(-0.3, i - 0.06, name, ha="right", va="center", fontsize=10.5,
                 weight="bold" if name == "Any move" else "normal", color=INK)
        ax2.text(-0.3, i + 0.26, f"{n:,} moves", ha="right", va="center", fontsize=8.5, color=MUTED)

    fig.text(0.06, 0.03, "Source: ARC Prize public replays of Gemini 4 Argon, read Oct 15, 2026. Some standard-harness runs "
             "were cut short\nby API errors or move limits. Reproduce: data/gemini-4-argon-traces/outburst_outcomes.py",
             fontsize=8.5, color=MUTED, linespacing=1.4)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, facecolor=SURFACE)
    print(OUT)


if __name__ == "__main__":
    main()
