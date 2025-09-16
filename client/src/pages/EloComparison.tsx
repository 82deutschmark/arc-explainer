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
 * - Reuses AnalysisResultCard with comparisonMode prop to hide correctness indicators
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

// Hooks for comparison functionality
import { useEloComparison } from '@/hooks/useEloComparison';

// Types
import type { ARCExample } from '@shared/types';
import { useEloVoting } from '@/hooks/useEloVoting';


export default function EloComparison() {
  const { taskId } = useParams<{ taskId?: string }>();
  const finalPuzzleId = taskId;

  // Set page title
  React.useEffect(() => {
    document.title = finalPuzzleId ? `Compare Explanations - Puzzle ${finalPuzzleId}` : 'Compare Explanations';
  }, [finalPuzzleId]);

  // State for voting interface
  const [votingState, setVotingState] = useState<'ready' | 'voting' | 'voted'>('ready');
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null);

  // Hooks for data and voting
  const {
    comparisonData,
    isLoading,
    error,
    refetch,
    sessionId
  } = useEloComparison(finalPuzzleId);

  const {
    submitVote,
    isSubmitting,
    voteError,
    voteResult
  } = useEloVoting();

  // Handle vote submission
  const handleVote = async (winner: 'A' | 'B') => {
    if (!comparisonData || votingState !== 'ready') return;

    setVotingState('voting');
    setSelectedWinner(winner);

    try {
      const winnerId = winner === 'A'
        ? comparisonData.explanationA.id
        : comparisonData.explanationB.id;

      await submitVote({
        sessionId,
        explanationAId: comparisonData.explanationA.id,
        explanationBId: comparisonData.explanationB.id,
        winnerId,
        puzzleId: comparisonData.puzzleId
      });

      setVotingState('voted');
    } catch (error) {
      setVotingState('ready');
      setSelectedWinner(null);
    }
  };

  // Handle getting next comparison
  const handleNextComparison = () => {
    setVotingState('ready');
    setSelectedWinner(null);
    refetch();
  };

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
            Vote for the better explanation - help improve AI understanding
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/elo/leaderboard">
            <Button variant="outline" size="sm">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
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
                        title="Input"
                        showEmojis={false}
                      />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid
                        grid={example.output}
                        title="Output"
                        showEmojis={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case - Input Only (Answer Hidden) */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Test Question</h3>
              <div className="flex items-center justify-center">
                <PuzzleGrid
                  grid={comparisonData.puzzle.test[0].input}
                  title="What should the output be?"
                  showEmojis={false}
                />
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
              Rating: {comparisonData.explanationA.eloRating.currentRating}
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationA.modelName}
            result={comparisonData.explanationA}
            model={undefined} // We don't need model config for comparison
            testCases={comparisonData.puzzle.test}
            comparisonMode={true} // Hide correctness indicators
          />
          {votingState === 'ready' && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleVote('A')}
              disabled={isSubmitting}
            >
              <span className="text-lg">👍 This explanation is better</span>
            </Button>
          )}
        </div>

        {/* Voting Interface */}
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            {votingState === 'ready' && (
              <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-semibold mb-2">Which explanation is better?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Consider the clarity, accuracy, and helpfulness of each explanation
                </p>
                <div className="text-4xl">⚖️</div>
              </div>
            )}

            {votingState === 'voting' && (
              <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-blue-700">Recording your vote...</p>
              </div>
            )}

            {votingState === 'voted' && voteResult && (
              <div className="p-6 border border-green-200 rounded-lg bg-green-50 space-y-3">
                <div className="text-2xl">✅</div>
                <h4 className="font-semibold text-green-800">Vote Recorded!</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Rating changes:</p>
                  <p>Explanation A: {voteResult.ratingChangeA > 0 ? '+' : ''}{voteResult.ratingChangeA}</p>
                  <p>Explanation B: {voteResult.ratingChangeB > 0 ? '+' : ''}{voteResult.ratingChangeB}</p>
                </div>
                <Button onClick={handleNextComparison} className="mt-3">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Next Comparison
                </Button>
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
              Rating: {comparisonData.explanationB.eloRating.currentRating}
            </Badge>
          </div>
          <AnalysisResultCard
            modelKey={comparisonData.explanationB.modelName}
            result={comparisonData.explanationB}
            model={undefined}
            testCases={comparisonData.puzzle.test}
            comparisonMode={true} // Hide correctness indicators
          />
          {votingState === 'ready' && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => handleVote('B')}
              disabled={isSubmitting}
            >
              <span className="text-lg">👍 This explanation is better</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}