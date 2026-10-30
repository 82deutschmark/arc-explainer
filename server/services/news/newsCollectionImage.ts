/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5 (30-Oct-2026: blurred backdrop behind contained portraits,
 *         seeded puzzle-grid monogram for players with no individual picture)
 * Date: 2026-10-30
 * PURPOSE: Render permanent Card Cabinet fronts and readable sourced reverses as 750×1050
 *          PNGs. Player fronts preserve both contest teams. All labels and
 *          dated statistics are drawn programmatically; the commissioned art is only
 *          read and contained inside its window, never modified or cropped in place.
 * SRP/DRY check: Pass — accepts the shared CollectionCard contract; reuses committed
 *          newspaper fonts and the installed Satori/Sharp stack, with no network reads.
 *
 * CJK FONT: NotoSansJP-Regular.ttf is a static weight-400 instance of Google Fonts'
 * https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf
 * Source SHA256: c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f.
 * FontTools 4.62.1 instantiateVariableFont(font, {"wght": 400}, inplace=True), then save.
 * Static SHA256: 941b4a4fdb8fab5ca615753aad078e44568db1608ee7e975fea8bc3ce186601f.
 * The unmodified OFL license accompanies it. A static instance is necessary because
 * this Satori version's OpenType parser rejects the source font's fvar table. Japanese
 * names are kept intact and emitted as glyph outlines; no Latin-only text filtering.
 */
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import type { CollectionCard, CollectionEntry, CollectionTeamHistory } from '../../../shared/newsCollection';
import type { CompetitorFact } from '../../../shared/news';

const WIDTH = 750;
const HEIGHT = 1050;
const ART_WIDTH = 674;
const ART_HEIGHT = 500;
const PAPER = '#f7f0df';
const EDGE = '#e5d7ba';
const INK = '#211d17';
const OXBLOOD = '#8d1c12';
const GOLD = '#9a7210';
const MUTED = '#6b604e';
const HAIR = '#c7b68d';
const SERIF = 'IBM Plex Serif';
const SANS = 'IBM Plex Sans Condensed';
const CJK = 'Noto Sans JP';
const FONT_DIRECTORY = path.join(process.cwd(), 'server/assets/fonts/news-card');
const PUBLIC_DIRECTORY = path.join(process.cwd(), 'client/public');

type Node = { type: string; props: Record<string, unknown> };
type Style = Record<string, string | number>;
const box = (style: Style, ...children: (Node | string | null | false)[]): Node => ({
  type: 'div', props: { style: { display: 'flex', ...style }, children: children.filter(child => child !== null && child !== false) },
});

let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;
export function loadCollectionCardFonts() {
  const read = (file: string) => fs.readFileSync(path.join(FONT_DIRECTORY, file));
  fonts ??= [
    { name: SERIF, data: read('IBMPlexSerif-Bold.ttf'), weight: 700, style: 'normal' },
    { name: SERIF, data: read('IBMPlexSerif-Regular.ttf'), weight: 400, style: 'normal' },
    { name: SANS, data: read('IBMPlexSansCondensed-Bold.ttf'), weight: 700, style: 'normal' },
    { name: SANS, data: read('IBMPlexSansCondensed-Medium.ttf'), weight: 500, style: 'normal' },
    { name: CJK, data: read('NotoSansJP-Regular.ttf'), weight: 400, style: 'normal' },
  ];
  return fonts;
}

