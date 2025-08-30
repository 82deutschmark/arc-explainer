/**
 * AnalysisResultCard Component
 * Displays the results of a puzzle analysis from an AI model
 * Includes proper error handling for empty or incomplete results
 * Now supports displaying reasoning logs from AI models that provide step-by-step reasoning
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Brain, ChevronDown, ChevronUp, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { ExplanationFeedback } from '@/components/ExplanationFeedback';
import { FeedbackViewer } from '@/components/feedback/FeedbackViewer';
import { useFeedbackPreview } from '@/hooks/useFeedback';
import { formatConfidence } from '@/constants/models';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';


// Format cost for display with safe type checking - always show in dollars with consistent decimal places
const formatCost = (cost: any): string => {
  // Convert to number and validate
  const numCost = typeof cost === 'number' ? cost : parseFloat(cost);
  
  // Return fallback if not a valid number
  if (isNaN(numCost) || numCost < 0) {
    return '$0.000';
  }
  
  // Always show in dollars with 3 decimal places for consistency
  return `$${numCost.toFixed(3)}`;
};

// Format token count for display
const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  } else {
    return tokens.toString();
  }
};

export const AnalysisResultCard = React.memo(function AnalysisResultCard({ modelKey, result, model, testCases }: AnalysisResultCardProps) {
  // Get the expected output grids directly from the test cases prop
  const expectedOutputGrids = useMemo(() => testCases.map(tc => tc.output), [testCases]);
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  const [showReasoning, setShowReasoning] = useState(false);
  const [showAlienMeaning, setShowAlienMeaning] = useState(false);
  const [showExistingFeedback, setShowExistingFeedback] = useState(false);
  const [showRawDb, setShowRawDb] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showMultiTest, setShowMultiTest] = useState(false);
  
  // Get feedback preview for this explanation - add error handling to prevent crashes
  const { feedback: existingFeedback, summary: feedbackSummary, isLoading: feedbackLoading, error: feedbackError } = useFeedbackPreview(result.id > 0 ? result.id : undefined);
  
  // Log any feedback errors for debugging
  if (feedbackError) {
    console.warn('Feedback preview error:', feedbackError);
  }
  
  // Check if this is a Saturn solver result (align with ExplanationData fields)
  const isSaturnResult = Boolean(result.saturnEvents || (result.saturnImages && result.saturnImages.length > 0) || result.saturnLog);

  // Handle both single and multiple predicted outputs - memoize expensive computations
  const gridData = useMemo(() => {
    // Try multiple possible field names for predicted grids
    let predictedGrids: number[][][] | undefined;
    let multiValidation: any;
    
    // Check for multiple prediction formats
    if (result?.multiplePredictedOutputs) {
      // If it's stored as JSONB, it might be a string that needs parsing
      if (typeof result.multiplePredictedOutputs === 'string') {
        try {
          const parsed = JSON.parse(result.multiplePredictedOutputs);
          if (Array.isArray(parsed)) {
            predictedGrids = parsed;
          } else if (parsed.predictedOutput1 && parsed.predictedOutput2) {
            // Handle format: {predictedOutput1: [[...]], predictedOutput2: [[...]]}
            predictedGrids = [parsed.predictedOutput1, parsed.predictedOutput2];
          }
        } catch (e) {
          // Silent fallback - don't break the UI
        }
      } else if (Array.isArray(result.multiplePredictedOutputs)) {
        predictedGrids = result.multiplePredictedOutputs;
      } else if (typeof result.multiplePredictedOutputs === 'object' && result.multiplePredictedOutputs !== null) {
        // Handle format: {predictedOutput1: [[...]], predictedOutput2: [[...]]}
        const obj = result.multiplePredictedOutputs as any;
        if (obj.predictedOutput1 && obj.predictedOutput2) {
          predictedGrids = [obj.predictedOutput1, obj.predictedOutput2];
        }
      }
    }
    
    // Try alternate field names
    if (!predictedGrids && (result as any)?.predictedOutputGrids) {
      predictedGrids = (result as any).predictedOutputGrids;
    }
    
    // Handle multi-test results
    if (result?.multiTestResults) {
      if (typeof result.multiTestResults === 'string') {
        try {
          multiValidation = JSON.parse(result.multiTestResults);
        } catch (e) {
          // Silent fallback
        }
      } else {
        multiValidation = result.multiTestResults;
      }
    }
    
    // Fallback to alternate names
    if (!multiValidation && (result as any)?.multiValidation) {
      multiValidation = (result as any).multiValidation;
    }
    
    // Check for single predicted output using database field name (predicted_output_grid maps to predictedOutputGrid)
    const singlePredictedGrid: number[][] | undefined = (result as any)?.predictedOutputGrid || (result as any)?.predictedOutput;
    const hasPredictedGrids = predictedGrids && predictedGrids.length > 0;
    
    return {
      predictedGrids,
      singlePredictedGrid,
      multiValidation,
      hasPredictedGrids
    };
  }, [result]);
  
  const { predictedGrids, singlePredictedGrid, multiValidation, hasPredictedGrids } = gridData;
  // Fix: Use singlePredictedGrid if available, regardless of multiple predictions state
  const predictedGrid: number[][] | undefined = (hasPredictedGrids && predictedGrids) ? predictedGrids[0] : singlePredictedGrid;

  // Build a diff mask highlighting cell mismatches between predicted and expected grids
  const buildDiffMask = (pred?: number[][], exp?: number[][]): boolean[][] | undefined => {
    if (!pred || !exp || pred.length === 0 || exp.length === 0) return undefined;
    
    try {
      // Safely get dimensions with fallbacks
      const predRows = pred.length;
      const expRows = exp.length;
      const predCols = pred[0]?.length || 0;
      const expCols = exp[0]?.length || 0;
      
      if (predCols === 0 || expCols === 0) return undefined;
      
      const rows = Math.max(predRows, expRows);
      const cols = Math.max(predCols, expCols);
      const mask: boolean[][] = [];
      
      for (let r = 0; r < rows; r++) {
        mask[r] = [];
        for (let c = 0; c < cols; c++) {
          const pv = pred[r]?.[c];
          const ev = exp[r]?.[c];
          mask[r][c] = pv !== ev; // marks true when values differ or are undefined
        }
      }
      return mask;
    } catch (error) {
      console.warn('Error building diff mask:', error);
      return undefined;
    }
  };
  const diffMask = useMemo(() => {
    if (!showDiff) return undefined;
    try {
      return buildDiffMask(predictedGrid, expectedOutputGrids.length > 0 ? expectedOutputGrids[0] : undefined);
    } catch (error) {
      console.warn('Error in diff mask useMemo:', error);
      return undefined;
    }
  }, [showDiff, predictedGrid, expectedOutputGrids]);


  // Handle empty or error states -  // Debug trustworthiness score
  console.log('AnalysisResultCard TRUSTWORTHINESS DEBUG:', { 
    modelName: result.modelName || 'Unknown',
    predictionAccuracyScore: result.predictionAccuracyScore,
    predictionAccuracyScoreType: typeof result.predictionAccuracyScore,
    isPredictionCorrect: result.isPredictionCorrect,
    confidence: result.confidence,
    isSaturnResult
  });

  // Handle empty or error states - check both analysis AND prediction content
  const isEmptyResult = !result || (
    // No analysis content
    (!result.patternDescription || result.patternDescription.trim() === '') && 
    (!result.solvingStrategy || result.solvingStrategy.trim() === '') && 
    (!result.alienMeaning || result.alienMeaning.trim() === '') && 
    (!result.hints || result.hints.length === 0) &&
    // AND no prediction content (for solver mode)
    !result.predictedOutputGrid && 
    (!result.multiplePredictedOutputs || (Array.isArray(result.multiplePredictedOutputs) && result.multiplePredictedOutputs.length === 0))
  );
  
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
        <h5 className="font-medium">{model?.name || modelKey}</h5>
        {result.createdAt && (
          <Badge variant="outline" className="flex items-center gap-1 bg-gray-50 border-gray-200">
            <span className="text-xs text-gray-600">
              {new Date(result.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </Badge>
        )}
        
        {/* Saturn-specific success/failure indicator */}
        {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1 ${
              result.saturnSuccess 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {result.saturnSuccess ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span className="text-xs font-medium">
              {result.saturnSuccess ? 'SOLVED' : 'Incorrect'}
            </span>
          </Badge>
        )}

        {/* Solver mode validation indicator - prioritize multi-test results */}
        {(result.isPredictionCorrect !== undefined || result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined) && (
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1 ${
              // Priority: multiTestAllCorrect > allPredictionsCorrect > isPredictionCorrect
              (() => {
                const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
                if (isCorrect) return 'bg-green-50 border-green-200 text-green-700';
                if (result.predictedOutputGrid || result.multiplePredictedOutputs) return 'bg-red-50 border-red-200 text-red-700';
                return 'bg-yellow-50 border-yellow-200 text-yellow-700';
              })()
            }`}
          >
            {(() => {
              const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
              if (isCorrect) return <CheckCircle className="h-3 w-3" />;
              return <XCircle className="h-3 w-3" />;
            })()}
            <span className="text-xs font-medium">
              {(() => {
                const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
                if (isCorrect) return 'CORRECT';
                if (result.predictedOutputGrid || result.multiplePredictedOutputs) return 'INCORRECT';
                return 'NOT FOUND';
              })()}
            </span>
          </Badge>
        )}
        
        {result.apiProcessingTimeMs && (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200">
            <span className="text-xs text-blue-600">
              {formatProcessingTimeDetailed(result.apiProcessingTimeMs)}
            </span>
          </Badge>
        )}
        
        {/* Cost and Token Usage */}
        {result.estimatedCost && (
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 border-green-200">
            <span className="text-xs text-green-600">
              Cost: {formatCost(result.estimatedCost)}
            </span>
          </Badge>
        )}
        
        {result.totalTokens && (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200">
            <span className="text-xs text-blue-600">
              {formatTokens(result.totalTokens)} tokens
            </span>
          </Badge>
        )}
        
        {/* Analysis Parameters */}
        {(result.temperature !== null && result.temperature !== undefined && model?.supportsTemperature) && (
          <Badge variant="outline" className="flex items-center gap-1 bg-gray-50 border-gray-200">
            <span className="text-xs text-gray-600">
              Temp: {result.temperature}
            </span>
          </Badge>
        )}
        
        {result.reasoningEffort && (
          <Badge variant="outline" className="flex items-center gap-1 bg-purple-50 border-purple-200">
            <span className="text-xs text-purple-600">
              Effort: {result.reasoningEffort}
            </span>
          </Badge>
        )}
        
        {result.reasoningVerbosity && (
          <Badge variant="outline" className="flex items-center gap-1 bg-indigo-50 border-indigo-200">
            <span className="text-xs text-indigo-600">
              Verbosity: {result.reasoningVerbosity}
            </span>
          </Badge>
        )}
        
        {result.reasoningSummaryType && (
          <Badge variant="outline" className="flex items-center gap-1 bg-cyan-50 border-cyan-200">
            <span className="text-xs text-cyan-600">
              Summary: {result.reasoningSummaryType}
            </span>
          </Badge>
        )}
        {(hasFeedback || feedbackSummary.total > 0) && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="flex items-center gap-1 bg-green-50 border-green-200">
              <ThumbsUp className="h-3 w-3 text-green-600" />
              {feedbackSummary.helpful || result.helpfulVotes || 0}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 bg-red-50 border-red-200">
              <ThumbsDown className="h-3 w-3 text-red-600" />
              {feedbackSummary.notHelpful || result.notHelpfulVotes || 0}
            </Badge>
            {feedbackSummary.total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExistingFeedback(!showExistingFeedback)}
                className="h-auto p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                View feedback
              </Button>
            )}
          </div>
        )}

        {/* Toggle to show raw DB record */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRawDb(!showRawDb)}
          className="h-auto p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 ml-auto"
          title="Show the raw explanation record from the database"
        >
          {showRawDb ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide raw DB record
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show raw DB record
            </>
          )}
        </Button>
      </div>
      
      {/* Raw DB record viewer - moved above puzzle grid rendering */}
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
      
      {/* Handle empty response case */}
      {isEmptyResult && (
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
          <p className="text-sm text-yellow-700">
            No analysis results available. The model may have encountered an error or returned an empty response.
          </p>
        </div>
      )}
      
      {!isEmptyResult && (
        <div className="space-y-3">
          {result.patternDescription && (
            <div>
              <div className="flex items-center gap-2">
                <h5 className="font-semibold">
                  {isSaturnResult ? '🪐 Saturn Visual Analysis' : 'Pattern Description'}
                </h5>
                {/* Show confidence for non-Saturn results, success status for Saturn */}
                {!isSaturnResult && result.confidence && (
                  <Badge variant="outline" className="text-xs">
                    Confidence: {formatConfidence(result.confidence)}
                  </Badge>
                )}
                {/* Show prediction accuracy score for solver mode (but not for Saturn) */}
                {!isSaturnResult && (result.predictionAccuracyScore !== undefined && result.predictionAccuracyScore !== null) && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      result.predictionAccuracyScore >= 0.8 
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : result.predictionAccuracyScore >= 0.5
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    Trustworthiness: {Math.round(result.predictionAccuracyScore * 100)}%
                  </Badge>
                )}
                {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      result.saturnSuccess 
                        ? 'bg-green-50 border-green-200 text-green-600' 
                        : 'bg-orange-50 border-orange-200 text-orange-600'
                    }`}
                  >
                    {result.saturnSuccess ? 'Puzzle Solved Successfully' : 'Solution Attempt Failed'}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600">{result.patternDescription}</p>
            </div>
          )}
          {result.solvingStrategy && (
            <div>
              <h5 className="font-semibold">
                {isSaturnResult ? 'Visual Solving Process' : 'Solving Strategy'}
              </h5>
              <p className="text-gray-600">{result.solvingStrategy}</p>
            </div>
          )}
          {result.hints && result.hints.length > 0 && (
            <div>
              <h5 className="font-semibold">
                {isSaturnResult ? 'Key Observations' : 'Hints'}
              </h5>
              <ul className="list-disc list-inside text-gray-600">
                {result.hints.map((hint, i) => <li key={i}>{hint}</li>)}
              </ul>
            </div>
          )}
          {result.alienMeaning && (
            <div className="bg-purple-50 border border-purple-200 rounded">
              <button
                onClick={() => setShowAlienMeaning(!showAlienMeaning)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold text-purple-800">🛸 What might the aliens mean?</h5>
                  <Badge variant="outline" className="text-xs bg-purple-50">
                    Confidence: {formatConfidence(result.alienMeaningConfidence || result.confidence || '85%')}
                  </Badge>
                </div>
                {showAlienMeaning ? (
                  <ChevronUp className="h-4 w-4 text-purple-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-purple-600" />
                )}
              </button>
              {showAlienMeaning && (
                <div className="px-3 pb-3">
                  <div className="bg-white p-3 rounded border border-purple-100">
                    <p className="text-purple-700">{result.alienMeaning}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Reasoning Log Section - Enhanced for Saturn */}
          {result.hasReasoningLog && result.reasoningLog && (
            <div className={`border rounded ${isSaturnResult ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isSaturnResult ? 'hover:bg-indigo-100' : 'hover:bg-blue-100'}`}
              >
                <div className="flex items-center gap-2">
                  {isSaturnResult ? (
                    <>
                      <span className="text-sm">🪐</span>
                      <h5 className="font-semibold text-indigo-800">Saturn Visual Reasoning</h5>
                      <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-200">
                        Multi-stage visual analysis
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 text-blue-600" />
                      <h5 className="font-semibold text-blue-800">AI Reasoning Process</h5>
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        Step-by-step analysis
                      </Badge>
                    </>
                  )}
                </div>
                {showReasoning ? (
                  <ChevronUp className={`h-4 w-4 ${isSaturnResult ? 'text-indigo-600' : 'text-blue-600'}`} />
                ) : (
                  <ChevronDown className={`h-4 w-4 ${isSaturnResult ? 'text-indigo-600' : 'text-blue-600'}`} />
                )}
              </button>
              {showReasoning && (
                <div className="px-3 pb-3">
                  <div className="bg-white p-3 rounded border border-indigo-100">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {result.reasoningLog}
                    </pre>
                  </div>
                  <p className={`text-xs mt-2 ${isSaturnResult ? 'text-indigo-600' : 'text-blue-600'}`}>
                    {isSaturnResult 
                      ? '🔍 This shows Saturn\'s iterative visual analysis process, including image generation and pattern recognition stages.'
                      : '💡 This shows how the AI model analyzed the puzzle step-by-step to reach its conclusion.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Saturn-specific additional data sections */}
          {isSaturnResult && (
            <div className="space-y-3">
              {/* Saturn Images */}
              {result.saturnImages && result.saturnImages.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded p-3">
                  <h5 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    🖼️ Generated Images 
                    <Badge variant="outline" className="text-xs bg-purple-50">
                      {result.saturnImages.length} image{result.saturnImages.length !== 1 ? 's' : ''}
                    </Badge>
                  </h5>
                  <div className="text-xs text-purple-600 space-y-1">
                    {result.saturnImages.slice(0, 3).map((imagePath, i) => (
                      <div key={i} className="font-mono bg-white p-1 rounded border">
                        {imagePath.split('/').pop() || imagePath}
                      </div>
                    ))}
                    {result.saturnImages.length > 3 && (
                      <div className="text-purple-500 font-medium">
                        +{result.saturnImages.length - 3} more images...
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Saturn Detailed Log */}
              {result.saturnLog && (
                <div className="bg-gray-50 border border-gray-200 rounded">
                  <div className="p-3 border-b border-gray-200">
                    <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                      📋 Saturn Execution Log
                      <Badge variant="outline" className="text-xs bg-gray-50">
                        {(result.saturnLog.length / 1024).toFixed(1)}KB
                      </Badge>
                    </h5>
                  </div>
                  <div className="p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                      {result.saturnLog.slice(0, 2000)}{result.saturnLog.length > 2000 ? '\n\n... (truncated)' : ''}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Saturn Events */}
              {result.saturnEvents && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    ⚡ Event Trace
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      NDJSON
                    </Badge>
                  </h5>
                  <div className="text-xs text-blue-600">
                    <div className="bg-white p-2 rounded border font-mono max-h-32 overflow-y-auto">
                      {(() => {
                        const events = result.saturnEvents as string | string[] | any;
                        if (typeof events === 'string') {
                          return `${events.slice(0, 500)}${events.length > 500 ? '...' : ''}`;
                        } else if (Array.isArray(events)) {
                          return `${events.slice(0, 10).join('\n')}${events.length > 10 ? '\n...' : ''}`;
                        } else if (events) {
                          return JSON.stringify(events).slice(0, 500);
                        } else {
                          return 'No events';
                        }
                      })()}
                    </div>
                    <p className="mt-1 text-blue-500">
                      {(() => {
                        const events = result.saturnEvents;
                        if (Array.isArray(events)) {
                          return `Contains ${events.length} events (${(JSON.stringify(events).length / 1024).toFixed(1)}KB)`;
                        } else if (typeof events === 'string') {
                          return `Contains ${events.split('\n').length} events (${(events.length / 1024).toFixed(1)}KB)`;
                        } else {
                          return 'Contains 0 events (0KB)';
                        }
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-test answer display */}
          {expectedOutputGrids.length > 1 ? (
            <div className="border rounded bg-gray-50 border-gray-200">
              <button
                onClick={() => setShowMultiTest(!showMultiTest)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="font-semibold text-gray-800">Multi-Test Results ({predictedGrids?.length || 0} predictions, {expectedOutputGrids.length} tests)</h5>
                  {(result.multiTestAllCorrect !== undefined || result.allPredictionsCorrect !== undefined) && (
                    <Badge 
                      variant="outline" 
                      className={`flex items-center gap-1 text-xs ${
                        (result.multiTestAllCorrect ?? result.allPredictionsCorrect) 
                          ? 'bg-green-50 border-green-200 text-green-700' 
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {(result.multiTestAllCorrect ?? result.allPredictionsCorrect) ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {(result.multiTestAllCorrect ?? result.allPredictionsCorrect) ? 'All Correct' : 'Some Incorrect'}
                    </Badge>
                  )}
                  {(result.multiTestAverageAccuracy !== undefined || result.averagePredictionAccuracyScore !== undefined) && (
                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                      Avg Trustworthiness: {Math.round((result.multiTestAverageAccuracy ?? result.averagePredictionAccuracyScore ?? 0) * 100)}%
                    </Badge>
                  )}
                </div>
                {showMultiTest ? (
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
              </button>
              {showMultiTest && (
                <div className="p-3 border-t border-gray-200">
                  {Array.from({ length: expectedOutputGrids.length }).map((_, testIndex) => {
                    const predGrid = predictedGrids?.[testIndex];
                    const expectedGrid = expectedOutputGrids[testIndex];
                    const validation = multiValidation?.[testIndex];
                    const isCorrect = validation?.isPredictionCorrect;
                    const testDiffMask = (showDiff && predGrid && expectedGrid) ? buildDiffMask(predGrid, expectedGrid) : undefined;
                    
                    return (
                      <div key={testIndex} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <h6 className="font-medium text-gray-700">Test {testIndex + 1}</h6>
                          {isCorrect !== undefined && (
                            <Badge 
                              variant="outline" 
                              className={`flex items-center gap-1 text-xs ${isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                            >
                              {isCorrect ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {isCorrect ? 'CORRECT' : 'INCORRECT'}
                            </Badge>
                          )}
                          {validation?.predictionAccuracyScore !== undefined && (
                            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                              Trustworthiness: {Math.round(validation.predictionAccuracyScore * 100)}%
                            </Badge>
                          )}
                        </div>
                        {predGrid ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className={`rounded p-3 ${
                              isCorrect 
                                ? 'bg-emerald-50 border-emerald-200' 
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <h6 className={`font-semibold mb-2 ${isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>Predicted Answer</h6>
                              <div className="flex items-center justify-center">
                                <PuzzleGrid grid={predGrid} title={`Test ${testIndex + 1} Predicted`} showEmojis={false} diffMask={testDiffMask} />
                              </div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded p-3">
                              <h6 className="font-semibold text-green-800 mb-2">Correct Answer</h6>
                              <div className="flex items-center justify-center">
                                <PuzzleGrid grid={expectedGrid} title={`Test ${testIndex + 1} Expected`} showEmojis={false} highlight={true} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <h6 className="font-semibold text-gray-800">Correct Answer</h6>
                              <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                                No prediction available
                              </Badge>
                            </div>
                            <div className="flex items-center justify-center">
                              <PuzzleGrid grid={expectedGrid} title={`Test ${testIndex + 1} Expected`} showEmojis={false} highlight={true} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDiff(!showDiff)}
                      className="h-auto p-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                      title="Toggle diff overlay for all tests"
                    >
                      Diff overlay: {showDiff ? 'On' : 'Off'}
                    </Button>
                    {result.extractionMethod && (
                      <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-700">
                        Extracted via: {result.extractionMethod}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : predictedGrid && expectedOutputGrids.length === 1 ? (
            <div className="border rounded bg-gray-50 border-gray-200">
              <button
                onClick={() => setShowPrediction(!showPrediction)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold text-gray-800">Model Prediction</h5>
                  {result.isPredictionCorrect !== undefined && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${result.isPredictionCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                    >
                      {result.isPredictionCorrect ? 'Correct' : 'Incorrect'}
                    </Badge>
                  )}
                </div>
                {showPrediction ? (
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
              </button>
              {showPrediction && (
                <div className="p-3 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`rounded p-3 ${
                      result.isPredictionCorrect 
                        ? 'bg-emerald-50 border border-emerald-200' 
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className={`font-semibold ${
                          result.isPredictionCorrect ? 'text-emerald-800' : 'text-red-800'
                        }`}>Predicted Answer</h5>
                        {result.extractionMethod && (
                          <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
                            Extracted via: {result.extractionMethod}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDiff(!showDiff)}
                          className="h-auto p-1 ml-auto text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
                          title="Toggle diff overlay"
                        >
                          Diff: {showDiff ? 'On' : 'Off'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center">
                        {predictedGrid && <PuzzleGrid grid={predictedGrid} title={"Predicted"} showEmojis={false} diffMask={diffMask} />}
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <h5 className="font-semibold text-green-800 mb-2">Correct Answer</h5>
                      <div className="flex items-center justify-center">
                        {expectedOutputGrids[0] && <PuzzleGrid grid={expectedOutputGrids[0]} title={"Expected"} showEmojis={false} highlight={true} />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : predictedGrid ? (
            <div className={`rounded p-3 ${
              result.isPredictionCorrect 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <h5 className={`font-semibold ${
                  result.isPredictionCorrect ? 'text-emerald-800' : 'text-red-800'
                }`}>Model Predicted Answer</h5>
                {result.isPredictionCorrect !== undefined && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${result.isPredictionCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {result.isPredictionCorrect ? 'Prediction matches correct answer' : 'Prediction differs from correct answer'}
                  </Badge>
                )}
                {result.extractionMethod && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
                    Extracted via: {result.extractionMethod}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  className="h-auto p-1 ml-auto text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
                  title="Toggle diff overlay"
                >
                  Diff overlay: {showDiff ? 'On' : 'Off'}
                </Button>
              </div>
              <div className="flex items-center justify-center">
                <PuzzleGrid grid={predictedGrid} title="Predicted Answer" showEmojis={false} diffMask={showDiff ? diffMask : undefined} />
              </div>
            </div>
          ) : expectedOutputGrids.length === 1 ? (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <h5 className="font-semibold text-green-800">Correct Answer (Task)</h5>
              </div>
              <div className="flex items-center justify-center">
                <PuzzleGrid grid={expectedOutputGrids[0]} title="Correct Answer" showEmojis={false} highlight={true} />
              </div>
            </div>
          ) : null}
        </div>
      )}
      
      {/* Existing Feedback Display */}
      {showExistingFeedback && feedbackSummary.total > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h6 className="text-sm font-medium text-gray-800">
              Community Feedback ({feedbackSummary.total})
            </h6>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExistingFeedback(false)}
              className="h-auto p-1 text-gray-500 hover:text-gray-700"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          
          {feedbackLoading ? (
            <div className="text-sm text-gray-500">Loading feedback...</div>
          ) : (
            <FeedbackViewer 
              feedback={existingFeedback} 
              maxItems={3}
              className="mb-3"
            />
          )}
        </div>
      )}
      
      {/* Only show feedback widget when we have a VALID ID from the database */}
      {result.id > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h6 className="text-sm font-medium mb-2">Help us improve!</h6>
          <ExplanationFeedback 
            explanationId={result.id} 
            onFeedbackSubmitted={() => {
              console.log(`Feedback submitted for model: ${modelKey}`);
              // Feedback submitted successfully - no page reload needed
            }}
          />
        </div>
      )}
    </div>
  );
});
