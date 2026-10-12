# Author: GPT-6.1 Sol / Codex
# Date: 2026-10-12
# PURPOSE: Verify native-art planning, immutable composition and publication evidence, including
# score/image mutations, wrong editions/headlines and missing comparisons. No model calls.
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

    def test_stale_brief_fails_even_when_the_checksum_matches(self):
        with self.assertRaisesRegex(ValueError, 'fresh brief'):
            art.checked_brief(self.path, self.now + n.timedelta(hours=2))


if __name__ == '__main__':
    unittest.main()
