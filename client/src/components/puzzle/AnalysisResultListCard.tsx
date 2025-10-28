/**
 * AnalysisResultListCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T22:50:00-04:00
 * PURPOSE: Compact list version of AnalysisResultCard optimized for browsing multiple explanations.
 * Shows key information (model, confidence, accuracy, date) with optional "Start Debate" trigger.
 * Uses shared correctness logic to match AccuracyRepository. FIXED: Removed trophy emoji from
 * confidence display for cleaner UI.
 * UPDATED (2025-10-22T00:00:00Z) by gpt-5-codex: Brought back September's honey-rose gradient shell,
 * glowing separators, and jewel badges so list cards mirror the revived AnalysisResultCard warmth.
 * SRP/DRY check: Pass - Reuses shared correctness utility, focused on list display concerns only
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { determineCorrectness, isDebatable } from '@shared/utils/correctness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  MessageSquare,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { AnalysisResultCard } from './AnalysisResultCard';
import type { AnalysisResultCardProps, ExplanationData } from '@/types/puzzle';

interface AnalysisResultListCardProps extends AnalysisResultCardProps {
  onStartDebate?: (explanationId: number) => void;
  showDebateButton?: boolean;
  debateButtonText?: string; // Custom text for debate button (default: "Start Debate")
  actionButton?: React.ReactNode; // Custom action button (overrides debate button)
  compact?: boolean;
  enableExpansion?: boolean; // NEW: allow consumers to disable expanded view when context is unavailable
  initiallyExpanded?: boolean;
  highlighted?: boolean;
  loadFullResult?: () => Promise<ExplanationData | null>;
}

type DetailState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: ExplanationData | null;
  error?: string;
};

const INITIAL_DETAIL_STATE: DetailState = { status: 'idle', data: null };

const hasFullDetails = (payload: ExplanationData | null | undefined) => {
  if (!payload) {
    return false;
  }

  return Boolean(
    payload.predictedOutputGrid ||
      (Array.isArray((payload as any).multiTestPredictionGrids) && (payload as any).multiTestPredictionGrids.length > 0) ||
      payload.reasoningItems ||
      payload.reasoningLog
  );
};

export const AnalysisResultListCard: React.FC<AnalysisResultListCardProps> = ({
  result,
  modelKey,
  model,
  testCases,
  onStartDebate,
  showDebateButton = true,
  debateButtonText = 'Start Debate',
  actionButton,
  compact = true,
  eloMode = false,
  enableExpansion = true,
  initiallyExpanded = false,
  highlighted = false,
  loadFullResult
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [detailState, setDetailState] = useState<DetailState>(hasFullDetails(result) ? { status: 'ready', data: result } : INITIAL_DETAIL_STATE);
  const detailStateRef = useRef<DetailState>(hasFullDetails(result) ? { status: 'ready', data: result } : INITIAL_DETAIL_STATE);
  const isLazy = typeof loadFullResult === 'function';

  useEffect(() => {
    if (!enableExpansion && isExpanded) {
      setIsExpanded(false);
    }
  }, [enableExpansion, isExpanded]);

  useEffect(() => {
    const resetState = hasFullDetails(result)
      ? { status: 'ready', data: result } as DetailState
      : INITIAL_DETAIL_STATE;
    setDetailState(resetState);
    detailStateRef.current = resetState;
    setIsExpanded(initiallyExpanded);
  }, [result, initiallyExpanded]);

  useEffect(() => {
    detailStateRef.current = detailState;
  }, [detailState]);

  const ensureFullResult = useCallback(async () => {
    if (!isLazy || !loadFullResult) {
      return result;
    }

    const current = detailStateRef.current;
    if (current.status === 'ready' && current.data) {
      return current.data;
    }

    if (current.status === 'loading') {
      return null;
    }

    const loadingState: DetailState = { status: 'loading', data: null };
    setDetailState(loadingState);
    detailStateRef.current = loadingState;

    try {
      const fetched = await loadFullResult();
      if (!fetched) {
        throw new Error('Explanation details are unavailable.');
      }
      const readyState: DetailState = { status: 'ready', data: fetched };
      setDetailState(readyState);
      detailStateRef.current = readyState;
      return fetched;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load explanation.';
      const errorState: DetailState = { status: 'error', data: null, error: message };
      setDetailState(errorState);
      detailStateRef.current = errorState;
      return null;
    }
  }, [isLazy, loadFullResult, result]);

  useEffect(() => {
    if (initiallyExpanded && enableExpansion) {
      void ensureFullResult();
    }
  }, [initiallyExpanded, enableExpansion, ensureFullResult]);

  const activeResult = detailState.data ?? result;
  const elementId = activeResult.id ? `explanation-${activeResult.id}` : undefined;
  const highlightClasses = highlighted
    ? 'ring-4 ring-blue-400/60 ring-offset-2 ring-offset-amber-50 dark:ring-emerald-400/70 dark:ring-offset-slate-900'
    : '';

  const accuracyStatus = useMemo(() => {
    const correctness = determineCorrectness({
      modelName: activeResult.modelName,
      isPredictionCorrect: activeResult.isPredictionCorrect,
      multiTestAllCorrect: activeResult.multiTestAllCorrect,
      hasMultiplePredictions: activeResult.hasMultiplePredictions
    });

    if (correctness.isCorrect) {
      return {
        status: correctness.status,
        label: correctness.label,
        icon: CheckCircle,
        color: 'text-green-600'
      };
    }

    return {
      status: correctness.status,
      label: correctness.label,
      icon: activeResult.hasMultiplePredictions ? AlertTriangle : XCircle,
      color: activeResult.hasMultiplePredictions ? 'text-yellow-600' : 'text-red-600'
    };
  }, [activeResult]);

  const canDebate = useMemo(() => {
    return isDebatable({
      modelName: activeResult.modelName,
      isPredictionCorrect: activeResult.isPredictionCorrect,
      multiTestAllCorrect: activeResult.multiTestAllCorrect,
      hasMultiplePredictions: activeResult.hasMultiplePredictions
    });
  }, [activeResult]);

  const handleDebateClick = () => {
    if (onStartDebate && activeResult.id) {
      onStartDebate(activeResult.id);
    }
  };

  const handleExpand = () => {
    if (!enableExpansion) {
      return;
    }
    setIsExpanded(true);
    void ensureFullResult();
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  const handleRetryLoad = () => {
    void ensureFullResult();
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) {
      return 'Unknown';
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (compact && !isExpanded) {
    return (
      <Card
        id={elementId}
        data-explanation-id={activeResult.id ?? undefined}
        className={`relative overflow-hidden border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.9),_rgba(255,228,230,0.85)_45%,_rgba(219,234,254,0.8))] shadow-[0_20px_48px_-32px_rgba(146,64,14,0.55)] transition-all hover:shadow-[0_26px_60px_-34px_rgba(30,64,175,0.55)] supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.92),_rgba(76,29,149,0.62)_45%,_rgba(15,118,110,0.54))] dark:shadow-[0_20px_52px_-32px_rgba(12,74,110,0.65)] dark:hover:shadow-[0_26px_68px_-36px_rgba(94,234,212,0.55)] ${highlightClasses} rounded-2xl`}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
                  {activeResult.modelName}
                </Badge>

                {activeResult.rebuttingExplanationId && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Rebuttal
                  </Badge>
                )}

                <div className="flex items-center gap-1 text-amber-900 dark:text-emerald-200">
                  <accuracyStatus.icon className={`h-4 w-4 ${accuracyStatus.color}`} />
                  <span className={`text-xs font-medium ${accuracyStatus.color}`}>{accuracyStatus.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-emerald-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600 dark:text-emerald-300" />
                  {formatDate(activeResult.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {actionButton ? (
                actionButton
              ) : (
                showDebateButton && canDebate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDebateClick}
                    className="text-xs border-rose-200/70 text-rose-700 hover:bg-rose-50/60 dark:border-violet-800/70 dark:text-emerald-200 dark:hover:bg-violet-900/40"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {debateButtonText}
                  </Button>
                )
              )}

              {enableExpansion && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExpand}
                  className="text-xs text-amber-800 hover:bg-rose-50/50 dark:text-emerald-200 dark:hover:bg-violet-900/40"
                >
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Expand
                </Button>
              )}
            </div>
          </div>

          {activeResult.patternDescription && (
            <div className="mt-3 border-t border-rose-200/70 pt-3 dark:border-violet-900/60">
              <p className="line-clamp-2 text-xs text-amber-800 dark:text-emerald-200">
                <strong>Pattern:</strong> {activeResult.patternDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!enableExpansion) {
    return (
      <Card
        id={elementId}
        data-explanation-id={activeResult.id ?? undefined}
        className={`relative overflow-hidden border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.9),_rgba(255,228,230,0.85)_45%,_rgba(219,234,254,0.8))] shadow-[0_20px_48px_-32px_rgba(146,64,14,0.55)] transition-all hover:shadow-[0_26px_60px_-34px_rgba(30,64,175,0.55)] supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.92),_rgba(76,29,149,0.62)_45%,_rgba(15,118,110,0.54))] dark:shadow-[0_20px_52px_-32px_rgba(12,74,110,0.65)] dark:hover:shadow-[0_26px_68px_-36px_rgba(94,234,212,0.55)] ${highlightClasses} rounded-2xl`}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
                  {activeResult.modelName}
                </Badge>

                {activeResult.rebuttingExplanationId && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Rebuttal
                  </Badge>
                )}

                <div className="flex items-center gap-1 text-amber-900 dark:text-emerald-200">
                  <accuracyStatus.icon className={`h-4 w-4 ${accuracyStatus.color}`} />
                  <span className={`text-xs font-medium ${accuracyStatus.color}`}>{accuracyStatus.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-emerald-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600 dark:text-emerald-300" />
                  {formatDate(activeResult.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {actionButton ? (
                actionButton
              ) : (
                showDebateButton && canDebate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDebateClick}
                    className="text-xs border-rose-200/70 text-rose-700 hover:bg-rose-50/60 dark:border-violet-800/70 dark:text-emerald-200 dark:hover:bg-violet-900/40"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {debateButtonText}
                  </Button>
                )
              )}
            </div>
          </div>

          {activeResult.patternDescription && (
            <div className="mt-3 border-t border-rose-200/70 pt-3 dark:border-violet-900/60">
              <p className="line-clamp-2 text-xs text-amber-800 dark:text-emerald-200">
                <strong>Pattern:</strong> {activeResult.patternDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      id={elementId}
      data-explanation-id={activeResult.id ?? undefined}
      className={`space-y-3 rounded-2xl ${highlightClasses}`}
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.78),_rgba(255,228,230,0.7))] px-3 py-2 dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.78),_rgba(76,29,149,0.55))]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
            {activeResult.modelName}
          </Badge>

          {activeResult.rebuttingExplanationId && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Rebuttal
            </Badge>
          )}

          <div className="flex items-center gap-1 text-amber-900 dark:text-emerald-200">
            <accuracyStatus.icon className={`h-4 w-4 ${accuracyStatus.color}`} />
            <span className={`text-xs font-medium ${accuracyStatus.color}`}>{accuracyStatus.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionButton ? (
            actionButton
          ) : (
            showDebateButton && canDebate && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDebateClick}
                className="text-xs border-rose-200/70 text-rose-700 hover:bg-rose-50/60 dark:border-violet-800/70 dark:text-emerald-200 dark:hover:bg-violet-900/40"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {debateButtonText}
              </Button>
            )
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCollapse}
            className="text-xs text-amber-800 hover:bg-rose-50/50 dark:text-emerald-200 dark:hover:bg-violet-900/40"
          >
            Collapse
          </Button>
        </div>
      </div>

      {isLazy && detailState.status === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-200/70 bg-amber-50/40 p-4 text-xs text-amber-700 dark:border-violet-800/60 dark:bg-slate-900/40 dark:text-emerald-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading explanation details…
        </div>
      )}

      {isLazy && detailState.status === 'error' && (
        <div role="alert" className="alert alert-warning flex items-start gap-3 text-xs">
          <div className="flex-1">
            <p className="font-medium">Unable to load full explanation.</p>
            <p className="opacity-80">{detailState.error ?? 'Please try again.'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRetryLoad}>
            Retry
          </Button>
        </div>
      )}

      {(!isLazy || detailState.status === 'ready') && (
        <AnalysisResultCard
          result={activeResult}
          modelKey={modelKey}
          model={model}
          testCases={testCases}
          eloMode={eloMode}
        />
      )}
    </div>
  );
};
