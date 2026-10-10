# Author: Claude Opus 5.5
# Date: 2026-10-09
# PURPOSE: The wire desk helper (scripts/newsroom_wire.py) and the edition post (scripts/newsroom_x.py
# --edition): a brief built from a small market digest offers leads, sources, people and pictures;
# validation accepts a story whose figures all come from the brief and rejects invented or rounded
# figures, overclaims, spelled-out figures, unoffered pictures, unknown teams or people and stale
# briefs; publication is immutable and marks its leads covered; the edition post is labeled Early
# or Late, fits X and waits for its link.
# SRP/DRY check: Pass — exercises the production helpers against temporary content directories.
import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import newsroom as n
import newsroom_wire as wire
import newsroom_x as x

NOW = n.stamp('2026-10-10T00:20:00Z')
iso_now = lambda: n.iso(NOW)
FETCHED = '2026-10-09T23:54:00Z'
SINCE = '2026-10-08T23:51:00Z'
URL = 'https://example.com/verified-profile'


def row(rank, tid, name, score, rank_then, score_then, members, new=False):
    return {'rank': rank, 'teamId': tid, 'name': name, 'score': score, 'submissions': 5, 'members': members,
            'rankThen': rank_then, 'scoreThen': score_then, 'isNew': new}


def markets():
    chen = row(1, '11', 'Yi-Chia Chen', 59.17, 2, 55.77, ['threerabbits'])
    tufa = row(2, '12', 'Tufa Labs', 56.52, 1, 55.89, ['driessmit1'])
    climber = row(3, '13', 'SparseTech', 37.98, 391, 29.33, ['aaron'])
    newcomer = row(4, '14', 'Ryo Takaki', 33.31, None, None, ['ryo'], new=True)
    bubble = row(6, '16', 'Bubble Team', 32.9, 4, 32.9, ['bub'])
    line = lambda rank, now, then: {'rank': rank, 'now': now, 'then': then, 'weekAgo': None}
    board = {'competition': 'arc-3', 'label': 'ARC-AGI-3', 'boardPath': '/kaggle-leaderboard', 'fetched': FETCHED, 'since': SINCE,
             'weekSince': None, 'closeAt': '2026-11-02T23:59:00Z', 'teams': 1000, 'teamsThen': 950,
             'medalRanks': {'gold': 5, 'silver': 50, 'bronze': 100},
             'lines': {'top': line(1, 59.17, 55.89), 'gold': line(5, 33.0, 32.5), 'silver': line(50, 27.0, 26.0), 'bronze': line(100, 22.0, 21.0)},
             'leader': {'row': chen, 'leadBy': 2.65, 'heldSince': '2026-10-09T03:51:00Z', 'previous': tufa},
             'standings': [chen, tufa, climber, newcomer, bubble], 'gainers': [climber, chen, tufa], 'climbers': [climber],
             'newcomers': [newcomer], 'intoGold': [climber], 'outOfGold': [bubble], 'bubble': [bubble],
             'improved': 3, 'newcomerCount': 1, 'watch': []}
    return {'generatedAt': FETCHED, 'boards': {'arc-3': board}}


def ledger(root):
    person = {'id': 'yi-chia-chen', 'name': 'Yi-Chia Chen',
              'accounts': [{'platform': 'kaggle', 'handle': 'threerabbits', 'url': 'https://www.kaggle.com/threerabbits', 'sourceUrl': URL, 'sourceTitle': 'Profile link', 'checkedAt': '2026-10-08T12:00:00Z'}],
              'facts': [], 'memberships': [], 'hallOfFame': [],
              'portrait': {'src': '/news-images/people/yi-chia-chen.webp', 'alt': 'Yi-Chia Chen’s Kaggle profile picture', 'kind': 'kaggle',
                           'sourceUrl': 'https://www.kaggle.com/threerabbits', 'sourceTitle': 'Yi-Chia Chen — Kaggle profile picture', 'checkedAt': '2026-10-09T21:00:00Z'}}
    news = Path(root) / 'content/news'
    news.mkdir(parents=True)
    (news / 'people.json').write_text(json.dumps([person]))
    (news / 'competitors.json').write_text('[]')
    (news / 'social.json').write_text('[]')
    pictures = Path(root) / 'client/public/news-images/people'
    pictures.mkdir(parents=True)
    (pictures / 'yi-chia-chen.webp').write_bytes(b'RIFF')


