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
import { NewModelComparisonResults } from './NewModelComparisonResults';
import { ModelComparisonResult } from '@/pages/AnalyticsOverview';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle } from 'lucide-react';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Model Comparison Results</DialogTitle>
          <DialogDescription>
            {comparisonResult ? (
              <>
                Comparing {comparisonResult.summary.model1Name}, {comparisonResult.summary.model2Name}
                {comparisonResult.summary.model3Name && `, ${comparisonResult.summary.model3Name}`}
                {comparisonResult.summary.model4Name && `, ${comparisonResult.summary.model4Name}`} on{' '}
                {comparisonResult.summary.dataset} dataset ({comparisonResult.summary.totalPuzzles} puzzles)
              </>
            ) : (
              'Loading comparison data...'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span className="text-lg">Comparing models...</span>
          </div>
        )}

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && comparisonResult && (
          <div className="space-y-2">
            {/* Summary Statistics - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <div className="text-2xl font-bold text-green-700">
                  {comparisonResult.summary.allCorrect}
                </div>
                <div className="text-xs font-medium text-green-600">All Correct</div>
                <div className="text-[10px] text-green-500">Every model</div>
                {/* TODO: Add badges with aggregate metrics per category:
                    - Total cost for puzzles all models got correct
                    - Average time across models
                    - Compare token usage between models
                */}
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <div className="text-2xl font-bold text-red-700">
                  {comparisonResult.summary.allIncorrect}
                </div>
                <div className="text-xs font-medium text-red-600">All Incorrect</div>
                <div className="text-[10px] text-red-500">Every model failed</div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="text-2xl font-bold text-gray-700">
                  {comparisonResult.summary.allNotAttempted}
                </div>
                <div className="text-xs font-medium text-gray-600">Not Attempted</div>
                <div className="text-[10px] text-gray-500">No model tried</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <div className="text-2xl font-bold text-blue-700">
                  {(comparisonResult.summary.model1OnlyCorrect || 0) + 
                   (comparisonResult.summary.model2OnlyCorrect || 0) + 
                   (comparisonResult.summary.model3OnlyCorrect || 0) + 
                   (comparisonResult.summary.model4OnlyCorrect || 0)}
                </div>
                <div className="text-xs font-medium text-blue-600">Unique Solves</div>
                <div className="text-[10px] text-blue-500">Only one model</div>
              </div>
            </div>

            {/* Detailed Matrix */}
            <NewModelComparisonResults result={comparisonResult} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
