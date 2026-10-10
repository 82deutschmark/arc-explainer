# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Verify newsroom time boundaries, incomplete coverage, article and dispatch contracts, immutable publication, isolated from current research.
# SRP/DRY check: Pass — exercises production preparation/validation/publication functions.
import copy
from datetime import timedelta
import importlib.util
from pathlib import Path
import tempfile
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))

SPEC = importlib.util.spec_from_file_location('newsroom', Path(__file__).parents[1] / 'scripts/newsroom.py')
n = importlib.util.module_from_spec(SPEC)
sys.modules['newsroom'] = n
SPEC.loader.exec_module(n)


def fixture(comp='arc-3', latest='2026-10-07T21:40:00Z'):
    return {'competition': f'arc-prize-2026-{comp.replace("arc-", "arc-agi-")}',
            'latest': {'fetched': latest, 'rows': [[1, '1', 'Alpha', '', 12, 4, 'alpha'],
                                                  [2, '2', 'Beta', '', 11, 2, 'beta']]},
            'history': {'snaps': [{'t': '2026-10-06T21:40:00Z', 'teams': 500, 'top': 11},
                                  {'t': '2026-10-06T23:40:00Z', 'teams': 500, 'top': 11},
                                  {'t': latest, 'teams': 501, 'top': 12}],
                        'trails': {'1': {'pts': [['2026-10-06T21:40:00Z', 10, 2], [latest, 12, 1]]},
                                   '2': {'pts': [['2026-10-06T21:40:00Z', 11, 1], [latest, 11, 2]]}}},
            'events': []}


def bundle(preview=False):
    def fetch(url):
        return fixture('arc-2' if 'agi-2' in url else 'arc-3'), '0' * 64
    return n.prepare('evening', fetcher=fetch, actual_now=n.stamp('2026-10-07T22:00:00Z'), preview=preview)


def draft(brief):
    return {'id': brief['competitions']['arc-3']['articleBase']['id'], 'headline': 'Alpha leads',
            'dek': 'The standings tighten.', 'sections': [{'text': 'Alpha holds the lead.', 'sourceIds': ['board']}],
            'teamIds': ['1'], 'discord': 'Alpha leads. @everyone'}


class NewsroomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Historical board fixtures must not consume today's independently checked social posts.
        cls.content = tempfile.TemporaryDirectory()
        cls.original_root = n.ROOT
        n.ROOT = Path(cls.content.name)

    @classmethod
    def tearDownClass(cls):
        n.ROOT = cls.original_root
        cls.content.cleanup()

    def test_dst_previous_evening_uses_local_date(self):
        _, end, begin, _ = n.windows('evening', n.stamp('2026-03-08T23:00:00Z'))
        self.assertEqual(n.iso(end), '2026-03-08T22:00:00Z')
        self.assertEqual(n.iso(begin), '2026-03-07T23:00:00Z')
        self.assertEqual(end - begin, timedelta(hours=23))
        _, end, begin, _ = n.windows('evening', n.stamp('2026-11-01T23:00:00Z'))
        self.assertEqual(end - begin, timedelta(hours=25))

    def test_morning_utc_midnight_and_early_preview(self):
        _, end, begin, early = n.windows('morning', n.stamp('2026-10-07T11:30:00Z'))
        self.assertEqual(n.iso(end), '2026-10-07T10:00:00Z')
        self.assertEqual(n.iso(begin), '2026-10-07T00:00:00Z')
        self.assertFalse(early)
        _, end, _, early = n.windows('morning', n.stamp('2026-10-07T09:00:00Z'))
        self.assertTrue(early)
        self.assertEqual(n.iso(end), '2026-10-07T09:00:00Z')

    def test_delayed_run_never_uses_future_cutoff_observation(self):
        b = fixture(latest='2026-10-07T22:40:00Z')
        b['history']['snaps'].insert(2, {'t': '2026-10-07T21:40:00Z', 'teams': 500, 'top': 11})
        result = n.board_brief(b, 'arc-3', 'evening', n.stamp('2026-10-07T23:00:00Z'),
                               n.stamp('2026-10-07T23:00:00Z'), 'https://example.com', 'hash')
        self.assertEqual(result['articleBase']['dataAsOf'], '2026-10-07T21:40:00Z')
        self.assertTrue(all(s['score'] <= 11 for s in result['articleBase']['stats']))

    def test_unknown_baseline_not_zero_and_no_precoverage(self):
        b = fixture()
        b['history']['snaps'] = b['history']['snaps'][-1:]
        result = n.board_brief(b, 'arc-3', 'evening', n.stamp('2026-10-07T22:00:00Z'),
                               n.stamp('2026-10-07T22:00:00Z'), 'https://example.com', 'hash')
        self.assertIsNone(result['articleBase']['baselineAt'])
        self.assertTrue(all(s['scoreChange'] is None for s in result['articleBase']['stats']))
        self.assertIsNone(n.observation('3', [301, '3', '', '', 5], {'pts': [['2026-10-07T20:00:00Z', 5, 299]]},
                                         n.stamp('2026-10-07T21:00:00Z'), n.stamp('2026-10-07T22:00:00Z'), None))
        self.assertIsNone(n.observation('3', [1, '3', '', '', 12], {'pts': [['2026-10-07T21:00:00Z', 12, 1]]},
                                         n.stamp('2026-10-07T20:00:00Z'), n.stamp('2026-10-07T22:00:00Z'), None))

    def test_top300_possible_exit_reentry_gap_is_unknown(self):
        trail = {'pts': [['2026-10-07T10:00:00Z', 5, 299], ['2026-10-07T20:00:00Z', 20, 10]]}
        self.assertIsNone(n.observation('3', [10, '3', '', '', 20], trail, n.stamp('2026-10-07T18:00:00Z'),
                                         n.stamp('2026-10-07T22:00:00Z'), None))

    def test_failures_are_independent_and_actual_time_controls_freshness(self):
        def fetch(url):
            if 'agi-2' in url:
                raise ValueError('unavailable')
            return fixture(), 'hash'
        brief = n.prepare('evening', fetcher=fetch, actual_now=n.stamp('2026-10-07T22:00:00Z'))
        self.assertEqual(brief['competitions']['arc-3']['status'], 'ready')
        self.assertEqual(brief['competitions']['arc-2']['status'], 'error')
        stale = n.prepare('evening', now=n.stamp('2026-10-07T22:00:00Z'), fetcher=fetch,
                          actual_now=n.stamp('2026-10-08T02:00:00Z'))
        self.assertIn('90 minutes', stale['competitions']['arc-3']['error'])
        future = n.prepare('evening', fetcher=lambda _: (fixture(latest='2026-10-07T22:01:00Z'), 'hash'),
                           actual_now=n.stamp('2026-10-07T22:00:00Z'))
        self.assertIn('future', future['competitions']['arc-3']['error'])

    def test_contract_sources_injected_stats_mentions_html_and_ids(self):
        b = bundle()
        d = draft(b)
        article, _ = n.validate(d, b)
        self.assertEqual(article['generatedBy'], 'gpt-6-sol')
        self.assertIn('@\u200beveryone', article['discord'])
        self.assertEqual(set(article), {'id', 'date', 'edition', 'competition', 'headline', 'dek', 'sections', 'teamIds',
                                      'sources', 'publishedAt', 'dataAsOf', 'baselineAt', 'generatedBy', 'stats', 'coverageNote', 'discord'})
        for mutate in (lambda x: x.update(stats=[]), lambda x: x.update(teamIds=['999']),
                       lambda x: x['sections'][0].update(sourceIds=['fake']),
                       lambda x: x.update(headline='<b>HTML</b>'), lambda x: x.update(discord='x' * 1901)):
            bad = copy.deepcopy(d)
            mutate(bad)
            with self.assertRaises(ValueError):
                n.validate(bad, b)
        changed = copy.deepcopy(b)
        changed['competitions']['arc-3']['articleBase']['stats'][0]['score'] = 999
        with self.assertRaisesRegex(ValueError, 'checksum'):
            n.validate(d, changed)

    def test_publish_idempotent_conflict_and_notebook_fact_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            b, d = bundle(), draft(bundle())
            path = n.publish(d, b, directory)
            original = path.read_bytes()
            notebook = Path(directory) / 'content/news/competitors.json'
            records = n.load(notebook)
            records[0]['facts'] = [{'text': 'Sourced fact', 'sourceUrl': 'https://example.com/profile',
                                    'sourceTitle': 'Profile', 'checkedAt': '2026-10-07T20:00:00Z'}]
            n.write(notebook, records)
            n.publish(d, b, directory)
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(n.load(notebook)[0]['facts'], records[0]['facts'])
            d['headline'] = 'Conflicting rewrite'
            with self.assertRaisesRegex(ValueError, 'immutable'):
                n.publish(d, b, directory)
            self.assertEqual(path.read_bytes(), original)

    def test_preview_id_does_not_collide(self):
        b = bundle(preview=True)
        self.assertTrue(b['competitions']['arc-3']['articleBase']['id'].endswith('-preview'))

    def test_dispatch_rejects_bad_citations_and_preserves_immutable_retry(self):
        dispatch = {'id': '2026-10-07-contender-post', 'competition': 'arc-3',
                    'publishedAt': '2026-10-07T22:00:00Z', 'headline': 'A contender speaks',
                    'sections': [{'text': 'A public announcement.', 'sourceIds': ['post']}],
                    'sources': [{'id': 'post', 'title': 'Primary post', 'url': 'https://example.com/post',
                                 'accessedAt': '2026-10-07T21:00:00Z'}]}
        n.validate_dispatch(dispatch)
        dispatch['sections'][0]['sourceIds'] = ['invented']
        with self.assertRaisesRegex(ValueError, 'citations'):
            n.validate_dispatch(dispatch)
        dispatch['sections'][0]['sourceIds'] = ['post']
        dispatch['image'] = {'src': '/news-images/../../private.png', 'alt': 'Image', 'caption': 'Caption'}
        with self.assertRaisesRegex(ValueError, 'image'):
            n.validate_dispatch(dispatch)
        del dispatch['image']
        dispatch['publishedAt'] = '2099-01-01T00:00:00Z'
        with self.assertRaisesRegex(ValueError, 'future'):
            n.validate_dispatch(dispatch)
        dispatch['publishedAt'] = '2026-10-07T22:00:00Z'
        with tempfile.TemporaryDirectory() as directory:
            target = n.publish_dispatch(dispatch, directory)
            original = target.read_bytes()
            n.publish_dispatch(dispatch, directory)
            dispatch['headline'] = 'Changed'
            with self.assertRaisesRegex(ValueError, 'immutable'):
                n.publish_dispatch(dispatch, directory)
            self.assertEqual(target.read_bytes(), original)


class BackupWriterTests(unittest.TestCase):
    def test_backup_desk_is_named_and_unknown_writers_refused(self):
        now = n.stamp('2026-10-07T22:00:00Z')
        made = lambda writer: n.board_brief(fixture(), 'arc-3', 'evening', now, now, 'https://example.com/board', '0' * 64, writer=writer)
        self.assertEqual(made('claude-haiku-5-5')['articleBase']['generatedBy'], 'claude-haiku-5-5')
        self.assertEqual(n.board_brief(fixture(), 'arc-3', 'evening', now, now, 'https://example.com/board', '0' * 64)['articleBase']['generatedBy'], 'gpt-6-sol')
        with self.assertRaises(ValueError):
            n.prepare('evening', fetcher=lambda url: (fixture(), '0' * 64), actual_now=now, writer='someone-else')

if __name__ == '__main__':
    unittest.main()
