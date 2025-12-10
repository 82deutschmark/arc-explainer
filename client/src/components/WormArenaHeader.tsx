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
}

export default function WormArenaHeader({
  matchupLabel,
  totalGames = 0,
  actionSlot,
  links = [],
  showMatchupLabel = true,
}: WormArenaHeaderProps) {
  return (
    <header
      className="relative overflow-hidden"
      style={{ backgroundColor: '#2d1f0f', borderBottom: '3px solid #d4a574', minHeight: '64px' }}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(212, 165, 116, 0.1) 0%, transparent 50%),
                          radial-gradient(circle at 80% 80%, rgba(139, 90, 43, 0.1) 0%, transparent 50%)`,
      }} />

      <div className="relative px-6 py-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Creative Worm Title */}
          <div className="flex-1 flex flex-col gap-1.5">
            {/* Main Title with Worm Emojis */}
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: '18px' }}>🐛</span>
              <h1
                className="text-2xl font-bold tracking-tight leading-tight"
                style={{
                  color: '#f5e6d3',
                  fontFamily: '"Fredoka Expanded", "Fredoka", sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Worm Arena
              </h1>
              <span style={{ fontSize: '18px', animation: 'float 3s ease-in-out infinite' }}>🐛</span>
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
                        ? 'text-[#f5e6d3] border-[#f5e6d3]'
                        : 'text-[#c79b6d] hover:text-[#f5e6d3]'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* Subtitle with stats and decorative worms */}
            <div className="flex items-center gap-2 text-xs" style={{ color: '#d4a574' }}>
              <span>🌱</span>
              <span style={{ fontFamily: '"Fredoka", sans-serif', fontWeight: 500 }}>
                {totalGames > 0 ? `${totalGames} matches played` : 'Launch your first battle'}
              </span>
              <span>🍎</span>
            </div>
          </div>

          {/* Right: Action Area (optional slot) */}
          {actionSlot && <div className="flex items-center gap-4">{actionSlot}</div>}
        </div>

        {/* Matchup Label intentionally hidden unless explicitly requested */}
        {matchupLabel && showMatchupLabel && (
          <div className="mt-1 text-center text-xs font-medium" style={{ color: '#d4a574' }}>
            <span style={{ color: '#f5e6d3' }}>{matchupLabel}</span>
          </div>
        )}
      </div>

      {/* Animated worm wandering effect - CSS only */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        @keyframes crawl {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100vw); }
        }
      `}</style>
    </header>
  );
}
