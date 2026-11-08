#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: Push edited special-page files (client/public/specials/...) to the live site in
         seconds through PUT /api/specials/file, instead of waiting for a full Railway build.
         Then fetch each pushed file from the live URL once and confirm the bytes match
         (and, with --expect, that the page contains a given sentence).

         Which files: the paths given on the command line, or --changed for every file under
         client/public/specials that differs from HEAD (staged, unstaged or untracked), or
         --since <git ref> for everything changed since that commit.

         Token: ARC3_COMMUNITY_ADMIN_TOKEN from the environment, else the macOS keychain item
         "arc3-community-admin-token" (the same secret the Kaggle pusher uses). It is sent only
         as a request header and never printed.

         The pushed copy lives until the next Railway deploy; commit the same edit to git so
         that deploy carries it. Server side: server/routes/specialsPublish.ts. Doc:
         docs/reference/api/specials-fast-publish.md.
SRP/DRY check: Pass -- publishing client only; path rules are enforced by the server, this
         script only keeps to files under client/public/specials.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SPECIALS = REPO / "client" / "public" / "specials"
DEFAULT_BASE = "https://arc.markbarney.net"
# Mirrors SPECIALS_ALLOWED_EXTENSIONS in server/services/specialsOverlay.ts; the server is the real gate.
ALLOWED = {".html", ".md", ".png", ".svg", ".csv", ".json", ".webp", ".jpg", ".jpeg", ".txt"}


def load_token() -> str:
    token = os.environ.get("ARC3_COMMUNITY_ADMIN_TOKEN", "").strip()
    if token:
        return token
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", "arc3-community-admin-token", "-w"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        sys.exit("No token: set ARC3_COMMUNITY_ADMIN_TOKEN or add keychain item arc3-community-admin-token.")


def git_lines(*args: str) -> list[str]:
    out = subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True, check=True)
    return [line for line in out.stdout.splitlines() if line.strip()]


def changed_files(since: str | None) -> list[Path]:
    scope = "client/public/specials"
    names = set(git_lines("diff", "--name-only", since or "HEAD", "--", scope))
    names |= set(git_lines("ls-files", "--others", "--exclude-standard", "--", scope))
    return [REPO / name for name in sorted(names) if (REPO / name).is_file()]


def to_relative(file: Path) -> str:
    """Path under /specials/ for a local file, or exit if it is not inside client/public/specials."""
    resolved = file.resolve()
    try:
        return resolved.relative_to(SPECIALS.resolve()).as_posix()
    except ValueError:
        sys.exit(f"Not under client/public/specials: {file}")


def request(method: str, url: str, token: str | None = None, body: bytes | None = None) -> tuple[int, bytes]:
    headers = {"User-Agent": "specials-publish/1"}
    if token:
        headers["X-ARC3-Admin-Token"] = token
    if body is not None:
        headers["Content-Type"] = "application/octet-stream"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()
    except urllib.error.URLError as err:
        sys.exit(f"Cannot reach {url.split('?')[0]}: {err.reason}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Push edited /specials/ files live through the API, then verify them.")
    parser.add_argument("files", nargs="*", type=Path, help="files under client/public/specials")
    parser.add_argument("--changed", action="store_true", help="push every specials file that differs from HEAD")
    parser.add_argument("--since", help="push every specials file changed since this git ref")
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--expect", action="append", default=[],
                        help="text an .html file pushed in this run must contain when fetched live (repeatable)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = list(args.files)
    if args.changed or args.since:
        files += changed_files(args.since)
    files = [f if f.is_absolute() else Path.cwd() / f for f in files]
    files = list(dict.fromkeys(f.resolve() for f in files))
    skipped = [f for f in files if f.suffix.lower() not in ALLOWED]
    files = [f for f in files if f.suffix.lower() in ALLOWED]
    for f in skipped:
        print(f"skip (extension not publishable): {to_relative(f)}")
    if not files:
        print("Nothing to push.")
        return 0

    base = args.base_url.rstrip("/")
    token = None if args.dry_run else load_token()
    failures = 0
    html_pages: list[tuple[str, bytes]] = []

    for file in files:
        relative = to_relative(file)
        data = file.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if args.dry_run:
            print(f"would push {relative} ({len(data)} bytes)")
            continue
        status, body = request("PUT", f"{base}/api/specials/file?path={urllib.parse.quote(relative)}", token, data)
        if status != 200:
            print(f"FAIL push {relative}: HTTP {status} {body[:200].decode('utf-8', 'replace')}")
            failures += 1
            continue
        # One live fetch per file. The query string only defeats any cache in between; the
        # server ignores it when choosing the file.
        live_status, live = request("GET", f"{base}/specials/{urllib.parse.quote(relative)}?v={digest[:12]}")
        if live_status == 200 and hashlib.sha256(live).hexdigest() == digest:
            print(f"live  {relative}")
            if file.suffix.lower() == ".html":
                html_pages.append((relative, live))
        else:
            print(f"FAIL verify {relative}: live copy differs (HTTP {live_status})")
            failures += 1

    for text in args.expect:
        hits = [rel for rel, page in html_pages if text.encode("utf-8") in page]
        if hits:
            print(f"found on {', '.join(hits)}: {text!r}")
        else:
            print(f"FAIL expected text not on any pushed page: {text!r}")
            failures += 1

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
