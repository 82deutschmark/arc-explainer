#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 Medium
# Date: 31-October-2026
# PURPOSE: Keeps the ARC Daily Digest Weekend Magazine (client/public/specials/weekend*.html) current without hand-editing
# HTML. The pages are hand-written; the volatile parts sit between <!-- BEGIN:name --> and <!-- END:name --> markers and
# are regenerated here from the public ARC-2 and ARC-3 boards (top-ten tables with the time each score landed, the field
# guide, the Who's Who directory, the bell-time conversions, the medal lines and the "from the desk" list). The same
# command writes the small JSON files the pages read live (data/scoreboard.json), and three one-line commands handle
# last-minute shakeups: `breaking` (red banner), `clear-breaking`, and `ticker` (a dated news line). `check` is the
# pre-push gate: no bare web addresses, no "editorial illustration / fantasy" disclaimers, every local link and image
# exists, every top-ten table has ten rows. Nothing here posts anywhere; it only writes files under client/public.
# Usage: python3.13 scripts/weekend_magazine.py refresh|check|breaking|clear-breaking|ticker  (see docs/newsroom/WEEKEND_MAGAZINE.md)
# SRP/DRY check: Pass - reads the existing ledgers (people.json, cards.json, content/news/*) and the board API; the live
# scoreboard maths in client/public/specials/weekend/assets/magazine.js mirrors top_rows / reached_time / pretty_et below.
import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'client/public'
SPECIALS = PUBLIC / 'specials'
WEEKEND = SPECIALS / 'weekend'
DATA = WEEKEND / 'data'
NEWS = ROOT / 'content/news'
ET = ZoneInfo('America/New_York')
SITE = 'https://arc.markbarney.net'
BOARD_URL = SITE + '/api/kaggle/arc-prize-2026-arc-agi-{c}/board'
CONTESTS = {'2': 'ARC-2', '3': 'ARC-3'}
DEADLINE = datetime(2026, 11, 2, 23, 59, tzinfo=timezone.utc)   # Kaggle: all deadlines are 11:59 PM UTC
GREEN = {'nvbanana', 'NVARC3'}                                   # NVIDIA entries
OURS = {'Team Turducken', 'ARC Mutants'}                        # the head editor's own entries
PAGES = [SPECIALS / 'weekend.html'] + sorted(WEEKEND.glob('*.html'))
# Phrases the Boss ruled out of captions and copy (ART_DESK.md, 29 and 31 October 2026).
FORBIDDEN = ('editorial illustration', 'editorial fantasy', 'editorial artwork', 'ai-generated', 'not anyone', 'not anybody',
             'sporting fantasy', 'characters and props')
BARE_URL = re.compile(r'https?://', re.I)


# ----------------------------------------------------------------------------- boards

def load_board(contest, offline=None):
    """The board document: latest.rows, latest.fetched, latest.medalRanks, events. `offline` is a folder holding boardN.json."""
    if offline:
        return json.loads((Path(offline) / f'board{contest}.json').read_text())
    with urllib.request.urlopen(BOARD_URL.format(c=contest), timeout=60) as response:
        return json.load(response)


def parse_utc(text):
    return datetime.fromisoformat(text.replace('Z', '+00:00')).astimezone(timezone.utc)


def pretty_et(when, now):
    """'Today 2:58 pm', 'Thu 2:52 pm' within the last week, otherwise 'Oct 9, 1:21 am' (Eastern)."""
    local, today = when.astimezone(ET), now.astimezone(ET)
    clock = local.strftime('%-I:%M %p').lower()
    days = (today.date() - local.date()).days
    if days == 0:
        return f'Today {clock}'
    if days < 7:
        return f'{local.strftime("%a")} {clock}'
    return f'{local.strftime("%b")} {local.day}, {clock}'


def stamp_et(when):
    return when.astimezone(ET).strftime('%a %-I:%M %p').replace(' AM', ' am').replace(' PM', ' pm') + ' ET'


def reached_time(board, row):
    """When our tracker first saw the team's current score: the last event that landed on it."""
    hits = [e for e in board.get('events') or [] if e['id'] == row[1] and abs(e['to'] - row[4]) < 1e-9]
    return parse_utc(hits[-1]['t']) if hits else None


