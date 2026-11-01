/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
 * PURPOSE: ADAPTER from the production collection (shared/newsCollection.ts CollectionCard / NewsCollection) to the
 *          ENRICHED CARD MODEL that cardFace/model.ts viewModel() consumes. The TypeScript port of the design
 *          scratch's Python enrichment, so the renderer never touches raw collection data.
 *
 *          CONTRACT with model.ts / render.ts / back.ts (do not change one side alone). Fields read by the renderer:
 *            kind competitor|sponsor|team, tier, name, handle{name,platform}, kaggleDisplayName, role, organisation,
 *            location, joinedYear, medals{gold,silver,bronze}|null, rank{current,outOf,best}|null, number, numberOf,
 *            series{name,publisher,set,season}, status live|final|null, asOfDate YYYY-MM-DD, urlAbsolute, bio, facts[{text}],
 *            honors[{label}], pastTeams[{team}], roster[{handle,name,tier,medals,cardUrl}], art{file,kind,bakedText,
 *            sharedWith}, career{rows[{competition,rank,fieldSize,medal,team,year}],bestFinish,completedListed,complete},
 *            contests[{name,shortName,team{id,name,size}|null,solo,rank,peakRank,fieldSize,fieldSizeHint,score,
 *            submissions,status,asOfDate,roster[{handle,name,tier,medals,cardUrl,self}]}].
 *          Rules kept here: null is unknown and never filled with a default; a missing field is simply absent; one
 *          as-of day per card; people are competitors, the two co-founders competition sponsors, groups teams; a
 *          SOLO ENTRY (one account on the team, or a team named after the competitor's own handle) has
 *          contests[].team = null and solo = true so a layout never prints "gromml" as gromml's own team; facts and
 *          bios come from fixed templates over structured values, sponsor lines from series.json (each cites a
 *          source that must be among the card's own highlights); nothing is hard-coded to one season or contest
 *          (series text comes from the set registry in sets.ts, tier names from the Kaggle ladder in shared).
 *          Data the contract has no room for (join month, the length of the profile's completed list, display name)
 *          comes from the evidence files through loadCareerExtras(); without them those fields stay absent and the
 *          rate facts that need a whole list are withheld.
 *          Art: card.art as resolved by the builder (registered art, then last year's Hall of Fame card, then the
 *          editorial portrait). Optional discoverContractArt also takes a clean 5:7 file found on disk by the art
 *          brief's naming rule before it is registered; production leaves it off.
 * SRP/DRY check: Pass. One job (collection -> model); layout stays in render/back, set text in sets.ts. Reuses the
 *          shared ladder, the competition registry and the builder's board context rather than recomputing them.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Low): first version; port of the Python enrichment onto CollectionCard, with solo
 *          detection, the set registry and board-history peaks (a peak equal to today's rank is kept).
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium, review fixes): a team's printed name drops an art-brief suffix (" - Silver Comet");
 *          the profile's completed-list length is read from profile.visibleCompetitionList too, and a career list is only
 *          "complete" when its medals add up to the profile's; best finish and the career table rank by place first (then
 *          the bigger field); honours lead with the highest placing, then the newest year; a team bio uses the roster size
 *          and names every contest it entered; a Hall of Fame fact never repeats the honour printed on the front; sponsor
 *          bios no longer print the filler "repository is hosted" fact; the set-wide fingerprint for image addresses is exported.
 */
import fs from 'node:fs';
import path from 'node:path';
import { KAGGLE_COMPETITIONS } from '../../../../shared/kaggleCompetitions';
import { KAGGLE_TIERS, type BoardHistory, type CollectionCard, type CollectionCareer, type CollectionEntry, type NewsCollection, boardHistorySchema, careersFileSchema } from '../../../../shared/newsCollection';
import { contestTitle, setForSeason, sponsorProfile, type SetDesign } from './sets';

const LADDER: readonly string[] = KAGGLE_TIERS;
const COLOURS = ['gold', 'silver', 'bronze'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEAR_RE = /(?<![0-9])(20[1-3][0-9])(?![0-9])/;
/** Pixels a clean contract picture must measure (5:7, at least 1500 x 2100). */
const CONTRACT = { ratio: 5 / 7, tolerance: 0.005, minW: 1500, minH: 2100 };

type Medals = { gold: number; silver: number; bronze: number };
export interface CareerExtra { completedCount?: number; joinedMonth?: string; displayName?: string }
export interface EnrichOptions {
  /** Site origin for urlAbsolute; default is read from the saved links in the collection. */
  origin?: string;
  /** Per-person extras from the evidence files (default: loadCareerExtras()). */
  extras?: Record<string, CareerExtra>;
  /** Every saved career by person id, including people without a card (default: content/news/careers.json). */
  careers?: Record<string, CollectionCareer>;
  /** Saved best ranks per team (default: content/news/board-history.json). */
  board?: BoardHistory | null;
  /** client/public folder the art paths are under (default: cwd/client/public). */
  publicDir?: string;
  /** Take a clean 5:7 file found on disk before it is registered (default false). */
  discoverContractArt?: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------------------------------------------
const fmt = (n: number) => Math.trunc(n).toLocaleString('en-US');
const ordinal = (n: number) => `${fmt(n)}${n % 100 >= 10 && n % 100 <= 20 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
const yearIn = (text: string | null | undefined): number | null => { const m = YEAR_RE.exec(text ?? ''); return m ? Number(m[1]) : null; };
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const lowerHandle = (h: string) => h.toLowerCase();
const slugOf = (url: string) => url.replace(/\/+$/, '').split('/').pop() ?? '';
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const medalPhrase = (m: Medals) => {
  const parts = COLOURS.filter(c => m[c]).map(c => `${m[c]} ${c}`);
  if (!parts.length) return '';
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${body} medal${m.gold + m.silver + m.bronze !== 1 ? 's' : ''}`;
};
/** The newsroom calendar day of an instant: "2026-10-30T00:22:48Z" -> "2026-10-29". */
function localDay(stamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(stamp));
}
const handleOfUrl = (url: string) => { const m = /kaggle\.com\/([^/?#]+)/i.exec(url); return m ? decodeURIComponent(m[1]) : null; };

// ---------------------------------------------------------------------------------------------------------------
// optional inputs loaded from the content folder (kept apart so enrichCard stays pure)
// ---------------------------------------------------------------------------------------------------------------
function readJson(file: string): any | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
/** What the saved careers do not carry: the profile's completed-list length, join month and display name. */
export function loadCareerExtras(root = process.cwd()): Record<string, CareerExtra> {
  const out: Record<string, CareerExtra> = {};
  const folder = path.join(root, 'content/news/evidence/kaggle-careers');
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith('.json')).sort().map(f => path.join(folder, f)) : [];
  const proofs = path.join(root, 'docs/newsroom/card-proofs/2026-10-29');
  for (const f of ['son-kaggle-history-evidence.json', 'mark-kaggle-history-evidence.json']) files.push(path.join(proofs, f));
  for (const file of files) {
    const d = readJson(file);
    if (!d?.personId) continue;
    const month = String(d.profile?.joinedMonth ?? d.joined ?? '').slice(0, 7);
    const listed = d.visibleCompetitionList?.completedCount ?? d.profile?.visibleCompetitionList?.completedCount ?? d.counts?.completedCompetitions ?? d.profile?.completedCompetitions;
    out[d.personId] ??= {
      ...(isNum(listed) ? { completedCount: listed } : {}), ...(/^\d{4}-\d{2}$/.test(month) ? { joinedMonth: month } : {}),
      ...(typeof d.profile?.displayName === 'string' ? { displayName: d.profile.displayName } : {}),
    };
  }
  return out;
}
function loadCareers(root: string): Record<string, CollectionCareer> {
  const raw = readJson(path.join(root, 'content/news/careers.json'));
  return raw ? careersFileSchema.parse(raw).careers : {};
}
function loadBoard(root: string): BoardHistory | null {
  const raw = readJson(path.join(root, 'content/news/board-history.json'));
  return raw ? boardHistorySchema.parse(raw) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// art
// ---------------------------------------------------------------------------------------------------------------
/** (width, height) from the file header; PNG, JPEG and WebP. No imaging library needed. */
export function readImageSize(file: string): [number, number] | null {
  let b: Buffer;
  try { const fd = fs.openSync(file, 'r'); b = Buffer.alloc(65536); const n = fs.readSync(fd, b, 0, 65536, 0); fs.closeSync(fd); b = b.subarray(0, n); } catch { return null; }
  if (b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') { const bits = b.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
/** Kind from pixels. A picture of several people is a group whatever its ratio; text baked into old cards is told by `bakedText`. */
export function classifyArt(width: number, height: number, shared: boolean): string {
  const ratio = width / height;
  if (Math.abs(ratio - CONTRACT.ratio) <= CONTRACT.tolerance && width >= CONTRACT.minW && height >= CONTRACT.minH) return 'contract-5x7';
  if (shared) return 'legacy-group';
  if (ratio >= 0.9 && ratio <= 1.1) return 'legacy-square';
  return ratio > 1.1 ? 'legacy-wide' : 'legacy-tall-baked';
}
function artRecord(publicDir: string, src: string | null, source: string, sharedWith: string[], baked: boolean | null, alt: string | null, credit: string | null) {
  const none = { file: null, kind: 'none', width: null, height: null, aspect: null, source, bakedText: null, sharedWith: [] as string[], alt, credit, photo: null, registered: false };
  if (!src) return none;
  const file = path.join(publicDir, src.replace(/^\/+/, ''));
  const size = readImageSize(file);
  if (!size) return { ...none, file, source: `${source}-unreadable` };
  const kind = classifyArt(size[0], size[1], sharedWith.length > 0);
  return { file, kind, width: size[0], height: size[1], aspect: Math.round(size[0] / size[1] * 1e4) / 1e4, source, bakedText: kind === 'contract-5x7' ? false : baked, sharedWith: [...sharedWith].sort(), alt, credit, photo: null, registered: false };
}
/** Clean 5:7 files named <season>/<person-or-card-id>-<variant>-v<n>.webp, hero first then newest version. */
function scanContractFiles(publicDir: string, season: string): Map<string, string[]> {
  const folder = path.join(publicDir, 'news-images/cards', season);
  const found = new Map<string, { rank: number; n: number; file: string }[]>();
  for (const name of fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith('.webp')).sort() : []) {
    const m = /^(?<stem>.+)-(?<variant>[a-z0-9]+)-v(?<n>\d+)\.webp$/.exec(name);
    const size = m ? readImageSize(path.join(folder, name)) : null;
    if (!m || !size || classifyArt(size[0], size[1], false) !== 'contract-5x7') continue;
    (found.get(m.groups!.stem) ?? found.set(m.groups!.stem, []).get(m.groups!.stem)!).push({ rank: m.groups!.variant === 'hero' ? 0 : 1, n: -Number(m.groups!.n), file: path.join(folder, name) });
  }
  return new Map([...found].map(([stem, rows]) => [stem, rows.sort((a, b) => a.rank - b.rank || a.n - b.n).map(r => r.file)]));
}

// ---------------------------------------------------------------------------------------------------------------
// collection-wide context (built once per collection)
// ---------------------------------------------------------------------------------------------------------------
interface Context {
  opts: Required<Pick<EnrichOptions, 'publicDir' | 'discoverContractArt'>>;
  origin: string; extras: Record<string, CareerExtra>; careers: Record<string, CollectionCareer>; board: BoardHistory | null;
  cardsById: Map<string, CollectionCard>; numberOf: Map<string, number>;
  tierByPerson: Map<string, string | null>; personByHandle: Map<string, string>;
  sharedArt: Map<string, string[]>; titleBySlug: Map<string, string>; tierCounts: Record<string, number>;
  contractFiles: Map<string, Map<string, string[]>>;
}
const contexts = new WeakMap<NewsCollection, Context>();

function buildContext(collection: NewsCollection, opts: EnrichOptions): Context {
  const root = process.cwd();
  const careers = opts.careers ?? loadCareers(root);
  const cards = collection.cards;
  const personByHandle = new Map<string, string>();
  for (const card of cards) if (card.personId) for (const a of card.accounts) { const h = handleOfUrl(a.url); if (h) personByHandle.set(lowerHandle(h), card.personId); }
  for (const [pid, career] of Object.entries(careers)) { const h = handleOfUrl(career.profileUrl); if (h) personByHandle.set(lowerHandle(h), pid); }
  // A tier is the Kaggle ladder name on the saved career; failing that, one named in a sourced fact. Never inferred.
  const tierByPerson = new Map<string, string | null>();
  for (const card of cards) if (card.personId) {
    const named = card.highlights.map(h => /Kaggle Competitions (Novice|Contributor|Expert|Master|Grandmaster)\b/.exec(h.text)?.[1]).find(Boolean) ?? null;
    tierByPerson.set(card.personId, careers[card.personId]?.tier ?? named);
  }
  for (const [pid, career] of Object.entries(careers)) if (!tierByPerson.has(pid)) tierByPerson.set(pid, career.tier);
  const numberOf = new Map<string, number>();
  for (const card of cards) numberOf.set(card.number[0], (numberOf.get(card.number[0]) ?? 0) + 1);
  const sharedArt = new Map<string, string[]>();
  for (const card of cards) for (const past of card.pastCards) if (past.imageSrc) {
    const ids = sharedArt.get(past.imageSrc) ?? sharedArt.set(past.imageSrc, []).get(past.imageSrc)!;
    if (!ids.includes(card.id)) ids.push(card.id);
  }
  const titleBySlug = new Map<string, string>();
  for (const career of Object.values(careers)) for (const row of career.rows) if (!titleBySlug.has(slugOf(row.competitionUrl).toLowerCase())) titleBySlug.set(slugOf(row.competitionUrl).toLowerCase(), row.competition);
  const tierCounts: Record<string, number> = {};
  for (const card of cards) if (card.kind === 'person' && card.role === 'competitor') { const t = tierByPerson.get(card.personId!); if (t) tierCounts[t] = (tierCounts[t] ?? 0) + 1; }
  const origin = opts.origin ?? cards.flatMap(c => [...c.entries.map(e => e.sourceUrl), ...c.pastCards.map(p => p.sourceUrl)]).map(u => /^https?:\/\/[^/]+/.exec(u ?? '')?.[0]).find(o => o && !/kaggle\.com|arcprize\.org|x\.com|github\.com/.test(o)) ?? '';
  return { opts: { publicDir: opts.publicDir ?? path.join(root, 'client/public'), discoverContractArt: !!opts.discoverContractArt },
    origin, extras: opts.extras ?? loadCareerExtras(root), careers, board: opts.board === undefined ? loadBoard(root) : opts.board,
    cardsById: new Map(cards.map(c => [c.id, c])), numberOf, tierByPerson, personByHandle, sharedArt, titleBySlug, tierCounts, contractFiles: new Map() };
}
function contextFor(collection: NewsCollection, opts?: EnrichOptions): Context {
  if (opts && Object.keys(opts).length) return buildContext(collection, opts);
  let found = contexts.get(collection);
  if (!found) contexts.set(collection, found = buildContext(collection, {}));
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// one card
// ---------------------------------------------------------------------------------------------------------------
const line = (text: string, derivedFrom: string, sourceUrl: string | null = null) => ({ text, derivedFrom, sourceUrl });
type Fact = ReturnType<typeof line>;

function handleOf(card: CollectionCard) {
  for (const platform of ['kaggle', 'x'] as const) for (const a of card.accounts) {
    const url = a.url.toLowerCase();
    if (platform === 'kaggle' ? /kaggle\.com\//.test(url) : /(^|\/\/|\.)(x|twitter)\.com\//.test(url)) return { name: a.label, platform, url: a.url };
  }
  return null;
}

function contestFor(ctx: Context, card: CollectionCard, entry: CollectionEntry, ownHandles: Set<string>, set: SetDesign) {
  const slug = entry.competitionId;
  const label = KAGGLE_COMPETITIONS[entry.competition]?.label ?? slug;
  const name = contestTitle(slug) ?? ctx.titleBySlug.get(slug.toLowerCase()) ?? label;
  const stamp = entry.observedAt;
  // A competitor who moved teams in this contest only gets a peak reached on the team they hold now: a saved peak
  // from before they joined belongs to the team's earlier line-up, and without the full history it stays unknown.
  const rows = card.teamHistory.filter(t => t.competitionId === entry.competitionId);
  const joined = rows.some(t => t.status === 'previous') ? rows.filter(t => t.teamId === entry.teamId).map(t => t.firstObservedAt).sort()[0] : undefined;
  const saved = ctx.board?.peaks[`${entry.competition}:${entry.teamId}`];
  const peaked = saved && !(joined && saved.at < joined) ? saved : undefined;
  const heldBack = !!saved && !peaked;
  // Best rank so far, kept even when it equals today's rank ("peak #1, now #1"); the builder's own value covers a board-less run.
  const peak = peaked && entry.rank != null ? { rank: Math.min(peaked.rank, entry.rank), at: peaked.rank <= entry.rank ? peaked.at : stamp }
    : entry.peakRank != null && !heldBack ? { rank: entry.peakRank, at: null } : null;
  const roster = entry.members.map(m => {
    const pid = m.personId ?? ctx.personByHandle.get(lowerHandle(m.handle));
    const career = pid ? ctx.careers[pid] : undefined;
    return { handle: m.handle, name: m.name, personId: pid ?? null, tier: (pid ? ctx.tierByPerson.get(pid) : null) ?? null,
      medals: career?.medals ?? null, cardUrl: m.cardUrl ?? null, self: ownHandles.has(lowerHandle(m.handle)) };
  });
  const teamSize = entry.members.length;
  // A solo entry: one account, or a team that only carries the competitor's own handle as its name.
  const solo = teamSize <= 1 || ownHandles.has(lowerHandle(entry.teamName));
  return {
    competition: slug, name, shortName: label, season: yearIn(name) ?? yearIn(slug),
    team: solo ? null : { id: entry.teamId, name: entry.teamName, size: teamSize }, solo, teamSize,
    rank: entry.rank, peakRank: peak?.rank ?? null, peakRankAt: peak?.at ?? null,
    // The saved board count is near the standing in time, not the same instant, so it is only ever a hint.
    fieldSize: null as number | null, fieldSizeHint: entry.fieldSize != null ? { teams: entry.fieldSize, at: null, gapMinutes: null } : null,
    zone: entry.zone, score: entry.score, submissions: entry.submissions,
    asOf: stamp, asOfDate: stamp ? localDay(stamp, set.timeZone) : null,
    status: entry.status === 'final' ? 'final' : entry.status === 'unavailable' ? null : 'live',
    closesAt: KAGGLE_COMPETITIONS[entry.competition]?.closeAt ?? null,
    url: `https://www.kaggle.com/competitions/${slug}/leaderboard`, roster,
  };
}

function careerFor(ctx: Context, card: CollectionCard) {
  const c = card.career;
  if (!c) return null;
  const rows = c.rows.map(r => ({ year: r.year, competition: r.competition, slug: slugOf(r.competitionUrl), team: r.team, rank: r.rank, fieldSize: r.fieldSize, medal: r.medal }));
  const order: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
  // Best result first: the better place, then the bigger field (a win in 2,000 teams outranks a win in 20), then a better
  // medal, then name. One order for the table AND the best-finish line, so the two can never disagree.
  rows.sort((a, b) => a.rank - b.rank || b.fieldSize - a.fieldSize || (order[a.medal ?? ''] ?? 3) - (order[b.medal ?? ''] ?? 3) || a.competition.toLowerCase().localeCompare(b.competition.toLowerCase()));
  const listed = card.personId ? ctx.extras[card.personId]?.completedCount : undefined;
  // The list is the whole record only when it is as long as the profile says AND its medals add up to the profile's totals.
  const listedMedals = Object.fromEntries(COLOURS.map(k => [k, rows.filter(r => r.medal === k).length]));
  const medalsAdd = !c.medals || COLOURS.every(k => (listedMedals[k] ?? 0) >= (c.medals![k] ?? 0));
  const complete = (!isNum(listed) || rows.length >= listed) && medalsAdd;
  const best = rows[0];
  return {
    asOf: c.checkedAt, profileUrls: [c.profileUrl], completedListed: isNum(listed) ? listed : rows.length, rowsRecorded: rows.length, complete,
    medalsListed: rows.length && complete ? Object.fromEntries(COLOURS.map(k => [k, rows.filter(r => r.medal === k).length])) : null,
    bestFinish: best ? { competition: best.competition, rank: best.rank, fieldSize: best.fieldSize, medal: best.medal } : null, rows,
  };
}

function artFor(ctx: Context, card: CollectionCard) {
  const dir = ctx.opts.publicDir;
  if (ctx.opts.discoverContractArt) {
    const season = card.season;
    const files = ctx.contractFiles.get(season) ?? ctx.contractFiles.set(season, scanContractFiles(dir, season)).get(season)!;
    const stems = [card.personId, card.id, card.id.replace(/^(person|team)-|-\d{4}$/g, ''), card.id.replace(/^team-|-\d{4}$/g, '')].filter(Boolean) as string[];
    const hit = stems.map(s => files.get(s)?.[0]).find(Boolean);
    if (hit) return artRecord(dir, '/' + path.relative(dir, hit), 'contract-file', [], false, card.art?.alt ?? null, card.art?.credit ?? null);
  }
  const art = card.art;
  if (!art) return artRecord(dir, null, 'none', [], null, null, null);
  const past = card.pastCards.find(p => p.imageSrc === art.src);
  if (past && /^ARC Hall of Fame card/.test(art.credit)) {
    const others = (ctx.sharedArt.get(art.src) ?? []).filter(id => id !== card.id);
    return artRecord(dir, art.src, 'last-year-hall-of-fame', others, true, art.alt, art.credit);
  }
  const source = art.src.startsWith('/news-images/cards/') ? 'registered' : art.artworkId ? 'editorial-portrait' : 'registered';
  return { ...artRecord(dir, art.src, source, [], null, art.alt, art.credit), registered: source === 'registered' };
}

/** A team's Kaggle name without the art-brief suffix some cards carry ("yktori - Silver Comet" -> "yktori"). */
export function teamTitle(name: string, boardNames: string[] = []): string {
  const head = name.split(/\s+[\u2014\u2013]\s+/)[0].trim() || name;
  // "mtg / Michael" when the board's own name is "mtg": the board's name is the team's name.
  const own = boardNames.find(b => b && head.toLowerCase().startsWith(b.toLowerCase() + ' /'));
  return own ?? head;
}
const article = (n: number) => (n === 8 || n === 11 || n === 18 ? 'an' : 'a');

function enrichOne(ctx: Context, card: CollectionCard) {
  const set = setForSeason(card.season);
  if (!set) throw Error(`No set design registered for season ${card.season} (card ${card.id})`);
  const kind: 'competitor' | 'sponsor' | 'team' = card.kind === 'team' ? 'team' : card.role === 'sponsor' ? 'sponsor' : 'competitor';
  const career = card.career;
  const extra = (card.personId && ctx.extras[card.personId]) || {};
  const ownHandles = new Set(card.accounts.map(a => lowerHandle(a.label)));
  const contests = card.entries.map(e => contestFor(ctx, card, e, kind === 'team' ? new Set<string>() : ownHandles, set));
  const sponsor = kind === 'sponsor' ? sponsorProfile(card.personId) : null;
  const tier = kind === 'competitor' && card.personId ? ctx.tierByPerson.get(card.personId) ?? null : null;
  const handle = kind === 'team' ? null : handleOf(card);
  const joinedYear = kind === 'competitor' ? career?.joinedYear ?? (extra.joinedMonth ? Number(extra.joinedMonth.slice(0, 4)) : null) : null;
  // One as-of day per face: the newest of the standings read and (for a competitor) the Kaggle career read, so the rank and
  // medals on the card are never newer than the date printed on it.
  const stamps = [...contests.map(c => c.asOf), kind === 'competitor' ? career?.checkedAt : null].filter(Boolean) as string[];
  const asOf = stamps.length ? stamps.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
  const statuses = new Set(contests.map(c => c.status).filter(Boolean));

  // Honors: Hall of Fame labels for competitors, then any officially final medals and awards, newest first.
  const honors: { label: string; season: number | null; sourceUrl: string; scope: string }[] = [];
  const seen = new Set<string>();
  const addHonor = (h: { label: string; season: number | null; sourceUrl: string; scope: string }) => { if (!seen.has(h.label)) { seen.add(h.label); honors.push(h); } };
  if (kind === 'competitor') for (const p of card.pastCards) addHonor({ label: p.label, season: yearIn(p.label), sourceUrl: p.sourceUrl, scope: 'hall-of-fame' });
  for (const h of card.honors) addHonor({ label: h.label, season: Number(h.season), sourceUrl: h.sourceUrl, scope: h.scope });
  // The lead honour is the highest placing (champion / winner, runner-up, third), then the newest year.
  const placing = (l: string) => (/champion|winner|first place|\b1st\b/i.test(l) ? 0 : /runner|second|\b2nd\b/i.test(l) ? 1 : /third|\b3rd\b/i.test(l) ? 2 : 3);
  honors.sort((a, b) => placing(a.label) - placing(b.label) || (b.season ?? 0) - (a.season ?? 0) || a.label.localeCompare(b.label));

  const previousCards = kind === 'team' ? [] : card.pastCards.filter(p => p.imageSrc).map(p => ({
    season: p.season ? Number(p.season) : yearIn(p.label), label: p.label, oldCardId: p.hallOfFameUrl.split('#').pop()!, url: ctx.origin + p.hallOfFameUrl,
    art: artRecord(ctx.opts.publicDir, p.imageSrc, 'last-year-hall-of-fame', (ctx.sharedArt.get(p.imageSrc!) ?? []).filter(id => id !== card.id), true, p.imageAlt, p.sourceTitle),
  })).sort((a, b) => (b.season ?? 0) - (a.season ?? 0) || a.oldCardId.localeCompare(b.oldCardId));

  const pastTeams = kind !== 'competitor' ? [] : card.teamHistory.filter(t => t.status !== 'current')
    .map(t => ({ competition: t.competitionId, team: t.teamName, teamId: t.teamId, status: t.status, lastSeen: t.lastObservedAt }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.teamId.localeCompare(a.teamId));

  let roster: any[] = [];
  if (kind === 'team') {
    const merged = new Map<string, any>();
    for (const c of contests) for (const m of c.roster) {
      const row = merged.get(m.handle) ?? merged.set(m.handle, { ...m, contests: [] as string[] }).get(m.handle);
      row.contests.push(c.competition);
    }
    const tierIndex = (m: any) => (m.tier ? LADDER.indexOf(m.tier) : -1);
    const nameKey = (m: any) => String(m.name).toLowerCase();
    // Best tier first, people we can identify before bare handles, then by name.
    roster = [...merged.values()].map(({ self: _self, ...m }) => m).sort((a, b) =>
      tierIndex(b) - tierIndex(a) || (a.personId === null ? 1 : 0) - (b.personId === null ? 1 : 0) || (nameKey(a) < nameKey(b) ? -1 : nameKey(a) > nameKey(b) ? 1 : 0));
  }

  const out: any = {
    id: card.id, number: card.number, numberOf: ctx.numberOf.get(card.number[0]) ?? 0, url: card.cardUrl, urlAbsolute: ctx.origin + card.cardUrl,
    series: { name: set.name, publisher: set.publisher, set: set.setName, season: card.season }, look: set.look,
    kind, name: kind === 'team' ? teamTitle(card.name, card.entries.map(e => e.teamName)) : card.name, handle, kaggleDisplayName: kind === 'competitor' ? extra.displayName ?? null : null,
    role: kind === 'sponsor' ? card.pastCards[0]?.label ?? null : null,
    organisation: kind === 'sponsor' ? sponsor?.organisation ?? null : kind === 'competitor' ? career?.organisation ?? null : null,
    location: kind === 'competitor' ? career?.location ?? null : null, joinedYear, joinedMonth: kind === 'competitor' ? extra.joinedMonth ?? null : null,
    tier, medals: kind === 'competitor' ? career?.medals ?? null : null,
    rank: kind === 'competitor' && career?.rank?.current ? { current: career.rank.current, outOf: career.rank.outOf, best: career.rank.best, asOf: career.checkedAt } : null,
    asOf, asOfDate: asOf ? localDay(asOf, set.timeZone) : null,
    status: statuses.size ? (statuses.has('live') ? 'live' : 'final') : null,
    solo: kind !== 'team' && contests.length > 0 && contests.every(c => c.solo),
    contests, pastTeams, career: kind === 'competitor' ? careerFor(ctx, card) : null,
    honors: kind === 'team' ? [] : honors, previousCards, art: artFor(ctx, card), roster,
  };
  out.bio = bioFor(out, sponsor);
  out.facts = factsFor(ctx, out, card, sponsor);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// printed strings: fixed templates over structured values only
// ---------------------------------------------------------------------------------------------------------------
function bioFor(c: any, sponsor: ReturnType<typeof sponsorProfile>): string | null {
  if (c.kind === 'sponsor') return sponsor?.bio ?? null;
  const lead = c.contests[0];
  if (c.kind === 'team') {
    const n = c.roster.length;
    let s1 = `${c.name} is ${n !== 1 ? `${article(n)} ${n}-account` : 'a single-account'} team`;
    // The size is the whole roster (every contest merged), so a team in two contests names both instead of one board's count.
    if (c.contests.length > 1) s1 += ` across ${c.contests.map((x: any) => x.shortName).join(' and ')}`;
    else if (lead) s1 += ` in ${lead.shortName}`;
    if (lead?.rank) s1 += `, currently #${lead.rank}${c.contests.length > 1 ? ` in ${lead.shortName}` : ''}`;
    s1 += '.';
    const tiers = [...LADDER].reverse().map(t => [t, c.roster.filter((m: any) => m.tier === t).length] as const).filter(([, k]) => k);
    let s2: string;
    if (tiers.length) {
      const bits = tiers.map(([t, k]) => `${k} ${t}${k !== 1 ? 's' : ''}`);
      s2 = `The roster includes ${bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`}.`;
    } else s2 = `Members: ${c.roster.slice(0, 4).map((m: any) => m.name).join(', ')}.`;
    return `${s1} ${s2}`;
  }
  // A person with no Kaggle account is not called a Kaggle competitor.
  if (!(c.handle && c.handle.platform === 'kaggle')) return c.handle ? `${c.name} is on X as @${c.handle.name}.` : `${c.name}.`;
  let s1 = c.tier ? `${c.name} is a Kaggle Competitions ${c.tier}` : `${c.name} is a Kaggle competitor`;
  if (c.organisation) s1 += `, affiliated with ${c.organisation}`;
  if (c.joinedYear) s1 += `, on Kaggle since ${c.joinedYear}`;
  s1 += '.';
  const best = c.career?.bestFinish;
  const medals: Medals | null = c.medals;
  const total = medals ? medals.gold + medals.silver + medals.bronze : 0;
  let s2: string;
  if (best && total) s2 = `Holds ${medalPhrase(medals!)}, with a best finish of ${ordinal(best.rank)} of ${fmt(best.fieldSize)} teams in ${best.competition}.`;
  else if (best) s2 = `Best recorded finish: ${ordinal(best.rank)} of ${fmt(best.fieldSize)} teams in ${best.competition}.`;
  else if (lead?.rank) s2 = lead.team ? `Entered ${lead.shortName} with ${lead.team.name}, currently #${lead.rank}.` : `Entered ${lead.shortName}, currently #${lead.rank}.`;
  else return s1;
  return `${s1} ${s2}`;
}

/** Lowest-priority lines from the lead contest: they keep thin cards at three facts. */
function contestLines(c: any): Fact[] {
  const lead = c.contests[0];
  const out: Fact[] = [];
  if (!lead) return out;
  if (lead.peakRank && lead.rank && lead.peakRank < lead.rank) out.push(line(`Peak position #${lead.peakRank} in ${lead.shortName}.`, 'contests[0].peakRank'));
  if (lead.submissions) out.push(line(`${fmt(lead.submissions)} submissions so far in ${lead.shortName}.`, 'contests[0].submissions'));
  out.push(line(lead.teamSize === 1 ? `Competing solo in ${lead.shortName}.` : `Teamed with ${lead.teamSize - 1} other account${lead.teamSize !== 2 ? 's' : ''} in ${lead.shortName}.`, 'contests[0].teamSize'));
  return out;
}

function factsFor(ctx: Context, c: any, card: CollectionCard, sponsor: ReturnType<typeof sponsorProfile>): Fact[] {
  if (c.kind === 'sponsor') {
    // No invented facts: a hand-written line only stands if its cited page is among the card's own highlights.
    const cited = new Set(card.highlights.map(h => h.sourceUrl));
    // A fact only stands when it adds something: one that just restates where the project is hosted is dropped.
    const lines = (sponsor?.facts ?? []).filter(f => cited.has(f.sourceUrl) && !/\bis hosted under\b/i.test(f.text)).map(f => line(f.text, 'series.sponsors', f.sourceUrl));
    const others = c.art.sharedWith.map((id: string) => ctx.cardsById.get(id)?.name).filter(Boolean).join(' and ');
    if (lines.length < 3 && others) lines.push(line(`Shares the Hall of Fame founders card with ${others}.`, 'art.sharedWith'));
    return lines.slice(0, 3);
  }
  const out: Fact[] = [];
  const lead = c.contests[0];
  if (c.kind === 'team') {
    if (lead?.peakRank) out.push(line(`Peak position #${lead.peakRank} in ${lead.shortName}.`, 'contests[0].peakRank'));
    const tiered = c.roster.map((m: any) => m.tier).filter(Boolean) as string[];
    if (tiered.length) out.push(line(`${c.roster.length} accounts on the roster; best Kaggle tier is ${tiered.reduce((a, b) => (LADDER.indexOf(b) > LADDER.indexOf(a) ? b : a))}.`, 'roster[].tier'));
    const known = c.roster.filter((m: any) => m.medals).map((m: any) => m.medals as Medals);
    const gold = known.reduce((a: number, m: Medals) => a + m.gold, 0);
    if (known.length && gold) out.push(line(`Its ${known.length} members with a Kaggle medal record hold ${gold} gold medal${gold !== 1 ? 's' : ''} between them.`, 'roster[].medals'));
    const carded = c.roster.filter((m: any) => m.cardUrl).length;
    if (carded > 1) out.push(line(`${carded} of its members have their own cards in this set.`, 'roster[].cardUrl'));
    out.push(...contestLines(c).filter(x => !x.derivedFrom.endsWith('peakRank')));
    return out.slice(0, 3);
  }
  const career = c.career ?? {};
  const rows: any[] = career.rows ?? [];
  const medalled = rows.filter(r => r.medal).length;
  const golds = rows.filter(r => r.medal === 'gold').length;
  const cand: Fact[] = [];
  if (c.honors.length) cand.push(line(`Hall of Fame: ${c.honors[0].label}.`, 'honors[0]', c.honors[0].sourceUrl));
  const best = career.bestFinish;
  if (best) {
    const tail = best.medal ? ` (${best.medal})` : '';
    let text = `Best finish: ${ordinal(best.rank)} of ${fmt(best.fieldSize)} teams in ${best.competition}${tail}.`;
    if (text.length > 88) text = `Best finish: ${ordinal(best.rank)} of ${fmt(best.fieldSize)} in ${best.competition}${tail}.`; // one row at card-back type sizes
    cand.push(line(text, 'career.bestFinish'));
  }
  const r = c.rank;
  if (r?.best && r?.outOf) cand.push(line(`Reached #${fmt(r.best)} on Kaggle's Competitions ranking; now #${fmt(r.current)} of ${fmt(r.outOf)}.`, 'rank'));
  else if (r?.outOf) cand.push(line(`Ranked #${fmt(r.current)} of ${fmt(r.outOf)} on Kaggle's Competitions ranking.`, 'rank'));
  const whole = !!career.complete; // rate lines are only honest over a complete list
  if (whole && golds >= 2) cand.push(line(`Gold in ${golds} of ${rows.length} completed competitions.`, 'career.rows[].medal'));
  else if (whole && medalled) cand.push(line(`Medalled in ${medalled} of ${rows.length} completed competitions.`, 'career.rows[].medal'));
  if (c.tier && (ctx.tierCounts[c.tier] ?? 0) > 1) cand.push(line(`One of ${ctx.tierCounts[c.tier]} ${c.tier}s in the ${c.series.season} set.`, 'set.tierCounts'));
  if (c.joinedMonth) cand.push(line(`Joined Kaggle in ${monthLabel(c.joinedMonth)}.`, 'joinedMonth'));
  if (r?.outOf) {
    const pct = r.current / r.outOf * 100;
    cand.push(line(pct < 0.1 ? `Top ${pct.toFixed(2)}% of ${fmt(r.outOf)} ranked competitors.` : `Top ${pct.toFixed(1)}% of ${fmt(r.outOf)} ranked competitors.`, 'rank'));
  }
  if (rows.length && whole) {
    const big = rows.reduce((a, b) => (b.fieldSize > a.fieldSize || (b.fieldSize === a.fieldSize && b.competition > a.competition) ? b : a));
    cand.push(line(`Biggest field entered: ${fmt(big.fieldSize)} teams in ${big.competition}.`, 'career.rows[].fieldSize'));
  }
  if (c.contests.length === 2) cand.push(line(`Entered both ${c.contests[0].shortName} and ${c.contests[1].shortName}.`, 'contests'));
  if (c.location) cand.push(line(`Based in ${c.location}.`, 'location'));
  if (c.handle && c.handle.platform !== 'kaggle') cand.push(line(`On X as @${c.handle.name}.`, 'handle'));
  cand.push(...contestLines(c));
  return cand.slice(0, 3);
}

// ---------------------------------------------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------------------------------------------
/** The enriched model for one card of `collection`. Pass `opts` only to override inputs (it rebuilds the collection context). */
export function enrichCard(card: CollectionCard, collection: NewsCollection, opts?: EnrichOptions): any {
  return enrichOne(contextFor(collection, opts), card);
}
/** The enriched model for every card, in collection order. */
export function enrichCollection(collection: NewsCollection, opts?: EnrichOptions): any[] {
  const ctx = contextFor(collection, opts);
  return collection.cards.map(card => enrichOne(ctx, card));
}
