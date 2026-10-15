#!/usr/bin/env python3.13
# Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 Max
# Date: 15-October-2026 (an approved scene that already ran in the contest or on X is no longer
# offered automatically; the comic-strip rule, found in the backup desk's rehearsal)
# PURPOSE: Maintain reusable competitor character references, plan native illustrations from verified edition moves,
# draw dated corner statistics and branding, and bind image bytes/provenance to the exact headline and manuscript.
# Edition-specific human commissions can reuse approved art on a quiet board while checking
# the current lead/cast; their observed-history charts are archived and mutation-checked.
# Human-approved reusable scenes remain available across editions with fresh overlays,
# while preserving competition, leadership, cast and native-source checks.
# Reviewed native scenes can request centered overlays to leave foreground faces and
# high-ground characters visible, with a distinct immutable composition identity.
# SRP/DRY check: Pass — extends the existing compositor; reuses newsroom briefs and people records.
"""Native generation is the Codex journalist's tool call; this helper never calls a model/API."""
import argparse
from html import escape
from datetime import datetime, timedelta
from io import BytesIO
import json
import math
from pathlib import Path
import re
import sys
from PIL import Image, ImageDraw, ImageFont
from newsroom import ROOT, UTC, ET, digest, encoded, iso, load, stamp, text

OVERLAY_LAYOUT = 'corner-overlays-v1'
HISTORY_LAYOUT = 'corner-history-v2.1'


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


def check_library(root=ROOT):
    registry = load(Path(root) / 'content/news/visual-identities.json')
    if registry.get('version') != 1:
        raise ValueError('unknown visual identity registry')
    people = {p['id']: p for p in load(Path(root) / 'content/news/people.json')}
    ids, ready, pending, assets = set(), [], [], set()
    for subject in registry['subjects']:
        sid = subject['id']
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,99}', sid) or sid in ids:
            raise ValueError('duplicate or invalid character ID')
        ids.add(sid)
        if subject.get('status', 'ready') not in ('ready', 'pending'):
            raise ValueError('unknown character status')
        if subject.get('personId') and subject['personId'] not in people:
            raise ValueError('character has no verified person')
        if subject.get('status', 'ready') == 'pending':
            if subject.get('references') or not subject.get('reason'):
                raise ValueError('pending character needs a reason and no invented reference')
            pending.append(sid)
            continue
        if not subject.get('references'):
            raise ValueError('ready character needs a reference')
        ready.append(sid)
        for ref in subject['references']:
            text(ref['role'], 'reference role', 900)
            path = public_file(ref['src'], root)
            if ref.get('sha256') and file_sha(path) != ref['sha256']:
                raise ValueError('character reference bytes changed: ' + ref['src'])
            if ref.get('generationRecord'):
                record = load(Path(root) / 'content/news/artwork' / (ref['generationRecord'] + '.json'))
                if record.get('subjectId') != sid or record['rawSrc'] != ref['src'] or record['rawSha256'] != file_sha(path):
                    raise ValueError('character generation provenance mismatch')
            assets.add(ref['src'])
    for subject in registry['subjects']:
        if not set(subject.get('includePeople', [])).issubset(ready):
            raise ValueError('unknown team companion character')
    for scene in registry.get('scenes', []):
        if not set(scene['subjectIds'] + scene.get('requiredPersonIds', [])).issubset(ready):
            raise ValueError('scene has an unknown character')
        record = load(Path(root) / 'content/news/artwork' / (scene['generationRecord'] + '.json'))
        if record['rawSrc'] != scene['reusableBase'] or record['rawSha256'] != file_sha(public_file(scene['reusableBase'], root)):
            raise ValueError('scene generation provenance mismatch')
    reusable = []
    for scene in registry.get('reusableScenes', []):
        conditions = scene['artworkConditions']
        if (scene['id'] in reusable or scene['competition'] not in ('arc-2', 'arc-3')
                or not scene.get('approvedBy')
                or conditions['leaderTeamId'] == conditions['rivalTeamId']
                or not set(conditions.get('requiredPersonIds', [])).issubset(ready)):
            raise ValueError('invalid reusable scene approval')
        stamp(scene['approvedAt'])
        record = load(Path(root) / 'content/news/artwork' / (scene['artworkGenerationRecord'] + '.json'))
        if (record.get('kind') != 'native-generation' or record.get('tool') != 'image_gen.imagegen'
                or record['rawSha256'] != file_sha(public_file(record['rawSrc'], root))):
            raise ValueError('reusable scene generation provenance mismatch')
        reusable.append(scene['id'])
    return {'ready': ready, 'pending': pending, 'assets': sorted(assets), 'reusableScenes': reusable}


