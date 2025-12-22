/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Render a high-density explanation row for PuzzleAnalyst with a compact metadata header,
 *          status badges, and streamed detail expansion. Comments explain the data formatting and
 *          animation hooks that keep the row responsive without cluttering the view.
 * SRP/DRY check: Pass – responsibility limited to one explanation row; reuses TinyGrid, badges, and
 *                AnalysisResultCard. No new hooks or fetch logic outside this component.
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import { format } from 'date-fns';
import {
  ChevronDown,
  Brain,
  Loader2,
  CheckCircle,
  Coins,
  XCircle,
} from 'lucide-react';
import { TinyGrid } from './TinyGrid';
import { AnalysisResultCard } from './AnalysisResultCard';
import { fetchExplanationById } from '@/hooks/useExplanation';
import type { ExplanationData } from '@/types/puzzle';

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

  // Load full explanation details once before expanding so we can show AnalysisResultCard inline.
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
          setDetailError('Details unavailable');
        }
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingDetails(false);
      }
    }

    onToggleExpand();
  };

  // Format currency with four decimals, defaulting to $0.0000 when missing.
  const formatCurrency = (value: number | string | null | undefined) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (value === null || value === undefined || !Number.isFinite(numeric)) {
      return '$0.0000';
    }
    return `$${numeric.toFixed(4)}`;
  };

  // Convert token totals into human-readable strings (k/M) for compact display.
  const formatTokenCount = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/A';
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    return value.toString();
  };

  // Safely parse confidence (number or percentage string) into a consistent label.
  const formatConfidenceLabel = (value: number | string | undefined) => {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized =
      typeof value === 'string' ? value.replace('%', '').trim() : value;
    const parsed = typeof normalized === 'number' ? normalized : Number(normalized);
    if (Number.isFinite(parsed)) {
      const rounded = parsed.toFixed(parsed % 1 === 0 ? 0 : 1);
      return `${rounded}%`;
    }
    return null;
  };

  const totalTokens =
    explanation.totalTokens ??
    ((explanation.inputTokens ?? 0) + (explanation.outputTokens ?? 0));
  const formattedTokens = formatTokenCount(totalTokens);
  const costText = formatCurrency(explanation.estimatedCost);
  const timestampText = explanation.createdAt
    ? format(new Date(explanation.createdAt), 'MMM d, HH:mm')
    : 'N/A';
  const durationText = explanation.apiProcessingTimeMs
    ? formatProcessingTimeDetailed(explanation.apiProcessingTimeMs)
    : 'N/A';
  const confidenceLabel = formatConfidenceLabel(explanation.confidence);

  const statusLabel = explanation.multiTestAllCorrect ?? explanation.isPredictionCorrect
    ? 'CORRECT'
    : 'INCORRECT';
  const isCorrect = statusLabel === 'CORRECT';
  const statusColorClass = isCorrect
    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
    : 'bg-rose-500/20 text-rose-200 border-rose-500/40';
  const StatusIcon = isCorrect ? CheckCircle : XCircle;

  const metadataLineParts = [
    explanation.reasoningEffort,
    explanation.reasoningVerbosity,
    explanation.reasoningSummaryType,
  ].filter(Boolean);
  if (confidenceLabel) {
    metadataLineParts.push(`Conf ${confidenceLabel}`);
  }
  const metadataLine = metadataLineParts.length
    ? metadataLineParts.join(' | ')
    : 'Reasoning - N/A';

  const rowBackground = isAlternate ? 'bg-gray-900/40' : 'bg-transparent';
  const borderStyle = isExpanded ? 'border-b border-gray-700/70' : 'border-b border-gray-800/60';

  return (
    <>
      {/* Desktop row */}
      <div
        className={`hidden md:grid cursor-pointer transition-colors ${rowBackground} hover:bg-gray-800/60 ${borderStyle} grid-cols-[72px_minmax(200px,1fr)_110px_90px_110px_110px_90px_48px] gap-3 px-4 py-3 items-center`}
        onClick={handleExpand}
      >
        <div className="flex items-center justify-center">
          {explanation.predictedOutputGrid ? (
            <div className="w-16 h-16 border border-gray-700 rounded-sm">
              <TinyGrid grid={explanation.predictedOutputGrid} />
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No Grid</div>
          )}
        </div>

        <div className="flex flex-col min-w-0 gap-1">
          <p className="text-sm font-semibold text-gray-100 truncate">
            {explanation.modelName}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
            {metadataLine}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={`flex items-center gap-1 border font-mono text-[11px] uppercase px-1 py-1 ${statusColorClass}`}
          >
            <StatusIcon className="w-3 h-3" />
            {statusLabel}
          </Badge>
          {explanation.hasReasoningLog && (
            <div className="flex items-center gap-1 text-[10px] text-blue-300">
              <Brain className="w-3 h-3" />
              Reasoning log
            </div>
          )}
        </div>

        <div className="text-right text-[11px] text-gray-300">
          <div className="font-semibold text-gray-100">{costText}</div>
          <div className="text-[10px] text-gray-500">Cost</div>
        </div>

        <div className="text-right text-[11px] text-gray-300">
          <div className="font-semibold text-gray-100">{timestampText}</div>
          <div className="text-[10px] text-gray-500">Created</div>
        </div>

        <div className="text-right text-[11px] text-gray-300">
          <div className="inline-flex items-center justify-end gap-1 font-semibold text-gray-100">
            <Coins className="w-4 h-4 text-amber-400" />
            {formattedTokens}
          </div>
          <div className="text-[10px] text-gray-500">Tokens</div>
        </div>

        <div className="text-right text-[11px] text-gray-300">
          <div className="font-semibold text-gray-100">{durationText}</div>
          <div className="text-[10px] text-gray-500">Latency</div>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleExpand();
            }}
            disabled={isLoadingDetails}
            className="p-1 rounded hover:bg-gray-700/40 transition-colors"
          >
            {isLoadingDetails ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            )}
          </button>
        </div>
      </div>

      {/* Mobile view */}
      <div
        className={`${rowBackground} md:hidden cursor-pointer border-b border-gray-800/60 px-4 py-3 transition-colors hover:bg-gray-800/60`}
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          {explanation.predictedOutputGrid ? (
            <div className="w-12 h-12 border border-gray-700 rounded-sm flex-shrink-0">
              <TinyGrid grid={explanation.predictedOutputGrid} />
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No Grid</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {explanation.modelName}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
              {metadataLine}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`border font-mono text-[11px] uppercase px-1 py-1 ${statusColorClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              {statusLabel}
            </Badge>
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleExpand();
              }}
              disabled={isLoadingDetails}
            >
              {isLoadingDetails ? (
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              ) : (
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
          <div>
            <div className="font-semibold text-gray-100">{costText}</div>
            <div className="text-[10px] text-gray-500">Cost</div>
          </div>
          <div>
            <div className="font-semibold text-gray-100">{timestampText}</div>
            <div className="text-[10px] text-gray-500">Created</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1 font-semibold text-gray-100">
              <Coins className="w-4 h-4 text-amber-400" />
              {formattedTokens}
            </div>
            <div className="text-[10px] text-gray-500">Tokens</div>
          </div>
          <div>
            <div className="font-semibold text-gray-100">{durationText}</div>
            <div className="text-[10px] text-gray-500">Latency</div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          className={`border-t border-gray-800/60 px-4 py-4 ${rowBackground}`}
        >
          {detailError ? (
            <div className="rounded border border-rose-700/40 bg-rose-900/40 px-3 py-2 text-sm text-rose-200">
              Details error: {detailError}
            </div>
          ) : detailedExplanation ? (
            <AnalysisResultCard
              result={detailedExplanation}
              modelKey={detailedExplanation.modelName}
              testCases={[]}
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