def top_rows(board, count=10):
    rows = []
    for row in board['latest']['rows'][:count]:
        rows.append({'rank': row[0], 'teamId': row[1], 'name': row[2], 'score': row[4], 'members': row[6].split(','),
                     'prevRank': row[7], 'prevScore': row[8], 'reached': reached_time(board, row)})
    return rows


def team_phrase(members):
    return 'one-person team' if len(members) == 1 else f'{len(members)} accounts'


def board_table(label, board, count=10):
    now = parse_utc(board['latest']['fetched'])
    out = [f'<table class="board" data-fetched="{board["latest"]["fetched"]}"><caption>{html.escape(label)} · top ten · as of {stamp_et(now)}</caption>']
    for r in top_rows(board, count):
        cls = ' class="nv"' if r['name'] in GREEN else (' class="us"' if r['name'] in OURS else '')
        move = ''
        if r['rank'] < r['prevRank']:
            move = f' <span class="up">▲{r["prevRank"] - r["rank"]}</span>'
        elif r['rank'] > r['prevRank']:
            move = f' <span class="down">▼{r["rank"] - r["prevRank"]}</span>'
        gain = f' <span class="gain">+{r["score"] - r["prevScore"]:.2f}</span>' if r['score'] - r['prevScore'] > 0.004 else ''
        when = f'reached {pretty_et(r["reached"], now)} ET' if r['reached'] else 'on the board before our tracker began'
        out.append(f'<tr{cls}><td>{r["rank"]}</td><td>{html.escape(r["name"])}{move}<small>{team_phrase(r["members"])} · {when}</small></td>'
                   f'<td><b>{r["score"]:.2f}</b>{gain}</td></tr>')
    out.append('</table>')
    return ''.join(out)


# ----------------------------------------------------------------------------- ledgers

def read_json(path):
    return json.loads(Path(path).read_text())


class Ledger:
    """People (Kaggle and X handles) and ARC Prize cards, indexed for the regions below."""

    def __init__(self):
        self.people = read_json(NEWS / 'people.json')
        cards = read_json(NEWS / 'cards.json')['cards']
        self.person_cards = {c['personId']: c['id'] for c in cards if c['kind'] == 'person'}
        self.team_cards = {(e['competition'], e['teamId']): c['id'] for c in cards if c['kind'] == 'team' for e in c['entries']}
        self.by_handle = {}
        for person in self.people:
            for account in person['accounts']:
                if account['platform'] == 'kaggle':
                    self.by_handle[account['handle'].lower()] = person

    def name(self, handle):
        person = self.by_handle.get(handle.lower())
        return re.sub(r'\s*\([^)]*\)\s*$', '', person['name']) if person else None


def member_line(ledger, members):
    names = [ledger.name(m) or m for m in members]
    return ', '.join(names[:-1]) + (' and ' if len(names) > 1 else '') + names[-1] if names else ''


# ----------------------------------------------------------------------------- regions

