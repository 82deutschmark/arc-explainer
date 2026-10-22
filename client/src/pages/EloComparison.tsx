/**
 * EloComparison.tsx
 *
 * Author: Claude Opus 5.5 Low (rebuilt from scratch); original by Claude Code using Sonnet 4, 15-Sep-2025
 * Date: 2026-10-22
 * PURPOSE: "Can You Spot Slop?" at /elo and /elo/:taskId (also /compare). Two anonymous AI
 *          explanations of the same ARC puzzle; the visitor reads both, checks them against the
 *          grids, and votes A, B or both bad. Votes feed the Elo ratings on /elo/leaderboard and the
 *          results modal then reveals the models and the right answer.
 *          Layout is a dense terminal sheet, everything judged in one screen:
 *            - one thin top bar: title, puzzle ID, jump box, random / featured / leaderboard;
 *            - two explanation columns (A, B), each opening with that model's answer grid and then
 *              its own words;
 *            - a puzzle panel on the right (sticky on desktop, first on mobile) with the training
 *              pairs and the test input as real grids at a fixed cell size, so they read as grids
 *              without taking the page;
 *            - a slim vote bar pinned to the bottom that collapses once a vote is cast.
 *          2026-10-22 rebuild: the first redesign kept a marketing header and the puzzle-page
 *          gallery, whose cards overflowed and pushed both explanations below the fold.
 * SRP and DRY check: Pass - pair and vote logic stay in useEloComparison / useEloVoting; grids are
 *          the shared TinyGrid; each explanation column is SlopExplanationColumn; this page only
 *          lays them out.
 * Page title changes reuse setPageTitle so document, social and structured-data titles stay aligned.
 */

import { setPageTitle } from '@/hooks/usePageMeta';
import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { EloVoteResultsModal } from '@/components/elo/EloVoteResultsModal';
import { FeaturedPuzzlesEloEntry } from '@/components/elo/FeaturedPuzzlesEloEntry';
import { SlopExplanationColumn, SlopSideChip, SLOP_SIDE_STYLE } from '@/components/elo/SlopExplanationColumn';

import { useEloComparison } from '@/hooks/useEloComparison';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { useEloVoting } from '@/hooks/useEloVoting';

import type { ARCExample } from '@shared/types';
import { ComparisonOutcome } from '../../../shared/types';

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

/**
 * A grid at a fixed cell size with 1px grid lines, capped so its longest side stays within
 * `maxPx`. Every grid on the page shares the same rule, so sizes compare honestly.
 */
function SheetGrid({ grid, maxPx = 150, maxCell = 14 }: { grid: number[][]; maxPx?: number; maxCell?: number }) {
  const rows = grid?.length || 0;
  const cols = grid?.[0]?.length || 0;
  if (!rows || !cols) return <div className="font-mono text-[11px] text-muted-foreground">empty</div>;
  const cell = Math.max(3, Math.min(maxCell, Math.floor(maxPx / Math.max(rows, cols))));
  return (
    <div className="shrink-0" style={{ width: cols * cell + cols + 1 }}>
      <TinyGrid grid={grid} style={{ gap: 1, padding: 1, background: '#4b5563' }} />
    </div>
  );
}

function GridCaption({ children }: { children: React.ReactNode }) {
  return <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{children}</div>;
}

const dims = (grid: number[][] | null | undefined) => (grid?.length ? `${grid[0]?.length ?? 0}×${grid.length}` : '');

