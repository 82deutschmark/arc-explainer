"""
Author: Claude Sonnet 5.5
Date: 2026-10-15
PURPOSE: Pull every public ARC-AGI-3 replay listed on arcprize.org/results/google-gemini-4-argon,
  strip the (huge) frame arrays, and keep each step's action + the model's visible output/reasoning
  text + token usage. Writes one markdown transcript per session plus index.csv.
  Public, unauthenticated arcprize.org endpoints only; no paid APIs.
SRP/DRY check: Pass - standalone one-off fetcher, nothing in the repo does this.
"""
import csv, json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://arcprize.org"
OUT = Path(__file__).parent
(OUT / "sessions").mkdir(exist_ok=True)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=300)


def session_ids():
    html = get(f"{BASE}/results/google-gemini-4-argon").read().decode()
    seen = []
    for m in re.finditer(r"/replay/([0-9a-f-]{36})", html):
        if m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


def process(sid):
    meta = json.load(get(f"{BASE}/api/sessions/{sid}"))
    run = meta["environments"][0]["runs"][0]
    game = run["id"]
    row = dict(session=sid, game=game.split("-")[0], config=meta["config"], runner=meta["runner"],
               score=round(meta["score"], 1), actions=run["actions"], levels=run["levels_completed"],
               state=run["state"])
    name = f'{row["config"]}__{row["game"]}__{sid[:8]}.md'
    path = OUT / "sessions" / name
    if path.exists():
        return row | dict(file=name, reasoning_chars=-1)
    lines = [f"# {row['game']} | {row['config']} | score {row['score']}% | "
             f"{row['levels']} levels | {row['actions']} actions | {sid}\n"]
    chars = 0
    with get(f"{BASE}/api/recordings/{game}/{sid}") as r:
        for n, raw in enumerate(r):
            raw = raw.strip()
            if not raw:
                continue
            d = json.loads(raw)["data"]
            ai = d.get("action_input") or {}
            reasoning = ai.get("reasoning")
            lines.append(f"\n## step {n} | {ai.get('id')} {ai.get('data') or ''} | "
                         f"levels {d.get('levels_completed')}/{d.get('win_levels')} | {d.get('state')}\n")
            if reasoning:
                try:
                    j = json.loads(reasoning)
                    out = j.get("output") or ""
                    if j.get("reasoning"):
                        out = f"[reasoning summary]\n{j['reasoning']}\n\n[output]\n{out}"
                    u = j.get("usage") or {}
                    rt = (u.get("output_tokens_details") or {}).get("reasoning_tokens")
                    lines.append(f"_tokens in {u.get('input_tokens')} out {u.get('output_tokens')} thinking {rt}_\n")
                except (ValueError, AttributeError):
                    out = str(reasoning)
                chars += len(out)
                lines.append(out + "\n")
    path.write_text("\n".join(lines), encoding="utf-8")
    return row | dict(file=name, reasoning_chars=chars)


if __name__ == "__main__":
    ids = session_ids()
    print(len(ids), "sessions", flush=True)
    rows = []
    with ThreadPoolExecutor(6) as ex:
        for i, row in enumerate(ex.map(process, ids)):
            rows.append(row)
            print(i + 1, row["config"], row["game"], row["score"], row["reasoning_chars"], flush=True)
    with open(OUT / "index.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
