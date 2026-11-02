/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Exercise unavailable standings, future seasons, non-ARC contests and explicit subject types.
 * SRP/DRY check: Pass — test catalog rules with isolated fixtures, never public invented records.
 */
import { expect, it } from 'vitest';
import { catalogCompetitions, catalogEntry, catalogSubjectLabel, catalogSet } from '../shared/cardCatalog';
import type { CollectionCard } from '../shared/newsCollection';
const fixture = (fields: Partial<CollectionCard>) => ({ season: '2028', kind: 'person', role: 'competitor', entries: [], teamHistory: [], ...fields } as CollectionCard);
it('keeps future non-ARC membership filterable without a fresh leaderboard', () => {
  const card = fixture({ teamHistory: [
    { season: '2028', competitionId: 'future-medicine', competition: 'future-medicine' },
    { season: '2027', competitionId: 'older-contest', competition: 'older-contest' },
  ] as CollectionCard['teamHistory'] });
  expect(catalogCompetitions(card)).toEqual([{ id: 'future-medicine', key: 'future-medicine' }]);
  expect(catalogEntry(card, 'future-medicine')).toBeUndefined();
});
it('selects the chosen board instead of an unrelated better place', () => {
  const card = fixture({ entries: [
    { competitionId: 'contest-a', rank: 1, status: 'public' },
    { competitionId: 'contest-b', rank: 50, status: 'public' },
  ] as CollectionCard['entries'] });
  expect(catalogEntry(card, 'contest-b')?.rank).toBe(50);
});
it('labels individuals, team entries and sponsors separately', () => {
  expect(catalogSubjectLabel(fixture({}))).toBe('Individual card');
  expect(catalogSubjectLabel(fixture({ kind: 'team', role: 'team' }))).toBe('Team card');
  expect(catalogSubjectLabel(fixture({ role: 'sponsor' }))).toBe('Sponsor card');
});
it('keeps the same competitor’s editions in different competition sets', () => {
  const sets = [
    { id: 'set-a-2028', name: 'Competition A 2028', season: '2028', competitionIds: [] },
    { id: 'set-b-2028', name: 'Competition B 2028', season: '2028', competitionIds: [] },
  ];
  const first = fixture({ personId: 'same-person', setId: 'set-a-2028' });
  const second = fixture({ personId: 'same-person', setId: 'set-b-2028' });
  expect(catalogSet(first, sets)?.id).toBe('set-a-2028');
  expect(catalogSet(second, sets)?.id).toBe('set-b-2028');
  expect(catalogSet(fixture({}), sets)).toBeUndefined();
});
it('keeps imported cards in their original season collection after new sets are added', () => {
  const sets = [
    { id: '2028', name: 'Legacy 2028', season: '2028', competitionIds: ['contest-a', 'contest-b'] },
    { id: 'set-a-2028', name: 'Competition A 2028', season: '2028', competitionIds: ['contest-a'] },
  ];
  expect(catalogSet(fixture({}), sets)?.id).toBe('2028');
  expect(catalogSet(fixture({ setId: 'set-a-2028' }), sets)?.id).toBe('set-a-2028');
});
