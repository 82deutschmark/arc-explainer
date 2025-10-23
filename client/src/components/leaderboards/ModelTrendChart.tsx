/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Visualizes top model accuracy trends using AccuracyRepository rankings to quickly
 *          compare single vs multi-test performance.
 * SRP/DRY check: Pass — purely handles accuracy trend visualization for leaderboards page.
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AccuracyModelRanking } from '@/types/leaderboards';
import { LEADERBOARD_LIMITS } from '@/constants/leaderboard';

interface ModelTrendChartProps {
  accuracyModels: AccuracyModelRanking[];
  isLoading: boolean;
}

const chartConfig = {
  single: {
    label: 'Single test accuracy',
    color: 'hsl(var(--chart-1))'
  },
  multi: {
    label: 'Multi test accuracy',
    color: 'hsl(var(--chart-2))'
  }
} as const;

export function ModelTrendChart({ accuracyModels, isLoading }: ModelTrendChartProps) {
  const data = useMemo(() => {
    return accuracyModels.slice(0, LEADERBOARD_LIMITS.TOP_MODELS).map(model => ({
      model: model.modelName,
      single: Number(model.singleTestAccuracy?.toFixed(1) ?? 0),
      multi: Number(model.multiTestAccuracy?.toFixed(1) ?? 0),
    }));
  }, [accuracyModels]);

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow h-full">
        <div className="card-body">
          <h2 className="card-title text-lg">Accuracy Trend</h2>
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-base-200" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card bg-base-100 shadow h-full">
        <div className="card-body">
          <h2 className="card-title text-lg">Accuracy Trend</h2>
          <p className="text-sm text-base-content/70">
            Need additional solver attempts before AccuracyRepository can plot trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title text-lg">Accuracy Trend</h2>
        <p className="text-sm text-base-content/70">
          Real AccuracyRepository outputs comparing single-shot vs multi-test success rates.
        </p>
        <div className="mt-4">
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="model" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="single" fill="var(--color-single)" radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="multi" fill="var(--color-multi)" radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

