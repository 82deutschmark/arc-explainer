/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-01
 * Updated: 2026-01-01 - Fixed auto-load of detailed explanation when expanded via parent (deep linking support)
 * PURPOSE: Render a high-density explanation row for PuzzleAnalyst with compact metadata, status badges,
 *          stacked multi-test previews, client-side PNG thumbnails, and streamed detail expansion.
 *          Adds larger typography and a dark AnalysisResultCard theme for the Puzzle Analyst view.
 *          Comments explain data formatting and preview selection to keep the row responsive.
 * SRP/DRY check: Pass - responsibility limited to one explanation row; reuses TinyGrid, badges, and
 *                AnalysisResultCard. Auto-loads details when expanded via parent useEffect.
 */

import React, { useMemo, useState } from 'react';
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
import { ARC_COLORS_TUPLES } from '@shared/config/colors';

interface ExplanationGridRowProps {
  explanation: ExplanationData;
  testCases: TestCase[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAlternate?: boolean;
}

interface GridThumbnailOptions {
  size: number;
  padding: number;
  background: string;
}

/**
 * Render a grid into a small PNG data URL using the shared ARC palette.
 * This keeps thumbnails compact, pixel-crisp, and on a black mat.
 */
const buildGridThumbnailDataUrl = (
  grid: number[][],
  { size, padding, background }: GridThumbnailOptions
): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  // Force crisp pixel edges and lay down a black mat.
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  // Fit the grid within the canvas with generous padding for a zoomed-out look.
  const maxDim = Math.max(rows, cols);
  const available = Math.max(1, size - padding * 2);
  const cellSize = Math.max(1, Math.floor(available / maxDim));
  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;
  const offsetX = Math.floor((size - gridWidth) / 2);
  const offsetY = Math.floor((size - gridHeight) / 2);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const value = grid[y]?.[x] ?? 0;
      const colorTuple = ARC_COLORS_TUPLES[value] ?? ARC_COLORS_TUPLES[0];
      ctx.fillStyle = `rgb(${colorTuple[0]}, ${colorTuple[1]}, ${colorTuple[2]})`;
      ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
    }
  }

  return canvas.toDataURL('image/png');
};

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

  // Auto-load details when expanded via parent (for deep linking and leaderboard clicks)
  React.useEffect(() => {
    if (isExpanded && !detailedExplanation && !isLoadingDetails && !detailError) {
      const loadDetails = async () => {
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
      };
      loadDetails();
    }
  }, [isExpanded, explanation.id, detailedExplanation, isLoadingDetails, detailError]);

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
  const tokenPartsText = `I ${formatTokenCount(inputTokens)} | O ${formatTokenCount(outputTokens)} | R ${formatTokenCount(reasoningTokens)}`;
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

  // Helper to validate a grid is a proper 2D number array
  const isValidGrid = (grid: any): grid is number[][] => {
    return (
      Array.isArray(grid) &&
      grid.length > 0 &&
      Array.isArray(grid[0]) &&
      typeof grid[0][0] === 'number'
    );
  };

  // Build a compact preview grid, favoring multi-test predictions when available.
  const predictedGrid = isValidGrid(explanation.predictedOutputGrid) ? explanation.predictedOutputGrid : null;
  const multiTestGrids =
    (Array.isArray(explanation.multiTestPredictionGrids) && explanation.multiTestPredictionGrids.length > 0)
      ? explanation.multiTestPredictionGrids.filter(isValidGrid)
      : (Array.isArray(explanation.multiplePredictedOutputs) && explanation.multiplePredictedOutputs.length > 0)
        ? explanation.multiplePredictedOutputs.filter(isValidGrid)
        : (Array.isArray(explanation.predictedOutputGrids) && explanation.predictedOutputGrids.length > 0)
          ? explanation.predictedOutputGrids.filter(isValidGrid)
          : [];
  const previewGrid = predictedGrid ?? multiTestGrids[0] ?? null;
  const previewCount = multiTestGrids.length;
  // Build a tiny PNG once per grid reference for a sharper, more compact thumbnail.
  const previewThumbnail = useMemo(() => {
    if (!previewGrid) {
      return null;
    }
    return buildGridThumbnailDataUrl(previewGrid, {
      size: 48,
      padding: 7,
      background: '#000000',
    });
  }, [previewGrid]);
  const previewThumbnailMobile = useMemo(() => {
    if (!previewGrid) {
      return null;
    }
    return buildGridThumbnailDataUrl(previewGrid, {
      size: 40,
      padding: 6,
      background: '#000000',
    });
  }, [previewGrid]);

  return (
    <>
      {/* Desktop row */}
      <div
        className={`hidden md:grid cursor-pointer transition-colors ${rowBackground} hover:bg-gray-800/60 ${borderStyle} grid-cols-[60px_minmax(220px,1fr)_110px_90px_100px_100px_92px_44px] gap-3 px-3 py-2 items-center`}
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
              <div className="relative h-full w-full rounded-sm border border-gray-700 bg-black">
                {/* Canvas-rendered PNG keeps the preview small and zoomed out. */}
                {previewThumbnail ? (
                  <img
                    src={previewThumbnail}
                    alt="Predicted grid thumbnail"
                    className="h-full w-full rounded-sm"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <TinyGrid grid={previewGrid} className="h-full w-full" />
                )}
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
          <p className="text-sm font-semibold text-gray-100 truncate">
            {explanation.modelName}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">
            {metadataLine}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={`flex items-center gap-1 border font-mono text-[11px] uppercase px-1.5 py-0.5 ${statusColorClass}`}
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
              <div className="relative h-full w-full rounded-sm border border-gray-700 bg-black">
                {/* PNG thumbnail keeps mobile preview crisp without blowing up spacing. */}
                {previewThumbnailMobile ? (
                  <img
                    src={previewThumbnailMobile}
                    alt="Predicted grid thumbnail"
                    className="h-full w-full rounded-sm"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <TinyGrid grid={previewGrid} className="h-full w-full" />
                )}
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
            <p className="text-[14px] font-semibold text-gray-100 truncate">
              {explanation.modelName}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
              {metadataLine}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`border font-mono text-[11px] uppercase px-1.5 py-0.5 ${statusColorClass}`}
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

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
          <div>
            <div className="font-semibold text-gray-100">{costText}</div>
            <div className="text-[10px] text-gray-500">Cost</div>
          </div>
          <div>
            <div className="text-gray-200">{timestampText}</div>
            <div className="text-[10px] text-gray-500">Date</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1 font-semibold text-gray-100">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {formattedTokens}
            </div>
            <div className="text-[10px] text-gray-500">{tokenPartsText}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-100">{durationText}</div>
            <div className="text-[10px] text-gray-500">Time</div>
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
            // Use the dark theme so expanded cards match the Puzzle Analyst layout.
            <AnalysisResultCard
              result={detailedExplanation}
              modelKey={detailedExplanation.modelName}
              testCases={testCases}
              eloMode={false}
              theme="dark"
            />
          ) : (
            <div className="text-sm text-gray-400">Loading details...</div>
          )}
        </div>
      )}
    </>
  );
}
