/**
 * EfficiencyPlot.tsx
 *
 * Author: Claude Sonnet 4.5
 * Date: 2025-12-31
 * PURPOSE: Scatter plot visualization for RE-ARC leaderboard showing score vs elapsed time.
 *          Helps identify efficiency patterns: fast+accurate vs slow+accurate vs struggling solvers.
 *          Uses recharts for interactive plotting with hover tooltips.
 * SRP/DRY check: Pass - Single responsibility: efficiency visualization
 */

import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface EfficiencyPlotProps {
  data: Array<{
    solverName: string;
    score: number;
    elapsedMs: number;
    tasksSolved: number;
    solvedPairs: number;
    totalPairs: number;
  }>;
}

interface PlotDataPoint {
  x: number; // Time in minutes
  y: number; // Score as percentage
  name: string;
  tasksSolved: number;
  solvedPairs: number;
  totalPairs: number;
}

export function EfficiencyPlot({ data }: EfficiencyPlotProps) {
  // Transform data for recharts
  const MIN_TIME_MINUTES = 5;

  const plotData: PlotDataPoint[] = data.map(d => ({
    x: Math.max(d.elapsedMs / 1000 / 60, MIN_TIME_MINUTES), // Convert to minutes, clamp to minimum
    y: d.score * 100,           // Convert to percentage
    name: d.solverName,
    tasksSolved: d.tasksSolved,
    solvedPairs: d.solvedPairs,
    totalPairs: d.totalPairs,
  }));

  // Calculate max score for dynamic Y-axis scaling
  const maxScore = Math.max(...plotData.map(p => p.y), 100);
  const yDomain = [0, Math.ceil(maxScore * 1.1)]; // 10% padding for headroom

  // Custom tooltip to show detailed submission info
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as PlotDataPoint;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-muted-foreground">Score: {data.y.toFixed(2)}%</p>
          <p className="text-muted-foreground">Time: {data.x.toFixed(1)} min</p>
          <p className="text-muted-foreground">Tasks: {data.tasksSolved}/120</p>
          <p className="text-muted-foreground">Pairs: {data.solvedPairs}/{data.totalPairs}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="number"
            dataKey="x"
            name="Time"
            unit=" min"
            scale="log"
            domain={[1, 10000]} // Log domain in minutes
            ticks={[5, 10, 30, 100, 300, 1000, 3000]}
            label={{
              value: 'Elapsed Time (minutes, log scale)',
              position: 'bottom',
              offset: 40,
              style: { fill: 'hsl(var(--muted-foreground))' }
            }}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Score"
            unit="%"
            domain={yDomain}
            label={{
              value: 'Score (%)',
              angle: -90,
              position: 'insideLeft',
              offset: -45,
              style: { fill: 'hsl(var(--muted-foreground))' }
            }}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            name="Submissions"
            data={plotData}
            fill="hsl(var(--primary))"
            fillOpacity={0.6}
            strokeWidth={2}
            stroke="hsl(var(--primary))"
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Elapsed Time Description */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Elapsed time:</span> Time between dataset generation and evaluation. Provides an upper bound on solving time.
          <br />
          <span className="font-semibold">Log scale:</span> The X-axis uses a logarithmic scale to handle the wide range of submission times. Submissions faster than 5 minutes are displayed at the 5-minute mark.
        </p>
      </div>
    </div>
  );
}
