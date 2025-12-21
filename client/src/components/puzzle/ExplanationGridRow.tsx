/**
 * Author: Claude Code (Haiku 4.5)
 * Date: 2025-12-21
 * PURPOSE: High-density grid row component for displaying individual explanation summaries
 *          in the Puzzle Analyst page. Shows compact metrics with optional expansion
 *          for full details.
 * SRP/DRY check: Pass - Focused only on row rendering; reuses TinyGrid, AnalysisResultCard;
 *                delegates detail loading to parent via fetchExplanationById pattern.
 */

import React, { useState } from 'react';
import { ChevronDown, Brain, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { TinyGrid } from './TinyGrid';
import { AnalysisResultCard } from './AnalysisResultCard';
import { Badge } from '@/components/ui/badge';
import { fetchExplanationById } from '@/hooks/useExplanation';
import type { ExplanationData, TestCase } from '@/types/puzzle';

interface ExplanationGridRowProps {
  explanation: ExplanationData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAlternate?: boolean;
}

export default function ExplanationGridRow({
  explanation,
  isExpanded,
  onToggleExpand,
  isAlternate = false,
}: ExplanationGridRowProps) {
  const [detailedExplanation, setDetailedExplanation] = useState<ExplanationData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Load full explanation details on first expand
  const handleExpand = async () => {
    if (isExpanded) {
      onToggleExpand();
      return;
    }

    if (!detailedExplanation && !isLoadingDetails) {
      setIsLoadingDetails(true);
      setDetailError(null);
      try {
        const full = await fetchExplanationById(explanation.id);
        if (full) {
          setDetailedExplanation(full);
        } else {
          setDetailError('Failed to load details');
        }
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingDetails(false);
      }
    }

    onToggleExpand();
  };

  // Format cost as currency
  const costText = explanation.estimatedCost
    ? `$${explanation.estimatedCost.toFixed(4)}`
    : '$0.0000';

  // Format timestamp
  const timestampText = explanation.createdAt
    ? format(new Date(explanation.createdAt), 'MMM d, HH:mm')
    : '—';

  // Calculate total tokens
  const totalTokens = (explanation.inputTokens ?? 0) + (explanation.outputTokens ?? 0);
  const tokensText = totalTokens > 0 ? `${totalTokens}` : '—';

  // Determine correctness status
  const isCorrect = explanation.isPredictionCorrect === true;
  const statusColor = isCorrect ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30';
  const statusIcon = isCorrect ? '✓' : '✗';

  return (
    <>
      {/* Compact Row */}
      <div
        className={`hidden md:grid md:grid-cols-[80px_1fr_120px_100px_140px_80px_100px_50px] gap-2 px-4 py-3 items-center cursor-pointer transition-colors ${
          isAlternate ? 'bg-gray-800/20' : 'bg-transparent'
        } hover:bg-gray-800/40 border-b border-gray-800/50`}
        onClick={handleExpand}
      >
        {/* Grid Thumbnail */}
        <div className="flex items-center justify-center">
          {explanation.predictedOutputGrid ? (
            <div className="w-14 h-14 border border-gray-700 rounded">
              <TinyGrid grid={explanation.predictedOutputGrid} />
            </div>
          ) : (
            <div className="text-xs text-gray-500">—</div>
          )}
        </div>

        {/* Model Name */}
        <div className="truncate">
          <span className="text-sm text-gray-200 font-medium truncate block">
            {explanation.modelName}
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-center">
          <Badge
            variant="outline"
            className={`${statusColor} border font-mono text-xs py-1`}
          >
            {statusIcon}
          </Badge>
        </div>

        {/* Cost */}
        <div className="text-right">
          <span className="text-xs text-gray-300 font-mono">{costText}</span>
        </div>

        {/* Timestamp */}
        <div className="text-right">
          <span className="text-xs text-gray-400">{timestampText}</span>
        </div>

        {/* Token Count */}
        <div className="text-right">
          <span className="text-xs text-gray-400 font-mono">{tokensText}</span>
        </div>

        {/* Reasoning Indicator */}
        <div className="flex items-center justify-center">
          {explanation.hasReasoningLog && (
            <Brain className="w-4 h-4 text-blue-400" />
          )}
        </div>

        {/* Expand Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExpand();
            }}
            className="p-1 rounded hover:bg-gray-700/50 transition-colors"
            disabled={isLoadingDetails}
          >
            {isLoadingDetails ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Compact Row */}
      <div
        className={`md:hidden px-4 py-3 cursor-pointer transition-colors ${
          isAlternate ? 'bg-gray-800/20' : 'bg-transparent'
        } hover:bg-gray-800/40 border-b border-gray-800/50`}
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3 mb-2">
          {explanation.predictedOutputGrid && (
            <div className="w-12 h-12 border border-gray-700 rounded flex-shrink-0">
              <TinyGrid grid={explanation.predictedOutputGrid} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate">
              <span className="text-sm text-gray-200 font-medium truncate">
                {explanation.modelName}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {timestampText} • {costText}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              variant="outline"
              className={`${statusColor} border font-mono text-xs`}
            >
              {statusIcon}
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              disabled={isLoadingDetails}
            >
              {isLoadingDetails ? (
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              ) : (
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          className={`border-t border-gray-800/50 px-4 py-4 ${
            isAlternate ? 'bg-gray-800/20' : 'bg-transparent'
          }`}
        >
          {detailError ? (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              Error loading details: {detailError}
            </div>
          ) : detailedExplanation ? (
            <AnalysisResultCard
              result={detailedExplanation}
              modelKey={detailedExplanation.modelName}
              testCases={[]} // Empty test cases for read-only mode
              eloMode={false}
            />
          ) : (
            <div className="text-sm text-gray-400">Loading details...</div>
          )}
        </div>
      )}
    </>
  );
}
