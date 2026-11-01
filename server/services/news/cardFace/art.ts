/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: The picture pipeline for the card front. Turns whatever art a card has into ONE opaque 750 x 1050 layer
 *          (a JPEG buffer) that render.ts draws everything else over. Four cases:
 *            (a) contract 5:7 art (art.kind "contract-5x7")  -> full bleed, nothing drawn on the subject;
 *            (b) legacy art, good enough resolution          -> runs edge to edge across the picture window
 *                                                                (full width, below the badge band, down to the name
 *                                                                ribbon), never into the badge band;
 *            (c) legacy art that is tiny, low-res or an odd shape -> contained inside that window on a blurred, dimmed
 *                                                                copy of itself; a very wide picture is trimmed to a
 *                                                                1.5 aspect, sits at the top of the window and leaves a
 *                                                                free band beneath it for the layout (a team's roster);
 *            (d) no art, unreadable art, or a failed read    -> the designed placeholder (puzzle-grid bust).
 *          Painted-in text from last year's cards (wordmark, name plates, badges) is trimmed by a rule keyed on
 *          art.kind + art.bakedText, never on a file name or a card id.
 *          GUARD: art is only read after realpath() puts it under client/public or directly in the repo root (the Hall
 *          of Fame loose files), and only up to 32 MB; anything else is treated as "no art" (never throws).
 *          Registered art files are read-only; every derivative lives in memory.
 * SRP/DRY check: Pass. Zone numbers come from zones.ts, colours from kit.ts; the layout never touches pixels.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): focus rules per art.kind (framed card, square, group, tall group), blurred
 *          backdrop taken from the trimmed extract, head-and-shoulders placeholder, unreadable art falls back to it.
 * 30-Oct-2026 v4 (Claude Sonnet 5.5 Medium, wiring): assertCollectionArtPath(): the strict address guard the old renderer had
 *          (only /news-images/ files or a loose Hall of Fame file at the site root; no URLs, encoded dots, traversal or
 *          out-of-tree links) now lives here, next to the reader, and index.ts runs it before every render.
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium): production. Path guard and size cap; legacy art goes edge to edge in the
 *          picture window (no boxed keyline margin) unless it is small or odd, in which case it is contained below the
 *          badge band; wide pictures leave a free band; group trim tightened (stray badge and "aiders" fragment);
 *          output is a JPEG (small to embed); the art file's mtime is returned for cache keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { mix, type TierStyle } from './kit';
import { W, H, PICTURE_WINDOW, type Rect } from './zones';

export { W, H } from './zones';
/** Kept for the reverse: the contract's subject zone (x 75..675, y 100..725). */
export { SUBJECT as ZONE } from './zones';

export interface ArtResult {
  /** Opaque 750 x 1050 image (a JPEG; any raster format sharp can read). The field name is historical. */
  png: Buffer;
  mime: 'image/jpeg';
  kind: 'contract' | 'legacy' | 'placeholder';
  /** how the picture sits: full-bleed (contract), cover (edge to edge), contain (on blur), placeholder */
  mode: 'full-bleed' | 'cover' | 'contain' | 'placeholder';
  /** the picture's own rectangle inside `png` for a legacy picture (the whole window for cover), else null */
  plate: Rect | null;
  /** empty blurred space left under a wide contained picture, for the layout to use; null otherwise */
  freeBand: Rect | null;
  /** mtime of the art file in ms (0 when there is none); part of the front's cache key */
  mtimeMs: number;
}

/** Window a legacy picture may fill: full width, below the badge band, down to the ribbon. */
const WIN = PICTURE_WINDOW;
/** Widest aspect a picture may keep in the window; wider ones are trimmed at the sides to this. */
const WIDE_MAX = 1.5;
/** Source smaller than this much upscale-to-cover is "tiny" and gets contained instead. */
const MAX_COVER_SCALE = 1.7;
/** Pictures narrower than this (width / height) are contained; they would lose too much top and bottom. */
const MIN_COVER_ASPECT = 0.85;
const MAX_BYTES = 32 * 1024 * 1024;

type Focus = { x: number; y: number; w: number; h: number };
/**
 * Where the picture lives inside a baked-text legacy file, as fractions of its size. Last year's cards came from a
 * few templates, so a rule per kind is enough. A focus rect only trims; it never resamples or recolours.
 */
