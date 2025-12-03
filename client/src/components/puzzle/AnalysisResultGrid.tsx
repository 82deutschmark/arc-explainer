/**
 * AnalysisResultGrid.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:46:00Z
 * PURPOSE: Displays predicted output grids alongside expected outputs for both single-test
 * and multi-test puzzles. Shows correctness badges, grid comparisons, and diff highlighting.
 * FIXED: Removed multiTestAverageAccuracy check in fallback logic - now uses ONLY multiTestAllCorrect flag.
 * Displays "Incorrect" (not "Some Incorrect") when we can't determine exact count without validation data.
 * Handles optimistic UI states with skeleton loaders during analysis/saving.
 * UPDATED (2025-10-22T00:00:00Z) by gpt-5-codex: Restored September's warm honeyglass panels, apricot hover states,
 * and jewel-toned badges so nested grids inherit the aurora glow from AnalysisResultCard.
 * SRP/DRY check: Pass - Single responsibility (grid display), reuses PuzzleGrid component
 * shadcn/ui: Pass - Uses shadcn Badge/Button components
 */

import React from 'react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ExplanationData } from '@/types/puzzle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AnalysisResultGridProps {
  result: ExplanationData;
  expectedOutputGrids: number[][][];
  predictedGrid?: number[][];
  predictedGrids?: number[][][];
  multiValidation: any;
  multiTestStats: { correctCount: number; totalCount: number; accuracyLevel: string; };
  diffMask?: boolean[][];
  multiDiffMasks?: (boolean[][] | undefined)[];
  showDiff: boolean;
  setShowDiff: (show: boolean) => void;
  showMultiTest: boolean;
  setShowMultiTest: (show: boolean) => void;
  showPrediction: boolean;
  setShowPrediction: (show: boolean) => void;
  eloMode?: boolean;
}

// Skeleton loader component
const SkeletonGrid = () => (
  <div className="h-32 w-32 animate-pulse rounded-xl bg-gradient-to-br from-amber-200/70 via-rose-200/60 to-sky-200/60 shadow-[inset_0_8px_20px_-16px_rgba(146,64,14,0.45)] dark:from-violet-900/60 dark:via-slate-900/50 dark:to-emerald-900/50" />
);

