/**
 * AnalysisResultListCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T22:50:00-04:00
 * PURPOSE: Compact list version of AnalysisResultCard optimized for browsing multiple explanations.
 * Shows key information (model, confidence, accuracy, date) with optional "Start Debate" trigger.
 * Uses shared correctness logic to match AccuracyRepository. FIXED: Removed trophy emoji from
 * confidence display for cleaner UI.
 * SRP/DRY check: Pass - Reuses shared correctness utility, focused on list display concerns only
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useMemo, useState } from 'react';
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
  compact?: boolean;
}

export const AnalysisResultListCard: React.FC<AnalysisResultListCardProps> = ({
  result,
  modelKey,
  model,
  testCases,
  onStartDebate,
  showDebateButton = true,
  compact = true,
  eloMode = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: Model info and accuracy */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {result.modelName}
                </Badge>
                
                {/* Rebuttal badge - shows if this is challenging another explanation */}
                {result.rebuttingExplanationId && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Rebuttal
                  </Badge>
                )}
                
                <div className={`flex items-center gap-1 ${accuracyStatus.color}`}>
                  <accuracyStatus.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{accuracyStatus.label}</span>
                </div>
              </div>

              {/* Confidence and basic stats -DONT SHOW CONFIDENCE!!! */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>
                  
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(result.createdAt)}
                </span>
              </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              {showDebateButton && canDebate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDebateClick}
                  className="text-xs"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Start Debate
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(true)}
                className="text-xs"
              >
                <ChevronRight className="h-3 w-3 mr-1" />
                Expand
              </Button>
            </div>
          </div>

          {/* Quick preview of pattern description */}
          {result.patternDescription && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-600 line-clamp-2">
                <strong>Pattern:</strong> {result.patternDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Expanded view - show full AnalysisResultCard with collapse option
  return (
    <div className="space-y-2">
      {/* Compact header with collapse button */}
      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-xs">
            {result.modelName}
          </Badge>
          
          {/* Rebuttal badge - shows if this is challenging another explanation */}
          {result.rebuttingExplanationId && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Rebuttal
            </Badge>
          )}
          
          <div className={`flex items-center gap-1 ${accuracyStatus.color}`}>
            <accuracyStatus.icon className="h-4 w-4" />
            <span className="text-xs font-medium">{accuracyStatus.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showDebateButton && canDebate && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDebateClick}
              className="text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Start Debate
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(false)}
            className="text-xs"
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