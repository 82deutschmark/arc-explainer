/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: DATA DECISIONS for the REVERSE of a card. Takes the front's view model (model.ts) plus the same
 *          enriched card and returns exactly what the back may print, in card language, with nothing said twice:
 *            - facts and the biography are filtered against what the tables already show (best finish, best rank,
 *              peak, account count, medal totals, joined year) and against each other, so the "did you know"
 *              strip and the bio only carry what is genuinely extra; either may end up empty;
 *            - the career table is ordered best first (medal, then share of the field) so a cut keeps the best;
 *            - solo entries say SOLO ENTRY (never the competitor's own handle posing as a team);
 *            - the off-peak note exists only on LIVE contests and only from two real numbers;
 *            - teammates and the team roster are ordered and carry the tier and the "has a card" mark;
 *            - the vitals strip holds only fields that exist.
 *          No coordinates and no colours here: back.ts lays this out. Pure functions, no I/O.
 * SRP/DRY check: Pass. Reads model.ts types and helpers, adds nothing the front needs.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version (de-duplication, solo entries, plain table notes).
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium, review fixes): career rows arrive best-place-first and keep that order (matches BEST FINISH);
 *          a fact that repeats the front's honour is dropped; the roster total reports how many members it covers; the
 *          KAGGLE NAME cell is wider.
 */
import { TIER_LADDER } from './kit';
import { num, type VM, type CareerRowVM, type MedalsVM } from './model';

export interface StandingRow { title: string; sub: string | null; note: string | null; rank: string | null; peak: string | null; score: string | null; subs: string | null }
export interface CareerBack {
  rows: CareerRowVM[]; completed: number; header: string; bestFinish: string | null; medals: MedalsVM | null;
}
export interface MateGroup { contest: string; team: string; mates: { name: string; tier: string | null }[] }
export interface RosterRow { name: string; tier: string | null; medals: MedalsVM | null; hasCard: boolean }
export interface VitalCell { k: string; v: string; grow: number }
export interface BackModel {
  vitals: VitalCell[]; standings: StandingRow[]; career: CareerBack | null; mates: MateGroup[];
  roster: RosterRow[]; rosterTotal: MedalsVM | null; rosterKnown: number; solo: boolean;
  facts: string[]; bio: string | null;
}

const tierRank = (t: string | null) => (t ? TIER_LADDER.indexOf(t) + 1 : 0);
/** Letters and digits only, lower case: "Gromml" and "@gromml" compare equal. */
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---------- facts and bio: nothing the tables already say ----------
/** Facts that only restate a table or the header; generated upstream, recognised by their wording. */
const RESTATES_TABLE = [
  /^best (recorded )?finish\b/i,               // the CAREER row
  /^reached #[\d,]+ on\b/i,                    // vitals (best rank) and the rank ticker
  /^peak position\b/i,                         // the PEAK column
  /\baccounts? on the roster\b/i,              // the roster and the vitals strip
  /\bwith a kaggle medal record\b/i,           // the TEAM TOTAL row
  /^medalled in \d+ of \d+/i,                  // the career table's medal column
  /^joined kaggle\b/i,                         // the JOINED cell
  /^shares the .* card with\b/i,               // the PICTURED WITH cell
  /^on \w+ as @/i,                              // the handle line of the header
];
/** Biography sentences that only restate the header, vitals, career row or roster. */
const BIO_RESTATES = [
  /\bis an? (kaggle )?(competitions? )?(competitor|novice|contributor|expert|master|grandmaster)\b/i,
  /^holds \d+ (gold|silver|bronze)/i,
  /^best (recorded )?finish\b/i,
  /\bis an? (single|\d+)-account team\b/i,
  /^the roster includes\b/i,
  /\bis on \w+ as @/i,                                  // 'X is on X as @handle': the header already says it
];
const STOP = new Set(['with', 'that', 'this', 'from', 'were', 'have', 'been', 'their', 'which', 'also', 'into', 'about', 'than', 'then', 'they', 'them', 'his', 'her', 'the', 'and', 'for', 'was', 'its']);
const words = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(w => !STOP.has(w)));
/** Share of a's content words that also occur in b. */
function overlap(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (!A.size) return 0;
  let hit = 0; A.forEach(w => { if (B.has(w)) hit++; });
  return hit / A.size;
}

