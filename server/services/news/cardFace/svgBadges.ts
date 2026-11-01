/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: The two round badges of a front, as SVG: the TIER MEDALLION (the circle where an 80s card prints the
 *          position) and the LIVE / FINAL starburst STAMP. The medallion is drawn from the tier's
 *          MedallionRecipe (tiers.ts): a shape picked by name from a table, a heavy flag for thicker outlines,
 *          and an optional five-bar ladder meter whose lit bars equal the tier's rung (the ladder length comes
 *          from the table, so a sixth rung adds a bar by itself). The letters (N, C, EX, M, GM) and the stamp's
 *          words are typeset over these by the layout.
 * SRP/DRY check: Pass. Shape primitives from svgShapes.ts; recipes from tiers.ts; no layout here.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): moved out of kit.ts; shapes are a lookup table, not a numeric chain;
 *          heavy outlines and the ladder meter for Master and Grandmaster; stamp is parametrised for the compact
 *          badge-band size.
 */
import type { TierStyle } from './tiers';
import { LADDER_LENGTH } from './tiers';
import { foil, metal, mix, f, starburst, gear, svgDoc } from './svgShapes';

interface MCtx { T: TierStyle; c: number; hv: number }
/** One drawer per MedalShape; each returns the body markup (after the soft drop shadow). */
const SHAPES: Record<string, (x: MCtx) => string> = {
  plain: ({ T, c }) => `<circle cx="${c}" cy="${c}" r="54" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="${c}" cy="${c}" r="48" fill="${T.main}"/><circle cx="${c}" cy="${c}" r="41" fill="none" stroke="${T.deep}" stroke-width="2.5" opacity=".8"/>`,
  ticks: ({ T, c }) => {
    let ticks = '';
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ticks += `<line x1="${f(c + 43 * Math.cos(a))}" y1="${f(c + 43 * Math.sin(a))}" x2="${f(c + 49 * Math.cos(a))}" y2="${f(c + 49 * Math.sin(a))}" stroke="#fff" stroke-width="2.4"/>`; }
    return `<circle cx="${c}" cy="${c}" r="55" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="${c}" cy="${c}" r="50" fill="${T.deep}"/>${ticks}<circle cx="${c}" cy="${c}" r="39" fill="url(#mi)" stroke="#fff" stroke-width="2.5"/>`;
  },
  studs: ({ T, c }) => {
    let studs = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; studs += `<circle cx="${f(c + 46 * Math.cos(a))}" cy="${f(c + 46 * Math.sin(a))}" r="3.2" fill="#fff"/>`; }
    return `<circle cx="${c}" cy="${c}" r="56" fill="#000"/><circle cx="${c}" cy="${c}" r="53" fill="${T.deep}"/>${studs}<circle cx="${c}" cy="${c}" r="38" fill="url(#mi)" stroke="${T.accent2}" stroke-width="3"/><circle cx="${c}" cy="${c}" r="35" fill="none" stroke="#fff" stroke-width="1.4"/>`;
  },
  gear: ({ T, c, hv }) => `<polygon points="${gear(c, c, 20, 58, 49)}" fill="url(#mf)" stroke="#000" stroke-width="${3 * hv}" stroke-linejoin="round"/><circle cx="${c}" cy="${c}" r="42" fill="${T.deep}" stroke="#000" stroke-width="${2 * hv}"/><circle cx="${c}" cy="${c}" r="38" fill="url(#mi)" stroke="#fff" stroke-width="${2.4 * hv}"/>`,
  burst: ({ T, c, hv }) => `<polygon points="${starburst(c, c, 22, 59, 46)}" fill="${T.accent}" opacity=".85" filter="url(#mg)"/><circle cx="${c + 3}" cy="${c + 4}" r="54" fill="#000" opacity=".5"/>`
    + `<polygon points="${starburst(c, c, 22, 59, 46)}" fill="url(#mf)" stroke="#000" stroke-width="${3.2 * hv}" stroke-linejoin="round"/><circle cx="${c}" cy="${c}" r="43" fill="${T.accent}" stroke="#000" stroke-width="${2.4 * hv}"/><circle cx="${c}" cy="${c}" r="38.5" fill="url(#mf)" stroke="#000" stroke-width="${2 * hv}"/><circle cx="${c}" cy="${c}" r="34.5" fill="none" stroke="${T.accent}" stroke-width="1.6"/>`,
  star: ({ T, c }) => `<polygon points="${starburst(c, c, 14, 57, 49)}" fill="url(#mm)" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="${c}" cy="${c}" r="42" fill="${T.deep}" stroke="#fff" stroke-width="3"/><circle cx="${c}" cy="${c}" r="35" fill="none" stroke="${T.accent}" stroke-width="2"/>`,
  team: ({ T, c }) => `<circle cx="${c}" cy="${c}" r="55" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="${c}" cy="${c}" r="49" fill="${T.main}"/><circle cx="${c}" cy="${c}" r="44" fill="none" stroke="${T.accent}" stroke-width="5"/><circle cx="${c}" cy="${c}" r="37" fill="none" stroke="${T.accent2}" stroke-width="3"/>`,
};

