/**
 * Author: GPT-5.2 Codex CLI
 * Date: 2025-12-12
 * PURPOSE: Curated matchup selector for WormArenaLive.
 *          Renders categorized cards the user can pick from to launch a single
 *          statistically meaningful live match.
 * SRP/DRY check: Pass - UI only, no streaming logic.
 * shadcn/ui: Pass - uses existing styling primitives.
 */

import React from 'react';
import {
  getCuratedMatchups,
  type CuratedMatchup,
  type CuratedMatchupCategory,
} from '@shared/utils/curatedMatchups';

interface WormArenaMatchupSelectorProps {
  selectedMatchup: CuratedMatchup;
  onSelectMatchup: (matchup: CuratedMatchup) => void;
  isRunning: boolean;
  availableModels?: Set<string>;
}

const CATEGORIES: Array<{
  key: CuratedMatchupCategory;
  label: string;
  description: string;
}> = [
  { key: 'cross-tier', label: '⚡ Cross-Tier', description: 'Premium vs budget comparisons' },
  { key: 'budget', label: '💰 Budget Tier', description: 'Ultra-cheap showdowns' },
  { key: 'premium', label: '👑 Premium Tier', description: 'Top-tier reasoning battles' },
  { key: 'rivalry', label: '🔥 Rivalries', description: 'Late-2025 head-to-heads' },
  { key: 'placement', label: '🆕 Placement', description: 'New or less-scored models' },
];

export default function WormArenaMatchupSelector({
  selectedMatchup,
  onSelectMatchup,
  isRunning,
  availableModels,
}: WormArenaMatchupSelectorProps) {
  const isAvailable = (matchup: CuratedMatchup) => {
    if (!availableModels) return true;
    return availableModels.has(matchup.modelA) && availableModels.has(matchup.modelB);
  };

  return (
    <div className="space-y-4 font-worm">
      <div className="text-sm font-semibold text-worm-ink">
        Select a Matchup
      </div>

      {CATEGORIES.map((cat) => {
        const matchups = getCuratedMatchups(cat.key);
        if (matchups.length === 0) return null;

        return (
          <div key={cat.key} className="space-y-2">
            <div className="text-xs font-medium worm-muted">
              {cat.label}{' '}
              <span className="font-normal">
                · {cat.description}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {matchups.map((matchup) => {
                const selected = selectedMatchup.id === matchup.id;
                const available = isAvailable(matchup);
                const disabled = isRunning || !available;

                return (
                  <button
                    key={matchup.id}
                    onClick={() => onSelectMatchup(matchup)}
                    disabled={disabled}
                    className={
                      `
                      p-3 rounded border text-left transition-all
                      ${selected
                        ? 'border-worm-ink bg-worm-card shadow-sm'
                        : 'border-worm-border bg-white/90 hover:border-worm-muted'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{matchup.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-worm-ink">
                          {matchup.displayName}
                        </div>
                        <div className="text-xs mt-1 worm-muted">
                          {matchup.description}
                        </div>
                        {!available && (
                          <div className="text-[10px] mt-1 text-worm-red">
                            Not available on OpenRouter
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

