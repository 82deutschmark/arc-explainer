#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: Claude's note on one ARC-AGI-2 submission. Headless Claude Code (the `claude` CLI on the Mac
  Mini, signed in with the subscription login; ANTHROPIC_API_KEY is removed from its environment)
  reads a brief (the submitter's own description, the public score, the baseline's description and
  score, the team's recent scores for context), the code diff against the baseline, and the
  saved-version run logs, and writes a fixed-format note: the change, the outcome against the
  baseline, where the code and the log show the change, and a verdict.

  WHY THIS PROMPT AND NOT ARC-3's. The ARC-3 note reads turn-by-turn game traces. ARC-2 runs have
  none: a notebook's saved-version run is a short check on a few public tasks (different tasks for
  different people), and the scored run on the hidden tasks shows nothing but a number. So the
  evidence is the code diff (did the described change actually land, and what else changed with it)
  and the check-run log (did it run as intended), and the outcome is score against score.

  Claude runs in a scratch folder holding only those files, with Read, Grep and Glob and nothing
  else (--safe-mode: no project files, memory, settings or MCP). A reply without the four headings
  is retried once, then recorded as failed; the watcher retries it on a later pass.
SRP/DRY check: Pass - the headless call is the one arc-3's tools/kaggle_runs/impact.py makes (same
  flags and JSON envelope); the brief and prompt are new because the evidence is different.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

PROMPT_VERSION = "arc2-impact-v1"
MODEL = os.environ.get("ARC2_RUNS_MODEL", "claude-opus-5-5")
CLAUDE = shutil.which("claude") or str(Path.home() / ".local" / "bin" / "claude")
TIMEOUT = 30 * 60
HEADINGS = ("## Change", "## Outcome against the baseline", "## Where the code and log show it", "## Verdict")

PROMPT = """You are writing a short note on one ARC-AGI-2 Kaggle submission for the team's internal record.
The team (ARC Mutants) uses these notes to decide which changes to keep, so be accurate and plain.

Read brief.md first: the submitter's own description of the change, the public leaderboard score, the
baseline submission it is judged against with its description and score, and the team's recent scores.
Then use the evidence that exists in this folder (brief.md says which):
- diff.patch: the notebook code of this run against the baseline's. It can be long; Grep it.
- run.log and baseline.log: each notebook's saved-version run. That is a short check Kaggle runs before
  submitting, usually on a handful of public tasks, NOT the scored run on the hidden tasks. Use it to
  see whether the run went as intended (settings printed, phases reached, errors, timings), never as
  a measure of accuracy.

Reply with exactly this markdown and nothing before or after it:

## Change
One or two sentences: what this run changed against its baseline, in the submitter's terms. Do not
invent details. If the description and the code disagree, say so here.

## Outcome against the baseline
One line: "<this score> vs <baseline score>", and what it means. A difference of a point or two from a
single submission is within what a rerun can move; call it "needs a repeat", never a win or a loss.
If there is no baseline, say what the score is and that there is nothing to compare against.

## Where the code and log show it
Three to six bullets. Each says where in the diff (the cell number from the "===== cell N =====" headers)
or in the log the change shows up, and whether it is the change the description claims. Name anything
else that changed in the code but is not in the description. Say whether the log shows the changed
setting taking effect and whether the check run hit any errors. Quote at most a few words. Only write
what you saw. If a file is missing, say what you could not check.

## Verdict
One or two sentences: did the change land as described, did the score move beyond what a rerun could
explain, and what one submission would settle it.

Plain words for a busy reader: no code blocks, no file paths, no hashes.
"""


def build_workdir(work: Path, run: dict, base: dict | None, recent: list[dict], diff: str | None,
                  run_log: str | None, base_log: str | None) -> None:
    def score(r):
        return "pending" if r.get("publicScore") is None else f"{r['publicScore']:.2f}"

    b = [f"# Submission {run['key']}", "",
         f"Submitted {run.get('submittedAt')} by {run.get('who')} ({run.get('submittedBy')}), "
         f"notebook {run.get('kernelRef') or 'unknown'}.",
         f"Public leaderboard score: {score(run)}.", "",
         "The submitter's description:", "", f"> {run.get('description') or '(none)'}", ""]
    if base:
        b += [f"## Baseline: submission {base['key']}", "",
              f"Submitted {base.get('submittedAt')} by {base.get('who')}, score {score(base)}.", "",
              f"> {base.get('description') or '(none)'}", "", f"Why this baseline: {run.get('baselineWhy')}", ""]
    else:
        b += ["## Baseline: none", ""]
    b += ["## Evidence in this folder", "",
          f"- diff.patch: {'yes' if diff else 'no (one of the two notebooks was not kept)'}",
          f"- run.log: {'yes' if run_log else 'no'}",
          f"- baseline.log: {'yes' if base_log else 'no'}", "",
          "## The team's submissions before this one (newest first, for context)", ""]
    b += [f"- {r.get('submittedAt', '')[:10]} {r.get('who')}: {score(r)} - {(r.get('description') or '')[:160]}"
          for r in recent]
    (work / "brief.md").write_text("\n".join(b) + "\n")
    if diff:
        (work / "diff.patch").write_text(diff)
    if run_log:
        (work / "run.log").write_text(run_log)
    if base_log:
        (work / "baseline.log").write_text(base_log)


def summarize(run: dict, base: dict | None, recent: list[dict], diff: str | None, run_log: str | None,
              base_log: str | None) -> dict:
    """Returns {state: done|failed, markdown|error, model, promptVersion, seconds}."""
    started = time.monotonic()
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    env["PATH"] = f"{Path.home() / '.local' / 'bin'}:{env.get('PATH', '/usr/bin:/bin')}"
    with tempfile.TemporaryDirectory(prefix="arc2-impact-") as tmp:
        work = Path(tmp)
        build_workdir(work, run, base, recent, diff, run_log, base_log)
        last = ""
        for _attempt in range(2):
            proc = subprocess.run([CLAUDE, "-p", "--model", MODEL, "--tools", "Read,Grep,Glob",
                                   "--allowedTools", "Read,Grep,Glob", "--safe-mode", "--no-session-persistence",
                                   "--output-format", "json"],
                                  input=PROMPT, capture_output=True, text=True, cwd=work, env=env, timeout=TIMEOUT)
            envelope = json.loads(proc.stdout) if proc.stdout.strip().startswith("{") else {}
            text = (envelope.get("result") or "").strip()
            last = text or (proc.stderr or proc.stdout)[-500:]
            at = text.find(HEADINGS[0])
            if at != -1 and all(h in text for h in HEADINGS):
                return {"state": "done", "markdown": text[at:], "model": MODEL, "promptVersion": PROMPT_VERSION,
                        "seconds": round(time.monotonic() - started)}
    return {"state": "failed", "error": last[:500], "model": MODEL, "promptVersion": PROMPT_VERSION,
            "seconds": round(time.monotonic() - started)}
