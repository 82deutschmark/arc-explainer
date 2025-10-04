/**
 *
 * Author: AI Agent using GPT-5-Codex
 * Date: 2025-10-02T21:47:10-04:00
 * PURPOSE: React card orchestrating puzzle analysis presentation, coordinating reasoning visibility, predicted grid metrics, feedback toggles, and Saturn integrations without duplicating logic from child components.
 * SRP/DRY check: Pass - single responsibility organizing child modules; reuses existing subcomponents and hooks with no duplicated logic.
 * shadcn/ui: Pass - leverages shared shadcn/ui Badge component; no custom UI replacements introduced.
 */

import React, { useMemo, useState } from 'react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { useFeedbackPreview } from '@/hooks/useFeedback';
import { AnalysisResultHeader } from './AnalysisResultHeader';
import { AnalysisResultContent } from './AnalysisResultContent';
import { AnalysisResultGrid } from './AnalysisResultGrid';
import { AnalysisResultMetrics } from './AnalysisResultMetrics';
import { AnalysisResultActions } from './AnalysisResultActions';
import { Badge } from '@/components/ui/badge';

export const AnalysisResultCard = React.memo(function AnalysisResultCard({ modelKey, result, model, testCases, eloMode = false }: AnalysisResultCardProps) {
  const expectedOutputGrids = useMemo(() => testCases.map(tc => tc.output), [testCases]);
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  const [showReasoning, setShowReasoning] = useState(true);
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
    // Check for individual predictedOutputN fields (the actual format we store)
    if ((result as any).multiplePredictedOutputs === true) {
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
  }, [multiValidation]);

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

  return (
    <div className="border rounded-lg p-4 space-y-3">
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
        eloMode={eloMode}
      />

      {showRawDb && (
        <div className="bg-gray-50 border border-gray-200 rounded">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h5 className="font-semibold text-gray-800">Raw DB record</h5>
            <Badge variant="outline" className="text-xs bg-gray-50">
              {result.id ? `id: ${result.id}` : 'unsaved'}
            </Badge>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-gray-500 px-3 pb-3">This shows the raw explanation object as stored/returned by the backend.</p>
        </div>
      )}

      <AnalysisResultContent
        result={result}
        isSaturnResult={isSaturnResult}
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
      <div className="border-t pt-3">
        <AnalysisResultActions result={result} showExistingFeedback={showExistingFeedback} />
      </div>
    </div>
  );
});


