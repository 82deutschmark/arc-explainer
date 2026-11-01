#!/usr/bin/env python3.13
"""Send the saved Kaggle leaderboard to ARC Explainer's public leaderboard page.

Run by leaderboard_publish.sh straight after leaderboard_snapshot.py. Reads the files that
script keeps in $LEADERBOARD_DATA_DIR (default ~/.cache/arc3-leaderboard-data) (latest, history, events, backfill) and POSTs
them to arc-explainer's /api/kaggle/board, which serves the public page at
https://arc.markbarney.net/kaggle-leaderboard (added 05-Oct-2026).
LEADERBOARD_COMPETITION selects ARC-3 (default) or ARC-2; ARC-2 reads the arc-2/
child directory and sends its own competition key to the same API.

NON-FATAL. If the site is mid-deploy or unreachable, this prints one line and exits 0;
the snapshot is still saved locally. The next run sends the newest files anyway.

The token is arc-explainer's ARC3_COMMUNITY_ADMIN_TOKEN: from the environment if set,
otherwise from this Mac's login keychain (service arc3-community-admin-token), the same
credential the old standing pusher used. Never pass it on the command line.
"""
import gzip, json, os, subprocess, sys, urllib.error, urllib.request
from leaderboard_config import COMP, DATA, check_competition

URL = os.environ.get("EXPLAINER_BOARD_URL", "https://arc3.markbarney.net/api/kaggle/board")
DOCS = ("latest", "history", "events", "backfill")


def token():
    t = os.environ.get("ARC3_COMMUNITY_ADMIN_TOKEN", "").strip()
    if t:
        return t
    r = subprocess.run(["security", "find-generic-password", "-s", "arc3-community-admin-token", "-w"],
                       capture_output=True, text=True)
    return r.stdout.strip()


def main():
    tok = token()
    if not tok:
        print("explainer push skipped: no token in env or keychain")
        return
    documents = {}
    for name in DOCS:
        p = DATA / f"{name}.json"
        if p.exists():
            documents[name] = json.loads(p.read_text())
    if "latest" not in documents:
        print("explainer push skipped: no latest.json")
        return
    check_competition(documents["latest"])
    body = gzip.compress(json.dumps({"competition": COMP, "documents": documents},
                                    separators=(",", ":")).encode())
    req = urllib.request.Request(URL, data=body, method="POST", headers={
        "Content-Type": "application/json", "Content-Encoding": "gzip",
        "X-ARC3-Admin-Token": tok, "User-Agent": "arc3-leaderboard-bot"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.loads(r.read() or b"{}").get("data", {})
            print(f"{COMP} explainer push ok: {out.get('capturedAt')} ({', '.join(out.get('documents', []))})")
    except urllib.error.HTTPError as e:
        print(f"explainer push failed: HTTP {e.code} {e.read()[:200]!r}")
    except Exception as e:  # network, DNS, timeout: never break the snapshot job
        print(f"explainer push failed: {e}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"explainer push failed: {e}")
    sys.exit(0)
