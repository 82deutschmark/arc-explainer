/**
 * AnalysisResultContent.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T22:50:00-04:00
 * PURPOSE: Displays the main content of analysis results including pattern descriptions,
 * solving strategies, hints, alien meanings, and AI reasoning. Handles Saturn results and
 * optimistic update states (analyzing, saving, error). Shows trustworthiness badge for
 * non-ELO, non-debate, non-Saturn results only (predictionAccuracyScore).
 * SRP/DRY check: Pass - Single responsibility (content display), reuses Badge/Button components
 * shadcn/ui: Pass - Uses shadcn/ui Badge and Button components
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { ExplanationData } from '@/types/puzzle';

export const formatConfidence = (confidence: string | number) => {
  if (typeof confidence === 'string') {
    return confidence.endsWith('%') ? confidence : `${confidence}%`;
  }
  return `${confidence}%`;
};

interface AnalysisResultContentProps {
  result: ExplanationData;
  isSaturnResult: boolean;
  isGroverResult?: boolean;
  showReasoning: boolean;
  setShowReasoning: (show: boolean) => void;
  showAlienMeaning: boolean;
  setShowAlienMeaning: (show: boolean) => void;
  eloMode?: boolean;
}

// Skeleton loader component
const SkeletonLoader = ({ className = "", height = "h-4" }: { className?: string; height?: string }) => (
  <div className={`bg-gray-200 rounded animate-pulse ${height} ${className}`} />
);

export const AnalysisResultContent: React.FC<AnalysisResultContentProps> = ({
  result,
  isSaturnResult,
  isGroverResult = false,
  showReasoning,
  setShowReasoning,
  showAlienMeaning,
  setShowAlienMeaning,
  eloMode = false
}) => {
  const [showGroverProgram, setShowGroverProgram] = React.useState(false);
  const isOptimistic = result.isOptimistic;
  const status = result.status;
  
  // Show skeleton loaders for pending states
  if (isOptimistic && (status === 'analyzing' || status === 'saving')) {
    return (
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Pattern Description</h5>
            <SkeletonLoader className="w-20" height="h-5" />
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-full" />
            <SkeletonLoader className="w-3/4" />
            <SkeletonLoader className="w-5/6" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Solving Strategy</h5>
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-full" />
            <SkeletonLoader className="w-4/5" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold">Hints</h5>
          </div>
          <div className="space-y-2">
            <SkeletonLoader className="w-3/4" />
            <SkeletonLoader className="w-2/3" />
            <SkeletonLoader className="w-1/2" />
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state for failed analyses
  if (isOptimistic && status === 'error') {
    return (
      <div className="bg-red-50 p-3 rounded border border-red-200">
        <p className="text-sm text-red-700">
          Analysis failed: {result.error || 'Unknown error occurred'}
        </p>
      </div>
    );
  }
  
  
  const isEmptyResult = !result || (
    (!result.patternDescription || result.patternDescription.trim() === '') && 
    (!result.solvingStrategy || result.solvingStrategy.trim() === '') && 
    (!result.alienMeaning || result.alienMeaning.trim() === '') && 
    (!result.hints || result.hints.length === 0) &&
    !result.predictedOutputGrid && 
    (!result.multiplePredictedOutputs || (Array.isArray(result.multiplePredictedOutputs) && result.multiplePredictedOutputs.length === 0))
  );

  if (isEmptyResult) {
    return (
      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
        <p className="text-sm text-yellow-700">
          No analysis results available. The model may have encountered an error or returned an empty response.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.patternDescription && (
        <div>
          <div className="flex items-center gap-2">
            <h5 className="font-semibold">
              {isSaturnResult ? '🪐 Saturn Visual Analysis' : isGroverResult ? '🔄 Grover Iterative Analysis' : 'Pattern Description'}
            </h5>
            {!isSaturnResult && result.confidence && (
              <Badge variant="outline" className="text-xs">
                Confidence: {formatConfidence(result.confidence)}
              </Badge>
            )}
            {!eloMode && !isSaturnResult && result.predictionAccuracyScore !== undefined && result.predictionAccuracyScore !== null && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  result.predictionAccuracyScore >= 0.8 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : result.predictionAccuracyScore >= 0.5 
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                      : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                Trustworthiness: {Math.round(result.predictionAccuracyScore * 100)}%
              </Badge>
            )}
            {isSaturnResult && typeof result.saturnSuccess === 'boolean' && (
              <Badge 
                variant="outline" 
                className={`text-xs ${result.saturnSuccess ? 'bg-green-50 border-green-200 text-green-600' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
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
            {isSaturnResult ? 'Visual Solving Process' : isGroverResult ? 'Search Strategy' : 'Solving Strategy'}
          </h5>
          <p className="text-gray-600">{result.solvingStrategy}</p>
        </div>
      )}
      {result.hints && result.hints.length > 0 && (
        <div>
          <h5 className="font-semibold">
            {isSaturnResult ? 'Key Observations' : isGroverResult ? 'Program Evolution' : 'Hints'}
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
      
      {true && (
        <div className={`border rounded ${isSaturnResult ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isSaturnResult ? 'hover:bg-indigo-100' : 'hover:bg-blue-100'}`}>
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
                  {(() => {
                    let displayText = result.reasoningLog || '';
                    
                    // Try to parse OpenAI reasoning log format: [{"type":"summary_text","text":"..."}]
                    if (displayText && typeof displayText === 'string' && displayText.startsWith('[')) {
                      try {
                        const parsed = JSON.parse(displayText);
                        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
                          // Extract text from OpenAI format and clean up \n
                          displayText = parsed.map(item => item.text).join('\n').replace(/\\n/g, '\n');
                        }
                      } catch (e) {
                        // If parsing fails, keep original text
                      }
                    }
                    
                    return displayText || (result.reasoningItems && result.reasoningItems.length > 0 ? 'Structured reasoning steps shown below.' : '');
                  })()}
                </pre>
              </div>
              <p className={`text-xs mt-2 ${isSaturnResult ? 'text-indigo-600' : 'text-blue-600'}`}>
                {isSaturnResult 
                  ? '🔍 This shows Saturn\'s iterative visual analysis process, including image generation and pattern recognition stages.'
                  : '💡 This shows how the AI model analyzed the puzzle step-by-step to reach its conclusion.'
                }
              </p>
              
              {/* Display structured reasoning items if available */}
              {result.reasoningItems && Array.isArray(result.reasoningItems) && result.reasoningItems.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <h6 className={`font-semibold text-sm mb-2 ${isSaturnResult ? 'text-indigo-800' : 'text-blue-800'}`}>
                    Step-by-Step Analysis:
                  </h6>
                  <div className="space-y-2">
                    {result.reasoningItems.map((item: any, index) => {
                      // Handle different reasoning item formats from different providers
                      let displayContent = '';
                      
                      if (typeof item === 'string') {
                        // OpenRouter, OpenAI Responses: simple strings
                        displayContent = item;
                      } else if (typeof item === 'object' && item !== null) {
                        // Gemini: objects with step, observation, insight
                        if (item.observation && item.insight) {
                          displayContent = `${item.observation} → ${item.insight}`;
                        } else if (item.text) {
                          displayContent = item.text;
                        } else if (item.content) {
                          displayContent = item.content; 
                        } else if (item.message) {
                          displayContent = item.message;
                        } else {
                          // Fallback: JSON stringify for structured objects
                          displayContent = JSON.stringify(item, null, 2);
                        }
                      } else {
                        // Fallback: try to stringify objects, or convert other types to string
                        if (typeof item === 'object' && item !== null) {
                          try {
                            displayContent = JSON.stringify(item, null, 2);
                          } catch (error) {
                            displayContent = `[Unable to parse reasoning item: ${typeof item}]`;
                          }
                        } else {
                          displayContent = String(item);
                        }
                      }
                      
                      return (
                        <div key={index} className="bg-gray-50 p-2 rounded text-sm border-l-3 border-l-blue-300">
                          <span className="font-medium text-gray-600">Step {index + 1}:</span> {displayContent}
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-xs mt-2 ${isSaturnResult ? 'text-indigo-600' : 'text-blue-600'}`}>
                    🧠 These are the structured reasoning steps captured from the AI model's internal thought process.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isGroverResult && result.groverBestProgram && (
        <div className="bg-green-50 border border-green-200 rounded">
          <button
            onClick={() => setShowGroverProgram(!showGroverProgram)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🔄</span>
              <h5 className="font-semibold text-green-800">Discovered Python Program</h5>
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
                Best of {result.iterationCount || '?'} iterations
              </Badge>
            </div>
            {showGroverProgram ? (
              <ChevronUp className="h-4 w-4 text-green-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-green-600" />
            )}
          </button>
          {showGroverProgram && (
            <div className="px-3 pb-3">
              <div className="bg-white p-3 rounded border border-green-100">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {result.groverBestProgram}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
