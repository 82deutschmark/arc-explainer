#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex; Claude Opus 5.5
# Date: 2026-10-09
# PURPOSE: Validate persistent public identities and preserve sourced roster observations
# across competition teams. Called by newsroom preparation/publication; no model calls.
# 09-Oct-2026 (Claude Opus 5.5): optional person portraits, and the `portrait` command that
# saves the picture from a person's verified Kaggle profile into
# client/public/news-images/people/ (the only network call here; see docs/newsroom/VISUALS.md).
# SRP/DRY check: Pass — reuses newsroom contract validators and the existing competitor notebook;
# server/services/news/newsStore.ts applies the same portrait rules when the site reads the ledger.
import argparse
import copy
import io
from datetime import datetime
import re
import urllib.request
from pathlib import Path
from newsroom import ROOT, UTC, iso, load, write, text, web_source, contract_stamp

PERSON_FIELDS = {'id', 'name', 'accounts', 'facts', 'memberships', 'hallOfFame'}
HALL_OF_FAME_ORIGIN = 'https://arc.markbarney.net'
HALL_OF_FAME_ART = r'/[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*\.(?:png|jpe?g)'
PORTRAIT_FILE = r'/news-images/people/[a-z0-9-]+\.(?:webp|png|jpe?g)'
PORTRAIT_FIELDS = {'src', 'alt', 'kind', 'sourceUrl', 'sourceTitle', 'checkedAt'}
# Kaggle serves a member's own picture under a numeric ID; default-thumb.png means no picture.
KAGGLE_AVATAR = re.compile(r'https://storage\.googleapis\.com/kaggle-avatars/(?:thumbnails|images)/(\d+-[a-z]+\.(?:png|jpe?g|gif|webp))(?:\?[^"\s]*)?')
PORTRAIT_PIXELS = 320


def validate_portrait(person):
    portrait = person['portrait']
    if not isinstance(portrait, dict) or set(portrait) != PORTRAIT_FIELDS or not re.fullmatch(PORTRAIT_FILE, portrait['src']):
        raise ValueError('invalid person portrait')
    text(portrait['alt'], 'portrait description', 700)
    text(portrait['sourceTitle'], 'portrait source')
    web_source(portrait['sourceUrl'])
    contract_stamp(portrait['checkedAt'])
    if portrait['kind'] == 'kaggle':
        allowed = {account['url'].lower() for account in person['accounts'] if account['platform'] == 'kaggle'}
        if portrait['sourceUrl'].lower() not in allowed:
            raise ValueError('a Kaggle portrait must come from the person’s verified Kaggle account')
    elif portrait['kind'] == 'hall-of-fame':
        if portrait['sourceUrl'] not in {HALL_OF_FAME_ORIGIN + card['path'] for card in person['hallOfFame']}:
            raise ValueError('a Hall of Fame portrait must come from one of the person’s own cards')
    else:
        raise ValueError('invalid portrait kind')


def portrait_files_exist(people, root=ROOT):
    """Every portrait the ledger names must be a committed public asset."""
    missing = [p['portrait']['src'] for p in people if 'portrait' in p and not (Path(root) / 'client/public' / p['portrait']['src'].lstrip('/')).is_file()]
    if missing:
        raise ValueError(f'portrait files missing from client/public: {", ".join(missing)}')


