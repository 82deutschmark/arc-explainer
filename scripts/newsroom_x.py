#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Prepare a 2 pm X draft and saved board evidence for the evening desk.
# Browser automation researches public posts and performs the authorized daily send.
# 09-Oct-2026 (Claude Opus 5.5): --edition drafts the post announcing a published edition, labeled
# "Early edition" (6 am) or "Late edition" (6 pm) at the Boss's request, and waits until its link opens.
# SRP/DRY check: Pass — reuses newsroom evidence and previous-Eastern-evening comparisons.
"""Prepare an afternoon X draft and evidence, or an edition announcement. This helper never posts to X."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import time
import urllib.error
import urllib.request
from newsroom import prepare, stamp, write, load, ET, SITE, ROOT, UTC

EDITION_WORD = {'morning': 'Early', 'evening': 'Late'}
X_LINK_WEIGHT = 23  # X counts every link as 23 characters.


def x_weight(message, link=None):
    """Conservative X length: ASCII counts 1, anything else 2; a link counts 23 when given."""
    body = message.replace(link, 'x' * X_LINK_WEIGHT) if link else message
    return sum(1 if ord(char) < 128 else 2 for char in body)


def edition_post(edition, day, root=ROOT):
    """The X post for a published edition: its Early/Late label, both headlines when they fit, the lead article link."""
    found = {}
    for competition in ('arc-3', 'arc-2'):
        path = Path(root) / 'content/news/articles' / f'{day}-{edition}-{competition}.json'
        if path.exists():
            found[competition] = load(path)
    label = f'{EDITION_WORD[edition]} edition'
    if not found:
        return {'date': day, 'edition': edition, 'label': label, 'state': 'waiting', 'reason': f'No published {edition} edition for {day}.'}
    lead = found.get('arc-3') or found['arc-2']
    link = f"{SITE}/news/{lead['id']}"
    lines = [f"{name}: {found[competition]['headline']}" for competition, name in (('arc-3', 'ARC-AGI-3'), ('arc-2', 'ARC-AGI-2')) if competition in found]
    render = lambda rows: '\n'.join([f'The ARC Daily Digest · {label}', *rows, link])
    message = render(lines)
    if x_weight(message, link) > 280:
        message = render(lines[:1])
    if x_weight(message, link) > 280:
        raise ValueError('Edition post is too long')
    return {'date': day, 'edition': edition, 'label': label, 'state': 'draft', 'message': message, 'link': link,
            'articleIds': [article['id'] for article in found.values()], 'account': '82deutschmark'}


def link_is_live(url):
    """True once the deployed site serves the article (the server answers 404 for an unknown edition)."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ARC-Daily-newsroom'}), timeout=20) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError):
        return False


def wait_until_live(url, patience=1200, interval=30, check=link_is_live, sleep=time.sleep):
    """The site redeploys a few minutes after the push; post only once the link opens, so X draws its card."""
    waited = 0
    while not check(url):
        if waited >= patience:
            return False
        sleep(interval)
        waited += interval
    return True


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
    parser.add_argument('--brief-output', help='Save fresh board evidence for the evening desk (afternoon recap)')
    parser.add_argument('--edition', choices=['morning', 'evening'], help='Draft the post for this published edition instead')
    args = parser.parse_args()
    target = Path(args.output)
    if target.exists() and json.loads(target.read_text()).get('state') in ('posting', 'posted'):
        raise SystemExit('Existing send attempt or post: inspect its state instead of replacing it.')
    if args.edition:
        post = edition_post(args.edition, datetime.now(UTC).astimezone(ET).date().isoformat())
        # Save the draft before the wait, so an interrupted run leaves the text behind.
        write(target, post)
        if post['state'] == 'draft' and not wait_until_live(post['link']):
            post.update(state='waiting', reason='The article link did not open within 20 minutes of the run; nothing was posted.')
            write(target, post)
        print(json.dumps(post, ensure_ascii=False, indent=2))
        raise SystemExit(0 if post['state'] == 'draft' else 2)
    if not args.brief_output:
        parser.error('--brief-output is required for the afternoon recap')
    # Before 6 pm, the shared helper returns actual afternoon observations and marks
    # its article base as a preview. These are research evidence, never a published issue.
    brief = prepare('evening')
    post = daily_post(brief)
    write(args.brief_output, brief)
    post['boardBriefPath'] = str(Path(args.brief_output).resolve())
    write(target, post)
    print(json.dumps(post, ensure_ascii=False, indent=2))
