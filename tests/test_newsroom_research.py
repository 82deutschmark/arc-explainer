# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Verify private/public separation, missed-scan recovery, briefing deduplication
# and persistent cross-competition roster history through the production research helpers.
# SRP/DRY check: Pass — tests observable archive behavior and identity invariants.
import copy
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import newsroom as n
import newsroom_people as people
import newsroom_social as social

NOW = n.stamp('2026-10-09T20:00:00Z')
URL = 'https://example.com/verified-profile'

def person():
    return {'id': 'verified-person', 'name': 'Verified Person', 'accounts': [{'platform': 'kaggle', 'handle': 'confirmed', 'url': 'https://www.kaggle.com/confirmed', 'sourceUrl': URL, 'sourceTitle': 'Direct account link', 'checkedAt': '2026-10-08T12:00:00Z'}], 'facts': [], 'memberships': [], 'hallOfFame': []}

def post(pid='1', visibility='public', importance=2, story=None):
    return {'id': pid, 'author': 'confirmed', 'authorName': 'Verified Person', 'url': f'https://x.com/confirmed/status/{pid}', 'postedAt': '2026-10-09T12:00:00Z', 'checkedAt': '2026-10-09T19:00:00Z', 'visibility': visibility, 'summary': f'Research item {pid}', 'whyItMatters': 'Relevant primary release.', 'competitions': ['arc-3'], 'personIds': [], 'category': 'research', 'importance': importance, 'threadId': None, 'storyUrl': story, 'identitySourceUrl': URL}

def batch(posts, coverage=None):
    return {'version': 1, 'researchedAt': '2026-10-09T19:00:00Z', 'posts': posts, 'accounts': coverage or {}}

class ResearchTests(unittest.TestCase):
    def test_rosters_keep_competitions_and_observed_history_separate(self):
        observation = {'1': {'name': 'Solo', 'members': ['confirmed'], 'observedAt': '2026-10-08T12:00:00Z'}}
        result = people.observed_people([person()], 'arc-3', '2026', observation, URL)
        observation['1'].update(name='Shared', members=['confirmed', 'unknown'], observedAt='2026-10-09T12:00:00Z')
        result = people.observed_people(result, 'arc-2', '2026', observation, URL)
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]['memberships']), 2)
        self.assertNotEqual(result[0]['memberships'][0]['competitionId'], result[0]['memberships'][1]['competitionId'])
        self.assertEqual(people.observed_people(result, 'arc-3', '2026', {}, URL), result)
        self.assertEqual(person()['memberships'], [])
        wrong = copy.deepcopy(result); wrong[0]['memberships'][0]['competitionId'] = 'arc-prize-2025-arc-agi-3'
        with self.assertRaises(ValueError): people.validate_people(wrong)
        duplicate = copy.deepcopy(result[0]); duplicate['id'] = 'other-person'
        with self.assertRaises(ValueError): people.validate_people(result + [duplicate])

    def test_public_exports_and_brief_citations_exclude_restricted_posts(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as root:
            social.ingest(batch([post('1'), post('2', 'subscriber'), post('3', 'unknown')]), directory, NOW)
            self.assertEqual(social.export_public(directory, root, NOW), 1)
            public = n.load(Path(root) / 'content/news/social.json')
            self.assertEqual([p['id'] for p in public], ['1'])
            item = {'articleBase': {'dataAsOf': n.iso(NOW), 'sources': []}, 'evidence': {}}
            social.add_social_sources(item, 'arc-3', NOW, root)
            self.assertEqual([p['id'] for p in item['evidence']['socialPosts']], ['1'])
            with self.assertRaises(ValueError): social.validate_post(post('2', 'subscriber'), NOW, public=True)
            # Invalid private material cannot be relabeled implicitly by the export.
            bad = post('4'); bad['url'] = 'https://x.com/another/status/4'
            with self.assertRaises(ValueError): social.ingest(batch([bad]), directory, NOW)
            self.assertEqual(len(social.state_at(directory)['posts']), 3)

    def test_failed_scan_preserves_watermark_and_plan_catches_up(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as root:
            watch = Path(root) / 'content/news/social-watch.json'; watch.parent.mkdir(parents=True)
            social.save(watch, [{'handle': 'confirmed', 'name': 'Verified Person', 'url': 'https://x.com/confirmed', 'identitySourceUrl': URL}])
            coverage = {'status': 'ok', 'coveredFrom': '2026-10-08T12:00:00Z', 'coveredThrough': '2026-10-09T12:00:00Z', 'checkedAt': '2026-10-09T19:00:00Z', 'detail': 'Scanned the full requested window.'}
            social.ingest(batch([], {'confirmed': coverage}), directory, NOW)
            failed = {**coverage, 'status': 'error', 'coveredThrough': '2026-10-09T19:00:00Z', 'detail': 'Timeline inaccessible.'}
            social.ingest(batch([], {'confirmed': failed}), directory, NOW)
            self.assertEqual(social.collection_plan(directory, root, NOW)[0]['after'], '2026-10-09T11:00:00Z')
            self.assertEqual(social.state_at(directory)['accounts']['confirmed']['status'], 'error')

    def test_brief_reserves_subscription_and_retains_grouped_reactions(self):
        with tempfile.TemporaryDirectory() as directory:
            posts = [post(str(i), importance=3) for i in range(1, 10)] + [post('20', 'subscriber', importance=1), post('21', 'subscriber', importance=1)]
            posts[0]['storyUrl'] = URL; posts.append(post('30', story=URL))
            social.ingest(batch(posts), directory, NOW)
            path = social.make_brief(directory, 'evening', NOW); original = path.read_text()
            self.assertIn('Research item 20', original); self.assertIn('Research item 21', original)
            self.assertIn('Research item 30', original)
            self.assertEqual(social.make_brief(directory, 'evening', NOW).read_text(), original)
            followup = social.make_brief(directory, 'morning', NOW).read_text()
            self.assertNotIn('Research item 20 ', followup)
            self.assertNotIn('Research item 30 ', followup)

if __name__ == '__main__': unittest.main()
