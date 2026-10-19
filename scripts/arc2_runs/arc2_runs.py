#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: The ARC-AGI-2 runs record (Son asked for an ARC-2 version of the ARC-3 "Kaggle runs record";
  the Boss put it on ARC Explainer behind a team login, 19-Oct-2026). Every submission team ARC Mutants
  makes on the ARC-AGI-2 competition, Jack Cole's included, becomes a run on the team-only page
  arc.markbarney.net/team/arc2-runs: the submitter's own description, the public score, the run it is
  judged against, the code diff against that run, the saved-version run log, and Claude's note.

  The spine is Kaggle's team submission list, which already carries the description, score and
  notebook for every submission and can be read at any time, so a missed pass loses nothing. The
  extras (notebook source and run output) are only readable while the submitted version is still the
  notebook's newest, so each pass collects them for new submissions as soon as they appear.

  tick      one pass (launchd ai.bubba.arc2-runs-watch, every 15 minutes): read the submission list and
            the team's notes, collect source and output for new submissions, write up to a few Claude
            notes, publish every run whose document changed. Read-only on Kaggle.
  process   <key> [--renote]  redo one run (and its note) and publish it.
  list      print the registry.

  Evidence and notes are only gathered for submissions since NOTES_SINCE (the October push); earlier
  ones are recorded with their description and score only.
  Data lands on the Samsung SSD under data/arc2-runs/<submission>/ (refuses to run if it is not
  mounted); state in ~/bubba-workspace/state/arc2-runs/. Run it with the Kaggle venv's Python
  (~/.kaggle-venv/bin/python3.13), which has the kaggle package.
SRP/DRY check: Pass - orchestration only: Kaggle in kaggle_read.py, text work in evidence.py, the note in
  impact.py, the site in site_client.py. Shape follows arc-3's tools/kaggle_runs/kaggle_runs.py.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import sys
import traceback
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import evidence  # noqa: E402
import impact  # noqa: E402
import kaggle_read  # noqa: E402
import site_client as site_api  # noqa: E402

SSD = Path("/Volumes/Samsung 9100 SSD")
DATA = SSD / "data" / "arc2-runs"
STATE = Path(os.environ.get("ARC2_RUNS_STATE", Path.home() / "bubba-workspace" / "state" / "arc2-runs"))
REGISTRY = STATE / "registry.json"
SUMMARIES = STATE / "summaries"
NOTES_SINCE = os.environ.get("ARC2_RUNS_NOTES_SINCE", "2026-10-01")
MAX_NOTES_PER_TICK = int(os.environ.get("ARC2_RUNS_NOTES_PER_TICK", "4"))
WHO = {"jcole75": "Jack Cole", "markbarney": "Boss", "sonphamorg": "Son", "scizical": "Ronen"}
KAGGLE_FIELDS = ("submittedAt", "submittedBy", "description", "status", "publicScore", "error", "kernelRef",
                 "scriptVersionId", "url")


