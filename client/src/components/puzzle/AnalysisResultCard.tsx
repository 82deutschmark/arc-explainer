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
import React, { useState } from 'react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { ExplanationFeedback } from '@/components/ExplanationFeedback';
import { formatConfidence } from '@/constants/models';

// Format processing time from milliseconds to minutes:seconds format
const formatProcessingTime = (milliseconds: number): string => {
  // For very small times, just show milliseconds
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  // Format: 1m 23s or just 45s if under a minute
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

export function AnalysisResultCard({ modelKey, result, model }: AnalysisResultCardProps) {
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  const [showReasoning, setShowReasoning] = useState(false);
  
  // Log the result to see what we're getting
  console.log('AnalysisResultCard result:', { 
    alienMeaning: result.alienMeaning,
    alienMeaningConfidence: result.alienMeaningConfidence,
    confidence: result.confidence,
    // Reasoning log debugging
    hasReasoningLog: result.hasReasoningLog,
    reasoningLogLength: result.reasoningLog ? result.reasoningLog.length : 0,
    reasoningLogPreview: result.reasoningLog ? result.reasoningLog.substring(0, 100) + '...' : 'None',
    modelName: result.modelName || 'Unknown'
  });

  // Handle empty or error states - fix for the "0" display issue
  const isEmptyResult = !result || (!result.patternDescription && !result.solvingStrategy && !result.alienMeaning && (!result.hints || result.hints.length === 0));
  
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
        <h5 className="font-medium">{model?.name || modelKey}</h5>
        {result.apiProcessingTimeMs && (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 border-blue-200">
            <span className="text-xs text-blue-600">
              {formatProcessingTime(result.apiProcessingTimeMs)}
            </span>
          </Badge>
        )}
        {hasFeedback && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="flex items-center gap-1 bg-green-50 border-green-200">
              <ThumbsUp className="h-3 w-3 text-green-600" />
              {result.helpfulVotes ?? 0}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 bg-red-50 border-red-200">
              <ThumbsDown className="h-3 w-3 text-red-600" />
              {result.notHelpfulVotes ?? 0}
            </Badge>
          </div>
        )}
      </div>
      
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
                <h5 className="font-semibold">Pattern Description</h5>
                {result.confidence && (
                  <Badge variant="outline" className="text-xs">
                    Confidence: {formatConfidence(result.confidence)}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600">{result.patternDescription}</p>
            </div>
          )}
          {result.solvingStrategy && (
            <div>
              <h5 className="font-semibold">Solving Strategy</h5>
              <p className="text-gray-600">{result.solvingStrategy}</p>
            </div>
          )}
          {result.hints && result.hints.length > 0 && (
            <div>
              <h5 className="font-semibold">Hints</h5>
              <ul className="list-disc list-inside text-gray-600">
                {result.hints.map((hint, i) => <li key={i}>{hint}</li>)}
              </ul>
            </div>
          )}
          {result.alienMeaning && (
            <div className="bg-purple-50 p-3 rounded border border-purple-200">
              <div className="flex items-center gap-2">
                <h5 className="font-semibold text-purple-800">🛸 What might the aliens mean?</h5>
                {/* Always show confidence score for alien meaning */}
                <Badge variant="outline" className="text-xs bg-purple-50">
                  Confidence: {formatConfidence(result.alienMeaningConfidence || result.confidence || '85%')}
                </Badge>
              </div>
              <p className="text-gray-600 text-purple-700">{result.alienMeaning}</p>
            </div>
          )}
          
          {/* Reasoning Log Section */}
          {result.hasReasoningLog && result.reasoningLog && (
            <div className="bg-blue-50 border border-blue-200 rounded">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <h5 className="font-semibold text-blue-800">AI Reasoning Process</h5>
                  <Badge variant="outline" className="text-xs bg-blue-50">
                    Step-by-step analysis
                  </Badge>
                </div>
                {showReasoning ? (
                  <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
              </button>
              {showReasoning && (
                <div className="px-3 pb-3">
                  <div className="bg-white p-3 rounded border border-blue-100">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {result.reasoningLog}
                    </pre>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    💡 This shows how the AI model analyzed the puzzle step-by-step to reach its conclusion.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Only show feedback widget when we have a VALID ID from the database */}
      {result.id > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h6 className="text-sm font-medium mb-2">Help us improve!</h6>
          <ExplanationFeedback 
            explanationId={result.id} 
            onFeedbackSubmitted={() => console.log(`Feedback submitted for model: ${modelKey}`)}
          />
        </div>
      )}
    </div>
  );
}
