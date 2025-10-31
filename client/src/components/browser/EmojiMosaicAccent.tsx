/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-31
 * PURPOSE: Provides creative, ARC-inspired emoji mosaic accents with algorithmic
 *          pattern generation, transformations, and compositional building blocks.
 *          Patterns can be generated procedurally, reflect semantic meaning, or
 *          compose from primitives. Much more interesting than static arrays!
 * SRP/DRY check: Pass — Centralizes mosaic rendering with reusable pattern generators.
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type MosaicSize = 'xs' | 'sm' | 'md';
export type MosaicOrientation = 'inline' | 'stacked';

// Color palette inspired by ARC-AGI
const COLORS = {
  black: '⬛',
  red: '🟥',
  orange: '🟧',
  yellow: '🟨',
  green: '🟩',
  blue: '🟦',
  purple: '🟪',
  white: '⬜',
  brown: '🟫',
} as const;

type ColorKey = keyof typeof COLORS;

// Pattern generator function type
type PatternGenerator = (width: number, height: number) => string[];

// ============================================================================
// ALGORITHMIC PATTERN GENERATORS
// ============================================================================

const generators = {
  // Simple checkerboard alternating two colors
  checkerboard: (a: ColorKey, b: ColorKey): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          result.push(COLORS[(x + y) % 2 === 0 ? a : b]);
        }
      }
      return result;
    },

  // Diagonal stripes
  diagonalStripes: (colors: ColorKey[]): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (x + y) % colors.length;
          result.push(COLORS[colors[idx]]);
        }
      }
      return result;
    },

  // Gradient transition between colors
  gradient: (colors: ColorKey[], direction: 'horizontal' | 'vertical' = 'horizontal'): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      const steps = direction === 'horizontal' ? w : h;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const progress = direction === 'horizontal' ? x : y;
          const idx = Math.floor((progress / steps) * colors.length);
          result.push(COLORS[colors[Math.min(idx, colors.length - 1)]]);
        }
      }
      return result;
    },

  // Border with fill (ARC-style)
  border: (borderColor: ColorKey, fillColor: ColorKey): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const isBorder = x === 0 || x === w - 1 || y === 0 || y === h - 1;
          result.push(COLORS[isBorder ? borderColor : fillColor]);
        }
      }
      return result;
    },

  // Spiral from center (clockwise)
  spiral: (colors: ColorKey[]): PatternGenerator =>
    (w, h) => {
      const grid = Array(h).fill(0).map(() => Array(w).fill(''));
      let x = 0, y = 0, dx = 1, dy = 0;
      let colorIdx = 0;

      for (let i = 0; i < w * h; i++) {
        grid[y][x] = COLORS[colors[colorIdx % colors.length]];
        colorIdx++;

        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= w || ny < 0 || ny >= h || grid[ny][nx] !== '') {
          // Turn right
          [dx, dy] = [-dy, dx];
        }

        x += dx;
        y += dy;
      }

      return grid.flat();
    },

  // Symmetrical pattern (vertical mirror)
  symmetricVertical: (colors: ColorKey[]): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      const halfW = Math.ceil(w / 2);

      for (let y = 0; y < h; y++) {
        const row: string[] = [];
        for (let x = 0; x < halfW; x++) {
          const idx = (x + y * halfW) % colors.length;
          row.push(COLORS[colors[idx]]);
        }
        // Mirror the row
        const mirrored = [...row].reverse().slice(w % 2 === 1 ? 1 : 0);
        result.push(...row, ...mirrored);
      }

      return result;
    },

  // Corner accents with center
  cornerAccent: (cornerColor: ColorKey, centerColor: ColorKey, fillColor: ColorKey): PatternGenerator =>
    (w, h) => {
      const result: string[] = [];
      const midX = Math.floor(w / 2);
      const midY = Math.floor(h / 2);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const isCorner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
          const isCenter = x === midX && y === midY;

          if (isCorner) result.push(COLORS[cornerColor]);
          else if (isCenter) result.push(COLORS[centerColor]);
          else result.push(COLORS[fillColor]);
        }
      }

      return result;
    },

  // Random but balanced (each color appears roughly equally)
  balanced: (colors: ColorKey[], seed: number = 0): PatternGenerator =>
    (w, h) => {
      const total = w * h;

      // Create balanced pool
      const pool: string[] = [];
      colors.forEach(color => {
        const count = Math.floor(total / colors.length);
        for (let i = 0; i < count; i++) pool.push(COLORS[color]);
      });

      // Fill remaining slots
      while (pool.length < total) {
        pool.push(COLORS[colors[seed % colors.length]]);
        seed++;
      }

      // Shuffle with seeded random
      let currentSeed = seed;
      const seededRandom = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
      };

      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      return pool;
    },
};

