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

import React, { useEffect, useMemo, useState } from 'react';
import { determineCorrectness, isDebatable } from '@shared/utils/correctness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import {
  MessageSquare,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Link2
} from 'lucide-react';
import { AnalysisResultCard } from './AnalysisResultCard';
import type { AnalysisResultCardProps } from '@/types/puzzle';

interface AnalysisResultListCardProps extends AnalysisResultCardProps {
  onStartDebate?: (explanationId: number) => void;
  showDebateButton?: boolean;
  debateButtonText?: string; // Custom text for debate button (default: "Start Debate")
  actionButton?: React.ReactNode; // Custom action button (overrides debate button)
  compact?: boolean;
  enableExpansion?: boolean; // NEW: allow consumers to disable expanded view when context is unavailable
}

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
  enableExpansion = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Ensure expansion state resets when disabled by parent
  useEffect(() => {
    if (!enableExpansion && isExpanded) {
      setIsExpanded(false);
    }
  }, [enableExpansion, isExpanded]);

  // Use shared correctness logic (matches AccuracyRepository exactly!)
  const accuracyStatus = useMemo(() => {
    const correctness = determineCorrectness({
      modelName: result.modelName,
      isPredictionCorrect: result.isPredictionCorrect,
      multiTestAllCorrect: result.multiTestAllCorrect,
      hasMultiplePredictions: result.hasMultiplePredictions
    });

    // Map correctness status to display icons and colors
    // Only two states now: correct or incorrect (null/undefined = incorrect)
    if (correctness.isCorrect) {
      return {
        status: correctness.status,
        label: correctness.label,
        icon: CheckCircle,
        color: 'text-green-600'
      };
    } else {
      // Everything else is incorrect
      return {
        status: correctness.status,
        label: correctness.label,
        icon: result.hasMultiplePredictions ? AlertTriangle : XCircle,
        color: result.hasMultiplePredictions ? 'text-yellow-600' : 'text-red-600'
      };
    }
  }, [result]);

  const canDebate = useMemo(() => {
    // Use shared debatable logic (matches repository correctness logic)
    return isDebatable({
      modelName: result.modelName,
      isPredictionCorrect: result.isPredictionCorrect,
      multiTestAllCorrect: result.multiTestAllCorrect,
      hasMultiplePredictions: result.hasMultiplePredictions
    });
  }, [result]);

  const handleDebateClick = () => {
    if (onStartDebate && result.id) {
      onStartDebate(result.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (compact && !isExpanded) {
    return (
      <Card className="relative overflow-hidden border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.9),_rgba(255,228,230,0.85)_45%,_rgba(219,234,254,0.8))] shadow-[0_20px_48px_-32px_rgba(146,64,14,0.55)] transition-all hover:shadow-[0_26px_60px_-34px_rgba(30,64,175,0.55)] supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.92),_rgba(76,29,149,0.62)_45%,_rgba(15,118,110,0.54))] dark:shadow-[0_20px_52px_-32px_rgba(12,74,110,0.65)] dark:hover:shadow-[0_26px_68px_-36px_rgba(94,234,212,0.55)]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: Model info and accuracy */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
                    {result.modelName}
                  </Badge>
                
                {/* Rebuttal badge - shows if this is challenging another explanation */}
                {result.rebuttingExplanationId && (
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

                {/* Confidence and basic stats -DONT SHOW CONFIDENCE!!! */}
                <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-emerald-300">
                <span>
                  
                </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-emerald-300" />
                    {formatDate(result.createdAt)}
                  </span>
                </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              {/* Show custom action button if provided, otherwise show debate button */}
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
                    onClick={() => setIsExpanded(true)}
                    className="text-xs text-amber-800 hover:bg-rose-50/50 dark:text-emerald-200 dark:hover:bg-violet-900/40"
                  >
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Expand
                  </Button>
              )}
            </div>
          </div>

          {/* Quick preview of pattern description */}
            {result.patternDescription && (
              <div className="mt-3 border-t border-rose-200/70 pt-3 dark:border-violet-900/60">
                <p className="line-clamp-2 text-xs text-amber-800 dark:text-emerald-200">
                  <strong>Pattern:</strong> {result.patternDescription}
                </p>
              </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Expanded view - show full AnalysisResultCard with collapse option
    if (!enableExpansion) {
      return (
        <Card className="relative overflow-hidden border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.9),_rgba(255,228,230,0.85)_45%,_rgba(219,234,254,0.8))] shadow-[0_20px_48px_-32px_rgba(146,64,14,0.55)] transition-all hover:shadow-[0_26px_60px_-34px_rgba(30,64,175,0.55)] supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.92),_rgba(76,29,149,0.62)_45%,_rgba(15,118,110,0.54))] dark:shadow-[0_20px_52px_-32px_rgba(12,74,110,0.65)] dark:hover:shadow-[0_26px_68px_-36px_rgba(94,234,212,0.55)]">
          <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: Model info and accuracy */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
                    {result.modelName}
                  </Badge>

                {/* Rebuttal badge - shows if this is challenging another explanation */}
                {result.rebuttingExplanationId && (
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

                {/* Confidence and basic stats -DONT SHOW CONFIDENCE!!! */}
                <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-emerald-300">
                <span>

                </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-emerald-300" />
                    {formatDate(result.createdAt)}
                  </span>
                </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              {/* Show custom action button if provided, otherwise show debate button */}
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

          {/* Quick preview of pattern description */}
            {result.patternDescription && (
              <div className="mt-3 border-t border-rose-200/70 pt-3 dark:border-violet-900/60">
                <p className="line-clamp-2 text-xs text-amber-800 dark:text-emerald-200">
                  <strong>Pattern:</strong> {result.patternDescription}
                </p>
              </div>
          )}
        </CardContent>
      </Card>
    );
  }

    return (
      <div className="space-y-3">
        {/* Compact header with collapse button */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(253,230,138,0.78),_rgba(255,228,230,0.7))] px-3 py-2 dark:border-violet-900/60 dark:bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.78),_rgba(76,29,149,0.55))]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs border-amber-300/70 text-amber-800 dark:border-violet-700/70 dark:text-emerald-200">
              {result.modelName}
            </Badge>
          
          {/* Rebuttal badge - shows if this is challenging another explanation */}
          {result.rebuttingExplanationId && (
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
            {/* Show custom action button if provided, otherwise show debate button */}
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
              onClick={() => setIsExpanded(false)}
              className="text-xs text-amber-800 hover:bg-rose-50/50 dark:text-emerald-200 dark:hover:bg-violet-900/40"
            >
              Collapse
            </Button>
          </div>
        </div>

      {/* Full AnalysisResultCard with proper grid components */}
      <AnalysisResultCard
        result={result}
        modelKey={modelKey}
        model={model}
        testCases={testCases}
        eloMode={eloMode}
      />
    </div>
  );
};