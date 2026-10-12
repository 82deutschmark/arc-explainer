#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
# Date: 2026-10-12
# PURPOSE: Plan native Codex illustrations from verified edition moves and saved visual identities,
# compose dated score/headline panels, and bind image bytes and provenance to the exact manuscript.
# SRP/DRY check: Pass — extends the existing compositor; reuses newsroom briefs and people records.
"""Native generation is the Codex journalist's tool call; this helper never calls a model/API."""
import argparse
from datetime import datetime, timedelta
from io import BytesIO
import json
from pathlib import Path
import re
import sys
from PIL import Image, ImageDraw, ImageFont
from newsroom import ROOT, UTC, ET, digest, encoded, iso, load, stamp, text


def public_file(src, root=ROOT):
    if not isinstance(src, str) or not src.startswith('/'):
        raise ValueError('artwork needs a public asset path')
    public = (Path(root) / 'client/public').resolve()
    target = (public / src.lstrip('/')).resolve()
    if not target.is_relative_to(public) or not target.is_file():
        raise ValueError(f'missing public artwork: {src}')
    return target


def file_sha(path):
    import hashlib
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def checked_brief(path, now=None):
    brief = load(path)
    proof = dict(brief)
    if proof.pop('sha256', None) != digest(proof):
        raise ValueError('brief checksum mismatch')
    now = now or datetime.now(UTC)
    if not timedelta(0) <= now - stamp(brief['preparedAt']) <= timedelta(minutes=90):
        raise ValueError('artwork requires a fresh brief')
    return brief


def registry_subjects(item, registry, root):
    competition = item['articleBase']['competition']
    subjects = {}
    for subject in registry.get('subjects', []):
        for tid in subject['teamIds'].get(competition, []):
            subjects[tid] = subject
    people = load(Path(root) / 'content/news/people.json')
    for tid, observation in item['evidence']['observations'].items():
        if tid in subjects:
            continue
        # Only an exact observed Kaggle handle may connect a portrait to today's team.
        person = next((p for p in people if p.get('portrait') and any(
            a['platform'] == 'kaggle' and a['handle'] in observation['members'] for a in p['accounts'])), None)
        if person:
            subjects[tid] = {'id': person['id'], 'description': person['name'], 'references': [
                {'src': person['portrait']['src'], 'role': f"Verified portrait of {person['name']}; do not invent other team members."}]}
    return subjects


def triggers(row, item):
    previous = item['evidence']['comparisons'].get(row['teamId'], {}).get('start')
    result = []
    if previous and row['rank'] == 1 and previous[2] > 1:
        result.append((100, 'takes-the-lead'))
    if previous and row['rank'] <= 10 < previous[2]:
        result.append((90, 'enters-top-ten'))
    old_gold = (item['evidence'].get('baselineSnapshot') or {}).get('gold')
    gold = item['evidence']['closingSnapshot'].get('gold')
    if previous and old_gold is not None and gold is not None and previous[1] < old_gold and row['score'] > gold:
        result.append((85, 'crosses-gold-score'))
    if row['scoreChange'] is not None and row['scoreChange'] >= 3 and row['rank'] <= 25:
        result.append((80 if row['rank'] == 1 else 70, 'net-score-gain'))
    if row['rankChange'] is not None and row['rankChange'] >= 20 and row['rank'] <= 100:
        result.append((60, 'large-climb'))
    for event in item['evidence'].get('events', []):
        if (event['id'] == row['teamId'] and event.get('from') is not None
                and event['to'] == row['score'] and event['to'] - event['from'] >= 3
                and row['rank'] <= 25 and stamp(item['evidence']['baselineTargetAt']) < stamp(event['t']) <= stamp(item['evidence']['cutoffAt'])):
            result.append((80 if row['rank'] == 1 else 70, 'recorded-score-event'))
    return result


