/**
 * Author: gpt-5-codex
 * Date: 2025-10-17
 * PURPOSE: Provides reusable ARC-inspired emoji mosaic accents with configurable
 *          variants, sizing, and framing to highlight interactive UI elements.
 * SRP/DRY check: Pass — Centralizes emoji mosaic rendering for consistent styling.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export type MosaicVariant =
  | 'rainbow'
  | 'heroSunrise'
  | 'heroTwilight'
  | 'searchSignal'
  | 'sizeSignal'
  | 'datasetSignal'
  | 'analysisSignal'
  | 'statusExplained'
  | 'statusUnexplained'
  | 'chipInactive';

export type MosaicSize = 'xs' | 'sm' | 'md';

export type EmojiMosaicAccentProps = {
  variant?: MosaicVariant;
  pattern?: string[];
  columns?: number;
  maxColumns?: number;
  size?: MosaicSize;
  framed?: boolean;
  className?: string;
  orientation?: 'inline' | 'stacked';
};

const MOSAIC_PRESETS: Record<MosaicVariant, string[]> = {
  rainbow: ['🟥', '🟧', '🟨', '🟩', '⬛', '🟦', '🟪', '🟧', '🟥'],
  heroSunrise: ['🟥', '🟧', '🟨', '🟪', '⬛', '🟩', '🟦', '🟧', '🟥'],
  heroTwilight: ['🟪', '🟦', '🟪', '🟦', '⬛', '🟦', '🟪', '🟦', '🟪'],
  searchSignal: ['🟥', '🟧', '🟨', '🟥'],
  sizeSignal: ['🟧', '🟨', '🟩', '🟦'],
  datasetSignal: ['🟦', '🟩', '🟪', '🟧', '⬛', '🟨'],
  analysisSignal: ['🟨', '🟧', '🟪', '🟧'],
  statusExplained: ['🟩', '🟦', '🟪', '🟦', '⬛', '🟦', '🟩', '🟦', '🟪'],
  statusUnexplained: ['🟥', '🟧', '🟨', '🟧', '⬛', '🟨', '🟥', '🟧', '🟨'],
  chipInactive: ['⬜', '⬛', '⬜', '⬛'],
};

const SIZE_CLASSES: Record<MosaicSize, string> = {
  xs: 'text-[8px] leading-[0.55rem]',
  sm: 'text-[10px] leading-[0.7rem]',
  md: 'text-xs leading-tight',
};

const LONG_PATTERN_SIZE_OVERRIDES: Record<MosaicSize, string> = {
  xs: 'text-[6px] leading-[0.4rem] sm:text-[7px] sm:leading-[0.45rem] md:text-[8px] md:leading-[0.5rem]',
  sm: 'text-[7px] leading-[0.45rem] sm:text-[8px] sm:leading-[0.5rem] md:text-[10px] md:leading-[0.6rem]',
  md: 'text-[9px] leading-[0.6rem] sm:text-[10px] sm:leading-[0.65rem] md:text-[11px] md:leading-[0.7rem]',
};

const MAX_SUPPORTED_COLUMNS = 12;

const GRID_COLUMN_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

export const EmojiMosaicAccent: React.FC<EmojiMosaicAccentProps> = ({
  variant = 'rainbow',
  pattern,
  columns,
  maxColumns = 10,
  size = 'sm',
  framed = true,
  className,
  orientation = 'inline',
}) => {
  const cells = pattern ?? MOSAIC_PRESETS[variant] ?? MOSAIC_PRESETS.rainbow;

  const sanitizedMaxColumns = Math.min(
    Math.max(1, Math.round(maxColumns)),
    MAX_SUPPORTED_COLUMNS
  );

  const defaultColumns = cells.length <= 4 ? 2 : Math.min(3, sanitizedMaxColumns);
  const requestedColumns = columns ? Math.round(columns) : defaultColumns;
  const constrainedColumns = Math.min(
    Math.max(1, requestedColumns),
    sanitizedMaxColumns
  );
  const gridColsClass = GRID_COLUMN_CLASSES[constrainedColumns] ?? GRID_COLUMN_CLASSES[defaultColumns] ?? 'grid-cols-3';

  const wrapperClass =
    orientation === 'stacked'
      ? 'flex flex-col items-center justify-center'
      : 'inline-flex items-center justify-center';

  const sizeClass = SIZE_CLASSES[size];
  const isLongPattern = constrainedColumns >= 6;
  const sizeOverride = isLongPattern ? LONG_PATTERN_SIZE_OVERRIDES[size] : '';

  return (
    <div className={cn(wrapperClass, className)} aria-hidden="true">
      <div
        className={cn(
          'grid gap-[1px]',
          gridColsClass,
          sizeClass,
          sizeOverride,
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

export default EmojiMosaicAccent;
