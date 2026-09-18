"""
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: Put dollar figures on ARC Prize's own runs of the 25 public ARC-AGI-3 games, which
         ARC does not publish (its leaderboard and results pages give Semi-Private costs
         only). Reads data/arc3-official-runs/sessions.jsonl (token usage per run, written by
         pull_official_public_runs.py) and prices it two ways:

           arcMethod  -- ARC's own published method: every input token at the list input
                         price plus every output token at the list output price. Cached
                         input gets no discount and there is no long-context surcharge.
                         Source: arcprize/arc-agi-3-benchmarking, docs/runtime-state.md
                         ("Published v3 costs are reconstructed downstream from ARC-facing
                         action token usage and configured input/output prices") and
                         runtime_models.action_metadata_from_model_response (input_tokens x
                         input price + output_tokens x output price). This is the number to
                         compare with ARC's Semi-Private costs.
           billed     -- what the provider would charge for the same tokens: uncached input
                         at the input price, cached input at the cache-read price, output at
                         the output price, and for gpt-6-astra the long-context rule (a
                         request over 272K input tokens: 2x input and cache, 1.5x output).
                         Cache WRITES are not in ARC's logs, so `billedHigh` also shows the
                         bound where every uncached input token is billed as a cache write.

         Prices (USD per 1M tokens) were checked on 18-Sep-2026 against the provider page
         (OpenAI, for gpt-6-astra) and OpenRouter's live /api/v1/models list (all seven).

         Writes data/arc3-official-runs/costs.json and prints the per-config table, with
         ARC's published Semi-Private cost for the same config beside it.

         Usage: python scripts/arc3/official_run_costs.py
SRP/DRY check: Pass -- prices and dollar math only; token counts come from sessions.jsonl.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SESSIONS = REPO / "data" / "arc3-official-runs" / "sessions.jsonl"
OUT = REPO / "data" / "arc3-official-runs" / "costs.json"
LEADERBOARD = "https://arcprize.org/media/data/leaderboard/v3.json"

# USD per 1M tokens. long: (input/cache multiplier, output multiplier) for requests over
# the threshold recorded by pull_official_public_runs.py (272K input tokens).
PRICES = {
    "gpt-6-astra": {"input": 10.0, "cached": 1.0, "cacheWrite": 12.5, "output": 50.0, "long": (2.0, 1.5),
                    "source": "developers.openai.com/api/docs/models/gpt-6-astra; OpenRouter openai/gpt-6-astra"},
    "claude-opus-5": {"input": 5.0, "cached": 0.5, "cacheWrite": 6.25, "output": 25.0, "long": None,
                      "source": "OpenRouter anthropic/claude-opus-5"},
    "gpt-5.6-sol": {"input": 2.0, "cached": 0.2, "cacheWrite": 2.5, "output": 10.0, "long": None,
                    "source": "OpenRouter openai/gpt-5.6-sol"},
    "gpt-5.6-terra": {"input": 2.0, "cached": 0.2, "cacheWrite": 2.5, "output": 12.0, "long": None,
                      "source": "OpenRouter openai/gpt-5.6-terra"},
    "gpt-5.6-luna": {"input": 0.2, "cached": 0.02, "cacheWrite": 0.25, "output": 1.2, "long": None,
                     "source": "OpenRouter openai/gpt-5.6-luna"},
    "grok-4.5": {"input": 2.0, "cached": 0.3, "cacheWrite": None, "output": 6.0, "long": None,
                 "source": "OpenRouter x-ai/grok-4.5"},
    "grok-4.6": {"input": 2.0, "cached": 0.5, "cacheWrite": None, "output": 6.0, "long": None,
                 "source": "OpenRouter x-ai/grok-4.6"},
}


def price_key(model: str | None) -> str | None:
    """Session model strings vary ("gpt-6-astra", "openai/gpt-5.6-sol", "claude-opus-5-...")."""
    name = (model or "").lower().split("/")[-1]
    for key in sorted(PRICES, key=len, reverse=True):
        if name.startswith(key) or name.replace("-", ".").startswith(key.replace("-", ".")):
            return key
    return None


def bucket_cost(bucket: dict, price: dict, multipliers=(1.0, 1.0), write_rate: float | None = None) -> float:
    uncached = max(bucket["input"] - bucket["cached"], 0)
    input_rate = write_rate if write_rate is not None else price["input"]
    return (
        (uncached * input_rate + bucket["cached"] * price["cached"]) * multipliers[0]
        + bucket["output"] * price["output"] * multipliers[1]
    ) / 1e6


def run_costs(run: dict, price: dict) -> dict:
    usage = run["usage"]
    arc = (usage["all"]["input"] * price["input"] + usage["all"]["output"] * price["output"]) / 1e6

    def billed(write_rate=None):
        total = 0.0
        for normal, long in (("actionRequests", "longActionRequests"), ("compactionRequests", "longCompactionRequests")):
            short = {k: usage[normal][k] - usage[long][k] for k in ("input", "cached", "output")}
            total += bucket_cost(short, price, write_rate=write_rate)
            if price["long"]:
                total += bucket_cost(usage[long], price, price["long"], write_rate)
            else:
                total += bucket_cost(usage[long], price, write_rate=write_rate)
        return total

    return {"arcMethod": arc, "billed": billed(), "billedHigh": billed(price["cacheWrite"]) if price["cacheWrite"] else billed()}


def semi_private_costs() -> dict[str, float]:
    try:
        request = urllib.request.Request(LEADERBOARD, headers={"User-Agent": "arc-explainer"})
        with urllib.request.urlopen(request, timeout=60) as response:
            board = json.loads(response.read())
    except Exception as error:  # the table still prints without the comparison column
        print(f"[official_run_costs] could not read {LEADERBOARD}: {error}", file=sys.stderr)
        return {}
    return {e["modelId"]: e.get("cost") for e in board.get("evaluations", []) if e.get("datasetId") == "v3_Semi_Private"}


def main() -> int:
    if not SESSIONS.exists():
        print(f"[official_run_costs] {SESSIONS} not found; run pull_official_public_runs.py first", file=sys.stderr)
        return 1
    runs = [json.loads(line) for line in SESSIONS.read_text(encoding="utf-8").splitlines() if line.strip()]
    semi = semi_private_costs()
    groups: dict[str, dict] = defaultdict(lambda: {"runs": 0, "wins": 0, "levels": 0, "levelTotal": 0, "moves": 0,
                                                   "input": 0, "cached": 0, "output": 0, "reasoning": 0,
                                                   "longRequests": 0, "requests": 0,
                                                   "arcMethod": 0.0, "billed": 0.0, "billedHigh": 0.0, "games": {}})
    unpriced = set()
    for run in runs:
        key = price_key(run.get("model"))
        if key is None:
            unpriced.add(run.get("model"))
            continue
        cost = run_costs(run, PRICES[key])
        g = groups[run["config"]]
        g.update(model=run.get("model"), priceKey=key, harness=run["harness"], effort=run["effort"],
                 resultsSlug=run["resultsSlug"])
        g["runs"] += 1
        g["wins"] += run["state"] == "WIN"
        g["levels"] += int(run.get("levelsCompleted") or 0)
        g["levelTotal"] += int(run.get("levelCount") or 0)
        g["moves"] += run["moves"]
        for field in ("input", "cached", "output", "reasoning", "requests"):
            g[field] += run["usage"]["all"][field]
        g["longRequests"] += run["usage"]["longActionRequests"]["requests"] + run["usage"]["longCompactionRequests"]["requests"]
        for field in ("arcMethod", "billed", "billedHigh"):
            g[field] += cost[field]
        g["games"][run["gameId"]] = {"state": run["state"], "levels": f"{run.get('levelsCompleted')}/{run.get('levelCount')}",
                                     "moves": run["moves"], **{k: round(v, 2) for k, v in cost.items()}}
    for config, g in groups.items():
        g["semiPrivateCost"] = semi.get(config)
        g["prices"] = {k: v for k, v in PRICES[g["priceKey"]].items()}
        for field in ("arcMethod", "billed", "billedHigh"):
            g[field] = round(g[field], 2)

    OUT.write_text(json.dumps({"method": __doc__.split("PURPOSE:")[1].split("SRP/DRY")[0].strip(),
                               "configs": dict(sorted(groups.items()))}, indent=2) + "\n", encoding="utf-8")

    print(f"{'config':48s} {'runs':>4s} {'won':>4s} {'levels':>8s} {'moves':>7s} {'input M':>8s} {'cached%':>7s} "
          f"{'output M':>8s} {'ARC method':>11s} {'billed':>10s} {'semi-priv':>10s}")
    for config, g in sorted(groups.items()):
        cached_share = 100 * g["cached"] / g["input"] if g["input"] else 0
        semi_cost = f"{g['semiPrivateCost']:,.0f}" if g["semiPrivateCost"] else "-"
        print(f"{config:48s} {g['runs']:4d} {g['wins']:4d} {g['levels']:4d}/{g['levelTotal']:<3d} {g['moves']:7d} "
              f"{g['input'] / 1e6:8.1f} {cached_share:6.0f}% {g['output'] / 1e6:8.2f} "
              f"{g['arcMethod']:11,.0f} {g['billed']:10,.0f} {semi_cost:>10s}")
    if unpriced:
        print(f"[official_run_costs] no price for model(s): {sorted(unpriced)}", file=sys.stderr)
    print(f"[official_run_costs] wrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
