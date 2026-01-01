/**
 * Author: Cascade (updated by Claude Sonnet 4)
 * Date: 2026-01-01
 * PURPOSE: Explanation content blocks for the Hugging Face union-accuracy page.
 *          Extracted as a dedicated component to keep orchestration logic small.
 *          Includes official Python scoring implementation reference.
 * SRP/DRY check: Pass - Presentational explanatory content only.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AttemptUnionStats } from '@/pages/AnalyticsOverview';

export interface UnionAccuracyExplainersProps {
  unionMetrics: AttemptUnionStats;
  totalPairsForDisplay: number;
}

/**
 * Official Python scoring implementation from arc-agi-benchmarking.
 * This is the authoritative source of truth for ARC-AGI scoring.
 * File: arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py (lines 36-125)
 */
const OFFICIAL_SCORING_PY = `@staticmethod
def score_task(task: ARCTask, testing_results: BenchmarkedTaskResults) -> ScoringResult:
    """
    Go through each attempt for each pair in the testing results and set the correct flag.
    Also evaluate whether any attempt is correct and the total cost, and return a ScoringResult object.
    """
    
    task_score = 0
    num_pairs = len(task.test)  # Number of test cases in this task

    for enum_pair_index, pair_attempts in enumerate(testing_results):
        # ... pair_index validation logic ...
        
        any_attempt_correct = False
        for attempt_index, attempt_data in enumerate(pair_attempts):
            if attempt_data is None:
                continue
            if attempt_data.answer == []:
                continue

            # Check if this attempt matches ground truth
            attempt_data.correct = attempt_data.answer == task.test[pair_index].output
            any_attempt_correct = any_attempt_correct or attempt_data.correct

        # If ANY attempt was correct, this test case is solved
        if any_attempt_correct:
            task_score += 1

    # Return ratio: solved test cases / total test cases
    scoring_result = ScoringResult(
        score=task_score / num_pairs if num_pairs > 0 else 0.0,
        ...
    )

    return scoring_result`;

export const UnionAccuracyExplainers: React.FC<UnionAccuracyExplainersProps> = ({
  unionMetrics,
  totalPairsForDisplay,
}) => {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-2">
        <div className="text-base text-gray-700 leading-relaxed space-y-1">
          <div>
            <strong>Official Scoring Method:</strong>
          </div>
          <div>
            The ARC Prize team's evaluation harness tests each model <strong>twice independently</strong> on every ARC test case.
            If <strong>either</strong> attempt gets the test case correct, that test case counts as solved. A puzzle's score is the fraction of its
            test cases solved, and the dataset score is the average of puzzle scores (each puzzle weighted equally). This is the official scoring method used to evaluate all models.
          </div>
          <div>
            <strong>Important:</strong> These results are from the <strong>public evaluation set</strong>, which is different from the semi-private evaluation set
            used on the official ARC Prize website. Models typically score differently on these two datasets, so don't expect the numbers to match the official leaderboard.
          </div>
          <div className="text-gray-600">
            <strong>Why 2 attempts?</strong> This shows the model's potential when given multiple chances. One wrong answer doesn't mean the model can't solve the puzzle—
            with a second try, it might succeed. This scoring method reveals the model's true capability.
          </div>
          <div className="text-gray-600">
            <strong>Transparency metric:</strong> {unionMetrics.unionCorrectCount}/{totalPairsForDisplay} test cases solved (case-weighted).
          </div>
        </div>

        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="official-code">
            <AccordionTrigger className="text-sm font-medium">
              View Official Scoring Implementation (scoring.py)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  <strong>Source of Truth:</strong>{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">
                    arc-agi-benchmarking/src/arc_agi_benchmarking/scoring/scoring.py
                  </code>
                </p>
                <p className="text-xs text-gray-600">
                  This is the official Python implementation from the ARC Prize team that validates all results.
                  Our TypeScript implementation matches this logic exactly.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto font-mono">
                  {OFFICIAL_SCORING_PY}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Note:</strong> The Python code uses <code className="bg-gray-100 px-1 rounded">num_pairs</code> to refer to test cases
                  (each test case has 2 attempts). This is legacy naming from the official implementation.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
