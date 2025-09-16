/**
 * AnalysisResultCard Component
 * Displays the results of a puzzle analysis from an AI model
 * Includes proper error handling for empty or incomplete results
 * Now supports displaying reasoning logs and structured reasoning items from AI models
 * 
 * 
 * Now displays API processing time metrics for model performance analysis
 * Author: Cascade
 */

/**
 * AnalysisResultCard.tsx
 * 
 * @author Cascade
 * @description A modular component responsible for displaying the analysis results for a single AI model.
 * It takes in explanation data, formats it for display, and includes the ExplanationFeedback widget.
 * This component is designed to be a self-contained card, making it easy to reuse and maintain.
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

export const AnalysisResultCard = React.memo(function AnalysisResultCard({ modelKey, result, model, testCases, comparisonMode = false }: AnalysisResultCardProps) {
  const expectedOutputGrids = useMemo(() => testCases.map(tc => tc.output), [testCases]);
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  const [showReasoning, setShowReasoning] = useState(false);
  const [showAlienMeaning, setShowAlienMeaning] = useState(false);
  const [showExistingFeedback, setShowExistingFeedback] = useState(false);
  const [showRawDb, setShowRawDb] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showMultiTest, setShowMultiTest] = useState(false);

  const { summary: feedbackSummary } = useFeedbackPreview(result.id > 0 ? result.id : undefined);

  const predictedGrid = useMemo(() => {
    if (result.predictedOutputGrid) {
      try {
        return Array.isArray(result.predictedOutputGrid) ? result.predictedOutputGrid : JSON.parse(result.predictedOutputGrid as any);
      } catch (e) {
        console.error("Failed to parse predictedOutputGrid", e);
        return undefined;
      }
    }
    return undefined;
  }, [result.predictedOutputGrid]);

  const predictedGrids = useMemo(() => {
    if (result.predictedOutputGrid) {
      try {
        const parsed = Array.isArray(result.predictedOutputGrid) ? result.predictedOutputGrid : JSON.parse(result.predictedOutputGrid as any);
        // Check if this is a multi-test case (3D array) or single test (2D array)
        if (parsed.length > 0 && Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
          // This is a 3D array (multi-test case): number[][][]
          return parsed as number[][][];
        }
        // This might be a single 2D grid stored in the multi-test format, return empty for this component
        return [];
      } catch (e) {
        console.error("Failed to parse predictedOutputGrid for multi-test", e);
        return [];
      }
    }
    return [];
  }, [result.predictedOutputGrid]);

  const multiValidation = useMemo(() => {
    if (result.multiValidation) {
      try {
        return Array.isArray(result.multiValidation) ? result.multiValidation : JSON.parse(result.multiValidation as any);
      } catch (e) {
        console.error("Failed to parse multiValidation", e);
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
    return predictedGrids.map((pGrid, index) => {
      const eGrid = expectedOutputGrids[index];
      if (!pGrid || !eGrid || pGrid.length !== eGrid.length || pGrid[0]?.length !== eGrid[0]?.length) {
        return undefined;
      }
      return pGrid.map((row, r) => row.map((cell, c) => cell !== eGrid[r][c]));
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
        comparisonMode={comparisonMode}
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
        comparisonMode={comparisonMode}
      />

      {isSaturnResult && <AnalysisResultMetrics result={result} isSaturnResult={isSaturnResult} />}
      
      <div className="border-t pt-3">
        <AnalysisResultActions result={result} showExistingFeedback={showExistingFeedback} />
      </div>
    </div>
  );
});
