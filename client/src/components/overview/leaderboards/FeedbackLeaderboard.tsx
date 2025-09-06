/**
 * FeedbackLeaderboard Component
 * 
 * Displays models ranked by user satisfaction (feedback ratings).
 * Uses data from FeedbackRepository via /api/feedback/stats
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Users, Heart, Star } from 'lucide-react';

interface FeedbackModelStats {
  modelName: string;
  feedbackCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
}

interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: FeedbackModelStats[];
  feedbackByModel: Record<string, {
    helpful: number;
    notHelpful: number;
  }>;
}

interface FeedbackLeaderboardProps {
  feedbackStats?: FeedbackStats;
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function FeedbackLeaderboard({ 
  feedbackStats, 
  isLoading, 
  onModelClick 
}: FeedbackLeaderboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            User Satisfaction Rankings
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
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
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

  if (!feedbackStats || !feedbackStats.topModels?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            User Satisfaction Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No feedback data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Star className="h-4 w-4 text-yellow-500 fill-current" />;
    if (index === 1) return <Heart className="h-4 w-4 text-pink-500 fill-current" />;
    if (index === 2) return <ThumbsUp className="h-4 w-4 text-green-600" />;
    return <span className="w-4 h-4 flex items-center justify-center text-sm font-medium text-gray-500">#{index + 1}</span>;
  };

  const getSatisfactionColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (percentage >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (percentage >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getVolumeIndicator = (count: number) => {
    const maxCount = Math.max(...feedbackStats.topModels.map(m => m.feedbackCount));
    const percentage = (count / maxCount) * 100;
    
    if (percentage >= 80) return { icon: Users, color: 'text-green-600', label: 'High volume' };
    if (percentage >= 40) return { icon: Users, color: 'text-blue-600', label: 'Medium volume' };
    return { icon: Users, color: 'text-gray-400', label: 'Low volume' };
  };

  const topModels = feedbackStats.topModels.slice(0, 8);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-600" />
          User Satisfaction Rankings
        </CardTitle>
        <div className="text-sm text-gray-600">
          Based on {feedbackStats.totalFeedback.toLocaleString()} user ratings
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topModels.map((model, index) => {
            const volumeInfo = getVolumeIndicator(model.feedbackCount);
            const VolumeIcon = volumeInfo.icon;
            
            return (
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
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <VolumeIcon className={`h-3 w-3 ${volumeInfo.color}`} />
                        {model.feedbackCount} ratings
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-green-600" />
                        {model.helpfulCount}
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-red-600" />
                        {model.notHelpfulCount}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs font-medium ${getSatisfactionColor(model.helpfulPercentage)}`}
                  >
                    {model.helpfulPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        
        {feedbackStats.topModels.length > 8 && (
          <div className="mt-4 pt-3 border-t text-center">
            <span className="text-sm text-gray-500">
              +{feedbackStats.topModels.length - 8} more models
            </span>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Satisfaction:</span>
            <Badge className={getSatisfactionColor(feedbackStats.helpfulPercentage)}>
              {feedbackStats.helpfulPercentage.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}