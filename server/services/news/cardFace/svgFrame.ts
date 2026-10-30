/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: THE TIER BORDER. One SVG, W x H, transparent in the middle, drawn over the art. It is built entirely
 *          from the tier's BorderRecipe flags (tiers.ts): ground fill, mid stripe, pinstripes, mid line, sheen,
 *          rivets, sparkles, holo hairline, inner rule and a corner piece chosen from a table of corner drawers.
 *          Nothing here asks "which tier is this"; a new rung is a new row in tiers.ts.
 *          The ring is the same thickness for every tier (26 px at 750 wide, scaled by `s` for the thinner
 *          reverse) so the art window never moves. Only the corners may grow: a corner piece is allowed to
 *          reach into the picture along the two edges it sits on (never onto a face) and is the main way
 *          Master and Grandmaster announce themselves at thumbnail size.
 * SRP/DRY check: Pass. Shape primitives come from svgShapes.ts; recipes from tiers.ts.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): moved out of kit.ts and made recipe-driven (was a numeric if/else chain).
 *          Grandmaster band is gold foil with a hairline holo and gold sparkles (no pink candy-stripe); Master and
 *          Grandmaster corner pieces are larger and notched.
 */
import type { TierStyle, Role } from './tiers';
import { foil, metal, rr, starburst, svgDoc } from './svgShapes';

const GOLD = '#ffd24a';
/** Resolve a recipe colour role against the tier's palette. */
const colour = (T: TierStyle, role: Role): string =>
  ({ main: T.main, deep: T.deep, light: T.light, ink: T.ink, accent: T.accent, accent2: T.accent2, shade: T.shade, white: '#ffffff', black: '#000000', gold: GOLD } as Record<Role, string>)[role];

interface Corner { x: number; y: number; sx: number; sy: number }
interface Ctx { T: TierStyle; W: number; H: number; k: (n: number) => number; mid: number; size: number; notched: boolean }
/** Point at (u, v) measured inward from a corner along its two edges. */
const pt = (c: Corner, k: (n: number) => number, u: number, v: number) => `${c.x + c.sx * k(u)},${c.y + c.sy * k(v)}`;

