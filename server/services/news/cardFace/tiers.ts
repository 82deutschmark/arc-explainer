/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: THE tier recipe table. One ordered list of rows: Kaggle's Competitions ladder (Novice to Grandmaster)
 *          followed by the three families that are not on the ladder (no tier, competition sponsor, team).
 *          Each row carries its palette, its BORDER recipe flags and its MEDALLION recipe flags. frameSvg()
 *          (svgFrame.ts) and medallionSvg() (svgBadges.ts) read those flags and never look at a tier's name or
 *          number, so a sixth rung is exactly one new row here; nothing else changes. The ladder length, each
 *          rung's number and the ladder meter on the medallion are all derived from this table.
 *          Colours loosely echo Kaggle's (green, blue, purple, orange, gold); none claims a brand hex.
 * SRP/DRY check: Pass. Data only plus a case-insensitive lookup; drawing lives in svgFrame.ts / svgBadges.ts.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): extracted from kit.ts and turned into flag-driven recipes; lookup is
 *          case-insensitive and warns once for a tier name that is not in the table; Master and Grandmaster get
 *          bigger corner pieces and a heavier medallion with a ladder meter (ring thickness unchanged).
 */

/** What decorates the four corners of the border. */
export type CornerKind = 'none' | 'discs' | 'plates' | 'brackets' | 'burst' | 'diamonds' | 'stripes';
/** What the border band is filled with. */
export type Ground = 'flat' | 'foil' | 'metal';
/** Colour roles a recipe may name (resolved against the tier's palette). */
export type Role = 'main' | 'deep' | 'light' | 'ink' | 'accent' | 'accent2' | 'shade' | 'white' | 'black' | 'gold';

export interface BorderRecipe {
  ground: Ground;
  /** inner keyline against the picture */
  innerRule: Role | null;
  /** solid stripe along the middle of the band: [role, width px at 750 wide] */
  midStripe: [Role, number] | null;
  /** thin line along the middle of the band, optionally dashed */
  midLine: { role: Role; width: number; dashed: boolean } | null;
  /** black and white pinstripes inset in the band (foil cards) */
  pinstripes: boolean;
  /** glossy diagonal sheen, 0 for none (opacity) */
  sheen: number;
  /** number of rivets along the band */
  rivets: number;
  /** star sparkles along the band */
  sparkles: boolean;
  /** hairline rainbow keyline: stroke width in px, 0 for none */
  holo: number;
  corner: CornerKind;
  /** reach of the corner piece from the card corner, px at 750 wide */
  cornerSize: number;
  /** corner piece has a chamfered, stepped (notched) inner corner */
  notched: boolean;
}

export type MedalShape = 'plain' | 'ticks' | 'studs' | 'gear' | 'burst' | 'star' | 'team';
export interface MedallionRecipe {
  shape: MedalShape;
  /** multiplies the medallion's diameter (the layout's base is 124 px) */
  scale: number;
  /** thicker outlines */
  heavy: boolean;
  /** five-bar ladder meter along the lower rim (lit bars = rung) */
  meter: boolean;
}

export interface TierStyle {
  /** canonical key, also the name Kaggle uses ("Grandmaster"); 'none', 'sponsor', 'team' for the others */
  key: string;
  /** 1-based rung on the Kaggle ladder (derived from the table order); 0 for non-ladder rows */
  rank: number;
  /** the same number under a clearer name */
  rung: number;
  ladder: boolean;
  /** short letters for the medallion (N, C, EX, M, GM) */
  abbr: string;
  /** the full word as printed on the card ("Grandmaster") */
  label: string;
  main: string; deep: string; light: string; ink: string; accent: string; accent2: string;
  /** darker tone of the main colour used for foil shading */
  shade: string;
  border: BorderRecipe;
  medal: MedallionRecipe;
}

type Row = Omit<TierStyle, 'rank' | 'rung'>;
const palette = (main: string, deep: string, light: string, ink: string, accent = '#ffffff', accent2 = '#ffffff', shade = deep) =>
  ({ main, deep, light, ink, accent, accent2, shade });
/** Border recipe with every flag off; each row switches on only what it uses. */
const plain: BorderRecipe = { ground: 'flat', innerRule: 'white', midStripe: null, midLine: null, pinstripes: false, sheen: 0, rivets: 0, sparkles: false, holo: 0, corner: 'none', cornerSize: 0, notched: false };
const disc: MedallionRecipe = { shape: 'plain', scale: 1, heavy: false, meter: false };

