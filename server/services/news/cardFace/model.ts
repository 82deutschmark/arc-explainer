/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: DATA -> VIEW MODEL for the TOPPS card design. Turns an enriched card (see sample-cards.json
 *          _doc) into exactly the strings and numbers the layout may print, and decides what is never
 *          printed. No coordinates, no colours beyond picking a tier style: those live in render.ts and
 *          kit.ts. Hard rules enforced here:
 *            - people are "competitor", the two co-founders are "competition sponsor", groups are "team";
 *            - the Kaggle tier ladder comes from data; a competitor with no tier gets the neutral style
 *              and no badge (never inferred, never defaulted to Novice);
 *            - null is never printed or replaced by a default; unknown cells are simply absent;
 *            - ONE as-of date (asOfDate) and a LIVE / FINAL stamp; the card's internal bookkeeping fields (the
 *              *Basis notes, whenLabel, rank.asOf) are never read;
 *            - RANK #n is printed without "of N" because contest fieldSize is null (fieldSizeHint is
 *              never printed as a size); the Kaggle overall rank keeps its real "of 225,021";
 *            - the series wordmark comes from data (series.name, else series.set); nothing says ARC or 2026.
 * SRP/DRY check: Pass. Pure functions, no I/O.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): production. Tier lookup is case-insensitive and table-driven (tiers.ts); contests carry a
 *          print tag (full contest name from data, " - " drawn as a dot), a solo flag and an entry line (SOLO ENTRY, never the
 *          competitor's own handle as a team); handleLine joins handle and platform with a clear gap; the peak column is a LIVE-only
 *          note; team size words are singular-aware (1 ACCOUNT); nothing else changed shape (fields are only added).
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium, review fixes): ONE team size everywhere (teamSize = every account on the card's roster,
 *          falling back to the lead contest's count); the member-medal total says how many members it covers (known / of) so a partial
 *          sum is never printed as the team's total; a competitor with no standings, medals, tier or career is labelled neutrally
 *          (PROFILE), not COMPETITOR; a contest whose close time has passed draws FINAL; the stamp date is the newest of the standings
 *          and the career read; a name in a script the bundled fonts cannot draw (Hangul, Thai, Arabic, Hebrew, Indic) prints as
 *          the @handle instead of empty boxes.
 */
import { TIERS, tierByName, type TierStyle } from './tiers';

export type Family = 'competitor' | 'sponsor' | 'team';
export interface ContestVM {
  short: string; full: string; team: string | null; size: number | null; rank: string | null; peak: string | null; score: string | null; subs: string | null; status: string;
  /** the contest as printed on a tag: its full name from data with " - " drawn as " · " ("ARC PRIZE 2026 · ARC-AGI-3"); falls back to the short name */
  tag: string;
  /** a solo entry: no team, flagged solo, a team of one, or a team named after the competitor */
  solo: boolean;
  /** the line printed under the tag on a competitor card: SOLO ENTRY, or the team's name; null on a team card (the card is the team) */
  entryLine: string | null;
}
export interface MedalsVM { gold: number; silver: number; bronze: number }
export interface CareerRowVM { name: string; place: string; of: string; top: string; medal: 'gold' | 'silver' | 'bronze' | null; team: string | null; year: number | null }
export interface VM {
  card: any; family: Family; T: TierStyle; tierName: string | null; hasBadge: boolean;
  name: string; handle: string | null; handlePlatform: string | null;
  typeLabel: string; tierLine: string | null;
  /** the tier as a full word for printing ("GRANDMASTER"), null when the card has no tier */
  tierWord: string | null;
  /** "@sorokin on Kaggle": handle and platform with a clear gap, null when there is no handle */
  handleLine: string | null;
  /** the peak column is only printed on LIVE cards (a final card's peak is history, not news) */
  showPeak: boolean;
  /** team size as printed: "7 ACCOUNTS", "1 ACCOUNT" */
  sizeLabel: string | null;
  number: string; numberOf: number | null; wordmark: string; publisher: string | null; season: string;
  stamp: { word: 'LIVE' | 'FINAL'; date: string } | null;
  contests: ContestVM[]; medals: MedalsVM | null;
  overall: { rank: string; outOf: string | null; best: string | null } | null;
  honour: string | null; bestFinish: string | null; bestFinishParts: { place: string; competition: string } | null;
  bio: string | null; facts: string[]; organisation: string | null; location: string | null; joined: number | null; kaggleName: string | null; role: string | null;
  roster: { name: string; tier: string | null; medals: MedalsVM | null; handle: string }[];
  rosterMedals: { totals: MedalsVM; known: number; of: number } | null;
  /** every account on the card (the roster, else the lead contest's count): the one team size printed everywhere */
  teamSize: number | null;
  /** a competitor card with no standing, medal, tier, rank or career: nothing is printed that claims otherwise */
  bare: boolean;
  career: { rows: CareerRowVM[]; completed: number; shown: number; complete: boolean; best: string | null } | null;
  pastTeams: string[]; sharedWith: string[];
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** "2026-10-29" -> "OCT 29" (the newsroom calendar day; no timezone maths on purpose). */
export const dayLabel = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : null;
};
/** "kaggle" -> "Kaggle", "x" -> "X". */
export const platformLabel = (p: unknown): string | null => typeof p !== 'string' || !p ? null : p.toLowerCase() === 'x' ? 'X' : p[0].toUpperCase() + p.slice(1);
export const num = (n: number) => n.toLocaleString('en-US');
export const ord = (n: number) => { const t = n % 100, s = t >= 11 && t <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10 > 3 ? 0 : n % 10]; return `${num(n)}${s}`; };
/** Scripts the bundled faces cannot draw (they would print as empty boxes): Hangul, Hebrew, Arabic, Thai and the Indic blocks. */
const UNDRAWABLE = /[\u0590-\u06ff\u0700-\u0dff\u0e00-\u0e7f\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\ufb1d-\ufdff\ufe70-\ufeff]/;
/** A name the fonts can draw: the name itself, else the account handle, else the name with the undrawable letters removed. */
export function printableName(name: string, handle: string | null | undefined): string {
  if (!UNDRAWABLE.test(name)) return name;
  if (handle && !UNDRAWABLE.test(handle)) return handle;
  return name.replace(new RegExp(UNDRAWABLE.source, 'g'), '').replace(/\s+/g, ' ').trim() || handle || name;
}
const hash = (n: number | null | undefined) => (n == null ? null : `#${num(n)}`);
const nz = <T,>(v: T | null | undefined) => (v === undefined ? null : v);

