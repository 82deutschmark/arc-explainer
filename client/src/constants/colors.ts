/**
 * client/src/constants/colors.ts
 *
 * Single source of truth for ARC-AGI color mapping (indexes 0-9).
 * Exposes multiple formats for flexible use across the app:
 * - ARC_COLORS (rgb() strings) for CSS inline styles
 * - ARC_COLORS_HEX (hex strings) for legacy consumers or charts
 * - ARC_COLORS_TUPLES ([r,g,b]) for canvas/image processing
 *
 * Author: Cascade (model: Cascade)
 */

import { ARC_COLORS_TUPLES as SHARED_ARC_COLORS_TUPLES } from '@shared/config/colors';

/** Numeric tuples [r,g,b] matching docs in client/src/constants/colors.md */
export const ARC_COLORS_TUPLES: ReadonlyArray<readonly [number, number, number]> = SHARED_ARC_COLORS_TUPLES;

/** Primary CSS-friendly rgb() strings */
export const ARC_COLORS: string[] = ARC_COLORS_TUPLES.map(
  ([r, g, b]) => `rgb(${r}, ${g}, ${b})`
);

/** Hex strings for consumers that prefer #RRGGBB */
export const ARC_COLORS_HEX: string[] = ARC_COLORS_TUPLES.map(([r, g, b]) => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
});

/** Optional human-readable names for reference/UI (not used for styling) */
export const ARC_COLOR_NAMES: string[] = [
  'Black',
  'Blue',
  'Red',
  'Green',
  'Yellow',
  'Grey',
  'Magenta/Pink',
  'Orange',
  'Light Blue/Cyan',
  'Maroon',
];
