/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-07
 * PURPOSE: Shared Arc3 color palette for both client and server-side rendering.
 *          Maps integers 0-15 to RGB tuples for grid-to-image conversion.
 *          This is the single source of truth for Arc3 colors across the codebase.
 * SRP/DRY check: Pass — centralizes Arc3 color definitions used by both frontend
 *                visualization and server-side image generation.
 */

/**
 * RGB tuples for Arc3 colors (0-15).
 * Used by server-side sharp library for PNG generation.
 */
export const ARC3_COLORS_TUPLES: Record<number, [number, number, number]> = {
  0: [255, 255, 255],   // White
  1: [204, 204, 204],   // Light Gray
  2: [153, 153, 153],   // Gray
  3: [102, 102, 102],   // Dark Gray
  4: [51, 51, 51],      // Darker Gray
  5: [0, 0, 0],         // Black
  6: [229, 58, 163],    // Pink (#E53AA3)
  7: [255, 123, 204],   // Light Pink (#FF7BCC)
  8: [249, 60, 49],     // Red (#F93C31)
  9: [30, 147, 255],    // Blue (#1E93FF)
  10: [136, 216, 241],  // Light Blue (#88D8F1)
  11: [255, 220, 0],    // Yellow (#FFDC00)
  12: [255, 133, 27],   // Orange (#FF851B)
  13: [146, 18, 49],    // Dark Red (#921231)
  14: [79, 204, 48],    // Green (#4FCC30)
  15: [163, 86, 208],   // Purple (#A356D0)
} as const;

/**
 * Hex color strings for Arc3 colors (0-15).
 * Used by client-side canvas rendering.
 */
export const ARC3_COLORS_HEX: Record<number, string> = {
  0: '#FFFFFF',   // White
  1: '#CCCCCC',   // Light Gray
  2: '#999999',   // Gray
  3: '#666666',   // Dark Gray
  4: '#333333',   // Darker Gray
  5: '#000000',   // Black
  6: '#E53AA3',   // Pink
  7: '#FF7BCC',   // Light Pink
  8: '#F93C31',   // Red
  9: '#1E93FF',   // Blue
  10: '#88D8F1',  // Light Blue
  11: '#FFDC00',  // Yellow
  12: '#FF851B',  // Orange
  13: '#921231',  // Dark Red
  14: '#4FCC30',  // Green
  15: '#A356D0',  // Purple
} as const;

/**
 * Human-readable color names for Arc3 colors (0-15).
 */
export const ARC3_COLOR_NAMES: Record<number, string> = {
  0: 'White',
  1: 'Light Gray',
  2: 'Gray',
  3: 'Dark Gray',
  4: 'Darker Gray',
  5: 'Black',
  6: 'Pink',
  7: 'Light Pink',
  8: 'Red',
  9: 'Blue',
  10: 'Light Blue',
  11: 'Yellow',
  12: 'Orange',
  13: 'Dark Red',
  14: 'Green',
  15: 'Purple',
} as const;

/**
 * Get RGB tuple for an Arc3 color value.
 * Returns white for invalid values.
 */
export function getArc3ColorTuple(value: number): [number, number, number] {
  const tuple = ARC3_COLORS_TUPLES[value];
  return tuple ?? [255, 255, 255];
}

/**
 * Get hex color string for an Arc3 color value.
 * Returns gray for invalid values.
 */
export function getArc3ColorHex(value: number): string {
  return ARC3_COLORS_HEX[value] ?? '#888888';
}

/**
 * Get human-readable name for an Arc3 color value.
 */
export function getArc3ColorName(value: number): string {
  return ARC3_COLOR_NAMES[value] ?? 'Unknown';
}
