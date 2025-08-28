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
  BarChart3
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

interface StatisticsCardsProps {
  feedbackStats?: FeedbackStats;
  accuracyStats?: AccuracyStats;
  modelRankings: ModelRanking[];
  totalPuzzles: number;
  datasetDistribution?: Record<string, number>;
  onViewAllFeedback: () => void;
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
  modelRankings,
  totalPuzzles,
  datasetDistribution,
  onViewAllFeedback,
  statsLoading,
  accuracyLoading,
  recentActivity = []
}: StatisticsCardsProps) {
  if (statsLoading) {
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
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="performance" className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          Performance
        </TabsTrigger>
        <TabsTrigger value="database" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database
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
                        {Math.round(accuracyStats.accuracyByModel.reduce((sum, model) => 
                          sum + model.accuracyPercentage, 0) / accuracyStats.accuracyByModel.length) || 0}%
                      </div>
                      <div className="text-xs text-green-600">Avg Accuracy</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-xl font-semibold text-blue-700">
                        {Math.round(accuracyStats.accuracyByModel.reduce((sum, model) => 
                          sum + model.avgAccuracyScore, 0) / accuracyStats.accuracyByModel.length * 100) || 0}%
                      </div>
                      <div className="text-xs text-blue-600">Avg Trust Score</div>
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

          {/* Accuracy Leaderboard */}
          {accuracyStats && accuracyStats.totalSolverAttempts > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  Top Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {[...accuracyStats.accuracyByModel]
                    .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
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
                                {model.totalAttempts} attempts
                              </div>
                            </div>
                          </div>
                          <Badge className="text-xs bg-green-100 text-green-800 ml-2">
                            {model.accuracyPercentage}%
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trust Score Leaderboard */}
          {accuracyStats && accuracyStats.totalSolverAttempts > 0 && (
            <Card className="md:col-span-1 xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-5 w-5 text-blue-500" />
                  Top Trust
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {[...accuracyStats.accuracyByModel]
                    .sort((a, b) => b.avgAccuracyScore - a.avgAccuracyScore)
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
                                {model.totalAttempts} attempts
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 ml-2">
                            {Math.round(model.avgAccuracyScore * 100)}%
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
                    {totalPuzzles.toLocaleString()}
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