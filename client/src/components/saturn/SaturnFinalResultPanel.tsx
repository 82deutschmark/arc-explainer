/**
 * Author: gpt-5-codex
 * Date: 2025-10-17
 * PURPOSE: Present the Saturn solver's final structured analysis with predicted grids rendered
 * using the shared PuzzleGrid component so live streaming runs mirror saved AnalysisResult cards.
 * SRP/DRY check: Pass — isolates post-stream rendering, reuses PuzzleGrid.
 */

import React from 'react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';

interface SaturnFinalResultPanelProps {
  analysis?: Record<string, unknown> | null;
  expectedOutputs: number[][][];
  status: SaturnProgressState['status'];
}

const isIntegerMatrix = (grid: unknown): grid is number[][] => {
  if (!Array.isArray(grid) || grid.length === 0) return false;
  return grid.every(
    (row) => Array.isArray(row) && row.length > 0 && row.every((cell) => Number.isInteger(cell))
  );
};

const parseGrid = (candidate: unknown): number[][] | null => {
  if (candidate == null) return null;

  let value: unknown = candidate;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (isIntegerMatrix(value)) {
    return value;
  }

  return null;
};

const collectPredictedGrids = (analysis?: Record<string, unknown> | null): number[][][] => {
  if (!analysis) return [];

  const grids: number[][][] = [];
  const seen = new Set<string>();

  const addGrid = (candidate: unknown) => {
    const parsed = parseGrid(candidate);
    if (!parsed) return;
    const key = JSON.stringify(parsed);
    if (seen.has(key)) return;
    seen.add(key);
    grids.push(parsed);
  };

  // PRIMARY: Check for individual predictedOutputN fields (actual DB format)
  if ((analysis as any).multiplePredictedOutputs === true) {
    let index = 1;
    while ((analysis as any)[`predictedOutput${index}`] !== undefined) {
      addGrid((analysis as any)[`predictedOutput${index}`]);
      index += 1;
    }
    return grids;
  }

  // FALLBACK: Check multiTestPredictionGrids
  if ((analysis as any).multiTestPredictionGrids) {
    try {
      const gridData = (analysis as any).multiTestPredictionGrids;
      const parsed = Array.isArray(gridData) ? gridData : JSON.parse(gridData);
      for (const grid of parsed) {
        addGrid(grid);
      }
      if (grids.length > 0) return grids;
    } catch (e) {
      // Continue to next fallback
    }
  }

  // FALLBACK: Check if multiplePredictedOutputs is an array
  if (Array.isArray((analysis as any).multiplePredictedOutputs)) {
    for (const grid of (analysis as any).multiplePredictedOutputs as unknown[]) {
      addGrid(grid);
    }
    if (grids.length > 0) return grids;
  }

  // FALLBACK: Check predictedOutputs array
  if (Array.isArray((analysis as any).predictedOutputs)) {
    for (const grid of (analysis as any).predictedOutputs as unknown[]) {
      addGrid(grid);
    }
    if (grids.length > 0) return grids;
  }

  // FALLBACK: Check single field candidates
  const singleFieldCandidates = ['predictedOutputGrid', 'predictedOutput', 'output', 'solution', 'result'];
  for (const key of singleFieldCandidates) {
    if (Object.prototype.hasOwnProperty.call(analysis, key)) {
      addGrid((analysis as any)[key]);
    }
  }

  return grids;
};

const resolveConfidence = (analysis?: Record<string, unknown> | null): string | null => {
  if (!analysis) return null;
  const raw = (analysis as any).confidence ?? (analysis as any).patternConfidence;
  if (typeof raw === 'number') {
    return `${Math.round(raw)}%`;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw;
  }
  return null;
};

export function SaturnFinalResultPanel({ analysis, expectedOutputs, status }: SaturnFinalResultPanelProps) {
  const predictedGrids = React.useMemo(() => collectPredictedGrids(analysis), [analysis]);
  const confidence = React.useMemo(() => resolveConfidence(analysis), [analysis]);

  if (!analysis || predictedGrids.length === 0) {
    return null;
  }

  const patternDescription = typeof (analysis as any).patternDescription === 'string'
    ? (analysis as any).patternDescription
    : null;
  const solvingStrategy = typeof (analysis as any).solvingStrategy === 'string'
    ? (analysis as any).solvingStrategy
    : null;
  const hints = Array.isArray((analysis as any).hints)
    ? ((analysis as any).hints as unknown[]).filter((hint): hint is string => typeof hint === 'string' && hint.trim().length > 0)
    : [];

  return (
    <div className="border border-indigo-200 bg-white rounded shadow-sm">
      <div className="px-3 py-2 border-b border-indigo-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-800">Final Saturn Prediction</h3>
        <span
          className={`badge badge-sm ${
            status === 'completed'
              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
              : status === 'error'
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <div className="p-3 space-y-4">
        {predictedGrids.map((grid, index) => {
          const expected = expectedOutputs[index];
          return (
            <div
              key={`saturn-final-grid-${index}`}
              className={`grid grid-cols-1 ${expected ? 'md:grid-cols-2' : ''} gap-3 items-start`}
            >
              <PuzzleGrid
                grid={grid}
                title={predictedGrids.length > 1 ? `Predicted Output ${index + 1}` : 'Predicted Output'}
                showEmojis={false}
              />
              {expected && (
                <PuzzleGrid
                  grid={expected}
                  title={`Expected Output ${index + 1}`}
                  showEmojis={false}
                />
              )}
            </div>
          );
        })}

        {(patternDescription || solvingStrategy || hints.length > 0 || confidence) && (
          <div className="space-y-3">
            {patternDescription && (
              <div>
                <div className="text-xs font-medium text-indigo-700 mb-1">Pattern Description</div>
                <p className="text-sm text-gray-800 bg-indigo-50 border border-indigo-100 rounded p-2">
                  {patternDescription}
                </p>
              </div>
            )}
            {solvingStrategy && (
              <div>
                <div className="text-xs font-medium text-indigo-700 mb-1">Solving Strategy</div>
                <p className="text-sm text-gray-800 bg-indigo-50 border border-indigo-100 rounded p-2">
                  {solvingStrategy}
                </p>
              </div>
            )}
            {hints.length > 0 && (
              <div>
                <div className="text-xs font-medium text-indigo-700 mb-1">Hints</div>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-800 bg-indigo-50 border border-indigo-100 rounded p-2">
                  {hints.map((hint, idx) => (
                    <li key={`saturn-hint-${idx}`}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
            {confidence && (
              <div className="flex items-center gap-2 text-sm text-indigo-800">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">Confidence</span>
                <span className="badge badge-outline border-indigo-200 text-indigo-700">{confidence}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SaturnFinalResultPanel;