function medalsOf(m: any): MedalsVM | null {
  return m && typeof m.gold === 'number' ? { gold: m.gold, silver: m.silver ?? 0, bronze: m.bronze ?? 0 } : null;
}

export function viewModel(card: any, opts: { tierOverride?: string | null; namesById?: Record<string, string>; now?: number } = {}): VM {
  const family: Family = card.kind === 'sponsor' ? 'sponsor' : card.kind === 'team' ? 'team' : 'competitor';
  // Tier: case-insensitive against the ladder table; an unknown non-null name warns once (tiers.ts) and draws the neutral card.
  const tierStyle = family === 'competitor' ? tierByName(opts.tierOverride !== undefined ? opts.tierOverride : card.tier) : null;
  const tierName: string | null = tierStyle?.key ?? null;
  const T = family === 'sponsor' ? TIERS.sponsor : family === 'team' ? TIERS.team : tierStyle ?? TIERS.none;
  const handleName: string = (card.handle?.name ?? '').toString();

  const contests: ContestVM[] = (card.contests ?? []).map((c: any) => {
    const teamName: string | null = c.team?.name ?? null, size: number | null = c.team?.size ?? null;
    const solo = c.solo === true || !c.team || size === 1 || (!!teamName && !!handleName && teamName.toLowerCase() === handleName.toLowerCase());
    const full: string = c.name ?? c.shortName ?? '';
    return {
    short: c.shortName ?? c.name, full, team: teamName, size,
    tag: String(full || c.shortName || '').replace(/\s+[-\u2013\u2014]\s+/g, ' \u00b7 '), solo,
    entryLine: family === 'team' ? null : solo ? 'SOLO ENTRY' : teamName,
    rank: hash(c.rank), peak: hash(c.peakRank), score: typeof c.score === 'number' ? c.score.toFixed(2) : null,
    subs: typeof c.submissions === 'number' ? num(c.submissions) : null, status: c.status,
  }; });
  // The stamp: LIVE while any contest is open, FINAL when all are official final results; none when no standings exist.
  // A contest whose close time has passed is final even when the saved board still says it is open.
  const closed = (c: any) => c.status === 'final' || (c.closesAt && Date.parse(c.closesAt) <= (opts.now ?? Date.now()));
  const allClosed = (card.contests ?? []).length > 0 && (card.contests ?? []).every(closed);
  const status = allClosed || card.status === 'final' ? 'FINAL' : card.status === 'live' ? 'LIVE' : null;
  const date = dayLabel(card.asOfDate);
  const stamp = status && date ? { word: status as 'LIVE' | 'FINAL', date } : null;

  const roster = (card.roster ?? []).map((r: any) => ({ name: printableName(r.name ?? r.handle, r.handle), tier: tierByName(r.tier)?.key ?? null, medals: medalsOf(r.medals), handle: r.handle }));
  const withMedals = roster.filter((r: any) => r.medals);
  const rosterMedals = family === 'team' && withMedals.length
    ? { totals: withMedals.reduce((a: MedalsVM, r: any) => ({ gold: a.gold + r.medals.gold, silver: a.silver + r.medals.silver, bronze: a.bronze + r.medals.bronze }), { gold: 0, silver: 0, bronze: 0 }), known: withMedals.length, of: roster.length }
    : null;

  const bf = card.career?.bestFinish;
  const bestFinish = bf && bf.rank && bf.fieldSize ? `${ord(bf.rank)} of ${num(bf.fieldSize)} · ${bf.competition}` : null;
  const honour = card.honors?.[0]?.label ?? null;

  let career: VM['career'] = null;
  if (card.career && card.career.rows?.length) {
    const rows: CareerRowVM[] = card.career.rows.map((r: any) => ({
      name: r.competition, place: r.rank != null ? num(r.rank) : '', of: r.fieldSize != null ? num(r.fieldSize) : '',
      // Share of the field that finished ahead: a price-guide style "top %" column. Only when both numbers exist.
      top: r.rank != null && r.fieldSize ? `${Math.max(0.1, Math.round((r.rank / r.fieldSize) * 1000) / 10).toFixed(1)}%` : '',
      medal: r.medal ?? null, team: r.team ?? null, year: r.year ?? null,
    }));
    career = { rows, completed: card.career.completedListed ?? rows.length, shown: rows.length, complete: !!card.career.complete, best: bestFinish };
  }
  const sharedWith = (card.art?.sharedWith ?? []).map((id: string) => opts.namesById?.[id]).filter(Boolean) as string[];
  const number: string = card.number ?? '';
  const teamSize: number | null = (card.roster?.length || card.contests?.[0]?.team?.size) ?? null;
  const bare = family === 'competitor' && !contests.length && !card.medals && !card.rank && !tierName && !card.career?.rows?.length && !(card.honors?.length);
  return {
    card, family, T, tierName, hasBadge: family === 'competitor' && !!tierName || family === 'sponsor' || family === 'team',
    name: printableName(card.name, card.handle?.name), handle: card.handle?.name ? `@${card.handle.name}` : null, handlePlatform: card.handle?.platform ?? null,
    typeLabel: family === 'competitor' ? (bare ? 'PROFILE' : 'COMPETITOR') : family === 'sponsor' ? 'COMPETITION SPONSOR' : 'TEAM',
    tierLine: tierName ? `KAGGLE ${tierName.toUpperCase()}` : null, tierWord: tierStyle ? tierStyle.label.toUpperCase() : null,
    handleLine: handleName ? `@${handleName}${platformLabel(card.handle?.platform) ? ` on ${platformLabel(card.handle?.platform)}` : ''}` : null,
    showPeak: status === 'LIVE',
    sizeLabel: family === 'team' && teamSize ? `${teamSize} ${teamSize === 1 ? 'ACCOUNT' : 'ACCOUNTS'}` : null, teamSize: family === 'team' ? teamSize : null, bare,
    number, numberOf: nz(card.numberOf), wordmark: card.series?.name ?? card.series?.set ?? '', publisher: card.series?.publisher ?? null, season: String(card.series?.season ?? ''),
    stamp, contests, medals: family === 'competitor' ? medalsOf(card.medals) : null,
    overall: card.rank?.current ? { rank: hash(card.rank.current)!, outOf: card.rank.outOf ? num(card.rank.outOf) : null, best: hash(card.rank.best) } : null,
    honour, bestFinish, bestFinishParts: bf && bf.rank && bf.fieldSize ? { place: `${ord(bf.rank)} OF ${num(bf.fieldSize)}`, competition: bf.competition } : null, bio: card.bio ?? null, facts: (card.facts ?? []).map((x: any) => x.text),
    organisation: card.organisation ?? null, location: card.location ?? null, joined: card.joinedYear ?? null,
    kaggleName: card.kaggleDisplayName ?? null, role: card.role ?? null, roster, rosterMedals, career,
    pastTeams: (card.pastTeams ?? []).map((p: any) => p.team), sharedWith,
  };
}
