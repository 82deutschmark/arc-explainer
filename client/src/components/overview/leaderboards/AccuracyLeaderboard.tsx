/**
 * AccuracyLeaderboard Component
 * 
 * Displays the top-performing models by pure puzzle-solving accuracy.
 * Uses data from AccuracyRepository via /api/feedback/accuracy-stats
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trophy, Award, Zap } from 'lucide-react';

interface AccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: {
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    singleTestAccuracy: number;
    multiTestAccuracy: number;
  }[];
}

interface AccuracyLeaderboardProps {
  accuracyStats?: AccuracyStats;
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function AccuracyLeaderboard({ 
  accuracyStats, 
  isLoading, 
  onModelClick 
}: AccuracyLeaderboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-600" />
            Most Dangerous Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!accuracyStats || !accuracyStats.modelAccuracyRankings?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-600" />
            Most Dangerous Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No dangerous models found
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Zap className="h-4 w-4 text-red-600" />;
    if (index === 1) return <Zap className="h-4 w-4 text-red-500" />;
    if (index === 2) return <Zap className="h-4 w-4 text-orange-500" />;
    return <span className="w-4 h-4 flex items-center justify-center text-sm font-medium text-gray-600">#{index + 1}</span>;
  };

  const getDangerColor = (safetyLevel: number) => {
    const dangerLevel = 100 - safetyLevel;
    if (dangerLevel >= 60) return 'bg-red-100 text-red-800 border-red-200';
    if (dangerLevel >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (dangerLevel >= 20) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const topModels = accuracyStats.modelAccuracyRankings.slice(0, 8);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-red-600" />
          Most Dangerous Models
        </CardTitle>
        <div className="text-sm text-gray-600">
          Models with high confidence but wrong predictions - {accuracyStats.totalSolverAttempts.toLocaleString()} total attempts
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topModels.map((model, index) => (
            <div 
              key={model.modelName}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                onModelClick ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
              }`}
              onClick={() => onModelClick?.(model.modelName)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getRankIcon(index)}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate" title={model.modelName}>
                    {model.modelName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {model.totalAttempts} high-conf attempts • {model.totalAttempts - model.correctPredictions} wrong • {model.multiTestAccuracy}% avg conf
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-medium ${getDangerColor(model.accuracyPercentage)}`}
                >
                  {(100 - model.accuracyPercentage).toFixed(1)}% danger
                </Badge>
              </div>
            </div>
          ))}
        </div>
        
        {accuracyStats.modelAccuracyRankings.length > 8 && (
          <div className="mt-4 pt-3 border-t text-center">
            <span className="text-sm text-gray-500">
              +{accuracyStats.modelAccuracyRankings.length - 8} more models
            </span>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Average Danger Level:</span>
            <Badge className={getDangerColor(accuracyStats.overallAccuracyPercentage)}>
              {(100 - accuracyStats.overallAccuracyPercentage).toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}