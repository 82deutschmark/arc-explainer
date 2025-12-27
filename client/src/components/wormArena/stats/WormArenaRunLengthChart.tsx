/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-27
 * PURPOSE: Renders a stacked histogram of game run lengths for Worm Arena models.
 *          Shows distribution of game rounds by selected models, separated into wins and losses.
 *          Uses Recharts BarChart with proper stacking and model selection.
 *          Limit displayed models to prevent overcrowding (max 8 models visible).
 * SRP/DRY check: Pass - focused exclusively on charting and data transformation.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WormArenaRunLengthDistributionData, WormArenaRunLengthModelData } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Distinct color palette for models (8 colors, enough contrast)
const MODEL_COLORS = [
  '#4A7C59', // Forest green
  '#5B8BA0', // Steel blue
  '#8B6F47', // Brown
  '#7E5F9A', // Purple
  '#C97B5D', // Terracotta
  '#4A90A4', // Teal
  '#A17355', // Copper
  '#6B8E6B', // Sage
];

// Lighter versions for losses (same hue, less saturation)
const MODEL_LOSS_COLORS = [
  '#8FB89E', // Light forest green
  '#9CBCCA', // Light steel blue
  '#C4A882', // Light brown
  '#B9A3C9', // Light purple
  '#E4B5A2', // Light terracotta
  '#8FC1CE', // Light teal
  '#D4B59A', // Light copper
  '#A8C4A8', // Light sage
];

interface TransformedDataPoint {
  rounds: number;
  [key: string]: number;
}

interface WormArenaRunLengthChartProps {
  data: WormArenaRunLengthDistributionData;
}

/**
 * Transform API data for selected models into Recharts format.
 * Each data point contains round count and win/loss counts per model.
 */
function transformDataForChart(
  models: WormArenaRunLengthModelData[],
): TransformedDataPoint[] {
  if (models.length === 0) return [];

  // Collect all unique round values across selected models
  const allRounds = new Set<number>();
  models.forEach((model) => {
    model.bins.forEach((bin) => allRounds.add(bin.rounds));
  });

  // Sort rounds numerically
  const roundsArray = Array.from(allRounds).sort((a, b) => a - b);

  // Build data points
  return roundsArray.map((rounds) => {
    const dataPoint: TransformedDataPoint = { rounds };
    models.forEach((model) => {
      const bin = model.bins.find((b) => b.rounds === rounds);
      dataPoint[`${model.modelSlug}-wins`] = bin?.wins || 0;
      dataPoint[`${model.modelSlug}-losses`] = bin?.losses || 0;
    });
    return dataPoint;
  });
}

/**
 * Shorten model slug for display in legend/tooltip.
 * Strips provider prefix and truncates if too long.
 */
function shortenModelSlug(slug: string, maxLen: number = 20): string {
  // Remove provider prefix (e.g., "openai/gpt-5-nano" -> "gpt-5-nano")
  const parts = slug.split('/');
  const name = parts.length > 1 ? parts[parts.length - 1] : slug;
  return name.length > maxLen ? name.slice(0, maxLen - 2) + '..' : name;
}

