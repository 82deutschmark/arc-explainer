/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Render a high-density explanation row for PuzzleAnalyst with a compact metadata header,
 *          status badges, stacked grid previews for multi-test outputs, and streamed detail expansion.
 *          Comments explain data formatting and preview selection to keep the row responsive.
 * SRP/DRY check: Pass - responsibility limited to one explanation row; reuses TinyGrid, badges, and
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
import type { ExplanationData, TestCase } from '@/types/puzzle';

interface ExplanationGridRowProps {
  explanation: ExplanationData;
  testCases: TestCase[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAlternate?: boolean;
}

export default function ExplanationGridRow({
  explanation,
  testCases,
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

  const inputTokens = explanation.inputTokens ?? null;
  const outputTokens = explanation.outputTokens ?? null;
  const reasoningTokens = explanation.reasoningTokens ?? null;
  const totalTokens =
    explanation.totalTokens ??
    ((inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0));
  const formattedTokens = formatTokenCount(totalTokens);
  const tokenPartsText = `I ${formatTokenCount(inputTokens)} O ${formatTokenCount(outputTokens)} R ${formatTokenCount(reasoningTokens)}`;
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

  // Build a compact preview grid, favoring multi-test predictions when available.
  const predictedGrid = explanation.predictedOutputGrid ?? null;
  const multiTestGrids =
    (Array.isArray(explanation.multiTestPredictionGrids) && explanation.multiTestPredictionGrids.length > 0)
      ? explanation.multiTestPredictionGrids
      : (Array.isArray(explanation.multiplePredictedOutputs) && explanation.multiplePredictedOutputs.length > 0)
        ? explanation.multiplePredictedOutputs
        : (Array.isArray(explanation.predictedOutputGrids) && explanation.predictedOutputGrids.length > 0)
          ? explanation.predictedOutputGrids
          : [];
  const previewGrid = predictedGrid ?? multiTestGrids[0] ?? null;
  const previewCount = multiTestGrids.length;

  return (
    <>
      {/* Desktop row */}
      <div
        className={`hidden md:grid cursor-pointer transition-colors ${rowBackground} hover:bg-gray-800/60 ${borderStyle} grid-cols-[56px_minmax(200px,1fr)_96px_78px_92px_92px_86px_40px] gap-2 px-3 py-2 items-center`}
        onClick={handleExpand}
      >
        <div className="flex items-center justify-center">
          {previewGrid ? (
            <div className="relative w-12 h-12">
              {/* Stacked preview to indicate multiple predictions without cluttering the row. */}
              {previewCount > 1 && (
                <div className="absolute -top-1 -left-1 h-full w-full rounded-sm border border-gray-700/70 bg-black" />
              )}
              {previewCount > 2 && (
                <div className="absolute -top-2 -left-2 h-full w-full rounded-sm border border-gray-700/50 bg-black" />
              )}
              <div className="relative h-full w-full rounded-sm border border-gray-700 bg-black p-0.5">
                <TinyGrid grid={previewGrid} className="h-full w-full" />
              </div>
              {previewCount > 1 && (
                <span className="absolute -bottom-2 -right-2 rounded-full border border-gray-700 bg-black/90 px-2 py-0.5 text-[9px] font-semibold text-gray-200">
                  x{previewCount}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No Grid</div>
          )}
        </div>

        <div className="flex flex-col min-w-0 gap-1">
          <p className="text-[13px] font-semibold text-gray-100 truncate">
            {explanation.modelName}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
            {metadataLine}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={`flex items-center gap-1 border font-mono text-[10px] uppercase px-1 py-0.5 ${statusColorClass}`}
          >
            <StatusIcon className="w-3 h-3" />
            {statusLabel}
          </Badge>
          {explanation.hasReasoningLog && (
            <div className="flex items-center gap-1 text-[9px] text-blue-300">
              <Brain className="w-3 h-3" />
              Reasoning log
            </div>
          )}
        </div>

        <div className="text-right text-[10px] text-gray-300">
          <div className="font-semibold text-gray-100">{costText}</div>
          <div className="text-[9px] text-gray-500">Cost</div>
        </div>

        <div className="text-right text-[10px] text-gray-300">
          <div className="text-gray-200">{timestampText}</div>
          <div className="text-[9px] text-gray-500">Date</div>
        </div>

        <div className="text-right text-[10px] text-gray-300">
          <div className="inline-flex items-center justify-end gap-1 font-semibold text-gray-100">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            {formattedTokens}
          </div>
          <div className="text-[9px] text-gray-500">{tokenPartsText}</div>
        </div>

        <div className="text-right text-[10px] text-gray-300">
          <div className="font-semibold text-gray-100">{durationText}</div>
          <div className="text-[9px] text-gray-500">Time</div>
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
        className={`${rowBackground} md:hidden cursor-pointer border-b border-gray-800/60 px-3 py-2 transition-colors hover:bg-gray-800/60`}
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          {previewGrid ? (
            <div className="relative w-10 h-10 flex-shrink-0">
              {/* Stacked preview for mobile: keep the badge but reduce layers for space. */}
              {previewCount > 1 && (
                <div className="absolute -top-1 -left-1 h-full w-full rounded-sm border border-gray-700/70 bg-black" />
              )}
              <div className="relative h-full w-full rounded-sm border border-gray-700 bg-black p-0.5">
                <TinyGrid grid={previewGrid} className="h-full w-full" />
              </div>
              {previewCount > 1 && (
                <span className="absolute -bottom-2 -right-2 rounded-full border border-gray-700 bg-black/90 px-2 py-0.5 text-[9px] font-semibold text-gray-200">
                  x{previewCount}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No Grid</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-100 truncate">
              {explanation.modelName}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
              {metadataLine}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`border font-mono text-[10px] uppercase px-1 py-0.5 ${statusColorClass}`}
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

        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-gray-300">
          <div>
            <div className="font-semibold text-gray-100">{costText}</div>
            <div className="text-[9px] text-gray-500">Cost</div>
          </div>
          <div>
            <div className="text-gray-200">{timestampText}</div>
            <div className="text-[9px] text-gray-500">Date</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1 font-semibold text-gray-100">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {formattedTokens}
            </div>
            <div className="text-[9px] text-gray-500">{tokenPartsText}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-100">{durationText}</div>
            <div className="text-[9px] text-gray-500">Time</div>
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
              testCases={testCases}
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
