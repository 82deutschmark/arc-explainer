/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-07
 * PURPOSE: Server-side helpers for rendering Arc3 grids (number[][] or number[][][]) to PNG images
 *          using the Arc3 16-color palette. Optimized for 64×64 grids typical of ARC-AGI-3 games.
 *          Returns base64 data URLs suitable for vision model inputs.
 * SRP/DRY check: Pass — focuses only on Arc3 grid→image rendering; uses shared color palette.
 */

import sharp from 'sharp';
import { getArc3ColorTuple } from '@shared/config/arc3Colors';
import { logger } from '../../utils/logger.ts';

export interface Arc3GridImageOptions {
  cellSize?: number;      // Pixel size of each cell edge (default: 8 for 64×64 grids)
  margin?: number;        // Outer margin in pixels
  gridLines?: boolean;    // Whether to draw grid lines between cells
  gridLineColor?: [number, number, number]; // RGB for grid lines
  background?: [number, number, number];    // RGB background color
}

export interface Arc3GridImageResult {
  dataUrl: string;  // data:image/png;base64,...
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<Arc3GridImageOptions> = {
  cellSize: 8,        // Smaller cells for 64×64 grids (512px total)
  margin: 2,          // Minimal margin
  gridLines: false,   // No grid lines by default (cleaner for vision models)
  gridLineColor: [64, 64, 64],
  background: [240, 240, 240],  // Light gray background
};

/**
 * Render a 2D Arc3 grid to a PNG image.
 * @param grid 2D array of color indices (0-15)
 * @param options Rendering options
 * @returns Base64 data URL and dimensions
 */
async function renderGrid2DToPngInternal(
  grid: number[][],
  options: Arc3GridImageOptions = {}
): Promise<Arc3GridImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { cellSize, margin, background } = opts;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (!rows || !cols) {
    throw new Error('Cannot render empty grid');
  }

  const width = cols * cellSize + margin * 2;
  const height = rows * cellSize + margin * 2;

  // Create base image with background
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: background[0], g: background[1], b: background[2] },
    },
  });

  // Build cell overlays
  const overlays: sharp.OverlayOptions[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const value = grid[y][x] ?? 0;
      const [r, g, b] = getArc3ColorTuple(value);

      const cellPng = await sharp({
        create: {
          width: cellSize,
          height: cellSize,
          channels: 3,
          background: { r, g, b },
        },
      })
        .png()
        .toBuffer();

      overlays.push({
        input: cellPng,
        top: margin + y * cellSize,
        left: margin + x * cellSize,
      });
    }
  }

  const composite = await base.composite(overlays).png().toBuffer();
  const base64 = composite.toString('base64');

  return {
    dataUrl: `data:image/png;base64,${base64}`,
    width,
    height,
  };
}

/**
 * Render a 2D Arc3 grid to PNG with error handling.
 * Returns null on failure instead of throwing.
 */
export async function renderArc3Grid2DToPng(
  grid: number[][],
  options?: Arc3GridImageOptions
): Promise<Arc3GridImageResult | null> {
  try {
    return await renderGrid2DToPngInternal(grid, options);
  } catch (error) {
    logger.error(
      `[arc3GridImageService] Failed to render 2D grid: ${error instanceof Error ? error.message : String(error)}`,
      'arc3'
    );
    return null;
  }
}

/**
 * Render a 3D Arc3 grid (with timesteps) to PNG.
 * By default renders the last timestep (most recent frame state).
 * @param grid 3D array [timestep][row][col] of color indices (0-15)
 * @param timestepIndex Which timestep to render (default: last)
 * @param options Rendering options
 */
export async function renderArc3Grid3DToPng(
  grid: number[][][],
  timestepIndex?: number,
  options?: Arc3GridImageOptions
): Promise<Arc3GridImageResult | null> {
  if (!grid.length) {
    logger.warn('[arc3GridImageService] Empty 3D grid provided', 'arc3');
    return null;
  }

  // Default to last timestep (most recent state)
  const idx = timestepIndex ?? grid.length - 1;
  const frame2D = grid[idx];

  if (!frame2D) {
    logger.warn(`[arc3GridImageService] Timestep ${idx} not found in grid with ${grid.length} timesteps`, 'arc3');
    return null;
  }

  return renderArc3Grid2DToPng(frame2D, options);
}

/**
 * Convenience function to render the current frame from FrameData.
 * Extracts the 2D grid from the 3D frame array and renders it.
 */
export async function renderArc3FrameToPng(
  frame: number[][][],
  options?: Arc3GridImageOptions
): Promise<Arc3GridImageResult | null> {
  return renderArc3Grid3DToPng(frame, undefined, options);
}

/**
 * Render multiple timesteps as a horizontal strip (useful for showing progression).
 * @param grid 3D array [timestep][row][col]
 * @param maxTimesteps Maximum number of timesteps to include
 * @param options Rendering options
 */
export async function renderArc3TimelineToPng(
  grid: number[][][],
  maxTimesteps: number = 5,
  options?: Arc3GridImageOptions
): Promise<Arc3GridImageResult | null> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { cellSize, margin, background } = opts;

    const timestepCount = Math.min(grid.length, maxTimesteps);
    if (timestepCount === 0) {
      return null;
    }

    // Get dimensions from first frame
    const rows = grid[0].length;
    const cols = grid[0][0]?.length ?? 0;
    if (!rows || !cols) {
      return null;
    }

    const gap = 4; // Gap between timestep frames
    const frameWidth = cols * cellSize;
    const frameHeight = rows * cellSize;
    const totalWidth = timestepCount * frameWidth + (timestepCount - 1) * gap + margin * 2;
    const totalHeight = frameHeight + margin * 2;

    // Create base image
    const base = sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 3,
        background: { r: background[0], g: background[1], b: background[2] },
      },
    });

    const overlays: sharp.OverlayOptions[] = [];

    // Render each timestep
    for (let t = 0; t < timestepCount; t++) {
      const frame2D = grid[t];
      const offsetX = margin + t * (frameWidth + gap);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const value = frame2D[y]?.[x] ?? 0;
          const [r, g, b] = getArc3ColorTuple(value);

          const cellPng = await sharp({
            create: {
              width: cellSize,
              height: cellSize,
              channels: 3,
              background: { r, g, b },
            },
          })
            .png()
            .toBuffer();

          overlays.push({
            input: cellPng,
            top: margin + y * cellSize,
            left: offsetX + x * cellSize,
          });
        }
      }
    }

    const composite = await base.composite(overlays).png().toBuffer();
    const base64 = composite.toString('base64');

    return {
      dataUrl: `data:image/png;base64,${base64}`,
      width: totalWidth,
      height: totalHeight,
    };
  } catch (error) {
    logger.error(
      `[arc3GridImageService] Failed to render timeline: ${error instanceof Error ? error.message : String(error)}`,
      'arc3'
    );
    return null;
  }
}
