/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: Leaf drawing helpers shared by every SVG generator and by the layouts: colour mixing, SVG document
 *          wrapper, rounded-rectangle path, starburst and gear polygons, halftone pattern, and the two metal
 *          gradients (tier foil, silver). No knowledge of cards, tiers or layout, and no imports, so
 *          svgFrame.ts, svgBadges.ts and kit.ts can all depend on it without a cycle.
 * SRP/DRY check: Pass. These were inline in kit.ts; moved here unchanged apart from comments.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): split out of kit.ts.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): halftone() is an unrotated staggered tile (the rotated one cost ~200 ms per front).
 */

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
/** Blend colour a toward b by t (0..1); both are #rrggbb. */
export const mix = (a: string, b: string, t: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const alpha = (c: string, a: number) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
/** Round to two decimals so generated path data stays short. */
export const f = (n: number) => Math.round(n * 100) / 100;

export const svgDoc = (w: number, h: number, body: string, defs = '', vb: [number, number] = [w, h]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vb[0]} ${vb[1]}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

/** Rounded rectangle path (clockwise). */
export const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;

/** n-pointed star polygon points (alternating outer / inner radius). */
export function starburst(cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri, a = rot + (i * Math.PI) / n;
    pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/** Gear / scalloped disc polygon: flat-topped teeth. */
export function gear(cx: number, cy: number, teeth: number, ro: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.28) / teeth) * Math.PI * 2, a2 = ((i + 0.5) / teeth) * Math.PI * 2, a3 = ((i + 0.78) / teeth) * Math.PI * 2;
    for (const [a, r] of [[a0, ri], [a1, ro], [a2, ro], [a3, ri]] as const) pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/** Diagonal foil gradient built from a palette's light / main / shade tones. */
export const foil = (id: string, c: { main: string; light: string; shade: string }) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(c.light, c.main, .35)}"/><stop offset=".2" stop-color="${c.main}"/><stop offset=".4" stop-color="${mix(c.main, c.shade, .5)}"/><stop offset=".58" stop-color="${mix(c.light, c.main, .2)}"/><stop offset=".78" stop-color="${c.main}"/><stop offset="1" stop-color="${mix(c.main, c.shade, .75)}"/></linearGradient>`;
/** Brushed-silver gradient (sponsor border, corner brackets, rivets). */
export const metal = (id: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#b9c0cc"/><stop offset=".6" stop-color="#f4f6fa"/><stop offset="1" stop-color="#7d8594"/></linearGradient>`;

/**
 * Halftone dot tile (comic print texture). A diagonal dot lattice is drawn as TWO dots in an UNROTATED square tile
 * (the tile is step * sqrt(2) wide so the dot density matches a rotated one): a patternTransform rotation makes the
 * rasteriser take a slow path (about 200 ms for a panel-sized fill), the staggered tile costs nothing.
 */
export const halftone = (id: string, color: string, op: number, step = 7, r = 1.5) => {
  const t = Math.round((step * Math.SQRT2) / 2) * 2, a = t / 4, b = (3 * t) / 4;
  return `<pattern id="${id}" width="${t}" height="${t}" patternUnits="userSpaceOnUse"><circle cx="${a}" cy="${a}" r="${r}" fill="${color}" fill-opacity="${op}"/><circle cx="${b}" cy="${b}" r="${r}" fill="${color}" fill-opacity="${op}"/></pattern>`;
};
