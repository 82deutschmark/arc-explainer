/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Results section for the Hugging Face union-accuracy page.
 *          Renders the shared AttemptUnionCard plus union puzzle badges, progress bar, model badges,
 *          and optional cost metrics.
 * SRP/DRY check: Pass - Presentational result rendering only.
 */

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { DollarSign, Clock } from 'lucide-react';

import { AttemptUnionCard } from '@/components/analytics/AttemptUnionCard';
import { detectModelOrigin } from '@/utils/modelOriginDetection';
import { AttemptUnionStats } from '@/pages/AnalyticsOverview';
import { ModelDatasetMetrics } from '@/hooks/useModelDatasetPerformance';

export interface UnionAccuracyResultsProps {
  unionMetrics: AttemptUnionStats;
  unionPuzzleIds: string[];
  costMetrics: ModelDatasetMetrics | null;
}

export const UnionAccuracyResults: React.FC<UnionAccuracyResultsProps> = ({
  unionMetrics,
  unionPuzzleIds,
  costMetrics,
}) => {
  const totalPairsForDisplay = useMemo(() => {
    return (
      unionMetrics.datasetTotalTestPairs ??
      unionMetrics.totalTestPairs ??
      unionMetrics.datasetTotalPuzzles ??
      unionMetrics.totalPuzzles
    );
  }, [unionMetrics]);

  const pairWeightedAccuracyPercentage = useMemo(() => {
    const denom =
      unionMetrics.datasetTotalTestPairs ??
      unionMetrics.totalTestPairs ??
      unionMetrics.datasetTotalPuzzles ??
      unionMetrics.totalPuzzles;
    if (denom <= 0) return 0;
    return (unionMetrics.unionCorrectCount / denom) * 100;
  }, [unionMetrics]);

  return (
    <div className="space-y-2">
      <AttemptUnionCard metrics={unionMetrics} />

      {/* Union puzzle badges (preserves current behavior: puzzle-level correct in either attempt) */}
      {unionPuzzleIds.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-base">Puzzles solved ({unionPuzzleIds.length}) — click to explore</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex flex-wrap gap-1">
              {unionPuzzleIds.map((puzzleId) => (
                <ClickablePuzzleBadge
                  key={puzzleId}
                  puzzleId={puzzleId}
                  variant="success"
                  showName={true}
                  openInNewTab={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Progress Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <Progress value={pairWeightedAccuracyPercentage} className="h-2 mb-1" />
          <p className="text-base text-gray-700">
            <strong>{unionMetrics.unionCorrectCount}</strong> of <strong>{totalPairsForDisplay}</strong> test pairs solved (pair-weighted rate)
          </p>

          {/* Model Names with Origin Badge */}
          <div className="border-t border-gray-200 pt-2 flex flex-wrap gap-1 mt-2">
            <Badge variant={detectModelOrigin(unionMetrics.baseModelName).badgeVariant} className="text-base py-0.5">
              {detectModelOrigin(unionMetrics.baseModelName).shortLabel}
            </Badge>
            {unionMetrics.attemptModelNames.map((name) => (
              <Badge key={name} variant="outline" className="text-base py-0.5">
                {name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost & Performance Metrics */}
      {costMetrics && (
        <Card className="shadow-sm border-green-200 bg-green-50/30">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Cost & Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2 border border-green-100">
                <div className="text-xs text-gray-600 mb-1">Total Cost</div>
                <div className="text-lg font-bold text-gray-900">
                  ${costMetrics.overall.totalCost.toFixed(4)}
                </div>
              </div>
              <div className="bg-white rounded p-2 border border-green-100">
                <div className="text-xs text-gray-600 mb-1">Cost per Puzzle</div>
                <div className="text-lg font-bold text-gray-900">
                  ${costMetrics.overall.avgCost.toFixed(4)}
                </div>
              </div>
              <div className="bg-white rounded p-2 border border-green-100">
                <div className="text-xs text-gray-600 mb-1">Cost per Correct</div>
                <div className="text-lg font-bold text-green-700">
                  ${costMetrics.correct.avgCost.toFixed(4)}
                </div>
              </div>
              <div className="bg-white rounded p-2 border border-green-100">
                <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Avg Time
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {(costMetrics.overall.avgTime / 1000).toFixed(2)}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
