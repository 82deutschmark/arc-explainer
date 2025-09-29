/**
 * AnalysisResultListCard.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-01-01
 * PURPOSE: Compact list version of AnalysisResultCard optimized for browsing multiple explanations.
 * Shows key information (model, confidence, accuracy, date) with optional "Start Debate" trigger.
 * Reuses existing AnalysisResultCard data processing logic and can expand to show full details inline.
 * SRP/DRY check: Pass - Reuses existing AnalysisResultCard logic, focused on list display concerns only
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useMemo, useState } from 'react';
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
  Trophy
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

  // Reuse existing accuracy determination logic from AnalysisResultCard
  const accuracyStatus = useMemo(() => {
    const hasMultiTest = result.hasMultiplePredictions &&
      (result.multiTestAllCorrect !== undefined || result.multiTestAverageAccuracy !== undefined);

    if (hasMultiTest) {
      if (result.multiTestAllCorrect === true) {
        return { status: 'all_correct', label: 'All Correct', icon: CheckCircle, color: 'text-green-600' };
      } else if (result.multiTestAllCorrect === false) {
        return { status: 'some_incorrect', label: 'Some Incorrect', icon: AlertTriangle, color: 'text-yellow-600' };
      }
    } else {
      if (result.isPredictionCorrect === true) {
        return { status: 'correct', label: 'Correct', icon: CheckCircle, color: 'text-green-600' };
      } else if (result.isPredictionCorrect === false) {
        return { status: 'incorrect', label: 'Incorrect', icon: XCircle, color: 'text-red-600' };
      }
    }

    return { status: 'unknown', label: 'Unknown', icon: AlertTriangle, color: 'text-gray-400' };
  }, [result]);

  const canDebate = useMemo(() => {
    // Everything is debatable unless explicitly correct
    const hasMultiTest = result.hasMultiplePredictions &&
      (result.multiTestAllCorrect !== undefined || result.multiTestAverageAccuracy !== undefined);

    const isExplicitlyCorrect = hasMultiTest
      ? result.multiTestAllCorrect === true
      : result.isPredictionCorrect === true;

    return !isExplicitlyCorrect;
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
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {result.modelName}
                </Badge>
                <div className={`flex items-center gap-1 ${accuracyStatus.color}`}>
                  <accuracyStatus.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{accuracyStatus.label}</span>
                </div>
              </div>

              {/* Confidence and basic stats */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {result.confidence}%
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {result.modelName}
          </Badge>
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

      {/* Full AnalysisResultCard */}
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