#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Prepare one concise daily X outbox draft from published evening editions
# and their verified box scores. Browser automation performs the separately authorized send.
# SRP/DRY check: Pass — consumes the public news contract; no X API, model API or git calls.
"""Prepare a daily X draft. This helper never posts to X."""
import argparse
from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from newsroom import fetch, SITE


def daily_post(index, day):
    articles = [a for a in index['articles'] if a['date'] == day and a['edition'] == 'evening' and not a['id'].endswith('-preview')]
    selected = []
    for competition in ('arc-3', 'arc-2'):
        matches = [a for a in articles if a['competition'] == competition]
        if matches:
            selected.append(max(matches, key=lambda a: a['publishedAt']))
    if not selected:
        return {'date': day, 'state': 'waiting', 'reason': 'No published evening edition for today.'}
    lead_in = f'The ARC Daily · {day}\nPublic boards'
    lines = []
    fallback_lines = []
    for article in selected:
        standings = sorted(article['stats'], key=lambda stat: stat['rank'])
        leader = standings[0] if standings else None
        label = article['competition'].upper()
        url = f'{SITE}/news/{article["id"]}'
        line = f'{label}: {leader["name"]} leads at {leader["score"]:.12g}.' if leader else f'{label}: evening edition.'
        movers = [s for s in standings if s['scoreChange'] is not None and s['scoreChange'] > 0]
        if movers:
            mover = max(movers, key=lambda s: s['scoreChange'])
            line += f' {mover["name"]} +{mover["scoreChange"]:.12g}, #{mover["rank"]}.'
        lines.append(f'{line}\n{url}')
        fallback_lines.append(f'{label}: evening leaderboard recap.\n{url}')
    message = lead_in + '\n\n' + '\n\n'.join(lines)
    # Count full URLs and double non-ASCII characters conservatively; no dependency on X's short-link accounting.
    weight = lambda value: sum(1 if ord(char) < 128 else 2 for char in value)
    if weight(message) > 280:
        message = lead_in + '\n\n' + '\n\n'.join(fallback_lines)
    if weight(message) > 280:
        raise ValueError('Daily post is too long')
    return {'date': day, 'state': 'draft', 'message': message, 'articleIds': [a['id'] for a in selected],
            'dataAsOf': {a['competition']: a['dataAsOf'] for a in selected}, 'account': '82deutschmark'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--date', help='Historical draft-only audit; scheduled runs must omit this')
    args = parser.parse_args()
    target = Path(args.output)
    if target.exists() and json.loads(target.read_text()).get('state') in ('posting', 'posted'):
        raise SystemExit('Existing send attempt or post: inspect its state instead of replacing it.')
    day = args.date or datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d')
    index, _ = fetch(f'{SITE}/api/news')
    post = daily_post(index, day)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(post, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(post, ensure_ascii=False, indent=2))
