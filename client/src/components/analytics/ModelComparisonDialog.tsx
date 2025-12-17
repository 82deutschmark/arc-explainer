/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T19:00:00-04:00 (updated 2025-12-16, 2025-12-17)
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
import { Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  formatModelNames,
  hasComparisonSummary,
} from '@/utils/modelComparison';
import { AttemptUnionCard } from '@/components/analytics/AttemptUnionCard';

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
