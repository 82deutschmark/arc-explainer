#!/usr/bin/env python3.13
# Author: GPT-6 / Codex; GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
# Date: 2026-10-29 (required #Kaggle in new X drafts and guarded posting)
# PURPOSE: Prepare afternoon X evidence and edition announcements with the current article's
# reviewed custom artwork as the lead attachment and #Kaggle within the post budget.
# Save exact image bytes for browser posting;
# the browser journalist verifies and sends once, while this helper never sends to X.
# Reconstruct archived roster/history evidence so reused scenes and charts remain verifiable.
# 09-Oct-2026 (Claude Opus 5.5): --edition drafts the post announcing a published edition, labeled
# "Early edition" (6 am) or "Late edition" (6 pm) at the Boss's request.
# Edition drafts never check deployments. --record-human-post records the editor's confirmation
# locally, without browser verification, preparing another draft or sending anything.
# Edition preparation fails closed without reviewed artwork. --begin-posting validates the
# exact PNG, publication binding, Discord delivery/approval and the sender's compose review.
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
REQUIRED_HASHTAG = '#Kaggle'


def x_weight(message, link=None):
    """Conservative X length: ASCII counts 1, anything else 2; a link counts 23 when given."""
    body = message.replace(link, 'x' * X_LINK_WEIGHT) if link else message
    return sum(1 if ord(char) < 128 else 2 for char in body)


def validate_post_text(message, link=None):
    """Validate new reviewed copy; completed outboxes never pass through this edit gate."""
    if not isinstance(message, str) or not re.search(r'(?<!\S)' + re.escape(REQUIRED_HASHTAG) + r'(?!\w)', message):
        raise ValueError('X announcements require the exact #Kaggle hashtag')
    if x_weight(message, link) > 280:
        raise ValueError('X announcement exceeds 280 characters including #Kaggle')


def edition_media(article, root=ROOT):
    """Only the published article's evidence-bound custom artwork can lead its post."""
    image = article.get('image')
    if not image or not image.get('artworkId'):
        # A reserved feature is printed in full at the edition link. Its original reviewed
        # cover leads the announcement; do not invent a new image or a text-only fallback.
        feature_id = article.get('frontPageFeatureId')
        if not feature_id:
            return None
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', feature_id):
            raise ValueError('invalid reserved feature ID')
        feature = load(Path(root) / 'content/news/dispatches' / (feature_id + '.json'))
        if feature['competition'] != article['competition'] or not any(
                source['id'] == 'dispatch-' + feature_id for source in article['sources']):
            raise ValueError('edition does not cite its reserved illustrated feature')
        image = feature.get('image')
        if not image:
            return None
        source = public_file(image['src'], root)
        inventory = load(Path(root) / 'content/news/artwork-inventory.json')
        for entry in inventory['images']:
            if feature_id not in entry.get('articleUses', []):
                continue
            generation = load(Path(root) / 'content/news/artwork' / (entry['generationRecord'] + '.json'))
            if (generation.get('kind') == 'native-generation'
                    and generation.get('tool') == 'image_gen.imagegen'
                    and generation.get('rawSrc') == image['src']
                    and generation.get('rawSha256') == file_sha(source)):
                return {'artworkId': generation['id'], 'sourcePath': str(source),
                        'sourceSha256': generation['rawSha256'], 'url': SITE + image['src'],
                        'alt': image['alt'], 'caption': image['caption'],
                        'featureId': feature_id, 'featureHeadline': feature['headline']}
        raise ValueError('reserved feature cover has no matching reviewed native provenance')
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
    """An edition with no reviewed picture is blocked, never a sendable text-only draft."""
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
    lines = [f"{competition.replace('arc-', 'ARC-AGI-')}: {(media[competition] or {}).get('featureHeadline', found[competition]['headline'])}" for competition in order]
    render = lambda rows: '\n'.join([f'The ARC Daily Digest · {label}', *rows, REQUIRED_HASHTAG, link])
    message = render(lines)
    if x_weight(message, link) > 280:
        message = render(lines[:1])
    if x_weight(message, link) > 280:
        raise ValueError('Edition post is too long')
    validate_post_text(message, link)
    post = {'date': day, 'edition': edition, 'label': label, 'state': 'draft', 'message': message, 'link': link,
            'articleIds': [found[competition]['id'] for competition in order], 'account': '82deutschmark'}
    if media[lead_competition]:
        post['media'] = media[lead_competition]
    else:
        post.update(state='blocked', blocker='missing-edition-artwork',
                    reason='Edition X announcement requires reviewed artwork. Prepare the image before sending; no text-only fallback.')
    return post


