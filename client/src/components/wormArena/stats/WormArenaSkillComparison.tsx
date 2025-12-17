/**
 * Author: GPT-5.2-Medium-Reasoning
 * Date: 2025-12-17
 * PURPOSE: High-level comparison orchestrator that wires the Worm Arena scatter plot
 *          and stacked bell curves together. Exposes search, selection state, and hover
 *          synchronization so the page can reuse the component without duplicating logic.
 * SRP/DRY check: Pass — single component responsible for comparison flow; reuses child
 *                visualization components and shared leaderboard types.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { SnakeBenchTrueSkillLeaderboardEntry } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import WormArenaSkillScatterPlot from './WormArenaSkillScatterPlot';
import WormArenaMultiCurveOverlay from './WormArenaMultiCurveOverlay';

const MAX_MODELS = 5;
const COMPARISON_COLOR_PALETTE = [
  '#31708F',
  '#2E7D32',
  '#F5A623',
  '#C85A3A',
  '#7B3FE4',
] as const;
const UNSELECTED_MODEL_COLOR = '#D4B5A0';

export interface WormArenaSkillComparisonProps {
  leaderboard: SnakeBenchTrueSkillLeaderboardEntry[];
  selectedModels: string[];
  onSelectionChange: (slugs: string[]) => void;
  isLoading?: boolean;
}

/**
 * Coordinates the scatter plot ↔ bell curve overlay interactions.
 */
export default function WormArenaSkillComparison({
  leaderboard,
  selectedModels,
  onSelectionChange,
  isLoading = false,
}: WormArenaSkillComparisonProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [hoveredModelSlug, setHoveredModelSlug] = useState<string | null>(null);

  const normalizedFilter = searchFilter.trim().toLowerCase();
  const hasLeaderboardData = leaderboard.length > 0;

  // Stabilize plot domains based on the full leaderboard.
  // This prevents the axes from "jumping" as the user types in the search box.
  const muDomain = useMemo(() => {
    if (!hasLeaderboardData) {
      return { min: 0, max: 1 };
    }

    const values = leaderboard.map((entry) => entry.mu);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const padding = span * 0.06;
    return {
      min: min - padding,
      max: max + padding,
    };
  }, [hasLeaderboardData, leaderboard]);

  const sigmaDomain = useMemo(() => {
    if (!hasLeaderboardData) {
      return { min: 0, max: 1 };
    }

    const values = leaderboard.map((entry) => entry.sigma);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = max - min || 1;
    const padding = span * 0.08;
    return {
      min: Math.max(0, min - padding),
      max: max + padding,
    };
  }, [hasLeaderboardData, leaderboard]);

  // Keep selected models visible even if they do not match the search filter.
  const filteredLeaderboard = useMemo(() => {
    if (!normalizedFilter) {
      return leaderboard;
    }

    const pinnedSet = new Set(selectedModels);

    return leaderboard.filter((entry) => {
      if (pinnedSet.has(entry.modelSlug)) {
        return true;
      }
      return entry.modelSlug.toLowerCase().includes(normalizedFilter);
    });
  }, [leaderboard, normalizedFilter, selectedModels]);

  // Preserve selection order when resolving the rich model data objects.
  const selectedModelDetails = useMemo(() => {
    const bySlug = new Map(
      leaderboard.map((entry) => [entry.modelSlug, entry]),
    );

    return selectedModels
      .map((slug) => bySlug.get(slug))
      .filter((entry): entry is SnakeBenchTrueSkillLeaderboardEntry => Boolean(entry));
  }, [leaderboard, selectedModels]);

  const handlePointClick = useCallback(
    (modelSlug: string) => {
      if (selectedModels.includes(modelSlug)) {
        onSelectionChange(
          selectedModels.filter((slug) => slug !== modelSlug),
        );
        return;
      }

      if (selectedModels.length >= MAX_MODELS) {
        onSelectionChange([...selectedModels.slice(1), modelSlug]);
        return;
      }

      onSelectionChange([...selectedModels, modelSlug]);
    },
    [onSelectionChange, selectedModels],
  );

  const handlePointHover = useCallback((modelSlug: string | null) => {
    setHoveredModelSlug(modelSlug);
  }, []);

  const handleCurveHover = useCallback((modelSlug: string | null) => {
    setHoveredModelSlug(modelSlug);
  }, []);

  if (!hasLeaderboardData) {
    return (
      <div className="rounded-lg border border-worm-border bg-white p-6 text-sm text-worm-muted">
        {isLoading ? (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-worm-ink">Loading Comparison View…</div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[360px] w-full" />
            <Skeleton className="h-[110px] w-full" />
            <Skeleton className="h-[110px] w-full" />
          </div>
        ) : (
          'No TrueSkill leaderboard data available yet.'
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* Search bar keeps the UI approachable even with 150+ models. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search models by slug"
          placeholder="Search models..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="flex-1"
        />
        <Badge variant="secondary">
          {selectedModels.length}/{MAX_MODELS} selected
        </Badge>
      </div>

      {filteredLeaderboard.length === 0 ? (
        <div className="rounded-lg border border-dashed border-worm-border bg-worm-panel px-4 py-6 text-sm text-worm-muted">
          No models match &ldquo;{searchFilter}&rdquo;. Clear the search to see
          the full scatter plot again.
        </div>
      ) : (
        <WormArenaSkillScatterPlot
          leaderboard={filteredLeaderboard}
          selectedModels={selectedModels}
          hoveredModel={hoveredModelSlug}
          onPointClick={handlePointClick}
          onPointHover={handlePointHover}
          colorPalette={COMPARISON_COLOR_PALETTE}
          unselectedColor={UNSELECTED_MODEL_COLOR}
          muDomain={muDomain}
          sigmaDomain={sigmaDomain}
        />
      )}

      <WormArenaMultiCurveOverlay
        models={selectedModelDetails}
        hoveredModel={hoveredModelSlug}
        onCurveHover={handleCurveHover}
        colorPalette={COMPARISON_COLOR_PALETTE}
      />

      {selectedModels.length === 0 && (
        <div className="rounded-lg border border-dashed border-worm-border bg-worm-panel px-4 py-6 text-center text-sm text-worm-muted">
          Click any scatter point to lock a model into the comparison view. Up
          to {MAX_MODELS} models can be compared at once.
        </div>
      )}
    </section>
  );
}
