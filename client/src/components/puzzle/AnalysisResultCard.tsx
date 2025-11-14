/**
 * AnalysisResultCard.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:36:00Z
 * PURPOSE: React card orchestrating puzzle analysis presentation, coordinating reasoning visibility,
 * predicted grid metrics, feedback toggles, and Saturn integrations. FIXED: Multi-test stats now
 * correctly shows "Incorrect" (not "Some Incorrect") when 0/N tests are correct. Simplified fallback
 * logic to rely on multiTestAllCorrect flag when detailed validation data is unavailable.
 * ADDED: Deep linking support - each card has id="explanation-{id}" and data-explanation-id for direct URLs.
 * UPDATED (2025-10-22T00:00:00Z) by gpt-5-codex: Reintroduced last month's aurora gradient shell, warm accent borders,
 * and linen-inspired drawer treatments to remove the stark white regression while preserving dark mode balance.
 * SRP/DRY check: Pass - Single responsibility (orchestration), reuses child components
 * shadcn/ui: Pass - Converted to DaisyUI badge
 */

import React, { useMemo, useState } from 'react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { useFeedbackPreview } from '@/hooks/useFeedback';
import { AnalysisResultHeader } from './AnalysisResultHeader';
import { AnalysisResultContent } from './AnalysisResultContent';
import { AnalysisResultGrid } from './AnalysisResultGrid';
import { AnalysisResultMetrics } from './AnalysisResultMetrics';
import { AnalysisResultActions } from './AnalysisResultActions';

