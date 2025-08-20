/**
 * StatisticsCards Component
 * Displays feedback and solver mode accuracy statistics in a modular card layout
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Award,
  TrendingUp,
  Star
} from 'lucide-react';
import { MODELS } from '@/constants/models';
import type { FeedbackStats } from '@shared/types';

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
  onViewAllFeedback: () => void;
  statsLoading: boolean;
  accuracyLoading: boolean;
}

export function StatisticsCards({
  feedbackStats,
  accuracyStats,
  modelRankings,
  onViewAllFeedback,
  statsLoading,
  accuracyLoading
}: StatisticsCardsProps) {
  if (statsLoading || !feedbackStats) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Overall Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Feedback Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Feedback:</span>
                <Badge variant="outline" className="text-lg font-semibold">
                  {feedbackStats.totalFeedback}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Helpful:</span>
                <Badge className="bg-green-100 text-green-800">
                  {feedbackStats.helpfulCount} ({feedbackStats.helpfulPercentage}%)
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Not Helpful:</span>
                <Badge className="bg-red-100 text-red-800">
                  {feedbackStats.notHelpfulCount} ({feedbackStats.notHelpfulPercentage}%)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Models by Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modelRankings.slice(0, 3).map((model, index) => (
                <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Star className="h-4 w-4 text-yellow-500" />}
                    <span className="text-sm font-medium truncate">
                      {model.displayName.length > 25 ? `${model.displayName.substring(0, 25)}...` : model.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={`text-xs ${
                        model.helpfulPercentage >= 70 ? 'bg-green-100 text-green-800' :
                        model.helpfulPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {model.helpfulPercentage}%
                    </Badge>
                    <span className="text-xs text-gray-500">
                      ({model.total})
                    </span>
                  </div>
                </div>
              ))}
              {modelRankings.length > 3 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onViewAllFeedback}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View all feedback →
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Feedback Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedbackStats.feedbackByDay.slice(0, 5).map((day) => (
                <div key={day.date} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">+{day.helpful}</span>
                    <span className="text-red-600 font-medium">-{day.notHelpful}</span>
                  </div>
                </div>
              ))}
              {feedbackStats.feedbackByDay.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent feedback activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Performing Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
              Needs Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modelRankings.slice(-3).reverse().map((model) => (
                <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate text-red-700">
                      {model.displayName.length > 25 ? `${model.displayName.substring(0, 25)}...` : model.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={`text-xs ${
                        model.helpfulPercentage >= 70 ? 'bg-green-100 text-green-800' :
                        model.helpfulPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {model.helpfulPercentage}%
                    </Badge>
                    <span className="text-xs text-gray-500">
                      ({model.total})
                    </span>
                  </div>
                </div>
              ))}
              {modelRankings.length > 3 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onViewAllFeedback}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    View all feedback →
                  </Button>
                </div>
              )}
              {modelRankings.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No models with sufficient feedback data
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solver Mode Accuracy Statistics */}
      {accuracyStats && !accuracyLoading && accuracyStats.totalSolverAttempts > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Solver Mode Accuracy</h2>
            <Badge variant="outline" className="text-xs">
              {accuracyStats.totalSolverAttempts} attempts
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Accurate Models */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-green-500" />
                  Most Accurate Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {accuracyStats.accuracyByModel.slice(0, 3).map((model, index) => {
                    const modelInfo = MODELS.find(m => m.key === model.modelName);
                    const displayName = modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : model.modelName;
                    
                    return (
                      <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-100">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                          <span className="text-sm font-medium truncate text-green-700">
                            {displayName.length > 25 ? `${displayName.substring(0, 25)}...` : displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-green-100 text-green-800">
                            {model.accuracyPercentage}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(model.avgAccuracyScore * 100)}% trust
                          </Badge>
                          <span className="text-xs text-gray-500">
                            ({model.totalAttempts})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {accuracyStats.accuracyByModel.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No solver mode data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Least Accurate Models */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
                  Needs Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {accuracyStats.accuracyByModel.slice(-3).reverse().map((model) => {
                    const modelInfo = MODELS.find(m => m.key === model.modelName);
                    const displayName = modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : model.modelName;
                    
                    return (
                      <div key={model.modelName} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate text-red-700">
                            {displayName.length > 25 ? `${displayName.substring(0, 25)}...` : displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-red-100 text-red-800">
                            {model.accuracyPercentage}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(model.avgAccuracyScore * 100)}% trust
                          </Badge>
                          <span className="text-xs text-gray-500">
                            ({model.totalAttempts})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}