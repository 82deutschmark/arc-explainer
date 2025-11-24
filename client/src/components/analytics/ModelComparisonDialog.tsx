/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T19:00:00-04:00 (Updated for maximum density)
 * PURPOSE: Modal dialog for displaying model comparison results with MAXIMUM information density.
 * Fixed terrible UX where comparison results were rendered at the bottom of the page.
 * Now opens in a proper modal dialog with close button and better presentation.
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
import { DialogClose } from '@/components/ui/dialog';
import { NewModelComparisonResults } from './NewModelComparisonResults';
import { ModelComparisonResult } from '@/pages/AnalyticsOverview';
import { Loader2, XCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  computeUniqueSolves,
  formatModelNames,
  hasComparisonSummary,
  computeAttemptUnionAccuracy,
  parseAttemptModelName,
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
  const uniqueSolveCount = computeUniqueSolves(comparisonResult?.summary);

  // Compute attempt union metrics for dialog display
  const attemptUnionMetrics = React.useMemo(() => {
    const summary = comparisonResult?.summary;
    const attemptUnionStats = summary?.attemptUnionStats;

    // Prefer backend-provided attempt union stats if available
    if (summary && Array.isArray(attemptUnionStats) && attemptUnionStats.length > 0) {
      return attemptUnionStats[0];
    }

    // Fallback to frontend computation for backward compatibility
    if (!summary) {
      return null;
    }

    // Get active model names from summary
    const activeModels = [
      summary.model1Name,
      summary.model2Name,
      summary.model3Name,
      summary.model4Name,
    ].filter((name): name is string => Boolean(name?.trim()));

    if (activeModels.length < 2) {
      return null;
    }

    // Parse model names to identify attempt groups
    const attemptGroups = new Map<string, { modelName: string; attemptNumber: number; index: number }[]>();
    
    activeModels.forEach((modelName, index) => {
      const parsed = parseAttemptModelName(modelName);
      if (parsed) {
        if (!attemptGroups.has(parsed.baseModelName)) {
          attemptGroups.set(parsed.baseModelName, []);
        }
        attemptGroups.get(parsed.baseModelName)!.push({
          modelName,
          attemptNumber: parsed.attemptNumber,
          index,
        });
      }
    });

    // Find the first base model group with at least 2 attempts
    for (const [baseModelName, attempts] of attemptGroups) {
      if (attempts.length >= 2) {
        // Sort by attempt number to ensure consistent ordering
        attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
        
        // Use the first two attempts for union calculation
        const modelIndices = attempts.slice(0, 2).map(a => a.index);
        const unionMetrics = computeAttemptUnionAccuracy(comparisonResult, modelIndices);
        
        return {
          baseModelName,
          attemptModelNames: attempts.slice(0, 2).map(a => a.modelName),
          ...unionMetrics,
        };
      }
    }

    return null;
  }, [comparisonResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-7xl max-h-[90vh] overflow-y-auto"
        aria-describedby="model-comparison-description"
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 rounded-full hover:bg-muted"
            aria-label="Close dialog"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </DialogClose>

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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="All Correct"
                value={comparisonResult.summary.allCorrect}
                description="All models solved correctly"
                status="success"
              />
              <StatCard
                label="All Incorrect"
                value={comparisonResult.summary.allIncorrect}
                description="Every model failed"
                status="error"
              />
              <StatCard
                label="Not Attempted"
                value={comparisonResult.summary.allNotAttempted}
                description="No model attempted"
                status="muted"
              />
              <StatCard
                label="Unique Solves"
                value={uniqueSolveCount}
                description="Solved by exactly one model"
                status="info"
              />
            </div>

            {attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0 && (
              <AttemptUnionCard metrics={attemptUnionMetrics} />
            )}

            <NewModelComparisonResults result={comparisonResult} />
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
}

const AttemptUnionCard: React.FC<{ metrics: AttemptUnionMetrics }> = ({ metrics }) => {
  const progressValue = (metrics.unionCorrectCount / metrics.totalPuzzles) * 100;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-3xl text-blue-700">
              {metrics.unionAccuracyPercentage.toFixed(1)}%
            </CardTitle>
            <CardDescription className="mt-2">Attempt Union Accuracy</CardDescription>
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

        {/* Progress Bar */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {metrics.unionCorrectCount} of {metrics.totalPuzzles} puzzles solved
          </p>
        </div>

        {/* Explanation Section */}
        <div className="mt-4 space-y-3 rounded-md bg-white/50 p-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              What is Union Accuracy?
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              This metric measures how well the <strong>combination</strong> of multiple attempts
              of the same model performs on puzzles. For each puzzle, we mark it as correct if
              <strong> any attempt</strong> solved it correctly.
            </p>
          </div>

          {/* Equation */}
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Formula
            </p>
            <div className="mt-2 space-y-1 font-mono text-xs text-gray-600 leading-relaxed bg-gray-50/50 rounded p-2">
              <div>
                <span className="font-semibold">Union Accuracy =</span> (Puzzles solved by any attempt) / Total puzzles
              </div>
              <div className="text-gray-500">
                = {metrics.unionCorrectCount} / {metrics.totalPuzzles}
              </div>
              <div className="text-blue-600 font-semibold">
                = {metrics.unionAccuracyPercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Transparency Note */}
          <div className="border-t border-gray-200 pt-3 text-xs text-gray-500">
            <p>
              ℹ️ This is useful for understanding the <strong>potential</strong> of a model when
              given multiple solution attempts per puzzle.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

type StatCardStatus = 'success' | 'error' | 'info' | 'muted';

const STAT_CARD_STYLES: Record<StatCardStatus, { border: string; indicator: string; text: string }> = {
  success: {
    border: 'border-green-200 bg-green-50',
    indicator: 'bg-green-500',
    text: 'text-green-700',
  },
  error: {
    border: 'border-red-200 bg-red-50',
    indicator: 'bg-red-500',
    text: 'text-red-700',
  },
  info: {
    border: 'border-blue-200 bg-blue-50',
    indicator: 'bg-blue-500',
    text: 'text-blue-700',
  },
  muted: {
    border: 'border-gray-200 bg-gray-50',
    indicator: 'bg-gray-500',
    text: 'text-gray-700',
  },
};

interface StatCardProps {
  label: string;
  value: number;
  description: string;
  status: StatCardStatus;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, description, status }) => {
  const { border, indicator, text } = STAT_CARD_STYLES[status];

  return (
    <div className={`rounded-lg border ${border} p-3 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-2xl font-bold ${text}`} aria-live="polite">
            {value}
          </p>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <span className={`mt-1 h-3 w-3 rounded-full ${indicator}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
};
