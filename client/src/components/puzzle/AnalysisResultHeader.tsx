/**
 * AnalysisResultHeader.tsx
 *
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Displays header information for analysis result cards including model badges,
 * correctness status, timestamps, processing time, costs, and feedback summaries.
 * Handles ELO mode hiding and multi-test correctness determination.
 * ADDED: Copy Link button for deep linking to specific explanations via query params.
 * UPDATED (2025-12-24) by Codex (GPT-5): Adds dark theme variants for Puzzle Analyst cards.
 * SRP/DRY check: Pass - Single responsibility (header display), reuses utility functions
 * shadcn/ui: Pass - Converted to shadcn badges and buttons
 */

import React from 'react';
import { Link } from 'wouter';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  AlertCircle,
  MessageSquareWarning,
  Link2,
  Brain,
} from 'lucide-react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import { useToast } from '@/hooks/use-toast';
import type { ExplanationData } from '@/types/puzzle';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnalysisResultHeaderProps extends Pick<AnalysisResultCardProps, 'result' | 'model'> {
  modelKey: string;
  feedbackSummary: { total: number; helpful: number; notHelpful: number };
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
  }
  return tokens.toString();
};

const isReasoningModel = (modelName: string): boolean => {
  const normalized = modelName.toLowerCase();
  return (
    normalized.includes('gpt-5') ||
    normalized.includes('o3') ||
    normalized.includes('o4') ||
    normalized.includes('grok-4')
  );
};