def log(msg: str) -> None:
    print(f"{datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')} {msg}", flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@contextmanager
def locked_registry():
    """Yields the registry dict and writes it back atomically."""
    STATE.mkdir(parents=True, exist_ok=True)
    with open(STATE / ".lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {"runs": {}}
        yield data
        tmp = REGISTRY.with_name(f".registry.{os.getpid()}.tmp")
        tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
        os.replace(tmp, REGISTRY)


def load_registry() -> dict:
    return json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {"runs": {}}


def eligible(entry: dict) -> bool:
    return bool(entry.get("kernelRef")) and (entry.get("submittedAt") or "") >= NOTES_SINCE


def run_dir(key: str) -> Path:
    return DATA / key


# --- evidence ------------------------------------------------------------------------------------------

def collect(entries: dict, all_subs: list[dict]) -> None:
    """Notebook source and output for eligible submissions whose evidence isn't settled yet."""
    newest_for_ref: dict[str, str] = {}
    for s in sorted(all_subs, key=lambda s: s["submittedAt"] or ""):
        if s.get("kernelRef"):
            newest_for_ref[s["kernelRef"]] = s["key"]
    infos: dict[str, dict] = {}
    for key, entry in entries.items():
        if not eligible(entry) or entry.get("evidenceDone"):
            continue
        ref = entry["kernelRef"]
        try:
            if ref not in infos:
                infos[ref] = kaggle_read.kernel_info(ref)
            info = infos[ref]
            fields: dict = {}
            if entry.get("version") is None:
                # Nothing maps a scriptVersionId to a version number. At first sight the newest submission
                # from a notebook is taken to be its newest version (exact when there is only one version).
                if newest_for_ref.get(ref) == key and info["version"]:
                    fields.update(version=info["version"], versionAssumed=info["version"] != 1)
                else:
                    fields.update(evidenceDone=True, outputState="replaced",
                                  outputNote="A later version of this notebook was pushed before the record "
                                             "saw this submission, so its code and log weren't kept.")
            version = fields.get("version", entry.get("version"))
            current = version is not None and version == info["version"]
            d = run_dir(key)
            if current and not (d / "source.txt").exists():
                source = kaggle_read.kernel_source(ref)
                if source:
                    d.mkdir(parents=True, exist_ok=True)
                    (d / "source.txt").write_text(source)
                    (d / "code.py").write_text(evidence.notebook_code(source))
                    log(f"{key}: kept the notebook source ({len(source)} characters)")
            if current and info["status"] in kaggle_read.FINAL and not (d / "output").exists():
                n = kaggle_read.download_output(ref, d / "output")
                fields["outputState"] = "kept" if n else "none"
                if not n:      # Kaggle has nothing small to give for this version; don't ask again
                    fields["evidenceDone"] = True
                log(f"{key}: kept {n} output files")
            elif current and info["status"] not in kaggle_read.FINAL:
                fields["outputState"] = "running"
            elif version is not None and not current and not (d / "output").exists():
                fields.update(outputState="replaced", evidenceDone=True,
                              outputNote="A later version of this notebook replaced this one's output on Kaggle "
                                         "before the record could keep it.")
            if (d / "output").exists() and (d / "source.txt").exists():
                fields["evidenceDone"] = True
            if info.get("failure") and current:
                fields["kernelFailure"] = info["failure"]
            if fields:
                with locked_registry() as data:
                    data["runs"][key].update(fields)
                    entries[key] = data["runs"][key]
        except Exception as exc:
            # 403/404: the notebook was deleted or never shared with the team. That won't change, so
            # stop asking; anything else (network, Kaggle hiccup) is retried on the next pass.
            if " 403 " in f" {exc} " or " 404 " in f" {exc} ":
                with locked_registry() as data:
                    data["runs"][key].update(evidenceDone=True, outputState="unreadable",
                                             outputNote="Kaggle doesn't let the team read this notebook "
                                                        "(deleted or not shared), so its code and log weren't kept.")
                    entries[key] = data["runs"][key]
            log(f"{key}: collecting evidence failed: {exc}")


def code_of(key: str) -> str | None:
    p = run_dir(key) / "code.py"
    return p.read_text() if p.exists() else None


def log_of(entry: dict) -> tuple[str, bool, str] | None:
    out = run_dir(entry["key"]) / "output"
    if not out.is_dir():
        return None
    path = evidence.main_log(out, entry["kernelRef"].split("/", 1)[1])
    if not path:
        return None
    text, cut = evidence.condense_log(path)
    return text, cut, path.name


# --- baseline, note, document --------------------------------------------------------------------------

def baseline_for(entry: dict, note: dict | None) -> tuple[str | None, str]:
    if note and note.get("baseline") == "none":
        return None, f"no baseline, set by {note.get('updatedBy') or 'the team'}"
    if note and note.get("baseline"):
        return note["baseline"], f"set by {note.get('updatedBy') or 'the team'}"
    if entry.get("proposedBaseline"):
        return entry["proposedBaseline"]["key"], entry["proposedBaseline"]["reason"]
    return None, "no baseline found in the description"


def public_run(entry: dict) -> dict:
    return {"key": entry["key"], "who": entry.get("who"), **{f: entry.get(f) for f in KAGGLE_FIELDS}}


def note_signature(entry: dict, base_key: str | None, diff: bool, run_log: bool, base_log: bool) -> str:
    return f"{base_key}|{diff}|{run_log}|{base_log}|{entry.get('publicScore')}|{impact.PROMPT_VERSION}"


def maybe_note(entry: dict, entries: dict, base_key: str | None, base_why: str, diff: str | None,
               run_log: str | None, force: bool) -> tuple[dict | None, bool]:
    """The run's note, rewritten when its inputs changed. Returns (note, whether Claude ran)."""
    path = SUMMARIES / f"{entry['key']}.json"
    old = json.loads(path.read_text()) if path.exists() else None
    if not eligible(entry) or entry.get("status") != "complete":
        return old, False
    base = entries.get(base_key) if base_key else None
    base_log = log_of(base) if base and base.get("kernelRef") else None
    sig = note_signature(entry, base_key, bool(diff), bool(run_log), bool(base_log))
    if not force and old and old.get("signature") == sig and not (old["state"] == "failed" and old.get("attempts", 1) < 3):
        return old, False
    if not (diff or run_log):
        return {"state": "waiting", "error": "no code or log kept for this run", "baselineKey": base_key}, False
    recent = sorted((public_run(e) for e in entries.values() if (e.get("submittedAt") or "") < entry["submittedAt"]),
                    key=lambda r: r["submittedAt"] or "", reverse=True)[:12]
    log(f"{entry['key']}: writing Claude's note with {impact.MODEL}")
    run = {**public_run(entry), "baselineWhy": base_why}
    note = impact.summarize(run, public_run(base) if base else None, recent, diff, run_log,
                            base_log[0] if base_log else None)
    note.update(signature=sig, at=now_iso(), baselineKey=base_key,
                attempts=(old.get("attempts", 1) + 1) if old and old.get("signature") == sig else 1)
    SUMMARIES.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(note, indent=1, ensure_ascii=False))
    log(f"{entry['key']}: note {note['state']} in {note['seconds']} s")
    return note, True


def build_document(entry: dict, entries: dict, notes: dict, *, allow_note: bool, force_note: bool = False
                   ) -> tuple[dict, bool]:
    base_key, base_why = baseline_for(entry, notes.get(entry["key"]))
    run_code, base_code = code_of(entry["key"]), code_of(base_key) if base_key else None
    diff = None
    if run_code is not None and base_code is not None:
        text, cut = evidence.code_diff(base_code, run_code, f"submission {base_key}", f"submission {entry['key']}")
        diff = {"against": base_key, "text": text, "truncated": cut}
    run_log = log_of(entry) if entry.get("kernelRef") else None
    if allow_note or force_note:
        note, ran = maybe_note(entry, entries, base_key, base_why, diff["text"] if diff else None,
                               run_log[0] if run_log else None, force_note)
    else:
        path = SUMMARIES / f"{entry['key']}.json"
        note, ran = (json.loads(path.read_text()) if path.exists() else None), False
    out_state = entry.get("outputState") or ("not collected (before the record's start)" if not eligible(entry) else "waiting")
    files = sorted(p.relative_to(run_dir(entry["key"]) / "output").as_posix()
                   for p in (run_dir(entry["key"]) / "output").rglob("*") if p.is_file()) \
        if (run_dir(entry["key"]) / "output").is_dir() else []
    doc = {
        "apiVersion": 1, "competition": "arc-2", **public_run(entry),
        "kernel": {"ref": entry.get("kernelRef"), "version": entry.get("version"),
                   "versionAssumed": bool(entry.get("versionAssumed")), "scriptVersionId": entry.get("scriptVersionId"),
                   "url": entry.get("url")},
        "proposedBaseline": entry.get("proposedBaseline"),
        "output": {"state": out_state, "files": files[:200], "note": entry.get("outputNote") or entry.get("kernelFailure")},
        "log": {"text": run_log[0], "truncated": run_log[1], "source": run_log[2]} if run_log else None,
        "codeDiff": diff,
        "summary": {k: note.get(k) for k in ("state", "markdown", "model", "promptVersion", "at", "baselineKey", "error")}
        if note else None,
    }
    return doc, ran


def publish(entry: dict, doc: dict) -> bool:
    """PUT the document if it changed since the last publish. True if it was sent."""
    digest = hashlib.sha256(json.dumps(doc, sort_keys=True).encode()).hexdigest()
    if entry.get("publishedHash") == digest:
        return False
    try:
        site_api.put_run({**doc, "publishedAt": now_iso()})
    except RuntimeError as exc:
        if "HTTP 413" not in str(exc):
            raise
        # Over the site's cap: publish without the bulky parts rather than resend the same document forever.
        log(f"{entry['key']}: document too large, publishing without the diff and log")
        site_api.put_run({**doc, "codeDiff": None, "log": None, "publishedAt": now_iso(),
                          "output": {**doc["output"], "note": "The diff and log were too large for the page; "
                                                              "they are on the Mac Mini."}})
    with locked_registry() as data:
        data["runs"][entry["key"]].update(publishedHash=digest, publishedAt=now_iso())
    return True


# --- commands ------------------------------------------------------------------------------------------

def ssd_ready() -> None:
    if not os.path.ismount(SSD):
        raise SystemExit(f"{SSD} is not mounted; not running (never the internal drive)")


def sync_submissions() -> list[dict]:
    subs = kaggle_read.submissions()
    ordered = sorted(subs, key=lambda s: s["submittedAt"] or "")
    with locked_registry() as data:
        for i, s in enumerate(ordered):
            entry = data["runs"].setdefault(s["key"], {"key": s["key"], "firstSeen": now_iso()})
            if "submittedAt" not in entry:
                log(f"{s['key']}: new submission by {s['submittedBy']}")
            entry.update({f: s[f] for f in KAGGLE_FIELDS}, who=WHO.get(s["submittedBy"], s["submittedBy"]))
            entry["proposedBaseline"] = evidence.guess_baseline(s, ordered[:i])
    return subs


def cmd_tick(args) -> int:
    ssd_ready()
    STATE.mkdir(parents=True, exist_ok=True)
    with open(STATE / ".tick.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("another tick is still running")
            return 0
        subs = sync_submissions()
        try:
            notes = site_api.get_notes()
        except Exception as exc:
            log(f"reading the team's notes failed: {exc}")
            notes = {}
        entries = load_registry()["runs"]
        collect(entries, subs)
        entries = load_registry()["runs"]
        budget, sent = MAX_NOTES_PER_TICK, 0
        # A run whose baseline the team changed goes first (someone is waiting on that note), then newest
        # first, so a fresh submission gets its note before the backfill does.
        def stale_note(k: str) -> bool:
            path = SUMMARIES / f"{k}.json"
            if not path.exists():
                return False
            return json.loads(path.read_text()).get("baselineKey") != baseline_for(entries[k], notes.get(k))[0]
        for key in sorted(entries, key=lambda k: (stale_note(k), entries[k].get("submittedAt") or ""), reverse=True):
            try:
                doc, ran = build_document(entries[key], entries, notes, allow_note=budget > 0)
                budget -= ran
                sent += publish(entries[key], doc)
            except Exception as exc:
                log(f"{key}: failed: {exc}\n{traceback.format_exc(limit=3)}")
        log(f"tick done: {len(entries)} runs, {sent} published, {MAX_NOTES_PER_TICK - budget} notes written")
    return 0


def cmd_process(args) -> int:
    ssd_ready()
    sync_submissions()
    entries = load_registry()["runs"]
    collect({args.key: entries[args.key]}, kaggle_read.submissions())
    entries = load_registry()["runs"]
    doc, _ = build_document(entries[args.key], entries, site_api.get_notes(), allow_note=True, force_note=args.renote)
    publish(entries[args.key], doc)
    return 0


def cmd_list(_args) -> int:
    for e in sorted(load_registry()["runs"].values(), key=lambda e: e.get("submittedAt") or "", reverse=True):
        score = "" if e.get("publicScore") is None else f"{e['publicScore']:.2f}"
        print(f"{e['key']:<10} {(e.get('submittedAt') or '')[:16]:<17} {e.get('who', ''):<10} {score:>6} "
              f"{e.get('outputState') or '':<9} {(e.get('description') or '')[:70]}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="ARC-AGI-2 runs record for arc.markbarney.net/team/arc2-runs")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("tick")
    p = sub.add_parser("process")
    p.add_argument("key")
    p.add_argument("--renote", action="store_true")
    sub.add_parser("list")
    args = ap.parse_args(argv)
    return {"tick": cmd_tick, "process": cmd_process, "list": cmd_list}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
