/**
 * Author: GPT-5.2
 * Date: 2025-12-12
 * PURPOSE: Worm Arena header shared by replay/live pages. Renders title, nav links,
 *          optional subtitle text, optional matchup label, and an optional action slot.
 *          Intentionally avoids decorative glyphs that can render poorly on Windows.
 * SRP/DRY check: Pass — presentation only.
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
    <header className="worm-header">
      <div className="absolute inset-0 opacity-10 pointer-events-none worm-header-pattern" />

      <div className="relative px-6 py-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="worm-header-title">Worm Arena</h1>
            </div>

            {links.length > 0 && (
              <nav className="flex items-center gap-3 flex-wrap text-sm font-semibold">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'transition-colors px-1 pb-1 border-b-2 border-transparent',
                      link.active ? 'worm-header-link-active' : 'worm-header-link hover:text-worm-header-ink',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-2 text-xs worm-header-subtitle">
              <span className="font-medium font-worm">{resolvedSubtitle}</span>
            </div>
          </div>

          {actionSlot && <div className="flex items-center gap-4">{actionSlot}</div>}
        </div>

        {matchupLabel && showMatchupLabel && (
          <div className="mt-1 text-center text-xs font-medium worm-header-subtitle">
            <span className="text-worm-header-ink">{matchupLabel}</span>
          </div>
        )}
      </div>
    </header>
  );
}

