/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
 * PURPOSE: Invariants for the Card Cabinet adapter (cardFace/enrich.ts) and the set registry (cardFace/sets.ts) over the
 *          REAL collection: every card enriches, only the three kinds exist, no banned word reaches a printed string,
 *          solo entries carry no team name, each face has one as-of day, numbers are consistent, sponsor lines are all
 *          backed by the card's own highlights, and a season with no registry row is refused. Fast: one collection load.
 * SRP/DRY check: Pass. Reads the production collection and the same model the renderer uses; draws nothing.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Low): first version.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium, review fixes): tests for team names without art-brief suffixes, one team size, the career-list
 *          completeness rule, best finish agreeing with the table, honours led by placing, FINAL after the close, and undrawable names.
 */
import { describe, expect, it } from 'vitest';
import { getNewsCollection } from '../server/services/news/newsCollection';
import { enrichCollection, teamTitle } from '../server/services/news/cardFace/enrich';
import { viewModel, printableName } from '../server/services/news/cardFace/model';
import { loadSeriesFile, lookForSeason, setForSeason, sponsorProfile } from '../server/services/news/cardFace/sets';

const collection = getNewsCollection();
const cards = enrichCollection(collection);
// Built from pieces so this file does not itself contain the banned words it hunts for.
const BANNED = [['play', 'er'], ['provision', 'al'], ['obs', 'erved'], ['chec', 'ked'], ['on ', 'file'], ['roo', 'kie'], ['year', 'Basis'], ['bio', 'Basis'], ['organisation', 'Basis'], ['when', 'Label']]
  .map(parts => parts.join(''));
