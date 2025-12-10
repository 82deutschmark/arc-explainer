/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-07
 * PURPOSE: Server-side color distribution analysis for Arc3 grids.
 *          Calculates which colors appear in a grid and their frequencies,
 *          using the Arc3 16-color palette (0-15).
 * SRP/DRY check: Pass — focuses only on color analysis for agent context enrichment.
 */

import { getArc3ColorName } from '@shared/config/arc3Colors';

export interface ColorDistribution {
  value: number;      // Color index (0-15)
  name: string;       // Human-readable name (e.g., "Red", "Blue")
  count: number;      // Number of cells with this color
  percentage: number; // Percentage of total cells (0-100)
}

/**
 * Calculate color distribution for a 2D Arc3 grid.
 * Returns only colors that actually appear in the grid.
 *
 * @param grid 2D array of color indices (0-15)
 * @returns Array of color distributions, sorted by color value
 */
export function calculateColorDistribution(grid: number[][]): ColorDistribution[] {
  if (!grid.length || !grid[0]?.length) {
    return [];
  }

  const rows = grid.length;
  const cols = grid[0].length;
  const totalCells = rows * cols;

  // Count occurrences of each color
  const counts: Record<number, number> = {};

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const value = grid[y]?.[x] ?? 0;
      counts[value] = (counts[value] || 0) + 1;
    }
  }

  // Convert to distribution array
  const distribution: ColorDistribution[] = [];

  for (const [valueStr, count] of Object.entries(counts)) {
    const value = parseInt(valueStr, 10);
    distribution.push({
      value,
      name: getArc3ColorName(value),
      count,
      percentage: Math.round((count / totalCells) * 100 * 10) / 10, // Round to 1 decimal
    });
  }

  // Sort by color value (0-15)
  distribution.sort((a, b) => a.value - b.value);

  return distribution;
}

/**
 * Get a text summary of the color distribution for agent context.
 * Example: "Grid is 92.3% White (0) with small amounts of Red (8) and Blue (9)"
 */
export function summarizeColorDistribution(distribution: ColorDistribution[]): string {
  if (!distribution.length) {
    return 'Empty grid';
  }

  // Sort by percentage descending
  const sorted = [...distribution].sort((a, b) => b.percentage - a.percentage);

  const dominant = sorted[0];

  if (sorted.length === 1) {
    return `Grid is entirely ${dominant.name} (${dominant.value})`;
  }

  const others = sorted.slice(1, 4); // Top 3 other colors
  const otherDescriptions = others.map(c => `${c.name} (${c.value})`);

  if (dominant.percentage > 80) {
    return `Grid is ${dominant.percentage}% ${dominant.name} (${dominant.value}) with small amounts of ${otherDescriptions.join(', ')}`;
  }

  return `Grid contains ${dominant.name} (${dominant.percentage}%), ${others.map(c => `${c.name} (${c.percentage}%)`).join(', ')}`;
}
