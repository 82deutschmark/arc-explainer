# Author: GPT-6.1 Sol (Bubba)
# Date: 04-November-2026
# PURPOSE: Render the ARC-3 write-up's archived source-summary measurements as
# standalone PNG/SVG figures; reads adjacent evidence.json, requires matplotlib.
# SRP/DRY check: Pass — presentation only; no duplicate benchmark runner or new measurements.
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
data = json.loads((root / 'evidence.json').read_text())
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10,
                     'axes.spines.top': False, 'axes.spines.right': False})
fig, axs = plt.subplots(2, 2, figsize=(15, 9))
blue, orange = '#24618a', '#b85722'
ax = axs[0, 0]
vals = data['storage']['bytes_per_token']
ax.bar(['FP8 K/V', '8-bit K / 4-bit V', '4-bit K/V'], vals, color=[blue, orange, orange])
for i, value in enumerate(vals):
    ax.text(i, value + 200, f'{value:,}', ha='center')
ax.set_ylim(0, 14500)
ax.set_ylabel('Bytes / token, target QSA cache only')
ax.set_title('A · Cache storage format (not checkpoint size)', loc='left', weight='bold')
ax.text(0, -.24, '12 attention layers; scales included. Draft/index/state excluded.\nLower precision changes model outputs; no score gain implied.', transform=ax.transAxes, fontsize=9)

ax = axs[0, 1]
for x, key, color in [(0, 'control', blue), (1, 'int8', orange)]:
    vals = data['decode'][key]
    # Connect only the two sampling times within each run, never independent arms.
    for j in range(2):
        offset = [-.10, .10][j]
        ax.plot([x+offset]*2, vals[j*2:j*2+2], 'o-', color=color, alpha=.8)
    ax.hlines(sum(vals)/len(vals), x-.25, x+.25, color=color, linewidth=2)
ax.set_xticks([0, 1], ['BF16 control', 'INT8 dense weights'])
ax.set_ylim(0, 34)
ax.set_ylabel('Wall ms / decode iteration')
ax.set_title('B · Matched decode samples · 6 Oct', loc='left', weight='bold')
ax.text(0, -.24, '10 lanes, 11 games; 2 runs/arm, minutes 10 and 20.\nDots = samples; bars = mean; not ms per output token.', transform=ax.transAxes, fontsize=9)

ax = axs[1, 0]
for y, key, color in [(1, 'control', blue), (0, 'graph_v3', orange)]:
    low, high = data['prefill'][key]
    ax.hlines(y, low, high, linewidth=6, color=color)
    ax.plot([low, high], [y, y], '|', color=color, markersize=15)
    ax.text(high+3, y, f'{low}–{high} ms', va='center', color=color)
ax.set_yticks([1, 0], ['Control', 'Graphs v3'])
ax.set_ylim(-.6, 1.6)
ax.set_xlim(0, 285)
ax.set_xlabel('Wall ms / prefill')
ax.set_title('C · Mid-sized prefill · 7 Oct', loc='left', weight='bold')
ax.text(0, -.28, '1,500–1,900-token reads, 12-lane configuration.\nObserved ranges, not confidence intervals or matched-length pairs.', transform=ax.transAxes, fontsize=9)

ax = axs[1, 1]
for y, key, color in [(1, 'fp8', blue), (0, 'k8v4', orange)]:
    vals = [v*1000/60 for v in data['full_clock'][key]]
    ax.scatter(vals, [y]*len(vals), color=color, s=55)
    for i, value in enumerate(vals):
        ax.annotate(f'{value:.1f}', (value,y), xytext=(0, 12 if i else -20), textcoords='offset points', ha='center')
ax.set_yticks([1, 0], ['FP8 / 13 lanes + host', 'K8V4 / 14 lanes, no host'])
ax.set_ylim(-.65, 1.65)
ax.set_xlim(0, 1200)
ax.set_xlabel('Generated tokens / second (gen/min ÷ 60)')
ax.set_title('D · Full game-clock output · 9 Oct report', loc='left', weight='bold')
ax.text(0, -.28, '132-minute game clock; 2 runs/arm. Prefill included, boot not established.\nDifferent lanes/host tiers; not an isolated cache gain.', transform=ax.transAxes, fontsize=9)
fig.suptitle('ARC-3 engineering evidence · archived October source summaries', fontsize=17, weight='bold', y=.99)
fig.text(.5, .015, 'Flash-Next / SGLang fork · RTX PRO 6000 96 GB · source revision ec146d6 · NOT newly reproduced; no cumulative ablation curve', ha='center', fontsize=10)
fig.subplots_adjust(left=.12, right=.96, top=.91, bottom=.14, hspace=.68, wspace=.48)
for ext in ['png', 'svg']:
    fig.savefig(root / f'archived-evidence.{ext}', dpi=180, facecolor='white')
