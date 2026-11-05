/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex; GPT-6.1 Sol / Codex
 * Date: 02-November-2026
 * PURPOSE: Protect collectible identity joins, officially credited honors, result revisions,
 *          isolated CLI imports, dated player/team links and the newsroom's real commissioned-art collection.
 *          NT's ARC3 card preference preserves his separate verified ARC2 membership.
 * SRP/DRY check: Pass — exercises the shared schemas and public collection projection;
 *              temporary CLI fixtures never modify the real collection or fetch a board.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import type { NewsCompetition, NewsIndex, NewsPerson } from '../shared/news';
import { cardRegistrySchema, collectionCardPath, finalCardResultSchema, type CardDefinition, type CardRegistry, type CardSnapshot, type FinalCardResult } from '../shared/newsCollection';
import { activeCardResults, buildNewsCollection, getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex } from '../server/services/news/newsStore';

const require = createRequire(import.meta.url);
const checkedAt = '2026-10-01T12:00:00Z';
const temporaryRoots: string[] = [];
afterEach(() => temporaryRoots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

function entry(competition: NewsCompetition = 'arc-3', teamId = '100') {
  return { competition, competitionId: KAGGLE_COMPETITIONS[competition].slug, teamId };
}
function teamCard(competition: NewsCompetition = 'arc-3', teamId = '100'): CardDefinition {
  return { id: `team-${competition}-${teamId}`, kind: 'team', name: 'Same team name',
    season: '2026', issuedAt: checkedAt, entries: [entry(competition, teamId)], artNotes: [] };
}
function person(id: string, handle = id): NewsPerson {
  return { id, name: `Verified ${id}`, accounts: [{ platform: 'kaggle', handle,
    url: `https://www.kaggle.com/${handle}`, sourceUrl: `https://www.kaggle.com/${handle}`,
    sourceTitle: 'Own public account', checkedAt }], facts: [], memberships: [], hallOfFame: [] };
}
function personCard(id: string): CardDefinition {
  return { id: `person-${id}`, personId: id, kind: 'person', name: `Verified ${id}`,
    season: '2026', issuedAt: checkedAt, entries: [], artNotes: [] };
}
function snapshot(competition: NewsCompetition = 'arc-3', teamId = '100', members = ['current']): CardSnapshot {
  return { ...entry(competition, teamId), observedAt: checkedAt, teamName: 'Same team name',
    rank: 1, score: 50, submissions: 12, members,
    sourceUrl: `https://www.kaggle.com/competitions/${KAGGLE_COMPETITIONS[competition].slug}/leaderboard` };
}
function registry(cards = [teamCard()], snapshots = [snapshot()]): CardRegistry {
  return { version: 1, season: '2026', commissionedBy: 'Mark Barney', commissionedAt: checkedAt,
    updatedAt: checkedAt, cards, snapshots };
}
function index(people: NewsPerson[] = []): NewsIndex {
  return { articles: [], competitors: [], people };
}
/** Synthetic results are isolated fixtures, never claimed as real ARC outcomes. */
function result(overrides: Partial<FinalCardResult> = {}): FinalCardResult {
  return { id: 'official-result-1', season: '2026', ...entry(), status: 'official-final',
    rank: 1, score: 60, medal: 'gold', awards: [{ kind: 'arc-prize', label: 'Test organizer award' }],
    creditedHandles: ['credited'], confirmedAt: '2026-10-02T12:00:00Z',
    sourceUrl: 'https://arcprize.org/competitions/2026', sourceTitle: 'Official test fixture', ...overrides };
}

describe('Card Cabinet identity and statistics', () => {
  it('shows unlinked roster handles without breaking the collection', () => {
    const data = registry([teamCard()], [snapshot('arc-3', '100', ['unknown-handle'])]);
    const collection = buildNewsCollection(data, index());
    expect(collection.cards[0].entries[0].members).toEqual([{ handle: 'unknown-handle', name: 'unknown-handle' }]);
  });

  it('keeps a reviewed seasonal omission out of the current set without deleting the person', () => {
    const excluded = { ...registry([], []), excludedPersonIds: ['alpha'] };
    expect(buildNewsCollection(excluded, index([person('alpha')])).cards).toEqual([]);
    expect(() => cardRegistrySchema.parse({ ...excluded, cards: [personCard('alpha')] }))
      .toThrow(/Excluded person/);
  });

  it('keeps shared archive art off an individual front while preserving the historical card', () => {
    const owner = person('alpha');
    owner.hallOfFame = [{ label: 'ARC Prize 2025 team card', path: '/hall-of-fame#team',
      image: { src: '/ARChitechts.png', alt: 'Historical three-person team' },
      sourceUrl: 'https://arcprize.org/competitions/2025', sourceTitle: 'Official results', checkedAt }];
    const definition = { ...personCard('alpha'), artFallback: 'none' as const };
    const card = buildNewsCollection(registry([definition], []), index([owner])).cards[0];
    expect(card.art).toBeNull();
    expect(card.pastCards[0].imageSrc).toBe('/ARChitechts.png');
    const commission = { src: '/news-images/alpha.png', alt: 'Alpha individually illustrated', credit: 'ARC Daily' };
    expect(buildNewsCollection(registry([{ ...definition, art: commission }], []), index([owner])).cards[0].art)
      .toEqual(commission);
  });

  it('keeps identical names and even identical numeric IDs separate across competitions', () => {
    const arc3 = { ...teamCard() };
    const arc2 = { ...teamCard('arc-2') };
    const rows = [snapshot('arc-3', '100', ['alpha']),
      { ...snapshot('arc-2', '100', ['beta']), rank: 9, score: 77 }];
    const cards = buildNewsCollection(registry([arc3, arc2, personCard('alpha')], rows), index([person('alpha'), person('beta')])).cards;
    expect(cards[0].entries[0]).toMatchObject({ competition: 'arc-3', rank: 1, score: 50 });
    expect(cards[1].entries[0]).toMatchObject({ competition: 'arc-2', rank: 9, score: 77 });
    expect(cards[2].entries.map(row => row.competition)).toEqual(['arc-3']);
    expect(cards[0].entries[0].members[0].personId).toBe('alpha');
    expect(cards[1].entries[0].members[0].personId).toBe('beta');
  });

  it('uses exact verified handles rather than a similar name or handle substring', () => {
    const definition = personCard('alpha');
    const card = buildNewsCollection(registry([definition], [snapshot('arc-3', '100', ['alpha2'])]), index([person('alpha')])).cards[0];
    expect(card.entries).toEqual([]);
    expect(card.honors).toEqual([]);
  });

  it('links players and team cards by exact contest identity and verified roster handles', () => {
    const arc3 = teamCard();
    const arc2 = { ...teamCard('arc-2') };
    const collection = buildNewsCollection(registry([arc3, arc2, personCard('alpha')], [
      snapshot('arc-3', '100', ['alpha', 'unresolved']), snapshot('arc-2', '100', ['beta']),
    ]), index([person('alpha'), person('beta')]));
    const [team3, team2, player] = collection.cards;
    expect(player.cardUrl).toBe('/news/cards/person-alpha');
    expect(player.entries[0]).toMatchObject({ cardUrl: collectionCardPath(arc3.id), profileUrl: snapshot().sourceUrl });
    expect(team2.entries[0].cardUrl).toBe(collectionCardPath(arc2.id));
    expect(team3.entries[0].members).toEqual([
      { handle: 'alpha', name: 'Verified alpha', personId: 'alpha', cardUrl: player.cardUrl },
      { handle: 'unresolved', name: 'unresolved' },
    ]);
    // A verified person without an issued collectible retains their identity, without a dead card link.
    expect(team2.entries[0].members[0]).toEqual({ handle: 'beta', name: 'Verified beta', personId: 'beta' });
    expect(collectionCardPath('a card/#')).toBe('/news/cards/a%20card%2F%23');
  });

  it('links a roster to the person edition in the same set', () => {
    const team = { ...teamCard(), setId: 'arc-three' };
    const older = { ...personCard('alpha'), id: 'alpha-arc-three', setId: 'arc-three' };
    const newer = { ...personCard('alpha'), id: 'alpha-arc-two', setId: 'arc-two', issuedAt: '2026-10-02T12:00:00Z' };
    const collection = buildNewsCollection(registry([team, older, newer], [snapshot('arc-3', '100', ['alpha'])]), index([person('alpha')]));
    expect(collection.cards[0].entries[0].members[0].cardUrl).toBe(collectionCardPath(older.id));
  });

  it('links a person to their team card from the same set', () => {
    const older = { ...teamCard(), id: 'team-legacy', setId: 'legacy-set' };
    const newer = { ...teamCard(), id: 'team-specific', setId: 'arc3-set', issuedAt: '2026-10-02T12:00:00Z' };
    const player = { ...personCard('alpha'), id: 'alpha-legacy', setId: 'legacy-set' };
    const sets = [{ id: 'legacy-set', name: 'Legacy', season: '2026', competitionIds: [entry().competitionId] }];
    const collection = buildNewsCollection(registry([older, newer, player], [snapshot('arc-3', '100', ['alpha'])]), index([person('alpha')]), [], {}, null, null, sets);
    expect(collection.cards[2].entries[0].cardUrl).toBe(collectionCardPath(older.id));
    expect(collection.cards[2].teamHistory[0].cardUrl).toBe(collectionCardPath(older.id));
  });

  it('keeps a competition edition’s live and final results inside that set', () => {
    const arc3 = { ...personCard('alpha'), id: 'alpha-arc3', setId: 'arc3-set' };
    const arc2 = { ...personCard('alpha'), id: 'alpha-arc2', setId: 'arc2-set' };
    const general = { ...personCard('alpha'), id: 'alpha-general', setId: 'general-set' };
    const sets = [
      { id: 'arc3-set', name: 'ARC3', season: '2026', competitionIds: [entry('arc-3').competitionId] },
      { id: 'arc2-set', name: 'ARC2', season: '2026', competitionIds: [entry('arc-2').competitionId] },
      { id: 'general-set', name: 'General', season: '2026', competitionIds: [] },
    ];
    const snapshots = [snapshot('arc-3', '100', ['alpha']), snapshot('arc-2', '200', ['alpha'])];
    const final = [result({ id: 'arc2-final', ...entry('arc-2', '200'), creditedHandles: ['alpha'] })];
    const cards = buildNewsCollection(registry([arc3, arc2, general], snapshots), index([person('alpha')]), final, {}, null, null, sets).cards;
    expect(cards[0].entries.map(row => row.competition)).toEqual(['arc-3']);
    expect(cards[0].honors).toEqual([]);
    expect(cards[1].entries.map(row => row.competition)).toEqual(['arc-2']);
    expect(cards[1].honors.some(honor => honor.kind === 'kaggle-medal')).toBe(true);
    expect(cards[2].entries.map(row => row.competition)).toEqual(['arc-3', 'arc-2']);
  });

  it('does not put the current board on an earlier-season card', () => {
    const earlier = { ...personCard('alpha'), id: 'alpha-2025', season: '2025' };
    const card = buildNewsCollection(registry([earlier], [snapshot('arc-3', '100', ['alpha'])]), index([person('alpha')])).cards[0];
    expect(card.entries).toEqual([]);
  });

  it('keeps simultaneous contest teams and orders transfers by observed instants, not ledger order', () => {
    const player = person('alpha');
    const membership = (competition: NewsCompetition, teamId: string, observedAt: string): NewsPerson['memberships'][number] => ({
      ...entry(competition, teamId), season: '2026', teamName: `Team ${teamId}`, memberHandle: 'alpha',
      firstObservedAt: observedAt, lastObservedAt: observedAt,
      sourceUrl: `https://example.com/${competition}/${teamId}`, sourceTitle: 'Saved public roster',
    });
    player.memberships = [
      membership('arc-3', '200', '2026-10-02T08:30:00Z'),
      membership('arc-2', '300', '2026-10-02T08:45:00Z'),
      membership('arc-3', '100', '2026-10-02T10:00:00+02:00'),
    ];
    const latest = { ...teamCard('arc-3', '200') };
    const otherContest = { ...teamCard('arc-2', '300') };
    const card = buildNewsCollection(registry([personCard('alpha'), latest, otherContest], []), index([player])).cards[0];
    expect(card.teamHistory.map(row => [row.competition, row.teamId, row.status])).toEqual([
      ['arc-2', '300', 'last-observed'], ['arc-3', '200', 'last-observed'], ['arc-3', '100', 'previous'],
    ]);
    expect(card.teamHistory[1]).toMatchObject({ cardUrl: collectionCardPath(latest.id), sourceTitle: 'Saved public roster',
      firstObservedAt: '2026-10-02T08:30:00Z', lastObservedAt: '2026-10-02T08:30:00Z' });
    expect(card.teamHistory[2].cardUrl).toBeUndefined();
    expect(card.teamHistory[2].profileUrl).toBe('https://example.com/arc-3/100');
  });

  it('uses existing exact notebooks and falls back to saved sources for unpublished teams', () => {
    const player = person('alpha');
    player.memberships = [{ ...entry('arc-2', '100'), season: '2026', teamName: 'Old ARC2 team', memberHandle: 'alpha',
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, sourceUrl: 'https://example.com/old-arc2-roster', sourceTitle: 'Saved public roster' }];
    const ledger = index([player]);
    ledger.competitors = [{ id: 'arc-3-100', competition: 'arc-3', teamId: '100', name: 'ARC3 team', aliases: [], members: ['alpha'],
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, facts: [] }];
    const collection = buildNewsCollection(registry([personCard('alpha'), teamCard()], [snapshot('arc-3', '100', ['alpha'])]), ledger);
    const individual = collection.cards[0];
    expect(individual.entries[0].profileUrl).toBe('/news/competitors/arc-3-100');
    expect(individual.teamHistory.find(row => row.competition === 'arc-3')!.profileUrl).toBe('/news/competitors/arc-3-100');
    expect(individual.teamHistory.find(row => row.competition === 'arc-2')!.profileUrl).toBe('https://example.com/old-arc2-roster');
    expect(collection.cards[1].profileUrl).toBe('/news/competitors/arc-3-100');
    const unavailable = buildNewsCollection(registry([teamCard()], []), index()).cards[0];
    expect(unavailable.entries[0].profileUrl).toBe(`https://www.kaggle.com/competitions/${KAGGLE_COMPETITIONS['arc-3'].slug}/leaderboard`);
    expect(unavailable.profileUrl).toBe(unavailable.entries[0].profileUrl);
  });

  it('retains a stale last-observed team without claiming roster absence proves a departure', () => {
    const player = person('alpha');
    player.memberships = [{ ...entry(), season: '2026', teamName: 'Earlier team', memberHandle: 'alpha',
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, sourceUrl: 'https://example.com/roster', sourceTitle: 'Earlier roster' }];
    const later = { ...snapshot('arc-3', '100', ['newcomer']), observedAt: '2026-10-03T12:00:00Z' };
    const card = buildNewsCollection(registry([personCard('alpha')], [later]), index([player])).cards[0];
    expect(card.entries).toEqual([]);
    expect(card.teamHistory).toHaveLength(1);
    expect(card.teamHistory[0]).toMatchObject({ teamId: '100', teamName: 'Earlier team', status: 'last-observed',
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, sourceUrl: 'https://example.com/roster' });
  });

  it('links a story subject to a dated verified roster when the board cache is absent', () => {
    const player = person('alpha');
    player.memberships = [{ ...entry(), season: '2026', teamName: 'Infinity', memberHandle: 'alpha',
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, sourceUrl: 'https://example.com/observed-roster', sourceTitle: 'Dated roster' }];
    const ledger = index([player, person('beta')]);
    ledger.competitors = [{ id: 'arc-3-100', competition: 'arc-3', teamId: '100', name: 'Infinity', aliases: [], members: ['alpha', 'beta'],
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, facts: [] }];
    const entryResult = buildNewsCollection(registry([personCard('alpha')], []), ledger).cards[0].entries[0];
    expect(entryResult).toMatchObject({ teamName: 'Infinity', status: 'unavailable', observedAt: checkedAt,
      rank: null, score: null, submissions: null, sourceUrl: 'https://example.com/observed-roster' });
    expect(entryResult.members.map(member => member.handle)).toEqual(['alpha', 'beta']);
    ledger.competitors[0].lastObservedAt = '2026-10-02T12:00:00Z';
    expect(buildNewsCollection(registry([personCard('alpha')], []), ledger).cards[0].entries[0].members).toEqual([]);
  });

  it('keeps only the latest observed team per contest and respects exact handles, set scope and final credit', () => {
    const player = person('alpha');
    const membership = (competition: NewsCompetition, teamId: string, time: string, memberHandle = 'alpha') => ({
      ...entry(competition, teamId), season: '2026', teamName: `Team ${teamId}`, memberHandle,
      firstObservedAt: time, lastObservedAt: time, sourceUrl: `https://example.com/${teamId}`, sourceTitle: 'Dated roster',
    });
    player.memberships = [membership('arc-3', '100', checkedAt), membership('arc-3', '200', '2026-10-02T12:00:00Z'),
      membership('arc-2', '300', checkedAt), membership('arc-3', '400', '2026-10-03T12:00:00Z', 'alpha2')];
    const scoped = { ...personCard('alpha'), setId: 'unregistered-test-set', entries: [entry('arc-3', '200')] };
    const card = buildNewsCollection(registry([scoped], []), index([player])).cards[0];
    expect(card.entries.map(row => row.teamId)).toEqual(['200']);
    const current = { ...snapshot('arc-3', '500', ['alpha']), observedAt: '2026-10-04T12:00:00Z' };
    expect(buildNewsCollection(registry([personCard('alpha')], [current]), index([player])).cards[0].entries.map(row => row.teamId))
      .toEqual(['500', '300']);
    const uncredited = result({ teamId: '200', creditedHandles: ['someone-else'] });
    expect(buildNewsCollection(registry([scoped], []), index([player]), [uncredited]).cards[0].entries).toEqual([]);
  });

  it('merges newer positive snapshots into team history without discarding the first observation', () => {
    const player = person('alpha');
    player.memberships = [{ ...entry(), season: '2026', teamName: 'Old name', memberHandle: 'alpha',
      firstObservedAt: checkedAt, lastObservedAt: checkedAt, sourceUrl: 'https://example.com/roster', sourceTitle: 'Earlier roster' }];
    const later = { ...snapshot('arc-3', '100', ['alpha']), teamName: 'Renamed team', observedAt: '2026-10-03T12:00:00Z' };
    const card = buildNewsCollection(registry([personCard('alpha'), teamCard()], [later]), index([player])).cards[0];
    expect(card.teamHistory).toHaveLength(1);
    expect(card.teamHistory[0]).toMatchObject({ teamName: 'Renamed team', status: 'current', firstObservedAt: checkedAt,
      lastObservedAt: later.observedAt, sourceUrl: later.sourceUrl, cardUrl: '/news/cards/team-arc-3-100' });
  });

  it('preserves the full sourced career record instead of cutting it after four highlights', () => {
    const player = person('alpha');
    player.facts = Array.from({ length: 6 }, (_, n) => ({ text: `Competition result ${n + 1}`, sourceUrl: `https://example.com/result/${n}`,
      sourceTitle: `Public competition ${n}`, checkedAt }));
    const card = buildNewsCollection(registry([personCard('alpha')], []), index([player])).cards[0];
    expect(card.highlights).toEqual(player.facts);
  });

  it('keeps a permanent team card while absent statistics stay unknown', () => {
    const card = buildNewsCollection(registry([teamCard()], []), index()).cards[0];
    expect(card.entries[0]).toMatchObject({ status: 'unavailable', rank: null, score: null,
      observedAt: null, submissions: null, members: [] });
    expect(card.art).toBeNull();
  });

  it('preserves a real zero score and the actual board observation date', () => {
    const card = buildNewsCollection(registry([teamCard()], [{ ...snapshot(), score: 0, submissions: 0 }]), index()).cards[0];
    expect(card.entries[0]).toMatchObject({ score: 0, submissions: 0, observedAt: checkedAt, status: 'public' });
  });

  it('does not turn a public first place or a passed deadline into a medal', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
    try {
      const card = buildNewsCollection(registry(), index()).cards[0];
      expect(card.entries[0].status).toBe('public');
      expect(card.honors).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a person card whose identity is absent from the verified ledger', () => {
    expect(() => buildNewsCollection(registry([personCard('missing')], []), index())).toThrow(/verified person/i);
  });

  it('rejects duplicate card identities, duplicate snapshots and mismatched contest keys', () => {
    expect(cardRegistrySchema.safeParse(registry([teamCard(), teamCard()])).success).toBe(false);
    expect(cardRegistrySchema.safeParse(registry([teamCard()], [snapshot(), snapshot()])).success).toBe(false);
    expect(cardRegistrySchema.safeParse(registry([teamCard()], [{ ...snapshot(), competitionId: KAGGLE_COMPETITIONS['arc-2'].slug }])).success).toBe(false);
  });

  it('does not accept a 2026 competition entry inside a 2025 registry', () => {
    const old = registry([{ ...teamCard(), season: '2025' }]);
    old.season = '2025';
    expect(cardRegistrySchema.safeParse(old).success).toBe(false);
  });
});

describe('official final results and recipient credit', () => {
  it.each([
    ['a provisional status', { status: 'public' }],
    ['a nonofficial source', { sourceUrl: 'https://example.com/results' }],
    ['an official-looking subdomain', { sourceUrl: 'https://arcprize.org.example.com/results' }],
    ['an insecure source URL', { sourceUrl: 'http://arcprize.org/competitions/2026' }],
    ['a wrong competition slug', { competitionId: KAGGLE_COMPETITIONS['arc-2'].slug }],
    ['a wrong season', { season: '2025' }],
    ['duplicate credited handles', { creditedHandles: ['credited', 'credited'] }],
    ['a future confirmation', { confirmedAt: new Date(Date.now() + 86_400_000).toISOString() }],
  ])('rejects %s', (_label, change) => {
    expect(finalCardResultSchema.safeParse({ ...result(), ...change }).success).toBe(false);
  });

  it('credits the official roster, reconnecting a former member without honoring a newcomer', () => {
    const cards = [teamCard(), personCard('former'), personCard('newcomer')];
    const rows = [snapshot('arc-3', '100', ['newcomer'])];
    const official = result({ creditedHandles: ['former', 'unresolved'] });
    const collection = buildNewsCollection(registry(cards, rows), index([person('former'), person('newcomer')]), [official]);
    const [team, former, newcomer] = collection.cards;
    expect(team.entries[0]).toMatchObject({ status: 'final', rank: 1, score: 60 });
    expect(team.entries[0].members).toEqual([
      { handle: 'former', name: 'Verified former', personId: 'former', cardUrl: '/news/cards/person-former' },
      { handle: 'unresolved', name: 'unresolved' },
    ]);
    expect(former.entries[0].status).toBe('final');
    expect(former.honors.map(honor => honor.label)).toEqual(['Gold medal', 'Test organizer award']);
    expect(former.honors.every(honor => honor.scope === 'team')).toBe(true);
    expect(newcomer.entries[0].status).toBe('public');
    expect(newcomer.honors).toEqual([]);
  });

  it('does not leak an ARC2 award into the same-named ARC3 entry', () => {
    const r = result({ ...entry('arc-2') });
    const collection = buildNewsCollection(registry([teamCard()], [snapshot()]), index(), [r]);
    expect(collection.cards[0].entries[0].status).toBe('public');
    expect(collection.cards[0].honors).toEqual([]);
  });

  it('retains unknown official scores and does not substitute a public score', () => {
    const card = buildNewsCollection(registry(), index(), [result({ score: null, medal: null, awards: [] })]).cards[0];
    expect(card.entries[0]).toMatchObject({ status: 'final', score: null });
    expect(card.honors).toEqual([]);
  });

  it('selects a correction without mutating or deleting the earlier revision', () => {
    const original = result();
    const corrected = result({ id: 'official-result-2', supersedesId: original.id,
      confirmedAt: '2026-10-03T12:00:00Z', rank: 2, medal: 'silver' });
    const revisions = [original, corrected];
    expect(activeCardResults(revisions)).toEqual([corrected]);
    expect(revisions).toEqual([original, corrected]);
    expect(buildNewsCollection(registry(), index(), revisions).cards[0].honors[0].label).toBe('Silver medal');
  });

  it('orders corrections by their actual instants, including different UTC offsets', () => {
    const original = result({ confirmedAt: '2026-10-02T10:00:00+02:00' });
    const corrected = result({ id: 'offset-correction', supersedesId: original.id, confirmedAt: '2026-10-02T08:30:00Z' });
    expect(activeCardResults([original, corrected])).toEqual([corrected]);
  });

  it('rejects duplicate IDs, conflicting active results and invalid correction chains', () => {
    const original = result();
    expect(() => activeCardResults([original, original])).toThrow(/duplicate/i);
    expect(() => activeCardResults([original, result({ id: 'competing-result' })])).toThrow(/conflict/i);
    for (const correction of [
      result({ id: 'missing', supersedesId: 'absent', confirmedAt: '2026-10-03T12:00:00Z' }),
      result({ id: 'wrong-team', teamId: '200', supersedesId: original.id, confirmedAt: '2026-10-03T12:00:00Z' }),
      result({ id: 'too-early', supersedesId: original.id, confirmedAt: checkedAt }),
    ]) expect(() => activeCardResults([original, correction])).toThrow(/correction/i);
  });
});

function importFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-card-results-'));
  temporaryRoots.push(root);
  const news = path.join(root, 'content/news');
  fs.mkdirSync(news, { recursive: true });
  fs.writeFileSync(path.join(news, 'cards.json'), JSON.stringify(registry()));
  fs.writeFileSync(path.join(news, 'card-results.json'), '[]\n');
  fs.copyFileSync(path.resolve('content/news/series.json'), path.join(news, 'series.json'));
  return { root, news };
}
function runImport(root: string, incoming: FinalCardResult[]) {
  const input = path.join(root, 'incoming-official-results.json');
  fs.writeFileSync(input, JSON.stringify(incoming));
  return spawnSync(process.execPath, ['--import', require.resolve('tsx'),
    path.resolve('scripts/newsroom_cards.ts'), 'import-results', input],
  { cwd: root, encoding: 'utf8', timeout: 20_000 });
}

