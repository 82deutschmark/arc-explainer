/*
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2026-03-27
 * PURPOSE: Vertical timeline component for the ARC-AGI-3 story page. Renders a series of
 *          dated milestones with descriptions in a clean, editorial layout. No card grids,
 *          no badges — just clear typographic hierarchy.
 * SRP/DRY check: Pass — single-purpose timeline renderer, no data fetching.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface TimelineEntry {
  /** Short date label, e.g. "July 2025" */
  date: string;
  /** Headline for this milestone */
  title: string;
  /** Prose description — can contain JSX for links */
  description: React.ReactNode;
  /** Optional: visual accent — 'past' (muted), 'highlight' (accent), 'current' (bold) */
  emphasis?: 'past' | 'highlight' | 'current';
}

interface Arc3TimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

export function Arc3Timeline({ entries, className }: Arc3TimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />

      <ol className="space-y-8">
        {entries.map((entry, idx) => {
          const isHighlight = entry.emphasis === 'highlight';
          const isCurrent = entry.emphasis === 'current';
          const isPast = entry.emphasis === 'past' || (!isHighlight && !isCurrent);

          return (
            <li key={idx} className="relative pl-10">
              {/* Dot on the timeline */}
              <div
                className={cn(
                  'absolute left-0 top-1.5 h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center',
                  isCurrent && 'border-foreground bg-foreground',
                  isHighlight && 'border-foreground bg-background',
                  isPast && 'border-muted-foreground/40 bg-background',
                )}
                aria-hidden="true"
              >
                {isCurrent && (
                  <div className="h-2 w-2 rounded-full bg-background" />
                )}
                {isHighlight && (
                  <div className="h-2 w-2 rounded-full bg-foreground" />
                )}
              </div>

              {/* Date label */}
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider mb-1',
                  isCurrent && 'text-foreground',
                  isHighlight && 'text-foreground',
                  isPast && 'text-muted-foreground',
                )}
              >
                {entry.date}
              </p>

              {/* Title */}
              <h3
                className={cn(
                  'text-lg font-bold leading-snug mb-2',
                  isCurrent && 'text-foreground',
                  isHighlight && 'text-foreground',
                  isPast && 'text-foreground/80',
                )}
              >
                {entry.title}
              </h3>

              {/* Description */}
              <div
                className={cn(
                  'text-sm leading-relaxed',
                  isCurrent && 'text-muted-foreground',
                  isHighlight && 'text-muted-foreground',
                  isPast && 'text-muted-foreground/80',
                )}
              >
                {entry.description}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
