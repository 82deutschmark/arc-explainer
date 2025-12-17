/**
 * Author: GPT-5.2-Medium-Reasoning
 * Date: 2025-12-17
 * PURPOSE: Reusable Worm Arena model list selector card.
 *          Provides a searchable, games-played-sorted list of model slugs.
 *          Supports configurable title/subtitle/placeholder so pages can clearly label intent
 *          (e.g., "Compare model" vs "Baseline model") without duplicating UI.
 * SRP/DRY check: Pass — presentational selector; parent owns selection + filtering state.
 */

import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WormArenaModelRole } from '@/utils/wormArenaRoleColors';
import { getWormArenaRoleColors } from '@/utils/wormArenaRoleColors';

interface WormArenaLeaderboardEntry {
  modelSlug: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
}

export default function WormArenaModelListCard({
  leaderboard,
  recentActivityLabel,
  selectedModel,
  filter,
  onFilterChange,
  onSelectModel,
  // Optional copy/customization for pages that need clearer intent.
  title = 'Models',
  subtitle = 'Sorted by games played (most to least)',
  searchPlaceholder = 'Search model (e.g. openai/gpt-5.1)',
  // Allows callers to tune scroll height so multi-card columns fit without clipping.
  scrollAreaClassName = 'h-[520px] max-h-[60vh]',
  role = 'neutral',
}: {
  leaderboard: WormArenaLeaderboardEntry[];
  recentActivityLabel: string | null;
  selectedModel: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelectModel: (slug: string) => void;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  scrollAreaClassName?: string;
  role?: WormArenaModelRole;
}) {
  const filteredLeaderboard = React.useMemo(() => {
    const term = filter.trim().toLowerCase();
    const sorted = [...leaderboard].sort(
      (a, b) => (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0),
    );
    if (!term) return sorted;
    return sorted.filter((entry) => entry.modelSlug.toLowerCase().includes(term));
  }, [leaderboard, filter]);

  const roleColors = getWormArenaRoleColors(role);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-3 flex flex-row items-baseline justify-between">
        <div>
          <CardTitle className="text-lg worm-card-title">{title}</CardTitle>
          <div className="text-sm font-semibold worm-muted">
            {subtitle}
          </div>
        </div>
        {recentActivityLabel && (
          <div className="text-sm font-semibold text-right">
            {recentActivityLabel}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder={searchPlaceholder}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-base font-semibold text-worm-ink"
        />

        <ScrollArea className={`${scrollAreaClassName} border rounded-md bg-white/90 worm-border`}>
          <div className="p-3 space-y-2">
            {filteredLeaderboard.map((entry, index) => {
              const active = entry.modelSlug === selectedModel;
              const cssVars = {
                ['--role-accent' as string]: roleColors.accent,
                ['--role-tint-bg' as string]: roleColors.tintBg,
                ['--role-tint-bg-strong' as string]: roleColors.tintBgStrong,
              } as React.CSSProperties;

              return (
                <button
                  key={entry.modelSlug}
                  type="button"
                  onClick={() => onSelectModel(entry.modelSlug)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:bg-[var(--role-tint-bg)] focus-visible:ring-[var(--role-accent)] ${
                    active
                      ? 'text-worm-ink bg-[var(--role-tint-bg-strong)] border-[var(--role-accent)]'
                      : 'bg-white text-worm-ink border-worm-border'
                  }`}
                  style={cssVars}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-xs font-bold"
                      style={{ color: active ? roleColors.accent : 'var(--worm-muted)' }}
                    >
                      #{index + 1}
                    </span>
                    <span className="truncate font-mono">{entry.modelSlug}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-right">
                    <div>{entry.gamesPlayed} games</div>
                    <div className="text-[11px]" style={{ color: active ? roleColors.accent : 'var(--worm-muted)' }}>
                      {entry.wins}W / {entry.losses}L / {entry.ties}T
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredLeaderboard.length === 0 && (
              <div className="text-sm text-center font-semibold py-6 worm-muted">
                No models yet. Run a few matches to populate stats.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
