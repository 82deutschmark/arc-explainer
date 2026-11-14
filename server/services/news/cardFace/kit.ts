/**
 * Author: Claude Sonnet 5.5 Medium; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): now the one home of the helpers the faces had copied (back ink per tier, medal coin, the
 *          backs' half-weight border, JPEG data URI, seeded random) and of fitOneLine(), which sizes a figure or label to
 *          its box; the unused pngUri is gone.
 * PURPOSE: The card design's shared vocabulary that is not a picture: font loading (cached, read from the site's
 *          font folder under the current working directory), the Satori node helpers (box, at, pic), text
 *          measurement, and name fitting (one line, else a measured two-line split that breaks at spaces and
 *          middle dots and never inside a CJK word). It also RE-EXPORTS the drawing kit that used to live here
 *          (tier table, border, medallion, stamp, shape helpers) so the reverse (back.ts) keeps one import line.
 *          Nothing here knows about a particular card or a layout coordinate.
 * SRP/DRY check: Pass. Tier data is in tiers.ts, border in svgFrame.ts, badges in svgBadges.ts, primitives in
 *          svgShapes.ts; this file is only what the others need to talk to Satori.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version of the Topps design kit.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): foil shading tone per tier, smaller corner starbursts.
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium): production: fonts from process.cwd() server/assets/fonts/news-card (no absolute
 *          paths), a missing font file is skipped instead of throwing; drawing code split into tiers.ts, svgShapes.ts,
 *          svgFrame.ts, svgBadges.ts (re-exported here); fitNameLines() added for dot / space breaks and unbroken CJK.
 */
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { frameSvg } from './svgFrame';
import { svgDoc } from './svgShapes';
import { W as CARD_W, H as CARD_H } from './zones';
import type { TierStyle } from './tiers';

export * from './svgShapes';
export { frameSvg } from './svgFrame';
export { medallionSvg, stampSvg } from './svgBadges';
export { TIERS, TIER_LIST, TIER_LADDER, LADDER_LENGTH, tierByName, type TierStyle } from './tiers';

const FONT_DIR = path.join(process.cwd(), 'server/assets/fonts/news-card');

// ---------------------------------------------------------------------------------------------
// Fonts. Every family is registered at exactly the weights that are requested anywhere (Satori
// does not fake weights). Noto Sans JP is appended as the fallback on every stack so Japanese
// names and handles never drop glyphs. Scripts the fallback does not cover (Hangul, Thai, Arabic)
// draw as empty boxes; they never throw. All faces are static OFL TTFs.
// ---------------------------------------------------------------------------------------------
export const FONT = {
  slab: 'Slab',      // Alfa Slab One 400: names, big numerals (the chunky 1980s block face)
  bebas: 'Bebas',    // Bebas Neue 400: labels, ribbons, column heads (the price-guide caps)
  comic: 'Comic',    // Bangers 400: starbursts and the cartoon strip (comic-book lettering)
  mono: 'Mono',      // IBM Plex Mono 400/500/700: tabular figures
  cond: 'Cond',      // IBM Plex Sans Condensed 500/700: running text
  jp: 'JP',          // Noto Sans JP 400: CJK fallback
} as const;
export const ff = (family: string) => `${family}, ${FONT.jp}`;

const FACES: [string, string, number][] = [
  [FONT.slab, 'AlfaSlabOne-Regular.ttf', 400], [FONT.bebas, 'BebasNeue-Regular.ttf', 400], [FONT.comic, 'Bangers-Regular.ttf', 400],
  [FONT.mono, 'IBMPlexMono-Regular.ttf', 400], [FONT.mono, 'IBMPlexMono-Medium.ttf', 500], [FONT.mono, 'IBMPlexMono-Bold.ttf', 700],
  [FONT.cond, 'IBMPlexSansCondensed-Medium.ttf', 500], [FONT.cond, 'IBMPlexSansCondensed-Bold.ttf', 700], [FONT.jp, 'NotoSansJP-Regular.ttf', 400],
];
let fontCache: any[] | undefined;
export function loadFonts() {
  if (fontCache) return fontCache;
  const loaded: any[] = [];
  for (const [name, file, weight] of FACES) {
    try { loaded.push({ name, data: fs.readFileSync(path.join(FONT_DIR, file)), weight, style: 'normal' }); }
    catch (e) { console.warn(`[cardFace] font ${file} could not be read from ${FONT_DIR}; skipping it`); }
  }
  fontCache = loaded;
  return fontCache;
}

