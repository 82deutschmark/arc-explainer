#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
# Date: 2026-10-22 (head editor: stop at completion; no deployment polling)
# PURPOSE: Prepare afternoon X evidence and edition announcements with the current article's
# reviewed custom artwork as the lead attachment. Save exact image bytes for browser posting;
# the browser journalist verifies and sends once, while this helper never sends to X.
# Reconstruct archived roster/history evidence so reused scenes and charts remain verifiable.
# 09-Oct-2026 (Claude Opus 5.5): --edition drafts the post announcing a published edition, labeled
# "Early edition" (6 am) or "Late edition" (6 pm) at the Boss's request.
# Edition drafts never check deployments. --record-human-post records the editor's confirmation
# locally, without browser verification, preparing another draft or sending anything.
# SRP/DRY check: Pass — reuses newsroom evidence, artwork validation and immutable asset writes.
"""Prepare an afternoon X draft and evidence, or an edition announcement. This helper never posts to X."""
import argparse
from datetime import datetime
from io import BytesIO
import json
from pathlib import Path
import re
from newsroom import prepare, stamp, write, load, ET, SITE, ROOT, UTC
from newsroom_artwork import validate_attachment, public_file, file_sha, immutable
from PIL import Image

EDITION_WORD = {'morning': 'Early', 'evening': 'Late'}
X_LINK_WEIGHT = 23  # X counts every link as 23 characters.


def x_weight(message, link=None):
    """Conservative X length: ASCII counts 1, anything else 2; a link counts 23 when given."""
    body = message.replace(link, 'x' * X_LINK_WEIGHT) if link else message
    return sum(1 if ord(char) < 128 else 2 for char in body)


def edition_media(article, root=ROOT):
    """Only the published article's evidence-bound custom artwork can lead its post."""
    image = article.get('image')
    if not image or not image.get('artworkId'):
        return None
    evidence = load(Path(root) / 'content/news/evidence' / (article['id'] + '.json'))
    # Reconstruct the existing validator's brief inputs from immutable publication evidence.
    brief = {'sha256': evidence['briefSha256'], 'competitions': {
        article['competition']: {'status': 'ready', 'articleBase': article, 'evidence': evidence}}}
    report = validate_attachment(image, article, brief, root)
    if evidence.get('articleId') != article['id'] or evidence.get('artwork') != report:
        raise ValueError('X artwork differs from the published edition evidence')
    return {'artworkId': image['artworkId'], 'sourcePath': str(public_file(image['src'], root)),
            'sourceSha256': report['imageSha256'], 'url': SITE + image['src'],
            'alt': image['alt'], 'caption': image['caption']}


def prepare_media(post, outbox):
    """Save a PNG attachment without changing the reviewed image or its score overlays."""
    media = post.get('media')
    if not media:
        return
    if file_sha(media['sourcePath']) != media['sourceSha256']:
        raise ValueError('X artwork source changed before attachment preparation')
    target = Path(outbox).with_name(media['artworkId'] + '-x.png')
    with Image.open(media['sourcePath']) as source:
        buffer = BytesIO()
        source.save(buffer, format='PNG')
    immutable(target, buffer.getvalue())
    media.update(path=str(target.resolve()), sha256=file_sha(target))


def edition_post(edition, day, root=ROOT):
    """Draft an edition announcement, leading with its reviewed custom art when available."""
    found = {}
    for competition in ('arc-3', 'arc-2'):
        path = Path(root) / 'content/news/articles' / f'{day}-{edition}-{competition}.json'
        if path.exists():
            found[competition] = load(path)
    label = f'{EDITION_WORD[edition]} edition'
    if not found:
        return {'date': day, 'edition': edition, 'label': label, 'state': 'waiting', 'reason': f'No published {edition} edition for {day}.'}
    media = {competition: edition_media(article, root) for competition, article in found.items()}
    lead_competition = next((competition for competition in found if media[competition]), next(iter(found)))
    lead = found[lead_competition]
    link = f"{SITE}/news/{lead['id']}"
    order = [lead_competition, *(competition for competition in found if competition != lead_competition)]
    lines = [f"{competition.replace('arc-', 'ARC-AGI-')}: {found[competition]['headline']}" for competition in order]
    render = lambda rows: '\n'.join([f'The ARC Daily Digest · {label}', *rows, link])
    message = render(lines)
    if x_weight(message, link) > 280:
        message = render(lines[:1])
    if x_weight(message, link) > 280:
        raise ValueError('Edition post is too long')
    post = {'date': day, 'edition': edition, 'label': label, 'state': 'draft', 'message': message, 'link': link,
            'articleIds': [found[competition]['id'] for competition in order], 'account': '82deutschmark'}
    if media[lead_competition]:
        post['media'] = media[lead_competition]
    return post


def record_human_post(target, url=None):
    """The editor's explicit confirmation completes a send; never open X to prove it again."""
    post = load(target)
    if url and not re.fullmatch(r'https://(?:x\.com|twitter\.com)/' +
                               re.escape(post['account']) + r'/status/\d+', url):
        raise ValueError('post URL must identify this outbox account on X')
    if post.get('state') == 'posted':
        if url and post.get('url') != url:
            raise ValueError('completed outbox is protected; preserve its recorded URL')
        return post
    if post.get('state') not in ('draft', 'waiting', 'posting'):
        raise ValueError('human confirmation requires an existing draft or send attempt')
    post.update(state='posted', completionSource='human-confirmation',
                confirmedAt=datetime.now(UTC).isoformat())
    if url:
        post['url'] = url
    write(target, post)
    return post


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


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--brief-output', help='Save fresh board evidence for the evening desk (afternoon recap)')
    parser.add_argument('--edition', choices=['morning', 'evening'], help='Draft the post for this published edition instead')
    parser.add_argument('--draft-only', action='store_true', help='Compatibility flag: all edition drafts skip live-site checks')
    parser.add_argument('--record-human-post', action='store_true', help='Record an explicit human send confirmation locally and exit; never opens X')
    parser.add_argument('--post-url', help='Optional X URL supplied with the human confirmation; never fetches it')
    args = parser.parse_args(argv)
    target = Path(args.output)
    if args.record_human_post:
        if args.edition or args.draft_only or args.brief_output:
            parser.error('--record-human-post cannot prepare another draft')
        print(json.dumps(record_human_post(target, args.post_url), ensure_ascii=False, indent=2))
        return 0
    if args.post_url:
        parser.error('--post-url requires --record-human-post')
    if args.draft_only and not args.edition:
        parser.error('--draft-only requires --edition')
    if target.exists() and json.loads(target.read_text()).get('state') in ('posting', 'posted'):
        raise SystemExit('Existing send attempt or post: inspect its state instead of replacing it.')
    if args.edition:
        post = edition_post(args.edition, datetime.now(UTC).astimezone(ET).date().isoformat())
        # Preserve the reviewed text/source metadata if attachment preparation is interrupted.
        write(target, post)
        prepare_media(post, target)
        # Publication ends at the push. Preparing a social draft must never poll a deployment.
        write(target, post)
        print(json.dumps(post, ensure_ascii=False, indent=2))
        return 0 if post['state'] == 'draft' else 2
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
    return 0 if post['state'] == 'draft' else 2


if __name__ == '__main__':
    raise SystemExit(main())
