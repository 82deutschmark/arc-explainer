/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Render one permanent Card Cabinet front as a 750×1050 PNG. All labels and
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
import type { CollectionCard, CollectionEntry } from '../../../shared/newsCollection';

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
function loadFonts() {
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
async function localArtwork(src: string): Promise<Buffer | null> {
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
    return await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({
      width: ART_WIDTH, height: ART_HEIGHT, fit: 'contain', background: PAPER,
    }).png().toBuffer();
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

const label = (text: string, style: Style = {}) => box({
  fontFamily: `${SANS}, ${CJK}`, fontWeight: 700, fontSize: 15, color: MUTED,
  letterSpacing: 1.4, textTransform: 'uppercase', ...style,
}, text);

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

function cardNode(card: CollectionCard, artwork: Buffer | null): Node {
  const nameLength = Array.from(card.name).length;
  const nameSize = nameLength <= 23 ? 44 : nameLength <= 42 ? 36 : 30;
  const honor = card.honors[0];
  const artWindow = artwork
    ? { type: 'img', props: { src: `data:image/png;base64,${artwork.toString('base64')}`, width: ART_WIDTH, height: ART_HEIGHT } }
    : box({ width: ART_WIDTH, height: ART_HEIGHT, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#ede2c9', border: `4px solid ${HAIR}` },
      box({ fontFamily: `${SERIF}, ${CJK}`, fontSize: 130, fontWeight: 700, color: OXBLOOD }, initials(card.name)),
      label('The ARC Daily Digest', { marginTop: 24, color: GOLD, fontSize: 18 }));

  return box({ width: WIDTH, height: HEIGHT, padding: 20, background: EDGE, color: INK, fontFamily: `${SANS}, ${CJK}`, fontWeight: 500 },
    box({ width: 710, height: 1010, padding: 14, border: `2px solid ${GOLD}`, flexDirection: 'column', background: PAPER },
      box({ justifyContent: 'space-between', alignItems: 'baseline' },
        label(`No. ${card.number}`, { color: INK, fontSize: 17, letterSpacing: 1 }),
        label(`${card.kind === 'person' ? 'Individual' : 'Team'} · ${card.season}`, { fontSize: 15 })),
      box({ justifyContent: 'center', marginTop: 8, paddingBottom: 9, borderBottom: `3px solid ${INK}`, fontFamily: SERIF, fontWeight: 700, fontSize: 29, color: INK }, 'The ARC Daily Digest'),
      box({ width: ART_WIDTH + 4, height: ART_HEIGHT + 4, marginTop: 12, border: `2px solid ${INK}`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, artWindow),
      box({ marginTop: 11, minHeight: 90, padding: '12px 15px', background: OXBLOOD, border: `2px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center' },
        box({ display: 'block', textAlign: 'center', width: '100%', fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: nameSize, lineHeight: 1.12, lineClamp: 2, overflow: 'hidden', color: '#fff3d5' }, card.name)),
      box({ marginTop: 14, flexDirection: 'column' }, recordStrip(primaryEntry(card))),
      honor ? box({ marginTop: 11, padding: '8px 10px', flexDirection: 'column', borderLeft: `4px solid ${GOLD}`, background: '#eee2c6' },
        label(`${honor.kind === 'arc-prize' ? 'ARC Prize award' : 'Kaggle medal'} · ${honor.season}`, { color: GOLD, fontSize: 12, letterSpacing: .8 }),
        box({ display: 'block', marginTop: 3, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 700, fontSize: 19, lineHeight: 1.22, lineClamp: 2, overflow: 'hidden' }, honor.label))
        : card.highlights[0] ? box({ display: 'block', marginTop: 12, fontFamily: `${SERIF}, ${CJK}`, fontWeight: 400, fontSize: 18, lineHeight: 1.3, color: MUTED, lineClamp: 2, overflow: 'hidden' }, card.highlights[0].text) : null,
      box({ flexGrow: 1 }),
      box({ justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 8, borderTop: `2px solid ${GOLD}` },
        label('Card Cabinet', { color: OXBLOOD, fontSize: 14, letterSpacing: 1.6 }),
        label('arc.markbarney.net/news/cards', { fontSize: 12, letterSpacing: .3 }))));
}

/** Render a fresh card from already-curated public data; no statistics or honors are inferred. */
export async function buildCollectionCardImage(card: CollectionCard): Promise<Buffer> {
  const artwork = card.art ? await localArtwork(card.art.src) : null;
  const svg = await satori(cardNode(card, artwork) as Parameters<typeof satori>[0], {
    width: WIDTH, height: HEIGHT, fonts: loadFonts(),
  });
  return sharp(Buffer.from(svg)).flatten({ background: PAPER }).png({ compressionLevel: 9 }).toBuffer();
}