export default function EloComparison() {
  const { taskId } = useParams<{ taskId?: string }>();
  const [inputPuzzleId, setInputPuzzleId] = useState('');

  React.useEffect(() => {
    setPageTitle(taskId ? `Can You Spot Slop? - Puzzle ${taskId}` : 'Can You Spot Slop?');
  }, [taskId]);

  const [votingState, setVotingState] = useState<'ready' | 'submitting' | 'voted'>('ready');
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [currentOutcome, setCurrentOutcome] = useState<ComparisonOutcome | null>(null);

  // Random pair when no puzzle ID is given, otherwise a pair for that puzzle
  const { comparisonData, isLoading, error, refetch, sessionId } = useEloComparison(taskId);
  const { submitVote, isSubmitting, voteError, voteResult, enhanceVoteResult } = useEloVoting();
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
      const firstPrediction = (explanation: any) => getPredictionForTest(explanation, 0) ?? [];

      enhanceVoteResult(basicResult, {
        correctAnswerGrid: comparisonData.puzzle.test[0]?.output ?? [],
        predictionA: firstPrediction(comparisonData.explanationA),
        predictionB: firstPrediction(comparisonData.explanationB),
        modelA: { name: comparisonData.explanationA.modelName, accuracy: getModelAccuracy(comparisonData.explanationA.modelName) },
        modelB: { name: comparisonData.explanationB.modelName, accuracy: getModelAccuracy(comparisonData.explanationB.modelName) },
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

  // Top bar is the same in every state, so loading and errors don't jump the layout
  const topBar = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider">
      <span className="font-bold">Can you spot slop?</span>
      {comparisonData?.puzzleId && (
        <Link href={`/puzzle/${comparisonData.puzzleId}`} className="normal-case text-muted-foreground hover:text-foreground hover:underline">
          puzzle {comparisonData.puzzleId}
        </Link>
      )}
      <span className="hidden normal-case tracking-normal text-muted-foreground xl:inline">
        Two anonymous models explain the same puzzle. Some were shown the answer. Pick the one that gets it.
      </span>
      <div className="ml-auto flex items-center gap-1">
        <form onSubmit={handlePuzzleIdSubmit} className="flex items-center">
          <input
            type="text"
            value={inputPuzzleId}
            onChange={(e) => setInputPuzzleId(e.target.value)}
            placeholder="puzzle id"
            aria-label="Jump to a puzzle by ID"
            className="h-6 w-28 border bg-background px-1.5 font-mono text-[11px] normal-case focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" disabled={!inputPuzzleId.trim()} className="h-6 border border-l-0 px-2 hover:bg-muted disabled:opacity-40">
            go
          </button>
        </form>
        <button onClick={() => (window.location.href = '/elo')} className="h-6 px-2 hover:bg-muted">random</button>
        <div className="[&_button]:h-6 [&_button]:px-2 [&_button]:text-[11px]">
          <FeaturedPuzzlesEloEntry />
        </div>
        <Link href="/elo/leaderboard" className="flex h-6 items-center px-2 hover:bg-muted">leaderboard</Link>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="w-full">
        {topBar}
        <div className="flex items-center gap-2 px-3 py-6 font-mono text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> picking a puzzle and two explanations…
        </div>
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="w-full">
        {topBar}
        <div className="space-y-2 px-3 py-6 font-mono text-xs">
          <p className="text-destructive">
            {error?.message || 'Could not load a pair of explanations.'}
            {taskId ? ' This puzzle may not have two explanations with answers yet.' : ''}
          </p>
          <div className="flex gap-3">
            <button onClick={() => refetch()} className="underline">try again</button>
            {taskId && <button onClick={() => (window.location.href = '/elo')} className="underline">random puzzle</button>}
          </div>
        </div>
      </div>
    );
  }

  const { puzzle, explanationA, explanationB } = comparisonData;
  const testCount = puzzle.test.length;

  return (
    <div className="w-full pb-14">
      {topBar}

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,26rem)]">
        {/* Explanations: each opens with that model's answer, then its own words */}
        {(['A', 'B'] as const).map((side) => {
          const explanation = side === 'A' ? explanationA : explanationB;
          return (
            <div key={side} className="min-w-0 space-y-2 lg:order-none order-1">
              <div className={`flex flex-wrap gap-3 border-t-2 bg-card px-2 py-2 ${SLOP_SIDE_STYLE[side].rule}`}>
                {puzzle.test.map((_: ARCExample, testIndex: number) => {
                  const prediction = getPredictionForTest(explanation, testIndex);
                  return (
                    <div key={testIndex}>
                      <GridCaption>
                        <span className="inline-flex items-center gap-1">
                          <SlopSideChip side={side} /> answer{testCount > 1 ? ` · test ${testIndex + 1}` : ''} {dims(prediction)}
                        </span>
                      </GridCaption>
                      {prediction ? (
                        <SheetGrid grid={prediction} maxPx={180} />
                      ) : (
                        <div className="font-mono text-[11px] text-muted-foreground">no answer given</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <SlopExplanationColumn side={side} explanation={explanation} />
            </div>
          );
        })}

        {/* The puzzle: first on mobile, a sticky side panel on desktop */}
        <aside className="order-first min-w-0 lg:order-none">
          <div className="space-y-3 border bg-card p-2 lg:sticky lg:top-2 lg:max-h-[calc(100vh-4rem)] lg:overflow-auto">
            <div>
              <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wider">
                <span className="font-semibold">Test</span>
                <span className="text-muted-foreground">what should it become?</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {puzzle.test.map((testCase: ARCExample, testIndex: number) => (
                  <div key={testIndex}>
                    <GridCaption>
                      {testCount > 1 ? `test ${testIndex + 1} · ` : ''}input {dims(testCase.input)}
                    </GridCaption>
                    <SheetGrid grid={testCase.input} maxPx={180} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-2">
              <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
                Examples <span className="font-normal text-muted-foreground">({puzzle.train.length})</span>
              </div>
              <div className="space-y-2">
                {puzzle.train.map((example: ARCExample, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-3 shrink-0 font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                    <SheetGrid grid={example.input} maxPx={150} />
                    <span className="font-mono text-xs text-muted-foreground">→</span>
                    <SheetGrid grid={example.output} maxPx={150} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <p className="px-3 font-mono text-[10px] text-muted-foreground">
        Built September 2025 by Claude Code on Sonnet 4; rebuilt October 2026 by Claude Opus 5.5.
      </p>

      {/* Vote bar: pinned to the bottom; collapses to next steps once a vote is cast */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
          {votingState === 'ready' && (
            <>
              <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:inline">
                which one actually understands it?
              </span>
              <div className="grid flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-none">
                <Button size="sm" onClick={() => handleVote('A_WINS')} disabled={isSubmitting} className={`rounded-none ${SLOP_SIDE_STYLE.A.button}`}>
                  A is better
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleVote('BOTH_BAD')} disabled={isSubmitting} className="rounded-none">
                  Both are slop
                </Button>
                <Button size="sm" onClick={() => handleVote('B_WINS')} disabled={isSubmitting} className={`rounded-none ${SLOP_SIDE_STYLE.B.button}`}>
                  B is better
                </Button>
              </div>
            </>
          )}
          {votingState === 'submitting' && (
            <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> recording vote…
            </span>
          )}
          {votingState === 'voted' && (
            <>
              <span className="font-mono text-[11px] uppercase tracking-wider">vote recorded</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => setShowResultsModal(true)}>
                  See who it was
                </Button>
                <Button size="sm" className="rounded-none" onClick={handleNextComparison}>
                  Next puzzle →
                </Button>
              </div>
            </>
          )}
          {voteError && <span className="font-mono text-[11px] text-destructive">vote failed: {voteError.message}</span>}
        </div>
      </div>

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
