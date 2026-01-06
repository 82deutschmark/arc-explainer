/**
 * Author: Sonnet 4
 * Date: 2026-01-05
 * PURPOSE: OG (Open Graph) image generation service for social media link unfurling.
 *          Generates optimized 1200x630px PNG images showing ARC puzzle training examples.
 *          Uses LRU caching to avoid regenerating images for frequently shared puzzles.
 * SRP/DRY check: Pass - Focuses solely on OG image generation, reuses gridImageService patterns.
 */

import sharp from 'sharp';
import { ARC_COLORS_TUPLES } from '@shared/config/colors';
import type { ARCTask, ARCExample } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface OgImageOptions {
  width?: number;        // Default 1200
  height?: number;       // Default 630
  exampleCount?: number; // How many training examples (default 2)
}

interface CacheEntry {
  buffer: Buffer;
  timestamp: number;
  accessTime: number;
}

// ============================================================================
// Constants
// ============================================================================

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const PADDING = 40;
const EXAMPLE_GAP = 30;
const INPUT_OUTPUT_GAP = 20;
const MIN_CELL_SIZE = 8;
const MAX_CELL_SIZE = 24;
const BACKGROUND_COLOR = { r: 26, g: 26, b: 46 }; // #1a1a2e
const ARROW_COLOR = { r: 255, g: 255, b: 255, alpha: 0.7 };

// LRU Cache settings
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Cache Implementation (LRU with TTL)
// ============================================================================

const imageCache = new Map<string, CacheEntry>();

function getCacheKey(taskId: string, exampleCount: number): string {
  return `og-image:${taskId}:${exampleCount}`;
}

function getFromCache(key: string): Buffer | null {
  const entry = imageCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }

  // Update access time for LRU
  entry.accessTime = now;
  return entry.buffer;
}

function setInCache(key: string, buffer: Buffer): void {
  const now = Date.now();

  // Evict oldest entries if cache is full
  if (imageCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, v] of imageCache.entries()) {
      if (v.accessTime < oldestTime) {
        oldestTime = v.accessTime;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      imageCache.delete(oldestKey);
    }
  }

  imageCache.set(key, {
    buffer,
    timestamp: now,
    accessTime: now,
  });
}

// ============================================================================
// Color Helpers
// ============================================================================

function getColorTuple(value: number): [number, number, number] {
  const tuple = ARC_COLORS_TUPLES[value];
  if (!tuple) {
    return [255, 255, 255];
  }
  return [tuple[0], tuple[1], tuple[2]];
}

// ============================================================================
// Grid Rendering Helpers
// ============================================================================

interface GridDimensions {
  rows: number;
  cols: number;
}

function getGridDimensions(grid: number[][]): GridDimensions {
  return {
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
  };
}

function calculateCellSize(
  examples: ARCExample[],
  availableWidth: number,
  availableHeight: number,
  exampleCount: number
): number {
  // Calculate the max grid dimensions we need to fit
  let maxInputCols = 0;
  let maxInputRows = 0;
  let maxOutputCols = 0;
  let maxOutputRows = 0;

  for (let i = 0; i < Math.min(examples.length, exampleCount); i++) {
    const example = examples[i];
    const inputDims = getGridDimensions(example.input);
    const outputDims = getGridDimensions(example.output);

    maxInputCols = Math.max(maxInputCols, inputDims.cols);
    maxInputRows = Math.max(maxInputRows, inputDims.rows);
    maxOutputCols = Math.max(maxOutputCols, outputDims.cols);
    maxOutputRows = Math.max(maxOutputRows, outputDims.rows);
  }

  // Width needed: input + gap + arrow + gap + output
  const totalCols = maxInputCols + maxOutputCols;
  const arrowWidth = 40; // Space for arrow between grids
  const widthPerExample = availableWidth;
  const maxCellWidth = Math.floor((widthPerExample - arrowWidth - INPUT_OUTPUT_GAP * 2) / totalCols);

  // Height needed: examples stacked with gaps
  const maxRows = Math.max(maxInputRows, maxOutputRows);
  const heightPerExample = Math.floor((availableHeight - EXAMPLE_GAP * (exampleCount - 1)) / exampleCount);
  const maxCellHeight = Math.floor(heightPerExample / maxRows);

  // Use the smaller of width/height constraints, clamped to min/max
  const cellSize = Math.min(maxCellWidth, maxCellHeight);
  return Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, cellSize));
}