def validate_people(people):
    if not isinstance(people, list):
        raise ValueError('people.json must be an array')
    ids, accounts = set(), set()
    for person in people:
        if set(person) - {'portrait'} != PERSON_FIELDS:
            raise ValueError('invalid person fields')
        pid = person['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', pid) or pid in ids:
            raise ValueError('invalid or duplicate person identity')
        ids.add(pid)
        text(person['name'], 'person name')
        handles = set()
        if not person['accounts']:
            raise ValueError('person requires a verified account')
        for account in person['accounts']:
            if set(account) != {'platform', 'handle', 'url', 'sourceUrl', 'sourceTitle', 'checkedAt'}:
                raise ValueError('invalid account fields')
            platform, handle = account['platform'], account['handle']
            key = (platform, handle.lower())
            if platform not in ('kaggle', 'x') or not re.fullmatch(r'[A-Za-z0-9_]+', handle) or key in accounts:
                raise ValueError('invalid or shared person account')
            accounts.add(key)
            if platform == 'kaggle':
                handles.add(handle)
            expected = f'https://{"www.kaggle.com" if platform == "kaggle" else "x.com"}/{handle}'
            if account['url'].lower() != expected.lower():
                raise ValueError('account URL does not match handle')
            web_source(account['sourceUrl'])
            text(account['sourceTitle'], 'identity source')
            contract_stamp(account['checkedAt'])
        for fact in person['facts']:
            if set(fact) != {'text', 'sourceUrl', 'sourceTitle', 'checkedAt'}:
                raise ValueError('invalid person fact')
            text(fact['text'], 'person fact')
            web_source(fact['sourceUrl'])
            text(fact['sourceTitle'], 'person fact source')
            contract_stamp(fact['checkedAt'])
        memberships = set()
        for member in person['memberships']:
            if set(member) != {'competition', 'competitionId', 'season', 'teamId', 'teamName', 'memberHandle', 'firstObservedAt', 'lastObservedAt', 'sourceUrl', 'sourceTitle'}:
                raise ValueError('invalid membership fields')
            key = (member['competitionId'], member['teamId'], member['memberHandle'])
            if member['competition'] not in ('arc-2', 'arc-3') or not re.fullmatch(r'\d{4}', member['season']) or not re.fullmatch(r'\d+', member['teamId']) or key in memberships or member['memberHandle'] not in handles:
                raise ValueError('invalid or duplicate membership')
            expected = f"arc-prize-{member['season']}-{member['competition'].replace('arc-', 'arc-agi-')}"
            if member['competitionId'] != expected:
                raise ValueError('membership competition/season mismatch')
            memberships.add(key)
            text(member['teamName'], 'membership team name')
            web_source(member['sourceUrl'])
            text(member['sourceTitle'], 'roster source')
            if contract_stamp(member['firstObservedAt']) > contract_stamp(member['lastObservedAt']):
                raise ValueError('reversed membership dates')
        for card in person['hallOfFame']:
            if set(card) - {'image'} != {'path', 'label', 'sourceUrl', 'sourceTitle', 'checkedAt'} or not re.fullmatch(r'/hall-of-fame(?:#contributor-\d+|/johan-land)?', card['path']):
                raise ValueError('invalid Hall of Fame reference')
            if 'image' in card and (set(card['image']) != {'src', 'alt'} or not re.fullmatch(HALL_OF_FAME_ART, card['image']['src'])):
                raise ValueError('invalid historical artwork')
            if 'image' in card:
                text(card['image']['alt'], 'historical artwork description', 700)
            text(card['label'], 'historical card label')
            web_source(card['sourceUrl'])
            text(card['sourceTitle'], 'historical card source')
            contract_stamp(card['checkedAt'])
        if 'portrait' in person:
            validate_portrait(person)
    return people


def read_people(root):
    path = Path(root) / 'content/news/people.json'
    return validate_people(load(path)) if path.exists() else []


def observed_people(people, competition, season, observations, source_url):
    """Add observations for already verified accounts; never create guessed identities.

    Old memberships remain historical. Absence from a partial board is not a departure.
    """
    result = copy.deepcopy(people)
    competition_id = f"arc-prize-{season}-{competition.replace('arc-', 'arc-agi-')}"
    for person in result:
        handles = {account['handle'] for account in person['accounts'] if account['platform'] == 'kaggle'}
        for team_id, observation in observations.items():
            for handle in handles.intersection(observation['members']):
                found = next((member for member in person['memberships'] if (member['competitionId'], member['teamId'], member['memberHandle']) == (competition_id, team_id, handle)), None)
                when = observation['observedAt']
                if found:
                    found['firstObservedAt'] = min(found['firstObservedAt'], when)
                    if contract_stamp(when) >= contract_stamp(found['lastObservedAt']):
                        found.update(teamName=observation['name'], lastObservedAt=when, sourceUrl=source_url)
                else:
                    person['memberships'].append({'competition': competition, 'competitionId': competition_id, 'season': season, 'teamId': team_id,
                        'teamName': observation['name'], 'memberHandle': handle, 'firstObservedAt': when, 'lastObservedAt': when,
                        'sourceUrl': source_url, 'sourceTitle': f'{competition.upper()} public roster observation'})
    return validate_people(result)


def add_people_sources(item, competition, actual_now, root):
    from newsroom import stamp
    people = read_people(root)
    observations = item['evidence']['observations']
    referenced = {pid for post in item['evidence'].get('socialPosts', []) for pid in post['personIds']}
    selected = []
    for person in people:
        handles = {account['handle'] for account in person['accounts'] if account['platform'] == 'kaggle'}
        team_ids = [tid for tid, observation in observations.items() if handles.intersection(observation['members'])]
        if not team_ids and person['id'] not in referenced:
            continue
        sources = []
        notes = [('identity', index, account['sourceTitle'], account['sourceUrl'], account['checkedAt'], f"Verified {account['platform']} account: {account['handle']}") for index, account in enumerate(person['accounts'])]
        notes += [('fact', index, fact['sourceTitle'], fact['sourceUrl'], fact['checkedAt'], fact['text']) for index, fact in enumerate(person['facts'])]
        notes += [('archive', index, card['sourceTitle'], card['sourceUrl'], card['checkedAt'], card['label']) for index, card in enumerate(person['hallOfFame'])]
        notes += [('roster', index, member['sourceTitle'], member['sourceUrl'], member['lastObservedAt'],
                   f"{member['memberHandle']} observed in {member['teamName']} ({member['competitionId']}, team {member['teamId']}) between {member['firstObservedAt']} and {member['lastObservedAt']}.")
                  for index, member in enumerate(person['memberships'])]
        for kind, index, title, url, checked, value in notes:
            if stamp(checked) > actual_now:
                raise ValueError('person source check is in the future')
            sid = f"person-{person['id']}-{kind}-{index}"
            item['articleBase']['sources'].append({'id': sid, 'title': title, 'url': url, 'accessedAt': checked})
            sources.append({'sourceId': sid, 'text': value})
        selected.append({'id': person['id'], 'name': person['name'], 'teamIds': team_ids, 'memberships': person['memberships'], 'sources': sources})
    item['evidence']['people'] = selected