function dedupeText(vm: VM): { facts: string[]; bio: string | null } {
  let bio = vm.bio ? vm.bio.trim() : null;
  if (bio && vm.family !== 'sponsor') {
    // People and teams: the generated biography is a restatement; keep only sentences that add something.
    const kept = bio.split(/(?<=[.!?])\s+/).filter(s => s && !BIO_RESTATES.some(re => re.test(s)));
    bio = kept.length ? kept.join(' ') : null;
  }
  let facts = vm.facts.filter(t => t && !RESTATES_TABLE.some(re => re.test(t)));
  // A fact the bio already carries is dropped (the bio is the fuller telling); facts also never repeat each other.
  // A fact that only repeats the honour printed on the front (the Hall of Fame line) says nothing new.
  if (vm.honour) facts = facts.filter(t => overlap(vm.honour!, t) < 0.7);
  if (bio) facts = facts.filter(t => overlap(t, bio!) < 0.5);
  const out: string[] = [];
  for (const t of facts) if (!out.some(o => overlap(t, o) >= 0.7 || overlap(o, t) >= 0.7)) out.push(t);
  // A bio made only of facts already in the strip is dropped instead (vice versa of the rule above).
  if (bio && out.length && overlap(bio, out.join(' ')) >= 0.75) bio = null;
  // The Hall of Fame line leads the strip.
  out.sort((a, b) => Number(/^hall of fame/i.test(b)) - Number(/^hall of fame/i.test(a)));
  return { facts: out.slice(0, 3), bio };
}

// ---------- standings ----------
function standingRows(vm: VM): StandingRow[] {
  const raw: any[] = vm.card.contests ?? [];
  const me = new Set([norm(vm.name), norm(vm.handle), norm(vm.kaggleName)].filter(Boolean));
  return vm.contests.map((c, i): StandingRow => {
    const rc = raw[i] ?? {};
    const size: number | null = c.size;
    const entrySolo = size === 1;
    const teamName = c.team && !me.has(norm(c.team)) && norm(c.team) !== norm(vm.name) ? c.team : null;
    const sub: string[] = [];
    if (teamName) sub.push(teamName);
    if (entrySolo) sub.push('SOLO ENTRY');
    else if (size && size > 1) sub.push(`TEAM OF ${size}`);
    // Off-peak note: only while the contest AND the card's stamp are LIVE, and only when both numbers are real.
    let note: string | null = null;
    if (c.status === 'live' && vm.card.status === 'live' && typeof rc.rank === 'number' && typeof rc.peakRank === 'number') {
      note = rc.rank > rc.peakRank ? `${num(rc.rank - rc.peakRank)} OFF PEAK` : rc.rank === rc.peakRank ? 'AT PEAK' : null;
    }
    return { title: c.full.replace(/\s+-\s+/, ' · ').toUpperCase(), sub: sub.length ? sub.join(' · ') : null, note, rank: c.rank, peak: c.peak, score: c.score, subs: c.subs };
  });
}

// ---------- career ----------
const MEDAL_ORDER = { gold: 0, silver: 1, bronze: 2 } as const;
function careerBack(vm: VM): CareerBack | null {
  const c = vm.career;
  if (!c || !c.rows.length) return null;
  // The rows arrive best-first (place, then the bigger field; enrich.ts), the same order that picks BEST FINISH: the table and
  // its header ("best finishes first") agree. Rows with no place sort last.
  const placeOf = (r: CareerRowVM) => Number(r.place.replace(/,/g, '')) || Infinity;
  const rows = [...c.rows].sort((a, b) => placeOf(a) - placeOf(b) || (Number(b.of.replace(/,/g, '')) || 0) - (Number(a.of.replace(/,/g, '')) || 0) || (a.medal ? MEDAL_ORDER[a.medal] : 3) - (b.medal ? MEDAL_ORDER[b.medal] : 3));
  return { rows, completed: Math.max(c.completed, rows.length), header: `${num(Math.max(c.completed, rows.length))} CONTEST${Math.max(c.completed, rows.length) === 1 ? "" : "S"}`, bestFinish: vm.bestFinishParts?.place ?? null, medals: vm.medals };
}

