#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Store browser-researched posts, incremental coverage and personal briefing delivery;
# export a strictly public subset for the newsroom and weekly meeting. No X/model API or sends.
# SRP/DRY check: Pass — reuses newsroom timestamp, text and source validators; agents do browser research.
import argparse
import copy
from datetime import datetime, timedelta
import fcntl
import json
from pathlib import Path
import re
from newsroom import ROOT, UTC, ET, stamp, iso, encoded, load, text, web_source

POST_FIELDS = {'id', 'author', 'authorName', 'url', 'postedAt', 'checkedAt', 'visibility', 'summary', 'whyItMatters', 'competitions', 'personIds', 'category', 'importance', 'threadId', 'storyUrl', 'identitySourceUrl'}


def save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_bytes(encoded(data))
    temporary.replace(path)


def validate_post(post, now=None, public=False):
    now = now or datetime.now(UTC)
    if set(post) != POST_FIELDS:
        raise ValueError('invalid social post fields')
    if not re.fullmatch(r'\d+', post['id']) or not re.fullmatch(r'[A-Za-z0-9_]{1,15}', post['author']):
        raise ValueError('invalid social author or ID')
    if post['url'].lower() != f"https://x.com/{post['author']}/status/{post['id']}".lower():
        raise ValueError('social permalink does not match author and ID')
    if post['visibility'] not in (('public',) if public else ('public', 'subscriber', 'unknown')):
        raise ValueError('restricted or unknown post cannot enter public content')
    checked = stamp(post['checkedAt'])
    if checked > now or post['postedAt'] is not None and stamp(post['postedAt']) > checked:
        raise ValueError('future social source time')
    for key in ('authorName', 'summary', 'whyItMatters'):
        text(post[key], key, 1200 if key == 'summary' else 700)
    if not isinstance(post['competitions'], list) or any(comp not in ('arc-2', 'arc-3') for comp in post['competitions']):
        raise ValueError('invalid social competition')
    if not isinstance(post['personIds'], list) or any(not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', pid) for pid in post['personIds']):
        raise ValueError('invalid social person IDs')
    if post['category'] not in ('standings', 'research', 'community', 'banter') or type(post['importance']) is not int or post['importance'] not in (1, 2, 3):
        raise ValueError('invalid social category or importance')
    if post['threadId'] is not None and not re.fullmatch(r'\d+', post['threadId']):
        raise ValueError('invalid social thread ID')
    for url in [post['identitySourceUrl']] + ([post['storyUrl']] if post['storyUrl'] else []):
        web_source(url)
    return post


def state_at(directory):
    path = Path(directory) / 'state.json'
    state = load(path) if path.exists() else {'version': 1, 'posts': {}, 'accounts': {}, 'deliveries': {}}
    if state.get('version') != 1 or any(not isinstance(state.get(key), dict) for key in ('posts', 'accounts', 'deliveries')):
        raise ValueError('unsupported social archive')
    return state


def public_posts(state, now=None, days=7):
    now = now or datetime.now(UTC)
    posts = []
    for stored in state['posts'].values():
        post = {key: stored[key] for key in POST_FIELDS}
        if post['visibility'] != 'public' or not post['postedAt'] or stamp(post['postedAt']) < now - timedelta(days=days):
            continue
        validate_post(post, now, public=True)
        posts.append(post)
    return sorted(posts, key=lambda post: (-post['importance'], -(stamp(post['postedAt']).timestamp())))


def ingest(batch, directory, now=None):
    now = now or datetime.now(UTC)
    if set(batch) != {'version', 'researchedAt', 'posts', 'accounts'} or batch['version'] != 1 or stamp(batch['researchedAt']) > now:
        raise ValueError('invalid social research batch')
    candidate = copy.deepcopy(state_at(directory))
    for post in batch['posts']:
        validate_post(post, now)
        old = candidate['posts'].get(post['id'])
        if old and old['author'].lower() != post['author'].lower():
            raise ValueError('existing post identity conflict')
        if old and stamp(post['checkedAt']) < stamp(old['checkedAt']):
            continue
        candidate['posts'][post['id']] = {**post, 'firstSeenAt': old['firstSeenAt'] if old else post['checkedAt'], 'lastSeenAt': post['checkedAt']}
    for handle, coverage in batch['accounts'].items():
        if not re.fullmatch(r'[A-Za-z0-9_]{1,15}', handle) or set(coverage) != {'status', 'coveredFrom', 'coveredThrough', 'checkedAt', 'detail'} or coverage['status'] not in ('ok', 'partial', 'error'):
            raise ValueError('invalid account coverage')
        text(coverage['detail'], 'coverage detail', 1200)
        if stamp(coverage['coveredFrom']) > stamp(coverage['coveredThrough']) or stamp(coverage['coveredThrough']) > stamp(coverage['checkedAt']) or stamp(coverage['checkedAt']) > now:
            raise ValueError('invalid account coverage times')
        old = candidate['accounts'].get(handle, {})
        if old.get('checkedAt') and stamp(coverage['checkedAt']) < stamp(old['checkedAt']):
            continue
        # A partial/error scan never advances the fully checked watermark.
        candidate['accounts'][handle] = {**coverage, **({'lastSuccessfulAt': old['lastSuccessfulAt']} if old.get('lastSuccessfulAt') else {})}
        if coverage['status'] == 'ok':
            candidate['accounts'][handle]['lastSuccessfulAt'] = coverage['coveredThrough']
    candidate['posts'] = {pid: post for pid, post in candidate['posts'].items() if stamp(post['lastSeenAt']) >= now - timedelta(days=30)}
    save(Path(directory) / 'state.json', candidate)
    save(Path(directory) / 'public.json', public_posts(candidate, now))
    return {'postsStored': len(candidate['posts']), 'publicPosts': len(public_posts(candidate, now))}


def collection_plan(directory, root=ROOT, now=None):
    now = now or datetime.now(UTC)
    state = state_at(directory)
    watch = load(Path(root) / 'content/news/social-watch.json')
    return [{'author': account['handle'], 'name': account['name'], 'url': account['url'], 'subscriberUrl': account.get('subscriberUrl'),
        'identitySourceUrl': account['identitySourceUrl'], 'personId': account.get('personId'),
        'after': iso(stamp(state['accounts'][account['handle']]['lastSuccessfulAt']) - timedelta(hours=1)) if state['accounts'].get(account['handle'], {}).get('lastSuccessfulAt') else iso(now - timedelta(days=7))}
        for account in watch]


def make_brief(directory, edition, now=None):
    now = now or datetime.now(UTC)
    state = state_at(directory)
    key = f'{now.astimezone(ET).date().isoformat()}-{edition}'
    path = Path(directory) / 'briefings' / f'{key}.md'
    if key in state['deliveries']:
        if not path.exists():
            raise ValueError('briefing delivery exists but file is missing')
        return path
    delivered = {pid for item in state['deliveries'].values() for pid in item['postIds']}
    posts = [post for post in state['posts'].values() if post['id'] not in delivered and post['visibility'] in ('public', 'subscriber') and stamp(post['firstSeenAt']) >= now - timedelta(days=7)]
    posts.sort(key=lambda post: (-post['importance'], -(stamp(post['postedAt'] or post['firstSeenAt']).timestamp())))
    chosen, groups = [], set()
    # Reserve space for the subscription the reader pays for; public traffic must not bury it.
    for visibility, limit in [('public', 6), ('subscriber', 2), (None, 8)]:
        added = 0
        for post in posts:
            group = (post['visibility'], post['storyUrl'] or post['threadId'] or post['id'])
            if len(chosen) < 8 and group not in groups and (visibility is None or post['visibility'] == visibility) and added < limit:
                chosen.append(post)
                groups.add(group)
                added += 1
    lines = [f'# ARC personal briefing — {key}', f'Prepared {iso(now)} (Eastern edition).', '']
    for visibility, heading in [('public', 'Public news and research'), ('subscriber', 'For you: subscriber posts')]:
        lines += [f'## {heading}', '']
        items = [post for post in chosen if post['visibility'] == visibility]
        for post in items:
            lines += [f"- **{post['authorName']} (@{post['author']})** — {post['summary']} {post['whyItMatters']} [Original post]({post['url']})", f"  Posted: {post['postedAt'] or 'unknown'}; checked: {post['checkedAt']}."]
            group = (post['visibility'], post['storyUrl'] or post['threadId'] or post['id'])
            related = [other for other in posts if other['id'] != post['id'] and (other['visibility'], other['storyUrl'] or other['threadId'] or other['id']) == group]
            lines += [f"  - {other['authorName']} (@{other['author']}): {other['summary']} [Source]({other['url']}) · {other['postedAt'] or 'posting time unknown'}." for other in related]
        if not items:
            lines.append('No new verified items in the saved archive for this section.')
        lines.append('')
    lines += ['## Coverage', '']
    lines += [f"- @{handle}: {coverage['status']} — {coverage['detail']} Checked {coverage['checkedAt']}." for handle, coverage in state['accounts'].items()]
    if not state['accounts']:
        lines.append('No account scans have been recorded; this is not evidence of no new posts.')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n')
    state['deliveries'][key] = {'postIds': [post['id'] for post in posts if (post['visibility'], post['storyUrl'] or post['threadId'] or post['id']) in groups], 'createdAt': iso(now), 'path': str(path)}
    save(Path(directory) / 'state.json', state)
    return path


def export_public(directory, root=ROOT, now=None):
    posts = public_posts(state_at(directory), now)[:20]
    save(Path(root) / 'content/news/social.json', posts)
    return len(posts)


def add_social_sources(item, competition, actual_now, root=ROOT):
    path = Path(root) / 'content/news/social.json'
    posts = load(path) if path.exists() else []
    item['evidence']['socialPosts'] = []
    cutoff = stamp(item['articleBase']['dataAsOf'])
    for post in posts:
        validate_post(post, actual_now, public=True)
        if competition not in post['competitions'] or not post['postedAt'] or stamp(post['postedAt']) > actual_now or stamp(post['postedAt']) < cutoff - timedelta(days=7):
            continue
        sid = f"social-{post['id']}"
        item['articleBase']['sources'].append({'id': sid, 'title': f"{post['authorName']} — {post['category']} post", 'url': post['url'], 'accessedAt': post['checkedAt']})
        item['evidence']['socialPosts'].append({'sourceId': sid, **post})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'ingest', 'brief', 'export-public'])
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--batch', type=Path)
    parser.add_argument('--edition', choices=['morning', 'evening'])
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    # Briefing and ingestion can overlap on scheduled runs; lock only the short local write.
    with (args.directory / '.archive.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == 'plan':
            print(json.dumps(collection_plan(args.directory), ensure_ascii=False, indent=2))
        elif args.action == 'ingest':
            if not args.batch:
                parser.error('ingest requires --batch')
            print(json.dumps(ingest(load(args.batch), args.directory)))
        elif args.action == 'brief':
            if not args.edition:
                parser.error('brief requires --edition')
            print(make_brief(args.directory, args.edition))
        else:
            print(json.dumps({'exported': export_public(args.directory)}))


if __name__ == '__main__':
    main()