describe('current card omissions during refresh', () => {
  it('does not recreate an excluded person when their historical identity remains in the news ledger', () => {
    const { root, news } = importFixture();
    fs.writeFileSync(path.join(news, 'cards.json'), JSON.stringify({ ...registry([], []), excludedPersonIds: ['alpha'] }));
    fs.writeFileSync(path.join(news, 'people.json'), JSON.stringify([person('alpha'), person('beta')]));
    fs.writeFileSync(path.join(news, 'visual-identities.json'), JSON.stringify({ subjects: [] }));
    // Both board calls are local fixtures: this tests the actual refresh command without fetching standings.
    const preload = path.join(root, 'board-fixture.mjs');
    fs.writeFileSync(preload, `globalThis.fetch = async () => ({ ok: true, json: async () => ({ latest: { fetched: '${checkedAt}', rows: [] } }) });`);
    const refreshed = spawnSync(process.execPath, ['--import', require.resolve('tsx'), '--import', preload,
      path.resolve('scripts/newsroom_cards.ts'), 'refresh'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
    expect(refreshed.status, refreshed.stderr).toBe(0);
    const saved = cardRegistrySchema.parse(JSON.parse(fs.readFileSync(path.join(news, 'cards.json'), 'utf8')));
    expect(saved.cards.map(card => card.personId)).toEqual(['beta']);
    expect(saved.excludedPersonIds).toEqual(['alpha']);
    expect(JSON.parse(fs.readFileSync(path.join(news, 'people.json'), 'utf8'))).toHaveLength(2);
  });
});

describe('official-result importer in an isolated collection', () => {
  it('reimports identical results idempotently and preserves registry/art definitions', () => {
    const { root, news } = importFixture();
    const before = fs.readFileSync(path.join(news, 'cards.json'), 'utf8');
    const first = runImport(root, [result()]);
    expect(first.status, first.stderr).toBe(0);
    const saved = fs.readFileSync(path.join(news, 'card-results.json'), 'utf8');
    const again = runImport(root, [result()]);
    expect(again.status, again.stderr).toBe(0);
    expect(fs.readFileSync(path.join(news, 'card-results.json'), 'utf8')).toBe(saved);
    expect(JSON.parse(saved)).toHaveLength(1);
    expect(fs.readFileSync(path.join(news, 'cards.json'), 'utf8')).toBe(before);
  });

  it('refuses an in-place result rewrite, then accepts an explicit revision', () => {
    const { root, news } = importFixture();
    expect(runImport(root, [result()]).status).toBe(0);
    const saved = fs.readFileSync(path.join(news, 'card-results.json'), 'utf8');
    const conflict = runImport(root, [result({ rank: 2 })]);
    expect(conflict.status).not.toBe(0);
    expect(fs.readFileSync(path.join(news, 'card-results.json'), 'utf8')).toBe(saved);
    const corrected = result({ id: 'revision-two', rank: 2, supersedesId: 'official-result-1', confirmedAt: '2026-10-03T12:00:00Z' });
    expect(runImport(root, [corrected]).status).toBe(0);
    const revisions = JSON.parse(fs.readFileSync(path.join(news, 'card-results.json'), 'utf8'));
    expect(revisions).toHaveLength(2);
    expect(activeCardResults(revisions)).toEqual([corrected]);
  });
});

describe('the real permanent commissioned collection', () => {
  it('leads NT’s individual avatar card with Turducken while preserving his separate ARC2 team', () => {
    const card = getNewsCollection().cards.find(card => card.personId === 'mitubant')!;
    expect(card.name).toBe('NT');
    expect(card.accounts.some(account => account.label === 'mitubant')).toBe(true);
    expect(card.entries.every(entry => entry.status === 'unavailable' && entry.rank === null && entry.score === null)).toBe(true);
    expect(card.teamHistory.some(entry => entry.competition === 'arc-3' && entry.teamId === '15605182')).toBe(true);
    expect(card.teamHistory.some(entry => entry.competition === 'arc-2' && entry.teamId === '15526034')).toBe(true);
    expect(card.art?.artworkId).toBe('2026-10-29-nt-mitubant-avatar-v2');
    expect(card.art?.alt).toMatch(/yellow bird/i);
  });
  it('resolves every current individual/team card, including all nine new commissions', () => {
    const collection = getNewsCollection();
    const people = getNewsIndex().people ?? [];
    const individuals = collection.cards.filter(card => card.kind === 'person');
    const teams = collection.cards.filter(card => card.kind === 'team');
    const savedRegistry = cardRegistrySchema.parse(JSON.parse(fs.readFileSync('content/news/cards.json', 'utf8')));
    expect(individuals).toHaveLength(people.filter(person => !savedRegistry.excludedPersonIds?.includes(person.id)).length);
    expect(people.some(person => person.id === 'mike-knoop')).toBe(true);
    expect(individuals.some(card => card.personId === 'mike-knoop')).toBe(false);
    expect(individuals.length).toBeGreaterThanOrEqual(65);
    expect(teams.length).toBeGreaterThanOrEqual(16);
    expect(new Set(collection.cards.map(card => card.id)).size).toBe(collection.cards.length);
    const commissioned = [
      ['yktori-team', 'yktori'], ['mtg-team', 'mtg'], ['grigoriy-team', 'grigoriy'],
      ['kontext-team', 'japanese-ensemble'], ['artificial-agency-team', 'artificial-agency'],
      ['majkel1337-team', 'majkel1337'], ['aquaursa-team', 'aquaursa'],
      ['nvbanana-arc2-team', 'nvbanana'], ['domdolus-tolus', 'domdolus-tolus'],
    ];
    for (const [subject, asset] of commissioned) {
      const card = collection.cards.find(item => item.id === `team-${subject}-2026`);
      expect(card, subject).toBeDefined();
      expect(card!.art?.artworkId).toBe(`2026-10-29-${asset}-avatar-v1-base`);
      const artwork = JSON.parse(fs.readFileSync(path.join('content/news/artwork', `${card!.art!.artworkId}.json`), 'utf8'));
      expect(artwork.rawSrc).toBe(card!.art!.src);
      const bytes = fs.readFileSync(path.join('client/public', card!.art!.src));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(artwork.rawSha256);
    }
  });

  it('keeps all three ARChitect individual fronts separate from the historical team card', () => {
    const collection = getNewsCollection();
    for (const personId of ['jan-disselhoff', 'david-hartmann', 'daniel-franzen']) {
      const card = collection.cards.find(card => card.personId === personId)!;
      expect(card.art?.src).not.toBe('/ARChitechts.png');
      expect(card.pastCards.some(past => past.imageSrc === '/ARChitechts.png')).toBe(true);
    }
    expect(collection.cards.find(card => card.personId === 'jan-disselhoff')!.art?.artworkId)
      .toBe('2026-11-01-jan-disselhoff-hero-v1');
    expect(collection.cards.find(card => card.id === 'team-architects-2026')!.art?.src)
      .toBe('/news-images/2026-10-26-architects-dream-team-base.png');
  });

  it('keeps Darren’s two dogs as one account, and keeps his individual avatar out of the team group image', () => {
    const cards = getNewsCollection().cards;
    const team = cards.find(card => card.id === 'team-domdolus-tolus-2026')!;
    const individual = cards.find(card => card.kind === 'person' && card.accounts.some(account => account.label === 'darrenamadeusmartin'))!;
    const roster = ['alwintheodoric', 'billyanggara', 'darrenamadeusmartin', 'rinnnntt', 'yassirramadhan'];
    expect(team.entries).toHaveLength(2);
    for (const row of team.entries) {
      const recorded = getNewsIndex().competitors.find(c => c.id === row.competition + '-' + row.teamId);
      expect(row.members.map(member => member.handle).sort()).toEqual([...(recorded?.members ?? [])].sort());
      expect(row.rank).toBeNull(); expect(row.score).toBeNull();
      expect(row.sourceUrl).toContain('/leaderboard');
    }
    expect(getNewsIndex().competitors.find(c => c.id === team.entries[0].competition + '-' + team.entries[0].teamId)?.members.sort()).toEqual(roster);
    expect(team.artNotes.join(' ')).toMatch(/five|5/i);
    expect(team.artNotes.join(' ')).toMatch(/six|6/i);
    expect(individual.art).not.toBeNull();
    expect(individual.art!.src).not.toBe(team.art!.src);
  });
});
