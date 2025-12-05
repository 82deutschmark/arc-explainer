/**
 * Author: Cascade
 * Date: 2025-12-04
 * PURPOSE: Server-side helpers for rendering ARC grids (number[][]) to PNG images
 *          using the shared ARC_COLORS_TUPLES palette. Intended for use by
 *          vision-capable model payloads, but safe to call as an optional
 *          enhancement without affecting existing text-only behavior.
 * SRP/DRY check: Pass — focuses only on grid->image rendering; callers decide
 *                when and how to include these images in API payloads.
 */

import sharp from 'sharp';
import { ARC_COLORS_TUPLES } from '@shared/config/colors';
import type { ARCTask, ARCExample } from '../../shared/types.js';

export interface GridImageOptions {
  cellSize?: number;      // Pixel size of each cell edge
  margin?: number;        // Outer margin in pixels
  gap?: number;           // Gap between input and output grids in composite
  background?: [number, number, number]; // RGB background
}

export interface GridImageResult {
  dataUrl: string; // data:image/png;base64,...
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<GridImageOptions> = {
  cellSize: 16,
  margin: 4,
  gap: 8,
  background: [255, 255, 255],
};

function getColorTuple(value: number): [number, number, number] {
  const tuple = ARC_COLORS_TUPLES[value];
  if (!tuple) {
    return [255, 255, 255];
  }
  return [tuple[0], tuple[1], tuple[2]];
}

async function renderGridToPngInternal(
  grid: number[][],
  options: GridImageOptions = {}
): Promise<GridImageResult> {
  const { cellSize, margin, background } = { ...DEFAULT_OPTIONS, ...options };

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (!rows || !cols) {
    throw new Error('Cannot render empty grid');
  }

  const width = cols * cellSize + margin * 2;
  const height = rows * cellSize + margin * 2;

  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: background[0], g: background[1], b: background[2] },
    },
  });

  const overlays: sharp.OverlayOptions[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const value = grid[y][x] ?? 0;
      const [r, g, b] = getColorTuple(value);

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

export async function renderGridToPng(
  grid: number[][],
  options?: GridImageOptions
): Promise<GridImageResult | null> {
  try {
    return await renderGridToPngInternal(grid, options);
  } catch (error) {
    // Fail soft: log to console for now; callers can decide whether to log via
    // their own logger and fall back to text-only prompts.
    console.error('[gridImageService] Failed to render grid to PNG:', error);
    return null;
  }
}

export interface GridImagePayload {
  exampleIndex: number;
  variant: 'train' | 'test';
  description: string;
  dataUrl: string;
}

export async function buildTaskGridImages(
  task: ARCTask,
  options?: GridImageOptions
): Promise<GridImagePayload[]> {
  const images: GridImagePayload[] = [];

  const { train, test } = task;

  const safeOptions: GridImageOptions = {
    ...options,
  };

  for (let i = 0; i < train.length; i++) {
    const example: ARCExample = train[i];
    const rowsIn = example.input.length;
    const colsIn = example.input[0]?.length ?? 0;
    const rowsOut = example.output.length;
    const colsOut = example.output[0]?.length ?? 0;

    const description = `Training example ${i + 1}: input ${rowsIn}x${colsIn} → output ${rowsOut}x${colsOut}`;

    const combinedGrid: number[][] = [];
    const maxRows = Math.max(rowsIn, rowsOut);

    for (let r = 0; r < maxRows; r++) {
      const rowIn = example.input[r] ?? Array(colsIn).fill(0);
      const rowOut = example.output[r] ?? Array(colsOut).fill(0);
      combinedGrid.push([...rowIn, ...rowOut]);
    }

    const rendered = await renderGridToPng(combinedGrid, safeOptions);
    if (rendered) {
      images.push({
        exampleIndex: i,
        variant: 'train',
        description,
        dataUrl: rendered.dataUrl,
      });
    }
  }

  for (let i = 0; i < test.length; i++) {
    const example: ARCExample = test[i];
    const rowsIn = example.input.length;
    const colsIn = example.input[0]?.length ?? 0;
    const description = `Test input ${i + 1}: ${rowsIn}x${colsIn}`;

    const rendered = await renderGridToPng(example.input, safeOptions);
    if (rendered) {
      images.push({
        exampleIndex: i,
        variant: 'test',
        description,
        dataUrl: rendered.dataUrl,
      });
    }
  }

  return images;
}
