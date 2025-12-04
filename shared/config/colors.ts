/**
 * Author: Cascade
 * Date: 2025-12-04
 * PURPOSE: Shared ARC-AGI color tuples ([r,g,b]) for indices 0-9.
 *          This module is safe to import from both client and server code so
 *          that React components and Node services (e.g. grid image rendering)
 *          use a single source of truth for the palette.
 * SRP/DRY check: Pass — defines only the base tuples; derived formats such as
 *                CSS rgb() strings or hex codes are built in consumer modules.
 */

/** Numeric tuples [r,g,b] matching ARC-AGI documentation. */
export const ARC_COLORS_TUPLES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],        // 0 Black
  [0, 116, 217],    // 1 Blue
  [255, 65, 54],    // 2 Red
  [46, 204, 64],    // 3 Green
  [255, 220, 0],    // 4 Yellow
  [128, 128, 128],  // 5 Grey
  [240, 18, 190],   // 6 Magenta/Pink
  [255, 133, 27],   // 7 Orange
  [127, 219, 255],  // 8 Light Blue/Cyan
  [128, 0, 0],      // 9 Maroon
] as const;
