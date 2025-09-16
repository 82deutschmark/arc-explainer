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
  const { data: leaderboardData } = useModelLeaderboards();

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
        if (leaderboardData?.accuracyLeaderboard) {
          return leaderboardData.accuracyLeaderboard.find(
            model => model.modelName === modelName
          );
        }
        return undefined;
      };

      // Enhance vote result with additional data for modal
      enhanceVoteResult(basicResult, {
        correctAnswerGrid: comparisonData.puzzle.test[0].output,
        predictionA: comparisonData.explanationA.predictedOutputGrid || [],
        predictionB: comparisonData.explanationB.predictedOutputGrid || [],
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
      <div className="container mx-auto p-6 max-w-7xl">
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
      <div className="container mx-auto p-6 max-w-7xl">
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
    <div className="container mx-auto p-3 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Compare Explanations
            {comparisonData.puzzleId && (
              <Badge variant="outline" className="ml-2">
                Puzzle {comparisonData.puzzleId}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600">
            As of September 2025, state of the art LLMs will still very confidently assert 
            that they understand the puzzle, even when they don't. They will tell you something that
            sounds smart, but is actually wrong. 
            <br />
            <br />
            This is where you come in. Can you tell the difference between 
            correct and incorrect explanations? 
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/elo/leaderboard">
            <Button variant="outline" size="sm">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
          
          {/* Search functionality */}
          <form onSubmit={handlePuzzleIdSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={inputPuzzleId}
              onChange={(e) => setInputPuzzleId(e.target.value)}
              placeholder="Enter puzzle ID..."
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!inputPuzzleId.trim()}>
              Search
            </Button>
          </form>
          
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/elo'}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Random Puzzle
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextComparison}>
            <RotateCcw className="h-4 w-4 mr-2" />
            New Comparison
          </Button>
        </div>
      </div>

      {/* Puzzle Display - Answer Hidden */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Puzzle Pattern
          </CardTitle>
          <p className="text-sm text-gray-600">
            Study the examples to understand the pattern, then evaluate which explanation is better
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Training Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Training Examples
                <Badge variant="outline">{comparisonData.puzzle.train.length} examples</Badge>
              </h3>
              <div className="space-y-4">
                {comparisonData.puzzle.train.map((example: ARCExample, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-6">
                      <PuzzleGrid
                        grid={example.input}
                        title="This"
                        showEmojis={false}
                      />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid
                        grid={example.output}
                        title="gets turned into this!"
                        showEmojis={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case - Input + Predicted Outputs */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Test Question & AI Predictions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Test Input */}
                <div className="flex flex-col items-center">
                  <PuzzleGrid
                    grid={comparisonData.puzzle.test[0].input}
                    title="This gets turned into...?"
                    showEmojis={false}
                  />
                </div>
                
                {/* Prediction A */}
                <div className="flex flex-col items-center">
                  {comparisonData.explanationA.predictedOutputGrid ? (
                    <PuzzleGrid
                      grid={comparisonData.explanationA.predictedOutputGrid}
                      title="Prediction A"
                      showEmojis={false}
                    />
                  ) : (
                    <div className="p-4 border border-gray-300 rounded text-center text-gray-500">
                      No prediction available
                    </div>
                  )}
                </div>
                
                {/* Prediction B */}
                <div className="flex flex-col items-center">
                  {comparisonData.explanationB.predictedOutputGrid ? (
                    <PuzzleGrid
                      grid={comparisonData.explanationB.predictedOutputGrid}
                      title="Prediction B"
                      showEmojis={false}
                    />
                  ) : (
                    <div className="p-4 border border-gray-300 rounded text-center text-gray-500">
                      No prediction available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Explanation A */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Explanation A</h3>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              AI Model
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationA.modelName}
            result={comparisonData.explanationA}
            model={undefined} // We don't need model config for ELO mode
            testCases={comparisonData.puzzle.test}
            eloMode={true} // Hide model identifying info for double-blind A/B testing
          />
        </div>

        {/* Voting Interface */}
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            {votingState === 'ready' && (
              <div className="p-6 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                <div className="text-center">
                  <h4 className="font-semibold mb-2">Which explanation is better?</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Consider the clarity, accuracy, and helpfulness of each explanation
                  </p>
                  <div className="text-4xl mb-4">⚖️</div>
                </div>
                
                {/* Three-button voting interface */}
                <div className="space-y-3">
                  <Button
                    onClick={() => handleVote('A_WINS')}
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    <span className="text-base">👍 Explanation A is Better</span>
                  </Button>
                  
                  <Button
                    onClick={() => handleVote('BOTH_BAD')}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full border-red-300 text-red-700 hover:bg-red-50"
                    size="lg"
                  >
                    <span className="text-base">👎 Both Are Bad</span>
                  </Button>
                  
                  <Button
                    onClick={() => handleVote('B_WINS')}
                    disabled={isSubmitting}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    size="lg"
                  >
                    <span className="text-base">👍 Explanation B is Better</span>
                  </Button>
                </div>
              </div>
            )}

            {votingState === 'submitting' && (
              <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-blue-700">Recording your vote...</p>
              </div>
            )}

            {votingState === 'voted' && (
              <div className="p-6 border border-green-200 rounded-lg bg-green-50">
                <div className="text-2xl">✅</div>
                <h4 className="font-semibold text-green-800">Vote Recorded!</h4>
                <p className="text-sm text-green-700">Results will be displayed in a moment...</p>
              </div>
            )}

            {voteError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  Failed to record vote: {voteError.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Explanation B */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Explanation B</h3>
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              AI Model
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationB.modelName}
            result={comparisonData.explanationB}
            model={undefined}
            testCases={comparisonData.puzzle.test}
            eloMode={true} // Hide model identifying info for double-blind A/B testing
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