async function renderGridBuffer(
  grid: number[][],
  cellSize: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (!rows || !cols) {
    throw new Error('Cannot render empty grid');
  }

  const width = cols * cellSize;
  const height = rows * cellSize;

  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BACKGROUND_COLOR,
    },
  });

  const overlays: sharp.OverlayOptions[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const value = grid[y][x] ?? 0;
      const [r, g, b] = getColorTuple(value);

      // Create cell with 1px border for visual separation
      const cellPng = await sharp({
        create: {
          width: cellSize - 1,
          height: cellSize - 1,
          channels: 3,
          background: { r, g, b },
        },
      })
        .png()
        .toBuffer();

      overlays.push({
        input: cellPng,
        top: y * cellSize,
        left: x * cellSize,
      });
    }
  }

  const buffer = await base.composite(overlays).png().toBuffer();
  return { buffer, width, height };
}

async function createArrowBuffer(height: number): Promise<Buffer> {
  // Create a simple arrow SVG pointing right
  const arrowSvg = `
    <svg width="30" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon 
        points="5,${height / 2 - 10} 20,${height / 2} 5,${height / 2 + 10}" 
        fill="rgba(255,255,255,0.7)"
      />
    </svg>
  `;
  return sharp(Buffer.from(arrowSvg)).png().toBuffer();
}

// ============================================================================
// Main Export: Generate OG Image
// ============================================================================

export async function generateOgImageForTask(
  task: ARCTask,
  taskId: string,
  options: OgImageOptions = {}
): Promise<Buffer> {
  const width = options.width ?? OG_WIDTH;
  const height = options.height ?? OG_HEIGHT;
  const exampleCount = Math.min(options.exampleCount ?? 2, task.train.length, 2);

  // Check cache first
  const cacheKey = getCacheKey(taskId, exampleCount);
  const cached = getFromCache(cacheKey);
  if (cached) {
    logger.debug(`OG image cache hit for ${taskId}`, 'ogImageService');
    return cached;
  }

  logger.debug(`Generating OG image for ${taskId} with ${exampleCount} examples`, 'ogImageService');

  // Calculate available space for grids
  const availableWidth = width - PADDING * 2;
  const availableHeight = height - PADDING * 2 - 50; // Reserve space for title

  // Calculate optimal cell size
  const cellSize = calculateCellSize(task.train, availableWidth, availableHeight, exampleCount);

  // Create base canvas
  const canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...BACKGROUND_COLOR, alpha: 1 },
    },
  });

  const overlays: sharp.OverlayOptions[] = [];

  // Add title text (task ID)
  const titleSvg = `
    <svg width="${width}" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="40" fill="rgba(0,0,0,0.5)"/>
      <text x="${PADDING}" y="28" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white">
        ARC Puzzle: ${taskId}
      </text>
      <text x="${width - PADDING}" y="28" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="end">
        arc.markbarney.net
      </text>
    </svg>
  `;
  overlays.push({
    input: Buffer.from(titleSvg),
    top: 0,
    left: 0,
  });

  // Render each training example
  const startY = 50 + PADDING;
  const exampleHeight = Math.floor((availableHeight) / exampleCount);

  for (let i = 0; i < exampleCount; i++) {
    const example = task.train[i];
    const exampleY = startY + i * (exampleHeight + EXAMPLE_GAP);

    // Render input grid
    const inputResult = await renderGridBuffer(example.input, cellSize);
    const inputX = PADDING;
    const inputY = exampleY + Math.floor((exampleHeight - inputResult.height) / 2);

    overlays.push({
      input: inputResult.buffer,
      top: inputY,
      left: inputX,
    });

    // Render arrow
    const arrowX = inputX + inputResult.width + INPUT_OUTPUT_GAP;
    const arrowBuffer = await createArrowBuffer(inputResult.height);
    overlays.push({
      input: arrowBuffer,
      top: inputY,
      left: arrowX,
    });

    // Render output grid
    const outputResult = await renderGridBuffer(example.output, cellSize);
    const outputX = arrowX + 30 + INPUT_OUTPUT_GAP;
    const outputY = exampleY + Math.floor((exampleHeight - outputResult.height) / 2);

    overlays.push({
      input: outputResult.buffer,
      top: outputY,
      left: outputX,
    });

    // Add "Example N" label
    const labelSvg = `
      <svg width="100" height="20" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="14" font-family="Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">
          Example ${i + 1}
        </text>
      </svg>
    `;
    overlays.push({
      input: Buffer.from(labelSvg),
      top: exampleY - 5,
      left: PADDING,
    });
  }

  // Composite all layers and generate final PNG
  const buffer = await canvas.composite(overlays).png().toBuffer();

  // Store in cache
  setInCache(cacheKey, buffer);

  logger.info(`Generated OG image for ${taskId}: ${buffer.length} bytes`, 'ogImageService');
  return buffer;
}

// ============================================================================
// Cache Management (for testing/admin)
// ============================================================================

export function clearOgImageCache(): void {
  imageCache.clear();
  logger.info('OG image cache cleared', 'ogImageService');
}

export function getOgImageCacheStats(): { size: number; maxSize: number } {
  return {
    size: imageCache.size,
    maxSize: CACHE_MAX_SIZE,
  };
}
