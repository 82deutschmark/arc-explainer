/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Generic WormArena header with creative worm emoji arrangements and farm aesthetic.
 *          Displays title, game stats, and optional action slot (for Start Match or other actions).
 *          Reusable across both replay and live pages.
 * SRP/DRY check: Pass — single responsibility for header presentation only.
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
  return (
    <header className="worm-header">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none worm-header-pattern" />

      <div className="relative px-6 py-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Creative Worm Title */}
          <div className="flex-1 flex flex-col gap-1.5">
            {/* Main Title with Worm Emojis */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[18px]">🐛</span>
              <h1 className="worm-header-title">
                Worm Arena
              </h1>
              <span className="text-[18px] worm-float">🐛</span>
            </div>

            {links.length > 0 && (
              <nav className="flex items-center gap-3 flex-wrap text-sm font-semibold">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'transition-colors px-1 pb-1 border-b-2 border-transparent',
                      link.active
                        ? 'worm-header-link-active'
                        : 'worm-header-link hover:text-worm-header-ink'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* Subtitle with stats and decorative worms */}
            <div className="flex items-center gap-2 text-xs worm-header-subtitle">
              <span>🌱</span>
              <span className="font-medium font-worm">
                {subtitle ?? (totalGames > 0 ? `${totalGames} matches played` : 'Launch your first battle')}
              </span>
              <span>🍎</span>
            </div>
          </div>

          {/* Right: Action Area (optional slot) */}
          {actionSlot && <div className="flex items-center gap-4">{actionSlot}</div>}
        </div>

        {/* Matchup Label intentionally hidden unless explicitly requested */}
        {matchupLabel && showMatchupLabel && (
          <div className="mt-1 text-center text-xs font-medium worm-header-subtitle">
            <span className="text-worm-header-ink">{matchupLabel}</span>
          </div>
        )}
      </div>
    </header>
  );
}
