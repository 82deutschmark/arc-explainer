"""
Author: Claude Sonnet 5.5
Date: 2026-10-15
PURPOSE: Per-session harness fingerprint for the Slippery Seven runs (dc22 g50t m0r0 sc25 sk48 tn36 tr87):
  how many frames each action returns, how big each prompt is, whether history is retained
  (cached input tokens), how much the model writes/thinks, and when each level was cleared.
  Reads the public arcprize.org recordings; writes slippery_stats.csv next to this file.
SRP/DRY check: Pass - fetch_traces.py keeps text only; this keeps usage numbers it drops.
"""
import csv, json, statistics as st, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
SEVEN = {"dc22", "g50t", "m0r0", "sc25", "sk48", "tn36", "tr87"}


def stats(row):
    game_id = json.load(urllib.request.urlopen(urllib.request.Request(
        f"https://arcprize.org/api/sessions/{row['session']}", headers={"User-Agent": "Mozilla/5.0"})))["environments"][0]["id"]
    inp, cached, outp, think, frames, empty, levels_at = [], [], [], [], [], 0, []
    last_lv, n = 0, 0
    url = f"https://arcprize.org/api/recordings/{game_id}/{row['session']}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=300) as r:
        for raw in r:
            raw = raw.strip()
            if not raw:
                continue
            d = json.loads(raw)["data"]
            n += 1
            if d["levels_completed"] > last_lv:
                levels_at.append(n)
                last_lv = d["levels_completed"]
            ai = d.get("action_input") or {}
            if not ai.get("reasoning"):
                continue
            try:
                j = json.loads(ai["reasoning"])
                u = j["usage"]
            except (ValueError, KeyError, TypeError):
                continue
            inp.append(u["input_tokens"])
            cached.append(u["input_tokens_details"]["cached_tokens"])
            outp.append(u["output_tokens"])
            think.append((u.get("output_tokens_details") or {}).get("reasoning_tokens") or 0)
            frames.append(len(d["frame"]))
            if len((j.get("output") or "").strip()) < 20:
                empty += 1
    m = lambda x: int(st.median(x)) if x else 0
    return dict(
        game=row["game"], config=row["config"], score=row["score"], levels=row["levels"], actions=row["actions"],
        state=row["state"], steps=len(inp), med_input=m(inp), max_input=max(inp, default=0),
        pct_cached=round(100 * sum(c > 0 for c in cached) / max(1, len(cached))),
        med_frames=m(frames), max_frames=max(frames, default=0), med_out=m(outp), med_think=m(think),
        pct_bare=round(100 * empty / max(1, len(inp))), level_clear_steps=" ".join(map(str, levels_at)))


if __name__ == "__main__":
    rows = [r for r in csv.DictReader(open(HERE / "index.csv", encoding="utf-8")) if r["game"] in SEVEN]
    with ThreadPoolExecutor(6) as ex:
        res = list(ex.map(stats, rows))
    res.sort(key=lambda r: (r["game"], r["config"]))
    with open(HERE / "slippery_stats.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(res[0]))
        w.writeheader()
        w.writerows(res)
    for r in res:
        print(r["game"], r["config"].replace("google-barium-bb3-", ""), r["score"], "steps", r["steps"], "in", r["med_input"],
              "cached%", r["pct_cached"], "frames", r["med_frames"], "out", r["med_out"], "think", r["med_think"],
              "bare%", r["pct_bare"], "lv@", r["level_clear_steps"])
