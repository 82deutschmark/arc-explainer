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
  columns?: 2 | 3;
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

export const EmojiMosaicAccent: React.FC<EmojiMosaicAccentProps> = ({
  variant = 'rainbow',
  pattern,
  columns,
  size = 'sm',
  framed = true,
  className,
  orientation = 'inline',
}) => {
  const cells = pattern ?? MOSAIC_PRESETS[variant] ?? MOSAIC_PRESETS.rainbow;
  const inferredColumns = columns ?? (cells.length === 4 ? 2 : 3);
  const gridColsClass = inferredColumns === 2 ? 'grid-cols-2' : 'grid-cols-3';
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

export default EmojiMosaicAccent;