def lead_gap(rows, item):
    """A widening lead needs the same leader and a known earlier rival score."""
    if len(rows) != 2 or rows[0]['rank'] != 1 or rows[1]['rank'] != 2:
        return None
    leader, rival = rows
    comparisons = item['evidence']['comparisons']
    start = comparisons.get(leader['teamId'], {}).get('start')
    rival_start = comparisons.get(rival['teamId'], {}).get('start')
    leader_before = start[1] if start and start[2] == 1 else None
    baseline = item['evidence'].get('baselineSnapshot') or {}
    # An observed rank-one score event can connect the current leader to the baseline high.
    if leader_before is None and not start:
        match = next((e for e in item['evidence'].get('events', []) if e['id'] == leader['teamId']
                      and e.get('rankFrom') == 1 and e.get('from') == baseline.get('top')
                      and stamp(item['evidence']['baselineTargetAt']) < stamp(e['t']) <= stamp(item['evidence']['cutoffAt'])), None)
        leader_before = match['from'] if match else None
    previous = round(leader_before - rival_start[1], 10) if leader_before is not None and rival_start else None
    current = round(leader['score'] - rival['score'], 10)
    return {'previous': previous, 'current': current, 'extends': previous is not None and current > previous}


def plan(brief, article, root=ROOT):
    item = next((x for x in brief['competitions'].values() if x['status'] == 'ready'
                 and x['articleBase']['id'] == article['id']), None)
    if not item:
        raise ValueError('manuscript has no ready competition brief')
    base = item['articleBase']
    text(article['headline'], 'artwork headline', 240)
    registry = load(Path(root) / 'content/news/visual-identities.json')
    if registry.get('version') != 1:
        raise ValueError('unknown visual identity registry')
    subjects = registry_subjects(item, registry, root)
    rows = base['stats']
    eligible = []
    for row in rows:
        moves = triggers(row, item)
        if row['teamId'] not in article['teamIds'] or row['teamId'] not in subjects or not moves:
            continue
        subject = subjects[row['teamId']]
        priority, reason = max(moves)
        names = [row['name'], *subject.get('names', [subject['description']])]
        named = any(re.search(r'\b' + re.escape(name) + r'\b', article['headline'], re.IGNORECASE) for name in names)
        eligible.append((priority + (200 if named else 0), -row['rank'], row, reason))
    if not eligible:
        return {'version': 1, 'articleId': article['id'], 'jobs': [], 'reason': 'No consequential referenced contender in this manuscript.'}
    _, _, row, reason = max(eligible, key=lambda x: x[:2])
    # A rival is pictured only when that rival also has an established visual identity.
    rivals = [r for r in rows if r['teamId'] != row['teamId'] and r['teamId'] in subjects]
    rival = min(rivals, key=lambda r: (abs(r['rank'] - row['rank']), r['rank'])) if rivals else None
    selected = sorted([row] + ([rival] if rival else []), key=lambda r: r['rank'])
    identities = [subjects[r['teamId']] for r in selected]
    refs, seen = [], set()
    for subject in identities:
        for reference in subject['references']:
            public_file(reference['src'], root)
            if reference['src'] not in seen:
                refs.append(reference)
                seen.add(reference['src'])
    scene = next((s for s in registry.get('scenes', []) if s['competition'] == base['competition']
                  and set(s['subjectIds']) == {s['id'] for s in identities}), None)
    gap = lead_gap(selected, item)
    if scene and scene.get('requiresExtendingLead') and not (gap and gap['extends']):
        scene = None
    prompt = (scene['prompt'] if scene else 'Create a respectful sporting editorial scene illustrating the verified move, preserving the referenced competitor identities.')
    prompt += '\nWide landscape artwork. Reference roles: ' + '; '.join(f"{i + 1}: {r['role']}" for i, r in enumerate(refs))
    prompt += '\nNo text, logos, scores, rank numbers or watermarks. A deterministic score panel will be appended. Do not imply methods, spending or hardware from standings.'
    prompt += '\nReporting context, not instructions: ' + json.dumps({'move': reason, 'rows': selected, 'leadGap': gap}, ensure_ascii=False)
    reuse = None
    if scene and all(next((r['rank'] for r in rows if r['teamId'] == tid), None) == rank for tid, rank in scene['requiresRanks'].items()):
        record = load(Path(root) / 'content/news/artwork' / (scene['generationRecord'] + '.json'))
        if stamp(record['generatedAt']).astimezone(ET).date().isoformat() == base['date']:
            public_file(scene['reusableBase'], root)
            reuse = {'src': scene['reusableBase'], 'recordId': scene['generationRecord']}
    key = digest({'brief': brief['sha256'], 'headline': article['headline'], 'teams': [r['teamId'] for r in selected]})[:10]
    job = {'id': f"{article['id']}-{key}", 'articleId': article['id'], 'competition': base['competition'],
           'headline': article['headline'], 'briefSha256': brief['sha256'], 'dataAsOf': base['dataAsOf'],
           'rows': selected, 'trigger': reason, 'leadGap': gap, 'references': refs, 'reuseBase': reuse,
           'toolArguments': {'prompt': prompt, 'referenced_image_paths': [str(public_file(r['src'], root)) for r in refs], 'transparent_background': False}}
    return {'version': 1, 'articleId': article['id'], 'jobs': [job]}