// ---------------------------------------------------------------------------------------------
// Satori node helpers
// ---------------------------------------------------------------------------------------------
export type Node = { type: string; props: Record<string, any> };
export type Style = Record<string, string | number>;
export type Kid = Node | string | null | false | undefined;
export const box = (style: Style, ...kids: Kid[]): Node => ({
  type: 'div', props: { style: { display: 'flex', ...style }, children: kids.filter(k => k !== null && k !== false && k !== undefined) },
});
/** Absolutely positioned box in card coordinates. */
export const at = (x: number, y: number, w: number | null, h: number | null, style: Style, ...kids: Kid[]): Node =>
  box({ position: 'absolute', left: x, top: y, ...(w == null ? {} : { width: w }), ...(h == null ? {} : { height: h }), ...style }, ...kids);
export const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
export const jpegUri = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString('base64')}`;
/** Full-size or positioned picture node; Satori demands explicit pixel sizes on images. */
export const pic = (src: string, x: number, y: number, w: number, h: number, style: Style = {}): Node =>
  ({ type: 'img', props: { src, width: w, height: h, style: { position: 'absolute', left: x, top: y, width: w, height: h, ...style } } });
export const svgPic = (svg: string, x: number, y: number, w: number, h: number, style: Style = {}) => pic(svgUri(svg), x, y, w, h, style);
export const MEDAL = { gold: '#f2b600', silver: '#c5ccd6', bronze: '#c9772f' };
/** A medal coin (gold / silver / bronze) drawn on a 36-unit grid, `size` px square. */
export const coinSvg = (colour: string, size = 36) => svgDoc(size, size, `<circle cx="18" cy="18" r="16.5" fill="${colour}" stroke="#000" stroke-width="2.4"/><circle cx="18" cy="18" r="11.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/><path d="M9 11 A12 12 0 0 1 20 6" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, '', [36, 36]);
/** First ink of a card back: the tier colour darkened until it prints legibly on grey cardboard or cream paper (keyed by TierStyle.key). */
export const INK1: Record<string, string> = { Novice: '#1b7d38', Contributor: '#1d55bd', Expert: '#5a27bd', Master: '#b04800', Grandmaster: '#a8121b', none: '#4f596b', sponsor: '#16306e', team: '#0a766e' };
/**
 * The tier border at half weight, as every back draws it. The card-stock path in frameSvg is a full rectangle with a rounded
 * hole; it needs the even-odd rule to stay a frame (a no-op if frameSvg already says so).
 */
