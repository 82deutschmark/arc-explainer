/**
 * AnalysisResultCard Component
 * Displays the results of a puzzle analysis from an AI model
 * Includes proper error handling for empty or incomplete results
 * Author: Cascade
 */

import React from 'react';
import { AnalysisResultCardProps } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { ExplanationFeedback } from '@/components/ExplanationFeedback';
import { formatConfidence } from '@/constants/models';

export function AnalysisResultCard({ modelKey, result, model, explanationId }: AnalysisResultCardProps) {
  const hasFeedback = (result.helpfulVotes ?? 0) > 0 || (result.notHelpfulVotes ?? 0) > 0;
  
  // Handle empty or error states - fix for the "0" display issue
  const isEmptyResult = !result || (!result.patternDescription && !result.solvingStrategy && !result.alienMeaning && (!result.hints || result.hints.length === 0));
  
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
        <h5 className="font-medium">{model?.name || modelKey}</h5>
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
      
      {result.patternDescription && (
        <div>
          <div className="flex items-center gap-2">
            <h6 className="text-sm font-medium text-gray-700">Why the solution is correct:</h6>
            {result.confidence && !result.patternConfidence && (
              <Badge variant="outline" className="text-xs">
                Confidence: {formatConfidence(result.confidence)}
              </Badge>
            )}
          </div>
          <p className="text-sm">{result.patternDescription}</p>
        </div>
      )}
      
      {result.solvingStrategy && (
        <div>
          <h6 className="text-sm font-medium text-gray-700">Simple explanation:</h6>
          <p className="text-sm">{result.solvingStrategy}</p>
        </div>
      )}
      
      {result.alienMeaning && (
        <div className="bg-purple-50 p-3 rounded border border-purple-200">
          <div className="flex items-center gap-2">
            <h6 className="text-sm font-medium text-purple-800">🛸 What the aliens might mean:</h6>
            {result.alienMeaningConfidence && (
              <Badge variant="outline" className="text-xs bg-purple-50">
                Confidence: {formatConfidence(result.alienMeaningConfidence)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-purple-700">{result.alienMeaning}</p>
        </div>
      )}
      
      {result.hints && result.hints.length > 0 && (
        <div>
          <h6 className="text-sm font-medium text-gray-700">Key insights:</h6>
          <ul className="text-sm space-y-1">
            {result.hints.map((hint, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-blue-500">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Add feedback widget for each explanation - only if we have a valid ID */}
      {(result.explanationId || explanationId) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h6 className="text-sm font-medium mb-2">Help us improve!</h6>
          <ExplanationFeedback 
            explanationId={result.id || result.explanationId || explanationId || 0} 
            onFeedbackSubmitted={() => console.log(`Feedback submitted for model: ${modelKey}`)}
          />
        </div>
      )}
    </div>
  );
}