# One curated line per team, keyed by team name ('*' for any contest, '2'/'3' to add a contest-specific line). Every claim
# is from a public Kaggle profile, the board or the newsroom ledgers (checked 30-31 October). A team without a line gets a
# plain roster line, so a board that shifts cannot print a wrong blurb. Names of people with no stated pronouns stay neutral.
NOTES = {
    'Tufa Labs': {'*': 'The lab at the top of both boards. Jeroen Cottaar (a Grandmaster, sixth in the world), Isaiah Pressman (a Grandmaster, 14th, winner of Orbit Wars), Dries Smit (lead developer of the Tufa agent that won last year’s ARC-AGI-3 preview) and Stefano Viel.',
                  '3': 'In ARC-3 the Tufa roster grows to six accounts: those four plus dlorah and infinitecreativity.'},
    'Yi-Chia Chen @ Fields Model': {'*': 'A one-person team with two rabbits for an avatar, near the top of both boards. A Kaggle Competitions Master with a gold medal at Eedi (third of 1,446 teams).'},
    'nvbanana': {'*': 'NVIDIA’s two-person ARC-2 entry: CPMP (29 competition golds, peak world rank of sixth) and Darragh Hanley (28 golds, peak rank of fourth).'},
    'NVARC3': {'*': 'NVIDIA’s seven-account ARC-3 squad: CPMP, Darragh Hanley, Ivan Sorokin, Giba (a former world No. 1) and the newcomers Elad Sarafian, Gal Kaplun and Yeyin Zhu.'},
    'Domdolus Tolus': {'*': 'Five students from Tokyo who won gold at NVIDIA’s Nemotron challenge (fifth of 4,185). Also entered in ARC-3.'},
    'Sakayori Lab': {'*': 'A two-account lab (hongori and quarkliu) that jumped from 20th to fifth in a single day, according to our wire desk on Saturday morning.'},
    'rabbithole': {'*': 'A five-account squad: cookizesong, jiaxibi0220, xiezejian, yuhuake240506 and zhangsongxin.'},
    'Majkel1337': {'*': 'A one-person team and a Kaggle Master, 290th in the world, with golds in the Pokémon TCG AI Battle Challenge and Kaggriculture. Plays both contests.'},
    'Ravi Teja Chilakala': {'*': 'A one-person entry (Kaggle account carriem7).'},
    'V | A | M': {'*': 'Chan Kha Vu’s team: up 26 points in five days, from 50 to 76.'},
    'faster machine is all you need': {'*': 'The one-person team of xz: a Kaggle Master, 15th in the world and 10th at best, and winner of the AI Agent Security contest (first of 4,186).'},
    'Team Turducken': {'*': 'That’s us: the head editor’s team, with Son Pham and five others. Same zeros as everyone else.'},
    'the last dance 🕺': {'*': 'Four accounts: Mykyta Ielanskyi (a research scientist in Linz, Austria), Florian Sestak, Lukas Aichberger and the nameless gklambauer.'},
    'yktori': {'*': 'A one-person team and a Kaggle Expert with a silver medal for Drawing with LLMs.'},
    'mtg': {'*': 'The rookie: a one-person team whose Kaggle account dates only from March 2026. Plays both contests.'},
    'Grigoriy Zatravkin & co': {'*': 'Four accounts, including a Peking University student and Dongming Sheng.'},
    '復活の混テキスト': {'*': 'An eight-account Japanese all-star squad with Kaggle Masters ISAKA Tsuyoshi (78th in the world), yuto083 (54th) and re (88th), a Nemotron challenge winner.'},
}


def note_for(name, contest):
    entry = NOTES.get(name, {})
    return ' '.join(x for x in (entry.get('*'), entry.get(contest)) if x)


def field_region(contest, board, ledger):
    now = parse_utc(board['latest']['fetched'])
    items = []
    for r in top_rows(board):
        cls = 'team nv' if r['name'] in GREEN else ('team us' if r['name'] in OURS else 'team')
        card = ledger.team_cards.get((f'arc-{contest}', r['teamId']))
        who = member_line(ledger, r['members'])
        text = note_for(r['name'], contest) or f'{team_phrase(r["members"]).capitalize()}.'
        gained = r['prevRank'] - r['rank']
        move = f' Up {gained} {"place" if gained == 1 else "places"} since the last 6 pm Eastern cutoff.' if gained > 0 else ''
        when = f'reached {pretty_et(r["reached"], now)} ET' if r['reached'] else 'on the board before our tracker began'
        links = f'<a class="card" href="/news/cards/{card}">ARC Prize card</a>' if card else ''
        items.append(f'<li class="{cls}"><div class="n">{r["rank"]}</div><div><h3>{html.escape(r["name"])}</h3>'
                     f'<div class="meta">{r["score"]:.2f} points · {when}</div><p>{html.escape(text + move)}</p>'
                     f'<p class="who">Playing: {html.escape(who)}.</p>{links}</div></li>')
    return '<ul class="teams">' + ''.join(items) + '</ul>'


