/**
 * ModelDebugModal Component
 * Debugging overlay that shows raw database statistics for a selected model
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  X,
  Activity,
  BarChart3,
  MessageSquare,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';
import type { FeedbackStats, AccuracyStats } from '@shared/types';

interface ModelDebugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelName: string;
}

export function ModelDebugModal({ 
  open, 
  onOpenChange, 
  modelName 
}: ModelDebugModalProps) {
  
  // Get model display info
  const modelInfo = MODELS.find(m => m.key === modelName);
  const displayName = modelInfo ? `${modelInfo.name}` : modelName;

  // Fetch accuracy stats
  const { data: accuracyStats, isLoading: accuracyLoading, error: accuracyError } = useQuery({
    queryKey: ['accuracy-stats-debug', modelName],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/accuracy-stats');
      const json = await response.json();
      return json.data as AccuracyStats;
    },
    enabled: open && !!modelName
  });

  // Fetch feedback stats
  const { data: feedbackStats, isLoading: feedbackLoading, error: feedbackError } = useQuery({
    queryKey: ['feedback-stats-debug', modelName],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feedback/stats');
      const json = await response.json();
      return json.data as FeedbackStats;
    },
    enabled: open && !!modelName
  });

  // Fetch raw stats (aggregate data - not model-specific)
  const { data: rawStats, isLoading: rawLoading, error: rawError } = useQuery({
    queryKey: ['raw-stats-debug'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/raw-stats');
      const json = await response.json();
      return json.data;
    },
    enabled: open && !!modelName
  });

  // Fetch performance stats (contains model-specific arrays)
  const { data: performanceStats, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['performance-stats-debug'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/performance-stats');
      const json = await response.json();
      return json.data;
    },
    enabled: open && !!modelName
  });

  // Filter model-specific data
  const modelAccuracy = accuracyStats?.accuracyByModel.find(m => m.modelName === modelName);
  const modelFeedback = feedbackStats?.feedbackByModel[modelName];
  
  // Filter performance data for this model
  const modelTrustworthiness = performanceStats?.trustworthinessLeaders?.find((m: any) => m.modelName === modelName);
  const modelSpeed = performanceStats?.speedLeaders?.find((m: any) => m.modelName === modelName);
  
  const isLoading = accuracyLoading || feedbackLoading || rawLoading || performanceLoading;
  const hasErrors = accuracyError || feedbackError || rawError || performanceError;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-blue-500" />
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Model Debug: {displayName}
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Raw database statistics for debugging
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {modelInfo && (
                <Badge variant="outline" className="border-blue-500 text-blue-700">
                  {modelInfo.provider}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 h-0">
          <div className="px-6 py-4">
          {hasErrors ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <X className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-red-600 mb-2">Error loading model statistics</p>
                <p className="text-sm text-gray-500">Please try again later</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-gray-600">Loading model statistics...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Model Info */}
              {modelInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Model Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Key:</span>
                        <p className="font-mono">{modelInfo.key}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Provider:</span>
                        <p>{modelInfo.provider}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Cost (Input):</span>
                        <p>{modelInfo.cost?.input || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Cost (Output):</span>
                        <p>{modelInfo.cost?.output || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accuracy Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    Accuracy Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modelAccuracy ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Total Attempts:</span>
                        <p className="text-lg font-mono">{modelAccuracy.totalAttempts}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Correct Predictions:</span>
                        <p className="text-lg font-mono text-green-600">{modelAccuracy.correctPredictions}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Accuracy Percentage:</span>
                        <p className="text-lg font-mono">{modelAccuracy.accuracyPercentage}%</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Avg Confidence:</span>
                        <p className="text-lg font-mono">{modelAccuracy.avgConfidence?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Avg Accuracy Score:</span>
                        <p className="text-lg font-mono">{modelAccuracy.avgAccuracyScore?.toFixed(3) || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Avg Trustworthiness:</span>
                        <p className="text-lg font-mono">{modelAccuracy.avgTrustworthiness?.toFixed(3) || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Successful Predictions:</span>
                        <p className="text-lg font-mono">{modelAccuracy.successfulPredictions || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Success Rate:</span>
                        <p className="text-lg font-mono">{modelAccuracy.predictionSuccessRate?.toFixed(2) || 'N/A'}%</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No accuracy data available for this model</p>
                  )}
                </CardContent>
              </Card>

              {/* Feedback Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    Feedback Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modelFeedback ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Helpful Votes:</span>
                        <p className="text-lg font-mono text-green-600">{modelFeedback.helpful}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Not Helpful Votes:</span>
                        <p className="text-lg font-mono text-red-600">{modelFeedback.notHelpful}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Total Feedback:</span>
                        <p className="text-lg font-mono">{modelFeedback.total}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Helpful Rate:</span>
                        <p className="text-lg font-mono">{modelFeedback.total > 0 ? ((modelFeedback.helpful / modelFeedback.total) * 100).toFixed(1) : '0'}%</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No feedback data available for this model</p>
                  )}
                </CardContent>
              </Card>

              {/* Performance Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    Performance Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(modelTrustworthiness || modelSpeed) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Trustworthiness Metrics */}
                      {modelTrustworthiness && (
                        <div>
                          <h4 className="font-medium mb-3 text-orange-700">Trustworthiness Metrics</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Avg Trustworthiness:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.avgTrustworthiness?.toFixed(3) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Calibration Error:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.calibrationError?.toFixed(3) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Processing Time:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.avgProcessingTime?.toFixed(2) || 'N/A'}ms</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Cost per Trustworthiness:</span>
                              <p className="text-lg font-mono">${modelTrustworthiness.costPerTrustworthiness?.toFixed(4) || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Speed/Cost Metrics */}
                      {modelSpeed && (
                        <div>
                          <h4 className="font-medium mb-3 text-orange-700">Speed & Cost Metrics</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Avg Tokens:</span>
                              <p className="text-lg font-mono">{modelSpeed.avgTokens?.toFixed(0) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Cost:</span>
                              <p className="text-lg font-mono">${modelSpeed.avgCost?.toFixed(4) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Total Cost:</span>
                              <p className="text-lg font-mono">${modelSpeed.totalCost?.toFixed(2) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Tokens per Trustworthiness:</span>
                              <p className="text-lg font-mono">{modelSpeed.tokensPerTrustworthiness?.toFixed(2) || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No performance data available for this model</p>
                  )}
                </CardContent>
              </Card>

              {/* Raw JSON Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    Raw Data (JSON)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {modelAccuracy && (
                      <div>
                        <h4 className="font-medium mb-2">Accuracy Data:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(modelAccuracy, null, 2)}
                        </pre>
                      </div>
                    )}
                    {modelFeedback && (
                      <div>
                        <h4 className="font-medium mb-2">Feedback Data:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(modelFeedback, null, 2)}
                        </pre>
                      </div>
                    )}
                    {modelTrustworthiness && (
                      <div>
                        <h4 className="font-medium mb-2">Model Trustworthiness Data:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(modelTrustworthiness, null, 2)}
                        </pre>
                      </div>
                    )}
                    {modelSpeed && (
                      <div>
                        <h4 className="font-medium mb-2">Model Speed Data:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(modelSpeed, null, 2)}
                        </pre>
                      </div>
                    )}
                    {rawStats && (
                      <div>
                        <h4 className="font-medium mb-2">Aggregate Raw Stats (All Models):</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(rawStats, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}