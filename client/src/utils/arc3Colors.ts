/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Color palette and utilities for ARC-AGI-0 grid visualization, mapping integers 0-15 to colors.
SRP/DRY check: Pass — centralizes color definitions used across ARC3 visualization components.
*/

export const ARC3_COLORS: Record<number, string> = {
  0: '#FFFFFF',  // White
  1: '#CCCCCC',  // Light Gray
  2: '#999999',  // Gray
  3: '#666666',  // Dark Gray
  4: '#333333',  // Darker Gray
  5: '#000000',  // Black
  6: '#E53AA3',  // Pink
  7: '#FF7BCC',  // Light Pink
  8: '#F93C31',  // Red
  9: '#1E93FF',  // Blue
  10: '#88D8F1', // Light Blue
  11: '#FFDC00', // Yellow
  12: '#FF851B', // Orange
  13: '#921231', // Dark Red
  14: '#4FCC30', // Green
  15: '#A356D0', // Purple
} as const;

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

export function getArc3Color(value: number): string {
  if (value >= 0 && value <= 15) {
    return ARC3_COLORS[value];
  }
  // Return a default color for invalid values
  return '#888888';
}

export function getArc3ColorName(value: number): string {
  if (value >= 0 && value <= 15) {
    return ARC3_COLOR_NAMES[value];
  }
  return 'Unknown';
}

export function getContrastColor(backgroundColor: string): string {
  // Simple contrast calculation - returns black or white based on background brightness
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

export type Arc3ColorEntry = {
  value: number;
  color: string;
  name: string;
  count?: number;
};

export function getColorDistribution(grid: number[][]): Arc3ColorEntry[] {
  const distribution: Record<number, number> = {};
  
  // Count occurrences of each color
  for (const row of grid) {
    for (const cell of row) {
      distribution[cell] = (distribution[cell] || 0) + 1;
    }
  }
  
  // Convert to array and sort by value
  return Object.entries(distribution).map(([value, count]) => ({
    value: parseInt(value),
    color: ARC3_COLORS[parseInt(value)],
    name: ARC3_COLOR_NAMES[parseInt(value)],
    count,
  })).sort((a, b) => a.value - b.value);
}
