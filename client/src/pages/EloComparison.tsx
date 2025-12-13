/**
 * EloComparison.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-16
 * PURPOSE: LMArena-style explanation comparison page where users vote on explanation quality
 * SRP and DRY check: Pass - Reuses existing PuzzleGrid and AnalysisResultCard components,
 * only adds voting logic. Follows established page patterns from PuzzleExaminer.
 *
 * ARCHITECTURE:
 * - Reuses PuzzleGrid for puzzle display (answer hidden)
 * - Reuses AnalysisResultCard with eloMode prop to hide model identifying info
 * - Minimal new code - just voting interface and session management
 * - Follows established hook patterns and API integration
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, ArrowRight, RotateCcw, Star, Trophy } from 'lucide-react';

// Reuse existing components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { EloVoteResultsModal } from '@/components/elo/EloVoteResultsModal';
import { FeaturedPuzzlesEloEntry } from '@/components/elo/FeaturedPuzzlesEloEntry';

// Hooks for comparison functionality
import { useEloComparison } from '@/hooks/useEloComparison';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';

// Types
import type { ARCExample } from '@shared/types';
import { ComparisonOutcome } from '../../../shared/types';
import { useEloVoting, EnhancedVoteResponse } from '@/hooks/useEloVoting';


export default function EloComparison() {
  const { taskId } = useParams<{ taskId?: string }>();
  const finalPuzzleId = taskId;
  const [inputPuzzleId, setInputPuzzleId] = useState('');

  // Set page title
  React.useEffect(() => {
    document.title = finalPuzzleId ? `Compare Explanations - Puzzle ${finalPuzzleId}` : 'Compare Explanations';
  }, [finalPuzzleId]);

  // State for voting interface
  const [votingState, setVotingState] = useState<'ready' | 'submitting' | 'voted'>('ready');
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [currentOutcome, setCurrentOutcome] = useState<ComparisonOutcome | null>(null);

  // Always fetch comparison data - random if no puzzle ID, specific if provided
  const {
    comparisonData,
    isLoading,
    error,
    refetch,
    sessionId
  } = useEloComparison(finalPuzzleId); // Pass puzzleId or undefined for random

  const {
    submitVote,
    isSubmitting,
    voteError,
    voteResult,
    enhanceVoteResult
  } = useEloVoting();

  // Fetch model accuracy data for results modal
  const { accuracyStats: leaderboardData } = useModelLeaderboards();

  // Handle vote submission
  const handleVote = async (outcome: 'A_WINS' | 'B_WINS' | 'BOTH_BAD') => {
    if (!comparisonData) return;

    try {
      setVotingState('submitting');
      setSelectedWinner(outcome === 'A_WINS' ? 'A' : outcome === 'B_WINS' ? 'B' : null);
      setCurrentOutcome(outcome);

      const basicResult = await submitVote({
        sessionId,
        explanationAId: comparisonData.explanationA.id,
        explanationBId: comparisonData.explanationB.id,
        outcome,
        puzzleId: comparisonData.puzzleId
      });

      // Get model accuracy data
      const getModelAccuracy = (modelName: string) => {
        if (leaderboardData?.modelAccuracyRankings) {
          return leaderboardData.modelAccuracyRankings.find(
            (model: any) => model.modelName === modelName
          );
        }
        return undefined;
      };

      // Enhance vote result with additional data for modal
      // Pass all test case outputs and predictions (or single if only one test case)
      const firstTestOutput = comparisonData.puzzle.test[0]?.output ?? [];
      const predictionsA = (comparisonData.explanationA.predictedOutputGrids || []).filter(
        (grid): grid is number[][] => Array.isArray(grid)
      );
      if (predictionsA.length === 0 && comparisonData.explanationA.predictedOutputGrid) {
        predictionsA.push(comparisonData.explanationA.predictedOutputGrid);
      }

      const predictionsB = (comparisonData.explanationB.predictedOutputGrids || []).filter(
        (grid): grid is number[][] => Array.isArray(grid)
      );
      if (predictionsB.length === 0 && comparisonData.explanationB.predictedOutputGrid) {
        predictionsB.push(comparisonData.explanationB.predictedOutputGrid);
      }

      enhanceVoteResult(basicResult, {
        correctAnswerGrid: firstTestOutput,
        predictionA: predictionsA[0] || [],
        predictionB: predictionsB[0] || [],
        modelA: {
          name: comparisonData.explanationA.modelName,
          accuracy: getModelAccuracy(comparisonData.explanationA.modelName)
        },
        modelB: {
          name: comparisonData.explanationB.modelName,
          accuracy: getModelAccuracy(comparisonData.explanationB.modelName)
        },
        outcome
      });

      setVotingState('voted');
      setShowResultsModal(true);
    } catch (error) {
      setVotingState('ready');
      setSelectedWinner(null);
      setCurrentOutcome(null);
    }
  };

  // Handle getting next comparison
  const handleNextComparison = () => {
    setVotingState('ready');
    setSelectedWinner(null);
    setShowResultsModal(false);
    setCurrentOutcome(null);
    refetch();
  };

  const handlePuzzleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPuzzleId.trim()) {
      window.location.href = `/elo/${inputPuzzleId.trim()}`;
    }
  };

  // Auto-load random puzzle, but still handle loading states
  // Search functionality will be available in the main interface

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading comparison...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !comparisonData) {
    return (
      <div className="mx-auto">
        <Alert>
          <AlertDescription>
            {error?.message || 'Failed to load comparison. Please try again.'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-8">
      {/* Header - Strong Visual Hierarchy */}
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-10 w-10 text-blue-600" />
            <div>
              <h1 className="text-4xl font-bold">Compare Explanations</h1>
              {comparisonData.puzzleId && (
                <Badge variant="outline" className="mt-1">
                  Puzzle {comparisonData.puzzleId}
                </Badge>
              )}
            </div>
          </div>

          {/* Utility buttons - less prominent */}
          <div className="flex items-center gap-2">
            <FeaturedPuzzlesEloEntry />
            <Link href="/elo/leaderboard">
              <Button variant="outline" size="sm">
                <Trophy className="h-4 w-4 mr-2" />
                Leaderboard
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleNextComparison}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Next
            </Button>
          </div>
        </div>

        {/* Hook - Clear, Scannable Message */}
        <div className="text-center py-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-100">
          <h2 className="text-3xl font-bold text-blue-700 mb-3">
            Can you spot slop?
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            State-of-the-art LLMs confidently claim they understand puzzles—even when they don't.
          </p>
        </div>

        {/* Instructions - Collapsible/Scannable */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-base">
            <strong className="text-blue-900">Your task:</strong> Study the training examples below, then decide which AI explanation is better.
            Look for clarity, accuracy, and whether the model truly understands the pattern.
          </AlertDescription>
        </Alert>

        {/* Search functionality - subtle */}
        <form onSubmit={handlePuzzleIdSubmit} className="flex items-center justify-center gap-2">
          <input
            type="text"
            value={inputPuzzleId}
            onChange={(e) => setInputPuzzleId(e.target.value)}
            placeholder="Jump to puzzle ID..."
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!inputPuzzleId.trim()}>
            Go
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/elo'}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Random
          </Button>
        </form>
      </div>

      {/* Training Examples - Properly Grouped Cards */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Training Examples
          </h2>
          <p className="text-gray-600">
            Study these {comparisonData.puzzle.train.length} examples to understand the pattern
          </p>
        </div>

        <div className="grid gap-6">
          {comparisonData.puzzle.train.map((example: ARCExample, index: number) => (
            <Card key={index} className="bg-gradient-to-br from-gray-50 to-blue-50/30 border-2">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <Badge variant="secondary" className="text-base px-4 py-1">
                    Example {index + 1}
                  </Badge>
                </div>
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <div className="text-center">
                    <PuzzleGrid
                      grid={example.input}
                      title={`Input (${example.input[0]?.length || 0}×${example.input.length || 0})`}
                      showEmojis={false}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRight className="h-8 w-8 text-blue-500" />
                    <span className="text-sm font-medium text-gray-600">transforms to</span>
                  </div>
                  <div className="text-center">
                    <PuzzleGrid
                      grid={example.output}
                      title={`Output (${example.output[0]?.length || 0}×${example.output.length || 0})`}
                      showEmojis={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Test Questions & AI Predictions - Handle Multiple Tests */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {comparisonData.puzzle.test.length > 1 ? 'Test Questions' : 'Test Question'}
          </h2>
          <p className="text-gray-600">
            {comparisonData.puzzle.test.length > 1
              ? `This puzzle has ${comparisonData.puzzle.test.length} test cases. Here's what each AI predicted for each one.`
              : "Here's the test input and what each AI predicted as the output"
            }
          </p>
        </div>

        {comparisonData.puzzle.test.map((testCase: ARCExample, testIndex: number) => {
          // Extract predictions for this test case
          const getPredictionForTest = (explanation: any, testIdx: number) => {
            // Check for multi-test predictions first
            if (explanation.multiplePredictedOutputs) {
              // Try JSONB object format: {predictedOutput1: [[...]], predictedOutput2: [[...]]}
              if (typeof explanation.multiplePredictedOutputs === 'object' && !Array.isArray(explanation.multiplePredictedOutputs)) {
                const key = `predictedOutput${testIdx + 1}`;
                if (explanation.multiplePredictedOutputs[key]) {
                  return explanation.multiplePredictedOutputs[key];
                }
              }
              // Try array format: [[[...]], [[...]]]
              if (Array.isArray(explanation.multiplePredictedOutputs) && explanation.multiplePredictedOutputs[testIdx]) {
                return explanation.multiplePredictedOutputs[testIdx];
              }
            }
            // Check multiTestPredictionGrids array
            if (explanation.multiTestPredictionGrids && Array.isArray(explanation.multiTestPredictionGrids)) {
              if (explanation.multiTestPredictionGrids[testIdx]) {
                return explanation.multiTestPredictionGrids[testIdx];
              }
            }
            // Fallback to single prediction (only valid for single test case)
            if (testIdx === 0 && explanation.predictedOutputGrid) {
              return explanation.predictedOutputGrid;
            }
            return null;
          };

          const predictionA = getPredictionForTest(comparisonData.explanationA, testIndex);
          const predictionB = getPredictionForTest(comparisonData.explanationB, testIndex);

          return (
            <Card key={testIndex} className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/30 to-pink-50/30">
              <CardContent className="p-8">
                {comparisonData.puzzle.test.length > 1 && (
                  <div className="text-center mb-6">
                    <Badge className="bg-purple-700 text-white text-lg px-4 py-1">
                      Test Case {testIndex + 1} of {comparisonData.puzzle.test.length}
                    </Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Test Input */}
                  <div className="flex flex-col items-center">
                    <div className="mb-4">
                      <Badge className="bg-gray-700 text-white text-sm px-3 py-1">
                        Test Input
                      </Badge>
                    </div>
                    <PuzzleGrid
                      grid={testCase.input}
                      title={`${testCase.input[0]?.length || 0}×${testCase.input.length || 0} grid`}
                      showEmojis={false}
                    />
                    <p className="mt-3 text-sm text-gray-600 font-medium">What does this become?</p>
                  </div>

                  {/* Prediction A */}
                  <div className="flex flex-col items-center">
                    <div className="mb-4">
                      <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                        AI Prediction A
                      </Badge>
                    </div>
                    {predictionA ? (
                      <PuzzleGrid
                        grid={predictionA}
                        title={`${predictionA[0]?.length || 0}×${predictionA.length || 0} grid`}
                        showEmojis={false}
                      />
                    ) : (
                      <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 bg-white">
                        No prediction available
                      </div>
                    )}
                  </div>

                  {/* Prediction B */}
                  <div className="flex flex-col items-center">
                    <div className="mb-4">
                      <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                        AI Prediction B
                      </Badge>
                    </div>
                    {predictionB ? (
                      <PuzzleGrid
                        grid={predictionB}
                        title={`${predictionB[0]?.length || 0}×${predictionB.length || 0} grid`}
                        showEmojis={false}
                      />
                    ) : (
                      <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 bg-white">
                        No prediction available
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* NOW IT'S YOUR TURN - Clear Call to Action */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">Now It's Your Turn</h2>
          <p className="text-lg text-gray-600">
            Read both AI explanations, then vote for which one is better
          </p>
        </div>

        {/* Voting Interface - THE STAR OF THE SHOW */}
        <Card className="border-4 border-blue-400 shadow-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <CardContent className="p-10">
            {votingState === 'ready' && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="text-6xl mb-4">⚖️</div>
                  <h3 className="text-2xl font-bold mb-3">Which explanation is better?</h3>
                  <p className="text-gray-600 text-base max-w-2xl mx-auto">
                    Consider clarity, accuracy, and whether the AI truly understands the pattern
                  </p>
                </div>

                {/* Three-button voting interface - PROMINENT */}
                <div className="space-y-4 max-w-xl mx-auto">
                  <Button
                    onClick={() => handleVote('A_WINS')}
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-semibold"
                  >
                    👍 Explanation A is Better
                  </Button>

                  <Button
                    onClick={() => handleVote('BOTH_BAD')}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full border-2 border-red-400 text-red-700 hover:bg-red-50 shadow-md hover:shadow-lg transition-all py-6 text-lg font-semibold"
                  >
                    👎 Both Are Bad
                  </Button>

                  <Button
                    onClick={() => handleVote('B_WINS')}
                    disabled={isSubmitting}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-semibold"
                  >
                    👍 Explanation B is Better
                  </Button>
                </div>
              </div>
            )}

            {votingState === 'submitting' && (
              <div className="py-12 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-lg text-blue-700 font-medium">Recording your vote...</p>
              </div>
            )}

            {votingState === 'voted' && (
              <div className="py-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h4 className="text-2xl font-bold text-green-800 mb-2">Vote Recorded!</h4>
                <p className="text-lg text-green-700">Results will be displayed in a moment...</p>
              </div>
            )}

            {voteError && (
              <Alert className="border-red-400 bg-red-50">
                <AlertDescription className="text-red-800 text-base">
                  Failed to record vote: {voteError.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Explanations Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Explanation A */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 bg-blue-100 py-3 rounded-lg">
            <h3 className="text-xl font-bold text-blue-900">Explanation A</h3>
            <Badge className="bg-blue-600 text-white">
              AI Model
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationA.modelName}
            result={comparisonData.explanationA}
            model={undefined}
            testCases={comparisonData.puzzle.test}
            eloMode={true}
          />
        </div>

        {/* Explanation B */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 bg-purple-100 py-3 rounded-lg">
            <h3 className="text-xl font-bold text-purple-900">Explanation B</h3>
            <Badge className="bg-purple-600 text-white">
              AI Model
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationB.modelName}
            result={comparisonData.explanationB}
            model={undefined}
            testCases={comparisonData.puzzle.test}
            eloMode={true}
          />
        </div>
      </div>

      {/* Vote Results Modal */}
      {voteResult && currentOutcome && (
        <EloVoteResultsModal
          isOpen={showResultsModal}
          onClose={() => setShowResultsModal(false)}
          onContinue={handleNextComparison}
          voteResult={voteResult}
          outcome={currentOutcome}
          correctAnswerGrid={voteResult.correctAnswerGrid || []}
          predictionA={voteResult.predictionA || []}
          predictionB={voteResult.predictionB || []}
          modelA={voteResult.modelA || { name: 'Model A' }}
          modelB={voteResult.modelB || { name: 'Model B' }}
        />
      )}
    </div>
  );
}
