/*
Author: GPT-5 Codex
Date: 2026-02-06T00:00:00Z
PURPOSE: ARC3-only pixel UI primitives for ARC3 community pages (landing + upload). Provides
         palette-locked theme tokens and reusable components (panels, buttons, strips, cards)
         while allowing optional per-page CSS variable overrides for bright or dark directions.
SRP/DRY check: Pass - centralizes ARC3 palette logic and avoids duplicated page styling.
*/

import React from 'react';
import { ARC3_COLORS, getContrastColor } from '@/utils/arc3Colors';
import { cn } from '@/lib/utils';

type Arc3CssVars = React.CSSProperties & Record<string, string>;

export type Arc3Tone =
  | 'neutral'
  | 'green'
  | 'blue'
  | 'pink'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'danger';

const TONE_BG_INDEX: Record<Arc3Tone, number> = {
  neutral: 3,
  green: 14,
  blue: 9,
  pink: 6,
  yellow: 11,
  orange: 12,
  purple: 15,
  danger: 8,
};

function arc3Color(index: number): string {
  return ARC3_COLORS[index] ?? ARC3_COLORS[2];
}

export function buildArc3StudioVars(): Arc3CssVars {
  // Expose the full palette as CSS variables, and define a small set of semantic tokens.
  // Pages should not use Tailwind color utilities; they should rely on these variables instead.
  const vars: Arc3CssVars = {
    '--arc3-c0': arc3Color(0),
    '--arc3-c1': arc3Color(1),
    '--arc3-c2': arc3Color(2),
    '--arc3-c3': arc3Color(3),
    '--arc3-c4': arc3Color(4),
    '--arc3-c5': arc3Color(5),
    '--arc3-c6': arc3Color(6),
    '--arc3-c7': arc3Color(7),
    '--arc3-c8': arc3Color(8),
    '--arc3-c9': arc3Color(9),
    '--arc3-c10': arc3Color(10),
    '--arc3-c11': arc3Color(11),
    '--arc3-c12': arc3Color(12),
    '--arc3-c13': arc3Color(13),
    '--arc3-c14': arc3Color(14),
    '--arc3-c15': arc3Color(15),
    // Semantic tokens (all derived from palette above)
    '--arc3-bg': arc3Color(5),
    '--arc3-bg-soft': arc3Color(4),
    '--arc3-panel': arc3Color(4),
    '--arc3-panel-soft': arc3Color(3),
    '--arc3-border': arc3Color(3),
    '--arc3-text': arc3Color(0),
    '--arc3-muted': arc3Color(1),
    '--arc3-dim': arc3Color(2),
    '--arc3-focus': arc3Color(11),
  };

  return vars;
}

export function Arc3PixelPage(props: {
  children: React.ReactNode;
  className?: string;
  vars?: Record<string, string>;
}) {
  const mergedVars: Arc3CssVars = {
    ...buildArc3StudioVars(),
    ...(props.vars ?? {}),
  };

  return (
    <div
      className={cn(
        'min-h-screen font-mono',
        'bg-[var(--arc3-bg)] text-[var(--arc3-text)]',
        props.className,
      )}
      style={mergedVars}
    >
      {props.children}
    </div>
  );
}

export function PixelPanel(props: {
  children: React.ReactNode;
  className?: string;
  tone?: Arc3Tone;
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  const tone = props.tone ?? 'neutral';
  const headerBg = arc3Color(TONE_BG_INDEX[tone]);
  const headerFg = getContrastColor(headerBg);
  return (
    <section
      className={cn(
        'border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)]',
        'shadow-[4px_4px_0_var(--arc3-c3)]',
        props.className,
      )}
    >
      {(props.title || props.subtitle || props.rightSlot) && (
        <div
          className="px-3 py-2 border-b-2 border-[var(--arc3-border)] flex items-start justify-between gap-3"
          style={{ backgroundColor: headerBg, color: headerFg }}
        >
          <div className="min-w-0">
            {props.title && <h2 className="text-sm font-semibold leading-tight">{props.title}</h2>}
            {props.subtitle && (
              <p className="text-[11px] leading-snug opacity-90 mt-0.5">{props.subtitle}</p>
            )}
          </div>
          {props.rightSlot && <div className="shrink-0">{props.rightSlot}</div>}
        </div>
      )}
      <div className="p-3">{props.children}</div>
    </section>
  );
}

export function PixelButton(props: {
  children: React.ReactNode;
  className?: string;
  tone?: Arc3Tone;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const tone = props.tone ?? 'green';
  const bg = arc3Color(TONE_BG_INDEX[tone]);
  const fg = getContrastColor(bg);
  const disabled = Boolean(props.disabled);

  // Keep hover/active within the palette: shift "tone" to a nearby palette color.
  const hoverBg =
    tone === 'green'
      ? arc3Color(10)
      : tone === 'blue'
        ? arc3Color(15)
        : tone === 'purple'
          ? arc3Color(9)
          : tone === 'yellow'
            ? arc3Color(12)
            : tone === 'pink'
              ? arc3Color(7)
              : tone === 'orange'
                ? arc3Color(11)
                : tone === 'danger'
                  ? arc3Color(13)
                  : arc3Color(2);

  const hoverFg = getContrastColor(hoverBg);

  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={disabled}
      title={props.title}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'px-3 py-2 text-xs font-semibold tracking-tight',
        'border-2 border-[var(--arc3-border)]',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--arc3-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--arc3-bg)]',
        'transition-[transform] active:translate-x-[1px] active:translate-y-[1px]',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        props.className,
      )}
      style={{
        backgroundColor: bg,
        color: fg,
        // CSS vars allow :hover without leaving the ARC3 palette.
        ['--arc3-btn-bg' as string]: bg,
        ['--arc3-btn-fg' as string]: fg,
        ['--arc3-btn-hover-bg' as string]: hoverBg,
        ['--arc3-btn-hover-fg' as string]: hoverFg,
      }}
      // Tailwind arbitrary values using vars (still palette-locked).
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget.style as any).backgroundColor = 'var(--arc3-btn-hover-bg)';
        (e.currentTarget.style as any).color = 'var(--arc3-btn-hover-fg)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        (e.currentTarget.style as any).backgroundColor = 'var(--arc3-btn-bg)';
        (e.currentTarget.style as any).color = 'var(--arc3-btn-fg)';
      }}
    >
      {props.children}
    </button>
  );
}