// ---------- teammates and rosters ----------
function mateGroups(vm: VM): MateGroup[] {
  const seen = new Set<string>(), out: MateGroup[] = [];
  for (const c of (vm.card.contests ?? []) as any[]) {
    const mates = (c.roster ?? []).filter((r: any) => !r.self).map((r: any) => ({ name: r.name ?? r.handle, tier: TIER_LADDER.includes(r.tier) ? r.tier : null }));
    const key = String(c.team?.id ?? c.team?.name);
    if (!mates.length || seen.has(key)) continue;
    seen.add(key);
    mates.sort((a: any, b: any) => tierRank(b.tier) - tierRank(a.tier));
    out.push({ contest: c.shortName ?? c.name, team: c.team?.name ?? '', mates });
  }
  return out.slice(0, 2);
}

function rosterRows(vm: VM): { rows: RosterRow[]; total: MedalsVM | null; known: number } {
  const raw: any[] = vm.card.roster ?? [];
  const med = (m: any): MedalsVM | null => (m && typeof m.gold === 'number' ? { gold: m.gold, silver: m.silver ?? 0, bronze: m.bronze ?? 0 } : null);
  const rows = raw.map((r): RosterRow => ({ name: r.name ?? r.handle, tier: TIER_LADDER.includes(r.tier) ? r.tier : null, medals: med(r.medals), hasCard: !!(r.cardUrl || r.personId) }));
  rows.sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || (b.medals?.gold ?? 0) - (a.medals?.gold ?? 0) || Number(b.hasCard) - Number(a.hasCard));
  const withMedals = rows.filter(r => r.medals);
  const total = withMedals.length ? withMedals.reduce((t, r) => ({ gold: t.gold + r.medals!.gold, silver: t.silver + r.medals!.silver, bronze: t.bronze + r.medals!.bronze }), { gold: 0, silver: 0, bronze: 0 }) : null;
  return { rows, total, known: withMedals.length };
}

// ---------- vitals ----------
function vitalCells(vm: VM, accounts: number): VitalCell[] {
  const cells: VitalCell[] = [];
  const add = (k: string, v: string | null | undefined, grow = 1) => { if (v) cells.push({ k, v, grow }); };
  if (vm.family === 'competitor') {
    add('JOINED', vm.joined ? String(vm.joined) : null, 0.6);
    add('ORGANISATION', vm.organisation, 2.6);
    add('LOCATION', vm.location, 1.5);
    // The Kaggle display name is shown only when it adds something to the name and handle already printed.
    const same = [norm(vm.name), norm(vm.handle)].includes(norm(vm.kaggleName));
    add('KAGGLE NAME', same ? null : vm.kaggleName, 1.25);
    add('KAGGLE RANK', vm.overall ? `${vm.overall.rank}${vm.overall.outOf ? ` / ${vm.overall.outOf}` : ''}` : null, 2.2);
    add('BEST RANK', vm.overall?.best, 0.9);
  } else if (vm.family === 'sponsor') {
    add('ORGANISATION', vm.organisation, 1.5);
    add('PICTURED WITH', vm.sharedWith.join(' · ') || null, 1.5);
  } else {
    add('TEAM SIZE', accounts ? `${accounts} ACCOUNT${accounts === 1 ? '' : 'S'}` : null, 1.1);
    const best = [...vm.roster.map(r => r.tier)].filter(Boolean).sort((a, b) => tierRank(b) - tierRank(a))[0];
    add('BEST KAGGLE TIER', best ? best.toUpperCase() : null, 1.4);
    add('ENTERED', vm.contests.length ? vm.contests.map(c => c.short).join(' · ') : null, 1.6);
  }
  return cells;
}

export function backModel(vm: VM): BackModel {
  const rr = vm.family === 'team' ? rosterRows(vm) : { rows: [] as RosterRow[], total: null, known: 0 };
  const accounts = vm.family === 'team' ? (rr.rows.length || vm.contests[0]?.size || 0) : 0;
  const solo = vm.family === 'team' ? accounts === 1 : vm.contests.length > 0 && vm.contests.every(c => c.size === 1);
  const text = dedupeText(vm);
  return {
    vitals: vitalCells(vm, accounts), standings: standingRows(vm), career: vm.family === 'competitor' ? careerBack(vm) : null,
    mates: vm.family === 'competitor' ? mateGroups(vm) : [], roster: rr.rows, rosterTotal: rr.total, rosterKnown: rr.known, solo, ...text,
  };
}
