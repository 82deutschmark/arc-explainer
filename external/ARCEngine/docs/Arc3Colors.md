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
