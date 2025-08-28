/**
 * StatisticsCards Component
 * Displays feedback and solver mode accuracy statistics in a responsive tabbed layout
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare,
  Award,
  TrendingUp,
  Star,
  Database,
  Activity,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { MODELS } from '@/constants/models';
import type { FeedbackStats } from '@shared/types';

// Configuration constants - centralized instead of hardcoded
const UI_CONFIG = {
  maxRecentActivityItems: 15,
  maxModelRankingsItems: 10,
  maxLeaderboardItems: 10,
  dateFormat: {
    month: 'short' as const,
    day: 'numeric' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const
  }
};

interface AccuracyStats {
  accuracyByModel: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    avgAccuracyScore: number;
    avgConfidence: number;
    successfulExtractions: number;
    extractionSuccessRate: number;
  }>;
  totalSolverAttempts: number;
  avgConfidence?: number;
}

interface ModelRanking {
  modelName: string;
  displayName: string;
  helpful: number;
  notHelpful: number;
  total: number;
  helpfulPercentage: number;
  provider: string;
}

interface RawStats {
  totalExplanations: number;
  avgProcessingTime: number;
  maxProcessingTime: number;
  avgPredictionAccuracy: number;
  totalTokens: number;
  avgTokens: number;
  maxTokens: number;
  totalEstimatedCost: number;
  avgEstimatedCost: number;
  maxEstimatedCost: number;
  explanationsWithTokens: number;
  explanationsWithCost: number;
  explanationsWithAccuracy: number;
  explanationsWithProcessingTime: number;
}

interface PerformanceStats {
  trustworthinessLeaders: Array<{
    modelName: string;
    totalAttempts: number;
    avgTrustworthiness: number;
    avgConfidence: number;
    calibrationError: number;
    avgProcessingTime: number;
    avgTokens: number;
    avgCost: number;
    totalCost: number;
    costPerTrustworthiness: number;
    tokensPerTrustworthiness: number;
    trustworthinessRange: { min: number; max: number; };
  }>;
  speedLeaders: Array<{
    modelName: string;
    avgProcessingTime: number;
    totalAttempts: number;
    avgTrustworthiness: number;
  }>;
  calibrationLeaders: Array<{
    modelName: string;
    calibrationError: number;
    totalAttempts: number;
    avgTrustworthiness: number;
    avgConfidence: number;
  }>;
  efficiencyLeaders: Array<{
    modelName: string;
    costEfficiency: number;
    tokenEfficiency: number;
    avgTrustworthiness: number;
    totalAttempts: number;
  }>;
  totalTrustworthinessAttempts: number;
  overallTrustworthiness: number;
}

interface StatisticsCardsProps {
  feedbackStats?: FeedbackStats;
  accuracyStats?: AccuracyStats;
  performanceStats?: PerformanceStats;
  rawStats?: RawStats;
  modelRankings: ModelRanking[];
  totalPuzzles?: number;
  datasetDistribution?: Record<string, number>;
  onViewAllFeedback: () => void;
  statsLoading: boolean;
  accuracyLoading: boolean;
  performanceLoading?: boolean;
  rawStatsLoading?: boolean;
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
  performanceStats,
  rawStats,
  modelRankings,
  totalPuzzles,
  datasetDistribution,
  onViewAllFeedback,
  statsLoading,
  accuracyLoading,
  performanceLoading,
  rawStatsLoading,
  recentActivity = []
}: StatisticsCardsProps) {
  if (statsLoading || rawStatsLoading || performanceLoading) {
    return (
      <div className="space-y-6">
        {/* Loading state for tabbed layout */}
        <div className="h-10 bg-gray-200 rounded animate-pulse mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
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
      </div>
    );
  }

  return (
    <Tabs defaultValue="performance" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="performance" className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          Performance
        </TabsTrigger>
        <TabsTrigger value="database" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database
        </TabsTrigger>
        <TabsTrigger value="raw-stats" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Raw Stats
        </TabsTrigger>
        <TabsTrigger value="activity" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity
        </TabsTrigger>
      </TabsList>

      {/* Performance Tab */}
      <TabsContent value="performance" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Solver Performance Overview */}
          <Card className="md:col-span-2 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-6 w-6 text-green-600" />
                Solver Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceStats && performanceStats.totalTrustworthinessAttempts > 0 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {performanceStats.totalTrustworthinessAttempts}
                    </div>
                    <div className="text-sm text-gray-600">Total Solver Attempts</div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-semibold text-blue-700">
                        {(performanceStats.overallTrustworthiness * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-blue-600">Overall Trustworthiness</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No solver performance data available</p>
                  <p className="text-xs">Run analyses in solver mode to see performance metrics</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trustworthiness Leaderboard */}
          {performanceStats && performanceStats.trustworthinessLeaders.length > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-5 w-5 text-green-500" />
                  Top Trustworthiness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {performanceStats.trustworthinessLeaders
                    .slice(0, UI_CONFIG.maxLeaderboardItems)
                    .map((model, index) => {
                      const modelInfo = MODELS.find(m => m.key === model.modelName);
                      const displayName = modelInfo?.name || model.modelName;
                      
                      return (
                        <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-100 hover:bg-green-100 transition-colors">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-green-700 truncate">
                                {displayName}
                              </div>
                              <div className="text-xs text-green-600">
                                {model.totalAttempts} attempts • {model.avgConfidence}% confidence
                              </div>
                            </div>
                          </div>
                          <Badge className="text-xs bg-green-100 text-green-800 ml-2">
                            {(model.avgTrustworthiness * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Best Calibrated Models */}
          {performanceStats && performanceStats.calibrationLeaders.length > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Best Calibrated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {performanceStats.calibrationLeaders
                    .slice(0, UI_CONFIG.maxLeaderboardItems)
                    .map((model, index) => {
                      const modelInfo = MODELS.find(m => m.key === model.modelName);
                      const displayName = modelInfo?.name || model.modelName;
                      
                      return (
                        <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-blue-700 truncate">
                                {displayName}
                              </div>
                              <div className="text-xs text-blue-600">
                                {model.totalAttempts} attempts • {(model.avgTrustworthiness * 100).toFixed(1)}% trustworthy
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 ml-2">
                            {model.calibrationError.toFixed(1)} gap
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Speed Leaders */}
          {performanceStats && performanceStats.speedLeaders.length > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  Fastest Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {performanceStats.speedLeaders
                    .slice(0, UI_CONFIG.maxLeaderboardItems)
                    .map((model, index) => {
                      const modelInfo = MODELS.find(m => m.key === model.modelName);
                      const displayName = modelInfo?.name || model.modelName;
                      
                      return (
                        <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-colors">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-purple-700 truncate">
                                {displayName}
                              </div>
                              <div className="text-xs text-purple-600">
                                {model.totalAttempts} attempts • {(model.avgTrustworthiness * 100).toFixed(1)}% trustworthy
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 ml-2">
                            {model.avgProcessingTime}ms
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Efficiency Leaders */}
          {performanceStats && performanceStats.efficiencyLeaders.length > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  Most Efficient
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {performanceStats.efficiencyLeaders
                    .slice(0, UI_CONFIG.maxLeaderboardItems)
                    .map((model, index) => {
                      const modelInfo = MODELS.find(m => m.key === model.modelName);
                      const displayName = modelInfo?.name || model.modelName;
                      
                      return (
                        <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-orange-700 truncate">
                                {displayName}
                              </div>
                              <div className="text-xs text-orange-600">
                                {model.totalAttempts} attempts • {(model.avgTrustworthiness * 100).toFixed(1)}% trustworthy
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 ml-2">
                            ${model.costEfficiency.toFixed(4)}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      {/* Database Tab */}
      <TabsContent value="database" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Database Overview */}
          <Card className="md:col-span-2 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-6 w-6 text-indigo-600" />
                Database Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Main Stats */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">
                    {totalPuzzles?.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Puzzles</div>
                </div>

                {/* Dataset Distribution */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Dataset Distribution</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                      <span className="text-xs text-gray-600">ARC2-Eval:</span>
                      <Badge variant="outline" className="text-xs">
                        {datasetDistribution?.['ARC2-Eval'] || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                      <span className="text-xs text-gray-600">ARC2:</span>
                      <Badge variant="outline" className="text-xs">
                        {datasetDistribution?.['ARC2'] || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                      <span className="text-xs text-gray-600">ARC1-Eval:</span>
                      <Badge variant="outline" className="text-xs">
                        {datasetDistribution?.['ARC1-Eval'] || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                      <span className="text-xs text-gray-600">ARC1:</span>
                      <Badge variant="outline" className="text-xs">
                        {datasetDistribution?.['ARC1'] || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis Coverage */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-700">
                    {feedbackStats?.totalFeedback && totalPuzzles ? Math.round((feedbackStats.totalFeedback / totalPuzzles) * 100) : '0'}%
                  </div>
                  <div className="text-xs text-purple-600">Coverage</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <div className="text-xl font-bold text-indigo-700">
                    {accuracyStats?.accuracyByModel && accuracyStats.accuracyByModel.length > 0 ? 
                      Math.round(accuracyStats.accuracyByModel.reduce((sum, model) => sum + model.avgConfidence, 0) / accuracyStats.accuracyByModel.length) : 
                      (accuracyStats?.avgConfidence ? Math.round(accuracyStats.avgConfidence) : 0)}%
                  </div>
                  <div className="text-xs text-indigo-600">Avg Confidence</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Count Overview */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-green-500" />
                Models Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {accuracyStats?.accuracyByModel?.length || 0}
                </div>
                <div className="text-sm text-gray-600">AI Models</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Raw Stats Tab */}
      <TabsContent value="raw-stats" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Processing Time Stats */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Processing Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-700">
                    {rawStats?.avgProcessingTime ? `${rawStats.avgProcessingTime.toFixed(0)}ms` : 'N/A'}
                  </div>
                  <div className="text-xs text-purple-600">Average</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <div className="text-xl font-bold text-indigo-700">
                    {rawStats?.maxProcessingTime ? `${rawStats.maxProcessingTime.toLocaleString()}ms` : 'N/A'}
                  </div>
                  <div className="text-xs text-indigo-600">Maximum</div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {rawStats?.explanationsWithProcessingTime || 0} explanations have processing time data
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Stats */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-green-500" />
                Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-700">
                    {rawStats?.totalTokens ? rawStats.totalTokens.toLocaleString() : 'N/A'}
                  </div>
                  <div className="text-xs text-green-600">Total Tokens</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-700">
                    {rawStats?.avgTokens ? rawStats.avgTokens.toLocaleString() : 'N/A'}
                  </div>
                  <div className="text-xs text-blue-600">Average per Explanation</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-xl font-bold text-orange-700">
                    {rawStats?.maxTokens ? rawStats.maxTokens.toLocaleString() : 'N/A'}
                  </div>
                  <div className="text-xs text-orange-600">Highest Single Use</div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {rawStats?.explanationsWithTokens || 0} explanations have token data
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Stats */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-red-500" />
                Estimated Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-700">
                    ${rawStats?.totalEstimatedCost ? rawStats.totalEstimatedCost.toFixed(4) : 'N/A'}
                  </div>
                  <div className="text-xs text-red-600">Total Estimated</div>
                </div>
                <div className="text-center p-3 bg-pink-50 rounded-lg">
                  <div className="text-xl font-bold text-pink-700">
                    ${rawStats?.avgEstimatedCost ? rawStats.avgEstimatedCost.toFixed(6) : 'N/A'}
                  </div>
                  <div className="text-xs text-pink-600">Average per Explanation</div>
                </div>
                <div className="text-center p-3 bg-rose-50 rounded-lg">
                  <div className="text-xl font-bold text-rose-700">
                    ${rawStats?.maxEstimatedCost ? rawStats.maxEstimatedCost.toFixed(6) : 'N/A'}
                  </div>
                  <div className="text-xs text-rose-600">Highest Single Cost</div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {rawStats?.explanationsWithCost || 0} explanations have cost data
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accuracy Stats */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-yellow-500" />
                Prediction Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-xl font-bold text-yellow-700">
                    {rawStats?.avgPredictionAccuracy ? `${(rawStats.avgPredictionAccuracy * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-yellow-600">Average Score</div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {rawStats?.explanationsWithAccuracy || 0} explanations have accuracy scores
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Activity Tab */}
      <TabsContent value="activity" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Recent Activity */}
          <Card className="md:col-span-2 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentActivity.slice(0, UI_CONFIG.maxRecentActivityItems).map((activity) => (
                  <div key={`${activity.type}-${activity.id}`} className="flex justify-between items-center text-sm p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {activity.type === 'explanation' ? (
                        <span className="text-xl">🧠</span>
                      ) : (
                        <span className="text-xl">👍</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-800 truncate font-medium">
                          {activity.type === 'explanation' ? (
                            `${activity.modelName} analyzed puzzle ${activity.puzzleId}`
                          ) : (
                            `Feedback received for puzzle ${activity.puzzleId}`
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(activity.createdAt).toLocaleDateString('en-US', UI_CONFIG.dateFormat)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No recent activity</p>
                    <p className="text-xs">Activity will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Community Feedback Summary */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {feedbackStats?.totalFeedback || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Feedback</div>
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
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={onViewAllFeedback}
                >
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Community Rankings */}
          <Card className="md:col-span-1 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-blue-500" />
                Community Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {modelRankings.slice(0, UI_CONFIG.maxModelRankingsItems).map((model, index) => (
                  <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-blue-700 truncate">
                          {model.displayName}
                        </div>
                        <div className="text-xs text-blue-600">
                          {model.total} feedback
                        </div>
                      </div>
                    </div>
                    <Badge className="text-xs bg-blue-100 text-blue-800 ml-2">
                      {model.helpfulPercentage}%
                    </Badge>
                  </div>
                ))}
                {modelRankings.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No feedback data</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}