def story(brief):
    picture = next(item for item in brief['boards']['arc-3']['visuals'] if item['personId'] == 'yi-chia-chen')
    return {'competition': 'arc-3', 'slug': 'chen-takes-the-lead', 'leadIds': ['lead-change', 'person-yi-chia-chen'],
            'headline': 'Yi-Chia Chen takes the ARC-AGI-3 lead from Tufa Labs',
            'sections': [{'text': 'Yi-Chia Chen gained 3.40 points to 59.17% and moved to 1st. Tufa Labs, 1st a day earlier, is 2nd at 56.52.', 'sourceIds': ['board-arc-3']},
                         {'text': 'The gold line rose 0.50 to 33.00 at 5th place, and the board reached 1,000 teams.', 'sourceIds': ['board-arc-3']}],
            'teamIds': ['11', '12'], 'personIds': ['yi-chia-chen'],
            'visual': {key: picture[key] for key in ('src', 'alt', 'href')}}


class WireDeskTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        ledger(self.root)
        self.brief = wire.prepare(fetcher=lambda url: (markets(), 'f' * 64), actual_now=NOW, root=self.root)

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_brief_offers_leads_people_pictures_and_figures(self):
        board = self.brief['boards']['arc-3']
        self.assertEqual(board['status'], 'ready')
        leads = {item['id']: item for item in board['leads']}
        self.assertIn('Yi-Chia Chen took first place from Tufa Labs', leads['lead-change']['text'])
        self.assertIn('yi-chia-chen', leads['lead-change']['personIds'])
        for lid in ('gold-line', 'field', 'gain-13', 'new-14', 'into-gold-13', 'out-of-gold-16', 'person-yi-chia-chen'):
            self.assertIn(lid, leads)
        self.assertEqual([item['src'] for item in board['visuals']], ['/news-images/people/yi-chia-chen.webp'])
        self.assertIn('59.17', board['numbers']['figures'])
        self.assertIn('391', board['numbers']['counts'])
        self.assertEqual(self.brief['boards']['arc-2']['status'], 'error')

    def test_valid_story_and_rejections(self):
        good = story(self.brief)
        self.assertEqual(wire.validate(good, self.brief, NOW)['competition'], 'arc-3')
        cases = {
            'rounded figure': ('sections', 0, '59.17%', '59.2%'),
            'invented margin': ('sections', 1, 'teams.', 'teams, 12 points clear.'),
            'spelled figure': ('sections', 1, 'teams.', 'teams, twenty of them new.'),
            'overclaim': ('headline', None, 'takes', 'clinches'),
            'another team\'s figure': ('sections', 1, 'teams.', 'teams; SparseTech sits at 37.98.'),
        }
        for label, (field, index, old, new) in cases.items():
            bad = copy.deepcopy(good)
            if index is None:
                bad[field] = bad[field].replace(old, new)
            else:
                bad[field][index]['text'] = bad[field][index]['text'].replace(old, new)
            with self.assertRaises(ValueError, msg=label):
                wire.validate(bad, self.brief, NOW)
        for key, value in (('visual', {'src': '/jackCole2.png', 'alt': 'x', 'href': '/hall-of-fame'}), ('teamIds', ['99']),
                           ('personIds', ['someone-else']), ('leadIds', ['made-up'])):
            bad = copy.deepcopy(good)
            bad[key] = value
            with self.assertRaises(ValueError, msg=key):
                wire.validate(bad, self.brief, NOW)
        with self.assertRaises(ValueError):
            wire.validate(good, self.brief, n.stamp('2026-10-10T04:00:00Z'))
        tampered = copy.deepcopy(self.brief)
        tampered['boards']['arc-3']['numbers']['figures'].append('12')
        with self.assertRaises(ValueError):
            wire.validate(good, tampered, NOW)

    def test_publication_is_immutable_and_marks_leads_covered(self):
        path = wire.publish(story(self.brief), self.brief, root=self.root, now=NOW)
        published = json.loads(path.read_text())
        self.assertEqual(published['id'], '2026-10-09-2020-arc-3-chen-takes-the-lead')
        self.assertEqual(published['generatedBy'], 'gpt-6-luna')
        self.assertEqual([source['id'] for source in published['sources']], ['board-arc-3'])
        self.assertEqual((published['dataAsOf'], published['since']), (FETCHED, SINCE))
        proof = json.loads((Path(self.root) / 'content/news/wire-evidence' / path.name).read_text())
        self.assertEqual(proof['board']['fetched'], FETCHED)
        with self.assertRaises(ValueError):
            wire.publish(story(self.brief), self.brief, root=self.root, now=NOW)
        later = wire.prepare(fetcher=lambda url: (markets(), 'f' * 64), actual_now=NOW, root=self.root)
        covered = {item['id'] for item in later['boards']['arc-3']['leads'] if item['covered']}
        self.assertEqual(covered, {'lead-change', 'person-yi-chia-chen'})
        # Files from older dates are never opened, whatever they contain.
        stale = Path(self.root) / 'content/news/wire-evidence' / '2026-10-01-0900-arc-3-old.json'
        stale.write_text(json.dumps({**proof, 'publishedAt': iso_now(), 'leads': [{'id': 'gold-line', 'text': 'x'}]}))
        self.assertNotIn('gold-line', wire.recent_coverage(self.root, 'arc-3', NOW))