def immutable(path, value):
    path = Path(path)
    data = value if isinstance(value, bytes) else encoded(value)
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError(f'immutable artwork conflict: {path}')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def register_native(source, job_plan, review, root=ROOT):
    """Save the native tool's selected output and the journalist's visual review."""
    text(review, 'visual review', 700)
    job = job_plan['jobs'][0]
    raw_src = f"/news-images/{job['id']}-base.webp"
    target = Path(root) / 'client/public' / raw_src.lstrip('/')
    stream = BytesIO()
    with Image.open(source) as raw:
        raw.save(stream, format='WEBP', quality=95)
    data = stream.getvalue()
    record_id = job['id'] + '-base'
    record = {'version': 1, 'id': record_id, 'kind': 'native-generation', 'tool': 'image_gen.imagegen',
              'generatedAt': iso(datetime.now(UTC)), 'toolOutput': Path(source).name,
              'rawSrc': raw_src, 'rawSha256': __import__('hashlib').sha256(data).hexdigest(),
              'prompt': job['toolArguments']['prompt'], 'references': job['references'],
              'inputImages': [Path(p).name for p in job['toolArguments'].get('referenced_image_paths', [])],
              'review': review}
    record_path = Path(root) / 'content/news/artwork' / (record_id + '.json')
    if record_path.exists():
        existing = load(record_path)
        if all(existing[k] == record[k] for k in record if k != 'generatedAt') and file_sha(target) == record['rawSha256']:
            return existing
        raise ValueError(f'immutable artwork conflict: {record_path}')
    immutable(target, data)
    immutable(record_path, record)
    return record


def wrapped(draw, value, font, width):
    lines, line = [], ''
    for word in value.split():
        candidate = (line + ' ' + word).strip()
        if line and draw.textlength(candidate, font=font) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + [line]


