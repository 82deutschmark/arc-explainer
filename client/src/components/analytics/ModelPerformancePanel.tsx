/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T22:30:00-04:00 (updated 2025-12-17)
 * PURPOSE: Reusable model performance panel component extracted from AnalyticsOverview.
 * Shows success rate, correct/incorrect/not attempted counts, badges, and puzzle IDs.
 * Used for side-by-side model comparison display.
 * 
 * SRP and DRY check: Pass - Single responsibility of displaying model performance stats
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge components
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { useModelDatasetPerformance, useModelDatasetMetrics } from '@/hooks/useModelDatasetPerformance';
import { Loader2 } from 'lucide-react';
import { getDatasetDisplayName } from '@/constants/datasets';

interface ModelPerformancePanelProps {
  modelName: string;
  dataset: string;
}

export const ModelPerformancePanel: React.FC<ModelPerformancePanelProps> = ({
  modelName,
  dataset
}) => {
  const { performance, loading: loadingPerformance } = useModelDatasetPerformance(modelName, dataset);
  const { metrics } = useModelDatasetMetrics(modelName, dataset);

  if (loadingPerformance) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading {modelName}...</p>
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-sm text-muted-foreground">No data for {modelName}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Model & Dataset Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">{performance.modelName}</h2>
                <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">
                  {getDatasetDisplayName(performance.dataset, 'plain')}
                </span>
                <span className="text-sm text-gray-500">({performance.summary.totalPuzzles} puzzles)</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Attempted: <strong>{performance.summary.correct + performance.summary.incorrect}</strong> / {performance.summary.totalPuzzles}</span>
                <span className="text-gray-400">•</span>
                <span>Success Rate of Attempted: <strong className="text-green-700">
                  {performance.summary.correct + performance.summary.incorrect > 0
                    ? ((performance.summary.correct / (performance.summary.correct + performance.summary.incorrect)) * 100).toFixed(2)
                    : '0.00'}%
                </strong></span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-green-700">
                {((performance.summary.correct / performance.summary.totalPuzzles) * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-gray-600 font-medium">Overall Success</div>
              <div className="text-xs text-gray-500">{performance.summary.correct}/{performance.summary.totalPuzzles} correct</div>
            </div>
          </div>
          
          {/* Visual Progress Bar */}
          <div className="mt-3 space-y-1">
            <div className="flex h-6 rounded-md overflow-hidden shadow-sm">
              {performance.summary.correct > 0 && (
                <div 
                  className="bg-green-500 flex items-center justify-center text-xs font-semibold text-white"
                  style={{ width: `${(performance.summary.correct / performance.summary.totalPuzzles) * 100}%` }}
                >
                  {performance.summary.correct > 0 && `${performance.summary.correct}`}
                </div>
              )}
              {performance.summary.incorrect > 0 && (
                <div 
                  className="bg-red-500 flex items-center justify-center text-xs font-semibold text-white"
                  style={{ width: `${(performance.summary.incorrect / performance.summary.totalPuzzles) * 100}%` }}
                >
                  {performance.summary.incorrect > 0 && `${performance.summary.incorrect}`}
                </div>
              )}
              {performance.summary.notAttempted > 0 && (
                <div 
                  className="bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700"
                  style={{ width: `${(performance.summary.notAttempted / performance.summary.totalPuzzles) * 100}%` }}
                >
                  {performance.summary.notAttempted > 0 && `${performance.summary.notAttempted}`}
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span>Correct</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span>Incorrect</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded-sm"></span>Not Attempted</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats with Metrics Badges */}
      <div className="grid grid-cols-1 gap-2">
        {/* Correct Card */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-3xl font-bold text-green-700">{performance.summary.correct}</div>
                <div className="text-sm font-medium text-green-600">Correct</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {((performance.summary.correct / performance.summary.totalPuzzles) * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-green-500">of total</div>
              </div>
            </div>
            {metrics && metrics.correct.count > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {metrics.correct.avgCost > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                    💰 ${metrics.correct.avgCost.toFixed(4)} avg
                  </Badge>
                )}
                {metrics.correct.avgTime > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                    ⏱️ {(metrics.correct.avgTime / 1000).toFixed(2)}s avg
                  </Badge>
                )}
                {metrics.correct.avgTokens > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                    🔤 {Math.round(metrics.correct.avgTokens).toLocaleString()} tok
                  </Badge>
                )}
              </div>
            )}
            {/* Puzzle IDs */}
            {performance.correct && performance.correct.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-green-700">✅ Correct ({performance.correct.length})</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {performance.correct.map((puzzleId: string) => (
                    <ClickablePuzzleBadge
                      key={puzzleId}
                      puzzleId={puzzleId}
                      clickable={true}
                      showName={false}
                      className="text-xs bg-green-100 text-green-800 hover:bg-green-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Incorrect Card */}
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-3xl font-bold text-red-700">{performance.summary.incorrect}</div>
                <div className="text-sm font-medium text-red-600">Incorrect</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-red-600">
                  {((performance.summary.incorrect / performance.summary.totalPuzzles) * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-red-500">of total</div>
              </div>
            </div>
            {metrics && metrics.incorrect.count > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {metrics.incorrect.avgCost > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                    💰 ${metrics.incorrect.avgCost.toFixed(4)} avg
                  </Badge>
                )}
                {metrics.incorrect.avgTime > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                    ⏱️ {(metrics.incorrect.avgTime / 1000).toFixed(2)}s avg
                  </Badge>
                )}
                {metrics.incorrect.avgTokens > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                    🔤 {Math.round(metrics.incorrect.avgTokens).toLocaleString()} tok
                  </Badge>
                )}
              </div>
            )}
            {/* Puzzle IDs */}
            {performance.incorrect && performance.incorrect.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-red-700">❌ Incorrect ({performance.incorrect.length})</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {performance.incorrect.map((puzzleId: string) => (
                    <ClickablePuzzleBadge
                      key={puzzleId}
                      puzzleId={puzzleId}
                      clickable={true}
                      showName={false}
                      className="text-xs bg-red-100 text-red-800 hover:bg-red-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Not Attempted Card */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-3xl font-bold text-gray-700">{performance.summary.notAttempted}</div>
                <div className="text-sm font-medium text-gray-600">Not Attempted</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-600">
                  {((performance.summary.notAttempted / performance.summary.totalPuzzles) * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">of total</div>
              </div>
            </div>
            {/* Puzzle IDs */}
            {performance.notAttempted && performance.notAttempted.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700">⏸️ Not Attempted ({performance.notAttempted.length})</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {performance.notAttempted.map((puzzleId: string) => (
                    <ClickablePuzzleBadge
                      key={puzzleId}
                      puzzleId={puzzleId}
                      clickable={true}
                      showName={false}
                      className="text-xs bg-gray-100 text-gray-800 hover:bg-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
