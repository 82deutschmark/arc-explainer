/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Explanation content blocks for the Hugging Face union-accuracy page.
 *          Extracted as a dedicated component to keep orchestration logic small.
 * SRP/DRY check: Pass - Presentational explanatory content only.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AttemptUnionStats } from '@/pages/AnalyticsOverview';

export interface UnionAccuracyExplainersProps {
  unionMetrics: AttemptUnionStats;
  totalPairsForDisplay: number;
}

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
            The ARC Prize team's evaluation harness tests each model <strong>twice independently</strong> on every ARC test pair.
            If <strong>either</strong> attempt gets the pair correct, that pair counts as solved. A puzzle's score is the fraction of its
            test pairs solved, and the dataset score is the average of puzzle scores (each puzzle weighted equally). This is the official scoring method used to evaluate all models.
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
            <strong>Transparency metric:</strong> {unionMetrics.unionCorrectCount}/{totalPairsForDisplay} test pairs solved (pair-weighted).
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
