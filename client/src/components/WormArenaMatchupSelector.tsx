/**
 * Author: GPT-5.2
 * Date: 2025-12-12
 * PURPOSE: Curated matchup selector for WormArenaLive.
 *          Renders categorized, high-contrast matchup cards and clearly indicates
 *          selection/availability without relying on fragile decorative glyphs.
 * SRP/DRY check: Pass — pure UI component.
 */

import React from 'react';
import { getCuratedMatchups, type CuratedMatchup, type CuratedMatchupCategory } from '@shared/utils/curatedMatchups';

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
  { key: 'cross-tier', label: 'Cross-tier', description: 'Premium vs budget comparisons' },
  { key: 'budget', label: 'Budget', description: 'Ultra-cheap showdowns' },
  { key: 'premium', label: 'Premium', description: 'Top-tier reasoning battles' },
  { key: 'rivalry', label: 'Rivalries', description: 'Head-to-head matchups' },
  { key: 'placement', label: 'Placement', description: 'New or under-scored models' },
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
      {CATEGORIES.map((category) => {
        const matchups = getCuratedMatchups(category.key);
        if (matchups.length === 0) return null;

        return (
          <div key={category.key} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-worm-ink">{category.label}</div>
              <div className="text-[11px] text-worm-ink/80">{category.description}</div>
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
                    className={cnMatchupCard(selected, disabled)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl flex-shrink-0 mt-0.5">{matchup.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-worm-ink leading-tight">{matchup.displayName}</div>
                        <div className="text-xs mt-1 text-worm-ink/80 leading-tight">{matchup.description}</div>
                        {!available && (
                          <div className="text-[10px] mt-1.5 text-orange-700 font-semibold">Not on OpenRouter</div>
                        )}
                      </div>
                      {selected && (
                        <span className="text-[10px] flex-shrink-0 mt-1 px-2 py-0.5 rounded border worm-border bg-white/70 text-worm-ink font-semibold">
                          Selected
                        </span>
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

function cnMatchupCard(selected: boolean, disabled: boolean) {
  const base =
    'w-full p-3 rounded border text-left transition-all bg-white/90 border-worm-border hover:border-worm-ink hover:bg-white';
  const selectedClass = selected ? 'ring-2 ring-worm-green/30 border-worm-ink bg-worm-card shadow-md' : '';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]';
  return [base, selectedClass, disabledClass].filter(Boolean).join(' ');
}

