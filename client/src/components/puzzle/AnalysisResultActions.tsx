import React from 'react';
import { ExplanationFeedback } from '@/components/ExplanationFeedback';
import { FeedbackViewer } from '@/components/feedback/FeedbackViewer';
import { ExplanationData } from '@/types/puzzle';
import { useFeedbackPreview } from '@/hooks/useFeedback';

interface AnalysisResultActionsProps {
  result: ExplanationData;
  showExistingFeedback: boolean;
}

export const AnalysisResultActions: React.FC<AnalysisResultActionsProps> = ({ result, showExistingFeedback }) => {
  const { feedback: existingFeedback, isLoading: feedbackLoading, error: feedbackError } = useFeedbackPreview(result.id > 0 ? result.id : undefined);
  
  const isOptimistic = result.isOptimistic;
  const status = result.status;
  const isPending = isOptimistic && (status === 'analyzing' || status === 'saving');

  if (feedbackError) {
    console.warn('Feedback preview error:', feedbackError);
  }

  // Don't show actions for pending results
  if (isPending) {
    return (
      <div className="text-sm text-gray-500 italic">
        Feedback will be available after analysis completes
      </div>
    );
  }

  // Don't show actions for error results
  if (isOptimistic && status === 'error') {
    return null;
  }

  return (
    <div className="space-y-3">
      <ExplanationFeedback puzzleId={result.puzzleId} explanationId={result.id} />
      {showExistingFeedback && (
        <div className="border-t pt-3">
          <h6 className="font-semibold mb-2">Existing Feedback</h6>
          {feedbackLoading ? (
            <p>Loading feedback...</p>
          ) : feedbackError ? (
            <p className="text-red-500">Error loading feedback.</p>
          ) : (
            <FeedbackViewer feedback={existingFeedback || []} />
          )}
        </div>
      )}
    </div>
  );
};