/** One drawer per CornerKind. Keyed by name, so a new kind is a new entry and no chain grows. */
const CORNERS: Record<string, (c: Corner, x: Ctx) => string> = {
  none: () => '',
  discs: (c, { T, k, mid }) =>
    `<circle cx="${c.x + c.sx * mid}" cy="${c.y + c.sy * mid}" r="${k(9)}" fill="#fff"/><circle cx="${c.x + c.sx * mid}" cy="${c.y + c.sy * mid}" r="${k(4.4)}" fill="${T.deep}"/>`,
  plates: (c, { T, k, mid, size, notched }) => {
    // mitred plate with a white diamond; a notched plate steps its inner corner
    const a = size / k(1);
    const pts = notched ? [[4, 4], [a, 4], [a, 22], [30, 22], [22, 30], [22, a], [4, a]] : [[4, 4], [a, 4], [26, 26], [4, a]];
    return `<polygon points="${pts.map(([u, v]) => pt(c, k, u, v)).join(' ')}" fill="${T.deep}" stroke="#000" stroke-width="${k(1.4)}"/><polygon points="${starburst(c.x + c.sx * mid, c.y + c.sy * mid, 4, k(8), k(3))}" fill="#fff"/>`;
  },
  brackets: (c, { T, k, size, notched }) => {
    // metal corner bracket. Notched: an L whose arms are wide enough to step out of the ring, with a chamfered inner corner.
    const a = size / k(1), w = a * 0.5;
    const pts = notched ? [[4, 4], [a, 4], [a, w], [w + 14, w], [w, w + 14], [w, a], [4, a]] : [[4, 4], [a, 4], [4, a]];
    return `<polygon points="${pts.map(([u, v]) => pt(c, k, u, v)).join(' ')}" fill="url(#mt)" stroke="#000" stroke-width="${k(1.8)}" stroke-linejoin="round"/>`
      + `<circle cx="${c.x + c.sx * k(18)}" cy="${c.y + c.sy * k(18)}" r="${k(7.5)}" fill="${T.deep}" stroke="#000" stroke-width="${k(1.4)}"/><circle cx="${c.x + c.sx * k(18)}" cy="${c.y + c.sy * k(18)}" r="${k(3)}" fill="${T.light}"/>`;
  },
  burst: (c, { T, k, size }) => {
    // 12-point foil starburst with a gem; the biggest corner piece
    const x = c.x + c.sx * k(26), y = c.y + c.sy * k(26), ro = size;
    return `<polygon points="${starburst(x, y, 12, ro, ro * 0.66)}" fill="url(#fb)" stroke="#000" stroke-width="${k(2.4)}" stroke-linejoin="round"/>`
      + `<polygon points="${starburst(x, y, 12, ro * 0.58, ro * 0.44)}" fill="none" stroke="#000" stroke-width="${k(1.2)}" opacity=".6"/>`
      + `<circle cx="${x}" cy="${y}" r="${ro * 0.3}" fill="${T.accent}" stroke="#000" stroke-width="${k(1.8)}"/><polygon points="${starburst(x, y, 5, ro * 0.2, ro * 0.08)}" fill="#fff"/>`;
  },
  diamonds: (c, { T, k, mid }) =>
    `<polygon points="${c.x + c.sx * mid},${c.y + c.sy * k(4)} ${c.x + c.sx * k(26)},${c.y + c.sy * mid} ${c.x + c.sx * mid},${c.y + c.sy * k(24)} ${c.x + c.sx * k(4)},${c.y + c.sy * mid}" fill="${T.deep}" stroke="#fff" stroke-width="${k(1.2)}"/>`,
  stripes: (c, { T, k, size }) => {
    // Donruss-style: two coloured stripes running out of the corner along both edges (drawn on two diagonal corners only)
    if (c.sx !== c.sy) return '';
    let s = '';
    for (const [off, col] of [[k(6), T.accent], [k(11.5), T.accent2]] as const)
      s += `<path d="M${c.x + c.sx * off} ${c.y + c.sy * k(4)}V${c.y + c.sy * size}M${c.x + c.sx * k(4)} ${c.y + c.sy * off}H${c.x + c.sx * size}" stroke="${col}" stroke-width="${k(4)}" fill="none"/>`;
    return s;
  },
};

/** Fill for each ground type. */
const GROUND: Record<string, (T: TierStyle) => string> = { flat: T => T.main, foil: () => 'url(#fb)', metal: () => 'url(#mt)' };

