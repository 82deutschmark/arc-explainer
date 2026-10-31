# Author: Claude Sonnet 5.5 Medium
# Date: 31-October-2026
# PURPOSE: Guards the Weekend Magazine tooling (scripts/weekend_magazine.py): the top-ten maths and Eastern-time wording,
# the region rewriting, the one-line shakeup commands and their refusals, the pre-push gate, and the real pages themselves
# (no bare web addresses, no ruled-out disclaimers, every local link and image present, ten rows per top-ten table).
# SRP/DRY check: Pass - tests only; the fixtures are tiny boards in the same shape the board API serves.
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import weekend_magazine as wm  # noqa: E402


def make_board(contest, fetched='2026-10-31T19:28:52Z', count=12):
    rows = [[i, f'{contest}{i:02d}', f'Team {i}', '2026-10-30 14:01:26', 90.0 - i, 10 + i, f'user{i}a,user{i}b' if i % 2 else f'solo{i}', i + (2 if i == 5 else 0), 90.0 - i - (1.5 if i == 5 else 0)]
            for i in range(1, count + 1)]
    rows[2][2] = 'nvbanana'
    rows[3][2] = 'Team Turducken'
    events = [{'t': '2026-10-09T05:21:54Z', 'id': f'{contest}01', 'name': 'Team 1', 'from': 80.0, 'to': 89.0, 'rankFrom': 3, 'rankTo': 1},
              {'t': '2026-10-30T22:25:32Z', 'id': f'{contest}01', 'name': 'Team 1', 'from': 89.0, 'to': 89.0001, 'rankFrom': 1, 'rankTo': 1},
              {'t': '2026-10-31T18:58:49Z', 'id': f'{contest}05', 'name': 'Team 5', 'from': 83.5, 'to': 85.0, 'rankFrom': 7, 'rankTo': 5}]
    return {'competition': f'arc-{contest}', 'events': events,
            'latest': {'fetched': fetched, 'medalRanks': {'gold': 17, 'silver': 178, 'bronze': 356}, 'rows': rows}}


class TimeAndRows(unittest.TestCase):
    def test_pretty_et_wording_and_daylight_time(self):
        now = datetime(2026, 10, 31, 19, 28, tzinfo=timezone.utc)                    # Saturday 3:28 pm EDT
        self.assertEqual(wm.pretty_et(datetime(2026, 10, 31, 18, 58, tzinfo=timezone.utc), now), 'Today 2:58 pm')
        self.assertEqual(wm.pretty_et(datetime(2026, 10, 29, 18, 52, tzinfo=timezone.utc), now), 'Thu 2:52 pm')
        self.assertEqual(wm.pretty_et(datetime(2026, 10, 9, 5, 21, tzinfo=timezone.utc), now), 'Oct 9, 1:21 am')
        self.assertEqual(wm.stamp_et(now), 'Sat 3:28 pm ET')

    def test_the_bell_is_6_59_pm_eastern_on_standard_time(self):
        table = wm.zones_region()
        self.assertIn('New York</td><td>Mon 6:59 pm (UTC-5)', table)
        self.assertIn('Los Angeles</td><td>Mon 3:59 pm (UTC-8)', table)
        self.assertIn('Kolkata</td><td>Tue 5:29 am (UTC+5.5)', table)
        self.assertIn('Tokyo</td><td>Tue 8:59 am (UTC+9)', table)

    def test_top_rows_gives_ten_and_the_time_the_current_score_landed(self):
        board = make_board('2')
        rows = wm.top_rows(board)
        self.assertEqual([r['rank'] for r in rows], list(range(1, 11)))
        self.assertEqual(rows[0]['reached'], datetime(2026, 10, 9, 5, 21, 54, tzinfo=timezone.utc))   # 89.0 landed Oct 9; the 89.0001 blip is not the score
        self.assertEqual(rows[4]['reached'], datetime(2026, 10, 31, 18, 58, 49, tzinfo=timezone.utc))
        self.assertIsNone(rows[1]['reached'])

    def test_board_table_marks_nvidia_ours_and_movers(self):
        table = wm.board_table('ARC-2', make_board('2'))
        self.assertEqual(table.count('<tr'), 10)
        self.assertIn('<tr class="nv"><td>3</td><td>nvbanana', table)
        self.assertIn('<tr class="us"><td>4</td><td>Team Turducken', table)
        self.assertIn('▲2', table)                          # team 5 climbed two places
        self.assertIn('+1.50', table)
        self.assertIn('as of Sat 3:28 pm ET', table)
        self.assertIn('one-person team', table)
        self.assertIn('2 accounts', table)