/** One guarded read boundary: no URLs, encoded paths, traversal or out-of-tree symlinks. */
export async function readCollectionArtwork(src: string, dimensions = { width: ART_WIDTH, height: ART_HEIGHT }, backdrop = false): Promise<Buffer | null> {
  if (!/^\/news-images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/u.test(src)) {
    throw new Error('Invalid collection artwork path.');
  }
  const artworkRoot = await fs.promises.realpath(path.join(PUBLIC_DIRECTORY, 'news-images'));
  let resolved: string;
  try {
    resolved = await fs.promises.realpath(path.join(PUBLIC_DIRECTORY, src.slice(1)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('Collection artwork is unavailable.');
  }
  const relative = path.relative(artworkRoot, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Invalid collection artwork path.');
  }
  const info = await fs.promises.stat(resolved);
  if (!info.isFile() || info.size > 32_000_000) throw new Error('Invalid collection artwork file.');
  const bytes = await fs.promises.readFile(resolved);
  try {
    // A contained derivative is embedded in the SVG. The registered original stays untouched.
    const source = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
    const contained = await source.clone().resize({
      width: dimensions.width, height: dimensions.height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    // A square portrait in a wide window used to leave blank paper bars. Instead, the same
    // picture, enlarged, blurred and dimmed, fills the window behind the untouched contained copy.
    if (!backdrop) {
      // Share previews keep the exact paper-bar contract their tests and crawlers rely on.
      return await sharp(contained).flatten({ background: PAPER }).png().toBuffer();
    }
    const blurred = await source.clone().resize({ width: dimensions.width, height: dimensions.height, fit: 'cover' })
      .blur(22).modulate({ brightness: 0.82, saturation: 1.15 }).png().toBuffer();
    return await sharp(blurred).composite([{ input: contained }]).png().toBuffer();
  } catch {
    return null;
  }
}

function dateLabel(value: string | null): string {
  if (!value) return 'Observation date unavailable';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(date) : 'Observation date unavailable';
}

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase();
}

function primaryEntry(card: CollectionCard) {
  return card.entries.find(entry => entry.status === 'final' && entry.rank != null)
    ?? card.entries.find(entry => entry.status === 'public' && entry.rank != null)
    ?? card.entries[0];
}

function frontEntries(card: CollectionCard) {
  return (['arc-3', 'arc-2'] as const).flatMap(competition => {
    const candidates = card.entries.filter(entry => entry.competition === competition);
    const current = card.teamHistory.find(row => row.competition === competition && row.status === 'current' && row.season === card.season);
    const chosen = candidates.find(entry => entry.competitionId === current?.competitionId && entry.teamId === current?.teamId)
      ?? candidates.find(entry => entry.status === 'final') ?? candidates[0];
    return chosen ? [chosen] : [];
  });
}

function frontArtHeight(card: CollectionCard) {
  return card.kind === 'person' && frontEntries(card).length > 1 ? 390 : ART_HEIGHT;
}

const label = (text: string, style: Style = {}) => box({
  fontFamily: `${SANS}, ${CJK}`, fontWeight: 700, fontSize: 15, color: MUTED,
  letterSpacing: 1.4, textTransform: 'uppercase', ...style,
}, text);

function playerRecordStrip(entry: CollectionEntry): Node {
  const visible = entry.status !== 'unavailable';
  const rank = visible && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : '—';
  const score = visible && entry.score != null ? entry.score.toFixed(2) : '—';
  return box({ flexDirection: 'column', borderTop: `2px solid ${INK}`, paddingTop: 7, flexShrink: 0 },
    box({ justifyContent: 'space-between', alignItems: 'baseline' },
      label(contestLabel(entry.competition), { color: INK, fontSize: 15 }),
      label(standingStatus(entry), { fontSize: 11, letterSpacing: .3 })),
    box({ display: 'block', fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: 21, lineHeight: 1.15, marginTop: 2, lineClamp: 1, overflow: 'hidden' }, entry.teamName),
    box({ justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3 },
      box({ alignItems: 'baseline', gap: 9 }, label('Team rank', { fontSize: 12 }), box({ fontFamily: SERIF, fontWeight: 700, fontSize: 28 }, rank)),
      box({ alignItems: 'baseline', gap: 9 }, label('Score', { fontSize: 12 }), box({ fontFamily: SERIF, fontWeight: 700, fontSize: 28 }, score))),
    box({ marginTop: 2, fontFamily: SANS, fontSize: 12, color: MUTED }, dateLabel(entry.observedAt)));
}

const contestLabel = (competition: CollectionEntry['competition']) => competition === 'arc-3' ? 'ARC-AGI-3' : 'ARC-AGI-2';
const standingStatus = (entry: CollectionEntry) => entry.status === 'final' ? 'Official final'
  : entry.status === 'public' ? 'Public · provisional' : 'Standing unavailable';

function recordStrip(entry: CollectionEntry | undefined): Node {
  if (!entry) return box({ flexDirection: 'column', borderTop: `2px solid ${INK}`, paddingTop: 11 },
    label('Career collection'), box({ marginTop: 5, fontFamily: SERIF, fontSize: 20, color: MUTED }, 'The competitor’s record continues in the Card Cabinet.'));
  const visible = entry.status !== 'unavailable';
  const rank = visible && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : '—';
  const score = visible && entry.score != null ? entry.score.toFixed(2) : '—';
  const status = entry.status === 'final' ? 'Final standings' : entry.status === 'public' ? 'Public · provisional' : 'Standing unavailable';
  return box({ flexDirection: 'column', borderTop: `2px solid ${INK}`, paddingTop: 9 },
    box({ justifyContent: 'space-between', alignItems: 'baseline' },
      label(entry.competition === 'arc-3' ? 'ARC-AGI-3' : 'ARC-AGI-2', { color: INK, fontSize: 17 }),
      label(status, { fontSize: 13, letterSpacing: .6 })),
    box({ justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 },
      box({ alignItems: 'baseline', gap: 12 }, label('Rank', { fontSize: 13 }), box({ fontFamily: SERIF, fontWeight: 700, fontSize: 35, color: INK }, rank)),
      box({ alignItems: 'baseline', gap: 12 }, label('Score', { fontSize: 13 }), box({ fontFamily: SERIF, fontWeight: 700, fontSize: 35, color: INK }, score))),
    box({ marginTop: 4, fontFamily: SANS, fontWeight: 500, fontSize: 14, color: MUTED }, dateLabel(entry.observedAt)));
}

// ARC-style puzzle colours, muted to sit inside the newspaper palette.
const GRID_COLOURS = ['#1d2a44', '#2b3f6b', '#8d1c12', '#c9892b', '#2f6b4f', '#4a2f6b', '#a24a6b', '#3d7a8f'];

/** Stable 32-bit hash so a player without a picture always gets the same monogram grid. */
function nameHash(name: string): number {
  let hash = 0x811c9dc5;
  for (const char of name) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash;
}

/**
 * Stand-in for a player with no individual picture: a seeded ARC-puzzle grid behind a cream
 * monogram plate. It never pretends to be a photograph and never uses a stranger's image.
 */
function monogramWindow(name: string, height: number): Node {
  const size = 56;
  const columns = Math.ceil(ART_WIDTH / size);
  const rows = Math.ceil(height / size);
  let seed = nameHash(name);
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const grid = Array.from({ length: rows }, () => box({},
    ...Array.from({ length: columns }, () => box({ width: size, height: size, background: GRID_COLOURS[next() % GRID_COLOURS.length], border: '1px solid rgba(247,240,223,0.12)' }))));
  return box({ width: ART_WIDTH, height, position: 'relative', overflow: 'hidden', flexDirection: 'column' },
    ...grid,
    box({ position: 'absolute', left: 0, top: 0, width: ART_WIDTH, height, alignItems: 'center', justifyContent: 'center' },
      box({ flexDirection: 'column', alignItems: 'center', padding: '22px 44px', background: PAPER, border: `4px solid ${GOLD}` },
        box({ fontFamily: `${SERIF}, ${CJK}`, fontSize: 118, fontWeight: 700, color: OXBLOOD, lineHeight: 1 }, initials(name)),
        label('Portrait not on file', { marginTop: 10, color: MUTED, fontSize: 14, letterSpacing: 1.8 }))));
}

function cardNode(card: CollectionCard, artwork: Buffer | null): Node {
  const entries = frontEntries(card);
  const artHeight = frontArtHeight(card);
  const twoPlayerTeams = card.kind === 'person' && entries.length > 1;
  const nameLength = Array.from(card.name).length;
  const nameSize = nameLength <= 23 ? 44 : nameLength <= 42 ? 36 : 30;
  const honor = card.honors[0];
  const artWindow = artwork
    ? { type: 'img', props: { src: `data:image/png;base64,${artwork.toString('base64')}`, width: ART_WIDTH, height: artHeight } }
    : monogramWindow(card.name, artHeight);

  return box({ width: WIDTH, height: HEIGHT, padding: 20, background: EDGE, color: INK, fontFamily: `${SANS}, ${CJK}`, fontWeight: 500 },
    box({ width: 710, height: 1010, padding: 14, border: `2px solid ${GOLD}`, flexDirection: 'column', background: PAPER },
      box({ justifyContent: 'space-between', alignItems: 'baseline' },
        label(`No. ${card.number}`, { color: INK, fontSize: 17, letterSpacing: 1 }),
        label(`${card.kind === 'person' ? 'Player' : 'Team'} · ${card.season}`, { fontSize: 15 })),
      box({ justifyContent: 'center', marginTop: 8, paddingBottom: 9, borderBottom: `3px solid ${INK}`, fontFamily: SERIF, fontWeight: 700, fontSize: 29, color: INK }, 'The ARC Daily Digest'),
      box({ width: ART_WIDTH + 4, height: artHeight + 4, marginTop: 12, border: `2px solid ${INK}`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, artWindow),
      box({ marginTop: 11, minHeight: 90, padding: '12px 15px', background: OXBLOOD, border: `2px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center' },
        box({ display: 'block', textAlign: 'center', width: '100%', fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: nameSize, lineHeight: 1.12, lineClamp: 2, overflow: 'hidden', color: '#fff3d5' }, card.name)),
      box({ marginTop: 14, flexDirection: 'column', gap: twoPlayerTeams ? 8 : 0 },
        ...(card.kind === 'person' && entries.length ? entries.map(playerRecordStrip) : [recordStrip(primaryEntry(card))])),
      twoPlayerTeams ? box({ marginTop: 10, paddingLeft: 10, borderLeft: `4px solid ${GOLD}`, flexDirection: 'column', flexShrink: 0 },
        card.highlights[0] ? box({ display: 'block', fontFamily: `${SERIF}, ${CJK}`, fontSize: 18, fontWeight: 400, lineHeight: 1.22, lineClamp: 2, overflow: 'hidden' }, card.highlights[0].text) : null,
        label('Kaggle career & team history on the reverse →', { marginTop: 5, fontSize: 12, letterSpacing: .3 })) : honor ? box({ marginTop: 11, padding: '8px 10px', flexDirection: 'column', borderLeft: `4px solid ${GOLD}`, background: '#eee2c6' },
        label(`${honor.kind === 'arc-prize' ? 'ARC Prize award' : 'Kaggle medal'} · ${honor.season}`, { color: GOLD, fontSize: 12, letterSpacing: .8 }),
        box({ display: 'block', marginTop: 3, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: 19, lineHeight: 1.22, lineClamp: 2, overflow: 'hidden' }, honor.label))
        : card.highlights[0] ? box({ display: 'block', marginTop: 12, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 400, fontSize: 18, lineHeight: 1.3, color: MUTED, lineClamp: 2, overflow: 'hidden' }, card.highlights[0].text) : null,
      box({ flexGrow: 1 }),
      box({ justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 8, borderTop: `2px solid ${GOLD}` },
        label('Card Cabinet', { color: OXBLOOD, fontSize: 14, letterSpacing: 1.6 }),
        label('arc.markbarney.net/news/cards', { fontSize: 12, letterSpacing: .3 }))));
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date) : 'date unavailable';
}

interface BackSelection {
  entries: CollectionEntry[];
  history: CollectionTeamHistory[];
  highlights: CompetitorFact[];
  fontSize: number;
  continued: boolean;
}

function backNode(card: CollectionCard, selection: BackSelection): Node {
  const sources: { url: string; title: string; checkedAt: string }[] = [];
  const cite = (url: string | undefined, title: string, checkedAt: string | null) => {
    if (!url) return '';
    let index = sources.findIndex(source => source.url === url && source.checkedAt === (checkedAt ?? ''));
    if (index < 0) {
      index = sources.length;
      sources.push({ url, title, checkedAt: checkedAt ?? '' });
    }
    return ` [${index + 1}]`;
  };
  const text = (value: string, style: Style = {}) => box({ display: 'block', fontSize: selection.fontSize,
    lineHeight: 1.22, flexShrink: 0, ...style }, value);
  const heading = (value: string) => label(value, { color: OXBLOOD, fontSize: 15, marginTop: 11, marginBottom: 5, letterSpacing: 1.2 });
  const teamRecords = selection.entries.map(entry => {
    const visible = entry.status !== 'unavailable';
    const rank = visible && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : 'unavailable';
    const score = visible && entry.score != null ? entry.score.toFixed(2) : 'unavailable';
    const reference = cite(entry.sourceUrl, `${contestLabel(entry.competition)} ${entry.status === 'final' ? 'official result' : 'public standings'}`, entry.observedAt);
    return box({ flexDirection: 'column', flexShrink: 0, marginBottom: 7 },
      text(`${contestLabel(entry.competition)} · ${entry.teamName}${reference}`, { fontWeight: 700, fontSize: 20 }),
      text(`Team rank ${rank} · Score ${score} · ${standingStatus(entry)}`, { fontSize: 17, color: MUTED }),
      text(dateLabel(entry.observedAt), { fontSize: 14, color: MUTED }));
  });
  const history = selection.history.map(row => text(`${row.teamName} · ${contestLabel(row.competition)} ${row.season} · ${row.status === 'previous' ? 'Earlier team observed' : row.status === 'current' ? 'Current team observed' : 'Last observed'} ${shortDate(row.firstObservedAt)}–${shortDate(row.lastObservedAt)}${cite(row.sourceUrl, row.sourceTitle, row.lastObservedAt)}`, { fontSize: 17, marginBottom: 6 }));
  const facts = selection.highlights.map(fact => text(`${fact.text}${cite(fact.sourceUrl, fact.sourceTitle, fact.checkedAt)}`, { marginBottom: 7 }));
  const members = card.kind === 'team' ? [...new Set(selection.entries.flatMap(entry => entry.members.map(member => member.name || member.handle)))] : [];
  const body = box({ position: 'absolute', top: 166, left: 16, right: 16, flexDirection: 'column' },
    heading(card.kind === 'person' ? 'Teams & competition record' : 'Team competition record'),
    ...teamRecords,
    members.length ? text(`Roster: ${members.join(' · ')}`, { fontSize: 17, marginBottom: 5 }) : null,
    history.length ? heading('Team history & observations') : null,
    ...history,
    facts.length ? heading(card.kind === 'person' ? 'Kaggle career & highlights' : 'From the team file') : null,
    ...facts,
    sources.length ? heading('Sources · full links in the online record') : null,
    ...sources.map((source, index) => text(`[${index + 1}] ${source.title} · checked ${shortDate(source.checkedAt)}`, { fontSize: 13, color: MUTED, lineHeight: 1.15, marginBottom: 3 })));
  body.props.id = 'collection-back-body';
  const account = card.accounts.find(item => /^https:\/\/(?:www\.)?kaggle\.com\/[a-z0-9_-]+\/?$/iu.test(item.url));
  const cardUrl = `arc.markbarney.net${card.cardUrl}`;
  return box({ width: WIDTH, height: HEIGHT, padding: 20, background: EDGE, color: INK, fontFamily: `${SANS}, ${CJK}`, fontWeight: 500 },
    box({ width: 710, height: 1010, padding: 14, border: `2px solid ${GOLD}`, flexDirection: 'column', background: PAPER, position: 'relative' },
      box({ justifyContent: 'space-between', alignItems: 'baseline' },
        label(`No. ${card.number} · The record`, { color: INK, fontSize: 17, letterSpacing: .6 }),
        label(`${card.kind === 'person' ? 'Player' : 'Team'} · ${card.season}`, { fontSize: 15 })),
      box({ justifyContent: 'center', marginTop: 6, paddingBottom: 7, borderBottom: `3px solid ${INK}`, fontFamily: SERIF, fontWeight: 700, fontSize: 25 }, 'The ARC Daily Digest'),
      box({ marginTop: 9, minHeight: 65, padding: '10px 12px', background: OXBLOOD, border: `2px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center' },
        box({ display: 'block', textAlign: 'center', width: '100%', fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700,
          fontSize: Array.from(card.name).length > 34 ? 28 : 34, lineHeight: 1.12, lineClamp: 2, overflow: 'hidden', color: '#fff3d5' }, card.name)),
      body,
      box({ position: 'absolute', left: 16, right: 16, bottom: 14, height: 76, paddingTop: 7, borderTop: `2px solid ${GOLD}`, flexDirection: 'column', gap: 4 },
        label(selection.continued ? 'Record continues online · full history & source links' : 'Full record & source links', { color: OXBLOOD, fontSize: 13, letterSpacing: .4 }),
        text(cardUrl, { fontSize: 15, lineHeight: 1.15 }),
        account ? text(`Kaggle: ${account.url.replace(/^https:\/\//u, '')}`, { fontSize: 16, color: MUTED, lineHeight: 1.15 }) : null)));
}

/**
 * This is the exact tree sent to Satori, exposed so tests inspect the drawn record rather
 * than guessing from different pixels. Reverse selection is measured with the actual fonts;
 * every omitted item has an explicit continuation notice and its permanent full-record URL.
 */
export async function buildCollectionCardNode(card: CollectionCard, side: 'front' | 'back' = 'front'): Promise<Node> {
  if (side === 'front') {
    const artwork = card.art ? await readCollectionArtwork(card.art.src, { width: ART_WIDTH, height: frontArtHeight(card) }, true) : null;
    return cardNode(card, artwork);
  }
  const selection: BackSelection = {
    entries: [...card.entries].sort((a, b) => a.competition === b.competition ? 0 : a.competition === 'arc-3' ? -1 : 1),
    history: card.teamHistory.filter(row => row.status !== 'current' || !card.entries.some(entry => entry.competitionId === row.competitionId && entry.teamId === row.teamId)),
    highlights: [...card.honors.map(honor => ({
      text: `${honor.season} ${honor.label} — ${honor.scope === 'team' ? 'team honor' : 'individual honor'} (${contestLabel(honor.competition)}).`,
      sourceUrl: honor.sourceUrl, sourceTitle: honor.sourceTitle,
      checkedAt: card.entries.find(entry => entry.competition === honor.competition && entry.sourceUrl === honor.sourceUrl)?.observedAt ?? '',
    })), ...card.highlights], fontSize: 21, continued: false,
  };
  for (;;) {
    const node = backNode(card, selection);
    let bottom = 0;
    await satori(node as Parameters<typeof satori>[0], { width: WIDTH, height: HEIGHT, fonts: loadCollectionCardFonts(),
      onNodeDetected: detected => {
        if (detected.props.id === 'collection-back-body') bottom = detected.top + detected.height;
      },
    });
    if (bottom <= 920) return node;
    if (selection.fontSize > 19) selection.fontSize--;
    else if (selection.history.length) { selection.history.pop(); selection.continued = true; }
    else if (selection.entries.length > 2) { selection.entries.pop(); selection.continued = true; }
    else if (selection.highlights.length > 1) { selection.highlights.pop(); selection.continued = true; }
    else if (selection.highlights[0]?.text.length > 100) {
      const fact = selection.highlights[0];
      const shortened = fact.text.slice(0, Math.max(80, fact.text.length - 120)).replace(/\s+\S*$/u, '');
      selection.highlights = [{ ...fact, text: `${shortened}…` }];
      selection.continued = true;
    } else {
      // Extremely long team/source names still point to the complete public record.
      selection.highlights = [];
      selection.continued = true;
      return backNode(card, selection);
    }
  }
}

/** Render curated public data; team positions never become personal or inferred honors. */
export async function buildCollectionCardImage(card: CollectionCard, side: 'front' | 'back' = 'front'): Promise<Buffer> {
  const svg = await satori(await buildCollectionCardNode(card, side) as Parameters<typeof satori>[0], {
    width: WIDTH, height: HEIGHT, fonts: loadCollectionCardFonts(),
  });
  return sharp(Buffer.from(svg)).flatten({ background: PAPER }).png({ compressionLevel: 9 }).toBuffer();
}
