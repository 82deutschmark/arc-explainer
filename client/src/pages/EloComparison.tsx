/**
 * EloComparison.tsx
 *
 * Author: Claude Opus 5.5 Low (redesign); original by Claude Code using Sonnet 4, 15-Sep-2025
 * Date: 2026-10-22
 * PURPOSE: "Can You Spot Slop?" at /elo and /elo/:taskId (also /compare). Two anonymous AI
 *          explanations of the same ARC puzzle; the visitor reads both, checks them against the
 *          grids, and votes A, B or both bad. Votes feed the Elo ratings on /elo/leaderboard and the
 *          results modal then reveals the models and the right answer.
 *          2026-10-22 redesign: the old page put the vote above the explanations (people were asked
 *          to judge before reading), stacked oversized centred gradient cards, and repeated the
 *          instructions three times. Now: a plain left-aligned header with the puzzle controls, the
 *          puzzle (training pairs, then each test input beside A's and B's answers), the two
 *          explanations side by side, and a vote bar pinned to the bottom of the screen that
 *          collapses to a status line once a vote is cast.
 *          Some explanations in the database came from models shown the correct answer and asked
 *          only to explain it (the site's original mode); others solved blind. Which one was not
 *          recorded per explanation, so the copy says "some".
 * SRP and DRY check: Pass - vote and pair logic unchanged and still in useEloComparison /
 *          useEloVoting; grids reuse PuzzleGrid and TrainingPairGallery, explanations reuse
 *          AnalysisResultCard in eloMode (which hides model identity and correctness); this page
 *          only lays them out.
 * Page title changes reuse setPageTitle so document, social and structured-data titles stay aligned.
 */

import { setPageTitle } from '@/hooks/usePageMeta';
import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RotateCcw, Trophy, Shuffle, ArrowRight } from 'lucide-react';

// Reuse existing components
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { TrainingPairGallery } from '@/components/puzzle/examples/TrainingPairGallery';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { EloVoteResultsModal } from '@/components/elo/EloVoteResultsModal';
import { FeaturedPuzzlesEloEntry } from '@/components/elo/FeaturedPuzzlesEloEntry';

// Hooks for comparison functionality
import { useEloComparison } from '@/hooks/useEloComparison';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';

// Types
import type { ARCExample } from '@shared/types';
import { ComparisonOutcome } from '../../../shared/types';
import { useEloVoting } from '@/hooks/useEloVoting';

/**
 * The prediction an explanation made for one test case. Explanations were stored in several
 * shapes over the site's life (JSONB object keyed predictedOutputN, plain array, or a single
 * grid for one-test puzzles), so check each in turn.
 */
function getPredictionForTest(explanation: any, testIdx: number): number[][] | null {
  if (explanation.multiplePredictedOutputs) {
    if (typeof explanation.multiplePredictedOutputs === 'object' && !Array.isArray(explanation.multiplePredictedOutputs)) {
      const key = `predictedOutput${testIdx + 1}`;
      if (explanation.multiplePredictedOutputs[key]) return explanation.multiplePredictedOutputs[key];
    }
    if (Array.isArray(explanation.multiplePredictedOutputs) && explanation.multiplePredictedOutputs[testIdx]) {
      return explanation.multiplePredictedOutputs[testIdx];
    }
  }
  if (Array.isArray(explanation.multiTestPredictionGrids) && explanation.multiTestPredictionGrids[testIdx]) {
    return explanation.multiTestPredictionGrids[testIdx];
  }
  if (testIdx === 0 && explanation.predictedOutputGrid) return explanation.predictedOutputGrid;
  return null;
}

/** Side labels. A and B get distinct, non-purple accents that read in light and dark. */
const SIDE_STYLE = {
  A: { chip: 'bg-sky-600 text-white', rule: 'border-sky-600', text: 'text-sky-700 dark:text-sky-300' },
  B: { chip: 'bg-orange-600 text-white', rule: 'border-orange-600', text: 'text-orange-700 dark:text-orange-300' },
} as const;

