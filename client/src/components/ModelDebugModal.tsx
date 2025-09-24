/**NEEDS TOTAL REDESIGN and then deprecate!!!
 * ModelDebugModal Component
 * Debugging overlay that shows raw database statistics for a selected model
 * VERY SLOPPY
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
  Target,
  Shield
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useModels } from '@/hooks/useModels';
import type { FeedbackStats, AccuracyStats, PerformanceStats, RawDatabaseStats, ModelConfig, PureAccuracyStats } from '@shared/types';

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
  
  // Fetch models
  const { data: models, isLoading: modelsLoading, error: modelsError } = useModels();

  // Get model display info
  const modelInfo = models?.find((m: ModelConfig) => m.key === modelName);
  const displayName = modelInfo ? `${modelInfo.name}` : modelName;

  // Fetch accuracy stats
  const { data: accuracyStats, isLoading: accuracyLoading, error: accuracyError } = useQuery<PureAccuracyStats | undefined>({
    queryKey: ['accuracy-stats-debug', modelName],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/accuracy-stats');
      const json = await response.json();
      return json.data as PureAccuracyStats;
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
      return json.data as RawDatabaseStats;
    },
    enabled: open && !!modelName
  });

  // Fetch performance stats (contains model-specific arrays)
  const { data: performanceStats, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['performance-stats-debug'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/performance-stats');
      const json = await response.json();
      return json.data as PerformanceStats;
    },
    enabled: open && !!modelName
  });

  // Filter model-specific data
  const modelAccuracy = accuracyStats?.modelAccuracyRankings.find((m: any) => m.modelName === modelName);
  const modelFeedback = feedbackStats?.feedbackByModel[modelName];
  
  // Filter performance data for this model
  const modelTrustworthiness = performanceStats?.trustworthinessLeaders?.find(m => m.modelName === modelName);
  const modelSpeed = performanceStats?.speedLeaders?.find(m => m.modelName === modelName);
  
  const isLoading = modelsLoading || accuracyLoading || feedbackLoading || rawLoading || performanceLoading;
    const recoveryMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/start-recovery'),
    onSuccess: () => {
      // You might want to show a toast notification here
      console.log('Recovery process started successfully.');
    },
    onError: (error) => {
      console.error('Failed to start recovery process:', error);
    }
  });

  const hasErrors = modelsError || accuracyError || feedbackError || rawError || performanceError;

  // Validation
  if (!open) return null;
  if (!modelName || modelName.trim() === '') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invalid Model</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">No model name provided for debugging.</p>
        </DialogContent>
      </Dialog>
    );
  }

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
        <ScrollArea className="flex-1 overflow-y-auto max-h-[calc(85vh-120px)]">
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

              {/* Mixed Model Performance Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    Mixed Performance Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ <strong>Data Warning:</strong> This data comes from accuracyByModel which is filtered by trustworthiness scores.
                      Models without trustworthiness data are excluded. This is NOT pure puzzle-solving accuracy.
                    </p>
                  </div>
                  {modelAccuracy ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Total Attempts:</span>
                        <p className="text-lg font-mono">{modelAccuracy.totalAttempts}</p>
                        <p className="text-xs text-gray-500">All solver attempts</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Correct Predictions:</span>
                        <p className="text-lg font-mono text-green-600">{modelAccuracy.correctPredictions}</p>
                        <p className="text-xs text-gray-500">Boolean correctness count</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Puzzle Success Rate:</span>
                        <p className="text-lg font-mono">{modelAccuracy.accuracyPercentage}%</p>
                        <p className="text-xs text-gray-500">Pure accuracy (no filtering)</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Single Test Attempts:</span>
                        <p className="text-lg font-mono">{modelAccuracy.singleTestAttempts}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Single Test Accuracy:</span>
                        <p className="text-lg font-mono">{modelAccuracy.singleTestAccuracy}%</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Multi Test Attempts:</span>
                        <p className="text-lg font-mono">{modelAccuracy.multiTestAttempts}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Multi Test Accuracy:</span>
                        <p className="text-lg font-mono">{modelAccuracy.multiTestAccuracy}%</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No performance data available for this model (may lack trustworthiness scores)</p>
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
                        <p className="text-lg font-mono">{modelFeedback.helpful + modelFeedback.notHelpful}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Helpful Rate:</span>
                        <p className="text-lg font-mono">{(modelFeedback.helpful + modelFeedback.notHelpful) > 0 ? ((modelFeedback.helpful / (modelFeedback.helpful + modelFeedback.notHelpful)) * 100).toFixed(1) : '0'}%</p>
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
                          <h4 className="font-medium mb-3 text-orange-700">Trustworthiness & Cost Metrics</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Avg Trustworthiness:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.avgTrustworthiness?.toFixed(3) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Processing Time:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.avgProcessingTime?.toFixed(2) || 'N/A'}ms</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Tokens:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.avgTokens?.toFixed(0) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Cost:</span>
                              <p className="text-lg font-mono">${modelTrustworthiness.avgCost?.toFixed(4) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Total Cost:</span>
                              <p className="text-lg font-mono">${modelTrustworthiness.totalCost?.toFixed(2) || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Total Attempts:</span>
                              <p className="text-lg font-mono">{modelTrustworthiness.totalAttempts || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Speed Metrics */}
                      {modelSpeed && (
                        <div>
                          <h4 className="font-medium mb-3 text-orange-700">Speed Metrics</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Avg Processing Time:</span>
                              <p className="text-lg font-mono">{modelSpeed.avgProcessingTime?.toFixed(2) || 'N/A'}ms</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Total Attempts:</span>
                              <p className="text-lg font-mono">{modelSpeed.totalAttempts}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Avg Trustworthiness:</span>
                              <p className="text-lg font-mono">{modelSpeed.avgTrustworthiness?.toFixed(3) || 'N/A'}</p>
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

              {/* Admin Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-500" />
                    Admin Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <button 
                    onClick={() => recoveryMutation.mutate()}
                    disabled={recoveryMutation.isPending}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                  >
                    {recoveryMutation.isPending ? 'Starting...' : 'Start Data Recovery'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">Manually triggers the server-side data recovery process. Check server logs for progress.</p>
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