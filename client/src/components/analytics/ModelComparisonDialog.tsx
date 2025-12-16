/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T19:00:00-04:00 (updated 2025-12-16)
 * PURPOSE: Modal dialog for displaying model comparison results with MAXIMUM information density.
 * Fixed terrible UX where comparison results were rendered at the bottom of the page.
 * Now opens in a proper modal dialog with close button and better presentation.
 * NOTE: Updated attempt-union display to distinguish harness score (average of puzzle scores)
 *       from pair-weighted test-pair rate.
 * 
 * DENSITY IMPROVEMENTS (2025-10-10):
 * - Reduced padding: p-4→p-2 for stat cards
 * - Reduced gaps: gap-4→gap-2 for grid spacing
 * - Reduced font sizes: text-3xl→text-2xl for numbers, text-sm→text-xs for labels
 * - Reduced spacing: space-y-4→space-y-2 for content sections
 * - Added TODO comments for future aggregate metric badges
 * 
 * SRP and DRY check: Pass - Single responsibility of displaying comparison in modal
 * shadcn/ui: Pass - Uses shadcn/ui Dialog, Card components
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModelComparisonResult } from '@/pages/AnalyticsOverview';
import { Loader2, XCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  formatModelNames,
  hasComparisonSummary,
} from '@/utils/modelComparison';

interface ModelComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comparisonResult: ModelComparisonResult | null;
  loading: boolean;
  error: string | null;
}

export const ModelComparisonDialog: React.FC<ModelComparisonDialogProps> = ({
  open,
  onOpenChange,
  comparisonResult,
  loading,
  error
}) => {
  const hasSummary = hasComparisonSummary(comparisonResult);
  const modelNames = formatModelNames(comparisonResult?.summary);

  // Compute attempt union metrics for dialog display
  const attemptUnionMetrics = React.useMemo(() => {
    const summary = comparisonResult?.summary;
    const attemptUnionStats = summary?.attemptUnionStats;

    // Prefer backend-provided attempt union stats if available
    if (summary && Array.isArray(attemptUnionStats) && attemptUnionStats.length > 0) {
      return attemptUnionStats[0];
    }

    // No client-side fallback for union scoring.
    return null;
  }, [comparisonResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="model-comparison-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Model Comparison Results</DialogTitle>
          <DialogDescription id="model-comparison-description">
            {hasSummary ? (
              <>
                Comparing {modelNames} on {comparisonResult.summary.dataset} dataset (
                {comparisonResult.summary.totalPuzzles} puzzles)
              </>
            ) : loading ? (
              'Analyzing models...'
            ) : (
              'Ready to compare models'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg font-medium">Processing model comparisons...</span>
            <span className="text-sm text-muted-foreground">
              This may take a moment depending on dataset size.
            </span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" role="alert" aria-live="assertive" className="mb-4">
            <AlertDescription>
              <div className="flex items-start space-x-2">
                <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Comparison failed</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && hasSummary && (
          <div className="space-y-2">
            {attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0 && (
              <AttemptUnionCard metrics={attemptUnionMetrics} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface AttemptUnionMetrics {
  baseModelName: string;
  attemptModelNames: string[];
  unionAccuracyPercentage: number;
  unionCorrectCount: number;
  totalPuzzles: number;
  totalTestPairs?: number;
  puzzlesCounted?: number;
  puzzlesFullySolved?: number;
}

const AttemptUnionCard: React.FC<{ metrics: AttemptUnionMetrics }> = ({ metrics }) => {
  const totalPairs = metrics.totalTestPairs ?? metrics.totalPuzzles;
  const pairWeightedRate = totalPairs > 0 ? (metrics.unionCorrectCount / totalPairs) * 100 : 0;
  const puzzlesCounted = metrics.puzzlesCounted ?? metrics.totalPuzzles;
  const puzzlesFullySolved = metrics.puzzlesFullySolved ?? 0;
  const puzzlePassRate = puzzlesCounted > 0 ? (puzzlesFullySolved / puzzlesCounted) * 100 : 0;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-3xl text-blue-700">
              {metrics.unionAccuracyPercentage.toFixed(1)}%
            </CardTitle>
            <CardDescription className="mt-2">Official harness score (average of puzzle scores)</CardDescription>
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
            <div className="text-lg font-bold text-blue-700">{metrics.unionAccuracyPercentage.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Harness Score</div>
          </div>
          <div className="bg-green-50 rounded p-2">
            <div className="text-lg font-bold text-green-700">{puzzlePassRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Puzzles Solved</div>
            <div className="text-xs text-gray-500">{puzzlesFullySolved}/{puzzlesCounted}</div>
          </div>
          <div className="bg-purple-50 rounded p-2">
            <div className="text-lg font-bold text-purple-700">{pairWeightedRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-600">Test Pairs</div>
            <div className="text-xs text-gray-500">{metrics.unionCorrectCount}/{totalPairs}</div>
          </div>
        </div>

        {/* Explanation Section */}
        <div className="mt-4 space-y-3 rounded-md bg-white/50 p-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Understanding the Three Metrics
            </p>
            <ul className="mt-1.5 text-sm leading-relaxed text-gray-600 space-y-1">
              <li><strong>Harness Score:</strong> Official ARC-AGI metric (average of per-puzzle scores)</li>
              <li><strong>Puzzles Solved:</strong> Puzzles where ALL test pairs were correct</li>
              <li><strong>Test Pairs:</strong> Individual test pairs solved (pair-weighted)</li>
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