export function backBorderSvg(T: TierStyle): string {
  return frameSvg(T, CARD_W, CARD_H, 0.5).replace(/(<path d="M0 0H[^"]*")( fill="#f2ead4")/, (m, a, b) => (/fill-rule/.test(m) ? m : `${a} fill-rule="evenodd"${b}`));
}
/** Seeded linear congruential generator in [0, 1): the same seed always draws the same texture or placeholder. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------------------------------------------------------------------------------------------
// Text measurement. Width scales linearly with font size, so each string is measured once at 100px.
// ---------------------------------------------------------------------------------------------
const w100 = new Map<string, number>();
export async function textWidth(text: string, family: string, weight: number, size: number, letterSpacing = 0): Promise<number> {
  const key = `${family}|${weight}|${text}`;
  let w = w100.get(key);
  if (w === undefined) {
    let found = 0;
    const node = box({ width: 8000, height: 200 }, { type: 'div', props: { id: 'm', style: { display: 'flex', fontFamily: ff(family), fontWeight: weight, fontSize: 100, whiteSpace: 'nowrap' }, children: text } });
    await satori(node as any, { width: 8000, height: 200, fonts: loadFonts(), onNodeDetected: (n: any) => { if (n.props?.id === 'm') found = n.width; } });
    w = found; w100.set(key, w);
  }
  return (w * size) / 100 + letterSpacing * Array.from(text).length;
}
/**
 * The largest size from `max` down to `min` at which `text` fits one line of `maxWidth` (width is linear in size, so this is
 * measured once, not stepped). Below `min` it returns `min`: the caller's box clips as the backstop.
 */
export async function fitOneLine(text: string, family: string, weight: number, maxWidth: number, max: number, min: number, letterSpacing = 0): Promise<number> {
  const at100 = await textWidth(text, family, weight, 100);
  if (!at100) return max;
  const room = maxWidth - letterSpacing * Array.from(text).length;
  return Math.max(min, Math.min(max, Math.floor((room / at100) * 100 * 2) / 2));
}
/** Height of `text` wrapped to `maxWidth` (used for the two-line name fallback). */
export async function wrappedHeight(text: string, family: string, weight: number, size: number, lineHeight: number, maxWidth: number): Promise<number> {
  let found = 0;
  const node = box({ width: maxWidth, height: 600 }, { type: 'div', props: { id: 'm', style: { display: 'flex', width: maxWidth, fontFamily: ff(family), fontWeight: weight, fontSize: size, lineHeight }, children: text } });
  await satori(node as any, { width: maxWidth, height: 600, fonts: loadFonts(), onNodeDetected: (n: any) => { if (n.props?.id === 'm') found = n.height; } });
  return found;
}
/** Largest size (stepping down) at which `text` fits one line in maxWidth; or a two-line fallback. */
export async function fitName(text: string, family: string, weight: number, maxWidth: number, maxHeight: number,
  sizes: { max: number; min: number; twoLineMax: number; twoLineMin: number }): Promise<{ size: number; lines: 1 | 2 }> {
  for (let s = sizes.max; s >= sizes.min; s -= 2) if (await textWidth(text, family, weight, s) <= maxWidth) return { size: s, lines: 1 };
  for (let s = sizes.twoLineMax; s >= sizes.twoLineMin; s -= 1) {
    if ((await wrappedHeight(text, family, weight, s, 1.04, maxWidth)) <= maxHeight) return { size: s, lines: 2 };
  }
  return { size: sizes.twoLineMin, lines: 2 };
}


// ---------------------------------------------------------------------------------------------
// Name fitting that understands where a name may break.
// ---------------------------------------------------------------------------------------------
/** Break opportunities: after a space, a middle dot (・ · •) or a slash. CJK runs without them stay whole. */
export function nameTokens(text: string): string[] {
  return text.match(/[^\s・·•／/]+[\s・·•／/]*|[\s・·•／/]+/g)?.map(t => t.replace(/\s+$/, ' ')) ?? [text];
}
/**
 * Fit a name into maxWidth x maxHeight: one line from sizes.max down to sizes.min; else the best two-line split
 * (smallest widest line) from sizes.twoLineMax down; else one line shrunk until it fits (a long unbroken CJK name).
 * Returns the lines to print, each to be drawn nowrap, so the renderer never wraps mid-word.
 */
export async function fitNameLines(text: string, family: string, weight: number, maxWidth: number, maxHeight: number,
  sizes: { max: number; min: number; twoLineMax: number; twoLineMin: number }, lineHeight = 1.04): Promise<{ size: number; lines: string[] }> {
  const clean = text.trim();
  for (let s = sizes.max; s >= sizes.min; s -= 2) if (await textWidth(clean, family, weight, s) <= maxWidth) return { size: s, lines: [clean] };
  const toks = nameTokens(clean);
  if (toks.length > 1) {
    // widths at 100px, so the best split is found once and only scaled afterwards
    const w100 = await Promise.all(toks.map((_, i) => i === 0 ? 0 : textWidth(toks.slice(0, i).join('').trimEnd(), family, weight, 100)));
    const rest100 = await Promise.all(toks.map((_, i) => i === 0 ? 0 : textWidth(toks.slice(i).join('').trimEnd(), family, weight, 100)));
    let best = 1, bestW = Infinity;
    for (let i = 1; i < toks.length; i++) { const m = Math.max(w100[i], rest100[i]); if (m < bestW) { bestW = m; best = i; } }
    const lines = [toks.slice(0, best).join('').trimEnd(), toks.slice(best).join('').trimEnd()];
    for (let s = sizes.twoLineMax; s >= sizes.twoLineMin; s -= 1) if ((bestW * s) / 100 <= maxWidth && s * lineHeight * 2 <= maxHeight) return { size: s, lines };
  }
  const w1 = await textWidth(clean, family, weight, 100);
  return { size: Math.max(12, Math.floor((maxWidth / w1) * 100)), lines: [clean] };
}
