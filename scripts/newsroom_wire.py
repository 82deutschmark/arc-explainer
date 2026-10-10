#!/usr/bin/env python3.13
# Author: Claude Opus 5.5
# Date: 2026-10-09
# PURPOSE: The wire desk's deterministic plumbing. GPT-6 Luna, run by a Codex automation, writes
# short sourced stories on both boards several times a day; this helper never calls a model, git or X.
#   prepare   saves a dated brief from the live market digest (GET /api/news/markets, built by
#             shared/newsMarkets.ts): per board, plain-fact story leads for the past day (the lead,
#             gains, climbs, newcomers, the gold line, the field, verified people on moving teams,
#             recent public posts), their citable sources, the pictures the paper owns for them,
#             and which leads recent wire stories already covered.
#   validate  checks a drafted story against its brief: fields, citations, teams, people, picture,
#             wording, and every figure in the prose, which must come from the leads it cites, the
#             teams it lists or the board-wide figures.
#   publish   writes the immutable story to content/news/wire/ and its evidence to
#             content/news/wire-evidence/.
# SRP/DRY check: Pass — reuses newsroom.py's time, text, source and file helpers and the notebook,
# public-post and people source builders the editions use; market figures come from the server.
"""Prepare, validate and publish ARC Daily Digest wire stories. The scheduled model writes the prose."""
import argparse
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import json
import math
from pathlib import Path
import re
import sys
from newsroom import (ROOT, SITE, ET, UTC, stamp, iso, digest, encoded, load, write, text, web_source,
                      contract_stamp, fetch, add_notebook_sources)
from newsroom_people import add_people_sources, read_people
from newsroom_social import add_social_sources

MARKETS_URL = f'{SITE}/api/news/markets'
BOARD_PAGE = {'arc-3': f'{SITE}/kaggle-leaderboard', 'arc-2': f'{SITE}/kaggle-leaderboard/arc-2'}
FRESH = timedelta(minutes=90)
BRIEF_LIFE = timedelta(hours=3)
COVERED_WINDOW = timedelta(hours=36)
STORY_FIELDS = {'competition', 'slug', 'leadIds', 'headline', 'sections', 'teamIds', 'personIds', 'visual'}
REQUIRED = STORY_FIELDS - {'visual'}
SLUG = re.compile(r'[a-z0-9][a-z0-9-]{0,59}')
WIRE_ID = re.compile(r'\d{4}-\d{2}-\d{2}-\d{4}-arc-[23]-[a-z0-9][a-z0-9-]{0,59}')
NUMBER = re.compile(r'(?<![\w.])(\d[\d,]*(?:\.\d+)?)(\s*(?:%|points?\b|pts\b|st\b|nd\b|rd\b|th\b|places?\b))?', re.I)
# Figures from ten up must be digits so the check below can see them.
SPELLED = re.compile(r'\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|tenth|eleventh|twelfth|twentieth|hundredth)\b', re.I)
# Claims the board cannot support: final results, records, certainty about medals.
OVERCLAIM = re.compile(r'\b(record|all-time|historic|unprecedented|clinch\w*|locked up|guarantee\w*|will win|has won gold|final standings)\b', re.I)
# Always-printable figures: the years of past results, the day window and the coverage tiers in the leads.
STANDING_NUMBERS = {'2024', '2025', '2026', '24', '10', '100', '300', '500'}


def short_name(name):
    """'Jean-François Puget (CPMP)' -> 'Jean-François Puget', as shared/news.ts shortPersonName prints it."""
    return re.sub(r'\s*\([^)]*\)\s*$', '', name)


def ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def fig(value):
    return f'{value:.2f}'


def gain(row):
    return None if row['isNew'] or row['scoreThen'] is None else round(row['score'] - row['scoreThen'], 2)


def climb(row):
    return None if row['isNew'] or row['rankThen'] is None else row['rankThen'] - row['rank']


def change(row):
    """'(+3.40)' or '(unchanged)' or '' when unknown."""
    value = gain(row)
    if value is None:
        return ''
    return ' (unchanged)' if abs(value) < 0.005 else f" ({'+' if value > 0 else '-'}{fig(abs(value))})"