const BANNED_RE = new RegExp(BANNED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const BOOKKEEPING_RE = new RegExp(`\\b(${['pub' + 'lic', 'sou' + 'rce', 'ba' + 'sis'].join('|')})\\b`, 'i');

/** Every string a layout may print for a card (the view model plus the lines it draws from). */
function printed(c: any): string[] {
  const vm = viewModel(c);
  const out: (string | null | undefined)[] = [vm.name, vm.handle, vm.typeLabel, vm.tierLine, vm.number, vm.wordmark, vm.publisher, vm.season, vm.stamp?.word, vm.stamp?.date,
    vm.honour, vm.bestFinish, vm.bio, vm.organisation, vm.location, vm.kaggleName, vm.role, ...vm.facts, ...vm.pastTeams, ...vm.sharedWith,
    ...vm.contests.flatMap(x => [x.short, x.full, x.team, x.rank, x.peak, x.score, x.subs]),
    ...vm.roster.map(r => r.name), ...(vm.career?.rows ?? []).flatMap(r => [r.name, r.team, r.place, r.of])];
  return out.filter((s): s is string => typeof s === 'string');
}

describe('card face adapter over the real collection', () => {
  it('enriches every card into one of the three kinds, with consistent serial numbers', () => {
    expect(cards).toHaveLength(collection.cards.length);
    expect(cards.length).toBeGreaterThan(0);
    const perLetter = new Map<string, number>();
    for (const card of collection.cards) perLetter.set(card.number[0], (perLetter.get(card.number[0]) ?? 0) + 1);
    for (const [i, c] of cards.entries()) {
      const source = collection.cards[i];
      expect(c.id).toBe(source.id);
      expect(['competitor', 'sponsor', 'team']).toContain(c.kind);
      expect(c.kind).toBe(source.kind === 'team' ? 'team' : source.role);
      expect(c.number).toBe(source.number);
      expect(c.numberOf).toBe(perLetter.get(source.number[0]));
      expect(c.number.startsWith(c.kind === 'team' ? 'T' : 'P')).toBe(true);
    }
  });

  it('prints no banned word and no bookkeeping field name anywhere', () => {
    for (const c of cards) {
      // Kaggle's own contest and team names are quoted as they are (one real title contains the word "Player"), so they are
      // cut out before the banned-word scan; every sentence we write around them must be clean.
      const quoted = [...c.contests.flatMap((k: any) => [k.name, k.shortName, k.team?.name]), ...(c.career?.rows ?? []).flatMap((r: any) => [r.competition, r.team]),
        ...c.pastTeams.map((p: any) => p.team), ...c.roster.map((m: any) => m.name), c.name, c.organisation, c.location].filter(Boolean) as string[];
      const ours = (text: string) => quoted.reduce((t, q) => t.split(q).join(''), text);
      for (const text of printed(c)) {
        expect(ours(text), `${c.id}: ${text}`).not.toMatch(BANNED_RE);
        expect(text, `${c.id}: ${text}`).not.toMatch(/undefined|NaN|\[object|^[-–—]+$/);
      }
      for (const text of [c.bio, ...c.facts.map((f: any) => f.text)].filter(Boolean)) expect(ours(text), c.id).not.toMatch(BOOKKEEPING_RE);
    }
  });

  it('gives a solo entry no team name and flags it', () => {
    let solo = 0;
    for (const c of cards) {
      const own = new Set(collection.cards.find(x => x.id === c.id)!.accounts.map(a => a.label.toLowerCase()));
      for (const k of c.contests) {
        if (k.teamSize <= 1 || (c.kind !== 'team' && own.has(String(k.team?.name ?? k.roster[0]?.handle).toLowerCase()) && k.team === null)) { expect(k.team, c.id).toBeNull(); expect(k.solo).toBe(true); solo++; }
        if (k.team) { expect(k.solo).toBe(false); expect(k.team.size).toBeGreaterThan(1); expect(own.has(k.team.name.toLowerCase()), `${c.id} prints its own handle as a team`).toBe(false); }
      }
    }
    expect(solo).toBeGreaterThan(0);
  });

  it('carries one as-of day per face, matching the newest standing', () => {
    for (const c of cards) {
      // One day per face: the newest standing, or the Kaggle career read when that is newer (30-Oct-2026: rank and medals are never newer than the date).
      const stamps = [...c.contests.map((k: any) => k.asOf), c.kind === 'competitor' ? collection.cards.find(x => x.id === c.id)!.career?.checkedAt : null].filter(Boolean) as string[];
      if (!stamps.length) { expect(c.asOfDate, c.id).toBeNull(); expect(c.status, c.id).toBeNull(); continue; }
      expect(c.asOfDate, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.asOf).toBe(stamps.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)));
      if (!c.contests.length) { expect(c.status, c.id).toBeNull(); continue; }     // a career read alone carries a date but no LIVE / FINAL stamp
      expect(['live', 'final']).toContain(c.status);
      const vm = viewModel(c, { now: Date.parse('2026-10-30T12:00:00Z') });        // before the close, so LIVE stays LIVE
      expect(vm.stamp?.word.toLowerCase()).toBe(c.status);
    }
  });

  it('draws series text from the set registry and sponsor lines only from cited highlights', () => {
    for (const c of cards) {
      const set = setForSeason(c.series.season)!;
      expect(c.series).toEqual({ name: set.name, publisher: set.publisher, set: set.setName, season: set.season });
      expect(c.look).toBe(set.look);
    }
    for (const c of cards.filter(x => x.kind === 'sponsor')) {
      const source = collection.cards.find(x => x.id === c.id)!;
      const profile = sponsorProfile(source.personId)!;
      const cited = new Set(source.highlights.map(h => h.sourceUrl));
      expect(profile.facts.every(f => cited.has(f.sourceUrl)), `${c.id} cites a page not among its highlights`).toBe(true);
      // the filler line about where the repository is hosted is dropped, so a card never carries more cited lines than the profile has
      expect(c.facts.filter((f: any) => f.sourceUrl).length).toBe(profile.facts.filter(f => !/\bis hosted under\b/i.test(f.text)).length);
      expect(c.tier).toBeNull(); expect(c.medals).toBeNull(); expect(c.rank).toBeNull();
    }
  });

  it('never invents a tier, a medal count or a field size', () => {
    for (const c of cards) {
      const source = collection.cards.find(x => x.id === c.id)!;
      if (c.kind === 'competitor') { if (c.tier) expect(['Novice', 'Contributor', 'Expert', 'Master', 'Grandmaster']).toContain(c.tier); expect(c.medals).toEqual(source.career?.medals ?? null); }
      for (const k of c.contests) expect(k.fieldSize).toBeNull();
    }
  });
});

