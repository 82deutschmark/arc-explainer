/**
 * ExplanationResultsSection Component
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T23:00:00-04:00
 * PURPOSE: Displays LLM analysis results for a puzzle.
 * FIXED: Now uses shared determineCorrectness utility instead of only checking isPredictionCorrect.
 * Properly handles both single-test and multi-test puzzles.
 * SRP/DRY check: Pass - Uses shared correctness logic, focused on display only
 * shadcn/ui: Pass - Uses shadcn/ui components
 */

import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { useExplanations } from '@/hooks/useExplanation';
import { determineCorrectness } from '@shared/utils/correctness';

interface ExplanationResultsSectionProps {
  taskId: string;
}

export function ExplanationResultsSection({ taskId }: ExplanationResultsSectionProps) {
  const { data: explanations, isLoading, error } = useExplanations(taskId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatProcessingTime = (timeMs: number | null | undefined) => {
    if (typeof timeMs !== 'number' || Number.isNaN(timeMs)) {
      return null;
    }
    return (timeMs / 1000).toFixed(1) + 's';
  };

  const formatCost = (cost: number | null | undefined) => {
    if (typeof cost !== 'number' || Number.isNaN(cost)) {
      return null;
    }
    return '$' + cost.toFixed(4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          LLM Analysis Results
          {!isLoading && explanations && (
            <Badge variant="outline" className="ml-2">
              {explanations.length} analysis{explanations.length !== 1 ? 'es' : ''}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Database records of all AI model attempts on this puzzle
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading LLM analysis results...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 border border-red-200 rounded-md bg-red-50">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <h3 className="font-medium text-red-700">Failed to load explanations</h3>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
          </div>
        ) : !explanations || explanations.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-md">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <h3 className="font-medium text-gray-700">No LLM analysis yet</h3>
            <p className="text-gray-500 text-sm mt-1">This puzzle hasn't been analyzed by any AI models</p>
            <Link href={`/examine/${taskId}`}>
              <Button className="mt-3" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Run Analysis
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {explanations.map((explanation) => {
              const processingTime = formatProcessingTime(explanation.apiProcessingTimeMs);
              const hasMultiTestInfo = explanation.multiTestAllCorrect !== null && explanation.multiTestAllCorrect !== undefined;
              return (
                <div key={explanation.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-sm">
                          {explanation.modelName}
                        </Badge>
                        {(() => {
                          const correctness = determineCorrectness({
                            modelName: explanation.modelName,
                            isPredictionCorrect: explanation.isPredictionCorrect,
                            multiTestAllCorrect: explanation.multiTestAllCorrect,
                            hasMultiplePredictions: explanation.hasMultiplePredictions
                          });
                          return correctness.isCorrect ? (
                            <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {correctness.label}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {correctness.label}
                            </Badge>
                          );
                        })()}
                        <Badge variant="outline" className="text-xs">
                          {explanation.confidence}% confidence
                        </Badge>
                        {hasMultiTestInfo && (
                          <Badge
                            variant="outline"
                            className={explanation.multiTestAllCorrect ? 'text-green-700' : 'text-orange-700'}
                          >
                            Multi-test: {explanation.multiTestAllCorrect ? 'All Correct' : 'Partial'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(explanation.createdAt)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500 space-y-1">
                      {processingTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {processingTime}
                        </div>
                      )}
                      {explanation.estimatedCost !== null && explanation.estimatedCost !== undefined && (
                        <div>{formatCost(explanation.estimatedCost)}</div>
                      )}
                      {explanation.predictionAccuracyScore !== null && explanation.predictionAccuracyScore !== undefined && (
                        <div className="text-xs text-blue-600">
                          Trustworthiness: {explanation.predictionAccuracyScore.toFixed(3)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-gray-800 text-sm">Pattern Description:</h4>
                      <p className="text-gray-700 text-sm">{explanation.patternDescription || 'No description provided'}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-800 text-sm">Solving Strategy:</h4>
                      <p className="text-gray-700 text-sm">{explanation.solvingStrategy || 'No strategy provided'}</p>
                    </div>

                    {explanation.hints && explanation.hints.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 text-sm">Hints:</h4>
                        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                          {explanation.hints.map((hint, index) => (
                            <li key={index}>{hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}