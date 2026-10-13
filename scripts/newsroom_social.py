#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
# Date: 2026-10-12
# PURPOSE: Store browser-researched X posts and Kaggle discussion activity, coverage and separate personal briefing delivery;
# export a strictly public subset for the newsroom and weekly meeting. No X/model API or sends.
# Exports the full dated public thirty-day archive alongside the curated seven-day source subset.
# The editor can retain research in the archive/private briefing while excluding it from the paper's curated strip.
# SRP/DRY check: Pass — reuses newsroom timestamp, text and source validators; agents do browser research.
import argparse
import copy
from datetime import datetime, timedelta
import fcntl
import json
from pathlib import Path
import re
from newsroom import ROOT, UTC, ET, stamp, iso, encoded, load, text, web_source, digest

POST_FIELDS = {'id', 'author', 'authorName', 'url', 'postedAt', 'checkedAt', 'visibility', 'summary', 'whyItMatters', 'competitions', 'personIds', 'category', 'importance', 'threadId', 'storyUrl', 'identitySourceUrl'}
DISCUSSION_FIELDS = {'id', 'competition', 'url', 'title', 'author', 'authorName', 'postedAt', 'latestActivityAt', 'commentCount', 'checkedAt', 'visibility', 'bodyRead', 'summary', 'decision', 'reason', 'personIds'}


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


def validate_coverage(coverage, now):
    if set(coverage) != {'status', 'coveredFrom', 'coveredThrough', 'checkedAt', 'detail'} or coverage['status'] not in ('ok', 'partial', 'error'):
        raise ValueError('invalid source coverage')
    text(coverage['detail'], 'coverage detail', 1200)
    if stamp(coverage['coveredFrom']) > stamp(coverage['coveredThrough']) or stamp(coverage['coveredThrough']) > stamp(coverage['checkedAt']) or stamp(coverage['checkedAt']) > now:
        raise ValueError('invalid source coverage times')


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
        if not re.fullmatch(r'[A-Za-z0-9_]{1,15}', handle):
            raise ValueError('invalid account coverage')
        validate_coverage(coverage, now)
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
    state = state_at(directory)
    policy_path = Path(root) / 'content/news/social-editorial.json'
    policy = load(policy_path) if policy_path.exists() else {}
    background_ids = set(policy.get('backgroundPostIds', []))
    background_accounts = {handle.lower() for handle in policy.get('backgroundResearchAccounts', [])}
    posts = [post for post in public_posts(state, now)
             if post['id'] not in background_ids
             and not (post['category'] == 'research' and post['author'].lower() in background_accounts)][:20]
    save(Path(root) / 'content/news/social.json', posts)
    archive = public_posts(state, now, days=30)
    archive.sort(key=lambda post: (post['postedAt'], post['id']), reverse=True)
    save(Path(root) / 'content/news/social-archive.json', archive)
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