export const AnalysisResultGrid: React.FC<AnalysisResultGridProps> = ({
  result,
  expectedOutputGrids,
  predictedGrid,
  predictedGrids,
  multiValidation,
  multiTestStats,
  diffMask,
  multiDiffMasks,
  showDiff,
  setShowDiff,
  showMultiTest,
  setShowMultiTest,
  showPrediction,
  setShowPrediction,
  eloMode = false
}) => {
  const isOptimistic = result.isOptimistic;
  const status = result.status;
  
  // Show skeleton loader for prediction grid when analyzing or saving
  if (isOptimistic && (status === 'analyzing' || status === 'saving')) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.8),_rgba(255,237,213,0.7))] px-4 py-4 shadow-[inset_0_18px_38px_-32px_rgba(146,64,14,0.5)] dark:border-violet-900/70 dark:bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.78),_rgba(76,29,149,0.55))]">
          <div className="pb-2">
            <h5 className="mb-3 font-semibold text-amber-900 dark:text-emerald-200">AI Prediction</h5>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              <div>
                <h6 className="mb-2 text-center font-medium text-amber-800 dark:text-emerald-200">Predicted Output</h6>
                <SkeletonGrid />
              </div>
              <div>
                <h6 className="mb-2 text-center font-medium text-amber-800 dark:text-emerald-200">Expected Output</h6>
                <SkeletonGrid />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Single prediction display */}
      {predictedGrid && expectedOutputGrids.length === 1 && (
        <div className="rounded-3xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.78),_rgba(255,237,213,0.7))] shadow-[inset_0_18px_38px_-32px_rgba(146,64,14,0.45)] dark:border-violet-900/70 dark:bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.78),_rgba(76,29,149,0.55))]">
            <button
              onClick={() => setShowPrediction(!showPrediction)}
              className="flex w-full items-center justify-between rounded-t-3xl px-4 py-3 text-left transition-colors hover:bg-amber-100/70 dark:hover:bg-violet-900/40"
            >
              <h5 className="text-sm font-semibold text-amber-900 dark:text-emerald-200">AI Prediction</h5>
              {showPrediction ? (
                <ChevronUp className="h-4 w-4 text-amber-600 dark:text-emerald-300" />
              ) : (
                <ChevronDown className="h-4 w-4 text-amber-600 dark:text-emerald-300" />
              )}
            </button>
          {showPrediction && (
            <div className={`grid grid-cols-1 items-start gap-3 px-4 pb-4 pt-3 ${eloMode ? '' : 'md:grid-cols-2'}`}>
              <div>
                <PuzzleGrid grid={predictedGrid} diffMask={showDiff ? diffMask : undefined} title="Predicted Output" showEmojis={false} />
              </div>
              {!eloMode && (
                <div>
                  <PuzzleGrid grid={expectedOutputGrids[0]} title="Expected Output" showEmojis={false} />
                </div>
              )}
              {!eloMode && (
                <div className="mt-1 md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300/70 bg-white/70 text-amber-800 hover:border-rose-300/70 hover:bg-rose-50/70 dark:border-violet-700/70 dark:bg-slate-900/50 dark:text-emerald-200 dark:hover:bg-violet-900/50"
                    onClick={() => setShowDiff(!showDiff)}
                  >
                    {showDiff ? 'Hide' : 'Show'} Mismatches
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Multi-test answer display */}
      {expectedOutputGrids.length > 1 && (
        <div className="rounded-3xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.78),_rgba(255,237,213,0.7))] shadow-[inset_0_18px_38px_-32px_rgba(146,64,14,0.45)] dark:border-violet-900/70 dark:bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.78),_rgba(76,29,149,0.55))]">
          <button
            onClick={() => setShowMultiTest(!showMultiTest)}
            className="flex w-full items-center justify-between rounded-t-3xl px-4 py-3 text-left transition-colors hover:bg-amber-100/70 dark:hover:bg-violet-900/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="text-sm font-semibold text-amber-900 dark:text-emerald-200">Multi-Test Results ({predictedGrids?.length || 0} predictions, {expectedOutputGrids.length} tests{multiTestStats.totalCount > 0 ? ` • ${multiTestStats.correctCount}/${multiTestStats.totalCount} correct` : ''})</h5>
              {!eloMode && (result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined || multiTestStats.totalCount > 0) && (
                <Badge
                  variant="outline"
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    multiTestStats.accuracyLevel === 'all_correct' || (!multiTestStats.totalCount && (result.multiTestAllCorrect ?? result.allPredictionsCorrect))
                      ? 'bg-emerald-100/80 border-emerald-200/70 text-emerald-800'
                      : multiTestStats.accuracyLevel === 'all_incorrect' || (!multiTestStats.totalCount && result.multiTestAverageAccuracy === 0)
                        ? 'bg-rose-100/80 border-rose-200/70 text-rose-800'
                        : multiTestStats.accuracyLevel === 'some_incorrect'
                          ? 'bg-amber-100/80 border-amber-200/70 text-amber-800'
                          : 'bg-rose-100/80 border-rose-200/70 text-rose-800',
                  )}
                >
                  {(() => {
                    const isAllCorrect = multiTestStats.accuracyLevel === 'all_correct' || (!multiTestStats.totalCount && (result.multiTestAllCorrect ?? result.allPredictionsCorrect));
                    if (isAllCorrect) return <CheckCircle className="h-3 w-3" />;
                    return <XCircle className="h-3 w-3" />;
                  })()}
                  {(() => {
                    if (multiTestStats.totalCount > 0) {
                      switch (multiTestStats.accuracyLevel) {
                        case 'all_correct': return 'All Correct';
                        case 'all_incorrect': return 'Incorrect';
                        case 'some_incorrect': return 'Some Incorrect';
                      }
                    }
                    // Fallback when multiTestStats is empty - use ONLY multiTestAllCorrect flag
                    if (result.multiTestAllCorrect ?? result.allPredictionsCorrect) {
                      return 'All Correct';
                    }
                    // When multiTestAllCorrect is false, we can't distinguish "all" vs "some" incorrect
                    // without detailed validation data, so just show "Incorrect"
                    return 'Incorrect';
                  })()}
                </Badge>
              )}
            </div>
            {showMultiTest ? (
              <ChevronUp className="h-4 w-4 text-amber-600 dark:text-emerald-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600 dark:text-emerald-300" />
            )}
          </button>
          {showMultiTest && (
            <div className="space-y-2 px-4 pb-4 pt-3">
                {!eloMode && (
                  <div className="mb-1 md:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-amber-300/70 bg-white/70 text-amber-800 hover:border-rose-300/70 hover:bg-rose-50/70 dark:border-violet-700/70 dark:bg-slate-900/50 dark:text-emerald-200 dark:hover:bg-violet-900/50"
                      onClick={() => setShowDiff(!showDiff)}
                    >
                      {showDiff ? 'Hide' : 'Show'} Mismatches
                    </Button>
                  </div>
                )}
              {expectedOutputGrids.map((expectedGrid, index) => (
                <div key={index} className={`grid grid-cols-1 items-start gap-3 border-t border-amber-100/70 pt-3 first:border-t-0 first:pt-0 dark:border-violet-900/60 ${eloMode ? '' : 'md:grid-cols-2'}`}>
                  <div>
                    {predictedGrids && predictedGrids[index] ? (
                      <PuzzleGrid
                        grid={predictedGrids[index]}
                        title={`Predicted Output ${index + 1}`}
                        showEmojis={false}
                        diffMask={showDiff && multiDiffMasks ? multiDiffMasks[index] : undefined}
                      />
                    ) : (
                      <div className="text-center text-xs italic text-amber-700 dark:text-emerald-300">No prediction</div>
                    )}
                  </div>
                  {!eloMode && (
                    <div>
                      <PuzzleGrid
                        grid={expectedGrid}
                        title={`Expected Output ${index + 1}`}
                        showEmojis={false}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