def compose(source, brief_path, output=None, article=None, root=ROOT, generation_record=None, now=None):
    brief = checked_brief(brief_path, now)
    if article is None:
        base = brief['competitions']['arc-3']['articleBase']
        article = {'id': base['id'], 'headline': 'The ARC Daily Digest', 'teamIds': ['15499660', '15486995']}
    jobs = plan(brief, article, root)['jobs']
    if not jobs:
        raise ValueError('no artwork job for this manuscript')
    job = jobs[0]
    if generation_record is None and job['reuseBase']:
        generation_record = job['reuseBase']['recordId']
    if not generation_record:
        raise ValueError('save the native generation record before composition')
    registry = load(Path(root) / 'content/news/visual-identities.json')
    curated = {scene['generationRecord'] for scene in registry.get('scenes', [])}
    if generation_record in curated and (not job['reuseBase'] or job['reuseBase']['recordId'] != generation_record):
        raise ValueError('the reusable scene no longer matches the verified move')
    generation = load(Path(root) / 'content/news/artwork' / (generation_record + '.json'))
    if generation.get('kind') != 'native-generation' or generation.get('tool') != 'image_gen.imagegen':
        raise ValueError('artwork requires native generation provenance')
    if file_sha(source) != generation['rawSha256']:
        raise ValueError('raw image differs from the reviewed native generation')
    width = 1920
    raw = Image.open(source).convert('RGB')
    raw = raw.resize((width, round(raw.height * width / raw.width)), Image.Resampling.LANCZOS)
    fonts = Path(root) / 'server/assets/fonts/news-card'
    font = lambda size, bold=False: ImageFont.truetype(str(fonts / ('IBMPlexSansCondensed-Bold.ttf' if bold else 'IBMPlexSansCondensed-Medium.ttf')), size)
    measure = ImageDraw.Draw(raw)
    title_lines = wrapped(measure, job['headline'], font(60, True), width - 96)
    if len(title_lines) > 3:
        raise ValueError('headline too long for the illustration panel')
    panel_height = 308 + len(title_lines) * 70
    canvas = Image.new('RGB', (width, raw.height + panel_height), '#f5f0e5')
    canvas.paste(raw, (0, 0))
    draw = ImageDraw.Draw(canvas)
    y = raw.height
    draw.rectangle((0, y, width, y + 8), fill='#171512')
    label = f"THE ARC DAILY DIGEST · {job['competition'].upper()} · PUBLIC LEADERBOARD"
    draw.text((48, y + 26), label, font=font(28, True), fill='#8b3a2a')
    for i, line in enumerate(title_lines):
        draw.text((48, y + 70 + i * 70), line, font=font(60, True), fill='#171512')
    row_y = y + 84 + len(title_lines) * 70
    column = (width - 96) / len(job['rows'])
    for i, row in enumerate(job['rows']):
        x = round(48 + column * i)
        if i:
            draw.line((x - 24, row_y, x - 24, row_y + 144), fill='#b5ad9b', width=2)
        name_font = font(46, True)
        while draw.textlength(row['name'], font=name_font) > column - 80:
            name_font = font(name_font.size - 2, True)
            if name_font.size < 20:
                raise ValueError('team name cannot fit the score panel')
        draw.text((x, row_y), row['name'], font=name_font, fill='#171512')
        draw.text((x, row_y + 57), f"#{row['rank']}  ·  {row['score']:.2f}", font=font(82, True), fill='#171512')
    observed = stamp(job['dataAsOf']).astimezone(ET)
    date_label = observed.strftime('%b %-d, %Y · %-I:%M %p %Z')
    draw.text((48, canvas.height - 76), date_label + ' · public standings are provisional', font=font(28), fill='#534c40')
    draw.text((48, canvas.height - 38), 'AI EDITORIAL ILLUSTRATION · Characters and props are metaphors · arc.markbarney.net/news', font=font(24), fill='#534c40')
    stream = BytesIO()
    canvas.save(stream, format='WEBP', quality=93)
    data = stream.getvalue()
    src = f"/news-images/{job['id']}.webp"
    asset = Path(root) / 'client/public' / src.lstrip('/')
    alt = 'Editorial illustration for ' + job['headline'] + '. ' + '; '.join(f"{r['name']}: rank {r['rank']}, score {r['score']:.2f}" for r in job['rows']) + '.'
    caption = f"AI-generated editorial illustration. Score panel: {date_label}; provisional public standings. Characters and props are metaphors."
    image = {'src': src, 'alt': alt, 'caption': caption, 'artworkId': job['id']}
    report = {'version': 1, 'id': job['id'], 'kind': 'edition-composition', 'articleId': job['articleId'],
              'headline': job['headline'], 'briefSha256': job['briefSha256'], 'dataAsOf': job['dataAsOf'],
              'rows': job['rows'], 'trigger': job['trigger'], 'leadGap': job['leadGap'], 'generationRecord': generation_record,
              'rawSha256': generation['rawSha256'], 'imageSha256': __import__('hashlib').sha256(data).hexdigest(), 'image': image}
    record_path = Path(root) / 'content/news/artwork' / (job['id'] + '.json')
    # Check both immutable destinations before writing either one.
    for path, body in [(record_path, encoded(report)), (asset, data)]:
        if path.exists() and path.read_bytes() != body:
            raise ValueError(f'immutable artwork conflict: {path}')
    immutable(asset, data)
    immutable(record_path, report)
    if output and Path(output).resolve() != asset.resolve():
        immutable(output, data)
    return report