// ============================================================================
// PRESET PATTERNS WITH SEMANTIC MEANING
// ============================================================================

export const MOSAIC_PATTERNS = {
  // Status indicators
  success: generators.border('green', 'blue'),
  warning: generators.gradient(['orange', 'yellow', 'red'], 'horizontal'),
  error: generators.balanced(['red', 'orange', 'black'], 42),

  // Difficulty levels (increasing complexity)
  difficultyEasy: generators.checkerboard('green', 'blue'),
  difficultyMedium: generators.diagonalStripes(['yellow', 'orange', 'green']),
  difficultyHard: generators.spiral(['red', 'orange', 'purple', 'black']),

  // Dataset types
  training: generators.symmetricVertical(['blue', 'green', 'purple']),
  evaluation: generators.cornerAccent('purple', 'yellow', 'blue'),
  test: generators.border('red', 'black'),

  // Visual themes
  rainbow: generators.gradient(['red', 'orange', 'yellow', 'green', 'blue', 'purple'], 'horizontal'),
  sunset: generators.gradient(['purple', 'red', 'orange', 'yellow'], 'vertical'),
  ocean: generators.spiral(['blue', 'purple', 'blue']),
  forest: generators.balanced(['green', 'green', 'blue', 'brown'], 123),

  // ARC-inspired
  transformation: generators.symmetricVertical(['red', 'blue', 'yellow']),
  pattern: generators.checkerboard('purple', 'yellow'),
  logic: generators.cornerAccent('red', 'yellow', 'blue'),

  // UI states
  active: generators.border('blue', 'green'),
  inactive: generators.checkerboard('white', 'black'),
  hover: generators.gradient(['yellow', 'orange'], 'horizontal'),
} as const;

export type MosaicPattern = keyof typeof MOSAIC_PATTERNS;

// ============================================================================
// COMPONENT
// ============================================================================

export type EmojiMosaicAccentProps = {
  pattern?: MosaicPattern;
  customGenerator?: PatternGenerator;
  customCells?: string[];
  width?: number;
  height?: number;
  size?: MosaicSize;
  framed?: boolean;
  className?: string;
  orientation?: MosaicOrientation;
};

const SIZE_CLASSES: Record<MosaicSize, string> = {
  xs: 'text-[8px] leading-[0.55rem]',
  sm: 'text-[10px] leading-[0.7rem]',
  md: 'text-xs leading-tight',
};

const GRID_COLUMN_CLASSES: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
  7: 'grid-cols-7', 8: 'grid-cols-8', 9: 'grid-cols-9',
  10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12',
};

export const EmojiMosaicAccent: React.FC<EmojiMosaicAccentProps> = ({
  pattern = 'rainbow',
  customGenerator,
  customCells,
  width = 3,
  height = 3,
  size = 'sm',
  framed = true,
  className,
  orientation = 'inline',
}) => {
  const cells = useMemo(() => {
    if (customCells) return customCells;
    if (customGenerator) return customGenerator(width, height);
    return MOSAIC_PATTERNS[pattern](width, height);
  }, [pattern, customGenerator, customCells, width, height]);

  const gridColsClass = GRID_COLUMN_CLASSES[width] ?? 'grid-cols-3';
  const wrapperClass = orientation === 'stacked'
    ? 'flex flex-col items-center justify-center'
    : 'inline-flex items-center justify-center';

  return (
    <div className={cn(wrapperClass, className)} aria-hidden="true">
      <div
        className={cn(
          'grid gap-[1px]',
          gridColsClass,
          SIZE_CLASSES[size],
          framed && 'rounded-sm bg-white/70 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-[1px]'
        )}
      >
        {cells.map((cell, index) => (
          <span key={`${cell}-${index}`} className="select-none">
            {cell}
          </span>
        ))}
      </div>
    </div>
  );
};

// Export generators for custom use
export { generators, COLORS };
export type { ColorKey, PatternGenerator };
export default EmojiMosaicAccent;
