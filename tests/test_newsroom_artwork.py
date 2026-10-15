# Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 Max
# Date: 15-October-2026 (used scenes are not offered again automatically)
# PURPOSE: Verify native-art planning, immutable composition and publication evidence, including
# score/image mutations, wrong editions/headlines and missing comparisons. No model calls.
# Covered illustrated commissions cannot publish without their freshly bound approved base.
# Explicit lead/cast conditions and archived chart history fail after meaningful mutations.
# Cross-edition reuse refreshes overlays and cannot bypass leadership or competition checks.
# SRP/DRY check: Pass — production helper and the existing newsroom time-boundary fixture.
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from test_newsroom import bundle, draft, n
import newsroom_artwork as art


class ArtworkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'content/news/artwork').mkdir(parents=True)
        (self.root / 'client/public/news-images').mkdir(parents=True)
        shutil.copytree(n.ROOT / 'server/assets/fonts', self.root / 'server/assets/fonts')
        shutil.copyfile(n.ROOT / 'client/public/favicon-32x32.png', self.root / 'client/public/favicon-32x32.png')
        self.raw = self.root / 'client/public/news-images/reference.webp'
        shutil.copyfile(n.ROOT / 'client/public/news-images/2026-10-12-bunnies-and-compute-base.webp', self.raw)
        n.write(self.root / 'content/news/people.json', [])
        n.write(self.root / 'content/news/visual-identities.json', {'version': 1, 'subjects': [
            {'id': 'alpha', 'description': 'Alpha', 'teamIds': {'arc-3': ['1']}, 'references': [{'src': '/news-images/reference.webp', 'role': 'Alpha'}]},
            {'id': 'beta', 'description': 'Beta', 'teamIds': {'arc-3': ['2']}, 'references': [{'src': '/news-images/reference.webp', 'role': 'Beta'}]}], 'scenes': []})
        n.write(self.root / 'content/news/artwork/native-base.json', {'kind': 'native-generation', 'tool': 'image_gen.imagegen', 'rawSha256': art.file_sha(self.raw)})
        with patch.object(n, 'ROOT', self.root):
            self.brief = bundle()
        self.article = draft(self.brief)
        self.path = self.root / 'brief.json'
        n.write(self.path, self.brief)
        self.now = n.stamp(self.brief['preparedAt'])

    def compose(self):
        return art.compose(self.raw, self.path, article=self.article, root=self.root, generation_record='native-base', now=self.now)

    def test_lead_change_is_selected_and_raw_art_is_preserved(self):
        job = art.plan(self.brief, self.article, self.root)['jobs'][0]
        self.assertEqual(job['trigger'], 'takes-the-lead')
        before = art.file_sha(self.raw)
        report = self.compose()
        self.assertEqual(art.file_sha(self.raw), before)
        self.assertEqual(report['rows'][0]['score'], 12)
        self.assertEqual(self.compose(), report)  # identical composition retries are safe
        art.validate_attachment(report['image'], self.article, self.brief, self.root)

    def test_registration_preserves_the_selected_call_and_retries_safely(self):
        planned = art.plan(self.brief, self.article, self.root)
        planned['jobs'][0]['toolArguments']['prompt'] = 'The exact selected native edit prompt.'
        record = art.register_native(self.raw, planned, 'Inspected the selected output.', self.root)
        self.assertEqual(record['prompt'], 'The exact selected native edit prompt.')
        self.assertEqual(record['inputImages'], ['reference.webp'])
        self.assertEqual(art.register_native(self.raw, planned, 'Inspected the selected output.', self.root), record)
        planned['jobs'][0]['toolArguments']['prompt'] = 'Another generation.'
        with self.assertRaisesRegex(ValueError, 'immutable artwork conflict'):
            art.register_native(self.raw, planned, 'Inspected the selected output.', self.root)

    def test_quiet_board_with_unknown_comparison_does_not_invent_a_move(self):
        item = self.brief['competitions']['arc-3']
        for row in item['articleBase']['stats']:
            row['scoreChange'] = row['rankChange'] = None
            item['evidence']['comparisons'][row['teamId']]['start'] = None
        item['evidence']['events'] = []
        self.assertEqual(art.plan(self.brief, self.article, self.root)['jobs'], [])

    def test_person_references_follow_exact_fresh_handles_and_keep_both_teammates(self):
        people = [{'id': pid, 'name': pid, 'accounts': [{'platform': 'kaggle', 'handle': handle}]} for pid, handle in [('alpha', 'one'), ('beta', 'two')]]
        n.write(self.root / 'content/news/people.json', people)
        registry = n.load(self.root / 'content/news/visual-identities.json')
        for subject in registry['subjects']:
            subject['personId'] = subject['id']
            subject.pop('teamIds')
        item = copy.deepcopy(self.brief['competitions']['arc-3'])
        item['evidence']['observations'] = {'new-team-id': {'members': ['one', 'two']}, 'similar-name': {'members': ['one2']}}
        cast = art.registry_subjects(item, registry, self.root)
        self.assertEqual(cast['new-team-id']['personIds'], ['alpha', 'beta'])
        self.assertNotIn('similar-name', cast)

    def test_companion_is_omitted_when_the_fresh_roster_no_longer_lists_them(self):
        n.write(self.root / 'content/news/people.json', [{'id': 'dries', 'name': 'Dries', 'accounts': [{'platform': 'kaggle', 'handle': 'exact-handle'}]}])
        registry = n.load(self.root / 'content/news/visual-identities.json')
        registry['subjects'][0]['includePeople'] = ['dries']
        registry['subjects'].append({'id': 'dries', 'personId': 'dries', 'description': 'Dries', 'references': [{'src': '/news-images/reference.webp', 'role': 'Dries'}]})
        item = copy.deepcopy(self.brief['competitions']['arc-3'])
        item['evidence']['observations']['1']['members'] = ['exact-handle']
        self.assertIn('dries', art.registry_subjects(item, registry, self.root)['1']['personIds'])
        item['evidence']['observations']['1']['members'] = []
        self.assertNotIn('dries', art.registry_subjects(item, registry, self.root)['1']['personIds'])

    def test_reference_changes_get_a_new_artwork_id(self):
        before = art.plan(self.brief, self.article, self.root)['jobs'][0]['id']
        path = self.root / 'content/news/visual-identities.json'
        registry = n.load(path)
        registry['subjects'][0]['references'][0]['role'] = 'An updated character reference.'
        n.write(path, registry)
        self.assertNotEqual(art.plan(self.brief, self.article, self.root)['jobs'][0]['id'], before)

    def test_job_id_survives_brief_json_serialization(self):
        before = art.plan(self.brief, self.article, self.root)['jobs'][0]['id']
        self.assertEqual(art.plan(art.load(self.path), self.article, self.root)['jobs'][0]['id'], before)

    def test_changed_reference_bytes_fail_the_library_check(self):
        path = self.root / 'content/news/visual-identities.json'
        registry = n.load(path)
        for subject in registry['subjects']:
            subject['references'][0]['sha256'] = art.file_sha(self.raw)
        n.write(path, registry)
        art.check_library(self.root)
        self.raw.write_bytes(self.raw.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'reference bytes changed'):
            art.check_library(self.root)

    def test_corner_overlays_keep_the_scene_aspect_ratio(self):
        report = self.compose()
        with art.Image.open(self.raw) as raw, art.Image.open(art.public_file(report['image']['src'], self.root)) as image:
            self.assertEqual(image.height, round(raw.height * image.width / raw.width))
        self.assertEqual(report['layout'], 'corner-overlays-v1')

    def test_recorded_event_can_supply_a_gain_without_a_net_comparison(self):
        item = self.brief['competitions']['arc-3']
        row = item['articleBase']['stats'][0]
        row['scoreChange'] = row['rankChange'] = None
        item['evidence']['comparisons']['1']['start'] = None
        item['evidence']['events'] = [{'id': '1', 'from': 8, 'to': 12, 't': item['evidence']['cutoffAt']}]
        self.assertEqual(art.plan(self.brief, self.article, self.root)['jobs'][0]['trigger'], 'recorded-score-event')

    def test_unknown_previous_margin_does_not_claim_an_extension(self):
        item = self.brief['competitions']['arc-3']
        item['evidence']['comparisons']['1']['start'] = None
        self.assertFalse(art.lead_gap(item['articleBase']['stats'][:2], item)['extends'])

    def test_a_curated_extending_lead_scene_is_refused_when_the_lead_did_not_extend(self):
        registry_path = self.root / 'content/news/visual-identities.json'
        registry = n.load(registry_path)
        registry['scenes'] = [{'id': 'growing', 'subjectIds': ['alpha', 'beta'], 'competition': 'arc-3',
                               'requiresExtendingLead': True, 'requiresRanks': {'1': 1, '2': 2},
                               'generationRecord': 'native-base', 'reusableBase': '/news-images/reference.webp', 'prompt': 'The leader grows.'}]
        n.write(registry_path, registry)
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            self.compose()

    def test_mutated_score_in_the_composition_fails(self):
        report = self.compose()
        corrupted = copy.deepcopy(report)
        corrupted['rows'][0]['score'] = 99
        n.write(self.root / 'content/news/artwork' / (report['id'] + '.json'), corrupted)
        with self.assertRaisesRegex(ValueError, 'scores differ'):
            art.validate_attachment(report['image'], self.article, self.brief, self.root)

    def test_mutated_image_bytes_fail(self):
        report = self.compose()
        image = art.public_file(report['image']['src'], self.root)
        image.write_bytes(image.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'bytes changed'):
            art.validate_attachment(report['image'], self.article, self.brief, self.root)

    def test_wrong_headline_edition_and_brief_fail(self):
        report = self.compose()
        for key, value in [('headline', 'A different result'), ('id', 'another-edition')]:
            article = {**self.article, key: value}
            with self.assertRaisesRegex(ValueError, 'another headline'):
                art.validate_attachment(report['image'], article, self.brief, self.root)
        different = {**self.brief, 'sha256': 'f' * 64}
        with self.assertRaisesRegex(ValueError, 'another headline'):
            art.validate_attachment(report['image'], self.article, different, self.root)

    def test_publication_archives_the_bound_artwork(self):
        report = self.compose()
        article = {**self.article, 'image': report['image']}
        published = n.publish(article, self.brief, self.root)
        self.assertEqual(n.load(published)['image'], report['image'])
        proof = n.load(self.root / 'content/news/evidence' / published.name)
        self.assertEqual(proof['artwork']['imageSha256'], report['imageSha256'])

    def test_covered_art_commission_requires_the_approved_base(self):
        item = self.brief['competitions']['arc-3']
        item['intake']['editorialAssignments'] = [{'id': 'approved-art', 'title': 'Alpha art commission', 'subjectNames': ['Alpha'],
            'targetEditionId': self.article['id'], 'artworkGenerationRecord': 'native-base'}]
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        self.article['intakeReview'] = [{'id': 'editorial-approved-art', 'disposition': 'covered', 'reason': 'Alpha is the lead.'}]
        with self.assertRaisesRegex(ValueError, 'approved edition-bound artwork'):
            n.validate(self.article, self.brief, self.root)
        self.article['intakeReview'][0]['disposition'] = 'held'
        n.validate(self.article, self.brief, self.root)
        self.article['intakeReview'][0]['disposition'] = 'covered'
        report = self.compose()
        n.validate({**self.article, 'image': report['image']}, self.brief, self.root)


    def test_stale_brief_fails_even_when_the_checksum_matches(self):
        with self.assertRaisesRegex(ValueError, 'fresh brief'):
            art.checked_brief(self.path, self.now + n.timedelta(hours=2))

    def commission(self):
        item = self.brief['competitions']['arc-3']
        self.article['teamIds'] = ['1', '2']
        for row in item['articleBase']['stats']:
            row['scoreChange'] = row['rankChange'] = None
            item['evidence']['comparisons'][row['teamId']]['start'] = None
        item['evidence']['events'] = []
        item['intake']['editorialAssignments'] = [{'id': 'quiet-lead-art', 'targetEditionId': self.article['id'],
            'artworkGenerationRecord': 'native-base', 'artworkHistoryChart': True,
            'artworkConditions': {'leaderTeamId': '1', 'rivalTeamId': '2', 'requiredPersonIds': []}}]
        native = n.load(self.root / 'content/news/artwork/native-base.json')
        native['rawSrc'] = '/news-images/reference.webp'
        n.write(self.root / 'content/news/artwork/native-base.json', native)
        earlier = n.iso(self.now - n.timedelta(days=2))
        middle = n.iso(self.now - n.timedelta(days=1))
        item['evidence']['scoreHistory'] = {'1': [[earlier, 6, 2], [middle, 12, 1]],
                                          '2': [[earlier, 9, 1], [middle, 9, 2]]}
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        return item

    def test_human_commission_works_without_an_invented_daily_gain(self):
        item = self.commission()
        job = art.plan(self.brief, self.article, self.root)['jobs'][0]
        self.assertEqual(job['trigger'], 'editor-commissioned-leading-scene')
        self.assertEqual(job['layout'], 'corner-history-v2.1')
        self.assertEqual(job['historyChart']['series'][0]['points'][-1][1], 12)
        self.assertIsNotNone(job['historyChart']['leadObservedAt'])
        report = self.compose()
        art.validate_attachment(report['image'], self.article, self.brief, self.root)

    def test_commission_stops_after_lead_or_cast_changes(self):
        item = self.commission()
        self.assertEqual(len(art.plan(self.brief, self.article, self.root)['jobs']), 1)
        item['articleBase']['stats'][0]['rank'] = 2
        self.assertEqual(art.plan(self.brief, self.article, self.root)['jobs'], [])
        item['articleBase']['stats'][0]['rank'] = 1
        item['intake']['editorialAssignments'][0]['artworkConditions']['requiredPersonIds'] = ['absent-person']
        self.assertEqual(art.plan(self.brief, self.article, self.root)['jobs'], [])

    def test_mutated_history_fails_attachment_validation(self):
        self.commission()
        report = self.compose()
        report['historyChart']['series'][0]['points'][0][1] = 99
        n.write(self.root / 'content/news/artwork' / (report['id'] + '.json'), report)
        with self.assertRaisesRegex(ValueError, 'history differs'):
            art.validate_attachment(report['image'], self.article, self.brief, self.root)

    def test_missing_history_does_not_invent_a_flat_line(self):
        item = self.commission()
        item['evidence']['scoreHistory']['2'] = []
        self.assertIsNone(art.plan(self.brief, self.article, self.root)['jobs'][0]['historyChart'])

    def test_a_normal_move_cannot_bypass_the_commissions_lead_condition(self):
        item = self.commission()
        item['articleBase']['stats'][0]['rank'] = 2
        item['articleBase']['stats'][0]['scoreChange'] = 5
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        self.assertTrue(art.plan(self.brief, self.article, self.root)['jobs'])
        with self.assertRaisesRegex(ValueError, 'conditions no longer hold'):
            self.compose()

    def reusable_scene(self):
        item = self.commission()
        approval = dict(item['intake']['editorialAssignments'][0])
        approval.pop('targetEditionId')
        approval.update(competition='arc-3', approvedAt=n.iso(self.now - n.timedelta(days=1)), approvedBy='mark-barney')
        item['intake']['editorialAssignments'] = []
        path = self.root / 'content/news/visual-identities.json'
        registry = n.load(path)
        registry['reusableScenes'] = [approval]
        n.write(path, registry)
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        return item

    def test_reusable_scene_refreshes_another_days_overlay_without_changing_the_base(self):
        item = self.reusable_scene()
        before = art.file_sha(self.raw)
        first = self.compose()
        next_day = self.now + n.timedelta(days=1)
        self.brief['preparedAt'] = n.iso(next_day)
        self.now = next_day
        date = next_day.astimezone(n.ET).date().isoformat()
        item['articleBase'].update(id=f'{date}-evening-arc-3', date=date, dataAsOf=n.iso(next_day))
        item['evidence']['accessedAt'] = n.iso(next_day)
        item['articleBase']['stats'][0]['score'] = 13
        self.article['id'] = item['articleBase']['id']
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        second = self.compose()
        self.assertEqual(second['trigger'], 'editor-approved-reusable-scene')
        self.assertEqual(second['generationRecord'], first['generationRecord'])
        self.assertEqual(art.file_sha(self.raw), before)
        self.assertNotEqual(second['imageSha256'], first['imageSha256'])
        self.assertEqual(second['rows'][0]['score'], 13)
        self.assertEqual(second['dataAsOf'], n.iso(next_day))
        art.validate_attachment(second['image'], self.article, self.brief, self.root)

    def test_reusable_scene_is_rejected_after_lead_cast_or_competition_changes(self):
        item = self.reusable_scene()
        self.assertTrue(art.plan(self.brief, self.article, self.root)['jobs'][0]['reuseBase'])
        path = self.root / 'content/news/visual-identities.json'
        registry = n.load(path)
        for change in [lambda s: s.update(competition='arc-2'),
                       lambda s: s['artworkConditions'].update(requiredPersonIds=['absent-person']),
                       lambda s: s.update(approvedAt=n.iso(self.now + n.timedelta(hours=1)))]:
            modified = copy.deepcopy(registry)
            change(modified['reusableScenes'][0])
            n.write(path, modified)
            self.assertEqual(art.plan(self.brief, self.article, self.root)['jobs'], [])
        n.write(path, registry)
        item['articleBase']['stats'][0]['rank'] = 2
        item['articleBase']['stats'][0]['scoreChange'] = 5  # Another move cannot authorize this old metaphor.
        self.brief['sha256'] = n.digest({k: v for k, v in self.brief.items() if k != 'sha256'})
        n.write(self.path, self.brief)
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            self.compose()

    def test_reused_artwork_remains_valid_as_the_published_x_attachment(self):
        from newsroom_x import edition_media
        self.reusable_scene()
        report = self.compose()
        published = n.publish({**self.article, 'image': report['image']}, self.brief, self.root)
        media = edition_media(n.load(published), self.root)
        self.assertEqual(media['artworkId'], report['id'])
        self.assertEqual(media['sourceSha256'], report['imageSha256'])