def team_rows(board):
    rows = {}
    for key in ('standings', 'gainers', 'climbers', 'newcomers', 'intoGold', 'outOfGold', 'bubble', 'watch'):
        for row in board.get(key, []):
            rows.setdefault(row['teamId'], row)
    for row in (board['leader']['row'], board['leader'].get('previous')):
        if row:
            rows.setdefault(row['teamId'], row)
    return rows


def lead(lid, kind, line, rows, source_ids):
    return {'id': lid, 'kind': kind, 'text': line, 'teamIds': [row['teamId'] for row in rows if row],
            'personIds': [], 'sourceIds': list(dict.fromkeys(source_ids))}


def board_leads(board, board_source):
    """Plain-fact leads for one board. Every figure a story may print comes from these and the board."""
    out, leader = [], board['leader']
    top, second = leader['row'], (board['standings'][1] if len(board['standings']) > 1 else None)
    if leader.get('previous'):
        prev = leader['previous']
        out.append(lead('lead-change', 'leader', f"{top['name']} took first place from {prev['name']} in the past day: {top['name']} {fig(top['score'])}{change(top)}; {prev['name']} now {ordinal(prev['rank'])} at {fig(prev['score'])}{change(prev)}.", [top, prev], [board_source]))
    elif second:
        held = f" It has led since {stamp(leader['heldSince']).astimezone(ET):%B} {stamp(leader['heldSince']).astimezone(ET).day}." if leader.get('heldSince') else ''
        out.append(lead('leader', 'leader', f"{top['name']} leads at {fig(top['score'])}{change(top)}, {fig(leader['leadBy'])} ahead of {second['name']} at {fig(second['score'])}{change(second)}.{held}", [top, second], [board_source]))
    gold = board['lines']['gold']
    if gold['now'] is not None:
        line = f"The gold line, the score at {ordinal(gold['rank'])} (the last of {gold['rank']} gold places), "
        if gold['then'] is None:
            line += f"stands at {fig(gold['now'])}."
        else:
            delta = round(gold['now'] - gold['then'], 2)
            line += f"held at {fig(gold['now'])}." if abs(delta) < 0.005 else f"{'rose' if delta > 0 else 'fell'} {fig(abs(delta))} in the past day to {fig(gold['now'])}."
        if board['bubble']:
            first = board['bubble'][0]
            line += f" First outside gold: {first['name']}, {ordinal(first['rank'])} at {fig(first['score'])}, {fig(gold['now'] - first['score'])} short."
        out.append(lead('gold-line', 'gold-line', line, board['bubble'][:1], [board_source]))
    if board.get('teamsThen') is not None:
        grew = board['teams'] - board['teamsThen']
        out.append(lead('field', 'field', f"The board has {board['teams']:,} teams, {grew:,} more than a day earlier. {board['improved']:,} teams in the top 500 raised their score in the past day, and {board['newcomerCount']:,} teams new to the board reached the top 500.", [], [board_source]))
    seen = set()
    for row in board['gainers']:
        seen.add(row['teamId'])
        moved = f", moving from {ordinal(row['rankThen'])} to {ordinal(row['rank'])}" if row['rankThen'] is not None and row['rankThen'] != row['rank'] else f", holding {ordinal(row['rank'])}"
        out.append(lead(f"gain-{row['teamId']}", 'gain', f"{row['name']} gained {fig(gain(row))} to {fig(row['score'])}{moved}.", [row], [board_source]))
    for row in board['climbers']:
        if row['teamId'] in seen:
            continue
        seen.add(row['teamId'])
        out.append(lead(f"climb-{row['teamId']}", 'climb', f"{row['name']} climbed {climb(row):,} places, from {ordinal(row['rankThen'])} to {ordinal(row['rank'])}, at {fig(row['score'])}{change(row)}.", [row], [board_source]))
    for row in board['newcomers']:
        out.append(lead(f"new-{row['teamId']}", 'newcomer', f"{row['name']} is new on the board and entered at {ordinal(row['rank'])} with {fig(row['score'])}.", [row], [board_source]))
    for row in board['intoGold']:
        out.append(lead(f"into-gold-{row['teamId']}", 'into-gold', f"{row['name']} moved into the gold places, from {ordinal(row['rankThen'])} to {ordinal(row['rank'])}, at {fig(row['score'])}{change(row)}.", [row], [board_source]))
    for row in board['outOfGold']:
        out.append(lead(f"out-of-gold-{row['teamId']}", 'out-of-gold', f"{row['name']} dropped out of the gold places, from {ordinal(row['rankThen'])} to {ordinal(row['rank'])}, at {fig(row['score'])}{change(row)}.", [row], [board_source]))
    return out