function SideChip({ side }: { side: 'A' | 'B' }) {
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-sm text-sm font-bold ${SIDE_STYLE[side].chip}`}>
      {side}
    </span>
  );
}

function GridSlot({ label, grid, side }: { label: string; grid: number[][] | null; side?: 'A' | 'B' }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {side && <SideChip side={side} />}
        {label}
      </div>
      {grid ? (
        <PuzzleGrid grid={grid} title={`${grid[0]?.length || 0}×${grid.length || 0}`} showEmojis={false} compact />
      ) : (
        <div className="rounded-sm border border-dashed px-4 py-6 text-sm text-muted-foreground">No answer given</div>
      )}
    </div>
  );
}

export default function EloComparison() {
  const { taskId } = useParams<{ taskId?: string }>();
  const finalPuzzleId = taskId;
  const [inputPuzzleId, setInputPuzzleId] = useState('');

  React.useEffect(() => {
    setPageTitle(finalPuzzleId ? `Can You Spot Slop? - Puzzle ${finalPuzzleId}` : 'Can You Spot Slop?');
  }, [finalPuzzleId]);

  const [votingState, setVotingState] = useState<'ready' | 'submitting' | 'voted'>('ready');
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [currentOutcome, setCurrentOutcome] = useState<ComparisonOutcome | null>(null);

  // Random pair when no puzzle ID is given, otherwise a pair for that puzzle
  const { comparisonData, isLoading, error, refetch, sessionId } = useEloComparison(finalPuzzleId);
  const { submitVote, isSubmitting, voteError, voteResult, enhanceVoteResult } = useEloVoting();

  // Model accuracy for the results modal
  const { accuracyStats: leaderboardData } = useModelLeaderboards();

  const handleVote = async (outcome: 'A_WINS' | 'B_WINS' | 'BOTH_BAD') => {
    if (!comparisonData) return;

    try {
      setVotingState('submitting');
      setCurrentOutcome(outcome);

      const basicResult = await submitVote({
        sessionId,
        explanationAId: comparisonData.explanationA.id,
        explanationBId: comparisonData.explanationB.id,
        outcome,
        puzzleId: comparisonData.puzzleId,
      });

      const getModelAccuracy = (modelName: string) =>
        leaderboardData?.modelAccuracyRankings?.find((model: any) => model.modelName === modelName);

      // The modal shows the first test case: right answer beside each model's prediction
      const firstTestOutput = comparisonData.puzzle.test[0]?.output ?? [];
      const firstPrediction = (explanation: any) => {
        const grids = (explanation.predictedOutputGrids || []).filter(
          (grid: unknown): grid is number[][] => Array.isArray(grid),
        );
        if (grids.length === 0 && explanation.predictedOutputGrid) grids.push(explanation.predictedOutputGrid);
        return grids[0] || [];
      };

      enhanceVoteResult(basicResult, {
        correctAnswerGrid: firstTestOutput,
        predictionA: firstPrediction(comparisonData.explanationA),
        predictionB: firstPrediction(comparisonData.explanationB),
        modelA: {
          name: comparisonData.explanationA.modelName,
          accuracy: getModelAccuracy(comparisonData.explanationA.modelName),
        },
        modelB: {
          name: comparisonData.explanationB.modelName,
          accuracy: getModelAccuracy(comparisonData.explanationB.modelName),
        },
        outcome,
      });

      setVotingState('voted');
      setShowResultsModal(true);
    } catch {
      setVotingState('ready');
      setCurrentOutcome(null);
    }
  };

  const handleNextComparison = () => {
    setVotingState('ready');
    setShowResultsModal(false);
    setCurrentOutcome(null);
    refetch();
  };

  const handlePuzzleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPuzzleId.trim()) window.location.href = `/elo/${inputPuzzleId.trim()}`;
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-7xl items-center gap-2 px-4 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Picking a puzzle and two explanations…
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-10">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || 'Could not load a pair of explanations.'}
            {finalPuzzleId ? ' This puzzle may not have two explanations with answers yet.' : ''}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> Try again
          </Button>
          {finalPuzzleId && (
            <Button onClick={() => (window.location.href = '/elo')} variant="outline">
              <Shuffle className="mr-2 h-4 w-4" /> Random puzzle
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { puzzle, puzzleId, explanationA, explanationB } = comparisonData;
  const testCount = puzzle.test.length;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-7 sm:pt-10">
      {/* Header: what this is, and the puzzle controls */}
      <header className="flex flex-col gap-6 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ARC 1 &amp; 2 · Can you spot slop?</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Two models explain the same puzzle. Which one actually gets it?</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Both explanations sound sure of themselves. Some of these models were even shown the right answer and asked only
            to explain why it is right, and still could not. Read both, check them against the grids, then vote. The model
            names and the right answer stay hidden until you do.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <form onSubmit={handlePuzzleIdSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={inputPuzzleId}
              onChange={(e) => setInputPuzzleId(e.target.value)}
              placeholder="Puzzle ID, e.g. 3d588dc9"
              aria-label="Jump to a puzzle by ID"
              className="h-9 w-56 rounded-md border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!inputPuzzleId.trim()}>
              Go
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/elo')}>
              <Shuffle className="mr-2 h-4 w-4" /> Random puzzle
            </Button>
            <FeaturedPuzzlesEloEntry />
            <Link href="/elo/leaderboard">
              <Button variant="ghost" size="sm">
                <Trophy className="mr-2 h-4 w-4" /> Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* The puzzle */}
      <section className="space-y-5 py-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-semibold">The puzzle</h2>
          <Link href={`/puzzle/${puzzleId}`} className="font-mono text-sm text-muted-foreground hover:text-foreground hover:underline">
            {puzzleId}
          </Link>
          <span className="text-sm text-muted-foreground">
            Work out the rule from the {puzzle.train.length} example{puzzle.train.length === 1 ? '' : 's'}.
          </span>
        </div>
        <TrainingPairGallery trainExamples={puzzle.train} showHeader={false} />
      </section>

      {/* Test input(s) beside each side's answer */}
      <section className="space-y-5 border-t py-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-semibold">{testCount > 1 ? 'The tests' : 'The test'}</h2>
          <span className="text-sm text-muted-foreground">
            {testCount > 1 ? `${testCount} test inputs, ` : 'The test input, '}and what each model said it becomes.
          </span>
        </div>

        {puzzle.test.map((testCase: ARCExample, testIndex: number) => (
          <div key={testIndex} className="space-y-3">
            {testCount > 1 && (
              <p className="text-sm font-medium text-muted-foreground">
                Test {testIndex + 1} of {testCount}
              </p>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <GridSlot label="Test input" grid={testCase.input} />
              <GridSlot label="A's answer" grid={getPredictionForTest(explanationA, testIndex)} side="A" />
              <GridSlot label="B's answer" grid={getPredictionForTest(explanationB, testIndex)} side="B" />
            </div>
          </div>
        ))}
      </section>

      {/* The two explanations */}
      <section className="space-y-5 border-t py-8">
        <h2 className="text-xl font-semibold">The explanations</h2>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {([['A', explanationA], ['B', explanationB]] as const).map(([side, explanation]) => (
            <div key={side} className={`min-w-0 space-y-3 border-t-4 pt-3 ${SIDE_STYLE[side].rule}`}>
              <div className="flex items-center gap-2">
                <SideChip side={side} />
                <h3 className={`text-lg font-semibold ${SIDE_STYLE[side].text}`}>Explanation {side}</h3>
              </div>
              <AnalysisResultCard
                modelKey={explanation.modelName}
                result={explanation}
                model={undefined}
                testCases={puzzle.test}
                eloMode={true}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Vote bar: pinned to the bottom so the vote comes after reading; collapses once cast */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {votingState === 'ready' && (
            <>
              <p className="text-sm font-medium">Which explanation actually understands the puzzle?</p>
              <div className="grid grid-cols-3 gap-2 sm:flex">
                <Button onClick={() => handleVote('A_WINS')} disabled={isSubmitting} className="bg-sky-600 text-white hover:bg-sky-700">
                  A is better
                </Button>
                <Button onClick={() => handleVote('BOTH_BAD')} disabled={isSubmitting} variant="outline">
                  Both are slop
                </Button>
                <Button onClick={() => handleVote('B_WINS')} disabled={isSubmitting} className="bg-orange-600 text-white hover:bg-orange-700">
                  B is better
                </Button>
              </div>
            </>
          )}

          {votingState === 'submitting' && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recording your vote…
            </p>
          )}

          {votingState === 'voted' && (
            <>
              <p className="text-sm font-medium">Vote recorded. The models and the right answer are in the results.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowResultsModal(true)}>
                  See results
                </Button>
                <Button onClick={handleNextComparison}>
                  Next puzzle <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {voteError && (
            <p className="text-sm text-destructive">Could not record the vote: {voteError.message}</p>
          )}
        </div>
      </div>

      <p className="pt-2 text-xs text-muted-foreground">
        Built September 2025 by Claude Code on Sonnet 4; redesigned October 2026 by Claude Opus 5.5.
      </p>

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