describe('set registry', () => {
  it('has the 2026 row, refuses a season with no row, and holds only known looks', () => {
    expect(setForSeason('2026')).toMatchObject({ season: '2026', look: 'topps86' });
    expect(lookForSeason('2026')).toBe('topps86');
    expect(() => lookForSeason('2025')).toThrow(/No set design/);
    expect(loadSeriesFile().sets.every(s => s.look === 'topps86')).toBe(true);
  });
});

describe('review fixes (30-Oct-2026)', () => {
  it('prints a team under its Kaggle name, never with an art-brief suffix', () => {
    expect(teamTitle('yktori \u2014 Silver Comet')).toBe('yktori');
    expect(teamTitle('mtg / Michael \u2014 Two-board Rook', ['mtg'])).toBe('mtg');
    expect(teamTitle('Tufa Labs')).toBe('Tufa Labs');
    for (const c of cards.filter(x => x.kind === 'team')) expect(c.name, c.id).not.toMatch(/\s[\u2014\u2013]\s/);
  });

  it('prints one team size everywhere: every account on the roster', () => {
    const tufa = cards.find(c => c.id === 'team-tufa-labs-2026')!;
    const vm = viewModel(tufa);
    expect(vm.teamSize).toBe(tufa.roster.length);
    expect(vm.sizeLabel).toBe(`${tufa.roster.length} ACCOUNTS`);
    expect(tufa.bio).toContain(`${tufa.roster.length}-account`);
  });

  it('never calls a partial career list the whole record, and ranks best finish and the table by place', () => {
    for (const c of cards.filter(x => x.kind === 'competitor' && x.career)) {
      const rows = c.career.rows as { rank: number; fieldSize: number }[];
      if (!rows.length) continue;
      const best = c.career.bestFinish;
      expect(Math.min(...rows.map(r => r.rank)), c.id).toBe(best.rank);
      if (c.career.completedListed > rows.length) expect(c.career.complete, c.id).toBe(false);
    }
    const alijs = cards.find(c => c.id === 'person-alijs-2026');
    if (alijs?.career) expect(alijs.career.completedListed).toBeGreaterThan(alijs.career.rows.length);
  });

  it('leads the honours with the highest placing', () => {
    for (const c of cards.filter(x => x.honors?.length > 1)) {
      const rank = (l: string) => (/champion|winner/i.test(l) ? 0 : /runner|second/i.test(l) ? 1 : /third/i.test(l) ? 2 : 3);
      expect(rank(c.honors[0].label), c.id).toBe(Math.min(...c.honors.map((h: any) => rank(h.label))));
    }
  });

  it('draws FINAL once every contest has closed, and LIVE before', () => {
    const live = cards.find(c => c.status === 'live' && c.contests.every((k: any) => k.closesAt))!;
    const close = Math.max(...live.contests.map((k: any) => Date.parse(k.closesAt)));
    expect(viewModel(live, { now: close - 60_000 }).stamp?.word).toBe('LIVE');
    expect(viewModel(live, { now: close + 60_000 }).stamp?.word).toBe('FINAL');
  });

  it('prints a name in a script the fonts cannot draw as the handle', () => {
    expect(printableName('\uae40\ubbfc\uc218', 'minsu')).toBe('minsu');
    expect(printableName('\uae40\ubbfc\uc218 Kim', null)).toBe('Kim');
    expect(printableName('\u5fa9\u6d3b\u306e\u6df7\u30c6\u30ad\u30b9\u30c8', 'x')).toBe('\u5fa9\u6d3b\u306e\u6df7\u30c6\u30ad\u30b9\u30c8');
  });

  it('labels a competitor with nothing to show neutrally, and no card carries the filler hosting fact', () => {
    for (const c of cards) {
      const vm = viewModel(c);
      if (vm.bare) expect(vm.typeLabel, c.id).toBe('PROFILE');
      expect(c.facts.map((f: any) => f.text).join(' '), c.id).not.toMatch(/\bis hosted under\b/i);
    }
  });
});
