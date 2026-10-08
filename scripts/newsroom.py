#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol / Codex
# Date: 2026-10-08
# PURPOSE: Prepare auditable ARC Daily evidence, validate GPT-6 Sol prose, and publish
# immutable JSON articles and competitor observations consumed by shared/news.ts.
# SRP/DRY check: Pass — uses existing board API and shared news contract; no model API or git calls.
"""Deterministic newsroom plumbing. The scheduled model writes the journalism."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import urllib.request
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

UTC = timezone.utc
ET = ZoneInfo('America/New_York')
ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://arc.markbarney.net'
FEATURED = {
    'arc-3': {'15605182', '15770880', '16032816', '15501006', '16371045', '16021367'},
    'arc-2': {'17023174', '15605185', '15507730', '15486939'},
}
NARRATIVE = {'id', 'headline', 'dek', 'sections', 'teamIds', 'discord'}


def stamp(value):
    if not isinstance(value, str):
        raise ValueError('timestamp must be an ISO string')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timestamp must include timezone')
    return result.astimezone(UTC)


def iso(value):
    return value.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n').encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def load(path):
    return json.loads(Path(path).read_text(), parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(value))


def windows(edition, now):
    local = now.astimezone(ET)
    scheduled = local.replace(hour=6 if edition == 'morning' else 18, minute=0, second=0, microsecond=0)
    cutoff = min(now, scheduled.astimezone(UTC))
    baseline = (cutoff.replace(hour=0, minute=0, second=0, microsecond=0) if edition == 'morning'
                else (scheduled - timedelta(days=1)).astimezone(UTC))
    return local.date().isoformat(), cutoff, baseline, now < scheduled


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def boundary(snaps, when):
    eligible = [s for s in snaps if stamp(s['t']) <= when]
    found = max(eligible, key=lambda s: stamp(s['t'])) if eligible else None
    return found if found and when - stamp(found['t']) <= timedelta(minutes=90) else None


def observation(team_id, row, trail, target, latest_at, pinned):
    """Change-only trails can carry values while still tracked, never beyond an exit.

    Outside top-300 coverage, only an exact observation or the original continuously
    pinned team is safe. New featured identities do not retroactively expand coverage.
    """
    if target == latest_at:
        return [iso(target), row[4], row[0]]
    pts = [p for p in trail.get('pts', []) if stamp(p[0]) <= target]
    if not pts:
        return None
    p = max(pts, key=lambda p: stamp(p[0]))
    exact = stamp(p[0]) == target
    if exact or team_id == pinned:
        return p
    later = [q for q in trail.get('pts', []) if stamp(q[0]) > target]
    next_point = min(later, key=lambda q: stamp(q[0])) if later else None
    # A score-changing re-entry after a long silent interval could hide an exit.
    # The legacy feed has no coverage ledger, so withhold this comparison.
    possible_gap = next_point and next_point[1] != p[1] and stamp(next_point[0]) - stamp(p[0]) > timedelta(minutes=90)
    if row[0] <= 300 and p[2] <= 300 and not possible_gap:
        return p
    return None


def board_brief(board, competition, edition, now, actual_now, source_url, source_hash, launch_preview=False):
    date, cutoff, baseline_target, preview = windows(edition, now)
    if launch_preview:
        cutoff, preview = now, True
    slug = f'arc-prize-2026-{competition.replace("arc-", "arc-agi-")}'
    if board.get('competition') != slug:
        raise ValueError('competition mismatch')
    latest, history = board['latest'], board['history']
    if latest.get('competition', slug) != slug:
        raise ValueError('latest competition mismatch')
    latest_at = stamp(latest['fetched'])
    if latest_at > actual_now:
        raise ValueError('latest observation is in the future')
    if actual_now - latest_at > timedelta(minutes=90):
        raise ValueError('latest observation is over 90 minutes old')
    snaps = history['snaps']
    if not snaps or any(stamp(s['t']) > actual_now for s in snaps):
        raise ValueError('invalid/future snapshot history')
    closing = boundary(snaps, cutoff)
    if not closing:
        raise ValueError('no observation within 90 minutes at or before edition cutoff')
    closing_at = stamp(closing['t'])
    baseline = boundary(snaps, baseline_target)
    baseline_at = stamp(baseline['t']) if baseline else None
    rows = latest['rows']
    if not rows or len({r[1] for r in rows}) != len(rows):
        raise ValueError('missing rows or duplicate team IDs')
    stats, observations, comparisons = [], {}, {}
    for row in rows:
        if (len(row) < 7 or not isinstance(row[1], str) or not row[1].isdigit()
                or not isinstance(row[0], int) or row[0] < 1 or not finite(row[4])):
            raise ValueError('invalid leaderboard row')
        tid = row[1]
        trail = history['trails'].get(tid, {})
        for p in trail.get('pts', []):
            if len(p) != 3 or not finite(p[1]) or not isinstance(p[2], int) or p[2] < 1 or stamp(p[0]) > actual_now:
                raise ValueError('invalid trail observation')
        # ARC3's original pinned team was tracked throughout the existing collector.
        continuously_pinned = '15605182' if competition == 'arc-3' else None
        end = observation(tid, row, trail, closing_at, latest_at, continuously_pinned)
        start = observation(tid, row, trail, baseline_at, latest_at, continuously_pinned) if baseline_at else None
        if not end:
            continue
        stat = {'teamId': tid, 'name': row[2], 'rank': end[2], 'score': end[1],
                'rankChange': start[2] - end[2] if start else None,
                'scoreChange': round(end[1] - start[1], 10) if start else None}
        stats.append(stat)
        comparisons[tid] = {'start': start, 'end': end}
        observations[tid] = {'name': row[2], 'members': [s for s in row[6].split(',') if s],
                             'observedAt': iso(latest_at)}
    stats.sort(key=lambda s: (s['rank'], s['teamId']))
    gainers = sorted([s for s in stats if s['scoreChange'] is not None and s['scoreChange'] > 0],
                     key=lambda s: (-s['scoreChange'], s['rank']))[:10]
    selected_ids = {s['teamId'] for s in stats if s['rank'] <= 10} | FEATURED[competition] | {s['teamId'] for s in gainers}
    selected = [s for s in stats if s['teamId'] in selected_ids]
    if not selected:
        raise ValueError('no verified candidate observations at cutoff')
    note = ('Comparisons use observed snapshots at or before the stated boundaries. '
            'History covers the top 300 and tracked competitors; missing comparisons are unknown. '
            'Score-event entries are context, not net daily gains. Unfamiliar names are not necessarily new entrants.')
    if not baseline:
        note += ' No usable observation exists at the comparison baseline.'
    if preview:
        note += f' Launch/manual preview, actual cutoff {iso(cutoff)}; this is not the scheduled edition.'
    sources = [{'id': 'board', 'title': f'{competition.upper()} public leaderboard and observed history',
                'url': source_url, 'accessedAt': iso(actual_now)}]
    article_base = {'id': f'{date}-{edition}-{competition}' + ('-preview' if preview else ''), 'date': date, 'edition': edition,
                    'competition': competition, 'sources': sources, 'publishedAt': iso(actual_now),
                    'dataAsOf': iso(closing_at), 'baselineAt': iso(baseline_at) if baseline_at else None,
                    'generatedBy': 'gpt-6-sol', 'stats': selected, 'coverageNote': note}
    events = [e for e in board.get('events', []) if baseline_target < stamp(e['t']) <= closing_at]
    evidence = {'sourceSha256': source_hash, 'sourceUrl': source_url, 'accessedAt': iso(actual_now),
                'latestAt': iso(latest_at), 'cutoffAt': iso(cutoff), 'baselineTargetAt': iso(baseline_target),
                'closingSnapshot': closing, 'baselineSnapshot': baseline,
                'comparisons': {tid: comparisons[tid] for tid in sorted(selected_ids & comparisons.keys())},
                'events': events, 'observations': {tid: observations[tid] for tid in sorted(selected_ids & observations.keys())}}
    return {'status': 'ready', 'articleBase': article_base, 'evidence': evidence,
            'candidates': {'leaders': [s['teamId'] for s in selected if s['rank'] <= 10],
                           'featured': sorted(FEATURED[competition]), 'gainers': [s['teamId'] for s in gainers]}}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ARC-Daily-newsroom'}), timeout=30) as r:
        raw = r.read(20_000_001)
    if len(raw) > 20_000_000:
        raise ValueError('board exceeds 20 MB limit')
    return json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value))), hashlib.sha256(raw).hexdigest()


def add_notebook_sources(item, competition, actual_now, root=ROOT):
    """Reuse only dated, explicitly sourced public facts; never synthesize biographies."""
    path = Path(root) / 'content/news/competitors.json'
    if not path.exists():
        return
    records = load(path)
    validate_notebook(records)
    known = {s['teamId'] for s in item['articleBase']['stats']}
    facts = []
    for record in records:
        if record['competition'] != competition or record['teamId'] not in known:
            continue
        for index, fact in enumerate(record.get('facts', [])):
            if (not fact.get('text') or not fact.get('sourceTitle')
                    or not fact.get('sourceUrl', '').startswith('https://')
                    or stamp(fact['checkedAt']) > actual_now):
                raise ValueError('invalid sourced competitor fact')
            source_id = f"fact-{record['teamId']}-{index}"
            item['articleBase']['sources'].append({'id': source_id, 'title': fact['sourceTitle'],
                                                  'url': fact['sourceUrl'], 'accessedAt': fact['checkedAt']})
            facts.append({'teamId': record['teamId'], 'sourceId': source_id, **fact})
    item['evidence']['competitorFacts'] = facts


def prepare(edition, now=None, fetcher=fetch, actual_now=None, preview=False):
    actual_now = actual_now or datetime.now(UTC)
    now = now or actual_now
    if now > actual_now:
        raise ValueError('--now may not be in the future')
    result = {'version': 1, 'preparedAt': iso(actual_now), 'edition': edition, 'competitions': {}}
    for comp in FEATURED:
        url = f'{SITE}/api/kaggle/arc-prize-2026-{comp.replace("arc-", "arc-agi-")}/board'
        try:
            board, sha = fetcher(url)
            result['competitions'][comp] = board_brief(board, comp, edition, now, actual_now, url, sha, preview)
            add_notebook_sources(result['competitions'][comp], comp, actual_now)
        except Exception as error:
            result['competitions'][comp] = {'status': 'error', 'error': str(error), 'sourceUrl': url}
    result['sha256'] = digest(result)
    return result


def text(value, label, maximum=20000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f'invalid {label}')
    if re.search(r'<\s*/?\s*[A-Za-z][^>]*>', value):
        raise ValueError(f'raw HTML in {label}')
    return value


def web_source(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.netloc or any(c.isspace() for c in url):
        raise ValueError('sources must be valid HTTPS URLs')


def contract_stamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})', value):
        raise ValueError('invalid public ISO timestamp')
    return stamp(value)


def validate_notebook(records):
    if not isinstance(records, list):
        raise ValueError('competitors.json must be an array')
    seen = set()
    for record in records:
        rid = record['id']
        if (record['competition'] not in FEATURED or not re.fullmatch(r'\d+', record['teamId'])
                or rid != f"{record['competition']}-{record['teamId']}" or len(rid) > 100 or rid in seen):
            raise ValueError('invalid or duplicate competitor identity')
        seen.add(rid)
        text(record['name'], 'competitor name')
        for key in ('aliases', 'members'):
            if not isinstance(record[key], list) or any(not isinstance(x, str) for x in record[key]):
                raise ValueError(f'invalid competitor {key}')
        if contract_stamp(record['firstObservedAt']) > contract_stamp(record['lastObservedAt']):
            raise ValueError('competitor observation dates are reversed')
        if not isinstance(record['facts'], list):
            raise ValueError('competitor facts must be an array')
        for fact in record['facts']:
            text(fact['text'], 'competitor fact')
            text(fact['sourceTitle'], 'competitor source title')
            web_source(fact['sourceUrl'])
            contract_stamp(fact['checkedAt'])


def neutralize(value):
    return re.sub(r'@(everyone|here|[!&]?\d+)', '@\u200b\\1', value)


def validate(draft, brief):
    expected = dict(brief)
    sha = expected.pop('sha256', None)
    if sha != digest(expected):
        raise ValueError('brief checksum mismatch; prepare a new brief instead of editing evidence')
    if not isinstance(draft, dict):
        raise ValueError('article must be an object')
    item = next((v for v in brief['competitions'].values()
                 if v['status'] == 'ready' and v['articleBase']['id'] == draft.get('id')), None)
    if item is None:
        raise ValueError('article ID has no usable competition brief')
    base = item['articleBase']
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', base['id']):
        raise ValueError('invalid article ID')
    for key in ('publishedAt', 'dataAsOf'):
        contract_stamp(base[key])
    if base['baselineAt']:
        contract_stamp(base['baselineAt'])
    for source in base['sources']:
        web_source(source['url'])
        contract_stamp(source['accessedAt'])
        text(source['id'], 'source ID')
        text(source['title'], 'source title')
    if len({s['id'] for s in base['sources']}) != len(base['sources']):
        raise ValueError('duplicate source IDs')
    if set(draft) - NARRATIVE - set(base):
        raise ValueError('unknown article fields')
    for key in set(draft) & set(base):
        if draft[key] != base[key]:
            raise ValueError(f'cannot change verified {key}')
    if not NARRATIVE <= draft.keys():
        raise ValueError('missing narrative fields')
    text(draft['headline'], 'headline', 240)
    text(draft['dek'], 'dek', 700)
    source_ids = {s['id'] for s in base['sources']}
    if not isinstance(draft['sections'], list) or not 1 <= len(draft['sections']) <= 12:
        raise ValueError('article requires 1–12 sections')
    for section in draft['sections']:
        if not isinstance(section, dict) or set(section) - {'heading', 'text', 'sourceIds'}:
            raise ValueError('invalid section fields')
        text(section.get('text'), 'section text')
        if 'heading' in section:
            text(section['heading'], 'section heading', 240)
        refs = section.get('sourceIds')
        if not isinstance(refs, list) or not refs or any(not isinstance(s, str) or s not in source_ids for s in refs):
            raise ValueError('section requires valid sourceIds')
    team_ids = draft['teamIds']
    allowed_teams = {s['teamId'] for s in base['stats']}
    if not isinstance(team_ids, list) or any(not isinstance(t, str) or t not in allowed_teams for t in team_ids) or len(set(team_ids)) != len(team_ids):
        raise ValueError('teamIds must refer to unique verified teams in this competition')
    discord = neutralize(text(draft['discord'], 'Discord', 1900))
    if len(discord) > 1900:
        raise ValueError('Discord exceeds 1900 characters after mention neutralization')
    for stat in base['stats']:
        if not finite(stat['score']) or not isinstance(stat['rank'], int) or stat['rank'] < 1:
            raise ValueError('nonfinite/invalid stats')
        if any(stat[k] is not None and not finite(stat[k]) for k in ('scoreChange', 'rankChange')):
            raise ValueError('nonfinite comparisons')
    if stamp(base['dataAsOf']) > stamp(item['evidence']['cutoffAt']) or stamp(base['dataAsOf']) > stamp(base['publishedAt']):
        raise ValueError('invalid factual timestamp')
    if base['baselineAt'] and stamp(base['baselineAt']) > stamp(item['evidence']['baselineTargetAt']):
        raise ValueError('baseline is after comparison boundary')
    article = {**base, **{k: draft[k] for k in NARRATIVE}, 'discord': discord}
    encoded(article)  # Reject NaN/Infinity throughout, including supplied metadata.
    return article, item


def publish(draft, brief, root=ROOT):
    article, item = validate(draft, brief)
    directory = Path(root) / 'content/news'
    path = directory / 'articles' / f'{article["id"]}.json'
    proof_path = directory / 'evidence' / f'{article["id"]}.json'
    proof = {'articleId': article['id'], 'briefSha256': brief['sha256'], **item['evidence']}
    # Preflight every immutable destination before changing anything, including retries.
    for target, value in ((path, article), (proof_path, proof)):
        if target.exists() and load(target) != value:
            raise ValueError(f'immutable publication conflict: {target}')
    notebook_path = directory / 'competitors.json'
    notebook = load(notebook_path) if notebook_path.exists() else []
    validate_notebook(notebook)
    records = {r['id']: r for r in notebook}
    for tid, observation_data in item['evidence']['observations'].items():
        rid = f'{article["competition"]}-{tid}'
        when = observation_data['observedAt']
        record = records.get(rid)
        if record is None:
            record = {'id': rid, 'competition': article['competition'], 'teamId': tid,
                      'name': observation_data['name'], 'aliases': [], 'members': observation_data['members'],
                      'firstObservedAt': when, 'lastObservedAt': when, 'facts': []}
            records[rid] = record
        else:
            if record['competition'] != article['competition'] or record['teamId'] != tid:
                raise ValueError('competitor identity conflict')
            record['firstObservedAt'] = min(record['firstObservedAt'], when)
            if stamp(when) >= stamp(record['lastObservedAt']):
                if record['name'] != observation_data['name'] and record['name'] not in record['aliases']:
                    record['aliases'].append(record['name'])
                record.update(name=observation_data['name'], members=observation_data['members'], lastObservedAt=when)
    validate_notebook(list(records.values()))
    for target, value in ((path, article), (proof_path, proof)):
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(encoded(value))
    write(notebook_path, sorted(records.values(), key=lambda r: r['id']))
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare')
    prep.add_argument('--edition', choices=['morning', 'evening'], required=True)
    prep.add_argument('--output', required=True)
    prep.add_argument('--preview', action='store_true', help='Launch issue closing at the actual manual run time, with a distinct article ID')
    prep.add_argument('--now', help='Explicit historical/manual clock; never overrides actual freshness checks')
    for name in ('validate', 'publish'):
        cmd = commands.add_parser(name)
        cmd.add_argument('--article', required=True)
        cmd.add_argument('--brief', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            result = prepare(args.edition, stamp(args.now) if args.now else None, preview=args.preview)
            write(args.output, result)
            print(json.dumps({c: v['status'] for c, v in result['competitions'].items()}))
            return 0 if any(v['status'] == 'ready' for v in result['competitions'].values()) else 2
        draft, brief = load(args.article), load(args.brief)
        if args.command == 'validate':
            article, _ = validate(draft, brief)
            print(f'valid: {article["id"]}')
        else:
            print(publish(draft, brief))
        return 0
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'newsroom: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
