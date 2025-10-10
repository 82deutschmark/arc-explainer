/**
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Visualizes score evolution across iterations showing quantum search convergence.
 * SRP/DRY check: Pass
 * shadcn/ui: Pass - Uses Card
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { GroverIteration } from '@/hooks/useGroverProgress';

interface SearchVisualizationProps {
  iterations: GroverIteration[];
  currentIteration?: number;
}

export function SearchVisualization({ iterations, currentIteration }: SearchVisualizationProps) {
  if (iterations.length === 0) return null;

  const maxScore = 10;
  const width = 100; // percentage
  const height = 120; // pixels

  // Get all scores
  const allScores = iterations.flatMap(iter => 
    iter.executionResults.map(r => ({ iter: iter.iteration, score: r.score }))
  );

  const maxIter = Math.max(...iterations.map(i => i.iteration), currentIteration || 0);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
          <TrendingUp className="h-3 w-3" />
          Search Space
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <div className="relative" style={{ height: `${height}px` }}>
          <svg width="100%" height="100%" className="overflow-visible">
            {/* Y-axis labels */}
            {[0, 2.5, 5, 7.5, 10].map((val) => {
              const y = height - (val / maxScore) * height;
              return (
                <text
                  key={val}
                  x="5"
                  y={y + 3}
                  className="text-xs fill-gray-500"
                  fontSize="10"
                >
                  {val}
                </text>
              );
            })}

            {/* Grid lines */}
            {[0, 2.5, 5, 7.5, 10].map((val) => {
              const y = height - (val / maxScore) * height;
              return (
                <line
                  key={val}
                  x1="30"
                  y1={y}
                  x2="100%"
                  y2={y}
                  className="stroke-gray-200"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Data points */}
            {allScores.map((point, idx) => {
              const x = 30 + ((point.iter + 1) / (maxIter + 1)) * (width - 35) + '%';
              const y = height - (point.score / maxScore) * height;
              const isBest = iterations[point.iter]?.best?.score === point.score;
              
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r={isBest ? 4 : 2.5}
                  className={isBest ? 'fill-green-600' : 'fill-blue-500'}
                  opacity={isBest ? 1 : 0.6}
                />
              );
            })}

            {/* Best line */}
            {iterations.length > 1 && (
              <polyline
                points={iterations.map((iter, idx) => {
                  const x = 30 + ((iter.iteration + 1) / (maxIter + 1)) * (width - 35);
                  const y = height - (iter.best.score / maxScore) * height;
                  return `${x},${y}`;
                }).join(' ')}
                className="stroke-green-600"
                strokeWidth="2"
                fill="none"
              />
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 opacity-60"></div>
            <span>Programs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-600"></div>
            <span>Best per iteration</span>
          </div>
        </div>

        {/* Analysis */}
        {iterations.length > 1 && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
            <p className="text-gray-700">
              <strong>Convergence:</strong> Search is {
                iterations[iterations.length - 1].best.score > iterations[0].best.score
                  ? '↗️ improving'
                  : '→ stable'
              }
            </p>
            <p className="text-gray-600 mt-1">
              Amplitude amplification through context saturation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
