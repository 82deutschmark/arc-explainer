/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-12
 * PURPOSE: Curated matchup selector for WormArenaLive.
 *          Renders categorized buttons (Cross-Tier, Budget, Premium, Rivalry, Placement)
 *          with full-width, high-contrast cards that are immediately scannable.
 *          Selected state has ring + bg highlight + checkmark. Unavailable models show warning.
 *          Optimized for sidebar context (left panel of live arena).
 * SRP/DRY check: Pass - pure UI component. Reuses getCuratedMatchups() utility.
 *                No streaming, scoring, or timing logic. No duplication.
 * UX Notes: Cards 3x larger than previous, clear hover states, active press feedback.
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
    <div className="space-y-3 font-worm">
      {CATEGORIES.map((cat) => {
        const matchups = getCuratedMatchups(cat.key);
        if (matchups.length === 0) return null;

        return (
          <div key={cat.key} className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide worm-muted">
              {cat.label}
            </div>

            <div className="space-y-2">
              {matchups.map((matchup) => {
                const selected = selectedMatchup.id === matchup.id;
                const available = isAvailable(matchup);
                const disabled = isRunning || !available;

                return (
                  <button
                    key={matchup.id}
                    onClick={() => onSelectMatchup(matchup)}
                    disabled={disabled}
                    className={`
                      w-full p-3 rounded border text-left transition-all
                      ${selected
                        ? 'border-worm-ink bg-worm-card shadow-md ring-2 ring-worm-green/30'
                        : 'border-worm-border bg-white/80 hover:border-worm-ink hover:bg-white'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                    `}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl flex-shrink-0 mt-0.5">{matchup.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-worm-ink leading-tight">
                          {matchup.displayName}
                        </div>
                        <div className="text-xs mt-1 worm-muted leading-tight">
                          {matchup.description}
                        </div>
                        {!available && (
                          <div className="text-[10px] mt-1.5 text-orange-600 font-semibold">
                            ⚠ Not on OpenRouter
                          </div>
                        )}
                      </div>
                      {selected && (
                        <span className="text-lg flex-shrink-0 mt-0.5">✓</span>
                      )}
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

