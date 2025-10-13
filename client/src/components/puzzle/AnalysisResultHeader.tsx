/**
 * AnalysisResultHeader.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:48:00Z
 * PURPOSE: Displays header information for analysis result cards including model badges,
 * correctness status, timestamps, processing time, costs, and feedback summaries.
 * Handles ELO mode hiding and multi-test correctness determination.
 * ADDED: Copy Link button for deep linking to specific explanations via query params.
 * SRP/DRY check: Pass - Single responsibility (header display), reuses utility functions
 * shadcn/ui: Pass - Converted to DaisyUI badge and button
 */

import React from 'react';
import { Link } from 'wouter';
import { ThumbsUp, ThumbsDown, MessageSquare, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Database, AlertCircle, MessageSquareWarning, Link2, Brain } from 'lucide-react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import { useToast } from '@/hooks/use-toast';
import type { ExplanationData } from '@/types/puzzle';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';

interface AnalysisResultHeaderProps extends Pick<AnalysisResultCardProps, 'result' | 'model'> {
  modelKey: string;
  feedbackSummary: { total: number; helpful: number; notHelpful: number; };
  hasFeedback: boolean;
  showExistingFeedback: boolean;
  setShowExistingFeedback: (show: boolean) => void;
  showRawDb: boolean;
  setShowRawDb: (show: boolean) => void;
  isSaturnResult: boolean;
  isGroverResult?: boolean;
  eloMode?: boolean;
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

// Check if model supports reasoning persistence (server-side reasoning storage)
const isReasoningModel = (modelName: string): boolean => {
  const normalized = modelName.toLowerCase();
  return normalized.includes('gpt-5') ||
         normalized.includes('o3') ||
         normalized.includes('o4') ||
         normalized.includes('grok-4');
};

// Check if explanation is eligible for progressive reasoning refinement
// Must meet ALL criteria: reasoning model, valid response ID, recent, within retention window
const canRefineAnalysis = (result: ExplanationData): boolean => {
  // Must be a reasoning model
  if (!isReasoningModel(result.modelName)) return false;

  // Must have a provider response ID (conversation chaining support)
  if (!result.providerResponseId) return false;

  // Must be created after Oct 6, 2025 (when feature was implemented)
  const createdDate = new Date(result.createdAt);
  const implementationDate = new Date('2025-10-06T00:00:00Z');
  if (createdDate < implementationDate) return false;

  // Must be within 30-day retention window (provider-side storage limit)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (createdDate < thirtyDaysAgo) return false;

  // Must have puzzle ID and explanation ID for linking
  if (!result.puzzleId || !result.id) return false;

  return true;
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
  isSaturnResult,
  isGroverResult = false,
  eloMode = false
}) => {
  const { toast } = useToast();
  
  // Determine if challenge badge will be shown (for layout purposes)
  const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
  const hasPrediction = !!(result.predictedOutputGrid || result.multiplePredictedOutputs);
  const showChallengeBadge = !eloMode && !isCorrect && hasPrediction && !!result.puzzleId;

  // Copy direct link to this explanation
  const handleCopyLink = () => {
    if (!result.id || !result.puzzleId) return;
    const url = `${window.location.origin}/puzzle/${result.puzzleId}?highlight=${result.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link copied!',
        description: `Direct link to explanation #${result.id} copied to clipboard`,
      });
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Hide model identifying information in ELO mode for double-blind A/B testing */}
      {!eloMode && <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />}
      <h5 className="font-medium">
        {eloMode ? 'AI Model' : (model?.name || modelKey)}
      </h5>
      {result.createdAt && (
        <div className="badge badge-outline flex items-center gap-1 bg-gray-50 border-gray-200">
          <span className="text-xs text-gray-600">
            {new Date(result.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      )}
      
      {/* Status badge for optimistic updates */}
      {result.isOptimistic && result.status && (
        <div 
          className={`badge badge-outline flex items-center gap-1 animate-pulse ${
            result.status === 'analyzing' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            result.status === 'saving' ? 'bg-orange-50 border-orange-200 text-orange-700' :
            result.status === 'completed' ? 'bg-green-50 border-green-200 text-green-700' :
            result.status === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-gray-50 border-gray-200 text-gray-700'
          }`}>
          {result.status === 'analyzing' && <Clock className="h-3 w-3" />}
          {result.status === 'saving' && <Database className="h-3 w-3" />}
          {result.status === 'completed' && <CheckCircle className="h-3 w-3" />}
          {result.status === 'error' && <AlertCircle className="h-3 w-3" />}
          <span className="text-xs font-medium">
            {result.status === 'analyzing' ? 'ANALYZING' :
             result.status === 'saving' ? 'SAVING' :
             result.status === 'completed' ? 'COMPLETED' :
             result.status === 'error' ? 'ERROR' :
             'PROCESSING'}
          </span>
        </div>
      )}
      
      {result.puzzleId && (
        <ClickablePuzzleBadge puzzleId={result.puzzleId} variant="neutral" clickable={false} />
      )}

      {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
        <div 
          className={`badge badge-outline flex items-center gap-1 ${result.saturnSuccess ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {result.saturnSuccess ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          <span className="text-xs font-medium">
            {result.saturnSuccess ? 'SOLVED' : 'Incorrect'}
          </span>
        </div>
      )}

      {isGroverResult && result.iterationCount && (
        <div 
          className="badge badge-outline flex items-center gap-1 bg-green-50 border-green-200 text-green-700">
          <span className="text-xs">🔄</span>
          <span className="text-xs font-medium">
            GROVER: {result.iterationCount} iterations
          </span>
        </div>
      )}

      {!eloMode && (result.isPredictionCorrect !== undefined || result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined) && (
        <>
          <div
            className={`badge badge-outline flex items-center gap-1 ${
              isCorrect ? 'bg-green-50 border-green-200 text-green-700' :
              hasPrediction ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
            {isCorrect ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            <span className="text-xs font-medium">
              {isCorrect ? 'CORRECT' : hasPrediction ? 'INCORRECT' : 'NOT FOUND'}
            </span>
          </div>

          {/* Challenge badge - only show when incorrect */}
          {showChallengeBadge && (
            <Link href={`/debate/${result.puzzleId}`}>
              <div
                className="badge badge-outline flex items-center gap-1 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 cursor-pointer ml-auto transition-colors">
                <MessageSquareWarning className="h-3 w-3" />
                <span className="text-xs font-medium">Get a second opinion!</span>
              </div>
            </Link>
          )}

          {/* Refine This Analysis badge - only for eligible reasoning models */}
          {canRefineAnalysis(result) && (
            <Link href={`/discussion/${result.puzzleId}?select=${result.id}`}>
              <div
                className="badge badge-outline flex items-center gap-1 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 text-purple-700 hover:from-purple-100 hover:to-blue-100 cursor-pointer transition-all"
                title="Progressive reasoning with server-side memory (30-day retention)">
                <Brain className="h-3 w-3" />
                <span className="text-xs font-medium">Refine This Analysis</span>
              </div>
            </Link>
          )}
        </>
      )}
      
      {model?.releaseDate && (
        <div className="badge badge-outline flex items-center gap-1 bg-blue-50 border-blue-200">
          <span className="text-xs text-blue-600">
            📅 {model.releaseDate}
          </span>
        </div>
      )}
      
      {result.apiProcessingTimeMs && (
        <div className="badge badge-outline flex items-center gap-1 bg-blue-50 border-blue-200">
          <span className="text-xs text-blue-600">
            {formatProcessingTimeDetailed(result.apiProcessingTimeMs)}
          </span>
        </div>
      )}
      
      {result.estimatedCost && (
        <div className="badge badge-outline flex items-center gap-1 bg-green-50 border-green-200">
          <span className="text-xs text-green-600">
            Cost: {formatCost(result.estimatedCost)}
          </span>
        </div>
      )}
      
      {result.totalTokens && (
        <div className="badge badge-outline flex items-center gap-1 bg-blue-50 border-blue-200">
          <span className="text-xs text-blue-600">
            {formatTokens(result.totalTokens)} tokens
          </span>
        </div>
      )}
      
      {(result.temperature !== null && result.temperature !== undefined && model?.supportsTemperature) && (
        <div className="badge badge-outline flex items-center gap-1 bg-gray-50 border-gray-200">
          <span className="text-xs text-gray-600">
            Temp: {result.temperature}
          </span>
        </div>
      )}
      
      {result.reasoningEffort && (
        <div className="badge badge-outline flex items-center gap-1 bg-purple-50 border-purple-200">
          <span className="text-xs text-purple-600">
            Effort: {result.reasoningEffort}
          </span>
        </div>
      )}
      
      {result.reasoningVerbosity && (
        <div className="badge badge-outline flex items-center gap-1 bg-indigo-50 border-indigo-200">
          <span className="text-xs text-indigo-600">
            Verbosity: {result.reasoningVerbosity}
          </span>
        </div>
      )}
      
      {result.reasoningSummaryType && (
        <div className="badge badge-outline flex items-center gap-1 bg-cyan-50 border-cyan-200">
          <span className="text-xs text-cyan-600">
            Summary: {result.reasoningSummaryType}
          </span>
        </div>
      )}
      {(hasFeedback || feedbackSummary.total > 0) && (
        <div className="flex items-center gap-2 text-xs">
          <div className="badge badge-outline flex items-center gap-1 bg-green-50 border-green-200">
            <ThumbsUp className="h-3 w-3 text-green-600" />
            {feedbackSummary.helpful || result.helpfulVotes || 0}
          </div>
          <div className="badge badge-outline flex items-center gap-1 bg-red-50 border-red-200">
            <ThumbsDown className="h-3 w-3 text-red-600" />
            {feedbackSummary.notHelpful || result.notHelpfulVotes || 0}
          </div>
          {feedbackSummary.total > 0 && (
            <button
              className="btn btn-ghost btn-sm h-auto p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              onClick={() => setShowExistingFeedback(!showExistingFeedback)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              View feedback
            </button>
          )}
        </div>
      )}

      {result.id && result.puzzleId && !eloMode && (
        <button
          className="btn btn-ghost btn-sm h-auto p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          onClick={handleCopyLink}
          title="Copy direct link to this explanation"
        >
          <Link2 className="h-3 w-3 mr-1" />
          Copy Link
        </button>
      )}

      <button
        className={`btn btn-ghost btn-sm h-auto p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 ${!showChallengeBadge && !result.id ? 'ml-auto' : ''}`}
        onClick={() => setShowRawDb(!showRawDb)}
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
      </button>
    </div>
  );
};