export const AnalysisResultCard = React.memo(function AnalysisResultCard({ modelKey, result, model, testCases, eloMode = false }: AnalysisResultCardProps) {
  const expectedOutputGrids = useMemo(() => testCases.map(tc => tc.output), [testCases]);
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  const [showReasoning, setShowReasoning] = useState(eloMode); // Expanded by default in ELO mode for better UX
  const [showAlienMeaning, setShowAlienMeaning] = useState(false);
  const [showExistingFeedback, setShowExistingFeedback] = useState(false);
  const [showRawDb, setShowRawDb] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showPrediction, setShowPrediction] = useState(true); // Always expanded by default
  const [showMultiTest, setShowMultiTest] = useState(true); // Always expanded by default

  const { summary: feedbackSummary } = useFeedbackPreview(result.id > 0 ? result.id : undefined);

  const predictedGrid = useMemo(() => {
    if (result.predictedOutputGrid) {
      try {
        return Array.isArray(result.predictedOutputGrid) ? result.predictedOutputGrid : JSON.parse(result.predictedOutputGrid as any);
      } catch (e) {
        // Failed to parse predicted grid - return undefined for graceful handling
        return undefined;
      }
    }
    return undefined;
  }, [result.predictedOutputGrid]);

  const predictedGrids = useMemo(() => {
    // Check for individual predictedOutputN fields directly (most defensive approach)
    // Don't rely on boolean flag which may be serialized as string/number from DB
    if ((result as any).predictedOutput1 !== undefined) {
      const grids: number[][][] = [];
      let index = 1;

      // Collect predictedOutput1, predictedOutput2, etc.
      while ((result as any)[`predictedOutput${index}`] !== undefined) {
        const grid = (result as any)[`predictedOutput${index}`];
        grids.push(grid && Array.isArray(grid) && grid.length > 0 ? grid : []);
        index++;
      }

      return grids;
    }

    // Fallback: Check multiTestPredictionGrids
    if ((result as any).multiTestPredictionGrids) {
      try {
        const gridData = (result as any).multiTestPredictionGrids;
        return Array.isArray(gridData) ? gridData : JSON.parse(gridData);
      } catch (e) {
        // Failed to parse multi-test prediction grids - continue with empty array
      }
    }

    // Fallback: Check if multiplePredictedOutputs is an array
    if (Array.isArray((result as any).multiplePredictedOutputs)) {
      return (result as any).multiplePredictedOutputs;
    }

    return [];
  }, [result]);

  const multiValidation = useMemo(() => {
    if (result.multiValidation) {
      try {
        return Array.isArray(result.multiValidation) ? result.multiValidation : JSON.parse(result.multiValidation as any);
      } catch (e) {
        // Failed to parse multi-validation data - return empty array for graceful handling
        return [];
      }
    }
    return [];
  }, [result.multiValidation]);

  const multiTestStats = useMemo(() => {
    if (!multiValidation || multiValidation.length === 0) {
      // Fallback to database fields when multiValidation is not available
      // This handles cases where old data was saved without detailed validation
      if (result.hasMultiplePredictions) {
        const totalCount = predictedGrids?.length || expectedOutputGrids.length || 0;
        
        // Determine accuracy level ONLY from multiTestAllCorrect flag
        // We cannot reliably estimate correctCount without detailed validation data
        let accuracyLevel = 'unknown';
        let correctCount = 0;
        
        if (result.multiTestAllCorrect === true) {
          accuracyLevel = 'all_correct';
          correctCount = totalCount;
        } else if (result.multiTestAllCorrect === false) {
          // When multiTestAllCorrect is false, we can't determine if it's "all" or "some" incorrect
          // without the detailed multiValidation data, so we treat it as all incorrect
          accuracyLevel = 'all_incorrect';
          correctCount = 0;
        }
        
        return { correctCount, totalCount, accuracyLevel };
      }
      return { correctCount: 0, totalCount: 0, accuracyLevel: 'unknown' };
    }
    const correctCount = multiValidation.filter((v: any) => v.isPredictionCorrect).length;
    const totalCount = multiValidation.length;
    let accuracyLevel = 'unknown';
    if (totalCount > 0) {
      if (correctCount === totalCount) {
        accuracyLevel = 'all_correct';
      } else if (correctCount === 0) {
        accuracyLevel = 'all_incorrect';
      } else {
        accuracyLevel = 'some_incorrect';
      }
    }
    return { correctCount, totalCount, accuracyLevel };
  }, [multiValidation, result.hasMultiplePredictions, result.multiTestAllCorrect, predictedGrids, expectedOutputGrids]);

  const multiDiffMasks = useMemo(() => {
    if (!predictedGrids || predictedGrids.length === 0) {
      return [];
    }
    return predictedGrids.map((pGrid: number[][], index: number) => {
      const eGrid = expectedOutputGrids[index];
      if (!pGrid || !eGrid || pGrid.length !== eGrid.length || pGrid[0]?.length !== eGrid[0]?.length) {
        return undefined;
      }
      return pGrid.map((row: number[], r: number) => row.map((cell: number, c: number) => cell !== eGrid[r][c]));
    });
  }, [predictedGrids, expectedOutputGrids]);

  const diffMask = useMemo(() => {
    if (!predictedGrid || !expectedOutputGrids[0] || predictedGrid.length !== expectedOutputGrids[0].length || predictedGrid[0].length !== expectedOutputGrids[0][0].length) {
      return undefined;
    }
    return predictedGrid.map((row: number[], r: number) => row.map((cell: number, c: number) => cell !== expectedOutputGrids[0][r][c]));
  }, [predictedGrid, expectedOutputGrids]);

  const isSaturnResult = Boolean(result.saturnEvents || (result.saturnImages && result.saturnImages.length > 0) || result.saturnLog);
  const isGroverResult = Boolean(result.groverIterations || result.groverBestProgram || result.iterationCount);

  return (
    <div
      id={result.id ? `explanation-${result.id}` : undefined}
      className="relative overflow-hidden rounded-3xl border border-amber-100/70 bg-[radial-gradient(circle_at_top,_rgba(254,243,199,0.92),_rgba(255,228,230,0.86)_45%,_rgba(219,234,254,0.82))] p-4 sm:p-6 space-y-5 scroll-mt-24 shadow-[0_28px_65px_-40px_rgba(146,64,14,0.55)] transition-all hover:shadow-[0_34px_78px_-42px_rgba(30,64,175,0.55)] supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur-md dark:border-violet-800/60 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.92),_rgba(76,29,149,0.62)_45%,_rgba(15,118,110,0.54))] dark:shadow-[0_28px_70px_-40px_rgba(12,74,110,0.65)] dark:hover:shadow-[0_34px_82px_-44px_rgba(94,234,212,0.55)]"
      data-explanation-id={result.id}
    >
      <AnalysisResultHeader
        result={result}
        model={model}
        modelKey={modelKey}
        feedbackSummary={feedbackSummary}
        hasFeedback={hasFeedback}
        showExistingFeedback={showExistingFeedback}
        setShowExistingFeedback={setShowExistingFeedback}
        showRawDb={showRawDb}
        setShowRawDb={setShowRawDb}
        isSaturnResult={isSaturnResult}
        isGroverResult={isGroverResult}
        eloMode={eloMode}
      />

      {showRawDb && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 shadow-[inset_0_12px_28px_-24px_rgba(120,53,15,0.45)] dark:border-violet-900/70 dark:bg-violet-950/40">
          <div className="flex items-center justify-between gap-3 border-b border-amber-200/70 bg-gradient-to-r from-amber-100/70 via-rose-100/50 to-sky-100/60 px-4 py-3 dark:border-violet-900/70 dark:from-violet-950/80 dark:via-slate-900/40 dark:to-emerald-900/40">
            <h5 className="font-semibold text-amber-900 dark:text-emerald-200">Raw DB record</h5>
            <div className="badge badge-outline text-xs bg-white/60 text-amber-800 shadow-sm dark:bg-violet-900/60 dark:text-sky-100">
              {result.id ? `id: ${result.id}` : 'unsaved'}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto px-4 py-3">
            <pre className="font-mono text-xs leading-relaxed text-amber-900/90 dark:text-emerald-200 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
          <p className="px-4 pb-4 text-xs text-amber-700/80 dark:text-emerald-300/80">This shows the raw explanation object as stored/returned by the backend.</p>
        </div>
      )}

      <AnalysisResultContent
        result={result}
        isSaturnResult={isSaturnResult}
        isGroverResult={isGroverResult}
        showReasoning={showReasoning}
        setShowReasoning={setShowReasoning}
        showAlienMeaning={showAlienMeaning}
        setShowAlienMeaning={setShowAlienMeaning}
        eloMode={eloMode}
      />

      <AnalysisResultGrid
        result={result}
        expectedOutputGrids={expectedOutputGrids}
        predictedGrid={predictedGrid}
        predictedGrids={predictedGrids}
        multiValidation={multiValidation}
        multiTestStats={multiTestStats}
        diffMask={diffMask}
        multiDiffMasks={multiDiffMasks}
        showDiff={showDiff}
        setShowDiff={setShowDiff}
        showMultiTest={showMultiTest}
        setShowMultiTest={setShowMultiTest}
        showPrediction={showPrediction}
        setShowPrediction={setShowPrediction}
        eloMode={eloMode}
      />

      {isSaturnResult && <AnalysisResultMetrics result={result} isSaturnResult={isSaturnResult} />}

      {/* Always show feedback actions - useful for comparison evaluation */}
      <div className="border-t border-rose-200/60 pt-4 dark:border-violet-900/60">
        <AnalysisResultActions result={result} showExistingFeedback={showExistingFeedback} />
      </div>
    </div>
  );
});


