/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Worm Arena header shared by all Worm Arena pages.
 *          Single compact mode: Single-row inline layout with title, subtitle, and nav buttons.
 *          Uses pill-style navigation buttons as clear affordances.
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
}

export default function WormArenaHeader({
  matchupLabel,
  totalGames = 0,
  actionSlot,
  links = [],
  showMatchupLabel = true,
  subtitle,
}: WormArenaHeaderProps) {
  const resolvedSubtitle = subtitle ?? (totalGames > 0 ? `${totalGames} matches played` : 'Start a match');

  return (
    <header className="worm-header" style={{ minHeight: 'auto' }}>
      <div className="absolute inset-0 opacity-10 pointer-events-none worm-header-pattern" />

      <div className="relative px-4 py-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Title + subtitle inline */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight font-worm worm-header-title-text">
              🐛 Worm Arena 🐛
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

