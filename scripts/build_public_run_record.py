#!/usr/bin/env python3.13
"""
Author: Claude Opus 5.5
Date: 02-November-2026
PURPOSE: Write the data block of the public run record (client/public/specials/run-record.html) from our Kaggle
  submission lists and the public boards. The Boss wants the raw timing of our runs public, never our private notes, so
  a submission contributes only its time and public score. Descriptions, notebooks, submitters and errors are not read
  into the output at all, which is what keeps this page from ever leaking them.
  Run with the Kaggle venv's Python (~/.kaggle-venv/bin/python3.13), which has the kaggle package. Pass --arc3-backfill
  with the season history file from the arc-3 repo on the first build; later builds keep the earlier ARC-3 gold line
  already in the page. Read-only on Kaggle. Publishes nothing: commit and push the page yourself.
SRP/DRY check: Pass - Kaggle reads reuse scripts/arc2_runs/kaggle_read.py and page writing reuses replace_region from
  scripts/weekend_magazine.py; this file only chooses what is public.
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'scripts' / 'arc2_runs')]
from weekend_magazine import replace_region  # noqa: E402

PAGE = ROOT / 'client/public/specials/run-record.html'
BOARD = 'https://arc.markbarney.net/api/kaggle/arc-prize-2026-arc-agi-{}/board'
BELL = '2026-11-02T23:59:00Z'
START = '2026-03-20T00:00:00Z'
QWEN = [
    {'t': '2026-04-21T00:00:00Z', 'short': 'Qwen 3.6', 'label': 'Qwen 3.6 27B weights public'},
    {'t': '2026-08-14T00:00:00Z', 'short': 'Qwen 3.8', 'label': 'Qwen 3.8 27B weights public'},
    {'t': '2026-08-26T00:00:00Z', 'short': 'Flash Next', 'label': 'Qwen 3.8 Flash Next weights public'},
]
DUCK = {'t': '2026-07-01T00:00:00Z', 'short': 'Duck', 'label': "Tufa Labs' Duck harness open-sourced"}
MILESTONE_2 = {'t': '2026-09-30T00:00:00Z', 'short': 'Milestone 2', 'label': 'Milestone 2 notebooks public'}
CONTESTS = {
    'arc3': dict(number='3', contest='ARC-AGI-3', team='Team Turducken', logToggle=True, yMax=60,
                 events=sorted(QWEN + [DUCK, MILESTONE_2], key=lambda e: e['t']),
                 lede='From 1.21 on Jul 2 to 8.62 on Sep 27, then 32.74 a week later and 56.02 by Oct 23. On this log scale each main gridline is ten times the one below, and zero scores sit on the floor.'),
    'arc2': dict(number='2', contest='ARC-AGI-2', team='ARC Mutants', logToggle=False, yMax=75,
                 events=QWEN,
                 lede='From May 5 to Oct 5 our best barely moved, 32.36 to 33.61, despite a long run of attempts. It reached 50.83 by Oct 31.'),
}


def public_runs(submissions):
    """(time, score) for every scored submission, oldest first. Nothing else from a submission may pass this point."""
    rows = [(s['submittedAt'], s['publicScore']) for s in submissions if s.get('publicScore') is not None and s.get('submittedAt')]
    return [[t, float(v)] for t, v in sorted(rows)]


def last_per_day(points):
    """One gold-line point a UTC day, the last reading of that day."""
    days = {}
    for t, value in sorted(points):
        days[t[:10]] = (t, value)
    return [[t, v] for t, v in days.values()]


def fetch_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'arc-explainer-run-record'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def read_record():
    if not PAGE.exists():
        return {}
    text = PAGE.read_text()
    start = text.index('id="record">') + len('id="record">')
    return json.loads(text[start:text.index('</script>', start)])


def build(submissions_for, board_for, backfill, previous, now):
    """The whole public document. The sources are passed in so a test can run this with no network."""
    contests, as_of = {}, ''
    for key, spec in CONTESTS.items():
        board, submissions = board_for(spec['number']), submissions_for(spec['number'])
        row = next(r for r in board['latest']['rows'] if r[2] == spec['team'])
        gold = [[s['t'], s['gold']] for s in board['history']['snaps']]
        if key == 'arc3':
            first = gold[0][0]
            if backfill:     # the season before our own board saves began; very small early fields make it meaningless before May
                earlier = [[s['t'], s['gold']] for s in backfill['snaps'] if '2026-05-01' <= s['t'] < first]
            else:
                earlier = [p for p in previous.get('contests', {}).get('arc3', {}).get('gold', []) if p[0] < first]
            gold = earlier + gold
        contests[key] = {
            'contest': spec['contest'], 'team': spec['team'], 'logToggle': spec['logToggle'], 'yMax': spec['yMax'],
            'lede': spec['lede'], 'events': spec['events'], 'rank': row[0], 'teams': len(board['latest']['rows']),
            'submitted': len(submissions), 'runs': public_runs(submissions), 'gold': last_per_day(gold),
        }
        as_of = max(as_of, board['latest']['fetched'])
    return {'generated': now, 'asOf': as_of, 'start': START, 'bell': BELL, 'order': list(CONTESTS), 'contests': contests,
            'goldNote': 'ARC-3 from May, rebuilt from Tong Hui Kang\'s public tracker before Oct 4; ARC-2 from Oct 8, when our board saves began'}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[2])
    parser.add_argument('--arc3-backfill', type=Path, help="the arc-3 repo's leaderboard backfill.json")
    args = parser.parse_args()
    import kaggle_read

    def submissions_for(number):
        kaggle_read.COMPETITION = f'arc-prize-2026-arc-agi-{number}'
        return kaggle_read.submissions()

    backfill = json.loads(args.arc3_backfill.read_text()) if args.arc3_backfill else None
    record = build(submissions_for, lambda n: fetch_json(BOARD.format(n)), backfill, read_record(),
                   datetime.now(timezone.utc).isoformat(timespec='seconds'))
    block = '<script type="application/json" id="record">' + json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '</script>'
    PAGE.write_text(replace_region(PAGE.read_text(), 'record', block))
    print('wrote', PAGE, {k: len(c['runs']) for k, c in record['contests'].items()})


if __name__ == '__main__':
    main()
