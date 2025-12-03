/**
 * EloVoteResultsModal.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-16
 * PURPOSE: Modal displaying vote results and actual vs predicted outcomes for ELO system
 * SRP and DRY check: Pass - Single responsibility (vote result display), reuses existing components
 *
 * ARCHITECTURE:
 * - Reuses PuzzleGrid for displaying grids
 * - Shows factual data without condescending language
 * - Integrates with existing accuracy data from AccuracyRepository
 * - Modal UI using existing UI components
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface VoteResultData {
  newRatingA: number;
  newRatingB: number;
  ratingChangeA: number;
  ratingChangeB: number;
  voteRecorded: boolean;
}

interface ModelAccuracyData {
  modelName: string;
  accuracyPercentage: number;
  totalAttempts: number;
  correctPredictions: number;
}

interface EloVoteResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  voteResult: VoteResultData;
  outcome: 'A_WINS' | 'B_WINS' | 'BOTH_BAD';
  correctAnswerGrid: number[][] | number[][][];
  predictionA: number[][] | number[][][];
  predictionB: number[][] | number[][][];
  modelA: {
    name: string;
    accuracy?: ModelAccuracyData;
  };
  modelB: {
    name: string;
    accuracy?: ModelAccuracyData;
  };
}

export const EloVoteResultsModal: React.FC<EloVoteResultsModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  voteResult,
  outcome,
  correctAnswerGrid,
  predictionA,
  predictionB,
  modelA,
  modelB
}) => {
  // Handle both single grid (2D) and multiple grids (3D)
  const correctGrids = Array.isArray(correctAnswerGrid?.[0]?.[0])
    ? (correctAnswerGrid as number[][][])
    : ([correctAnswerGrid] as number[][][]);

  const gridsPredictionA = Array.isArray(predictionA?.[0]?.[0])
    ? (predictionA as number[][][])
    : ([predictionA] as number[][][]);

  const gridsPredictionB = Array.isArray(predictionB?.[0]?.[0])
    ? (predictionB as number[][][])
    : ([predictionB] as number[][][]);

  // Check if all predictions match all correct answers
  const isACorrect = gridsPredictionA.length === correctGrids.length &&
    gridsPredictionA.every((pred, i) =>
      JSON.stringify(pred) === JSON.stringify(correctGrids[i])
    );

  const isBCorrect = gridsPredictionB.length === correctGrids.length &&
    gridsPredictionB.every((pred, i) =>
      JSON.stringify(pred) === JSON.stringify(correctGrids[i])
    );

  const handleContinue = () => {
    onClose();
    onContinue();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Vote Recorded - Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vote Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Your Vote</h3>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${
                  outcome === 'A_WINS' ? 'bg-blue-50 text-blue-700' :
                  outcome === 'B_WINS' ? 'bg-purple-50 text-purple-700' :
                  'bg-red-50 text-red-700'
                }`}
              >
                {outcome === 'A_WINS' ? 'Model A Better' :
                 outcome === 'B_WINS' ? 'Model B Better' :
                 'Both Inadequate'}
              </Badge>
            </div>
          </div>

          {/* Actual vs Predicted Results */}
          <div>
            <h3 className="font-semibold mb-4">
              Actual vs Predicted Results {correctGrids.length > 1 && `(${correctGrids.length} test cases)`}
            </h3>
            <div className="space-y-6">
              {correctGrids.map((correctGrid, testIndex) => (
                <div key={testIndex} className="overflow-x-auto border-t pt-4">
                  {correctGrids.length > 1 && (
                    <h4 className="text-sm font-medium mb-3 text-gray-600">Test Case {testIndex + 1}</h4>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-fit">
                    {/* Correct Answer */}
                    <div className="text-center min-w-0 flex flex-col items-center">
                      <h4 className="font-medium mb-2">Correct Answer</h4>
                      <PuzzleGrid
                        grid={correctGrid}
                        title="Correct Output"
                        showEmojis={false}
                      />
                    </div>

                    {/* Prediction A */}
                    <div className="text-center min-w-0 flex flex-col items-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h4 className="font-medium">Model A Prediction</h4>
                        {gridsPredictionA[testIndex] && JSON.stringify(gridsPredictionA[testIndex]) === JSON.stringify(correctGrid) ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <PuzzleGrid
                        grid={gridsPredictionA[testIndex] || []}
                        title="Prediction A"
                        showEmojis={false}
                      />
                    </div>

                    {/* Prediction B */}
                    <div className="text-center min-w-0 flex flex-col items-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h4 className="font-medium">Model B Prediction</h4>
                        {gridsPredictionB[testIndex] && JSON.stringify(gridsPredictionB[testIndex]) === JSON.stringify(correctGrid) ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <PuzzleGrid
                        grid={gridsPredictionB[testIndex] || []}
                        title="Prediction B"
                        showEmojis={false}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Result Summary */}
            {correctGrids.length > 1 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Overall Results</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Model A</p>
                    <Badge className={`mt-1 ${isACorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isACorrect ? 'All Correct' : 'Some Incorrect'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Model B</p>
                    <Badge className={`mt-1 ${isBCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isBCorrect ? 'All Correct' : 'Some Incorrect'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model Performance Stats */}
          <div>
            <h3 className="font-semibold mb-4">Model Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Model A Stats */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900">Model A: {modelA.name}</h4>
                {modelA.accuracy ? (
                  <div className="mt-2 space-y-1 text-sm text-blue-800">
                    <p>Overall Accuracy: {modelA.accuracy.accuracyPercentage.toFixed(1)}%</p>
                    <p>Correct: {modelA.accuracy.correctPredictions}/{modelA.accuracy.totalAttempts}</p>
                    <p>ELO Change: {voteResult.ratingChangeA > 0 ? '+' : ''}{voteResult.ratingChangeA}</p>
                  </div>
                ) : (
                  <p className="text-sm text-blue-800 mt-2">Performance data not available</p>
                )}
              </div>

              {/* Model B Stats */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900">Model B: {modelB.name}</h4>
                {modelB.accuracy ? (
                  <div className="mt-2 space-y-1 text-sm text-purple-800">
                    <p>Overall Accuracy: {modelB.accuracy.accuracyPercentage.toFixed(1)}%</p>
                    <p>Correct: {modelB.accuracy.correctPredictions}/{modelB.accuracy.totalAttempts}</p>
                    <p>ELO Change: {voteResult.ratingChangeB > 0 ? '+' : ''}{voteResult.ratingChangeB}</p>
                  </div>
                ) : (
                  <p className="text-sm text-purple-800 mt-2">Performance data not available</p>
                )}
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-center pt-4 border-t">
            <Button onClick={handleContinue} className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Next Comparison
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};