const BAKED_FOCUS: Record<string, Focus> = {
  // The framed illustration inside a finished card (name header above, five stat rows below).
  'legacy-tall-baked': { x: 0.05, y: 0.175, w: 0.9, h: 0.52 },
  // The 2025 square template: wordmark top-left, name and rank plates along the bottom. Trimming the left third and the
  // bottom keeps the face and armour and removes the painted "ARC Raiders" wordmark and both plates.
  'legacy-square': { x: 0.335, y: 0, w: 0.665, h: 0.735 },
  // Two people on a square (title above, big title below).
  'legacy-group': { x: 0, y: 0.065, w: 1, h: 0.595 },
  // Group on a tall framed card: the "ARC Raiders" wordmark and the "ARC 2" badge sit above the heads, the text plate below.
  'legacy-group-tall': { x: 0, y: 0.19, w: 1, h: 0.585 },
};

// ---------------------------------------------------------------------------------------------
// Guarded read
// ---------------------------------------------------------------------------------------------
/**
 * The strict boundary for a card's art ADDRESS (card.art.src), checked before any render. Registered art lives under
 * /news-images/; last year's Hall of Fame cards are loose files at the site root (for example /jfPuget3.png) and are read
 * in place so the Cabinet and the Hall of Fame show the very same file. Anything else (a URL, an encoded path, a
 * traversal, a link that leaves the tree) throws; a missing file is simply no art.
 */
export async function assertCollectionArtPath(src: string): Promise<void> {
  const publicDir = path.join(process.cwd(), 'client/public');
  const hallOfFame = /^\/[a-zA-Z0-9_-]+(?: [a-zA-Z0-9_-]+)*\.(?:png|jpe?g)$/u.test(src);
  if (!hallOfFame && !/^\/news-images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/u.test(src)) throw new Error('Invalid collection artwork path.');
  const root = await fs.promises.realpath(hallOfFame ? publicDir : path.join(publicDir, 'news-images'));
  let resolved: string;
  try { resolved = await fs.promises.realpath(path.join(publicDir, src.slice(1))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw new Error('Collection artwork is unavailable.'); }
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || (hallOfFame && relative.includes(path.sep))) throw new Error('Invalid collection artwork path.');
}

/** realpath of a file iff it is allowed art: under client/public, or a loose file directly in the repo root. */
function allowedPath(file: string): string | null {
  try {
    const root = fs.realpathSync(process.cwd());
    const real = fs.realpathSync(file);
    const pub = path.join(root, 'client/public') + path.sep;
    if (real.startsWith(pub) || path.dirname(real) === root) return fs.statSync(real).isFile() ? real : null;
  } catch { /* missing, unreadable or a broken link: treated as no art */ }
  return null;
}
async function readArt(file: string | null | undefined): Promise<{ buf: Buffer; mtimeMs: number } | null> {
  if (!file) return null;
  try {
    const real = allowedPath(file);
    if (!real) return null;
    const st = fs.statSync(real);
    if (st.size > MAX_BYTES || st.size === 0) return null;
    return { buf: await fs.promises.readFile(real), mtimeMs: st.mtimeMs };
  } catch { return null; }
}
/** The art file's mtime for cache keys (0 for none); cheap, no decoding. */
export function artMtime(card: any, override?: ArtOverride): number {
  try { const p = allowedPath(override?.file ?? card?.art?.file ?? ''); return p ? fs.statSync(p).mtimeMs : 0; } catch { return 0; }
}

// ---------------------------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------------------------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function hash(text: string) {
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
const jpeg = (p: sharp.Sharp) => p.jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();