def kaggle_avatar_url(page, handle):
    """Full-size picture URL from a Kaggle profile page, or None when the member has no picture.

    The page must be the profile of exactly this handle; a default avatar is not a picture.
    """
    username = re.search(r'<meta property="og:username" content="([^"]+)"', page)
    if not username or username.group(1).lower() != handle.lower():
        raise ValueError(f'Kaggle profile page does not belong to {handle}')
    image = re.search(r'<meta name="twitter:image" content="([^"]+)"', page)
    if not image or 'default-thumb' in image.group(1):
        return None
    found = KAGGLE_AVATAR.fullmatch(image.group(1))
    if not found:
        raise ValueError(f'unrecognized Kaggle picture address for {handle}')
    return f'https://storage.googleapis.com/kaggle-avatars/images/{found.group(1)}'


def _get(url, limit):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ARC-Daily-newsroom'}), timeout=30) as response:
        raw = response.read(limit + 1)
    if len(raw) > limit:
        raise ValueError(f'{url} exceeds {limit} bytes')
    return raw


def save_kaggle_portrait(person_id, root=ROOT, fetch=_get, now=None):
    """Give a verified person their Kaggle picture as a portrait, or report why not.

    Hall of Fame portraits are kept. If the member has since removed their Kaggle picture,
    the saved copy is removed too, so the newspaper follows their choice.
    """
    from PIL import Image, ImageOps
    people = read_people(root)
    person = next((p for p in people if p['id'] == person_id), None)
    if person is None:
        raise ValueError(f'no verified person {person_id}')
    if person.get('portrait', {}).get('kind') == 'hall-of-fame':
        return f'{person_id}: kept the Hall of Fame portrait'
    account = next((a for a in person['accounts'] if a['platform'] == 'kaggle'), None)
    if account is None:
        raise ValueError(f'{person_id} has no verified Kaggle account')
    target = Path(root) / 'client/public/news-images/people' / f'{person_id}.webp'
    avatar = kaggle_avatar_url(fetch(account['url'], 2_000_000).decode('utf-8', 'replace'), account['handle'])
    if avatar is None:
        if person.get('portrait', {}).get('kind') == 'kaggle':
            del person['portrait']
            target.unlink(missing_ok=True)
            write(Path(root) / 'content/news/people.json', validate_people(people))
            return f'{person_id}: Kaggle picture removed by its owner; removed the saved copy'
        return f'{person_id}: no Kaggle picture (default avatar); the page shows initials'
    with Image.open(io.BytesIO(fetch(avatar, 5_000_000))) as picture:
        picture.load()
        canvas = Image.new('RGB', picture.size, (255, 255, 255))
        canvas.paste(picture.convert('RGBA'), mask=picture.convert('RGBA').getchannel('A'))
    target.parent.mkdir(parents=True, exist_ok=True)
    ImageOps.fit(canvas, (PORTRAIT_PIXELS, PORTRAIT_PIXELS), Image.LANCZOS).save(target, 'WEBP', quality=82, method=6)
    person['portrait'] = {'src': f'/news-images/people/{person_id}.webp', 'alt': f'{person["name"]}’s Kaggle profile picture',
                          'kind': 'kaggle', 'sourceUrl': account['url'], 'sourceTitle': f'{person["name"]} — Kaggle profile picture',
                          'checkedAt': iso(now or datetime.now(UTC))}
    write(Path(root) / 'content/news/people.json', validate_people(people))
    return f'{person_id}: saved {target.relative_to(root)} from {account["url"]}'


def main():
    parser = argparse.ArgumentParser(description='People ledger tools for The ARC Daily Digest.')
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('check', help='validate people.json and confirm every portrait file exists')
    portrait = commands.add_parser('portrait', help='save the Kaggle profile picture of verified people as their portrait')
    portrait.add_argument('--person', action='append', required=True, help='person ID; repeat for several')
    args = parser.parse_args()
    if args.command == 'check':
        people = read_people(ROOT)
        portrait_files_exist(people)
        print(f'{len(people)} people valid; {sum("portrait" in p for p in people)} portraits present')
        return
    for person_id in args.person:
        print(save_kaggle_portrait(person_id))
    portrait_files_exist(read_people(ROOT))


if __name__ == '__main__':
    main()
