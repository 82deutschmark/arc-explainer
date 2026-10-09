#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Prepare a 2 pm X draft and saved board evidence for the evening desk.
# Browser automation researches public posts and performs the authorized daily send.
# SRP/DRY check: Pass — reuses newsroom evidence and previous-Eastern-evening comparisons.
"""Prepare an afternoon X draft and evidence. This helper never posts to X."""
import argparse
import json
from pathlib import Path
from newsroom import prepare, stamp, write, ET, SITE


def daily_post(brief):
    day = stamp(brief['preparedAt']).astimezone(ET).date().isoformat()
    ready = [(competition, item['articleBase']) for competition, item in brief['competitions'].items() if item['status'] == 'ready']
    failures = {competition: item['error'] for competition, item in brief['competitions'].items() if item['status'] != 'ready'}
    if not ready:
        return {'date': day, 'state': 'waiting', 'reason': 'No usable afternoon board evidence.', 'failures': failures}
    lead_in = f'ARC Daily · {day} afternoon\nPublic boards'
    lines = []
    leader_lines = []
    score_lines = []
    has_gains = False
    for competition, board in ready:
        standings = sorted(board['stats'], key=lambda stat: stat['rank'])
        leader = standings[0] if standings else None
        if not leader or leader['rank'] != 1:
            raise ValueError(f'{competition} has no verified leader')
        label = competition.upper()
        line = f'{label}: {leader["name"]} leads at {leader["score"]:.12g}.'
        leader_lines.append(line)
        score_lines.append(f'{label}: leader {leader["score"]:.12g}.')
        movers = [s for s in standings if board['baselineAt'] and s['scoreChange'] is not None and s['scoreChange'] > 0]
        if movers:
            mover = max(movers, key=lambda s: s['scoreChange'])
            line += f' {mover["name"]} +{mover["scoreChange"]:.12g}, #{mover["rank"]}.'
            has_gains = True
        lines.append(line)
    render = lambda rows, gains=False: lead_in + '\n' + '\n'.join(rows) + ('\nGains vs prior 6pm ET.' if gains else '') + f'\n{SITE}/news'
    message = render(lines, has_gains)
    # Count full URLs and double non-ASCII characters conservatively; no dependency on X's short-link accounting.
    weight = lambda value: sum(1 if ord(char) < 128 else 2 for char in value)
    if weight(message) > 280:
        message = render(leader_lines)
    if weight(message) > 280:
        message = render(score_lines)
    if weight(message) > 280:
        raise ValueError('Daily post is too long')
    return {'date': day, 'state': 'draft', 'message': message, 'account': '82deutschmark',
            'dataAsOf': {competition: board['dataAsOf'] for competition, board in ready},
            'baselineAt': {competition: board['baselineAt'] for competition, board in ready}, 'failures': failures}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--brief-output', required=True, help='Save fresh board evidence for the evening desk')
    args = parser.parse_args()
    target = Path(args.output)
    if target.exists() and json.loads(target.read_text()).get('state') in ('posting', 'posted'):
        raise SystemExit('Existing send attempt or post: inspect its state instead of replacing it.')
    # Before 6 pm, the shared helper returns actual afternoon observations and marks
    # its article base as a preview. These are research evidence, never a published issue.
    brief = prepare('evening')
    post = daily_post(brief)
    write(args.brief_output, brief)
    post['boardBriefPath'] = str(Path(args.brief_output).resolve())
    write(target, post)
    print(json.dumps(post, ensure_ascii=False, indent=2))
