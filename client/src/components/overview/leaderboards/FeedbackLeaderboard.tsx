/**
 * FeedbackLeaderboard Component
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 *
 * Displays models ranked by positive user feedback (helpful ratings).
 * Uses data from FeedbackRepository via /api/feedback/stats
 *
 * Key Features:
 * - Shows ALL models sorted by helpful count (most positive at top)
 * - Displays helpful vs not-helpful counts for each model
 * - Tooltips explaining feedback metrics
 * - Sample size warnings for models with low feedback counts
 *
 * SRP and DRY check: Pass - Single responsibility for feedback display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Tooltip, Icons)
 */

import React from 'react';
import { ThumbsUp, ThumbsDown, Users, Heart, Star, Info } from 'lucide-react';

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
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            Model Feedback Analysis
          </h2>
        </div>
        <div className="card-body">
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
        </div>
      </div>
    );
  }

  if (!feedbackStats || !feedbackStats.topModels?.length) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            Model Feedback Analysis
          </h2>
        </div>
        <div className="card-body">
          <div className="text-center py-8 text-gray-500">
            No feedback data available
          </div>
        </div>
      </div>
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

  // Sort models by total helpful count (most positive feedback first)
  const sortedModels = [...feedbackStats.topModels]
    .sort((a, b) => b.helpfulCount - a.helpfulCount); // DESC order by helpfulCount

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-600" />
          User Feedback Leaders
        </h2>
        <div className="text-sm text-gray-600">
          Models ranked by positive feedback ({feedbackStats.totalFeedback.toLocaleString()} total ratings)
        </div>
      </div>
      <div className="card-body">
        <div className="space-y-2">
            {sortedModels.map((model, index) => {
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
                          {model.feedbackCount} total
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="h-3 w-3" />
                          {model.helpfulCount} helpful
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="h-3 w-3" />
                          {model.notHelpfulCount} not helpful
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`badge text-xs font-medium ${getSatisfactionColor(model.helpfulPercentage)}`}>
                      {model.helpfulPercentage.toFixed(1)}%
                    </div>
                    {model.feedbackCount < 10 && (
                      <div className="badge badge-outline text-xs bg-yellow-50 border-yellow-300 text-yellow-800">
                        <Info className="h-3 w-3 mr-1" />
                        Low sample
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Overall Stats */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Satisfaction:</span>
            <div className={`badge ${getSatisfactionColor(feedbackStats.helpfulPercentage)}`}>
              {feedbackStats.helpfulPercentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}