# Author: Claude Opus 5.5
# Date: 02-November-2026
# PURPOSE: Guards the public run record: the builder passes on only times and public scores, unscored runs are counted but
# not plotted, and the real page carries nothing beyond the fields allowed here. A private note reaching this page is the
# failure this file exists to catch.
# SRP/DRY check: Pass - tests only; fixtures are tiny boards in the shape the board API serves.
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_public_run_record as rr  # noqa: E402

SECRET = 'PRIVATE-NOTE-keep192-holdout'
ALLOWED = {'contest', 'team', 'logToggle', 'yMax', 'lede', 'events', 'rank', 'teams', 'submitted', 'runs', 'gold'}


def submission(t, score):
    return {'submittedAt': t, 'publicScore': score, 'description': SECRET, 'submittedBy': SECRET, 'kernelRef': SECRET,
            'url': SECRET, 'error': SECRET, 'status': 'complete', 'key': SECRET, 'scriptVersionId': SECRET}


def board(team):
    return {'latest': {'fetched': '2026-11-02T01:00:00Z', 'rows': [[1, 'x', 'Leader', '', 90.0], [5, 'y', team, '', 50.0]]},
            'history': {'snaps': [{'t': '2026-10-08T01:00:00Z', 'gold': 30.0}, {'t': '2026-10-08T02:00:00Z', 'gold': 31.0}]}}


class Builder(unittest.TestCase):
    def setUp(self):
        subs = [submission('2026-10-02T00:00:00Z', 20.0), submission('2026-10-01T00:00:00Z', None), submission('2026-10-01T00:00:00Z', 10.0)]
        self.record = rr.build(lambda n: subs, lambda n: board('Team Turducken' if n == '3' else 'ARC Mutants'),
                               {'snaps': [{'t': '2026-04-01T00:00:00Z', 'gold': 1.0}, {'t': '2026-06-01T00:00:00Z', 'gold': 2.0}]}, {}, 'now')

    def test_no_private_field_reaches_the_output(self):
        self.assertNotIn(SECRET, json.dumps(self.record))
        for contest in self.record['contests'].values():
            self.assertEqual(set(contest), ALLOWED)

    def test_runs_are_time_and_score_oldest_first_and_unscored_runs_only_count(self):
        contest = self.record['contests']['arc2']
        self.assertEqual(contest['runs'], [['2026-10-01T00:00:00Z', 10.0], ['2026-10-02T00:00:00Z', 20.0]])
        self.assertEqual(contest['submitted'], 3)

    def test_gold_line_is_daily_and_arc3_starts_in_may(self):
        self.assertEqual(self.record['contests']['arc2']['gold'], [['2026-10-08T02:00:00Z', 31.0]])
        self.assertEqual(self.record['contests']['arc3']['gold'][0], ['2026-06-01T00:00:00Z', 2.0])


class RealPage(unittest.TestCase):
    def test_page_holds_only_allowed_fields_and_well_formed_runs(self):
        record = rr.read_record()
        self.assertEqual(record['order'], ['arc3', 'arc2'])
        for contest in record['contests'].values():
            self.assertEqual(set(contest), ALLOWED)
            for run in contest['runs']:
                self.assertEqual(len(run), 2)
                self.assertRegex(run[0], r'^2026-\d\d-\d\dT')
                self.assertIsInstance(run[1], float)


if __name__ == '__main__':
    unittest.main()