def allowed_numbers(board, leads, team_ids=None):
    """Figures a story may print, split by kind: scores and point changes (figures) and ranks,
    places, counts, days and years (counts). Board-wide figures (medal lines, field, counts, the
    leader's margin, days to close) always count; team figures only for `team_ids` when given, so a
    story cannot borrow another team's score. Prose is checked against the right kind."""
    figures, counts = set(), set(STANDING_NUMBERS)
    def figure(value):
        if value is not None:
            figures.add(fig(abs(value)))
    def count(value):
        if value is not None:
            counts.add(str(abs(int(value))))
    for line in (item['text'] for item in leads):
        for token, _ in NUMBER.findall(line):
            (figures if '.' in token else counts).add(normal(token))
    for tid, row in team_rows(board).items():
        if team_ids is not None and tid not in team_ids:
            continue
        for value in (row['score'], row['scoreThen'], gain(row)):
            figure(value)
        for value in (row['rank'], row['rankThen'], climb(row)):
            count(value)
    for key in ('top', 'gold', 'silver', 'bronze'):
        line = board['lines'][key]
        count(line['rank'])
        for value in (line['now'], line['then'], line['weekAgo']):
            figure(value)
        if line['now'] is not None and line['then'] is not None:
            figure(round(line['now'] - line['then'], 2))
    for value in (board['teams'], board['teamsThen'], board['improved'], board['newcomerCount'], *board['medalRanks'].values(),
                  len(board['intoGold']), len(board['outOfGold']), len(board['newcomers'])):
        count(value)
    if board['teamsThen'] is not None:
        count(board['teams'] - board['teamsThen'])
    if board['leader']['leadBy'] is not None:
        figure(round(board['leader']['leadBy'], 2))
    for when in (board['fetched'], board['since'], board['closeAt']):
        if when:
            count(stamp(when).astimezone(ET).day)
    if board['closeAt']:
        count(max(0, math.ceil((stamp(board['closeAt']) - stamp(board['fetched'])).total_seconds() / 86400)))
    order = lambda value: (len(value), value)
    return {'figures': sorted(figures, key=order), 'counts': sorted(counts, key=order)}


def normal(token):
    """'1,583' -> '1583'. '3.4' and '3.40' are the same figure; the comparison is numeric."""
    return token.replace(',', '')


def without_names(body, names):
    """Prose with team, person and contest names blanked out: a name like NVARC3 is not a figure."""
    for name in sorted((name for name in names if re.search(r'[A-Za-z]', name)), key=len, reverse=True):
        body = body.replace(name, ' ')
    return body


def unsupported_numbers(texts, allowed, names):
    """Figures in the prose that the brief does not contain. A number with a decimal point, a percent
    sign or the word "points" must be a score or point change; an ordinal ("3rd") or "places" must be a
    rank or a count of places; a bare whole number may be either."""
    pool = lambda values: {Decimal(value) for value in values}
    figures, counts = pool(allowed['figures']), pool(allowed['counts'])
    bad = []
    for body in texts:
        for token, suffix in NUMBER.findall(without_names(body, names)):
            try:
                value = Decimal(normal(token))
            except InvalidOperation:
                bad.append(token)
                continue
            unit = suffix.strip().lower()
            if '.' in token or unit in ('%', 'point', 'points', 'pts'):
                ok = value in figures
            elif unit in ('st', 'nd', 'rd', 'th', 'place', 'places'):
                ok = value in counts
            else:
                ok = value in counts or value in figures
            if not ok:
                bad.append(f'{token}{suffix}'.strip())
    return bad


def recent_coverage(root, competition, now):
    """Lead lines that wire stories filed in the past 36 hours already reported, by lead ID."""
    covered = {}
    directory = Path(root) / 'content/news/wire-evidence'
    if not directory.exists():
        return covered
    for path in directory.glob('*.json'):
        proof = load(path)
        if proof.get('competition') != competition or now - stamp(proof['publishedAt']) > COVERED_WINDOW:
            continue
        for item in proof.get('leads', []):
            covered.setdefault(item['id'], set()).add(item['text'])
    return covered


