#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: ARC Explainer access for the ARC-AGI-2 runs record: publish one run's document
  (PUT /api/team/arc2-runs/machine/runs/<key>) and read the team's notes back
  (GET /api/team/arc2-runs/machine/notes), both behind the site's arc3 admin token
  (server/routes/teamRuns.ts). The token is read from the Mac Mini's login keychain (service
  arc3-community-admin-token, where the leaderboard push already reads it) or ARC3_ADMIN_TOKEN,
  held in memory only, never written or printed.
SRP/DRY check: Pass - HTTP to the site only. Retry-on-deploy pattern copied from arc-3's
  tools/kaggle_runs/site_io.py (another repo, another site, so not imported).
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request

SITE = os.environ.get("ARC_EXPLAINER_SITE", "https://arc.markbarney.net")
_token: str | None = None


def token() -> str:
    global _token
    if _token:
        return _token
    value = os.environ.get("ARC3_ADMIN_TOKEN", "").strip()
    if not value:
        p = subprocess.run(["security", "find-generic-password", "-s", "arc3-community-admin-token", "-w"],
                           capture_output=True, text=True, timeout=30)
        value = p.stdout.strip() if p.returncode == 0 else ""
    if not value:
        raise RuntimeError("no site admin token (keychain service arc3-community-admin-token)")
    _token = value
    return value


def _request(method: str, path: str, payload=None) -> dict:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    req = urllib.request.Request(f"{SITE}{path}", data=data, method=method,
                                 headers={"X-ARC3-Admin-Token": token(), "Content-Type": "application/json",
                                          "User-Agent": "bubba-arc2-runs/1"})
    for attempt in range(4):   # a deploy swap answers 502 for a minute or so; the writes are idempotent
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return body.get("data") or {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace").strip()[:300]
            if exc.code in (502, 503, 504) and attempt < 3:
                time.sleep(30 * (attempt + 1))
                continue
            raise RuntimeError(f"{method} {path}: HTTP {exc.code} {detail}") from None
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt < 3:
                time.sleep(30 * (attempt + 1))
                continue
            raise RuntimeError(f"{method} {path}: {exc}") from None
    raise RuntimeError(f"{method} {path}: gave up")


def put_run(document: dict) -> None:
    _request("PUT", f"/api/team/arc2-runs/machine/runs/{document['key']}", document)


def get_notes() -> dict:
    return _request("GET", "/api/team/arc2-runs/machine/notes").get("notes") or {}
