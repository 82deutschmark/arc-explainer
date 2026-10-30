# Author: GPT-6.1 Sol / Codex
# Date: 2026-10-29
# PURPOSE: Reject text-only edition sends, replaced attachments, wrong article links,
# unapproved or bot-approved Discord previews and repeated posting attempts. Exercise
# real image bytes and protected outboxes without sending or accessing the network.
# SRP/DRY check: Pass — uses the production X helper and Pillow's existing conversion.
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import newsroom_x as x


class EditionImageGateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.article_id = '2026-10-29-evening-arc-3'
        folder = self.root / 'content/news/articles'
        folder.mkdir(parents=True)
        self.article = {'id': self.article_id, 'competition': 'arc-3', 'headline': 'The cat takes third'}
        (folder / (self.article_id + '.json')).write_text(json.dumps(self.article))
        source = self.root / 'cover.webp'
        Image.new('RGB', (12, 6), '#e9ad31').save(source)
        self.expected = {'artworkId': 'cover-v1', 'sourcePath': str(source),
                         'sourceSha256': x.file_sha(source), 'alt': 'The cat passes the turkey.'}
        self.outbox = self.root / 'outbox.json'
        self.post = {'state': 'draft', 'edition': 'evening', 'articleIds': [self.article_id],
                     'link': x.SITE + '/news/' + self.article_id, 'media': dict(self.expected)}
        self.post['message'] = 'The cat takes third\n' + self.post['link']
        x.prepare_media(self.post, self.outbox)
        self.receipt = self.root / 'discord.json'
        self.delivery = {'state': 'sent', 'messageId': '123', 'destination': 'channel:1550165647911034940',
                         'imageSha256': self.post['media']['sha256'], 'message': self.post['link']}
        self.receipt.write_text(json.dumps(self.delivery))
        self.post['discord'] = {'receiptPath': str(self.receipt)}
        self.post['approval'] = {'approved': True, 'source': 'discord-reaction', 'messageId': '123',
                                 'imageSha256': self.post['media']['sha256'], 'userId': 'person',
                                 'userIsBot': False, 'emoji': '👍', 'checkedAt': '2026-10-29T22:01:00Z'}
        self.save()

    def save(self):
        self.outbox.write_text(json.dumps(self.post))

    def begin(self, sha=None, reviewed=True):
        with patch.object(x, 'edition_media', return_value=self.expected):
            return x.begin_posting(self.outbox, sha or self.post['media']['sha256'], reviewed, self.root)

    def assert_rejected_without_mutation(self, expression):
        before = self.outbox.read_bytes()
        with self.assertRaises((ValueError, OSError)):
            expression()
        self.assertEqual(self.outbox.read_bytes(), before)

    def test_missing_image_is_blocked_before_any_browser_send(self):
        for edition in ('morning', 'evening'):
            (self.root / 'content/news/articles' / f'2026-10-29-{edition}-arc-3.json').write_text(json.dumps(self.article))
            post = x.edition_post(edition, '2026-10-29', self.root)
            self.assertEqual(post['state'], 'blocked')
            self.assertEqual(post['blocker'], 'missing-edition-artwork')
        self.post.pop('media')
        self.save()
        self.assert_rejected_without_mutation(lambda: self.begin(sha='fake'))

    def test_visual_attachment_review_is_required(self):
        self.assert_rejected_without_mutation(lambda: self.begin(reviewed=False))
        self.assert_rejected_without_mutation(lambda: self.begin(sha='wrong-image'))

    def test_deleted_or_replaced_png_is_rejected_even_with_updated_hash(self):
        image = Path(self.post['media']['path'])
        image.unlink()
        self.assert_rejected_without_mutation(self.begin)
        Image.new('RGB', (12, 6), 'blue').save(image)
        self.post['media']['sha256'] = x.file_sha(image)
        self.save()
        self.assert_rejected_without_mutation(self.begin)

    def test_wrong_link_and_unrelated_cover_are_rejected(self):
        original = copy.deepcopy(self.post)
        for change in (lambda p: p.update(link='https://example.com/wrong'),
                       lambda p: p['media'].update(artworkId='old-cover')):
            self.post = copy.deepcopy(original)
            change(self.post)
            self.save()
            self.assert_rejected_without_mutation(self.begin)

    def test_missing_approval_bot_and_wrong_preview_are_rejected(self):
        original = copy.deepcopy(self.post)
        for change in (lambda p: p.pop('approval'), lambda p: p.pop('discord'),
                       lambda p: p['approval'].update(userIsBot=True),
                       lambda p: p['approval'].update(messageId='another-preview'),
                       lambda p: p['approval'].update(imageSha256='old-image')):
            self.post = copy.deepcopy(original)
            change(self.post)
            self.save()
            self.assert_rejected_without_mutation(self.begin)

    def test_approved_exact_attachment_can_begin_only_once(self):
        post = self.begin()
        self.assertEqual(post['state'], 'posting')
        self.assertEqual(post['postingReview']['imageSha256'], self.post['media']['sha256'])
        self.assert_rejected_without_mutation(self.begin)

    def feature(self):
        folder = self.root / 'content/news'
        (folder / 'dispatches').mkdir()
        (folder / 'artwork').mkdir()
        image = self.root / 'client/public/news-images/feature.webp'
        image.parent.mkdir(parents=True)
        image.write_bytes(Path(self.expected['sourcePath']).read_bytes())
        feature = {'id': 'reserved-feature', 'competition': 'arc-3', 'headline': 'Meet the dancers',
                   'image': {'src': '/news-images/feature.webp', 'alt': 'Four dancers', 'caption': 'The reviewed cover'}}
        (folder / 'dispatches/reserved-feature.json').write_text(json.dumps(feature))
        native = {'id': 'cover-v1', 'kind': 'native-generation', 'tool': 'image_gen.imagegen',
                  'rawSrc': feature['image']['src'], 'rawSha256': x.file_sha(image)}
        (folder / 'artwork/cover-v1.json').write_text(json.dumps(native))
        (folder / 'artwork-inventory.json').write_text(json.dumps({'images': [
            {'articleUses': [feature['id']], 'generationRecord': native['id']}]}))
        self.article.update(frontPageFeatureId=feature['id'], sources=[{'id': 'dispatch-' + feature['id']}])
        (folder / 'articles' / (self.article_id + '.json')).write_text(json.dumps(self.article))
        return image

    def test_reserved_feature_cover_passes_real_provenance_and_handoff(self):
        self.feature()
        self.post['media'] = x.edition_media(self.article, self.root)
        self.assertEqual(self.post['media']['featureHeadline'], 'Meet the dancers')
        x.prepare_media(self.post, self.outbox)
        self.save()
        # No mocked validator: resolve the real native cover through the published feature.
        result = x.begin_posting(self.outbox, self.post['media']['sha256'], True, self.root)
        self.assertEqual(result['state'], 'posting')

    def test_reserved_cover_rejects_changed_bytes_or_missing_feature_citation(self):
        image = self.feature()
        self.article['sources'] = []
        with self.assertRaisesRegex(ValueError, 'does not cite'):
            x.edition_media(self.article, self.root)
        self.article['sources'] = [{'id': 'dispatch-reserved-feature'}]
        image.write_bytes(b'changed cover')
        with self.assertRaisesRegex(ValueError, 'provenance'):
            x.edition_media(self.article, self.root)

    def test_preparation_failure_saves_blocked_outbox_and_returns_nonzero(self):
        with patch.object(x, 'edition_post', return_value=copy.deepcopy(self.post)), \
                patch.object(x, 'prepare_media', side_effect=OSError('attachment conversion failed')):
            self.assertEqual(x.main(['--edition', 'evening', '--output', str(self.outbox)]), 2)
        saved = json.loads(self.outbox.read_text())
        self.assertEqual(saved['state'], 'blocked')
        self.assertIn('attachment conversion failed', saved['reason'])


if __name__ == '__main__':
    unittest.main()