/** THE TABLE. Order matters: it is the Kaggle ladder, lowest rung first. */
const ROWS: Row[] = [
  { key: 'Novice', ladder: true, abbr: 'N', label: 'Novice', ...palette('#38b25a', '#14502a', '#a9e8b7', '#ffffff'),
    border: { ...plain }, medal: { ...disc } },
  { key: 'Contributor', ladder: true, abbr: 'C', label: 'Contributor', ...palette('#2f7bea', '#102f7a', '#a8cbff', '#ffffff'),
    border: { ...plain, innerRule: null, midLine: { role: 'white', width: 2.4, dashed: false }, corner: 'discs' }, medal: { ...disc, shape: 'ticks' } },
  { key: 'Expert', ladder: true, abbr: 'EX', label: 'Expert', ...palette('#8a45ee', '#34127f', '#d0b4ff', '#ffffff', '#ffffff', '#f4d03f'),
    border: { ...plain, innerRule: 'accent2', midStripe: ['deep', 7], midLine: { role: 'white', width: 3.2, dashed: true }, corner: 'plates', cornerSize: 40 }, medal: { ...disc, shape: 'studs' } },
  { key: 'Master', ladder: true, abbr: 'M', label: 'Master', ...palette('#ff9419', '#6c3100', '#ffd694', '#1c0f02', '#1c0f02', '#ffffff'),
    border: { ...plain, ground: 'foil', innerRule: 'gold', pinstripes: true, sheen: 0.2, rivets: 10, corner: 'brackets', cornerSize: 66, notched: true },
    medal: { shape: 'gear', scale: 1.12, heavy: true, meter: true } },
  { key: 'Grandmaster', ladder: true, abbr: 'GM', label: 'Grandmaster', ...palette('#f1bf2c', '#6e0f16', '#fff0a8', '#1d1304', '#d8232a', '#ffffff', '#94620a'),
    border: { ...plain, ground: 'foil', innerRule: null, midStripe: ['accent', 2.6], pinstripes: true, sheen: 0.2, sparkles: true, holo: 1.3, corner: 'burst', cornerSize: 48, notched: true },
    medal: { shape: 'burst', scale: 1.2, heavy: true, meter: true } },
  { key: 'none', ladder: false, abbr: '', label: '', ...palette('#8d97a8', '#262d3a', '#d3d9e3', '#ffffff'), border: { ...plain }, medal: { ...disc } },
  { key: 'sponsor', ladder: false, abbr: '', label: 'Sponsor', ...palette('#c8d2e0', '#0f2150', '#ffffff', '#0e1a3a', '#d8232a', '#0f2150'),
    border: { ...plain, ground: 'metal', innerRule: null, midStripe: ['deep', 5], midLine: { role: 'accent', width: 1.4, dashed: false }, sheen: 0.35, corner: 'diamonds', cornerSize: 26 },
    medal: { ...disc, shape: 'star' } },
  { key: 'team', ladder: false, abbr: '', label: 'Team', ...palette('#26272e', '#0a0b0f', '#e9ecf2', '#ffffff', '#19d3c5', '#ff4fa3'),
    border: { ...plain, innerRule: null, midLine: { role: 'white', width: 1.6, dashed: false }, corner: 'stripes', cornerSize: 150 },
    medal: { ...disc, shape: 'team' } },
];

/** Every row, with its 1-based rung computed from its place among the ladder rows. */
export const TIER_LIST: TierStyle[] = (() => {
  let rung = 0;
  return ROWS.map(r => ({ ...r, rank: r.ladder ? ++rung : 0, rung: r.ladder ? rung : 0 }));
})();
export const TIERS: Record<string, TierStyle> = Object.fromEntries(TIER_LIST.map(t => [t.key, t]));
/** The ladder's names, lowest first. Length is derived; nothing else hard-codes five. */
export const TIER_LADDER: string[] = TIER_LIST.filter(t => t.ladder).map(t => t.key);
export const LADDER_LENGTH = TIER_LADDER.length;

const byLower = new Map(TIER_LIST.filter(t => t.ladder).map(t => [t.key.toLowerCase(), t]));
const warned = new Set<string>();
/**
 * Case-insensitive ladder lookup. Returns null for no tier. A non-null name that is not on the ladder warns once
 * (so a new Kaggle tier shows up in the logs) and is treated as no tier.
 */
export function tierByName(name: unknown): TierStyle | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const hit = byLower.get(name.trim().toLowerCase());
  if (hit) return hit;
  if (!warned.has(name)) { warned.add(name); console.warn(`[cardFace] tier "${name}" is not in the tier table (tiers.ts); drawing the neutral card`); }
  return null;
}