/** Five-bar (ladder length) meter on a small black plaque across the lower rim; lit bars = the tier's rung. */
function meterSvg(T: TierStyle): string {
  const n = LADDER_LENGTH, bw = 8, gap = 3, total = n * bw + (n - 1) * gap, x0 = 60 - total / 2, y = 101;
  let s = `<rect x="${f(x0 - 5)}" y="${y - 3}" width="${total + 10}" height="19" rx="4" fill="#000" stroke="#fff" stroke-width="1.4"/>`;
  for (let i = 0; i < n; i++) s += `<rect x="${f(x0 + i * (bw + gap))}" y="${y}" width="${bw}" height="13" fill="${i < T.rung ? T.main : '#3a3a42'}" stroke="${i < T.rung ? '#fff' : 'none'}" stroke-width=".8"/>`;
  return s;
}

/** The tier medallion, a `size` px square (the drawing is on a 120 unit grid). */
export function medallionSvg(T: TierStyle, size = 120): string {
  const c = 60, M = T.medal, hv = M.heavy ? 1.25 : 1;
  const defs = `${foil('mf', T)}${metal('mm')}<radialGradient id="mi" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${mix(T.light, T.main, .15)}"/><stop offset=".55" stop-color="${T.main}"/><stop offset="1" stop-color="${mix(T.main, T.deep, .55)}"/></radialGradient><filter id="mg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>`;
  // a burst draws its own shadow (it has a glow underneath); the others get a plain offset disc
  const shadow = M.shape === 'burst' ? '' : `<circle cx="${c + 3}" cy="${c + 4}" r="55" fill="#000" opacity=".5"/>`;
  const body = shadow + (SHAPES[M.shape] ?? SHAPES.plain)({ T, c, hv }) + (M.meter ? meterSvg(T) : '');
  return svgDoc(size, size, body, defs, [120, 120]);
}

/**
 * STAMPS: LIVE / FINAL starbursts (the "All-Star" burst of an 80s card), 120 unit grid, `size` px square.
 * LIVE is red and white, FINAL navy and gold.
 */
export function stampSvg(word: 'LIVE' | 'FINAL', size = 120): string {
  const live = word === 'LIVE';
  const a = live ? '#e0262c' : '#14306e', b = live ? '#ffffff' : '#f2c230', c = live ? '#8e1218' : '#0a1a44';
  const body = `<polygon points="${starburst(63, 64, 16, 58, 48)}" fill="#000" opacity=".5"/><polygon points="${starburst(60, 60, 16, 58, 48)}" fill="${a}" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="60" r="43" fill="none" stroke="${b}" stroke-width="2.6"/><circle cx="60" cy="60" r="39.5" fill="${c}" opacity=".55"/>`;
  return svgDoc(size, size, body, '', [120, 120]);
}
