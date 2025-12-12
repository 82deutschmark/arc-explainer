/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Isolated "Start Match" button with loading state and scroll-to-controls action.
 *          Used as actionSlot in WormArenaHeader for WormArenaLive page.
 *          Handles match initiation and UX feedback.
 * SRP/DRY check: Pass — single responsibility for match start button only.
 */

import React from 'react';

interface WormArenaHeaderStartActionProps {
  isRunning?: boolean;
  isStarting?: boolean;
  onPlayClick?: () => void;
  onScrollToControls?: () => void;
}

export default function WormArenaHeaderStartAction({
  isRunning = false,
  isStarting = false,
  onPlayClick,
  onScrollToControls,
}: WormArenaHeaderStartActionProps) {
  const isLoading = isRunning || isStarting;

  return (
    <div className="flex items-center gap-4">
      {/* Status Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-worm-orange">
          <div
            className="w-2 h-2 rounded-full worm-pulse"
            style={{ backgroundColor: 'currentColor' }}
          />
          <span className="text-xs font-medium">Match running</span>
        </div>
      )}

      {/* Primary Play Button */}
      <button
        onClick={() => {
          onPlayClick?.();
          onScrollToControls?.();
        }}
        disabled={isLoading}
        className={
          `group relative px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3 shadow-lg ` +
          (isLoading
            ? 'bg-worm-header-accent text-worm-header-bg'
            : 'bg-worm-orange text-worm-header-bg hover:bg-worm-orange-hover')
        }
        style={{ boxShadow: isLoading ? 'none' : '0 12px 24px rgba(245, 166, 35, 0.3)' }}
      >
        <span className="text-[20px]">▶</span>
        <span>{isLoading ? 'Starting...' : 'Start Match'}</span>

        {/* Decorative worm on button hover */}
        {!isLoading && (
          <span
            className="absolute -right-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-[-20px] transition-all duration-300"
            className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-[-20px] transition-all duration-300 text-[24px]"
          >
            🐛
          </span>
        )}
      </button>
    </div>
  );
}
