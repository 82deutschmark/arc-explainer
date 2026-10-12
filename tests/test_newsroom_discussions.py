# Author: GPT-6.1 Sol / Codex
# Date: 2026-10-12
# PURPOSE: Verify discussion selection, incremental replies, immutable personal delivery and
# coverage watermarks without browser/network calls; preserve the existing X archive.
# SRP/DRY check: Pass — exercises the existing social desk's production archive helper.
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import newsroom_social as s


class DiscussionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.now = s.stamp('2026-10-12T17:00:00Z')
        self.thread = {'id': '748593', 'competition': 'arc-3', 'url': 'https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/748593',
                       'title': 'A training question', 'author': 'dzjiann', 'authorName': 'A public author', 'postedAt': '2026-10-12T16:30:00Z',
                       'latestActivityAt': '2026-10-12T16:30:00Z', 'commentCount': 0, 'checkedAt': '2026-10-12T16:59:00Z',
                       'visibility': 'public', 'bodyRead': True, 'summary': 'The author asks about training stability.', 'decision': 'paper-lead',
                       'reason': 'A sourced research lead.', 'personIds': []}
        self.coverage = {'status': 'ok', 'coveredFrom': '2026-10-05T17:00:00Z', 'coveredThrough': '2026-10-12T16:59:00Z',
                         'checkedAt': '2026-10-12T16:59:00Z', 'detail': 'Both new-topic and recent-comment views checked through the boundary.'}

    def ingest(self, thread=None, coverage=None):
        return s.ingest_discussions({'version': 1, 'researchedAt': s.iso(self.now), 'threads': [thread or self.thread],
                                     'boards': {'arc-3': coverage or self.coverage}}, self.root, self.now)

    def test_unread_or_unknown_material_cannot_be_a_paper_lead(self):
        for bad in [{**self.thread, 'bodyRead': False, 'summary': ''}, {**self.thread, 'visibility': 'unknown'}]:
            with self.assertRaisesRegex(ValueError, 'read public evidence'):
                s.validate_discussion(bad, self.now)

    def test_wrong_competition_permalink_and_future_times_fail(self):
        for bad in [{**self.thread, 'competition': 'arc-2'}, {**self.thread, 'latestActivityAt': '2026-10-13T00:00:00Z'}]:
            with self.assertRaises(ValueError):
                s.validate_discussion(bad, self.now)

    def test_partial_scan_preserves_the_last_complete_watermark(self):
        self.ingest()
        old = s.state_at(self.root)['discussionBoards']['arc-3']['lastSuccessfulAt']
        self.ingest(coverage={**self.coverage, 'status': 'partial', 'coveredThrough': '2026-10-12T17:00:00Z', 'checkedAt': '2026-10-12T17:00:00Z'})
        self.assertEqual(s.state_at(self.root)['discussionBoards']['arc-3']['lastSuccessfulAt'], old)

    def test_new_replies_require_a_fresh_read_before_public_export(self):
        self.ingest()
        self.assertEqual(s.export_discussions(self.root, self.root, self.now), 1)
        listing = {**self.thread, 'checkedAt': s.iso(self.now), 'latestActivityAt': '2026-10-12T16:59:30Z', 'commentCount': 1,
                   'bodyRead': False, 'summary': '', 'decision': 'watch-only'}
        self.ingest(listing)
        self.assertEqual(s.export_discussions(self.root, self.root, self.now), 0)
        self.assertTrue(s.state_at(self.root)['discussionThreads']['arc-3-748593']['summary'])

    def test_unchanged_listing_preserves_the_original_read_time(self):
        self.ingest()
        self.ingest({**self.thread, 'checkedAt': s.iso(self.now), 'bodyRead': False, 'summary': '', 'decision': 'watch-only'})
        s.export_discussions(self.root, self.root, self.now)
        self.assertEqual(s.load(self.root / 'content/news/discussions.json')[0]['checkedAt'], self.thread['checkedAt'])

    def test_retries_do_not_repeat_delivered_activity_but_new_replies_do(self):
        self.ingest()
        path = s.discussion_brief(self.root, 'morning', self.now)
        before = path.read_bytes()
        self.assertEqual(s.discussion_brief(self.root, 'morning', self.now).read_bytes(), before)
        quiet = s.discussion_brief(self.root, 'evening', self.now)
        self.assertNotIn('**[A training question]', quiet.read_text())
        self.now += s.timedelta(days=1)
        changed = {**self.thread, 'checkedAt': s.iso(self.now), 'latestActivityAt': s.iso(self.now), 'commentCount': 2}
        self.ingest(changed)
        self.assertIn('**[A training question]', s.discussion_brief(self.root, 'morning', self.now).read_text())

    def test_interactive_preview_does_not_reserve_the_scheduled_delivery_key(self):
        self.ingest()
        preview = s.discussion_brief(self.root, 'evening', self.now, preview=True)
        self.assertIn('-preview-', preview.name)
        self.assertNotIn('2026-10-12-evening', s.state_at(self.root)['discussionDeliveries'])

    def test_discussion_intake_preserves_existing_x_archive_and_citations_are_scoped(self):
        s.save(self.root / 'state.json', {'version': 1, 'posts': {'existing': {'private': 'untouched'}}, 'accounts': {}, 'deliveries': {'earlier': {}}})
        self.ingest()
        self.assertEqual(s.state_at(self.root)['posts'], {'existing': {'private': 'untouched'}})
        s.export_discussions(self.root, self.root, self.now)
        for comp, count in [('arc-3', 1), ('arc-2', 0)]:
            item = {'articleBase': {'sources': []}, 'evidence': {}}
            s.add_discussion_sources(item, comp, self.now, self.root)
            self.assertEqual(len(item['articleBase']['sources']), count)


if __name__ == '__main__':
    unittest.main()