export function frameSvg(T: TierStyle, W: number, H: number, s = 1): string {
  const R = T.border, k = (n: number) => n * s;
  const i0 = k(4), i1 = k(22), t = k(26), rad = k(20), mid = k(13);
  const ring = `M${i0} ${i0}H${W - i0}V${H - i0}H${i0}Z${rr(i1, i1, W - 2 * i1, H - 2 * i1, rad)}`;
  const stock = `M0 0H${W}V${H}H0Z${rr(t, t, W - 2 * t, H - 2 * t, rad + k(3))}`;
  const midline = rr(mid, mid, W - 2 * mid, H - 2 * mid, k(10));
  const inner = (e: number) => rr(i1 - k(e), i1 - k(e), W - 2 * i1 + k(2 * e), H - 2 * i1 + k(2 * e), rad);
  let defs = `${foil('fb', T)}${metal('mt')}<clipPath id="rc"><path clip-rule="evenodd" d="${ring}"/></clipPath>`;
  if (R.holo) defs += `<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7fb3"/><stop offset=".2" stop-color="#ffe066"/><stop offset=".4" stop-color="#6dffb0"/><stop offset=".6" stop-color="#5bd3ff"/><stop offset=".8" stop-color="#b08cff"/><stop offset="1" stop-color="#ff7fb3"/></linearGradient>`;
  const corners: Corner[] = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => ({ x: a ? W : 0, y: b ? H : 0, sx: a ? -1 : 1, sy: b ? -1 : 1 }));

  const layers: string[] = [`<path fill-rule="evenodd" d="${stock}" fill="#f2ead4"/>`, `<path fill-rule="evenodd" d="${ring}" fill="${GROUND[R.ground](T)}"/>`];
  if (R.midStripe) layers.push(`<path d="${midline}" fill="none" stroke="${colour(T, R.midStripe[0])}" stroke-width="${k(R.midStripe[1])}"/>`);
  if (R.pinstripes) layers.push(`<path d="${rr(k(8), k(8), W - k(16), H - k(16), k(14))}" fill="none" stroke="#000" stroke-width="${k(1.6)}"/><path d="${rr(k(18), k(18), W - k(36), H - k(36), k(16))}" fill="none" stroke="#fff" stroke-width="${k(1.6)}"/>`);
  if (R.midLine) layers.push(`<path d="${midline}" fill="none" stroke="${colour(T, R.midLine.role)}" stroke-width="${k(R.midLine.width)}"${R.midLine.dashed ? ` stroke-dasharray="${k(14)} ${k(9)}"` : ''}/>`);
  if (R.sheen) layers.push(`<g clip-path="url(#rc)" opacity="${R.sheen}"><polygon points="0,${H * .12} ${W * .5},0 ${W * .62},0 0,${H * .26}" fill="#fff"/><polygon points="${W},${H * .56} ${W * .3},${H} ${W * .2},${H} ${W},${H * .42}" fill="#fff"/><polygon points="${W},${H * .88} ${W * .86},${H} ${W * .8},${H} ${W},${H * .94}" fill="#fff"/></g>`);
  if (R.rivets) {
    // evenly spread along the four edges of the band, never in a corner
    const hN = Math.max(1, Math.round((R.rivets * W) / (2 * (W + H)))), vN = Math.max(1, Math.round((R.rivets - 2 * hN) / 2));
    const spots: [number, number][] = [];
    for (let i = 1; i <= hN; i++) spots.push([(W * i) / (hN + 1), mid], [(W * i) / (hN + 1), H - mid]);
    for (let i = 1; i <= vN; i++) spots.push([mid, (H * i) / (vN + 1)], [W - mid, (H * i) / (vN + 1)]);
    for (const [x, y] of spots) layers.push(`<circle cx="${x}" cy="${y}" r="${k(4.6)}" fill="url(#mt)" stroke="#000" stroke-width="${k(1.2)}"/>`);
  }
  if (R.sparkles) {
    const spark = (x: number, y: number) => `<polygon points="${starburst(x, y, 4, k(6.4), k(1.8))}" fill="#fff" stroke="${T.shade}" stroke-width="${k(.9)}"/>`;
    const gap = 58 * s, lo = 96 * s;
    let sp = '';
    for (let x = lo; x < W - lo; x += gap) sp += spark(x, k(10.5)) + spark(x, H - k(10.5));
    for (let y = lo; y < H - lo; y += gap) sp += spark(k(10.5), y) + spark(W - k(10.5), y);
    layers.push(sp);
  }
  if (R.holo) layers.push(`<path d="${inner(1.5)}" fill="none" stroke="url(#holo)" stroke-width="${k(R.holo)}"/>`);
  if (R.innerRule) layers.push(`<path d="${inner(1)}" fill="none" stroke="${colour(T, R.innerRule)}" stroke-width="${k(R.innerRule === 'white' ? 2 : 2.2)}"${R.innerRule === 'white' ? ' opacity=".85"' : ''}/>`);
  const drawCorner = CORNERS[R.corner] ?? CORNERS.none;
  const cx: Ctx = { T, W, H, k, mid, size: k(R.cornerSize), notched: R.notched };
  for (const c of corners) layers.push(drawCorner(c, cx));
  // black keylines: outer edge, between band and stock, and against the picture
  layers.push(`<path d="M${i0} ${i0}H${W - i0}V${H - i0}H${i0}Z" fill="none" stroke="#000" stroke-width="${k(1.6)}"/><path d="${rr(i1, i1, W - 2 * i1, H - 2 * i1, rad)}" fill="none" stroke="#000" stroke-width="${k(1.6)}"/><path d="${rr(t, t, W - 2 * t, H - 2 * t, rad + k(3))}" fill="none" stroke="#000" stroke-width="${k(2.4)}"/>`);
  return svgDoc(W, H, layers.join(''), defs);
}

/** Exported for the corner-clearance check in the scratch renderer. */
export const cornerReach = (T: TierStyle) => T.border.cornerSize + (T.border.corner === 'burst' ? 26 : 0);