def who_region(boards, ledger):
    entries = {}
    for contest, board in boards.items():
        for row in board['latest']['rows']:
            for handle in row[6].split(','):
                entries.setdefault((contest, handle.lower()), (row[0], row[2], row[4]))
    people = []
    for person in ledger.people:
        handles = [a['handle'] for a in person['accounts'] if a['platform'] == 'kaggle']
        if not handles:
            continue
        xs = [a['handle'] for a in person['accounts'] if a['platform'] == 'x']
        cells = {}
        for contest in boards:
            found = [entries[(contest, h.lower())] for h in handles if (contest, h.lower()) in entries]
            cells[contest] = min(found) if found else None
        best = min([c[0] for c in cells.values() if c] or [10 ** 6])
        people.append((best, person['name'], person, handles, xs, cells))
    rows = []
    for best, name, person, handles, xs, cells in sorted(people, key=lambda t: (t[0], t[1].lower())):
        kaggle = ', '.join(f'<a href="https://www.kaggle.com/{h}">{html.escape(h)}</a>' for h in handles)
        x = ', '.join(f'<a href="https://x.com/{h}">@{html.escape(h)}</a>' for h in xs) or '—'
        card = ledger.person_cards.get(person['id'])
        label = html.escape(re.sub(r'\s*\([^)]*\)\s*$', '', name))
        name_cell = f'<a href="/news/cards/{card}">{label}</a>' if card else label
        cols = []
        for contest in boards:
            c = cells[contest]
            cols.append(f'<td>#{c[0]} {html.escape(c[1])}<small>{c[2]:.2f}</small></td>' if c else '<td>—</td>')
        rows.append(f'<tr><td>{name_cell}</td><td>{kaggle}</td><td>{x}</td>{"".join(cols)}</tr>')
    return ''.join(rows)


def zones_region():
    cities = [('New York', 'America/New_York'), ('Los Angeles', 'America/Los_Angeles'), ('London', 'Europe/London'),
              ('Paris and Berlin', 'Europe/Paris'), ('Kolkata', 'Asia/Kolkata'), ('Ho Chi Minh City', 'Asia/Ho_Chi_Minh'),
              ('Tokyo', 'Asia/Tokyo')]
    rows = []
    for city, zone in cities:
        local = DEADLINE.astimezone(ZoneInfo(zone))
        clock = f'{local:%a} {local.hour % 12 or 12}:{local:%M} {"am" if local.hour < 12 else "pm"}'
        offset = local.utcoffset().total_seconds() / 3600
        tz = f'UTC{int(offset):+d}' if offset == int(offset) else f'UTC{offset:+.1f}'
        rows.append(f'<tr><td>{city}</td><td>{clock} ({tz})</td></tr>')
    return '<table class="zones"><tr><td>UTC</td><td>Mon 11:59 pm (the official time)</td></tr>' + ''.join(rows) + '</table>'


def medals_region(boards):
    parts = []
    for contest, board in boards.items():
        m, n = board['latest']['medalRanks'], len(board['latest']['rows'])
        parts.append(f'ARC-{contest}: {n:,} teams, so gold would run to place {m["gold"]}, silver to {m["silver"]} and bronze to {m["bronze"]}')
    return '<p>' + '; '.join(parts) + '. Medals follow Kaggle’s standard bands for the final team count and are decided on the private board, not today’s public one.</p>'


def feed_region(now, limit=10):
    items = []
    for kind, folder in (('dispatch', 'dispatches'), ('wire', 'wire'), ('article', 'articles')):
        for path in (NEWS / folder).glob('*.json'):
            d = read_json(path)
            url = {'dispatch': f'/news#{d["id"]}', 'wire': f'/news/wire#{d["id"]}', 'article': f'/news/{d["id"]}'}[kind]
            items.append((parse_utc(d['publishedAt']), d['headline'], url))
    items.sort(reverse=True)
    out = [f'<li><time>{pretty_et(when, now)} ET</time><div><a href="{url}">{html.escape(headline)}</a></div></li>' for when, headline, url in items[:limit]]
    return '<ul class="ticker">' + ''.join(out) + '</ul>'


def scoreboard_region(boards):
    slots = ''.join(f'<div data-contest="{c}" data-label="ARC-{c}">{board_table(f"ARC-{c}", boards[c])}</div>' for c in sorted(boards))
    return (f'<div class="boards" id="scoreboard" data-green="{",".join(sorted(GREEN))}" data-ours="{",".join(sorted(OURS))}">{slots}</div>')