/**
 * Custom tooltip showing breakdown per model at a given round.
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  // Group by model
  const modelGroups: Record<string, { wins: number; losses: number; color: string }> = {};
  payload.forEach((entry: any) => {
    const dataKey = entry.dataKey as string;
    const isWin = dataKey.endsWith('-wins');
    const modelSlug = dataKey.replace(/-wins$/, '').replace(/-losses$/, '');
    if (!modelGroups[modelSlug]) {
      modelGroups[modelSlug] = { wins: 0, losses: 0, color: entry.fill };
    }
    if (isWin) {
      modelGroups[modelSlug].wins = entry.value || 0;
      modelGroups[modelSlug].color = entry.fill; // Use win color as primary
    } else {
      modelGroups[modelSlug].losses = entry.value || 0;
    }
  });

  const totalGames = Object.values(modelGroups).reduce(
    (sum, g) => sum + g.wins + g.losses,
    0,
  );

  // Skip if no games at this round
  if (totalGames === 0) return null;

  return (
    <div className="rounded-lg bg-white p-3 shadow-lg border border-[#8B7355] max-w-xs">
      <p className="font-semibold text-[#8B7355] mb-2 border-b border-[#D4B5A0] pb-1">
        Round {label}
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {Object.entries(modelGroups)
          .filter(([, g]) => g.wins > 0 || g.losses > 0)
          .map(([modelSlug, { wins, losses, color }]) => (
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
              <div className="ml-4 flex gap-3 text-[10px]">
                <span className="text-[#4A7C59]">W: {wins}</span>
                <span className="text-[#8B6F47]">L: {losses}</span>
              </div>
            </div>
          ))}
      </div>
      <div className="border-t border-[#D4B5A0] mt-2 pt-2">
        <p className="text-xs text-[#8B7355] font-semibold">Total: {totalGames} games</p>
      </div>
    </div>
  );
}

/**
 * Custom legend renderer for cleaner display.
 */
function renderLegend(selectedModels: WormArenaRunLengthModelData[]) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 px-2">
      {selectedModels.map((model, idx) => (
        <div key={model.modelSlug} className="flex items-center gap-1.5 text-xs">
          <div className="flex gap-0.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length] }}
              title="Wins"
            />
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: MODEL_LOSS_COLORS[idx % MODEL_LOSS_COLORS.length] }}
              title="Losses"
            />
          </div>
          <span className="font-mono text-[#4A5568]" title={model.modelSlug}>
            {shortenModelSlug(model.modelSlug, 18)}
          </span>
          <span className="text-[#A0826D]">({model.totalGames})</span>
        </div>
      ))}
    </div>
  );
}