def begin_posting(target, attached_image_sha256, attachment_reviewed=False, root=ROOT):
    """Guard the only agent-controlled edition draft -> posting transition; never sends."""
    post = load(target)
    if post.get('state') != 'draft' or post.get('edition') not in EDITION_WORD:
        raise ValueError('only an unsent edition draft can begin posting')
    validate_post_text(post.get('message'), post.get('link'))
    media = post.get('media') or {}
    if not attachment_reviewed or not attached_image_sha256:
        raise ValueError('visually review the uploaded image, alt text, copy and link in the X composer first')
    if not media.get('path') or not media.get('sha256'):
        raise ValueError('edition image attachment is required; no text-only posting')
    if attached_image_sha256 != media['sha256'] or file_sha(media['path']) != media['sha256']:
        raise ValueError('uploaded attachment hash differs from the reviewed edition image')
    lead = load(Path(root) / 'content/news/articles' / (post['articleIds'][0] + '.json'))
    expected = edition_media(lead, root)
    if not expected or any(media.get(k) != expected[k] for k in ('artworkId', 'sourcePath', 'sourceSha256')):
        raise ValueError('attachment does not match this published edition artwork')
    if post['link'] != f"{SITE}/news/{lead['id']}" or post['link'] not in post['message']:
        raise ValueError('reviewed link must point to the illustrated edition')
    # Recreate the format conversion too: a different PNG must not pass merely because
    # someone replaced both the attachment file and its saved hash.
    with Image.open(expected['sourcePath']) as source:
        buffer = BytesIO()
        source.save(buffer, format='PNG')
    import hashlib
    if hashlib.sha256(buffer.getvalue()).hexdigest() != media['sha256']:
        raise ValueError('PNG attachment differs from the published illustration')
    receipt_path = (post.get('discord') or {}).get('receiptPath')
    if not receipt_path:
        raise ValueError('finished edition image needs a confirmed Discord receipt')
    delivery = load(receipt_path)
    approval = post.get('approval') or {}
    if (delivery.get('state') != 'sent' or not delivery.get('messageId')
            or delivery.get('destination') != 'channel:1550165647911034940'
            or delivery.get('imageSha256') != media['sha256']
            or post['link'] not in delivery.get('message', '')):
        raise ValueError('finished image and edition link need a confirmed Discord receipt')
    if (approval.get('approved') is not True
            or approval.get('messageId') != delivery['messageId']
            or approval.get('imageSha256') != media['sha256']):
        raise ValueError('awaiting Discord approval for this exact attachment')
    if approval.get('source') == 'discord-reaction':
        if not approval.get('userId') or approval.get('userIsBot') is not False or not approval.get('emoji'):
            raise ValueError('approval needs an identified person reaction, not the bot')
    elif approval.get('source') != 'editor-waiver' or not approval.get('instruction'):
        raise ValueError('approval requires a person reaction or explicit editor waiver')
    stamp(approval['checkedAt'])
    post.update(state='posting', postingReview={'imageSha256': media['sha256'],
                'link': post['link'], 'message': post['message'], 'attachmentReviewed': True,
                'reviewedAt': datetime.now(UTC).isoformat()})
    post.pop('blocker', None)
    write(target, post)
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
    if post.get('state') not in ('draft', 'waiting', 'blocked', 'posting'):
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
    render = lambda rows, gains=False: lead_in + '\n' + '\n'.join(rows) + ('\nGains vs prior 6pm ET.' if gains else '') + f'\n{REQUIRED_HASHTAG}\n{SITE}/news'
    message = render(lines, has_gains)
    # Count full URLs and double non-ASCII characters conservatively; no dependency on X's short-link accounting.
    weight = lambda value: sum(1 if ord(char) < 128 else 2 for char in value)
    if weight(message) > 280:
        message = render(leader_lines)
    if weight(message) > 280:
        message = render(score_lines)
    if weight(message) > 280:
        raise ValueError('Daily post is too long')
    validate_post_text(message)
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
    parser.add_argument('--begin-posting', action='store_true', help='Validate edition image/approval after upload and save the guarded posting handoff')
    parser.add_argument('--attached-image-sha256', help='SHA-256 of the exact uploaded and visually reviewed edition PNG')
    parser.add_argument('--attachment-reviewed', action='store_true', help='Confirm the X composer visibly contains the intended image, alt text, copy and link')
    parser.add_argument('--post-url', help='Optional X URL supplied with the human confirmation; never fetches it')
    args = parser.parse_args(argv)
    target = Path(args.output)
    if args.begin_posting:
        if args.edition or args.draft_only or args.brief_output or args.record_human_post or args.post_url:
            parser.error('--begin-posting cannot prepare a draft or record a completed post')
        print(json.dumps(begin_posting(target, args.attached_image_sha256, args.attachment_reviewed), ensure_ascii=False, indent=2))
        return 0
    if args.attached_image_sha256 or args.attachment_reviewed:
        parser.error('attachment review flags require --begin-posting')
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
        post = {}
        try:
            post = edition_post(args.edition, datetime.now(UTC).astimezone(ET).date().isoformat())
            # Preserve reviewed copy even when conversion fails; never leave a sendable draft.
            if post['state'] == 'draft':
                post.update(state='blocked', blocker='preparing-edition-artwork')
                write(target, post)
                prepare_media(post, target)
                if not post.get('media', {}).get('path'):
                    raise ValueError('prepared edition image attachment is required')
                post.update(state='draft')
                post.pop('blocker', None)
        except (ValueError, OSError) as error:
            post = {**post, 'state': 'blocked',
                    'blocker': 'invalid-edition-artwork', 'reason': str(error)}
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
