"""
Author: Claude Opus 5 (Bubba sub-agent, label arc3-legibility-gate)
Date: 01-September-2026
PURPOSE: Run legibility_gate.py over every task in the review queue and rewrite
server/services/arc3Mirror/arc3Triage.json so illegible ones leave it carrying their
reason. This is how the 23 unwinnable tasks documented in
docs/2026-09-01-arc3-junk-game-audit.md stop being served to reviewers.

WHY A SCRIPT AND NOT A RUNTIME CHECK. arc3Triage.json is data, not logic -- the same
reason `weak` and `duplicate` are baked rather than recomputed. The verdicts need the
task's Python source, and the qNNN sources are not in this repository: they live on the
mirror and are fetched. Deciding this per request would put a network fetch and a parse in
front of "what should I play next", to answer a question whose answer does not change.

WHAT IT DOES NOT DO: delete anything. An illegible row keeps every measurement it had,
gains `illegibility` with the comparison that fired, and records the status it held before
-- so the cull is auditable from the UI and reversible by re-running with the gate changed.
That is the same principle as `duplicateOf: "q239-v1"`: a cull you cannot inspect is a cull
nobody can overrule.

SCOPE: rows whose status is `queued` change status. A row already `weak` or `duplicate` is
already out of the queue, and overwriting a measured verdict to gain nothing would destroy
the duplicate clustering's own record; those rows get the `illegibility` evidence and keep
their status. Totals then still sum to `probed`.

Usage:
    python3 scripts/arc3/apply_legibility_gate.py --report        # verdicts only, no write
    python3 scripts/arc3/apply_legibility_gate.py --write         # rewrite arc3Triage.json

Sources are cached in --src-dir (default /tmp/arc3-legibility-src) and fetched from
ARC3_MIRROR_BASE (default https://arc3.markbarney.net/api/arc3-mirror) when absent. The 50
hand-authored tasks are read from server/data/arc3-games/, which is in this repo.

SRP/DRY check: Pass -- the rules live in legibility_gate.py (canonical copy in the arena
repo, see README-legibility.md); this only applies them to the triage file.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

from legibility_gate import analyze                      # noqa: E402

TRIAGE = REPO / 'server' / 'services' / 'arc3Mirror' / 'arc3Triage.json'
LOCAL_GAMES = REPO / 'server' / 'data' / 'arc3-games'
MIRROR = os.environ.get('ARC3_MIRROR_BASE', 'https://arc3.markbarney.net/api/arc3-mirror')


def source_for(game_id: str, src_dir: pathlib.Path) -> str | None:
    """The task's Python: from this repo if we host it, from the mirror otherwise."""
    local = LOCAL_GAMES / f'{game_id}.py'
    if local.exists():
        return local.read_text(encoding='utf-8')
    cached = src_dir / f'{game_id}.py'
    if cached.exists() and cached.stat().st_size > 0:
        return cached.read_text(encoding='utf-8')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f'{MIRROR}/games/{game_id}/source', timeout=30) as r:
                code = json.loads(r.read())['data']['sourceCode']
            if not code:
                return None
            src_dir.mkdir(parents=True, exist_ok=True)
            cached.write_text(code, encoding='utf-8')
            return code
        except Exception:
            time.sleep(1 + attempt * 2)
    return None


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src-dir', default='/tmp/arc3-legibility-src')
    ap.add_argument('--write', action='store_true', help='rewrite arc3Triage.json')
    ap.add_argument('--report', action='store_true', help='print verdicts, write nothing')
    args = ap.parse_args(argv[1:])
    if not (args.write or args.report):
        ap.error('pass --report or --write')
    src_dir = pathlib.Path(args.src_dir)

    data = json.loads(TRIAGE.read_text(encoding='utf-8'))
    rows = data['games']
    print(f'{len(rows)} triage rows; fetching sources into {src_dir} as needed')

    with ThreadPoolExecutor(5) as ex:
        sources = list(ex.map(lambda r: source_for(r['gameId'], src_dir), rows))

    unreadable = [r['gameId'] for r, s in zip(rows, sources) if s is None]
    flagged, changed = [], 0
    for row, src in zip(rows, sources):
        if src is None:
            continue
        verdict = analyze(src, row['gameId'])
        if not verdict.illegible:
            # Re-running after a gate change must be able to CLEAR a row, or the file
            # accumulates verdicts no rule still produces.
            if row.get('status') == 'illegible':
                row['status'] = row.get('illegibility', {}).get('previousStatus', 'queued')
                changed += 1
            row.pop('illegibility', None)
            continue
        first = verdict.hidden_comparisons[0] if verdict.hidden_comparisons else {}
        previous = row.get('illegibility', {}).get('previousStatus') or row['status']
        row['illegibility'] = {
            'signal': 'commit-only death + win gate on a term the renderer never draws',
            'comparison': first.get('comparison', ''),
            'hiddenTerms': sorted(set(first.get('hidden_attrs', []) + first.get('hidden_keys', []))),
            'why': first.get('why', []),
            'previousStatus': previous,
        }
        if row['status'] == 'queued':
            row['status'] = 'illegible'
            changed += 1
        flagged.append((row['gameId'], previous, row['status']))

    counts = Counter(r['status'] for r in rows)
    data['totals'] = {
        'probed': len(rows),
        'queued': counts['queued'],
        'duplicate': counts['duplicate'],
        'weak': counts['weak'],
        'illegible': counts['illegible'],
    }

    print(f'\nflagged {len(flagged)} of {len(rows)}; {changed} row(s) changed status')
    print('  previous status of the flagged: '
          f'{dict(Counter(prev for _, prev, _ in flagged))}')
    print(f'  totals now: {data["totals"]} (sum '
          f'{sum(v for k, v in data["totals"].items() if k != "probed")})')
    if unreadable:
        print(f'  WARNING: {len(unreadable)} source(s) could not be read and were NOT '
              f'checked: {unreadable[:10]}')
    for gid, prev, now in flagged:
        print(f'    {gid:<12} {prev} -> {now}')

    if args.write:
        TRIAGE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n',
                          encoding='utf-8')
        print(f'\nwrote {TRIAGE}')
    else:
        print('\n--report: nothing written')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
