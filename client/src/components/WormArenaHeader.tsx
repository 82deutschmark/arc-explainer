/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Distinctive WormArena header with integrated play button,
 *          creative worm emoji arrangements, and organic farm aesthetic.
 *          Replaces generic header with memorable visual identity.
 * SRP/DRY check: Pass — single responsibility for header presentation.
 */

import React from 'react';

interface WormArenaHeaderProps {
  isRunning?: boolean;
  isStarting?: boolean;
  onPlayClick?: () => void;
  matchupLabel?: string;
  totalGames?: number;
}

export default function WormArenaHeader({
  isRunning = false,
  isStarting = false,
  onPlayClick,
  matchupLabel,
  totalGames = 0,
}: WormArenaHeaderProps) {
  const isLoading = isRunning || isStarting;

  return (
    <header className="relative overflow-hidden" style={{ backgroundColor: '#2d1f0f', borderBottom: '3px solid #d4a574' }}>
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(212, 165, 116, 0.1) 0%, transparent 50%),
                          radial-gradient(circle at 80% 80%, rgba(139, 90, 43, 0.1) 0%, transparent 50%)`,
      }} />

      <div className="relative px-8 py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Creative Worm Title */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Main Title with Worm Emojis */}
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontSize: '28px' }}>🐛</span>
              <h1
                className="text-5xl font-bold tracking-tight"
                style={{
                  color: '#f5e6d3',
                  fontFamily: '"Fredoka Expanded", "Fredoka", sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Worm Arena
              </h1>
              <span style={{ fontSize: '28px', animation: 'float 3s ease-in-out infinite' }}>🐛</span>
            </div>

            {/* Subtitle with stats and decorative worms */}
            <div className="flex items-center gap-3 text-sm" style={{ color: '#d4a574' }}>
              <span>🌱</span>
              <span style={{ fontFamily: '"Fredoka", sans-serif', fontWeight: 500 }}>
                {totalGames > 0 ? `${totalGames} matches played` : 'Launch your first battle'}
              </span>
              <span>🍎</span>
            </div>
          </div>

          {/* Right: Action Area with Play Button */}
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2" style={{ color: '#f5a623' }}>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: '#f5a623',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span className="text-xs font-medium">Match running</span>
              </div>
            )}

            {/* Primary Play Button */}
            <button
              onClick={onPlayClick}
              disabled={isLoading}
              className="group relative px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3 shadow-lg"
              style={{
                backgroundColor: isLoading ? '#d4a574' : '#f5a623',
                color: '#2d1f0f',
                boxShadow: isLoading ? 'none' : '0 12px 24px rgba(245, 166, 35, 0.3)',
              }}
            >
              <span style={{ fontSize: '20px' }}>▶</span>
              <span>{isLoading ? 'Starting...' : 'Start Match'}</span>

              {/* Decorative worm on button hover */}
              {!isLoading && (
                <span
                  className="absolute -right-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-[-20px] transition-all duration-300"
                  style={{ fontSize: '24px' }}
                >
                  🐛
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom decorative worm crawl */}
        {!matchupLabel && (
          <div className="mt-6 flex gap-2 text-xl opacity-60 animate-pulse" style={{ color: '#d4a574' }}>
            <span>🐛</span>
            <span style={{ opacity: 0.4 }}>🐛</span>
            <span style={{ opacity: 0.2 }}>🐛</span>
          </div>
        )}

        {/* Matchup Label if present */}
        {matchupLabel && (
          <div className="mt-4 text-center text-sm font-medium" style={{ color: '#d4a574' }}>
            Next: <span style={{ color: '#f5e6d3' }}>{matchupLabel}</span>
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