const canRefineAnalysis = (result: ExplanationData): boolean => {
  if (!isReasoningModel(result.modelName)) return false;
  if (!result.providerResponseId) return false;

  const createdDate = new Date(result.createdAt);
  const implementationDate = new Date('2025-10-06T00:00:00Z');
  if (createdDate < implementationDate) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (createdDate < thirtyDaysAgo) return false;

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
  eloMode = false,
}) => {
  const { toast } = useToast();

  const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
  const hasPrediction = !!(result.predictedOutputGrid || result.multiplePredictedOutputs);
  const showChallengeBadge = !eloMode && !isCorrect && hasPrediction && !!result.puzzleId;

  const handleCopyLink = () => {
    if (!result.id || !result.puzzleId) return;
    const url = `${window.location.origin}/task/${result.puzzleId}?highlight=${result.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link copied!',
        description: `Direct link to explanation #${result.id} copied to clipboard`,
      });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-slate-900 dark:text-slate-100">
      {!eloMode && <div className={cn('h-3 w-3 rounded-full', model?.color || 'bg-gray-500')} />}
      <h5 className="font-medium">{eloMode ? 'AI Model' : model?.name || modelKey}</h5>

      {result.createdAt && (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-600 dark:bg-slate-900/70 dark:text-slate-300 dark:border-slate-700/60"
        >
          {new Date(result.createdAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Badge>
      )}

      {result.isOptimistic && result.status && (
        <Badge
          variant="outline"
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            'animate-pulse',
            result.status === 'analyzing' && 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800/60 dark:text-blue-200',
            result.status === 'saving' && 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/60 dark:border-orange-800/60 dark:text-orange-200',
            result.status === 'completed' && 'bg-green-50 border-green-200 text-green-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200',
            result.status === 'error' && 'bg-red-50 border-red-200 text-red-700 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-200',
            !['analyzing', 'saving', 'completed', 'error'].includes(result.status) &&
              'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-900/70 dark:border-slate-700/60 dark:text-slate-200',
          )}
        >
          {result.status === 'analyzing' && <Clock className="h-3 w-3" />}
          {result.status === 'saving' && <Database className="h-3 w-3" />}
          {result.status === 'completed' && <CheckCircle className="h-3 w-3" />}
          {result.status === 'error' && <AlertCircle className="h-3 w-3" />}
          {result.status?.toUpperCase()}
        </Badge>
      )}

      {result.puzzleId && <ClickablePuzzleBadge puzzleId={result.puzzleId} variant="neutral" clickable={false} />}

      {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
        <Badge
          variant="outline"
          className={cn(
            'flex items-center gap-1',
            result.saturnSuccess
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-700 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-200',
          )}
        >
          {result.saturnSuccess ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {result.saturnSuccess ? 'SOLVED' : 'Incorrect'}
        </Badge>
      )}

      {isGroverResult && result.iterationCount && (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60"
        >
          🌀 GROVER: {result.iterationCount} iterations
        </Badge>
      )}

      {!eloMode && (result.isPredictionCorrect !== undefined || result.multiTestAllCorrect !== undefined) && (
        <>
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-1',
              isCorrect
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200'
                : hasPrediction
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-200'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-amber-950/50 dark:border-amber-800/60 dark:text-amber-200',
            )}
          >
            {isCorrect ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isCorrect ? 'CORRECT' : hasPrediction ? 'INCORRECT' : 'NOT FOUND'}
          </Badge>

          {showChallengeBadge && (
            <Link href={`/debate/${result.puzzleId}`}>
              <Badge
                variant="outline"
                className="flex cursor-pointer items-center gap-1 bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800/60 dark:hover:bg-orange-900/60"
              >
                <MessageSquareWarning className="h-3 w-3" />
                Get a second opinion!
              </Badge>
            </Link>
          )}

          {canRefineAnalysis(result) && (
            <Link href={`/discussion/${result.puzzleId}?select=${result.id}`}>
              <Badge
                variant="outline"
                className="flex cursor-pointer items-center gap-1 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 transition-all hover:from-purple-100 hover:to-blue-100 dark:from-slate-900/70 dark:to-slate-900/70 dark:text-slate-200 dark:border-slate-700/60 dark:hover:from-slate-900 dark:hover:to-slate-800"
              >
                <Brain className="h-3 w-3" />
                Refine This Analysis
              </Badge>
            </Link>
          )}
        </>
      )}

      {model?.releaseDate && (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-600 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700/60"
        >
          ℹ️ {model.releaseDate}
        </Badge>
      )}

      {result.apiProcessingTimeMs && (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-600 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700/60"
        >
          {formatProcessingTimeDetailed(result.apiProcessingTimeMs)}
        </Badge>
      )}

      {result.estimatedCost && (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60"
        >
          Cost: {formatCost(result.estimatedCost)}
        </Badge>
      )}

      {result.totalTokens && (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-600 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700/60"
        >
          {formatTokens(result.totalTokens)} tokens
        </Badge>
      )}

      {result.temperature !== null && result.temperature !== undefined && model?.supportsTemperature && (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-600 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-700/60"
        >
          Temp: {result.temperature}
        </Badge>
      )}

      {result.reasoningEffort && (
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-600 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800/60"
        >
          Effort: {result.reasoningEffort}
        </Badge>
      )}

      {result.reasoningVerbosity && (
        <Badge
          variant="outline"
          className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800/60"
        >
          Verbosity: {result.reasoningVerbosity}
        </Badge>
      )}

      {result.reasoningSummaryType && (
        <Badge
          variant="outline"
          className="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-800/60"
        >
          Summary: {result.reasoningSummaryType}
        </Badge>
      )}

      {(hasFeedback || feedbackSummary.total > 0) && (
        <div className="flex items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className="bg-green-50 text-green-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60"
          >
            <ThumbsUp className="h-3 w-3" />
            {feedbackSummary.helpful || result.helpfulVotes || 0}
          </Badge>
          <Badge
            variant="outline"
            className="bg-red-50 text-red-600 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60"
          >
            <ThumbsDown className="h-3 w-3" />
            {feedbackSummary.notHelpful || result.notHelpfulVotes || 0}
          </Badge>
          {feedbackSummary.total > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-blue-600 hover:text-blue-800 dark:text-sky-300 dark:hover:text-sky-100"
              onClick={() => setShowExistingFeedback(!showExistingFeedback)}
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              View feedback
            </Button>
          )}
        </div>
      )}

      {result.id && result.puzzleId && !eloMode && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-blue-600 hover:text-blue-800 dark:text-sky-300 dark:hover:text-sky-100"
          onClick={handleCopyLink}
          title="Copy direct link to this explanation"
        >
          <Link2 className="mr-1 h-3 w-3" />
          Copy Link
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-auto px-2 py-1 text-gray-600 hover:text-gray-800 dark:text-slate-300 dark:hover:text-slate-100',
          !showChallengeBadge && !result.id && 'ml-auto',
        )}
        onClick={() => setShowRawDb(!showRawDb)}
        title="Show the raw explanation record from the database"
      >
        {showRawDb ? (
          <>
            <ChevronUp className="mr-1 h-3 w-3" />
            Hide raw DB record
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-3 w-3" />
            Show raw DB record
          </>
        )}
      </Button>
    </div>
  );
};