def visuals_for(people_records, person_ids):
    pictures = []
    for record in people_records:
        if record['id'] not in person_ids:
            continue
        if record.get('portrait'):
            pictures.append({'src': record['portrait']['src'], 'alt': record['portrait']['alt'], 'href': f"/news/people/{record['id']}", 'personId': record['id']})
        for card in record['hallOfFame']:
            if card.get('image') and not any(item['src'] == card['image']['src'] for item in pictures):
                pictures.append({'src': card['image']['src'], 'alt': card['image']['alt'], 'href': card['path'], 'personId': record['id']})
    return pictures


def board_brief(board, competition, actual_now, root):
    fetched = stamp(board['fetched'])
    if fetched > actual_now or actual_now - fetched > FRESH:
        raise ValueError('the latest saved board is missing, in the future or over 90 minutes old')
    board_source = f'board-{competition}'
    rows = team_rows(board)
    notebook_path = Path(root) / 'content/news/competitors.json'
    notebook = {record['id'] for record in load(notebook_path)} if notebook_path.exists() else set()
    # The editions' source builders take an article-shaped item; give them this board's teams.
    item = {'articleBase': {'sources': [{'id': board_source, 'title': f"{board['label']} public leaderboard: saved board and the past day's changes",
                                         'url': BOARD_PAGE[competition], 'accessedAt': iso(actual_now)}],
                            'dataAsOf': board['fetched'], 'stats': [{'teamId': tid} for tid in rows]},
            'evidence': {'observations': {tid: {'name': row['name'], 'members': row['members'], 'observedAt': board['fetched']} for tid, row in rows.items()}}}
    add_notebook_sources(item, competition, actual_now, root)
    add_social_sources(item, competition, actual_now, root)
    add_people_sources(item, competition, actual_now, root)
    leads = board_leads(board, board_source)
    people = item['evidence']['people']
    by_team = {}
    for person in people:
        for tid in person['teamIds']:
            by_team.setdefault(tid, []).append(person)
    for entry in leads:
        for tid in entry['teamIds']:
            for person in by_team.get(tid, []):
                if person['id'] not in entry['personIds']:
                    entry['personIds'].append(person['id'])
                    entry['sourceIds'] += [source['sourceId'] for source in person['sources']]
    # A verified person on a moving team is a lead of their own, with honors and roster sources.
    moving = {row['teamId'] for key in ('gainers', 'climbers', 'newcomers', 'intoGold', 'outOfGold') for row in board[key]} | {board['leader']['row']['teamId']}
    records = {record['id']: record for record in read_people(root)}
    for person in people:
        teams = [rows[tid] for tid in person['teamIds'] if tid in moving or rows[tid]['rank'] <= 25]
        if not teams:
            continue
        name = short_name(person['name'])
        honors = '; '.join(card['label'] for card in records[person['id']]['hallOfFame'][:2])
        # An entry under the person's own name reads as the person; a team is named as a roster.
        own = [f"{ordinal(row['rank'])} at {fig(row['score'])}{change(row)}" for row in teams if row['name'] == name]
        rosters = [f"{row['name']} ({ordinal(row['rank'])} at {fig(row['score'])}{change(row)})" for row in teams if row['name'] != name]
        line = f"{name}{f' ({honors})' if honors else ''} " + '; '.join(
            ([f"is {', '.join(own)} under their own name"] if own else []) + ([f"is on the roster of {', '.join(rosters)}"] if rosters else [])) + '.'
        leads.append({'id': f"person-{person['id']}", 'kind': 'person', 'text': line, 'teamIds': [row['teamId'] for row in teams],
                      'personIds': [person['id']], 'sourceIds': [board_source] + [source['sourceId'] for source in person['sources']]})
    for post in item['evidence']['socialPosts']:
        if actual_now - stamp(post['postedAt']) > timedelta(hours=48):
            continue
        leads.append({'id': f"post-{post['id']}", 'kind': 'post', 'text': f"{post['authorName']} (@{post['author']}) posted on {stamp(post['postedAt']).astimezone(ET):%B} {stamp(post['postedAt']).astimezone(ET).day}: {post['summary']}",
                      'teamIds': [], 'personIds': [pid for pid in post['personIds'] if pid in records], 'sourceIds': [post['sourceId']]})
    covered = recent_coverage(root, competition, actual_now)
    for entry in leads:
        entry['covered'] = entry['text'] in covered.get(entry['id'], set())
    named = {pid for entry in leads for pid in entry['personIds']}
    return {'status': 'ready', 'competition': competition, 'label': board['label'], 'dataAsOf': board['fetched'], 'since': board['since'],
            'sources': item['articleBase']['sources'], 'leads': leads,
            'teams': {tid: {'name': row['name'], 'rank': row['rank'], 'score': row['score'], 'members': row['members'],
                            'notebook': f'/news/competitors/{competition}-{tid}' if f'{competition}-{tid}' in notebook else None}
                      for tid, row in rows.items()},
            'people': [{'id': person['id'], 'name': person['name'], 'teamIds': person['teamIds'], 'sources': person['sources']} for person in people if person['id'] in named],
            'visuals': visuals_for(records.values(), named),
            'numbers': allowed_numbers(board, leads),
            'names': sorted({row['name'] for row in rows.values()} | {name for person in records.values() for name in (person['name'], short_name(person['name']))}
                            | {post['authorName'] for post in item['evidence']['socialPosts']} | {f"@{post['author']}" for post in item['evidence']['socialPosts']}
                            | {label for record in records.values() for label in (card['label'] for card in record['hallOfFame'])}
                            | {'ARC-AGI-3', 'ARC-AGI-2', 'ARC-3', 'ARC-2'}),
            'board': board}


