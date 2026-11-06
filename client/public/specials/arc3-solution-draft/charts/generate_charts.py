# Author: GPT-6.1 Sol
# Date: 06-November-2026
# PURPOSE: Reproduce article PNG charts from the adjacent archived aggregate data; matplotlib only, no network or training dependencies.
# SRP/DRY check: Pass — reuses recorded source aggregates, one plotting entry point.
from pathlib import Path
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
P = Path(__file__).resolve().parent
D = json.loads((P / "chart-data.json").read_text())
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 12, "axes.spines.top": False, "axes.spines.right": False, "figure.facecolor": "white", "axes.facecolor": "white"})
def finish(fig, name, note):
    fig.text(.06, .02, note, fontsize=9, color="#555555")
    fig.tight_layout(rect=(0,.09,1,.94))
    fig.savefig(P / name, dpi=180)
    plt.close(fig)
s = D["speed_score"]
f, ax = plt.subplots(1, 2, figsize=(12,5))
for a, values, title in zip(ax, [s["tokens_per_second"], s["score"]], ["Wall-clock tokens per second", "Score Climb 2 mean score"]):
    a.bar(s["labels"], values, color=["#758391", "#34735a", "#34735a", "#ba7138"])
    a.set_title(title, fontsize=13); a.set_ylim(0,max(values)*1.20)
    for i,v in enumerate(values): a.text(i,v+max(values)*.025,f"{v:g}",ha="center",fontsize=11)
ax[0].errorbar(0,1366.5,yerr=13.5,color="black",capsize=4)
f.suptitle("Faster serving did not guarantee better play · October 11 archive",fontsize=15)
finish(f,"speed-score.png","Different configurations, not a controlled lane ablation. 20L throughput is midpoint of reported range. Source: arc3-speed README.")
s = D["lane_ladder"]
f,a=plt.subplots(figsize=(9,5)); a.bar([str(x) for x in s["lanes"]],s["score"],color="#34735a"); a.set_xlabel("Concurrent lanes"); a.set_ylabel("75-game ladder score"); a.set_ylim(0,46)
for i,v in enumerate(s["score"]): a.text(i,v+.7,str(v),ha="center")
a.set_title("The archived 75-game ladder favored 32 lanes")
finish(f,"lane-ladder.png","Two runs per arm; uncertainty not recorded. Separate suite from Score Climb 2. Source: arc3-speed README, October 11.")
s=D["rl_all16"]
f,a=plt.subplots(figsize=(11,5)); values=[v["y"] for v in s]; labels=[v["x"].replace(" ★","").replace(" ","\n",1) for v in s]
a.bar(labels,values,color=["#758391"]+["#34735a"]*5); a.set_ylim(0,5.5); a.set_ylabel("Archived All-16 evaluation score")
for i,v in enumerate(values): a.text(i,v+.08,f"{v:.2f}",ha="center")
a.set_title("Selected training checkpoints: progress, but not a monotonic gain")
finish(f,"rl-all16.png","7 hard official + 9 copycat games. Selected checkpoints, not chronological; no uncertainty supplied. Snapshot: October 19, 2026 UTC.")