def validate_discussion(thread, now=None):
    now = now or datetime.now(UTC)
    if set(thread) != DISCUSSION_FIELDS or thread['competition'] not in ('arc-2', 'arc-3') or not re.fullmatch(r'\d+', thread['id']):
        raise ValueError('invalid discussion identity')
    expected = f"https://www.kaggle.com/competitions/arc-prize-2026-{thread['competition'].replace('arc-', 'arc-agi-')}/discussion/{thread['id']}"
    if thread['url'] != expected or not re.fullmatch(r'[A-Za-z0-9_-]{1,60}', thread['author']):
        raise ValueError('discussion permalink or author mismatch')
    for key in ('title', 'authorName', 'reason'):
        text(thread[key], key, 1200)
    checked = stamp(thread['checkedAt'])
    if checked > now or any(thread[k] is not None and stamp(thread[k]) > checked for k in ('postedAt', 'latestActivityAt')):
        raise ValueError('future discussion time')
    if thread['postedAt'] and thread['latestActivityAt'] and stamp(thread['postedAt']) > stamp(thread['latestActivityAt']):
        raise ValueError('discussion activity precedes creation')
    if type(thread['commentCount']) is not int or thread['commentCount'] < 0 or type(thread['bodyRead']) is not bool:
        raise ValueError('invalid discussion observation')
    if thread['visibility'] not in ('public', 'unknown') or thread['decision'] not in ('paper-lead', 'watch-only', 'skip'):
        raise ValueError('invalid discussion selection')
    if not isinstance(thread['personIds'], list) or any(not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', pid) for pid in thread['personIds']):
        raise ValueError('invalid discussion person IDs')
    if thread['bodyRead']:
        text(thread['summary'], 'discussion summary', 1600)
    elif thread['summary'] != '':
        raise ValueError('an unread title cannot carry a reporting summary')
    if thread['decision'] == 'paper-lead' and (not thread['bodyRead'] or thread['visibility'] != 'public' or not (thread['postedAt'] or thread['latestActivityAt'])):
        raise ValueError('paper lead requires read public evidence and a known date')
    return thread


def discussion_plan(directory, now=None):
    now = now or datetime.now(UTC)
    state = state_at(directory)
    boards = state.get('discussionBoards', {})
    return [{'competition': comp, 'url': f"https://www.kaggle.com/competitions/arc-prize-2026-{comp.replace('arc-', 'arc-agi-')}/discussion?sort=published",
             'after': iso(stamp(boards[comp]['lastSuccessfulAt']) - timedelta(hours=1)) if boards.get(comp, {}).get('lastSuccessfulAt') else iso(now - timedelta(days=7)),
             'knownThreads': [{'id': t['id'], 'title': t['title'], 'latestActivityAt': t['latestActivityAt'], 'commentCount': t['commentCount']} for t in state.get('discussionThreads', {}).values() if t['competition'] == comp]}
            for comp in ('arc-3', 'arc-2')]


def ingest_discussions(batch, directory, now=None):
    now = now or datetime.now(UTC)
    if set(batch) != {'version', 'researchedAt', 'threads', 'boards'} or batch['version'] != 1 or stamp(batch['researchedAt']) > now:
        raise ValueError('invalid discussion batch')
    candidate = copy.deepcopy(state_at(directory))
    threads = candidate.setdefault('discussionThreads', {})
    boards = candidate.setdefault('discussionBoards', {})
    for thread in batch['threads']:
        validate_discussion(thread, now)
        key = thread['competition'] + '-' + thread['id']
        old = threads.get(key)
        if old and old['author'] != thread['author']:
            raise ValueError('existing discussion author conflict')
        if old and stamp(thread['checkedAt']) < stamp(old['checkedAt']):
            continue
        # A list-only revisit must not erase previously read evidence or editor decisions.
        merged = dict(thread)
        if old and old['bodyRead'] and not thread['bodyRead']:
            changed = any(thread[k] != old[k] for k in ('title', 'latestActivityAt', 'commentCount')) or thread['visibility'] != 'public'
            merged.update(bodyRead=True, summary=old['summary'], decision='watch-only' if changed else old['decision'],
                          reason='New list activity observed; re-read the thread before reusing its earlier summary.' if changed else old['reason'], personIds=old['personIds'])
        revision = digest({k: merged[k] for k in ('title', 'latestActivityAt', 'commentCount')})
        threads[key] = {**merged, 'firstSeenAt': old['firstSeenAt'] if old else thread['checkedAt'], 'revision': revision,
                        'readAt': thread['checkedAt'] if thread['bodyRead'] else old.get('readAt') if old else None}
    for comp, coverage in batch['boards'].items():
        if comp not in ('arc-2', 'arc-3'):
            raise ValueError('unknown discussion board')
        validate_coverage(coverage, now)
        old = boards.get(comp, {})
        if old.get('checkedAt') and stamp(coverage['checkedAt']) < stamp(old['checkedAt']):
            continue
        boards[comp] = {**coverage, **({'lastSuccessfulAt': old['lastSuccessfulAt']} if old.get('lastSuccessfulAt') else {})}
        if coverage['status'] == 'ok':
            boards[comp]['lastSuccessfulAt'] = coverage['coveredThrough']
    candidate['discussionThreads'] = {key: t for key, t in threads.items() if stamp(t['checkedAt']) >= now - timedelta(days=30)}
    save(Path(directory) / 'state.json', candidate)
    return {'threadsStored': len(candidate['discussionThreads']), 'paperLeads': sum(t['decision'] == 'paper-lead' for t in candidate['discussionThreads'].values())}


def discussion_brief(directory, edition, now=None, preview=False):
    now = now or datetime.now(UTC)
    state = state_at(directory)
    key = f'{now.astimezone(ET).date().isoformat()}-{edition}'
    if preview:
        key += '-preview-' + now.strftime('%H%M%S')
    path = Path(directory) / 'discussion-briefings' / f'{key}.md'
    deliveries = state.setdefault('discussionDeliveries', {})
    if key in deliveries:
        if not path.exists():
            raise ValueError('discussion delivery file is missing')
        return path
    delivered = {(tid, revision) for d in deliveries.values() for tid, revision in d['revisions'].items()}
    fresh = [t for tid, t in state.get('discussionThreads', {}).items() if (tid, t['revision']) not in delivered
             and stamp(t['latestActivityAt'] or t['postedAt'] or t['firstSeenAt']) >= now - timedelta(days=7)]
    fresh.sort(key=lambda t: (t['decision'] != 'paper-lead', -(stamp(t['latestActivityAt'] or t['postedAt'] or t['checkedAt']).timestamp())))
    lines = [f'# Kaggle discussion briefing — {key}', f'Checked {iso(now)}. Newly observed activity is separate from original topic creation.', '']
    for decision, title in [('paper-lead', 'Read threads worth editorial consideration'), (None, 'Other new or changed threads')]:
        lines += [f'## {title}', '']
        chosen = [t for t in fresh if (t['decision'] == decision if decision else t['decision'] != 'paper-lead')]
        for t in chosen:
            lines += [f"- **[{t['title']}]({t['url']})** — {t['authorName']} (@{t['author']}), {t['competition'].upper()}.",
                      f"  {t['summary'] if t['bodyRead'] else 'Title/listing observed; body not yet read.'} {t['reason']}",
                      f"  Created: {t['postedAt'] or 'unknown'}; latest activity: {t['latestActivityAt'] or 'unknown'}; comments: {t['commentCount']}."]
        if not chosen:
            lines.append('No undelivered observations in the saved inventory; see scan coverage below.')
        lines.append('')
    lines += ['## Scan coverage', ''] + [f"- {comp}: {c['status']} — {c['detail']} Checked {c['checkedAt']}." for comp, c in state.get('discussionBoards', {}).items()]
    if not state.get('discussionBoards'):
        lines.append('No discussion scans recorded; this does not establish that nothing new was posted.')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n')
    deliveries[key] = {'createdAt': iso(now), 'revisions': {t['competition'] + '-' + t['id']: t['revision'] for t in fresh}}
    save(Path(directory) / 'state.json', state)
    return path


def export_discussions(directory, root=ROOT, now=None):
    now = now or datetime.now(UTC)
    chosen = []
    for stored in state_at(directory).get('discussionThreads', {}).values():
        t = {k: stored[k] for k in DISCUSSION_FIELDS}
        validate_discussion(t, now)
        if t['decision'] == 'paper-lead' and t['visibility'] == 'public' and stamp(t['latestActivityAt'] or t['postedAt']) >= now - timedelta(days=7):
            t['checkedAt'] = stored['readAt']  # A listing revisit is not a fresh body/source check.
            validate_discussion(t, now)
            chosen.append(t)
    chosen.sort(key=lambda t: stamp(t['latestActivityAt'] or t['postedAt']), reverse=True)
    save(Path(root) / 'content/news/discussions.json', chosen[:20])
    return len(chosen[:20])


def add_discussion_sources(item, competition, actual_now, root=ROOT):
    path = Path(root) / 'content/news/discussions.json'
    item['evidence']['discussionThreads'] = []
    for thread in load(path) if path.exists() else []:
        validate_discussion(thread, actual_now)
        if thread['competition'] != competition or thread['decision'] != 'paper-lead' or thread['visibility'] != 'public':
            continue
        if stamp(thread['latestActivityAt'] or thread['postedAt']) < actual_now - timedelta(days=7):
            continue
        sid = f"discussion-{competition}-{thread['id']}"
        item['articleBase']['sources'].append({'id': sid, 'title': f"{thread['authorName']} — {thread['title']}", 'url': thread['url'], 'accessedAt': thread['checkedAt']})
        item['evidence']['discussionThreads'].append({'sourceId': sid, **thread})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'ingest', 'brief', 'export-public', 'discussion-plan', 'discussion-ingest', 'discussion-brief', 'discussion-export'])
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--batch', type=Path)
    parser.add_argument('--edition', choices=['morning', 'evening'])
    parser.add_argument('--preview', action='store_true', help='Use a separate timestamped key for an interactive discussion briefing.')
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    # Briefing and ingestion can overlap on scheduled runs; lock only the short local write.
    with (args.directory / '.archive.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == 'discussion-plan':
            print(json.dumps(discussion_plan(args.directory), ensure_ascii=False, indent=2))
        elif args.action == 'discussion-ingest':
            if not args.batch:
                parser.error('discussion-ingest requires --batch')
            print(json.dumps(ingest_discussions(load(args.batch), args.directory)))
        elif args.action == 'discussion-brief':
            if not args.edition:
                parser.error('discussion-brief requires --edition')
            print(discussion_brief(args.directory, args.edition, preview=args.preview))
        elif args.action == 'discussion-export':
            print(json.dumps({'exported': export_discussions(args.directory)}))
        elif args.action == 'plan':
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
