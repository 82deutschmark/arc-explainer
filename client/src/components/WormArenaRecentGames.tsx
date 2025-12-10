/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Isolated Recent Games selection component. Displays list of recent game matches
 *          with ability to select and replay them. Extracted from WormArena to reduce
 *          main page bloat and improve modularity.
 * SRP/DRY check: Pass — single responsibility for recent games display and selection.
 */

import React from 'react';

interface GameSummary {
  gameId: string;
  totalScore?: number;
  roundsPlayed?: number;
}

interface WormArenaRecentGamesProps {
  games: GameSummary[];
  selectedGameId: string;
  isLoading: boolean;
  onSelectGame: (gameId: string) => void;
}

export default function WormArenaRecentGames({
  games,
  selectedGameId,
  isLoading,
  onSelectGame,
}: WormArenaRecentGamesProps) {
  return (
    <div className="mb-4">
      <h4 className="font-medium mb-2 text-sm" style={{ color: '#3d2817' }}>
        Recent Games
      </h4>
      <div className="border rounded bg-white/80 max-h-32 overflow-y-auto text-xs">
        {isLoading && (
          <div className="p-2" style={{ color: '#7a6b5f' }}>
            Loading games...
          </div>
        )}
        {!isLoading && games.length === 0 && (
          <div className="p-2" style={{ color: '#7a6b5f' }}>
            No games yet.
          </div>
        )}
        {!isLoading && games.length > 0 && (
          <div className="divide-y" style={{ borderColor: '#d4b5a0' }}>
            {games.map((g) => (
              <button
                key={g.gameId}
                onClick={() => onSelectGame(g.gameId)}
                className={`w-full text-left p-2 hover:bg-gray-50 ${
                  selectedGameId === g.gameId ? 'bg-blue-50' : ''
                }`}
                style={{ fontSize: '11px' }}
              >
                <div className="font-mono truncate" title={g.gameId}>
                  {g.gameId}
                </div>
                <div style={{ color: '#7a6b5f' }}>
                  {g.totalScore} pts · {g.roundsPlayed} rds
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
