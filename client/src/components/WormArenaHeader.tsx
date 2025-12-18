/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Worm Arena header shared by all Worm Arena pages. Stacked, centered layout
 *          with large typography and pill-style navigation buttons that read as clear
 *          affordances. Supports optional subtitle, matchup label, and action slot.
 * SRP/DRY check: Pass - presentation only.
 */

import React from 'react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

interface WormArenaHeaderLink {
  label: string;
  href: string;
  active?: boolean;
}

interface WormArenaHeaderProps {
  matchupLabel?: string;
  totalGames?: number;
  actionSlot?: React.ReactNode;
  links?: WormArenaHeaderLink[];
  showMatchupLabel?: boolean;
  subtitle?: string;
  /** Compact mode: smaller title, tighter spacing, inline nav */
  compact?: boolean;
}

export default function WormArenaHeader({
  matchupLabel,
  totalGames = 0,
  actionSlot,
  links = [],
  showMatchupLabel = true,
  subtitle,
  compact = false,
}: WormArenaHeaderProps) {
  const resolvedSubtitle = subtitle ?? (totalGames > 0 ? `${totalGames} matches played` : 'Start a match');

  // Compact mode: single row with title + nav inline, smaller everything
  if (compact) {
    return (
      <header className="worm-header" style={{ minHeight: 'auto' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none worm-header-pattern" />

        <div className="relative px-4 py-2 max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Title + subtitle inline */}
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight font-worm worm-header-title-text">
                Worm Arena
              </h1>
              <span className="text-sm font-medium worm-header-subtitle hidden sm:inline">
                {resolvedSubtitle}
              </span>
            </div>

            {/* Nav pills - inline, smaller */}
            {links.length > 0 && (
              <nav className="flex items-center gap-1.5 flex-wrap">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all duration-150',
                      'border shadow-sm',
                      link.active
                        ? 'worm-header-nav-active'
                        : 'worm-header-nav-inactive hover:worm-header-nav-hover',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* Optional action slot */}
            {actionSlot && <div className="flex items-center gap-2">{actionSlot}</div>}
          </div>

          {/* Optional matchup label - below in compact mode */}
          {matchupLabel && showMatchupLabel && (
            <div className="mt-1.5 text-center">
              <span className="text-xs font-semibold worm-header-subtitle">{matchupLabel}</span>
            </div>
          )}
        </div>
      </header>
    );
  }

  // Standard mode: stacked, centered, large
  return (
    <header className="worm-header">
      <div className="absolute inset-0 opacity-10 pointer-events-none worm-header-pattern" />

      <div className="relative px-4 py-4 max-w-7xl mx-auto flex flex-col items-center gap-3">
        {/* Title - large and centered */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-worm text-center worm-header-title-text">
          Worm Arena
        </h1>

        {/* Subtitle - centered below title */}
        <div className="text-base md:text-lg font-medium font-worm worm-header-subtitle text-center">
          {resolvedSubtitle}
        </div>

        {/* Nav pills - centered, with clear button-like affordances */}
        {links.length > 0 && (
          <nav className="flex items-center justify-center gap-2 flex-wrap mt-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all duration-150',
                  'border-2 shadow-sm',
                  link.active
                    ? 'worm-header-nav-active'
                    : 'worm-header-nav-inactive hover:worm-header-nav-hover',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Optional matchup label */}
        {matchupLabel && showMatchupLabel && (
          <div className="mt-2 px-4 py-1.5 rounded-lg bg-black/20 text-center">
            <span className="text-sm font-semibold worm-header-title-text">{matchupLabel}</span>
          </div>
        )}

        {/* Optional action slot */}
        {actionSlot && <div className="mt-2 flex items-center gap-4">{actionSlot}</div>}
      </div>
    </header>
  );
}