# ----------------------------------------------------------------------------- refresh

def region_pattern(name):
    return re.compile(rf'(<!-- BEGIN:{re.escape(name)} -->)(.*?)(<!-- END:{re.escape(name)} -->)', re.S)


def replace_region(text, name, body):
    pattern = region_pattern(name)
    if len(pattern.findall(text)) != 1:
        raise ValueError(f'region {name!r} must appear exactly once')
    return pattern.sub(lambda m: m.group(1) + body + m.group(3), text)


def build_regions(boards, ledger, now):
    newest = max(parse_utc(b['latest']['fetched']) for b in boards.values())
    return {
        'scoreboard': scoreboard_region(boards),
        'field-arc2': field_region('2', boards['2'], ledger),
        'field-arc3': field_region('3', boards['3'], ledger),
        'who-rows': who_region(boards, ledger),
        'zones': zones_region(),
        'medals': medals_region(boards),
        'feed': feed_region(now),
        'asof': stamp_et(newest),
    }


def refresh(offline=None, now=None):
    now = now or datetime.now(timezone.utc)
    boards = {c: load_board(c, offline) for c in CONTESTS}
    ledger = Ledger()
    regions = build_regions(boards, ledger, now)
    touched = []
    for page in PAGES:
        text = page.read_text()
        new = text
        for name, body in regions.items():
            if region_pattern(name).search(new):
                new = replace_region(new, name, body)
        if new != text:
            page.write_text(new)
            touched.append(page.name)
    snapshot = {'asOf': max(b['latest']['fetched'] for b in boards.values()),
                'contests': {f'arc-{c}': {'teams': len(b['latest']['rows']), 'medalRanks': b['latest']['medalRanks'],
                                          'top': [{**{k: v for k, v in r.items() if k not in ('reached', 'members')},
                                                   'members': len(r['members']),
                                                   'reached': r['reached'].strftime('%Y-%m-%dT%H:%M:%SZ') if r['reached'] else None}
                                                  for r in top_rows(b)]} for c, b in boards.items()}}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'scoreboard.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    return touched, snapshot['asOf']


# ----------------------------------------------------------------------------- shakeup commands

def now_iso():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def clean_line(text, limit):
    text = ' '.join(text.split())
    if not text or len(text) > limit:
        raise ValueError(f'text must be 1 to {limit} characters')
    if BARE_URL.search(text):
        raise ValueError('no bare web addresses in text: pass --link-url and --link-text instead')
    return text


def link_obj(url, text):
    if not url:
        return None
    if not (url.startswith('/') or url.startswith('https://')):
        raise ValueError('link url must start with / or https://')
    return {'url': url, 'text': clean_line(text or 'Read more', 40)}


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def set_breaking(headline, text=None, url=None, link_text=None, kicker='Breaking', at=None):
    body = {'active': True, 'kicker': clean_line(kicker, 24), 'headline': clean_line(headline, 120), 'at': at or now_iso()}
    if text:
        body['text'] = clean_line(text, 280)
    link = link_obj(url, link_text)
    if link:
        body['link'] = link
    write_json(DATA / 'breaking.json', body)
    return body


def clear_breaking():
    write_json(DATA / 'breaking.json', {'active': False})


def add_ticker(text, kicker=None, url=None, link_text=None, at=None, keep=40):
    path = DATA / 'ticker.json'
    items = read_json(path)['items'] if path.exists() else []
    item = {'at': at or now_iso(), 'text': clean_line(text, 280)}
    if kicker:
        item['kicker'] = clean_line(kicker, 40)
    link = link_obj(url, link_text)
    if link:
        item['link'] = link
    items = sorted(items + [item], key=lambda i: i['at'], reverse=True)[:keep]
    write_json(path, {'items': items})
    return item


# ----------------------------------------------------------------------------- check

def visible_text(page_html):
    stripped = re.sub(r'<(script|style)\b.*?</\1>|<!--.*?-->', ' ', page_html, flags=re.S | re.I)
    return html.unescape(re.sub(r'<[^>]+>', ' ', stripped))