class Regions(unittest.TestCase):
    def test_replace_region_is_exact_and_idempotent(self):
        text = 'a<!-- BEGIN:x -->old<!-- END:x -->b'
        once = wm.replace_region(text, 'x', 'new')
        self.assertEqual(once, 'a<!-- BEGIN:x -->new<!-- END:x -->b')
        self.assertEqual(wm.replace_region(once, 'x', 'new'), once)
        with self.assertRaises(ValueError):
            wm.replace_region('no markers', 'x', 'new')
        with self.assertRaises(ValueError):
            wm.replace_region(text + text, 'x', 'new')

    def test_refresh_rewrites_only_marked_regions(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            offline = tmp / 'boards'
            offline.mkdir()
            for c in ('2', '3'):
                (offline / f'board{c}.json').write_text(json.dumps(make_board(c)))
            page = tmp / 'cover.html'
            page.write_text('<p>keep me</p><!-- BEGIN:scoreboard -->stale<!-- END:scoreboard --><p>asof <!-- BEGIN:asof -->old<!-- END:asof --></p>')
            saved = (wm.PAGES, wm.DATA)
            wm.PAGES, wm.DATA = [page], tmp / 'data'
            try:
                touched, as_of = wm.refresh(str(offline), now=datetime(2026, 10, 31, 19, 40, tzinfo=timezone.utc))
            finally:
                wm.PAGES, wm.DATA = saved
            out = page.read_text()
            self.assertEqual(touched, ['cover.html'])
            self.assertIn('<p>keep me</p>', out)
            self.assertNotIn('stale', out)
            self.assertIn('data-contest="2"', out)
            self.assertIn('Sat 3:28 pm ET<!-- END:asof -->', out)
            snapshot = json.loads((tmp / 'data/scoreboard.json').read_text())
            self.assertEqual(len(snapshot['contests']['arc-2']['top']), 10)
            self.assertEqual(snapshot['asOf'], '2026-10-31T19:28:52Z')

    def test_who_rows_follow_handles_across_contests(self):
        ledger = wm.Ledger()
        boards = {'2': make_board('2'), '3': make_board('3')}
        boards['2']['latest']['rows'][1][6] = 'cpmpml,darraghdog'      # a real ledger pair on a fixture team
        html_rows = wm.who_region(boards, ledger)
        self.assertIn('Jean-François Puget', html_rows)
        self.assertIn('#2 Team 2', html_rows)


class Shakeups(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.saved = wm.DATA
        wm.DATA = self.tmp

    def tearDown(self):
        wm.DATA = self.saved
        shutil.rmtree(self.tmp)

    def test_breaking_writes_and_clears(self):
        body = wm.set_breaking('Deadline moves', text='Kaggle posted it.', url='/specials/weekend/final-hours.html', link_text='The Final Hours', at='2026-11-01T12:00:00Z')
        self.assertTrue(json.loads((self.tmp / 'breaking.json').read_text())['active'])
        self.assertEqual(body['link']['url'], '/specials/weekend/final-hours.html')
        wm.clear_breaking()
        self.assertEqual(json.loads((self.tmp / 'breaking.json').read_text()), {'active': False})

    def test_refuses_bare_addresses_bad_links_and_long_text(self):
        with self.assertRaises(ValueError):
            wm.set_breaking('See https://example.com now')
        with self.assertRaises(ValueError):
            wm.add_ticker('Read this http://example.com')
        with self.assertRaises(ValueError):
            wm.add_ticker('ok', url='javascript:alert(1)')
        with self.assertRaises(ValueError):
            wm.add_ticker('x' * 281)
        with self.assertRaises(ValueError):
            wm.add_ticker('   ')

    def test_ticker_is_newest_first_and_capped(self):
        for minute in range(5):
            wm.add_ticker(f'line {minute}', at=f'2026-10-31T19:0{minute}:00Z', keep=3)
        items = json.loads((self.tmp / 'ticker.json').read_text())['items']
        self.assertEqual([i['text'] for i in items], ['line 4', 'line 3', 'line 2'])


class Gate(unittest.TestCase):
    def test_check_flags_each_kind_of_problem(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / 'bad.html'
            bad.write_text('<p>See https://arc.markbarney.net/news for the editorial illustration.</p><img src="/specials/img/nope.webp" alt="x"><img src="/specials/img/nope2.webp">')
            problems = wm.check([bad])
            joined = ' | '.join(problems)
            self.assertIn('bare web address', joined)
            self.assertIn("forbidden phrase 'editorial illustration'", joined)
            self.assertIn('image without alt text', joined)
            self.assertIn('missing local file /specials/img/nope.webp', joined)

    def test_the_real_magazine_is_safe_to_publish(self):
        problems = wm.check()
        self.assertEqual(problems, [], problems)

    def test_real_scoreboards_show_places_one_through_ten(self):
        for page in (wm.SPECIALS / 'weekend.html',):
            raw = page.read_text()
            for contest in ('2', '3'):
                self.assertRegex(raw, rf'data-contest="{contest}"')
            self.assertGreaterEqual(raw.count('<td>10</td>'), 2)


if __name__ == '__main__':
    unittest.main()
