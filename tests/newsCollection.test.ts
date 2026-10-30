/**
 * Author: Codex
 * Date: 2026-10-29
 * PURPOSE: Protect collectible identity joins, officially credited honors, result revisions,
 *          isolated CLI imports and the newsroom's real commissioned-art collection.
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
import { cardRegistrySchema, finalCardResultSchema, type CardDefinition, type CardRegistry, type CardSnapshot, type FinalCardResult } from '../shared/newsCollection';
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
  return { id: `team-${competition}-${teamId}`, number: 'T001', kind: 'team', name: 'Same team name',
    season: '2026', issuedAt: checkedAt, entries: [entry(competition, teamId)], artNotes: [] };
}
function person(id: string, handle = id): NewsPerson {
  return { id, name: `Verified ${id}`, accounts: [{ platform: 'kaggle', handle,
    url: `https://www.kaggle.com/${handle}`, sourceUrl: `https://www.kaggle.com/${handle}`,
    sourceTitle: 'Own public account', checkedAt }], facts: [], memberships: [], hallOfFame: [] };
}
function personCard(id: string, number = 'P001'): CardDefinition {
  return { id: `person-${id}`, personId: id, kind: 'person', number, name: `Verified ${id}`,
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
  it('keeps identical names and even identical numeric IDs separate across competitions', () => {
    const arc3 = { ...teamCard(), number: 'T001' };
    const arc2 = { ...teamCard('arc-2'), number: 'T002' };
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

  it('rejects duplicate card identities/numbers, duplicate snapshots and mismatched contest keys', () => {
    expect(cardRegistrySchema.safeParse(registry([teamCard(), teamCard()])).success).toBe(false);
    expect(cardRegistrySchema.safeParse(registry([teamCard(), { ...teamCard('arc-2'), id: 'different' }])).success).toBe(false);
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
    const cards = [teamCard(), personCard('former'), personCard('newcomer', 'P002')];
    const rows = [snapshot('arc-3', '100', ['newcomer'])];
    const official = result({ creditedHandles: ['former', 'unresolved'] });
    const collection = buildNewsCollection(registry(cards, rows), index([person('former'), person('newcomer')]), [official]);
    const [team, former, newcomer] = collection.cards;
    expect(team.entries[0]).toMatchObject({ status: 'final', rank: 1, score: 60 });
    expect(team.entries[0].members).toEqual([
      { handle: 'former', name: 'Verified former', personId: 'former' },
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
  return { root, news };
}
function runImport(root: string, incoming: FinalCardResult[]) {
  const input = path.join(root, 'incoming-official-results.json');
  fs.writeFileSync(input, JSON.stringify(incoming));
  return spawnSync(process.execPath, ['--import', require.resolve('tsx'),
    path.resolve('scripts/newsroom_cards.ts'), 'import-results', input],
  { cwd: root, encoding: 'utf8', timeout: 20_000 });
}

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
  it('resolves every current individual/team card, including all nine new commissions', () => {
    const collection = getNewsCollection();
    const people = getNewsIndex().people ?? [];
    const individuals = collection.cards.filter(card => card.kind === 'person');
    const teams = collection.cards.filter(card => card.kind === 'team');
    expect(individuals).toHaveLength(people.length);
    expect(individuals.length).toBeGreaterThanOrEqual(65);
    expect(teams.length).toBeGreaterThanOrEqual(16);
    expect(new Set(collection.cards.map(card => card.number)).size).toBe(collection.cards.length);
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

  it('keeps Darren’s two dogs as one account, and keeps his individual avatar out of the team group image', () => {
    const cards = getNewsCollection().cards;
    const team = cards.find(card => card.id === 'team-domdolus-tolus-2026')!;
    const individual = cards.find(card => card.kind === 'person' && card.accounts.some(account => account.label === 'darrenamadeusmartin'))!;
    const roster = ['alwintheodoric', 'billyanggara', 'darrenamadeusmartin', 'rinnnntt', 'yassirramadhan'];
    expect(team.entries).toHaveLength(2);
    for (const row of team.entries) expect(row.members.map(member => member.handle).sort()).toEqual(roster);
    expect(team.artNotes.join(' ')).toMatch(/five|5/i);
    expect(team.artNotes.join(' ')).toMatch(/six|6/i);
    expect(individual.art).not.toBeNull();
    expect(individual.art!.src).not.toBe(team.art!.src);
  });
});