class UsedSceneTests(unittest.TestCase):
    def test_a_scene_that_ran_in_the_contest_or_on_x_is_not_offered_again(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            news = root / 'content/news'
            (news / 'artwork').mkdir(parents=True); (news / 'articles').mkdir()
            write = lambda path, value: path.write_text(json.dumps(value))
            # Two registrations of one base (same bytes) and a second, unused base.
            write(news / 'artwork/base-a.json', {'kind': 'native-generation', 'rawSha256': 'aaa'})
            write(news / 'artwork/base-a-again.json', {'kind': 'native-generation', 'rawSha256': 'aaa'})
            write(news / 'artwork/base-b.json', {'kind': 'native-generation', 'rawSha256': 'bbb'})
            write(news / 'artwork/base-c.json', {'kind': 'native-generation', 'rawSha256': 'ccc'})
            write(news / 'artwork/edition-1.json', {'kind': 'edition-composition', 'generationRecord': 'base-a-again'})
            write(news / 'artwork/x-1.json', {'kind': 'edition-composition', 'generationRecord': 'base-c'})
            write(news / 'articles/2026-10-14-morning-arc-3.json', {'competition': 'arc-3', 'image': {'artworkId': 'edition-1'}})
            write(news / 'artwork-inventory.json', {'images': [{'generationRecord': 'base-c', 'xAttachments': [{'artworkId': 'x-1'}]}]})
            self.assertEqual(art.used_scene_hashes(root, 'arc-3'), {'aaa', 'ccc'})
            # An article in the other contest does not count; an X post counts everywhere.
            self.assertEqual(art.used_scene_hashes(root, 'arc-2'), {'ccc'})


if __name__ == '__main__':
    unittest.main()
