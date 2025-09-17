import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ExplanationData } from '@/types/puzzle';

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
  <div className="w-32 h-32 bg-gray-200 rounded animate-pulse" />
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
        <div className="border rounded bg-gray-50 border-gray-200">
          <div className="p-3">
            <h5 className="font-semibold text-gray-800 mb-3">AI Prediction</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <h6 className="font-medium text-center mb-2">Predicted Output</h6>
                <SkeletonGrid />
              </div>
              <div>
                <h6 className="font-medium text-center mb-2">Expected Output</h6>
                <SkeletonGrid />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Single prediction display */}
      {predictedGrid && expectedOutputGrids.length === 1 && (
        <div className="border rounded bg-gray-50 border-gray-200">
          <button
            onClick={() => setShowPrediction(!showPrediction)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
          >
            <h5 className="font-semibold text-gray-800">AI Prediction</h5>
            {showPrediction ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </button>
          {showPrediction && (
            <div className={`p-3 grid grid-cols-1 ${eloMode ? '' : 'md:grid-cols-2'} gap-4 items-start`}>
              <div>
                <h6 className="font-medium text-center mb-1">Predicted Output</h6>
                <PuzzleGrid grid={predictedGrid} diffMask={showDiff ? diffMask : undefined} title="Predicted Output" showEmojis={false} />
              </div>
              {!eloMode && (
                <div>
                  <h6 className="font-medium text-center mb-1">Expected Output</h6>
                  <PuzzleGrid grid={expectedOutputGrids[0]} title="Expected Output" showEmojis={false} />
                </div>
              )}
              {!eloMode && (
                <div className="md:col-span-2">
                  <Button onClick={() => setShowDiff(!showDiff)} variant="outline" size="sm">
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
        <div className="border rounded bg-gray-50 border-gray-200">
          <button
            onClick={() => setShowMultiTest(!showMultiTest)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="font-semibold text-gray-800">Multi-Test Results ({predictedGrids?.length || 0} predictions, {expectedOutputGrids.length} tests{multiTestStats.totalCount > 0 ? ` • ${multiTestStats.correctCount}/${multiTestStats.totalCount} correct` : ''})</h5>
              {!eloMode && (result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined || multiTestStats.totalCount > 0) && (
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1 text-xs ${multiTestStats.accuracyLevel === 'all_correct' || (!multiTestStats.totalCount && (result.multiTestAllCorrect ?? result.allPredictionsCorrect)) ? 'bg-green-50 border-green-200 text-green-700' : multiTestStats.accuracyLevel === 'all_incorrect' ? 'bg-red-50 border-red-200 text-red-700' : multiTestStats.accuracyLevel === 'some_incorrect' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {(() => {
                    const isAllCorrect = multiTestStats.accuracyLevel === 'all_correct' || (!multiTestStats.totalCount && (result.multiTestAllCorrect ?? result.allPredictionsCorrect));
                    if (isAllCorrect) return <CheckCircle className="h-3 w-3" />;
                    return <XCircle className="h-3 w-3" />;
                  })()}
                  {(() => {
                    if (multiTestStats.totalCount > 0) {
                      switch (multiTestStats.accuracyLevel) {
                        case 'all_correct': return 'All Correct';
                        case 'all_incorrect': return 'All Incorrect';
                        case 'some_incorrect': return 'Some Incorrect';
                      }
                    }
                    return (result.multiTestAllCorrect ?? result.allPredictionsCorrect) ? 'All Correct' : 'Some Incorrect';
                  })()}
                </Badge>
              )}
            </div>
            {showMultiTest ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showMultiTest && (
            <div className="p-3 space-y-4">
              {!eloMode && (
                <div className="md:col-span-2">
                  <Button onClick={() => setShowDiff(!showDiff)} variant="outline" size="sm">
                    {showDiff ? 'Hide' : 'Show'} Mismatches
                  </Button>
                </div>
              )}
              {expectedOutputGrids.map((expectedGrid, index) => (
                <div key={index} className={`grid grid-cols-1 ${eloMode ? '' : 'md:grid-cols-2'} gap-4 items-start border-t pt-4 first:border-t-0 first:pt-0`}>
                  <div>
                    <h6 className="font-medium text-center mb-1">Predicted Output {index + 1}</h6>
                    {predictedGrids && predictedGrids[index] ? (
                      <PuzzleGrid
                        grid={predictedGrids[index]}
                        title={`Predicted Output ${index + 1}`}
                        showEmojis={false}
                        diffMask={showDiff && multiDiffMasks ? multiDiffMasks[index] : undefined}
                      />
                    ) : (
                      <div className="text-center text-gray-500 italic">No prediction</div>
                    )}
                  </div>
                  {!eloMode && (
                    <div>
                      <h6 className="font-medium text-center mb-1">Expected Output {index + 1}</h6>
                      <PuzzleGrid
                        grid={expectedGrid}
                        title={`Expected Output ${index + 1}`}
                        showEmojis={false}
                        diffMask={showDiff && multiDiffMasks ? multiDiffMasks[index] : undefined}
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
