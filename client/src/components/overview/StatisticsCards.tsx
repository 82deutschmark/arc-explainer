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
  Database
} from 'lucide-react';
import { MODELS } from '@/constants/models';
import type { FeedbackStats, AccuracyStats } from '@shared/types';

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
  onViewAllFeedback,
  statsLoading,
  accuracyLoading,
  recentActivity = []
}: StatisticsCardsProps) {
  if (statsLoading) {
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

      {/* Priority 2: Activity & Model Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Extended Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentActivity.slice(0, 15).map((activity) => (
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
                        {new Date(activity.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Models by Feedback */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Top Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {modelRankings.slice(0, 5).map((model, index) => {
                const modelInfo = MODELS.find(m => m.key === model.modelName);
                const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                
                return (
                  <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                      <div>
                        <div className="text-sm font-medium text-blue-700">
                          {displayName}
                        </div>
                        <div className="text-xs text-blue-600">
                          {model.total} feedback entries
                        </div>
                      </div>
                    </div>
                    <Badge className="text-xs bg-blue-100 text-blue-800">
                      {model.helpfulPercentage}%
                    </Badge>
                  </div>
                );
              })}
              {modelRankings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No model data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority 3: Model Performance Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Community Feedback Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-500" />
              Community Feedback Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {modelRankings.slice(0, 8).map((model, index) => {
                const modelInfo = MODELS.find(m => m.key === model.modelName);
                const displayName = modelInfo ? `${modelInfo.name}` : model.modelName;
                
                return (
                  <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                      <div>
                        <div className="text-sm font-medium text-blue-700">
                          {displayName}
                        </div>
                        <div className="text-xs text-blue-600">
                          {model.total} feedback entries
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="text-xs bg-blue-100 text-blue-800">
                        {model.helpfulPercentage}% helpful
                      </Badge>
                      <div className="text-xs text-gray-500">
                        {model.helpful}👍 {model.notHelpful}👎
                      </div>
                    </div>
                  </div>
                );
              })}
              {modelRankings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No feedback data available</p>
                  <p className="text-xs">Community feedback will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Solver Performance Leaderboard */}
        {accuracyStats && !accuracyLoading && accuracyStats.totalSolverAttempts > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-500" />
                Solver Performance Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Accuracy Leaderboard */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4 text-green-500" />
                    Accuracy Leaderboard
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {[...accuracyStats.accuracyByModel]
                      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
                      .slice(0, 5)
                      .map((model, index) => {
                        const modelInfo = MODELS.find(m => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : model.modelName;
                        
                        return (
                          <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100 hover:bg-green-100 transition-colors">
                            <div className="flex items-center gap-3">
                              {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <div className="text-sm font-medium text-green-700">
                                  {displayName}
                                </div>
                                <div className="text-xs text-green-600">
                                  {model.totalAttempts} attempts • {model.correctPredictions || 0} correct
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className="text-xs bg-green-100 text-green-800">
                                {model.accuracyPercentage}% puzzle success
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {Math.round((model.avgTrustworthiness || model.avgAccuracyScore || 0) * 100)}% trustworthiness
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Trustworthiness Leaderboard */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-500" />
                    Trustworthiness Leaderboard
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {[...accuracyStats.accuracyByModel]
                      .sort((a, b) => (b.avgTrustworthiness || b.avgAccuracyScore || 0) - (a.avgTrustworthiness || a.avgAccuracyScore || 0))
                      .slice(0, 5)
                      .map((model, index) => {
                        const modelInfo = MODELS.find(m => m.key === model.modelName);
                        const displayName = modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : model.modelName;
                        
                        return (
                          <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
                            <div className="flex items-center gap-3">
                              {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <div className="text-sm font-medium text-blue-700">
                                  {displayName}
                                </div>
                                <div className="text-xs text-blue-600">
                                  {model.totalAttempts} attempts
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                {Math.round((model.avgTrustworthiness || model.avgAccuracyScore || 0) * 100)}% trustworthiness
                              </Badge>
                              <Badge className="text-xs bg-green-100 text-green-800">
                                {model.accuracyPercentage}% puzzle success
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-gray-400" />
                Solver Performance Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No solver performance data</p>
                <p className="text-xs">Run analyses in solver mode to see performance metrics</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}