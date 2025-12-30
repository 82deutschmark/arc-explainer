/**
 * Author: Cascade
 * Date: 2025-12-30
 * PURPOSE: Enhanced stacked histogram of game run lengths for Worm Arena models.
 *          Phase I: Interactive model filtering with search, select all/clear all
 *          Phase II: Clickable legend, bar hover highlighting, enhanced tooltip
 *          Phase III: View mode toggle (count/winRate/cumulative), reference lines
 *          All models shown by default with clear affordance for filtering.
 * SRP/DRY check: Pass - focused on charting, filtering, and data transformation.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Search, Filter, X, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { WormArenaRunLengthDistributionData, WormArenaRunLengthModelData } from '@shared/types';

// ============================================================================
// Constants
// ============================================================================

// Distinct color palette for models (expanded to 12 colors)
const MODEL_COLORS = [
  '#4A7C59', // Forest green
  '#5B8BA0', // Steel blue
  '#8B6F47', // Brown
  '#7E5F9A', // Purple
  '#C97B5D', // Terracotta
  '#4A90A4', // Teal
  '#A17355', // Copper
  '#6B8E6B', // Sage
  '#D4A574', // Sand
  '#6B7B8C', // Slate
  '#9B7653', // Umber
  '#7A9E7A', // Moss
];

// Lighter versions for losses
const MODEL_LOSS_COLORS = [
  '#8FB89E', // Light forest green
  '#9CBCCA', // Light steel blue
  '#C4A882', // Light brown
  '#B9A3C9', // Light purple
  '#E4B5A2', // Light terracotta
  '#8FC1CE', // Light teal
  '#D4B59A', // Light copper
  '#A8C4A8', // Light sage
  '#ECD4B8', // Light sand
  '#A8B4C0', // Light slate
  '#C9A88A', // Light umber
  '#B0C8B0', // Light moss
];

type ViewMode = 'count' | 'winRate' | 'cumulative';

// ============================================================================
// Types
// ============================================================================

interface TransformedDataPoint {
  rounds: number;
  // Dynamic keys for each model's wins/losses
  [key: string]: number;
}

interface WormArenaRunLengthChartProps {
  data: WormArenaRunLengthDistributionData;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Shorten model slug for display in legend/tooltip.
 */
function shortenModelSlug(slug: string, maxLen: number = 20): string {
  const parts = slug.split('/');
  const name = parts.length > 1 ? parts[parts.length - 1] : slug;
  return name.length > maxLen ? name.slice(0, maxLen - 2) + '..' : name;
}

/**
 * Transform API data for selected models into Recharts format.
 */
function transformDataForChart(
  models: WormArenaRunLengthModelData[],
  viewMode: ViewMode,
): TransformedDataPoint[] {
  if (models.length === 0) return [];

  // Collect all unique round values
  const allRounds = new Set<number>();
  models.forEach((model) => {
    model.bins.forEach((bin) => allRounds.add(bin.rounds));
  });

  const roundsArray = Array.from(allRounds).sort((a, b) => a - b);

  if (viewMode === 'cumulative') {
    // Calculate cumulative percentage
    const totalGames = models.reduce((sum, m) => sum + m.totalGames, 0);
    let cumulative = 0;
    return roundsArray.map((rounds) => {
      let gamesAtRound = 0;
      models.forEach((model) => {
        const bin = model.bins.find((b) => b.rounds === rounds);
        if (bin) gamesAtRound += bin.wins + bin.losses;
      });
      cumulative += gamesAtRound;
      return {
        rounds,
        cumulativePercent: totalGames > 0 ? (cumulative / totalGames) * 100 : 0,
      };
    });
  }

  // Count or WinRate mode
  return roundsArray.map((rounds) => {
    const dataPoint: TransformedDataPoint = { rounds };

    if (viewMode === 'winRate') {
      // Calculate win rate at this round across all selected models
      let totalWins = 0;
      let totalGames = 0;
      models.forEach((model) => {
        const bin = model.bins.find((b) => b.rounds === rounds);
        if (bin) {
          totalWins += bin.wins;
          totalGames += bin.wins + bin.losses;
        }
      });
      dataPoint.winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    }

    // Always include count data for bars
    models.forEach((model) => {
      const bin = model.bins.find((b) => b.rounds === rounds);
      dataPoint[`${model.modelSlug}-wins`] = bin?.wins || 0;
      dataPoint[`${model.modelSlug}-losses`] = bin?.losses || 0;
    });

    return dataPoint;
  });
}

/**
 * Calculate global average rounds across all models.
 */
