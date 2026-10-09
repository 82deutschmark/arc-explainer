#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Validate persistent public identities and preserve sourced roster observations
# across competition teams. Called by newsroom preparation/publication; no model or network calls.
# SRP/DRY check: Pass — reuses newsroom contract validators and the existing competitor notebook.
import copy
import re
from pathlib import Path
from newsroom import load, text, web_source, contract_stamp


def validate_people(people):
    if not isinstance(people, list):
        raise ValueError('people.json must be an array')
    ids, accounts = set(), set()
    for person in people:
        if set(person) != {'id', 'name', 'accounts', 'facts', 'memberships', 'hallOfFame'}:
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
            if 'image' in card and (set(card['image']) != {'src', 'alt'} or not re.fullmatch(r'/[A-Za-z0-9_-]+\.png', card['image']['src'])):
                raise ValueError('invalid historical artwork')
            if 'image' in card:
                text(card['image']['alt'], 'historical artwork description', 700)
            text(card['label'], 'historical card label')
            web_source(card['sourceUrl'])
            text(card['sourceTitle'], 'historical card source')
            contract_stamp(card['checkedAt'])
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
