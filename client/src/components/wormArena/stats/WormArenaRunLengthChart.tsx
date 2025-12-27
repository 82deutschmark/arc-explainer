/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Renders a stacked histogram of game run lengths for Worm Arena models.
 *          Shows distribution of game rounds by model, separated into wins and losses.
 *          Uses Recharts with custom color theming for Worm Arena aesthetic.
 * SRP/DRY check: Pass - focused exclusively on charting and data transformation.
 */

import React from 'react';
import * as RechartsPrimitive from 'recharts';
import type { WormArenaRunLengthDistributionData } from '@shared/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend } from '@/components/ui/chart';

// Worm Arena color palette
// Wins: greens/earth tones
const WIN_COLORS = ['#4A7C59', '#5D8A6B', '#6FA87D', '#7FB68F', '#8FC0A0'];
// Losses: browns/warm tones
const LOSS_COLORS = ['#8B6F47', '#A17E55', '#B78D63', '#C89B71', '#D5A080'];

interface TransformedDataPoint {
  rounds: number;
  [key: string]: number | string;
}

interface WormArenaRunLengthChartProps {
  data: WormArenaRunLengthDistributionData;
}

/**
 * Transform API data into Recharts format
 * Groups all models' data into a single array where each object represents a round count
 * with properties for each model's wins and losses
 */
function transformDataForChart(data: WormArenaRunLengthDistributionData): TransformedDataPoint[] {
  if (!data.distributionData || data.distributionData.length === 0) {
    return [];
  }

  // Collect all unique round values across all models
  const allRounds = new Set<number>();
  data.distributionData.forEach((model) => {
    model.bins.forEach((bin) => {
      allRounds.add(bin.rounds);
    });
  });

  // Sort rounds numerically
  const roundsArray = Array.from(allRounds).sort((a, b) => a - b);

  // Build data points: one object per round value with all models' win/loss counts
  return roundsArray.map((rounds) => {
    const dataPoint: TransformedDataPoint = { rounds };

    data.distributionData.forEach((model) => {
      const bin = model.bins.find((b) => b.rounds === rounds);
      dataPoint[`${model.modelSlug}-wins`] = bin?.wins || 0;
      dataPoint[`${model.modelSlug}-losses`] = bin?.losses || 0;
    });

    return dataPoint;
  });
}

/**
 * Create chart config for theming
 * Maps each bar type to a color and label
 */
function createChartConfig(data: WormArenaRunLengthDistributionData) {
  const config: Record<string, { label: string; color: string }> = {};

  data.distributionData.forEach((model, index) => {
    const winsKey = `${model.modelSlug}-wins`;
    const lossesKey = `${model.modelSlug}-losses`;
    const winColor = WIN_COLORS[index % WIN_COLORS.length];
    const lossColor = LOSS_COLORS[index % LOSS_COLORS.length];

    config[winsKey] = {
      label: `${model.modelSlug} (Wins)`,
      color: winColor,
    };
    config[lossesKey] = {
      label: `${model.modelSlug} (Losses)`,
      color: lossColor,
    };
  });

  return config;
}

/**
 * Custom tooltip for Recharts
 * Shows detailed breakdown per model at each round
 */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Group payload by model
  const roundValue = payload[0]?.payload?.rounds;
  const modelGroups: Record<string, { wins: number; losses: number }> = {};

  payload.forEach((entry: any) => {
    const dataKey = entry.dataKey as string;
    const isWin = dataKey.includes('-wins');
    const modelSlug = dataKey.replace('-wins', '').replace('-losses', '');

    if (!modelGroups[modelSlug]) {
      modelGroups[modelSlug] = { wins: 0, losses: 0 };
    }

    if (isWin) {
      modelGroups[modelSlug].wins = entry.value;
    } else {
      modelGroups[modelSlug].losses = entry.value;
    }
  });

  const totalGames = Object.values(modelGroups).reduce(
    (sum, group) => sum + group.wins + group.losses,
    0,
  );

  return (
    <div className="rounded-lg bg-white p-3 shadow-lg border border-[#8B7355]">
      <p className="font-semibold text-[#8B7355] mb-2">Round {roundValue}</p>
      {Object.entries(modelGroups).map(([modelSlug, { wins, losses }]) => (
        <div key={modelSlug} className="mb-2 last:mb-0 text-sm">
          <p className="font-mono font-semibold text-[#4A5568]">{modelSlug}</p>
          <p className="ml-2 text-[#4A7C59]">Wins: {wins}</p>
          <p className="ml-2 text-[#8B6F47]">Losses: {losses}</p>
        </div>
      ))}
      <div className="border-t border-[#D4B5A0] mt-2 pt-2">
        <p className="text-xs text-[#8B7355] font-semibold">Total: {totalGames} games</p>
      </div>
    </div>
  );
}

export default function WormArenaRunLengthChart({ data }: WormArenaRunLengthChartProps) {
  if (!data.distributionData || data.distributionData.length === 0) {
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

  const transformedData = transformDataForChart(data);
  const chartConfig = createChartConfig(data);

  if (transformedData.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-[#FAF7F3] rounded-lg border border-[#D4B5A0]">
        <p className="text-[#8B7355] font-semibold">Unable to render chart</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-[500px]">
      <RechartsPrimitive.BarChart
        data={transformedData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <RechartsPrimitive.CartesianGrid
          strokeDasharray="3 3"
          stroke="#D4B5A0"
          vertical={true}
        />
        <RechartsPrimitive.XAxis
          dataKey="rounds"
          label={{
            value: 'Game Length (Rounds Played)',
            position: 'insideBottomRight',
            offset: -5,
            fill: '#8B7355',
            fontSize: 12,
            fontWeight: 500,
          }}
          tick={{ fill: '#8B7355', fontSize: 12 }}
        />
        <RechartsPrimitive.YAxis
          label={{
            value: 'Number of Games',
            angle: -90,
            position: 'insideLeft',
            fill: '#8B7355',
            fontSize: 12,
            fontWeight: 500,
          }}
          tick={{ fill: '#8B7355', fontSize: 12 }}
        />
        <ChartTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 181, 160, 0.1)' }} />
        <ChartLegend
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="square"
          verticalAlign="bottom"
          height={40}
        />

        {/* Render bars for each model's wins and losses */}
        {data.distributionData.map((model, modelIndex) => (
          <React.Fragment key={model.modelSlug}>
            {/* Wins bar */}
            <RechartsPrimitive.Bar
              dataKey={`${model.modelSlug}-wins`}
              stackId={model.modelSlug}
              fill={WIN_COLORS[modelIndex % WIN_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
            {/* Losses bar */}
            <RechartsPrimitive.Bar
              dataKey={`${model.modelSlug}-losses`}
              stackId={model.modelSlug}
              fill={LOSS_COLORS[modelIndex % LOSS_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
          </React.Fragment>
        ))}
      </RechartsPrimitive.BarChart>
    </ChartContainer>
  );
}
