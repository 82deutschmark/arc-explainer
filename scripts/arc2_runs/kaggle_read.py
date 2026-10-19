#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: Read-only Kaggle access for the ARC-AGI-2 runs record (scripts/arc2_runs): every team
  submission on the ARC-AGI-2 competition, a notebook's current version, status and source, and
  downloading a finished notebook's small output files. Never pushes, submits or changes anything.
  Runs as markbarney (the default ~/.kaggle credential): on team ARC Mutants, that account sees every
  teammate's submission (Jack's jcole75 included) and can read their notebooks.
  Kaggle facts this rests on (checked 19-Oct-2026):
  - The submission list pages with a token; the high-level client ignores page_number, so this calls
    the SDK's list_submissions directly and follows next_page_token.
  - A submission names its notebook and scriptVersionId in its url, but nothing maps a
    scriptVersionId to a version number, and pulling an older version's source answers 403. The
    current version's source and output are readable. So evidence is collected only while the
    submitted version is still the newest (see arc2_runs.py for how that is decided).
  - `kaggle kernels output` always serves the newest version's output.
SRP/DRY check: Pass - Kaggle reads only. Mirrors arc-3's tools/kaggle_runs/kaggle_io.py, which is
  ARC-3-only and lives in another repo, so it is not imported.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

COMPETITION = "arc-prize-2026-arc-agi-2"
KAGGLE_CLI = os.environ.get("KAGGLE_CLI", str(Path.home() / ".kaggle-venv" / "bin" / "kaggle"))
FINAL = {"complete", "error", "cancelled"}
# The record keeps logs and small text or JSON outputs, never weights, caches, notebooks or HTML.
OUTPUT_PATTERN = r"^(?!.*__results__)[^/]+(/[^/]+){0,2}\.(log|txt|json|jsonl|md|csv)$"
URL_RE = re.compile(r"^/code/([A-Za-z0-9_-]+)/([A-Za-z0-9_.-]+)\?scriptVersionId=([0-9]+)")

_api = None


def api():
    global _api
    if _api is None:
        from kaggle.api.kaggle_api_extended import KaggleApi
        _api = KaggleApi()
        _api.authenticate()
    return _api


def _status_name(value) -> str:
    name = str(value).split(".")[-1].lower()
    return {"cancel_acknowledged": "cancelled", "cancel_requested": "cancelling"}.get(name, name)


def _score(value) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def submissions() -> list[dict]:
    """Every team submission, newest first."""
    from kagglesdk.competitions.types.competition_api_service import ApiListSubmissionsRequest
    out, token = [], ""
    with api().build_kaggle_client() as client:
        for _ in range(50):     # 100 a page; the team has a few hundred at most
            req = ApiListSubmissionsRequest()
            req.competition_name, req.page_size = COMPETITION, 100
            if token:
                req.page_token = token
            resp = client.competitions.competition_api_client.list_submissions(req)
            for s in resp.submissions or []:
                m = URL_RE.match(s.url or "")
                out.append({
                    "key": str(s.ref),
                    "submittedAt": s.date.isoformat(timespec="seconds") + "Z" if s.date else None,
                    "submittedBy": s.submitted_by or "",
                    "description": (s.description or "").strip(),
                    "status": _status_name(s.status),
                    "publicScore": _score(s.public_score),
                    "error": (s.error_description or "").strip() or None,
                    "kernelRef": f"{m.group(1)}/{m.group(2)}".lower() if m else None,
                    "scriptVersionId": m.group(3) if m else None,
                    "url": f"https://www.kaggle.com{s.url}" if s.url else None,
                })
            token = resp.next_page_token
            if not token:
                break
    return out


def kernel_info(ref: str) -> dict:
    """{version, status, failure} for the notebook's newest version."""
    from kagglesdk.kernels.types.kernels_api_service import ApiGetKernelRequest
    owner, slug = ref.split("/", 1)
    with api().build_kaggle_client() as client:
        req = ApiGetKernelRequest()
        req.user_name, req.kernel_slug = owner, slug
        meta = client.kernels.kernels_api_client.get_kernel(req).metadata
    st = api().kernels_status(ref)
    return {"version": int(meta.current_version_number or 0), "status": _status_name(st.status),
            "failure": (st.failure_message or "")[:300]}


def kernel_source(ref: str) -> str:
    """The newest version's source (notebook JSON or script text)."""
    from kagglesdk.kernels.types.kernels_api_service import ApiGetKernelRequest
    owner, slug = ref.split("/", 1)
    with api().build_kaggle_client() as client:
        req = ApiGetKernelRequest()
        req.user_name, req.kernel_slug = owner, slug
        blob = client.kernels.kernels_api_client.get_kernel(req).blob
    return (blob.source or "") if blob else ""


def download_output(ref: str, dest: Path) -> int:
    """Newest version's small output files into dest (which must not exist). Returns the file count."""
    tmp = dest.with_name(dest.name + ".partial")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    p = subprocess.run([KAGGLE_CLI, "kernels", "output", ref, "-p", str(tmp), "-q", "-o",
                        "--file-pattern", OUTPUT_PATTERN], capture_output=True, text=True, timeout=1800)
    if p.returncode != 0:
        shutil.rmtree(tmp, ignore_errors=True)
        raise RuntimeError(f"kaggle kernels output {ref} failed: {(p.stdout + p.stderr)[-300:]}")
    count = sum(1 for f in tmp.rglob("*") if f.is_file())
    if count == 0:
        shutil.rmtree(tmp, ignore_errors=True)
        return 0
    tmp.rename(dest)
    return count
