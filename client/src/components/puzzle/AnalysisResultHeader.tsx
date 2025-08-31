import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, MessageSquare, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';

interface AnalysisResultHeaderProps extends Pick<AnalysisResultCardProps, 'result' | 'model'> {
  modelKey: string;
  feedbackSummary: { total: number; helpful: number; notHelpful: number; };
  hasFeedback: boolean;
  showExistingFeedback: boolean;
  setShowExistingFeedback: (show: boolean) => void;
  showRawDb: boolean;
  setShowRawDb: (show: boolean) => void;
  isSaturnResult: boolean;
}

const formatCost = (cost: any): string => {
  const numCost = typeof cost === 'number' ? cost : parseFloat(cost);
  if (isNaN(numCost) || numCost < 0) {
    return '$0.000';
  }
  return `$${numCost.toFixed(3)}`;
};

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  } else {
    return tokens.toString();
  }
};

export const AnalysisResultHeader: React.FC<AnalysisResultHeaderProps> = ({ 
  result, 
  model, 
  modelKey, 
  feedbackSummary, 
  hasFeedback, 
  showExistingFeedback, 
  setShowExistingFeedback, 
  showRawDb, 
  setShowRawDb,
  isSaturnResult
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
      <h5 className="font-medium">{model?.name || modelKey}</h5>
      {result.createdAt && (
        <Badge variant="outline" className="flex items-center gap-1 bg-gray-50 border-gray-200">
          <span className="text-xs text-gray-600">
            {new Date(result.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        </Badge>
      )}
      
      {result.puzzleId && (
        <Badge variant="outline" className="flex items-center gap-1 bg-gray-50 border-gray-200">
          <span className="text-xs text-gray-600">
            ID: {result.puzzleId}
          </span>
        </Badge>
      )}

      {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1 ${result.saturnSuccess ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {result.saturnSuccess ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          <span className="text-xs font-medium">
            {result.saturnSuccess ? 'SOLVED' : 'Incorrect'}
          </span>
        </Badge>
      )}

      {(result.isPredictionCorrect !== undefined || result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined) && (
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1 ${(() => {
              const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
              if (isCorrect) return 'bg-green-50 border-green-200 text-green-700';
              if (result.predictedOutputGrid || result.multiplePredictedOutputs) return 'bg-red-50 border-red-200 text-red-700';
              return 'bg-yellow-50 border-yellow-200 text-yellow-700';
            })()}`}>
          {(() => {
            const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
            if (isCorrect) return <CheckCircle className="h-3 w-3" />;
            return <XCircle className="h-3 w-3" />;
          })()}
          <span className="text-xs font-medium">
            {(() => {
              const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
              if (isCorrect) return 'CORRECT';
              if (result.predictedOutputGrid || result.multiplePredictedOutputs) return 'INCORRECT';
              return 'NOT FOUND';
            })()}
          </span>
        </Badge>
      )}
      
      {result.apiProcessingTimeMs && (
        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200">
          <span className="text-xs text-blue-600">
            {formatProcessingTimeDetailed(result.apiProcessingTimeMs)}
          </span>
        </Badge>
      )}
      
      {result.estimatedCost && (
        <Badge variant="outline" className="flex items-center gap-1 bg-green-50 border-green-200">
          <span className="text-xs text-green-600">
            Cost: {formatCost(result.estimatedCost)}
          </span>
        </Badge>
      )}
      
      {result.totalTokens && (
        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200">
          <span className="text-xs text-blue-600">
            {formatTokens(result.totalTokens)} tokens
          </span>
        </Badge>
      )}
      
      {(result.temperature !== null && result.temperature !== undefined && model?.supportsTemperature) && (
        <Badge variant="outline" className="flex items-center gap-1 bg-gray-50 border-gray-200">
          <span className="text-xs text-gray-600">
            Temp: {result.temperature}
          </span>
        </Badge>
      )}
      
      {result.reasoningEffort && (
        <Badge variant="outline" className="flex items-center gap-1 bg-purple-50 border-purple-200">
          <span className="text-xs text-purple-600">
            Effort: {result.reasoningEffort}
          </span>
        </Badge>
      )}
      
      {result.reasoningVerbosity && (
        <Badge variant="outline" className="flex items-center gap-1 bg-indigo-50 border-indigo-200">
          <span className="text-xs text-indigo-600">
            Verbosity: {result.reasoningVerbosity}
          </span>
        </Badge>
      )}
      
      {result.reasoningSummaryType && (
        <Badge variant="outline" className="flex items-center gap-1 bg-cyan-50 border-cyan-200">
          <span className="text-xs text-cyan-600">
            Summary: {result.reasoningSummaryType}
          </span>
        </Badge>
      )}
      {(hasFeedback || feedbackSummary.total > 0) && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 border-green-200">
            <ThumbsUp className="h-3 w-3 text-green-600" />
            {feedbackSummary.helpful || result.helpfulVotes || 0}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 bg-red-50 border-red-200">
            <ThumbsDown className="h-3 w-3 text-red-600" />
            {feedbackSummary.notHelpful || result.notHelpfulVotes || 0}
          </Badge>
          {feedbackSummary.total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExistingFeedback(!showExistingFeedback)}
              className="h-auto p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              View feedback
            </Button>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowRawDb(!showRawDb)}
        className="h-auto p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 ml-auto"
        title="Show the raw explanation record from the database"
      >
        {showRawDb ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" />
            Hide raw DB record
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            Show raw DB record
          </>
        )}
      </Button>
    </div>
  );
};