function calculateGlobalAverage(models: WormArenaRunLengthModelData[]): number {
  let totalRounds = 0;
  let totalGames = 0;
  models.forEach((model) => {
    model.bins.forEach((bin) => {
      const games = bin.wins + bin.losses;
      totalRounds += bin.rounds * games;
      totalGames += games;
    });
  });
  return totalGames > 0 ? totalRounds / totalGames : 0;
}

/**
 * Calculate model-specific average rounds.
 */
function calculateModelAverage(model: WormArenaRunLengthModelData): number {
  let totalRounds = 0;
  let totalGames = 0;
  model.bins.forEach((bin) => {
    const games = bin.wins + bin.losses;
    totalRounds += bin.rounds * games;
    totalGames += games;
  });
  return totalGames > 0 ? totalRounds / totalGames : 0;
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: number;
  selectedModels: WormArenaRunLengthModelData[];
  hoveredModel: string | null;
  globalAverage: number;
  viewMode: ViewMode;
}

function EnhancedTooltip({
  active,
  payload,
  label,
  selectedModels,
  hoveredModel,
  globalAverage,
  viewMode,
}: EnhancedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // For cumulative view, show simple tooltip
  if (viewMode === 'cumulative') {
    const cumulativeEntry = payload.find((p) => p.dataKey === 'cumulativePercent');
    if (cumulativeEntry) {
      return (
        <div className="rounded-lg bg-white p-3 shadow-lg border border-[#8B7355] max-w-xs">
          <p className="font-semibold text-[#8B7355] mb-1">Round {label}</p>
          <p className="text-sm text-[#4A7C59] font-medium">
            {cumulativeEntry.value.toFixed(1)}% of games completed
          </p>
        </div>
      );
    }
  }

  // Group by model for count/winRate views
  const modelGroups: Record<string, { wins: number; losses: number; color: string; totalGames: number }> = {};

  payload.forEach((entry: any) => {
    const dataKey = entry.dataKey as string;
    if (dataKey === 'winRate' || dataKey === 'cumulativePercent') return;

    const isWin = dataKey.endsWith('-wins');
    const modelSlug = dataKey.replace(/-wins$/, '').replace(/-losses$/, '');

    // Find total games for this model
    const modelData = selectedModels.find((m) => m.modelSlug === modelSlug);
    const totalGames = modelData?.totalGames || 0;

    if (!modelGroups[modelSlug]) {
      modelGroups[modelSlug] = { wins: 0, losses: 0, color: entry.fill, totalGames };
    }
    if (isWin) {
      modelGroups[modelSlug].wins = entry.value || 0;
      modelGroups[modelSlug].color = entry.fill;
    } else {
      modelGroups[modelSlug].losses = entry.value || 0;
    }
  });

  const totalGamesAtRound = Object.values(modelGroups).reduce(
    (sum, g) => sum + g.wins + g.losses,
    0,
  );

  if (totalGamesAtRound === 0) return null;

  // Filter to show only hovered model if one is hovered, otherwise show all with data
  const modelsToShow = hoveredModel
    ? Object.entries(modelGroups).filter(([slug]) => slug === hoveredModel)
    : Object.entries(modelGroups).filter(([, g]) => g.wins > 0 || g.losses > 0);

  // Comparison to average
  const roundNum = label || 0;
  const comparisonText = roundNum < globalAverage - 2
    ? 'Short game'
    : roundNum > globalAverage + 2
    ? 'Long game'
    : 'Average length';

  return (
    <div className="rounded-lg bg-white p-3 shadow-lg border border-[#8B7355] max-w-xs">
      <div className="flex items-center justify-between mb-2 border-b border-[#D4B5A0] pb-1">
        <p className="font-semibold text-[#8B7355]">Round {label}</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF7F3] text-[#A0826D]">
          {comparisonText}
        </span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {modelsToShow.map(([modelSlug, { wins, losses, color, totalGames }]) => {
          const gamesHere = wins + losses;
          const winRateHere = gamesHere > 0 ? ((wins / gamesHere) * 100).toFixed(0) : '0';
          const pctOfModel = totalGames > 0 ? ((gamesHere / totalGames) * 100).toFixed(1) : '0';

          return (
            <div key={modelSlug} className="text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono font-medium text-[#4A5568] truncate">
                  {shortenModelSlug(modelSlug)}
                </span>
              </div>
              <div className="ml-4 grid grid-cols-3 gap-2 text-[10px] mt-0.5">
                <span className="text-[#4A7C59]">W: {wins}</span>
                <span className="text-[#8B6F47]">L: {losses}</span>
                <span className="text-[#5B8BA0] font-semibold">{winRateHere}% WR</span>
              </div>
              <div className="ml-4 text-[10px] text-[#A0826D]">
                {pctOfModel}% of this model's games
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#D4B5A0] mt-2 pt-2 flex justify-between">
        <p className="text-xs text-[#8B7355] font-semibold">Total: {totalGamesAtRound} games</p>
        {viewMode === 'winRate' && (
          <p className="text-xs text-[#4A7C59] font-semibold">
            {((Object.values(modelGroups).reduce((s, g) => s + g.wins, 0) / totalGamesAtRound) * 100).toFixed(0)}% WR
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Model Filter Popover
// ============================================================================

interface ModelFilterPopoverProps {
  allModels: WormArenaRunLengthModelData[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ModelFilterPopover({
  allModels,
  selectedSlugs,
  onToggle,
  onSelectAll,
  onClearAll,
}: ModelFilterPopoverProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const lowerSearch = search.toLowerCase();
    return allModels.filter((m) => m.modelSlug.toLowerCase().includes(lowerSearch));
  }, [allModels, search]);

  const allSelected = selectedSlugs.size === allModels.length;
  const noneSelected = selectedSlugs.size === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-[#D4B5A0] text-[#8B7355] hover:bg-[#FAF7F3]"
        >
          <Filter className="w-4 h-4" />
          <span>Filter Models</span>
          {!allSelected && (
            <Badge variant="secondary" className="ml-1 bg-[#4A7C59] text-white text-xs">
              {selectedSlugs.size}/{allModels.length}
            </Badge>
          )}
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-[#D4B5A0]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#A0826D]" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 border-[#D4B5A0] focus:ring-[#4A7C59]"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onSelectAll}
              disabled={allSelected}
              className="flex-1 text-xs text-[#4A7C59] hover:bg-[#4A7C59]/10"
            >
              <Check className="w-3 h-3 mr-1" />
              Select All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearAll}
              disabled={noneSelected}
              className="flex-1 text-xs text-[#C97B5D] hover:bg-[#C97B5D]/10"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2">
            {filteredModels.map((model, idx) => {
              const isSelected = selectedSlugs.has(model.modelSlug);
              const color = MODEL_COLORS[idx % MODEL_COLORS.length];
              return (
                <button
                  key={model.modelSlug}
                  onClick={() => onToggle(model.modelSlug)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#4A7C59]/10 text-[#4A5568]'
                      : 'text-[#A0826D] hover:bg-[#FAF7F3]'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-sm border ${
                      isSelected ? 'border-transparent' : 'border-[#D4B5A0]'
                    }`}
                    style={{ backgroundColor: isSelected ? color : 'transparent' }}
                  />
                  <span className="font-mono truncate flex-1">
                    {shortenModelSlug(model.modelSlug, 28)}
                  </span>
                  <span className="text-xs text-[#A0826D]">({model.totalGames})</span>
                </button>
              );
            })}
            {filteredModels.length === 0 && (
              <p className="text-center text-sm text-[#A0826D] py-4">No models match "{search}"</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// View Mode Toggle
// ============================================================================

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-[#D4B5A0] p-0.5 bg-[#FAF7F3]">
      {[
        { value: 'count' as ViewMode, label: 'Count' },
        { value: 'winRate' as ViewMode, label: 'Win Rate' },
        { value: 'cumulative' as ViewMode, label: 'Cumulative' },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === option.value
              ? 'bg-[#4A7C59] text-white shadow-sm'
              : 'text-[#8B7355] hover:text-[#4A7C59]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Interactive Legend
// ============================================================================

interface InteractiveLegendProps {
  models: WormArenaRunLengthModelData[];
  selectedSlugs: Set<string>;
  hoveredModel: string | null;
  onToggle: (slug: string, shiftKey: boolean) => void;
  onHover: (slug: string | null) => void;
}

function InteractiveLegend({
  models,
  selectedSlugs,
  hoveredModel,
  onToggle,
  onHover,
}: InteractiveLegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-4 px-2">
      {models.map((model, idx) => {
        const isVisible = selectedSlugs.has(model.modelSlug);
        const isHovered = hoveredModel === model.modelSlug;
        const color = MODEL_COLORS[idx % MODEL_COLORS.length];
        const lossColor = MODEL_LOSS_COLORS[idx % MODEL_LOSS_COLORS.length];

        return (
          <button
            key={model.modelSlug}
            onClick={(e) => onToggle(model.modelSlug, e.shiftKey)}
            onMouseEnter={() => onHover(model.modelSlug)}
            onMouseLeave={() => onHover(null)}
            className={`flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              isHovered ? 'bg-[#4A7C59]/10' : ''
            } ${!isVisible ? 'opacity-40' : ''}`}
            title={`Click to toggle, Shift+click to solo`}
          >
            <div className="flex gap-0.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: lossColor }}
              />
            </div>
            <span className="font-mono text-[#4A5568]">
              {shortenModelSlug(model.modelSlug, 16)}
            </span>
            <span className="text-[#A0826D]">({model.totalGames})</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function WormArenaRunLengthChart({ data }: WormArenaRunLengthChartProps) {
  const allModels = data.distributionData || [];

  // Phase I: Filtering state - all models selected by default
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(() =>
    new Set(allModels.map((m) => m.modelSlug))
  );

  // Phase II: Hover state for highlighting
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  // Phase III: View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('count');

  // Keep selection in sync when data changes
  React.useEffect(() => {
    setSelectedSlugs(new Set(allModels.map((m) => m.modelSlug)));
  }, [allModels.length]);

  // Filtered models based on selection
  const selectedModels = useMemo(
    () => allModels.filter((m) => selectedSlugs.has(m.modelSlug)),
    [allModels, selectedSlugs]
  );

  // Calculate averages for reference lines
  const globalAverage = useMemo(() => calculateGlobalAverage(allModels), [allModels]);
  const selectedAverage = useMemo(
    () => selectedModels.length === 1 ? calculateModelAverage(selectedModels[0]) : null,
    [selectedModels]
  );

  // Transform data for chart
  const transformedData = useMemo(
    () => transformDataForChart(selectedModels, viewMode),
    [selectedModels, viewMode]
  );

  // Handlers
  const handleToggleModel = useCallback((slug: string, shiftKey: boolean) => {
    setSelectedSlugs((prev) => {
      if (shiftKey) {
        // Solo this model
        return new Set([slug]);
      }
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSlugs(new Set(allModels.map((m) => m.modelSlug)));
  }, [allModels]);

  const handleClearAll = useCallback(() => {
    setSelectedSlugs(new Set());
  }, []);

  // Empty state
  if (allModels.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-[#FAF7F3] rounded-lg border border-[#D4B5A0]">
        <div className="text-center">
          <p className="text-[#8B7355] font-semibold">No distribution data available</p>
          <p className="text-[#A0826D] text-sm mt-1">
            Run matches to generate game length data.
          </p>
        </div>
      </div>
    );
  }

  // No selection state
  if (selectedSlugs.size === 0) {
    return (
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <ModelFilterPopover
            allModels={allModels}
            selectedSlugs={selectedSlugs}
            onToggle={(slug) => handleToggleModel(slug, false)}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div className="w-full h-[400px] flex items-center justify-center bg-[#FAF7F3] rounded-lg border border-[#D4B5A0]">
          <div className="text-center">
            <p className="text-[#8B7355] font-semibold">No models selected</p>
            <p className="text-[#A0826D] text-sm mt-1">
              Use the filter above to select models to display.
            </p>
            <Button
              onClick={handleSelectAll}
              className="mt-3 bg-[#4A7C59] hover:bg-[#3A6C49] text-white"
            >
              Show All Models
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const allSelected = selectedSlugs.size === allModels.length;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ModelFilterPopover
            allModels={allModels}
            selectedSlugs={selectedSlugs}
            onToggle={(slug) => handleToggleModel(slug, false)}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
          {!allSelected && (
            <div className="flex items-center gap-1 text-xs text-[#A0826D]">
              <span>Showing {selectedSlugs.size} of {allModels.length} models</span>
              <button
                onClick={handleSelectAll}
                className="text-[#4A7C59] hover:underline ml-1"
              >
                (show all)
              </button>
            </div>
          )}
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Hint for new users */}
      {allSelected && (
        <div className="text-xs text-[#A0826D] bg-[#FAF7F3] px-3 py-1.5 rounded-lg border border-[#D4B5A0] inline-flex items-center gap-2">
          <Filter className="w-3 h-3" />
          <span>Tip: Click legend items to toggle models, or use the Filter button above</span>
        </div>
      )}

      {/* Chart */}
      <div className="w-full" style={{ height: '450px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={transformedData}
            margin={{ top: 20, right: 20, left: 10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#D4B5A0" vertical={false} />
            <XAxis
              dataKey="rounds"
              tick={{ fill: '#8B7355', fontSize: 11 }}
              axisLine={{ stroke: '#D4B5A0' }}
              tickLine={{ stroke: '#D4B5A0' }}
              label={{
                value: 'Game Length (Rounds)',
                position: 'insideBottom',
                offset: -20,
                fill: '#8B7355',
                fontSize: 12,
                fontWeight: 500,
              }}
            />
            <YAxis
              tick={{ fill: '#8B7355', fontSize: 11 }}
              axisLine={{ stroke: '#D4B5A0' }}
              tickLine={{ stroke: '#D4B5A0' }}
              label={{
                value: viewMode === 'cumulative' ? 'Cumulative %' : viewMode === 'winRate' ? 'Win Rate %' : 'Number of Games',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#8B7355',
                fontSize: 12,
                fontWeight: 500,
              }}
              domain={viewMode === 'cumulative' || viewMode === 'winRate' ? [0, 100] : undefined}
            />

            <Tooltip
              content={
                <EnhancedTooltip
                  selectedModels={selectedModels}
                  hoveredModel={hoveredModel}
                  globalAverage={globalAverage}
                  viewMode={viewMode}
                />
              }
              cursor={{ fill: 'rgba(212, 181, 160, 0.15)' }}
            />

            {/* Reference lines */}
            <ReferenceLine
              x={Math.round(globalAverage)}
              stroke="#8B7355"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `Avg: ${globalAverage.toFixed(1)}`,
                position: 'top',
                fill: '#8B7355',
                fontSize: 10,
              }}
            />
            {selectedAverage !== null && (
              <ReferenceLine
                x={Math.round(selectedAverage)}
                stroke="#4A7C59"
                strokeWidth={2}
                label={{
                  value: `Model avg: ${selectedAverage.toFixed(1)}`,
                  position: 'top',
                  fill: '#4A7C59',
                  fontSize: 10,
                }}
              />
            )}

            {/* Cumulative line chart */}
            {viewMode === 'cumulative' && (
              <Line
                type="monotone"
                dataKey="cumulativePercent"
                stroke="#4A7C59"
                strokeWidth={2.5}
                dot={false}
                name="Cumulative %"
              />
            )}

            {/* Win rate line overlay */}
            {viewMode === 'winRate' && (
              <Line
                type="monotone"
                dataKey="winRate"
                stroke="#C97B5D"
                strokeWidth={2.5}
                dot={{ fill: '#C97B5D', r: 3 }}
                name="Win Rate"
              />
            )}

            {/* Stacked bars for count and winRate modes */}
            {viewMode !== 'cumulative' &&
              selectedModels.map((model, modelIndex) => {
                const isHovered = hoveredModel === model.modelSlug;
                const otherHovered = hoveredModel && hoveredModel !== model.modelSlug;
                const opacity = otherHovered ? 0.25 : 1;

                return (
                  <React.Fragment key={model.modelSlug}>
                    <Bar
                      dataKey={`${model.modelSlug}-wins`}
                      stackId="stack"
                      fill={MODEL_COLORS[modelIndex % MODEL_COLORS.length]}
                      fillOpacity={opacity}
                      stroke={isHovered ? '#333' : undefined}
                      strokeWidth={isHovered ? 1 : 0}
                      name={`${shortenModelSlug(model.modelSlug)} W`}
                      onMouseEnter={() => setHoveredModel(model.modelSlug)}
                      onMouseLeave={() => setHoveredModel(null)}
                    />
                    <Bar
                      dataKey={`${model.modelSlug}-losses`}
                      stackId="stack"
                      fill={MODEL_LOSS_COLORS[modelIndex % MODEL_LOSS_COLORS.length]}
                      fillOpacity={opacity}
                      stroke={isHovered ? '#333' : undefined}
                      strokeWidth={isHovered ? 1 : 0}
                      name={`${shortenModelSlug(model.modelSlug)} L`}
                      onMouseEnter={() => setHoveredModel(model.modelSlug)}
                      onMouseLeave={() => setHoveredModel(null)}
                    />
                  </React.Fragment>
                );
              })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive legend */}
      {viewMode !== 'cumulative' && (
        <div className="bg-[#FAF7F3] rounded-lg p-3 border border-[#D4B5A0]">
          <div className="text-center mb-2">
            <span className="text-xs text-[#A0826D]">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#4A7C59] mr-1 align-middle" /> Wins
              <span className="mx-3">|</span>
              <span className="inline-block w-3 h-3 rounded-sm bg-[#8FB89E] mr-1 align-middle" /> Losses
              <span className="mx-3">|</span>
              <span className="text-[10px] italic">Click to toggle, Shift+click to solo</span>
            </span>
          </div>
          <InteractiveLegend
            models={allModels}
            selectedSlugs={selectedSlugs}
            hoveredModel={hoveredModel}
            onToggle={handleToggleModel}
            onHover={setHoveredModel}
          />
        </div>
      )}
    </div>
  );
}