def prepare(fetcher=fetch, actual_now=None, root=ROOT):
    actual_now = actual_now or datetime.now(UTC)
    result = {'version': 1, 'preparedAt': iso(actual_now), 'sourceUrl': MARKETS_URL, 'boards': {}}
    try:
        markets, sha = fetcher(MARKETS_URL)
        result['sourceSha256'] = sha
    except Exception as error:  # A failed fetch is reported per board below, never invented around.
        markets, result['sourceSha256'] = {'boards': {}}, None
        result['fetchError'] = str(error)
    for competition in ('arc-3', 'arc-2'):
        board = markets.get('boards', {}).get(competition)
        try:
            if not board:
                raise ValueError(result.get('fetchError') or 'no saved board in the market digest')
            result['boards'][competition] = board_brief(board, competition, actual_now, root)
        except Exception as error:
            result['boards'][competition] = {'status': 'error', 'error': str(error)}
    result['sha256'] = digest(result)
    return result


def validate(story, brief, now=None):
    now = now or datetime.now(UTC)
    expected = dict(brief)
    if expected.pop('sha256', None) != digest(expected):
        raise ValueError('brief checksum mismatch; prepare a new brief instead of editing it')
    if now - stamp(brief['preparedAt']) > BRIEF_LIFE:
        raise ValueError('brief is over 3 hours old; prepare a fresh one')
    if not isinstance(story, dict) or set(story) - STORY_FIELDS or not REQUIRED <= story.keys():
        raise ValueError(f'story fields must be {sorted(REQUIRED)} plus optional visual')
    board = brief['boards'].get(story['competition'])
    if not board or board['status'] != 'ready':
        raise ValueError('story competition has no ready board in the brief')
    if not isinstance(story['slug'], str) or not SLUG.fullmatch(story['slug']):
        raise ValueError('slug must be 1-60 lowercase letters, digits or hyphens')
    leads = {entry['id']: entry for entry in board['leads']}
    if not isinstance(story['leadIds'], list) or not 1 <= len(story['leadIds']) <= 4 or any(lid not in leads for lid in story['leadIds']):
        raise ValueError('leadIds must name 1-4 leads from this board')
    text(story['headline'], 'headline', 160)
    sections = story['sections']
    if not isinstance(sections, list) or not 1 <= len(sections) <= 3:
        raise ValueError('a wire story has 1-3 sections')
    source_ids = {source['id'] for source in board['sources']}
    for section in sections:
        if not isinstance(section, dict) or set(section) - {'heading', 'text', 'sourceIds'}:
            raise ValueError('invalid section fields')
        text(section.get('text'), 'section text', 900)
        if 'heading' in section:
            text(section['heading'], 'section heading', 120)
        refs = section.get('sourceIds')
        if not isinstance(refs, list) or not refs or any(ref not in source_ids for ref in refs):
            raise ValueError('every section cites sources from this board\'s brief')
    if not any(f"board-{story['competition']}" in section['sourceIds'] for section in sections):
        raise ValueError('a wire story cites the board')
    if not isinstance(story['teamIds'], list) or len(story['teamIds']) > 6 or any(tid not in board['teams'] for tid in story['teamIds']) or len(set(story['teamIds'])) != len(story['teamIds']):
        raise ValueError('teamIds must be up to 6 unique teams from this board\'s brief')
    people = {person['id'] for person in board['people']}
    if not isinstance(story['personIds'], list) or len(story['personIds']) > 3 or any(pid not in people for pid in story['personIds']):
        raise ValueError('personIds must be up to 3 verified people offered in this brief')
    if 'visual' in story:
        offered = [{key: picture[key] for key in ('src', 'alt', 'href')} for picture in board['visuals']]
        if story['visual'] not in offered:
            raise ValueError('visual must be one of the pictures this brief offers, copied exactly')
    prose = [story['headline']] + [section['text'] for section in sections] + [section.get('heading', '') for section in sections]
    for body in (without_names(item, board['names']) for item in prose):
        if SPELLED.search(body):
            raise ValueError(f'write figures of ten and up in digits: "{SPELLED.search(body).group(0)}"')
        if OVERCLAIM.search(body):
            raise ValueError(f'the board cannot support "{OVERCLAIM.search(body).group(0)}"; public standings are provisional')
    # Only the leads the story cites, the teams it lists and the board-wide figures count.
    allowed = allowed_numbers(board['board'], [leads[lid] for lid in story['leadIds']], set(story['teamIds']))
    bad = unsupported_numbers(prose, allowed, board['names'])
    if bad:
        raise ValueError(f'figures not in the cited leads, the listed teams or the board-wide figures: {", ".join(dict.fromkeys(bad))}')
    return board