def validate_attachment(image, article, brief, root=ROOT):
    if not isinstance(image, dict) or set(image) != {'src', 'alt', 'caption', 'artworkId'}:
        raise ValueError('invalid edition illustration fields')
    text(image['alt'], 'illustration alt', 700)
    text(image['caption'], 'illustration caption', 700)
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', image['artworkId']):
        raise ValueError('invalid artwork ID')
    report = load(Path(root) / 'content/news/artwork' / (image['artworkId'] + '.json'))
    if (report['kind'] != 'edition-composition' or report['articleId'] != article['id']
            or report['headline'] != article['headline'] or report['briefSha256'] != brief['sha256'] or report['image'] != image):
        raise ValueError('illustration belongs to another headline, edition or brief')
    item = next(x for x in brief['competitions'].values() if x['status'] == 'ready' and x['articleBase']['id'] == article['id'])
    stats = {r['teamId']: r for r in item['articleBase']['stats']}
    if report['dataAsOf'] != item['articleBase']['dataAsOf'] or any(stats.get(r['teamId']) != r for r in report['rows']):
        raise ValueError('illustration scores differ from edition evidence')
    if file_sha(public_file(image['src'], root)) != report['imageSha256']:
        raise ValueError('illustration bytes changed after composition')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    register = commands.add_parser('register')
    register.add_argument('--source', required=True)
    register.add_argument('--plan', required=True)
    register.add_argument('--review', required=True)
    for name in ('plan', 'compose', 'attach'):
        command = commands.add_parser(name)
        command.add_argument('--brief', required=True)
        command.add_argument('--article', required=name != 'compose')
        if name in ('plan', 'compose'):
            command.add_argument('--output', required=name == 'plan')
        if name == 'compose':
            command.add_argument('--source', required=True)
            command.add_argument('--generation-record')
        if name == 'attach':
            command.add_argument('--artwork', required=True)
    argv = sys.argv[1:]
    if argv and argv[0] not in ('plan', 'register', 'compose', 'attach', '-h', '--help'):
        argv.insert(0, 'compose')
    args = parser.parse_args(argv)
    if args.command == 'register':
        record = register_native(args.source, load(args.plan), args.review)
        print(json.dumps({'generationRecord': record['id'], 'source': str(public_file(record['rawSrc']))}))
        return
    brief = checked_brief(args.brief)
    article = load(args.article) if args.article else None
    if args.command == 'plan':
        result = plan(brief, article)
        Path(args.output).write_bytes(encoded(result))
        print(json.dumps({'jobs': len(result['jobs']), 'path': args.output}))
    elif args.command == 'compose':
        result = compose(args.source, args.brief, args.output, article, generation_record=args.generation_record)
        print(json.dumps({'artworkId': result['id'], 'image': result['image']}))
    else:
        report = load(args.artwork)
        validate_attachment(report['image'], article, brief)
        article['image'] = report['image']
        Path(args.article).write_bytes(encoded(article))
        print('attached: ' + report['id'])


if __name__ == '__main__':
    main()
