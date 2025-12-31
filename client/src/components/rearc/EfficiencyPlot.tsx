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

import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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
  const plotData: PlotDataPoint[] = data.map(d => ({
    x: d.elapsedMs / 1000 / 60, // Convert to minutes for display
    y: d.score * 100,           // Convert to percentage
    name: d.solverName,
    tasksSolved: d.tasksSolved,
    solvedPairs: d.solvedPairs,
    totalPairs: d.totalPairs,
  }));

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
            label={{
              value: 'Elapsed Time (minutes)',
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
            domain={[0, 100]}
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
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
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

      {/* Interpretation guide */}
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div className="border border-border rounded-lg p-3">
          <p className="font-semibold mb-1">Top-left (ideal)</p>
          <p className="text-muted-foreground">High score, fast time = efficient solver</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="font-semibold mb-1">Top-right</p>
          <p className="text-muted-foreground">High score, slow time = thorough but slow</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="font-semibold mb-1">Bottom-left</p>
          <p className="text-muted-foreground">Low score, fast time = quick but ineffective</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="font-semibold mb-1">Bottom-right</p>
          <p className="text-muted-foreground">Low score, slow time = struggling</p>
        </div>
      </div>
    </div>
  );
}
