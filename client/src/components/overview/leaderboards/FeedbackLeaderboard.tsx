/**
 * FeedbackLeaderboard Component
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-05
 *
 * Displays models ranked by user feedback (helpful vs not-helpful ratings).
 * Uses data from FeedbackRepository via /api/feedback/stats
 *
 * Key Features:
 * - Shows most appreciated and most criticized models
 * - Tooltips explaining feedback metrics
 * - Sample size warnings for models with low feedback counts
 *
 * SRP and DRY check: Pass - Single responsibility for feedback display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, ScrollArea, Tooltip, Icons)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            Model Feedback Analysis
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
            Model Feedback Analysis
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

  // Sort models by helpfulness percentage and notHelpfulCount for different views
  const mostHelpfulModels = [...feedbackStats.topModels]
    .sort((a, b) => b.helpfulPercentage - a.helpfulPercentage) // DESC order by helpfulPercentage
    .slice(0, 4);
    
  const mostCriticizedModels = [...feedbackStats.topModels]
    .filter(model => model.feedbackCount >= 3) // Only models with meaningful feedback
    .sort((a, b) => b.notHelpfulCount - a.notHelpfulCount) // DESC order by notHelpfulCount (most criticized first)
    .slice(0, 4);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-600" />
          Model Feedback Analysis
        </CardTitle>
        <div className="text-sm text-gray-600">
          Based on {feedbackStats.totalFeedback.toLocaleString()} user ratings
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          {/* Most Appreciated Models Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">Most Appreciated Models</h3>
            </div>
            <div className="space-y-2">
            {mostHelpfulModels.map((model, index) => {
              const volumeInfo = getVolumeIndicator(model.feedbackCount);
              const VolumeIcon = volumeInfo.icon;
              
              return (
                <div 
                  key={`helpful-${model.modelName}`}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    onModelClick ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
                  }`}
                  onClick={() => onModelClick?.(model.modelName)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Star className="h-4 w-4 text-green-500 fill-current" />
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-medium cursor-help ${getSatisfactionColor(model.helpfulPercentage)}`}
                          >
                            {model.helpfulPercentage.toFixed(1)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            <strong>Helpful Percentage</strong>
                            <br />
                            {model.helpfulCount} helpful / {model.feedbackCount} total ratings
                            <br />
                            = {model.helpfulPercentage.toFixed(1)}% helpful rate
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {model.feedbackCount < 10 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300 text-yellow-800 cursor-help">
                              <Info className="h-3 w-3 mr-1" />
                              Low sample
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">
                              <strong>Low Sample Size Warning</strong>
                              <br />
                              Only {model.feedbackCount} feedback entries - percentage may not be reliable
                              <br />
                              Recommended: 10+ feedback entries for confidence
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Criticized Models Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsDown className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-gray-900">Most Criticized Models</h3>
            <span className="text-xs text-gray-500">(ranked by total not-helpful ratings)</span>
          </div>
          <div className="space-y-2">
            {mostCriticizedModels.map((model, index) => {
              const volumeInfo = getVolumeIndicator(model.feedbackCount);
              const VolumeIcon = volumeInfo.icon;
              
              return (
                <div 
                  key={`criticized-${model.modelName}`}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    onModelClick ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
                  }`}
                  onClick={() => onModelClick?.(model.modelName)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" title={model.modelName}>
                        {model.modelName}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <VolumeIcon className={`h-3 w-3 ${volumeInfo.color}`} />
                          {model.feedbackCount} ratings
                        </div>
                        <div className="flex items-center gap-1 text-red-600 font-medium">
                          <ThumbsDown className="h-3 w-3" />
                          {model.notHelpfulCount} not helpful
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-medium cursor-help ${getSatisfactionColor(model.helpfulPercentage)}`}
                          >
                            {model.helpfulPercentage.toFixed(1)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            <strong>Helpful Percentage</strong>
                            <br />
                            {model.helpfulCount} helpful / {model.feedbackCount} total ratings
                            <br />
                            = {model.helpfulPercentage.toFixed(1)}% helpful rate
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {model.feedbackCount < 10 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300 text-yellow-800 cursor-help">
                              <Info className="h-3 w-3 mr-1" />
                              Low sample
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">
                              <strong>Low Sample Size Warning</strong>
                              <br />
                              Only {model.feedbackCount} feedback entries - percentage may not be reliable
                              <br />
                              Recommended: 10+ feedback entries for confidence
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </ScrollArea>
        
        {/* Overall Stats */}
        <div className="pt-3 border-t">
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