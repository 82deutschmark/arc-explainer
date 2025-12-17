/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Shared attempt-union metrics card used by ModelComparisonDialog and the Hugging Face union page.
 *          Extracted to eliminate duplicated union metrics UI and to enforce one canonical presentation.
 * SRP/DRY check: Pass - Single responsibility presentational component.
 * shadcn/ui: Pass - Uses shadcn/ui Card/Badge/Progress.
 */

import React from 'react';
import { Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { detectModelOrigin } from '@/utils/modelOriginDetection';

export interface AttemptUnionMetrics {
  baseModelName: string;
  attemptModelNames: string[];
  unionAccuracyPercentage: number;
  unionCorrectCount: number;
  totalPuzzles: number;
  totalTestPairs?: number;
  puzzlesCounted?: number;
  puzzlesFullySolved?: number;

  // Dataset-level denominators (stable across models; returned by backend)
  datasetTotalPuzzles?: number;
  datasetTotalTestPairs?: number;
}

export type AttemptUnionCardVariant = 'compact' | 'detailed';

/**
 * Canonical UI card for showing 2-attempt union metrics.
 *
 * NOTE: We support two layouts to preserve existing UX across different surfaces:
 * - compact: used inside the model comparison dialog
 * - detailed: used on /scoring to match the existing explanation-heavy results card
 */
export const AttemptUnionCard: React.FC<{
  metrics: AttemptUnionMetrics;
  variant?: AttemptUnionCardVariant;

  /**
   * Optional puzzle IDs to show as solved badges.
   * Preserves the union page behavior: badge if either attempt is puzzle-level correct.
   */
  unionPuzzleIds?: string[];
}> = ({ metrics, variant = 'compact', unionPuzzleIds = [] }) => {
  const totalPairs =
    metrics.datasetTotalTestPairs ??
    metrics.totalTestPairs ??
    metrics.datasetTotalPuzzles ??
    metrics.totalPuzzles;

  const pairWeightedRate = totalPairs > 0 ? (metrics.unionCorrectCount / totalPairs) * 100 : 0;

  const puzzlesCounted =
    metrics.datasetTotalPuzzles ??
    metrics.puzzlesCounted ??
    metrics.totalPuzzles;

  const puzzlesFullySolved = metrics.puzzlesFullySolved ?? 0;

  const puzzlePassRate =
    puzzlesCounted > 0 ? (puzzlesFullySolved / puzzlesCounted) * 100 : 0;

  // For /scoring we need the legacy derived counts if puzzlesFullySolved is missing.
  const puzzlesFullySolvedForDisplay = metrics.puzzlesFullySolved ?? unionPuzzleIds.length;

  // /scoring expects the progress bar to reflect the pair-weighted rate.
  const pairWeightedAccuracyPercentage = pairWeightedRate;

  if (variant === 'detailed') {
    // This markup intentionally mirrors the original /scoring result card for stability.
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-sm">
        <CardContent className="p-3">
          {/* Big Number with Puzzle Badges on same line */}
          <div className="flex items-start justify-between mb-2 gap-3">
            <div>
              <div className="text-4xl font-bold text-blue-700">
                {metrics.unionAccuracyPercentage.toFixed(1)}%
              </div>
              <p className="text-base text-gray-600 mt-0.5">Official harness score (average of puzzle scores)</p>
            </div>
            <div className="flex items-start gap-2">
              {unionPuzzleIds.length > 0 && (
                <div className="flex flex-wrap gap-1 max-w-xs justify-end">
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
              )}
              <Zap className="h-6 w-6 text-blue-500 flex-shrink-0" />
            </div>
          </div>

          {/* Three Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-blue-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{metrics.unionAccuracyPercentage.toFixed(1)}%</div>
              <div className="text-sm font-medium text-blue-800">Harness Score</div>
              <div className="text-xs text-gray-600">Official ARC-AGI metric</div>
            </div>
            <div className="bg-green-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {(
                  (puzzlesFullySolvedForDisplay /
                    (metrics.datasetTotalPuzzles ?? metrics.puzzlesCounted ?? metrics.totalPuzzles)) *
                  100
                ).toFixed(1)}%
              </div>
              <div className="text-sm font-medium text-green-800">Puzzles Solved</div>
              <div className="text-xs text-gray-600">
                {puzzlesFullySolvedForDisplay}/
                {metrics.datasetTotalPuzzles ?? metrics.puzzlesCounted ?? metrics.totalPuzzles} fully correct
              </div>
            </div>
            <div className="bg-purple-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{pairWeightedRate.toFixed(1)}%</div>
              <div className="text-sm font-medium text-purple-800">Test Pairs</div>
              <div className="text-xs text-gray-600">{metrics.unionCorrectCount}/{totalPairs} pairs</div>
            </div>
          </div>

          {/*
            Scoring explanation (explicit, union-centric).
            Goal: A user should understand what a puzzle/task is, what a test pair is, what "2 attempts" means,
            and why these three metrics can disagree.
          */}
          <div className="bg-white rounded p-3 mb-2 border border-gray-200 text-base space-y-3">
            <div className="font-semibold text-gray-900">
              How scoring works on this page (plain English)
            </div>

            <div className="text-gray-700 leading-relaxed">
              <strong>Vocabulary:</strong> In ARC, a <strong>puzzle</strong> and a <strong>task</strong> are the same thing: one ARC JSON file.
              Each puzzle contains <strong>training pairs</strong> (examples that teach the pattern) and <strong>test pairs</strong> (the scored questions).
              A single puzzle can have multiple test pairs.
            </div>

            <div className="text-gray-700 leading-relaxed">
              <strong>Two attempts (the union rule):</strong> The ARC Prize evaluation harness runs the model <strong>twice independently</strong> for the same puzzle.
              For each <strong>test pair</strong>, the harness checks both attempts. If <strong>either attempt</strong> gets that test pair correct, then that test pair counts as solved.
              This is why this page is called a union page.
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <div className="font-semibold text-blue-900">Harness Score (official)</div>
                <div className="text-gray-700 mt-1">
                  Compute a score for each puzzle, then average puzzle scores.
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <div className="font-semibold text-green-900">Puzzles Solved</div>
                <div className="text-gray-700 mt-1">
                  A puzzle is counted as solved only if <strong>all</strong> its test pairs are solved by the union.
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-2">
                <div className="font-semibold text-purple-900">Test Pairs</div>
                <div className="text-gray-700 mt-1">
                  Total solved test pairs in the union divided by total test pairs. This is <strong>not</strong> the official harness score.
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="font-semibold text-gray-900">Worked example: one puzzle with 3 test pairs</div>
              <div className="text-gray-700 leading-relaxed">
                This puzzle has test pairs 0, 1, and 2. Each test pair is scored using the union rule: Attempt 1 OR Attempt 2.
              </div>

              <div className="rounded border border-gray-200 bg-gray-50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test pair</TableHead>
                      <TableHead>Attempt 1</TableHead>
                      <TableHead>Attempt 2</TableHead>
                      <TableHead>Union result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Pair 0</TableCell>
                      <TableCell>Correct</TableCell>
                      <TableCell>Wrong</TableCell>
                      <TableCell className="font-semibold text-gray-900">Solved</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Pair 1</TableCell>
                      <TableCell>Wrong</TableCell>
                      <TableCell>Correct</TableCell>
                      <TableCell className="font-semibold text-gray-900">Solved</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Pair 2</TableCell>
                      <TableCell>Wrong</TableCell>
                      <TableCell>Wrong</TableCell>
                      <TableCell className="font-semibold text-gray-900">Unsolved</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="text-gray-700 leading-relaxed">
                <strong>Puzzle score (official per-puzzle step):</strong> 2 solved test pairs out of 3 total test pairs, so this puzzle contributes 2/3 = 0.6667.
              </div>
              <div className="text-gray-700 leading-relaxed">
                <strong>Puzzles Solved (all-or-nothing):</strong> this puzzle is not counted as solved because one test pair is unsolved.
              </div>
              <div className="text-gray-700 leading-relaxed">
                <strong>Test Pairs metric contribution:</strong> this puzzle contributes +2 solved test pairs and +3 total test pairs.
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2 bg-amber-50 rounded p-3 border-l-4 border-l-amber-600">
              <div className="font-semibold text-amber-900">⚠️ Critical: Arc Explainer's stricter scoring (DIFFERENT from official harness)</div>
              <div className="text-gray-700 leading-relaxed">
                <strong>Important distinction:</strong> ARC Explainer calculates scores against <strong>ALL puzzles in the dataset</strong> (120 for ARC2-Eval),
                not just the ones the model attempted. This is MORE STRICT than the official ARC-AGI harness.
                <br /><br />
                <strong>Official harness:</strong> Only counts attempted puzzles. A model that solves 1 puzzle out of 120 scores 1/1 = 100%.
                <br /><br />
                <strong>Arc Explainer (this page):</strong> Counts all 120 required puzzles. A model that solves 1 puzzle out of 120 scores (1.0 + 0 + 0 + ... + 0) / 120 ≈ 0.83%.
                Unattempted puzzles count as zero.
              </div>
              <div className="text-gray-700 leading-relaxed text-sm">
                This ensures you see how a model performs against the <strong>complete required task set</strong>, not just the puzzles it happened to attempt.
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2 mt-3">
              <div className="font-semibold text-gray-900">Why the official score can differ from the Test Pairs rate</div>
              <div className="text-gray-700 leading-relaxed">
                The official harness score weights each puzzle equally. The Test Pairs rate weights puzzles with more test pairs more heavily.
                Here is a concrete two-puzzle example:
              </div>
              <div className="rounded border border-gray-200 bg-gray-50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Puzzle</TableHead>
                      <TableHead>Total test pairs</TableHead>
                      <TableHead>Solved test pairs (union)</TableHead>
                      <TableHead>Puzzle score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Puzzle A</TableCell>
                      <TableCell>3</TableCell>
                      <TableCell>2</TableCell>
                      <TableCell>2/3 = 0.6667</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Puzzle B</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>1/1 = 1.0</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="text-gray-700 leading-relaxed">
                <strong>Official harness score:</strong> average of puzzle scores = (0.6667 + 1.0) / 2 = 0.8333.
              </div>
              <div className="text-gray-700 leading-relaxed">
                <strong>Test Pairs rate:</strong> total solved test pairs / total test pairs = (2 + 1) / (3 + 1) = 0.75.
              </div>
              <div className="text-gray-700 leading-relaxed">
                This is why a count like {metrics.unionCorrectCount}/{totalPairs} can be real and still not match the official harness score shown above.
              </div>
            </div>
          </div>

          {/* Quick Progress Bar */}
          <Progress
            value={pairWeightedAccuracyPercentage}
            className="h-2 mb-1"
          />
          <p className="text-base text-gray-700">
            <strong>{metrics.unionCorrectCount}</strong> of <strong>{totalPairs}</strong> test pairs solved (pair-weighted rate)
          </p>

          {/* Model Names with Origin Badge */}
          <div className="border-t border-blue-100 pt-2 flex flex-wrap gap-1">
            <Badge variant={detectModelOrigin(metrics.baseModelName).badgeVariant} className="text-base py-0.5">
              {detectModelOrigin(metrics.baseModelName).shortLabel}
            </Badge>
            {metrics.attemptModelNames.map((name) => (
              <Badge key={name} variant="outline" className="text-base py-0.5">
                {name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-3xl text-blue-700">
              {metrics.unionAccuracyPercentage.toFixed(1)}%
            </CardTitle>
            <CardDescription className="mt-2">
              Official harness score (average of puzzle scores)
            </CardDescription>
          </div>
          <Zap className="h-6 w-6 text-blue-500 shrink-0 mt-1" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Info */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Models Compared</p>
          <div className="flex flex-wrap gap-2">
            {metrics.attemptModelNames.map((name, idx) => (
              <Badge key={idx} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Three Metrics Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-blue-50 rounded p-2">
            <div className="text-lg font-bold text-blue-700">
              {metrics.unionAccuracyPercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600">Harness Score</div>
          </div>
          <div className="bg-green-50 rounded p-2">
            <div className="text-lg font-bold text-green-700">{puzzlePassRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Puzzles Solved</div>
            <div className="text-xs text-gray-500">
              {puzzlesFullySolved}/{puzzlesCounted}
            </div>
          </div>
          <div className="bg-purple-50 rounded p-2">
            <div className="text-lg font-bold text-purple-700">{pairWeightedRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Test Pairs</div>
            <div className="text-xs text-gray-500">
              {metrics.unionCorrectCount}/{totalPairs}
            </div>
          </div>
        </div>

        {/* Explanation Section */}
        <div className="mt-4 space-y-3 rounded-md bg-white/50 p-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Understanding the Three Metrics
            </p>
            <ul className="mt-1.5 text-sm leading-relaxed text-gray-600 space-y-1">
              <li>
                <strong>Harness Score:</strong> Official ARC-AGI metric (average of per-puzzle scores)
              </li>
              <li>
                <strong>Puzzles Solved:</strong> Puzzles where ALL test pairs were correct
              </li>
              <li>
                <strong>Test Pairs:</strong> Individual test pairs solved (pair-weighted)
              </li>
            </ul>
          </div>

          {/* Transparency Note */}
          <div className="border-t border-gray-200 pt-3 text-xs text-gray-500">
            <p>
              The harness score gives equal weight to each puzzle regardless of how many test pairs it has.
              The pair-weighted rate treats each test pair equally.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
