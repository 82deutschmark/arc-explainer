/**
 * StatisticsCards Component
 * Displays feedback and solver mode accuracy statistics in a modular card layout
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Award,
  TrendingUp,
  Star,
  Database,
  Zap
} from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import type { FeedbackStats, AccuracyStats, ModelConfig, ConfidenceStats } from '@shared/types';

interface ModelRanking {
  modelName: string;
  displayName: string;
  helpful: number;
  notHelpful: number;
  total: number;
  helpfulPercentage: number;
  provider: string;
}

interface StatisticsCardsProps {
  feedbackStats?: FeedbackStats;
  accuracyStats?: AccuracyStats;
  confidenceStats?: ConfidenceStats | null;
  modelRankings: ModelRanking[];
  onViewAllFeedback: () => void;
  onModelClick?: (modelName: string) => void;
  statsLoading: boolean;
  accuracyLoading: boolean;
  recentActivity?: Array<{
    id: string;
    type: 'explanation' | 'feedback';
    puzzleId: string;
    modelName?: string;
    createdAt: string;
  }>;
}

export function StatisticsCards({
  feedbackStats,
  accuracyStats,
  confidenceStats,
  modelRankings,
  onViewAllFeedback,
  onModelClick,
  statsLoading,
  accuracyLoading,
  recentActivity = []
}: StatisticsCardsProps) {
  const { data: models, isLoading: modelsLoading, error: modelsError } = useModels();

  if (statsLoading || modelsLoading || accuracyLoading) {
    return (
      <div className="space-y-6">
        {/* Loading state for new layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={`second-${i}`} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Priority 1: Solver Performance (Top Section) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Large Solver Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-green-600" />
              Solver Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accuracyStats && accuracyStats.totalSolverAttempts > 0 ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {accuracyStats.totalSolverAttempts}
                  </div>
                  <div className="text-sm text-gray-600">Total Solver Attempts</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-semibold text-green-700">
                      {accuracyStats.totalCorrectPredictions || 0}
                    </div>
                    <div className="text-xs text-green-600">Correct Predictions</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-semibold text-blue-700">
                      {accuracyStats.totalSolverAttempts > 0 ? 
                        Math.round(((accuracyStats.totalCorrectPredictions || 0) / accuracyStats.totalSolverAttempts) * 100) : 0}%
                    </div>
                    <div className="text-xs text-blue-600">Overall Success Rate</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No solver mode data available</p>
                <p className="text-xs">Run analyses in solver mode to see performance metrics</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database Statistics */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Database Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {feedbackStats?.totalFeedback || 0}
                </div>
                <div className="text-sm text-gray-600">Total Feedback Entries</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Helpful:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {feedbackStats?.helpfulPercentage || 0}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Not Helpful:</span>
                  <Badge className="bg-red-100 text-red-800">
                    {feedbackStats?.notHelpfulPercentage || 0}%
                  </Badge>
                </div>
              </div>
              
              <Button 
                onClick={onViewAllFeedback}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                View All Feedback
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority 2: Model Performance & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Models - Large Component with 3 Columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-gold-500" />
              Top Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Three Column Layout for Top Models */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-96">
              {/* Best Puzzle Success (Filtered) Column */}
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-500" />
                  Top Models by Accuracy
                </h4>
                <div className="h-80 space-y-2 overflow-y-auto pr-1 border-r border-green-100">
                  {accuracyStats && accuracyStats.accuracyByModel && accuracyStats.accuracyByModel.length > 0 ? (
                    [...accuracyStats.accuracyByModel]
                      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
                      .slice(0, 15)
                      .map((model, index) => {
                        const modelInfo = models?.find((m: ModelConfig) => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                        
                        return (
                          <div 
                            key={model.modelName} 
                            className="p-2 rounded-lg bg-green-50 border border-green-100 hover:bg-green-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => onModelClick?.(model.modelName)}
                            title={`Click to view detailed debug info for ${displayName}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index === 0 && <Award className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-green-700 truncate group-hover:text-green-800">
                                    {displayName}
                                  </div>
                                  <div className="text-xs text-green-600 group-hover:text-green-700">
                                    {model.totalAttempts} attempts • {model.correctPredictions} correct
                                  </div>
                                </div>
                              </div>
                              <Badge className="text-xs bg-green-100 text-green-800 ml-2 flex-shrink-0">
                                {model.accuracyPercentage}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Award className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No trustworthy data</p>
                      <p className="text-xs">Models need trustworthiness scores</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Best Trustworthiness Column */}
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-500" />
                  Top Models by Trustworthiness
                </h4>
                <div className="h-80 space-y-2 overflow-y-auto pr-1 border-r border-blue-100">
                  {accuracyStats && accuracyStats.accuracyByModel && accuracyStats.accuracyByModel.length > 0 ? (
                    [...accuracyStats.accuracyByModel]
                      .sort((a, b) => (b.avgTrustworthiness || b.avgAccuracyScore || 0) - (a.avgTrustworthiness || a.avgAccuracyScore || 0))
                      .slice(0, 15)
                      .map((model, index) => {
                        const modelInfo = models?.find((m: ModelConfig) => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                        
                        return (
                          <div 
                            key={model.modelName} 
                            className="p-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => onModelClick?.(model.modelName)}
                            title={`Click to view detailed debug info for ${displayName}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index === 0 && <Award className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-blue-700 truncate group-hover:text-blue-800">
                                    {displayName}
                                  </div>
                                  <div className="text-xs text-blue-600 group-hover:text-blue-700">
                                    {model.totalAttempts} attempts • Click for debug info
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 ml-2 flex-shrink-0">
                                {Math.round((model.avgTrustworthiness || model.avgAccuracyScore || 0) * 100)}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No trustworthiness data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence Calibration Column */}
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  Confidence Leaders
                </h4>
                <div className="h-80 space-y-2 overflow-y-auto pr-1 border-r border-orange-100">
                  {confidenceStats && confidenceStats.modelConfidenceAnalysis && confidenceStats.modelConfidenceAnalysis.length > 0 ? (
                    [...confidenceStats.modelConfidenceAnalysis]
                      .filter(m => m.incorrectPredictions > 0) // Only include models with incorrect predictions
                      .sort((a, b) => (a.avgConfidenceWhenIncorrect ?? 100) - (b.avgConfidenceWhenIncorrect ?? 100))
                      .slice(0, 15)
                      .map((model, index) => {
                        const modelInfo = models?.find((m: ModelConfig) => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                        
                        return (
                          <div 
                            key={model.modelName} 
                            className="p-2 rounded-lg bg-orange-50 border border-orange-100 hover:bg-orange-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => onModelClick?.(model.modelName)}
                            title={`Avg confidence when incorrect: ${model.avgConfidenceWhenIncorrect?.toFixed(1)}%`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index === 0 && <Award className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-orange-700 truncate group-hover:text-orange-800">
                                    {displayName}
                                  </div>
                                  <div className="text-xs text-orange-600 group-hover:text-orange-700">
                                    {model.incorrectPredictions} incorrect • {model.correctPredictions} correct
                                  </div>
                                </div>
                              </div>
                              <Badge className="text-xs bg-orange-100 text-orange-800 ml-2 flex-shrink-0">
                                {model.avgConfidenceWhenIncorrect?.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No confidence data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Best User Feedback Column */}
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  Best User Feedback
                </h4>
                <div className="h-80 space-y-2 overflow-y-auto pr-1">
                  {modelRankings.length > 0 ? (
                    modelRankings
                      .slice(0, 15)
                      .map((model, index) => {
                        const modelInfo = models?.find((m: ModelConfig) => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                        
                        return (
                          <div 
                            key={model.modelName} 
                            className="p-2 rounded-lg bg-purple-50 border border-purple-100 hover:bg-purple-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => onModelClick?.(model.modelName)}
                            title={`Click to view detailed debug info for ${displayName}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index === 0 && <Award className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-purple-700 truncate group-hover:text-purple-800">
                                    {displayName}
                                  </div>
                                  <div className="text-xs text-purple-600 group-hover:text-purple-700">
                                    {model.total} feedback • Click for debug info
                                  </div>
                                </div>
                              </div>
                              <Badge className="text-xs bg-purple-100 text-purple-800 ml-2 flex-shrink-0">
                                {model.helpfulPercentage}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No feedback data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compact Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentActivity.slice(0, 8).map((activity) => (
                <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  {activity.type === 'explanation' ? (
                    <span className="text-lg">🧠</span>
                  ) : (
                    <span className="text-lg">👍</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-800 truncate text-xs">
                      {activity.type === 'explanation' ? (
                        `${activity.modelName} analyzed ${activity.puzzleId}`
                      ) : (
                        `Feedback for ${activity.puzzleId}`
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(activity.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}