export function PixelLink(props: {
  href: string;
  children: React.ReactNode;
  className?: string;
  tone?: Arc3Tone;
  title?: string;
}) {
  const tone = props.tone ?? 'green';
  const bg = arc3Color(TONE_BG_INDEX[tone]);
  const fg = getContrastColor(bg);
  const hoverBg =
    tone === 'green'
      ? arc3Color(10)
      : tone === 'blue'
        ? arc3Color(15)
        : tone === 'purple'
          ? arc3Color(9)
          : tone === 'yellow'
            ? arc3Color(12)
            : tone === 'pink'
              ? arc3Color(7)
              : tone === 'orange'
                ? arc3Color(11)
                : tone === 'danger'
                  ? arc3Color(13)
                  : arc3Color(2);
  const hoverFg = getContrastColor(hoverBg);

  return (
    <a
      href={props.href}
      title={props.title}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'px-3 py-2 text-xs font-semibold tracking-tight',
        'border-2 border-[var(--arc3-border)]',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--arc3-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--arc3-bg)]',
        'transition-[transform] active:translate-x-[1px] active:translate-y-[1px]',
        'cursor-pointer',
        props.className,
      )}
      style={{
        backgroundColor: bg,
        color: fg,
        ['--arc3-btn-bg' as string]: bg,
        ['--arc3-btn-fg' as string]: fg,
        ['--arc3-btn-hover-bg' as string]: hoverBg,
        ['--arc3-btn-hover-fg' as string]: hoverFg,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget.style as any).backgroundColor = 'var(--arc3-btn-hover-bg)';
        (e.currentTarget.style as any).color = 'var(--arc3-btn-hover-fg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget.style as any).backgroundColor = 'var(--arc3-btn-bg)';
        (e.currentTarget.style as any).color = 'var(--arc3-btn-fg)';
      }}
    >
      {props.children}
    </a>
  );
}

/**
 * Decorative horizontal strip displaying all 16 ARC3 palette colors.
 * Used as visual identity / section divider on ARC3 pages.
 */
export function PaletteStrip(props: { className?: string; cellHeight?: number }) {
  const h = props.cellHeight ?? 6;
  return (
    <div
      className={cn('w-full flex', props.className)}
      aria-hidden="true"
      style={{ height: `${h}px` }}
    >
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: arc3Color(i) }} />
      ))}
    </div>
  );
}

/**
 * A single game card with a colored left accent bar derived from the game index.
 * Designed for the landing page game grid.
 */
export function GameCard(props: {
  children: React.ReactNode;
  className?: string;
  accentIndex?: number;
  onClick?: () => void;
}) {
  const accent = arc3Color(props.accentIndex ?? 9);
  return (
    <div
      className={cn(
        'border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)]',
        'shadow-[3px_3px_0_var(--arc3-c3)]',
        'hover:shadow-[5px_5px_0_var(--arc3-c3)] transition-shadow',
        'flex overflow-hidden',
        props.onClick && 'cursor-pointer',
        props.className,
      )}
      onClick={props.onClick}
    >
      {/* Colored left accent bar */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} />
      <div className="flex-1 min-w-0">{props.children}</div>
    </div>
  );
}

function mulberry32(seed: number) {
  return function () {
    // Deterministic tiny PRNG for "sprite sheet" mosaics.
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function SpriteMosaic(props: {
  seed: number;
  width: number;
  height: number;
  className?: string;
}) {
  const rand = mulberry32(props.seed);
  const palette = [6, 7, 8, 9, 10, 11, 12, 14, 15, 2, 3];
  const pixels = Array.from({ length: props.width * props.height }, () => {
    const pick = palette[Math.floor(rand() * palette.length)] ?? 2;
    return arc3Color(pick);
  });

  return (
    <div
      className={cn(
        'border-2 border-[var(--arc3-border)] bg-[var(--arc3-c5)]',
        'shadow-[4px_4px_0_var(--arc3-c3)]',
        props.className,
      )}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${props.width}, minmax(0, 1fr))`,
        gap: '1px',
      }}
      aria-hidden="true"
    >
      {pixels.map((color, idx) => (
        <div key={idx} style={{ backgroundColor: color, aspectRatio: '1 / 1' }} />
      ))}
    </div>
  );
}