class EditionPostTests(unittest.TestCase):
    def article(self, root, competition, headline, edition='evening'):
        path = Path(root) / 'content/news/articles' / f'2026-10-09-{edition}-{competition}.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'id': path.stem, 'headline': headline}))

    def test_late_and_early_edition_posts(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(x.edition_post('evening', '2026-10-09', root)['state'], 'waiting')
            self.article(root, 'arc-3', 'Yi-Chia Chen takes ARC-3 lead as mtg climbs to third')
            self.article(root, 'arc-2', 'Tufa Labs lifts ARC-2 public high to 88.06%')
            post = x.edition_post('evening', '2026-10-09', root)
            self.assertEqual(post['state'], 'draft')
            self.assertEqual(post['message'].splitlines()[0], 'The ARC Daily Digest · Late edition')
            self.assertIn('ARC-AGI-2: Tufa Labs', post['message'])
            self.assertTrue(post['message'].endswith('https://arc.markbarney.net/news/2026-10-09-evening-arc-3'))
            self.article(root, 'arc-3', 'A' * 200, edition='morning')
            self.article(root, 'arc-2', 'B' * 200, edition='morning')
            early = x.edition_post('morning', '2026-10-09', root)
            self.assertTrue(early['message'].startswith('The ARC Daily Digest · Early edition'))
            self.assertNotIn('ARC-AGI-2:', early['message'])
            self.assertLessEqual(x.x_weight(early['message'], early['link']), 280)

    def test_waits_for_the_link(self):
        answers = [False, False, True]
        self.assertTrue(x.wait_until_live('u', patience=60, interval=30, check=lambda url: answers.pop(0), sleep=lambda seconds: None))
        self.assertFalse(x.wait_until_live('u', patience=60, interval=30, check=lambda url: False, sleep=lambda seconds: None))


if __name__ == '__main__':
    unittest.main()