def check(pages=None):
    """Returns a list of problems; empty means the magazine is safe to push."""
    problems = []
    pages = pages or PAGES + [SPECIALS / '2026-10-31-saturday-special.html']
    for page in pages:
        if not page.exists():
            problems.append(f'{page.name}: missing')
            continue
        raw = page.read_text()
        text = visible_text(raw)
        if BARE_URL.search(text):
            problems.append(f'{page.name}: bare web address in visible text')
        low = text.lower() + ' ' + ' '.join(re.findall(r'alt="([^"]*)"', raw)).lower()
        for phrase in FORBIDDEN:
            if phrase in low:
                problems.append(f'{page.name}: forbidden phrase {phrase!r}')
        for img in re.findall(r'<img\b[^>]*>', raw):
            if 'alt=' not in img:
                problems.append(f'{page.name}: image without alt text')
        for ref in re.findall(r'(?:href|src)="([^"#?]+)', raw):
            if ref.startswith('/specials/') or ref.startswith('/news-images/'):
                if not (PUBLIC / ref.lstrip('/')).exists():
                    problems.append(f'{page.name}: missing local file {ref}')
        for contest in ('2', '3'):
            tables = re.findall(rf'<div data-contest="{contest}"[^>]*>(.*?)</div>', raw, re.S)
            for table in tables:
                if len(re.findall(r'<tr', table)) != 10:
                    problems.append(f'{page.name}: ARC-{contest} scoreboard does not have ten rows')
    for name in ('breaking.json', 'ticker.json', 'scoreboard.json'):
        path = DATA / name
        if not path.exists():
            problems.append(f'data/{name}: missing')
            continue
        try:
            data = read_json(path)
        except ValueError as error:
            problems.append(f'data/{name}: {error}')
            continue
        if name == 'ticker.json':
            for item in data.get('items', []):
                if BARE_URL.search(item.get('text', '')) or BARE_URL.search(item.get('kicker', '')):
                    problems.append('data/ticker.json: bare web address in a ticker line')
        if name == 'breaking.json' and data.get('active') and BARE_URL.search(json.dumps({k: v for k, v in data.items() if k != 'link'})):
            problems.append('data/breaking.json: bare web address in the banner')
    return problems


# ----------------------------------------------------------------------------- command line

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0] if __doc__ else None)
    sub = parser.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('refresh', help='rebuild the volatile regions and data/scoreboard.json from the live boards, then check')
    r.add_argument('--offline', help='folder with board2.json and board3.json instead of the live API')
    sub.add_parser('check', help='the pre-push gate')
    b = sub.add_parser('breaking', help='turn on the red BREAKING bar on every weekend page')
    b.add_argument('--headline', required=True)
    b.add_argument('--text')
    b.add_argument('--link-url')
    b.add_argument('--link-text')
    b.add_argument('--kicker', default='Breaking')
    b.add_argument('--at', help='ISO time; defaults to now')
    sub.add_parser('clear-breaking', help='turn the red bar off')
    t = sub.add_parser('ticker', help='add a dated line to the latest-news ticker')
    t.add_argument('--text', required=True)
    t.add_argument('--kicker')
    t.add_argument('--link-url')
    t.add_argument('--link-text')
    t.add_argument('--at', help='ISO time; defaults to now')
    args = parser.parse_args(argv)
    if args.cmd == 'refresh':
        touched, as_of = refresh(args.offline)
        print(f'refreshed {len(touched)} page(s): {", ".join(touched) or "none changed"}; boards as of {as_of}')
    elif args.cmd == 'breaking':
        print(json.dumps(set_breaking(args.headline, args.text, args.link_url, args.link_text, args.kicker, args.at), ensure_ascii=False))
    elif args.cmd == 'clear-breaking':
        clear_breaking()
        print('breaking bar off')
    elif args.cmd == 'ticker':
        print(json.dumps(add_ticker(args.text, args.kicker, args.link_url, args.link_text, args.at), ensure_ascii=False))
    problems = check() if args.cmd in ('refresh', 'check', 'breaking', 'clear-breaking', 'ticker') else []
    for problem in problems:
        print('PROBLEM:', problem)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