export default function WormArenaRunLengthChart({ data }: WormArenaRunLengthChartProps) {
  // Default: show top 5 models by game count
  const DEFAULT_VISIBLE = 5;
  const MAX_VISIBLE = 8;

  const allModels = data.distributionData || [];
  const topModels = allModels.slice(0, DEFAULT_VISIBLE);

  // State for selected model slugs
  const [selectedSlugs, setSelectedSlugs] = React.useState<Set<string>>(
    () => new Set(topModels.map((m) => m.modelSlug)),
  );
  const [showModelPicker, setShowModelPicker] = React.useState(false);

  // Reset selection when data changes
  React.useEffect(() => {
    const newTopSlugs = new Set(allModels.slice(0, DEFAULT_VISIBLE).map((m) => m.modelSlug));
    setSelectedSlugs(newTopSlugs);
  }, [data.timestamp]);

  // Get selected models in order
  const selectedModels = allModels.filter((m) => selectedSlugs.has(m.modelSlug));

  // Toggle model selection
  const toggleModel = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < MAX_VISIBLE) {
        next.add(slug);
      }
      return next;
    });
  };

  // Quick select helpers
  const selectTop = (n: number) => {
    setSelectedSlugs(new Set(allModels.slice(0, n).map((m) => m.modelSlug)));
  };

  // Empty state
  if (allModels.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-[#FAF7F3] rounded-lg border border-[#D4B5A0]">
        <div className="text-center">
          <p className="text-[#8B7355] font-semibold">No distribution data available</p>
          <p className="text-[#A0826D] text-sm mt-1">
            Try lowering the minimum games threshold
          </p>
        </div>
      </div>
    );
  }

  const transformedData = transformDataForChart(selectedModels);

  // No models selected state
  if (selectedModels.length === 0) {
    return (
      <div className="space-y-4">
        <div className="w-full h-[300px] flex items-center justify-center bg-[#FAF7F3] rounded-lg border border-[#D4B5A0]">
          <div className="text-center">
            <p className="text-[#8B7355] font-semibold">No models selected</p>
            <p className="text-[#A0826D] text-sm mt-1">Select models below to view distribution</p>
          </div>
        </div>
        {renderModelPicker()}
      </div>
    );
  }

  // Model picker component
  function renderModelPicker() {
    return (
      <div className="border border-[#D4B5A0] rounded-lg bg-[#FAF7F3] p-3">
        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#8B7355]">Model Selection</span>
            <span className="text-xs text-[#A0826D]">
              ({selectedSlugs.size}/{MAX_VISIBLE} max)
            </span>
          </div>
          {showModelPicker ? (
            <ChevronUp className="w-4 h-4 text-[#8B7355]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8B7355]" />
          )}
        </button>

        {showModelPicker && (
          <div className="mt-3 space-y-3">
            {/* Quick select buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectTop(3)}
                className="text-xs h-7 border-[#D4B5A0] hover:bg-[#4A7C59] hover:text-white"
              >
                Top 3
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectTop(5)}
                className="text-xs h-7 border-[#D4B5A0] hover:bg-[#4A7C59] hover:text-white"
              >
                Top 5
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectTop(MAX_VISIBLE)}
                className="text-xs h-7 border-[#D4B5A0] hover:bg-[#4A7C59] hover:text-white"
              >
                Top {MAX_VISIBLE}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSlugs(new Set())}
                className="text-xs h-7 border-[#D4B5A0] hover:bg-[#E8645B] hover:text-white"
              >
                Clear All
              </Button>
            </div>

            {/* Model checkboxes in grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {allModels.map((model) => {
                const isSelected = selectedSlugs.has(model.modelSlug);
                const isDisabled = !isSelected && selectedSlugs.size >= MAX_VISIBLE;
                return (
                  <label
                    key={model.modelSlug}
                    className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#4A7C59] bg-[#4A7C59]/10'
                        : isDisabled
                        ? 'border-[#D4B5A0] bg-gray-100 opacity-50 cursor-not-allowed'
                        : 'border-[#D4B5A0] hover:border-[#8B7355]'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => toggleModel(model.modelSlug)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="font-mono truncate" title={model.modelSlug}>
                      {shortenModelSlug(model.modelSlug, 16)}
                    </span>
                    <span className="text-[#A0826D] ml-auto flex-shrink-0">
                      {model.totalGames}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="w-full" style={{ height: '450px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
                value: 'Number of Games',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#8B7355',
                fontSize: 12,
                fontWeight: 500,
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 181, 160, 0.15)' }} />

            {/* Render stacked bars for each selected model */}
            {selectedModels.map((model, modelIndex) => (
              <React.Fragment key={model.modelSlug}>
                {/* Wins (darker color) */}
                <Bar
                  dataKey={`${model.modelSlug}-wins`}
                  stackId="stack"
                  fill={MODEL_COLORS[modelIndex % MODEL_COLORS.length]}
                  name={`${shortenModelSlug(model.modelSlug)} W`}
                />
                {/* Losses (lighter color) */}
                <Bar
                  dataKey={`${model.modelSlug}-losses`}
                  stackId="stack"
                  fill={MODEL_LOSS_COLORS[modelIndex % MODEL_LOSS_COLORS.length]}
                  name={`${shortenModelSlug(model.modelSlug)} L`}
                />
              </React.Fragment>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend */}
      <div className="bg-[#FAF7F3] rounded-lg p-3 border border-[#D4B5A0]">
        <div className="text-center mb-2">
          <span className="text-xs text-[#A0826D]">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#4A7C59] mr-1 align-middle" /> Wins
            <span className="mx-3">|</span>
            <span className="inline-block w-3 h-3 rounded-sm bg-[#8FB89E] mr-1 align-middle" /> Losses
          </span>
        </div>
        {renderLegend(selectedModels)}
      </div>

      {/* Model picker */}
      {renderModelPicker()}
    </div>
  );
}