def library_gallery(root=ROOT):
    summary = check_library(root)
    registry = load(Path(root) / 'content/news/visual-identities.json')
    prepared_label = stamp(registry.get('updatedAt', iso(datetime.now(UTC)))).strftime('%B %-d, %Y')
    cards = []
    for subject in registry['subjects']:
        if subject.get('status', 'ready') == 'pending':
            continue
        refs = subject['references']
        image = refs[0]
        notes = ''.join(f'<li>{escape(n)}</li>' for n in subject.get('identityNotes', []))
        sources = ''.join(f'<li><a href="{escape(r["src"], quote=True)}">{escape(r.get("label", r["role"]))}</a></li>' for r in refs)
        cards.append(f'<article id="{subject["id"]}"><a class="picture" href="{escape(image["src"], quote=True)}"><img src="{escape(image["src"], quote=True)}" alt="{escape(subject["description"], quote=True)}" loading="lazy"></a><div class="copy"><p class="type">{escape(subject.get("referenceType", "Editorial character"))}</p><h2>{escape(subject.get("names", [subject["description"]])[0])}</h2><ul>{notes}</ul><details><summary>References and provenance</summary><ul>{sources}</ul><p>{escape(subject.get("provenance", "Verified individual reference in the newsroom people ledger."))}</p></details></div></article>')
    pending = ''.join(f'<li><strong>{escape(s.get("names", [s["id"]])[0])}</strong>: {escape(s["reason"])}</li>' for s in registry['subjects'] if s.get('status') == 'pending')
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARC Daily character reference library</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#f3efE4;color:#211d17;font-family:Georgia,serif}}main{{max-width:1320px;margin:auto;padding:28px}}header{{border-bottom:4px double #211d17;margin-bottom:24px}}.kicker,.type,summary{{font:700 12px/1.5 system-ui;letter-spacing:.06em;text-transform:uppercase}}h1{{font-size:clamp(32px,5vw,58px);line-height:1.05;margin:10px 0}}header p{{max-width:900px;line-height:1.5}}a{{color:#753f2b}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}}article{{background:#fffaf0;border:1px solid #b7ae9a;min-width:0}}.picture{{display:block;background:#e6dece}}img{{display:block;width:100%;height:320px;object-fit:contain}}.copy{{padding:16px}}h2{{margin:5px 0 12px;font-size:24px}}li{{line-height:1.45;margin-bottom:7px}}ul{{padding-left:20px}}.type{{color:#755039;margin:0}}details{{border-top:1px solid #c8beaa;padding-top:10px}}summary{{cursor:pointer}}footer{{margin-top:32px;border-top:2px solid #211d17;padding-top:14px}}@media(max-width:550px){{main{{padding:16px}}img{{height:300px}}}}
    </style></head><body><main><header><p class="kicker"><a href="/news">The ARC Daily Digest</a> · The art desk</p><h1>Our recurring cast</h1><p>{len(summary['ready'])} reusable competitor identities, drawn from saved character art, verified avatars and owner-supplied references. The edition desk matches people to the fresh roster before casting them, then draws current scores separately.</p><p>Keep the face, ears, coat and costume details below consistent. Historical trading-card text supplies no current score or team membership.</p></header><section class="grid">{''.join(cards)}</section><footer><h2>References still needed</h2><ul>{pending}</ul><p>Library prepared {prepared_label}. Character references and editorial costumes are illustrations; the reporting stays anchored to dated evidence.</p></footer></main></body></html>'''


def registry_subjects(item, registry, root):
    competition = item['articleBase']['competition']
    people = load(Path(root) / 'content/news/people.json')
    catalog = {s['personId']: s for s in registry.get('subjects', []) if s.get('personId') and s.get('status', 'ready') == 'ready'}
    subjects = {}
    for tid, observation in item['evidence']['observations'].items():
        # Current exact handles govern the cast, including when teammates or team IDs change.
        matched = [p for p in people if any(a['platform'] == 'kaggle' and a['handle'] in observation['members'] for a in p['accounts'])]
        characters = []
        for person in matched:
            character = catalog.get(person['id'])
            if character is None and person.get('portrait'):
                character = {'id': person['id'], 'personId': person['id'], 'description': person['name'], 'names': [person['name']],
                             'references': [{'src': person['portrait']['src'], 'role': f"Verified avatar/portrait of {person['name']}; preserve its identity."}]}
            if character:
                characters.append(character)
        matched_ids = {p['id'] for p in matched}
        team = next((s for s in registry.get('subjects', []) if s.get('status', 'ready') == 'ready'
                     and tid in s.get('teamIds', {}).get(competition, [])
                     and (not s.get('personId') or s['personId'] in matched_ids)), None)
        if team:
            companions = [c for c in characters if c['personId'] in team.get('includePeople', [])]
            subjects[tid] = {**team, 'references': [*team['references'], *(r for c in companions for r in c['references'])],
                             'names': [*team.get('names', [team['description']]), *(name for c in companions for name in c.get('names', [c['description']]))],
                             'personIds': ([team['personId']] if team.get('personId') else []) + [c['personId'] for c in companions],
                             'identityNotes': [*team.get('identityNotes', []), *(note for c in companions for note in c.get('identityNotes', []))]}
        elif characters:
            subjects[tid] = {'id': characters[0]['id'] if len(characters) == 1 else f'roster-{competition}-{tid}',
                             'description': '; '.join(c['description'] for c in characters),
                             'personIds': [c['personId'] for c in characters],
                             'names': [name for c in characters for name in c.get('names', [c['description']])],
                             'identityNotes': [note for c in characters for note in c.get('identityNotes', [])],
                             'references': [r for c in characters for r in c['references']]}
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


def used_scene_hashes(root, competition):
    """Clean bases (by image hash) that already ran: in a published article of this contest, or on
    any X post. The Boss's comic-strip direction (13 October) is that a used scene is not repeated as
    routine art, so the planner stops offering it automatically; an explicit editorial assignment
    can still commission it. Hashes, not record IDs, because one base can be registered twice."""
    root = Path(root)

    def base_hash(record_id, depth=0):
        path = root / 'content/news/artwork' / f'{record_id}.json'
        if not record_id or depth > 2 or not path.exists():
            return None
        record = load(path)
        if record.get('kind') == 'native-generation':
            return record.get('rawSha256')
        return base_hash(record.get('generationRecord'), depth + 1)  # a finished composition: follow it to its base

    used = set()
    for path in (root / 'content/news/articles').glob('*.json'):
        article = load(path)
        if article.get('competition') == competition and (article.get('image') or {}).get('artworkId'):
            used.add(base_hash(article['image']['artworkId']))
    inventory = root / 'content/news/artwork-inventory.json'
    for image in (load(inventory).get('images', []) if inventory.exists() else []):
        for attachment in image.get('xAttachments', []):
            used.add(base_hash(attachment.get('artworkId')) or base_hash(image.get('generationRecord')))
    used.discard(None)
    return used


def scene_assignments(item, article, root):
    """Reuse explicit human approvals without reopening old editions or their evidence."""
    assignments = list(item.get('intake', {}).get('editorialAssignments', []))
    registry = load(Path(root) / 'content/news/visual-identities.json')
    used = used_scene_hashes(root, item['articleBase']['competition'])
    for scene in registry.get('reusableScenes', []):
        if (scene.get('status', 'active') != 'active'
                or scene['competition'] != item['articleBase']['competition']
                or stamp(scene['approvedAt']) > stamp(item['evidence']['accessedAt'])):
            continue
        record = Path(root) / 'content/news/artwork' / f"{scene['artworkGenerationRecord']}.json"
        if record.exists() and load(record).get('rawSha256') in used:
            continue  # already ran in this contest or on X: a new episode, not a repeat
        assignments.append({**scene, 'targetEditionId': article['id'], '_reusableScene': True})
    return assignments


def commissioned_scene(item, article, subjects, root):
    """A human commission has its own verified condition, independent of daily gains."""
    rows = {r['teamId']: r for r in item['articleBase']['stats']}
    for assignment in scene_assignments(item, article, root):
        conditions = assignment.get('artworkConditions')
        preview = article['id'].endswith('-preview') and assignment.get('allowArtworkPreview') is True
        if (assignment.get('targetEditionId') != article['id'] and not preview) or not conditions or not assignment.get('artworkGenerationRecord'):
            continue
        leader_id, rival_id = conditions['leaderTeamId'], conditions['rivalTeamId']
        ids = {leader_id, rival_id}
        if len(ids) != 2 or not ids.issubset(rows.keys() & subjects.keys() & set(article['teamIds'])):
            continue
        selected = [rows[leader_id], rows[rival_id]]
        cast = {p for tid in ids for p in subjects[tid].get('personIds', [])}
        if (selected[0]['rank'] != 1 or selected[0]['score'] <= selected[1]['score']
                or not set(conditions.get('requiredPersonIds', [])).issubset(cast)):
            continue
        record = load(Path(root) / 'content/news/artwork' / (assignment['artworkGenerationRecord'] + '.json'))
        if record.get('kind') != 'native-generation' or file_sha(public_file(record['rawSrc'], root)) != record['rawSha256']:
            raise ValueError('commissioned native scene provenance mismatch')
        return assignment, selected, record
    return None


def score_chart_data(rows, item):
    """Use only archived observations, with the exact edition closing scores appended."""
    cutoff = stamp(item['articleBase']['dataAsOf'])
    series = []
    for row in rows:
        points = [list(p) for p in item['evidence'].get('scoreHistory', {}).get(row['teamId'], [])
                  if stamp(p[0]) <= cutoff]
        if len(points) < 2:
            return None  # Missing historical coverage is not a flat line.
        points.sort(key=lambda p: stamp(p[0]))
        if stamp(points[-1][0]) == cutoff:
            if points[-1][1] != row['score']:
                raise ValueError('history contradicts closing score')
        else:
            points.append([iso(cutoff), row['score'], row['rank']])
        series.append({'teamId': row['teamId'], 'name': row['name'], 'points': points})
    crossing = next((p[0] for previous, p in zip(series[0]['points'], series[0]['points'][1:])
                     if previous[2] > 1 and p[2] == 1), None)
    return {'sourceUrl': item['evidence']['sourceUrl'], 'dataAsOf': iso(cutoff),
            'series': series, 'leadObservedAt': crossing}


def validate_commission_use(report, item, article, root):
    assignments = [a for a in scene_assignments(item, article, root)
                   if a.get('artworkConditions') and a.get('artworkGenerationRecord') == report['generationRecord']
                   and (a.get('targetEditionId') == article['id']
                        or article['id'].endswith('-preview') and a.get('allowArtworkPreview') is True)]
    if not assignments:
        return
    registry = load(Path(root) / 'content/news/visual-identities.json')
    verified = commissioned_scene(item, article, registry_subjects(item, registry, root), root)
    if not verified or verified[0]['id'] not in {a['id'] for a in assignments} or report['rows'] != verified[1]:
        raise ValueError('commissioned scene conditions no longer hold')


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
    commission = commissioned_scene(item, article, subjects, root)
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
    if not eligible and not commission:
        return {'version': 1, 'articleId': article['id'], 'jobs': [], 'reason': 'No consequential referenced contender in this manuscript.'}
    if commission:
        assignment, selected, native = commission
        reason = 'editor-approved-reusable-scene' if assignment.get('_reusableScene') else 'editor-commissioned-leading-scene'
    else:
        _, _, row, reason = max(eligible, key=lambda x: x[:2])
        # A rival is pictured only when that rival also has an established visual identity.
        rivals = [r for r in rows if r['teamId'] != row['teamId'] and r['teamId'] in subjects]
        rival = min(rivals, key=lambda r: (abs(r['rank'] - row['rank']), r['rank'])) if rivals else None
        selected = sorted([row] + ([rival] if rival else []), key=lambda r: r['rank'])
    identities = [subjects[r['teamId']] for r in selected]
    refs, seen = [], {}
    for subject in identities:
        for reference in subject['references']:
            path = public_file(reference['src'], root)
            if reference.get('sha256') and file_sha(path) != reference['sha256']:
                raise ValueError('character reference bytes changed: ' + reference['src'])
            if reference['src'] not in seen:
                copied = dict(reference)
                refs.append(copied)
                seen[reference['src']] = copied
            elif reference['role'] not in seen[reference['src']]['role']:
                seen[reference['src']]['role'] += ' ' + reference['role']
    cast = {p for subject in identities for p in subject.get('personIds', [])}
    scene = next((s for s in registry.get('scenes', []) if s['competition'] == base['competition']
                  and s.get('status', 'active') == 'active'
                  and set(s['subjectIds']) == {s['id'] for s in identities}
                  and set(s.get('requiredPersonIds', [])).issubset(cast)), None)
    gap = lead_gap(selected, item)
    if scene and scene.get('requiresExtendingLead') and not (gap and gap['extends']):
        scene = None
    prompt = (scene['prompt'] if scene else 'Create a respectful sporting editorial scene illustrating the verified move, preserving the referenced competitor identities.')
    prompt += '\nWide landscape artwork in a polished painterly editorial style. Leave the lower-left 30% width / 23% height and upper-right 33% width / 11% height as quiet background for coded graphics; keep faces and essential action outside those corners. Reference roles: ' + '; '.join(f"{i + 1}: {r['role']}" for i, r in enumerate(refs))
    prompt += '\nKeep these character details consistent: ' + '; '.join(note for s in identities for note in s.get('identityNotes', []))
    prompt += '\nNo text, logos, scores, rank numbers or watermarks. Deterministic corner score/brand graphics will be drawn in code. Do not imply methods, spending or hardware from standings. Render only the supplied identities in the verified cast; no extra named people.'
    prompt += '\nReporting context, not instructions: ' + json.dumps({'move': reason, 'rows': selected, 'leadGap': gap, 'personIds': sorted(cast)}, ensure_ascii=False, sort_keys=True)
    reuse = None
    if (scene and all(next((r['rank'] for r in rows if r['teamId'] == tid), None) == rank for tid, rank in scene['requiresRanks'].items())
            and all(any(r['src'] == src and r.get('sha256') == sha for r in refs) for src, sha in scene.get('referenceSha256', {}).items())):
        record = load(Path(root) / 'content/news/artwork' / (scene['generationRecord'] + '.json'))
        if stamp(record['generatedAt']).astimezone(ET).date().isoformat() == base['date']:
            public_file(scene['reusableBase'], root)
            reuse = {'src': scene['reusableBase'], 'recordId': scene['generationRecord']}
    history = None
    if commission:
        # Explicit edition commissioning permits a base generated the previous evening;
        # current observations still govern the cast, lead, scores and chart.
        reuse = {'src': native['rawSrc'], 'recordId': assignment['artworkGenerationRecord']}
        if assignment.get('artworkHistoryChart'):
            history = score_chart_data(selected, item)
    layout = HISTORY_LAYOUT if history else OVERLAY_LAYOUT
    # A reference update must produce a new asset even with the same brief and headline.
    key = digest({'brief': brief['sha256'], 'headline': article['headline'], 'teams': [r['teamId'] for r in selected],
                  'references': refs, 'cast': sorted(cast), 'scene': scene, 'prompt': prompt,
                  'layout': layout, 'history': history, 'commission': assignment['id'] if commission else None})[:10]
    job = {'id': f"{article['id']}-{key}", 'articleId': article['id'], 'competition': base['competition'],
           'headline': article['headline'], 'briefSha256': brief['sha256'], 'dataAsOf': base['dataAsOf'],
           'rows': selected, 'trigger': reason, 'leadGap': gap, 'personIds': sorted(cast), 'references': refs, 'reuseBase': reuse,
           'layout': layout, 'historyChart': history,
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
    folder = 'references/' if job.get('purpose') == 'character-reference' else ''
    raw_src = f"/news-images/{folder}{job['id']}-base.webp"
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
    if job.get('purpose') == 'character-reference':
        record.update(purpose='character-reference', subjectId=job['subjectId'])
    record_path = Path(root) / 'content/news/artwork' / (record_id + '.json')
    if record_path.exists():
        existing = load(record_path)
        if all(existing[k] == record[k] for k in record if k != 'generatedAt') and file_sha(target) == record['rawSha256']:
            return existing
        raise ValueError(f'immutable artwork conflict: {record_path}')
    immutable(target, data)
    immutable(record_path, record)
    return record


def draw_history_panel(draw, canvas, job, font, date_label):
    """Dated observed score steps; the visible y-axis explicitly names its range."""
    x, width, height = 32, 610, 344
    y = canvas.height - height - 32
    draw.rectangle((x, y, x + width, y + height), fill='#f5f0e5', outline='#171512', width=2)
    draw.rectangle((x, y, x + width, y + 5), fill='#8b3a2a')
    draw.text((x + 18, y + 13), 'ARC-AGI-3 · OBSERVED PUBLIC SCORES', font=font(23, True), fill='#8b3a2a')
    colors = ['#8b3a2a', '#355970']
    for i, row in enumerate(job['rows']):
        yy = y + 46 + i * 32
        draw.line((x + 18, yy + 14, x + 40, yy + 14), fill=colors[i], width=5)
        draw.text((x + 48, yy), f"#{row['rank']}  {row['name']}", font=font(27, True), fill=colors[i])
        score = f"{row['score']:.2f}"
        draw.text((x + width - 18 - draw.textlength(score, font=font(29, True)), yy), score, font=font(29, True), fill=colors[i])
    history = job['historyChart']
    crossing = history['leadObservedAt']
    annotation = ('Lead observed ' + stamp(crossing).astimezone(ET).strftime('%b %-d · %-I:%M %p %Z')
                  if crossing else 'Lines connect recorded score observations')
    draw.text((x + 18, y + 115), annotation, font=font(19), fill='#534c40')
    all_points = [p for s in history['series'] for p in s['points']]
    first = min(stamp(p[0]) for p in all_points)
    last = stamp(history['dataAsOf'])
    low = max(0, math.floor(min(p[1] for p in all_points) / 10) * 10)
    high = max(low + 10, min(100, math.ceil(max(p[1] for p in all_points) / 10) * 10))
    gx, gy, gw, gh = x + 54, y + 154, width - 78, 123
    xx = lambda when: gx + gw * (stamp(when) - first).total_seconds() / max(1, (last - first).total_seconds())
    yy = lambda value: gy + gh * (high - value) / (high - low)
    for value in range(low, high + 1, 10):
        draw.line((gx, yy(value), gx + gw, yy(value)), fill='#d5cebf', width=1)
        draw.text((x + 17, yy(value) - 10), str(value), font=font(18), fill='#534c40')
    for i, series in enumerate(history['series']):
        points = series['points']
        # Step changes occur at their observed timestamp, not at an invented submission time.
        for a, b in zip(points, points[1:]):
            draw.line((xx(a[0]), yy(a[1]), xx(b[0]), yy(a[1])), fill=colors[i], width=4)
            draw.line((xx(b[0]), yy(a[1]), xx(b[0]), yy(b[1])), fill=colors[i], width=4)
        for p in points:
            px, py = xx(p[0]), yy(p[1])
            draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=colors[i])
    if crossing:
        cx = xx(crossing)
        for dy in range(0, gh, 8):
            draw.line((cx, gy + dy, cx, min(gy + gh, gy + dy + 4)), fill='#8b3a2a', width=1)
    labels = [(first, gx), (last, gx + gw)]
    if crossing and gx + 95 < xx(crossing) < gx + gw - 95:
        labels.insert(1, (stamp(crossing), xx(crossing)))
    for when, px in labels:
        label = when.astimezone(ET).strftime('%b %-d')
        label_width = draw.textlength(label, font=font(18))
        label_x = max(x + 18, min(px - label_width / 2, x + width - 18 - label_width))
        draw.text((label_x, gy + gh + 8), label, font=font(18), fill='#534c40')
    draw.text((x + 18, y + height - 29), date_label + ' · provisional', font=font(19), fill='#534c40')


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
    curated = ({scene['generationRecord'] for scene in registry.get('scenes', [])}
               | {scene['artworkGenerationRecord'] for scene in registry.get('reusableScenes', [])})
    if generation_record in curated and (not job['reuseBase'] or job['reuseBase']['recordId'] != generation_record):
        raise ValueError('the reusable scene no longer matches the verified move')
    generation = load(Path(root) / 'content/news/artwork' / (generation_record + '.json'))
    if generation.get('kind') != 'native-generation' or generation.get('tool') != 'image_gen.imagegen':
        raise ValueError('artwork requires native generation provenance')
    if file_sha(source) != generation['rawSha256']:
        raise ValueError('raw image differs from the reviewed native generation')
    placement = generation.get('overlayPlacement', 'corners')
    if placement not in ('corners', 'center'):
        raise ValueError('unknown native artwork overlay placement')
    if placement == 'center':
        if job['historyChart']:
            raise ValueError('centered overlays require the compact score panel')
        # The native scene's reviewed layout is part of the immutable output identity.
        job = {**job, 'layout': 'center-overlays-v1',
               'id': article['id'] + '-' + digest({'planId': job['id'],
                   'generationRecord': generation_record, 'layout': 'center-overlays-v1'})[:10]}
    item = next(x for x in brief['competitions'].values()
                if x['status'] == 'ready' and x['articleBase']['id'] == article['id'])
    validate_commission_use({'generationRecord': generation_record, 'rows': job['rows']}, item, article, root)
    width = 1920
    raw = Image.open(source).convert('RGB')
    raw = raw.resize((width, round(raw.height * width / raw.width)), Image.Resampling.LANCZOS)
    fonts = Path(root) / 'server/assets/fonts/news-card'
    font = lambda size, bold=False: ImageFont.truetype(str(fonts / ('IBMPlexSansCondensed-Bold.ttf' if bold else 'IBMPlexSansCondensed-Medium.ttf')), size)
    # Corner graphics are deterministic; keep the scene's aspect ratio and its raw source.
    canvas = raw.copy()
    draw = ImageDraw.Draw(canvas)
    observed = stamp(job['dataAsOf']).astimezone(ET)
    date_label = observed.strftime('%b %-d, %Y · %-I:%M %p %Z')
    if job['historyChart']:
        draw_history_panel(draw, canvas, job, font, date_label)
    else:
        panel_width = 560
        x = (width - panel_width) // 2 if placement == 'center' else 32
        panel_height = 86 + 74 * len(job['rows'])
        y = canvas.height - panel_height - 32
        draw.rectangle((x, y, x + panel_width, y + panel_height), fill='#f5f0e5', outline='#171512', width=2)
        draw.rectangle((x, y, x + panel_width, y + 5), fill='#8b3a2a')
        draw.text((x + 20, y + 14), f"{job['competition'].replace('arc-', 'ARC-AGI-')} · PUBLIC SCORE", font=font(24, True), fill='#8b3a2a')
        for i, row in enumerate(job['rows']):
            row_y = y + 50 + i * 74
            name_font = font(32, True)
            name = f"#{row['rank']}  {row['name']}"
            while draw.textlength(name, font=name_font) > 360:
                name_font = font(name_font.size - 2, True)
                if name_font.size < 18:
                    raise ValueError('team name cannot fit the score panel')
            draw.text((x + 20, row_y), name, font=name_font, fill='#171512')
            score = f"{row['score']:.2f}"
            draw.text((x + panel_width - 20 - draw.textlength(score, font=font(36, True)), row_y - 2), score, font=font(36, True), fill='#171512')
            draw.rectangle((x + 20, row_y + 44, x + panel_width - 20, row_y + 51), fill='#d5cebf')
            draw.rectangle((x + 20, row_y + 44, x + 20 + (panel_width - 40) * min(100, max(0, row['score'])) / 100, row_y + 51), fill='#8b3a2a' if i == 0 else '#355970')
        draw.text((x + 20, y + panel_height - 30), date_label + ' · provisional', font=font(19), fill='#534c40')
    brand_x, brand_y, brand_width = width - 662, 32, 630
    if placement == 'center':
        brand_x = (width - brand_width) // 2
    draw.rectangle((brand_x, brand_y, brand_x + brand_width, brand_y + 106), fill='#f5f0e5', outline='#171512', width=2)
    draw.rectangle((brand_x, brand_y + 101, brand_x + brand_width, brand_y + 106), fill='#8b3a2a')
    logo = Image.open(public_file('/favicon-32x32.png', root)).convert('RGBA').resize((64, 64), Image.Resampling.NEAREST)
    canvas.paste(logo, (brand_x + 18, brand_y + 21), logo)
    draw.text((brand_x + 100, brand_y + 12), 'ARC EXPLAINER · COMPETITION DESK', font=font(21, True), fill='#8b3a2a')
    serif = ImageFont.truetype(str(fonts / 'IBMPlexSerif-Bold.ttf'), 38)
    draw.text((brand_x + 100, brand_y + 41), 'The ARC Daily Digest', font=serif, fill='#171512')
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
              'rows': job['rows'], 'trigger': job['trigger'], 'leadGap': job['leadGap'], 'personIds': job['personIds'],
              'layout': job['layout'], 'historyChart': job['historyChart'], 'generationRecord': generation_record,
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
    if report.get('historyChart') is not None and report['historyChart'] != score_chart_data(report['rows'], item):
        raise ValueError('illustration history differs from edition evidence')
    validate_commission_use(report, item, article, root)
    if file_sha(public_file(image['src'], root)) != report['imageSha256']:
        raise ValueError('illustration bytes changed after composition')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    library = commands.add_parser('library')
    library.add_argument('--gallery', help='Write the reviewed reference gallery to this path.')
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
    if argv and argv[0] not in ('library', 'plan', 'register', 'compose', 'attach', '-h', '--help'):
        argv.insert(0, 'compose')
    args = parser.parse_args(argv)
    if args.command == 'library':
        summary = check_library()
        if args.gallery:
            Path(args.gallery).write_text(library_gallery(), encoding='utf-8')
        print(json.dumps(summary))
        return
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