/** (d) The placeholder: a puzzle-grid portrait plate. Pure shapes, no lettering (the layout adds the words). */
async function placeholder(seedText: string, T: TierStyle): Promise<Buffer> {
  const rand = rng(hash(seedText));
  const cell = 30, cols = W / cell, rows = Math.ceil(H / cell);
  const inHead = (x: number, y: number) => ((x - 375) / 116) ** 2 + ((y - 318) / 148) ** 2 <= 1;
  const inNeck = (x: number, y: number) => x > 328 && x < 422 && y > 420 && y < 540;
  // shoulders: a squarish superellipse so the bust reads as head and shoulders, not a dome
  const inBody = (x: number, y: number) => (Math.abs(x - 375) / 300) ** 2.6 + (Math.abs(y - 760) / 235) ** 2.6 <= 1 && y > 505;
  const bgDark = mix(T.deep, '#05060b', 0.62);
  const bg = [bgDark, bgDark, bgDark, bgDark, mix(T.deep, '#05060b', 0.3), mix(T.deep, T.main, 0.22), mix(T.deep, T.main, 0.38)];
  const fg = [T.light, mix(T.light, T.main, 0.45), T.main, mix(T.light, '#ffffff', 0.35)];
  let cells = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = c * cell + cell / 2, cy = r * cell + cell / 2;
    const sil = inHead(cx, cy) || inNeck(cx, cy) || inBody(cx, cy);
    const colour = sil ? fg[Math.floor(rand() * fg.length)] : bg[Math.floor(rand() * bg.length)];
    const dim = sil ? (cy > 560 ? 0.78 : 1) : 1;
    cells += `<rect x="${c * cell + 1}" y="${r * cell + 1}" width="${cell - 2}" height="${cell - 2}" fill="${colour}" opacity="${dim}"/>`;
  }
  // A viewfinder: four corner brackets round the bust, like a camera waiting for its subject.
  const L = 46, bx = 120, by = 150, bw = 510, bh = 520, bc = T.light;
  const bracket = (x: number, y: number, sx: number, sy: number) => `<path d="M${x} ${y + sy * L}V${y}H${x + sx * L}" fill="none" stroke="${bc}" stroke-width="5" stroke-linecap="square"/>`;
  const frame = bracket(bx, by, 1, 1) + bracket(bx + bw, by, -1, 1) + bracket(bx, by + bh, 1, -1) + bracket(bx + bw, by + bh, -1, -1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".36" r=".6"><stop offset="0" stop-color="${T.main}" stop-opacity=".30"/><stop offset="1" stop-color="${T.main}" stop-opacity="0"/></radialGradient></defs>
    ${cells}<rect width="${W}" height="${H}" fill="url(#glow)"/><rect width="${W}" height="${H}" fill="url(#fade)"/>${frame}</svg>`;
  return jpeg(sharp(Buffer.from(svg)));
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------
export interface ArtOverride {
  file?: string; kind?: string; bakedText?: boolean | null;
  /** widest aspect a legacy picture keeps before its sides are trimmed (default 1.5; a team card passes its own so the free band fits a roster) */
  wideMax?: number;
}

/** Art with a guard: any failure falls back to the designed placeholder instead of failing the card. */
export async function artLayer(card: any, T: TierStyle, override?: ArtOverride): Promise<ArtResult> {
  const mtimeMs = artMtime(card, override);
  try { return { ...(await artLayerUnsafe(card, T, override)), mtimeMs }; }
  catch (e) { return placeholderResult(card, T, mtimeMs); }
}
async function placeholderResult(card: any, T: TierStyle, mtimeMs = 0): Promise<ArtResult> {
  return { png: await placeholder(String(card?.id ?? card?.name ?? 'card'), T), mime: 'image/jpeg', kind: 'placeholder', mode: 'placeholder', plate: null, freeBand: null, mtimeMs };
}

async function artLayerUnsafe(card: any, T: TierStyle, override?: ArtOverride): Promise<Omit<ArtResult, 'mtimeMs'>> {
  const art = card?.art ?? {};
  const file: string | null = override?.file ?? art.file ?? null;
  const kind: string = override?.kind ?? art.kind ?? 'none';
  const baked = override && 'bakedText' in override ? override.bakedText : art.bakedText;
  const none = async () => ({ ...(await placeholderResult(card, T)) });
  if (!file || kind === 'none') return none();
  const read = await readArt(file);
  if (!read) return none();
  const opts = { limitInputPixels: 80_000_000, failOn: 'none' as const };

  if (kind === 'contract-5x7') {
    // Full bleed. The art is already 5:7, so cover scales without cropping a pixel.
    const png = await jpeg(sharp(read.buf, opts).rotate().flatten({ background: '#0b0c10' }).resize(W, H, { fit: 'cover' }));
    return { png, mime: 'image/jpeg', kind: 'contract', mode: 'full-bleed', plate: null, freeBand: null };
  }

  // (b)/(c) Legacy art. Read the shape, trim painted-in text if the file is known to carry it, decode once to raw.
  const meta = await sharp(read.buf, opts).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const mw = (swap ? meta.height : meta.width) ?? 0, mh = (swap ? meta.width : meta.height) ?? 0;
  if (!mw || !mh) return none();
  const tall = kind === 'legacy-group' && mw / mh < 0.8;
  const focus = baked === true ? BAKED_FOCUS[tall ? 'legacy-group-tall' : kind] : undefined;
  let pipe = sharp(read.buf, opts).rotate().flatten({ background: '#0b0c10' });
  let ew = mw, eh = mh;
  if (focus) {
    ew = Math.round(focus.w * mw); eh = Math.round(focus.h * mh);
    pipe = pipe.extract({ left: Math.round(focus.x * mw), top: Math.round(focus.y * mh), width: ew, height: eh });
  }
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });
  const rawIn = { raw: { width: info.width, height: info.height, channels: info.channels } };
  const fromRaw = () => sharp(data, rawIn);
  ew = info.width; eh = info.height;

  // Decide how the picture sits. Measured, not guessed: aspect and how far it must be enlarged to cover the window.
  const wideMax = override?.wideMax ?? WIDE_MAX;
  const aspect = ew / eh, coverScale = Math.max(WIN.w / ew, WIN.h / eh);
  const mode: 'cover' | 'contain' = aspect <= wideMax && aspect >= MIN_COVER_ASPECT && coverScale <= MAX_COVER_SCALE ? 'cover' : 'contain';
  let layer: Buffer, lw: number, lh: number, left: number, top: number, freeBand: Rect | null = null;

  if (mode === 'cover') {
    const s = coverScale, nw = Math.ceil(ew * s), nh = Math.ceil(eh * s);
    // keep the upper part: faces sit high, so only about a third of any vertical excess is taken from the top
    const cropTop = Math.round((nh - WIN.h) * 0.3), cropLeft = Math.round((nw - WIN.w) / 2);
    layer = await fromRaw().resize(nw, nh, { kernel: 'lanczos3' }).extract({ left: cropLeft, top: cropTop, width: WIN.w, height: WIN.h }).raw().toBuffer();
    lw = WIN.w; lh = WIN.h; left = WIN.x; top = WIN.y;
  } else {
    // contain. A very wide picture is trimmed at the sides to WIDE_MAX, full width, at the top of the window.
    const wide = aspect > wideMax;
    const cw = wide ? Math.round(eh * wideMax) : ew;
    const s = wide ? WIN.w / cw : Math.min(WIN.w / ew, WIN.h / eh, 2);
    lw = Math.round(cw * s); lh = Math.round(eh * s);
    let p = fromRaw();
    if (wide) p = p.extract({ left: Math.round((ew - cw) / 2), top: 0, width: cw, height: eh });
    layer = await p.resize(lw, lh, { kernel: 'lanczos3' }).raw().toBuffer();
    left = Math.round((W - lw) / 2);
    // a wide picture hugs the top of the window when the space left under it is big enough to use (a roster); else it is centred
    const room = WIN.y + WIN.h - (WIN.y + lh);
    const useBand = wide && room >= 64;
    top = useBand ? WIN.y : Math.round(WIN.y + (WIN.h - lh) / 2);
    if (useBand) freeBand = { x: 0, y: top + lh, w: W, h: room };
  }

  // The same trimmed picture, tiny, blurred, enlarged and dimmed, fills the whole card behind (no painted text can bleed through).
  const small = await fromRaw().resize(160, 224, { fit: 'cover' }).blur(3).raw().toBuffer({ resolveWithObject: true });
  const png = await jpeg(sharp(small.data, { raw: { width: small.info.width, height: small.info.height, channels: small.info.channels } })
    .resize(W, H, { kernel: 'cubic' }).modulate({ brightness: 0.5, saturation: 1.2 })
    .composite([{ input: layer, raw: { width: lw, height: lh, channels: info.channels }, left, top }]));
  return { png, mime: 'image/jpeg', kind: 'legacy', mode, plate: { x: left, y: top, w: lw, h: lh }, freeBand };
}

