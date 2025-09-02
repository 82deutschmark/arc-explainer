import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { ExplanationData } from '@/types/puzzle';
import { formatConfidence } from '@/constants/models';

interface AnalysisResultContentProps {
  result: ExplanationData;
  isSaturnResult: boolean;
  showReasoning: boolean;
  setShowReasoning: (show: boolean) => void;
  showAlienMeaning: boolean;
  setShowAlienMeaning: (show: boolean) => void;
}

export const AnalysisResultContent: React.FC<AnalysisResultContentProps> = ({ 
  result, 
  isSaturnResult, 
  showReasoning, 
  setShowReasoning, 
  showAlienMeaning, 
  setShowAlienMeaning 
}) => {
  // Debug logging to see what result actually contains
  console.log('[REASONING-DEBUG] result object:', result);
  console.log('[REASONING-DEBUG] hasReasoningLog:', result.hasReasoningLog);
  console.log('[REASONING-DEBUG] reasoningLog:', result.reasoningLog);
  console.log('[REASONING-DEBUG] reasoningItems:', result.reasoningItems);
  console.log('[REASONING-DEBUG] reasoningItems type:', typeof result.reasoningItems);
  console.log('[REASONING-DEBUG] reasoningItems length:', result.reasoningItems?.length);
  console.log('[REASONING-DEBUG] condition result:', ((result.hasReasoningLog && result.reasoningLog) || (result.reasoningItems && Array.isArray(result.reasoningItems) && result.reasoningItems.length > 0)));
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
              {isSaturnResult ? '🪐 Saturn Visual Analysis' : 'Pattern Description'}
            </h5>
            {!isSaturnResult && result.confidence && (
              <Badge variant="outline" className="text-xs">
                Confidence: {formatConfidence(result.confidence)}
              </Badge>
            )}
            {!isSaturnResult && (result.predictionAccuracyScore !== undefined && result.predictionAccuracyScore !== null) && (
              <Badge 
                variant="outline" 
                className={`text-xs ${result.predictionAccuracyScore >= 0.8 ? 'bg-green-50 border-green-200 text-green-700' : result.predictionAccuracyScore >= 0.5 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
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
                  {result.reasoningLog || (result.reasoningItems && result.reasoningItems.length > 0 ? 'Structured reasoning steps shown below.' : '')}
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
                        // Fallback: convert to string
                        displayContent = String(item);
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
    </div>
  );
};