def publish(story, brief, root=ROOT, now=None):
    now = now or datetime.now(UTC)
    board = validate(story, brief, now)
    local = now.astimezone(ET)
    story_id = f"{local:%Y-%m-%d-%H%M}-{story['competition']}-{story['slug']}"
    if not WIRE_ID.fullmatch(story_id):
        raise ValueError('invalid wire story ID')
    cited = {ref for section in story['sections'] for ref in section['sourceIds']}
    published = {'id': story_id, 'competition': story['competition'], 'publishedAt': iso(now), 'dataAsOf': board['dataAsOf'],
                 'since': board['since'], 'headline': story['headline'],
                 'sections': [{key: section[key] for key in ('heading', 'text', 'sourceIds') if key in section} for section in story['sections']],
                 'sources': [source for source in board['sources'] if source['id'] in cited],
                 'teamIds': story['teamIds'], 'personIds': story['personIds'], 'generatedBy': 'gpt-6-luna'}
    if 'visual' in story:
        published['visual'] = story['visual']
        if not (Path(root) / 'client/public' / story['visual']['src'].lstrip('/')).is_file():
            raise ValueError('the chosen picture is missing from the public assets')
    for source in published['sources']:
        web_source(source['url'])
        contract_stamp(source['accessedAt'])
    proof = {'storyId': story_id, 'competition': story['competition'], 'publishedAt': iso(now), 'briefSha256': brief['sha256'],
             'sourceUrl': brief['sourceUrl'], 'sourceSha256': brief.get('sourceSha256'), 'preparedAt': brief['preparedAt'],
             'leads': [entry for entry in board['leads'] if entry['id'] in story['leadIds']], 'board': board['board']}
    directory = Path(root) / 'content/news'
    targets = ((directory / 'wire' / f'{story_id}.json', published), (directory / 'wire-evidence' / f'{story_id}.json', proof))
    for target, _ in targets:
        if target.exists():
            raise ValueError(f'immutable wire conflict: {target}; choose another slug')
    for target, value in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(encoded(value))
    return targets[0][0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare')
    prep.add_argument('--output', required=True)
    for name in ('validate', 'publish'):
        command = commands.add_parser(name)
        command.add_argument('--story', required=True)
        command.add_argument('--brief', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            result = prepare()
            write(args.output, result)
            print(json.dumps({competition: board['status'] for competition, board in result['boards'].items()}))
            return 0 if any(board['status'] == 'ready' for board in result['boards'].values()) else 2
        story, brief = load(args.story), load(args.brief)
        if args.command == 'validate':
            validate(story, brief)
            print(f"valid: {story['competition']} {story['slug']}")
        else:
            print(publish(story, brief))
        return 0
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'newsroom_wire: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
