/**
 * FeedbackSummary Component
 * @author Claude Code
 * 
 * Shows aggregate feedback statistics with visual indicators and breakdowns.
 * Displays helpful/not helpful counts, percentages, model performance, and trends.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  MessageSquare,
  Zap
} from 'lucide-react';
import type { FeedbackStats } from '@shared/types';

interface FeedbackSummaryProps {
  stats: FeedbackStats;
  showModelBreakdown?: boolean;
  showDailyTrends?: boolean;
  compact?: boolean;
  className?: string;
}

export function FeedbackSummary({ 
  stats, 
  showModelBreakdown = true,
  showDailyTrends = false,
  compact = false,
  className = ""
}: FeedbackSummaryProps) {
  if (!stats || stats.totalFeedback === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No feedback data available</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return <CompactSummary stats={stats} className={className} />;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Feedback Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalFeedback}</div>
              <div className="text-sm text-muted-foreground">Total Feedback</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.helpfulCount}</div>
              <div className="text-sm text-muted-foreground">Helpful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.notHelpfulCount}</div>
              <div className="text-sm text-muted-foreground">Not Helpful</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-green-600" />
                Helpful
              </span>
              <span className="font-medium">{stats.helpfulPercentage}%</span>
            </div>
            <Progress value={stats.helpfulPercentage} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                <ThumbsDown className="h-3 w-3 text-red-600" />
                Not Helpful
              </span>
              <span className="font-medium">{stats.notHelpfulPercentage}%</span>
            </div>
            <Progress value={stats.notHelpfulPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Model Performance Breakdown */}
      {showModelBreakdown && Object.keys(stats.feedbackByModel).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Model Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.feedbackByModel)
                .sort(([,a], [,b]) => (b.helpful + b.notHelpful) - (a.helpful + a.notHelpful))
                .map(([modelName, modelStats]) => {
                  const total = modelStats.helpful + modelStats.notHelpful;
                  const helpfulPercentage = total > 0 ? Math.round((modelStats.helpful / total) * 100) : 0;
                  
                  return (
                    <div key={modelName} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {modelName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {total} feedback{total !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 text-green-600">
                            <ThumbsUp className="h-3 w-3" />
                            {modelStats.helpful}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <ThumbsDown className="h-3 w-3" />
                            {modelStats.notHelpful}
                          </span>
                          <span className="font-medium">
                            {helpfulPercentage}%
                          </span>
                        </div>
                      </div>
                      <Progress value={helpfulPercentage} className="h-1" />
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Trends */}
      {showDailyTrends && stats.feedbackByDay.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.feedbackByDay.slice(0, 10).map((day, index) => {
                const total = day.helpful + day.notHelpful;
                const date = new Date(day.date).toLocaleDateString();
                
                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{date}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-green-600">
                        <ThumbsUp className="h-3 w-3" />
                        {day.helpful}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <ThumbsDown className="h-3 w-3" />
                        {day.notHelpful}
                      </span>
                      <Badge variant="outline" className="text-xs ml-1">
                        {total}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompactSummary({ stats, className }: { stats: FeedbackStats; className: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-1 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{stats.totalFeedback}</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-green-600">
        <ThumbsUp className="h-3 w-3" />
        <span>{stats.helpfulCount}</span>
        <span className="text-muted-foreground">({stats.helpfulPercentage}%)</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-red-600">
        <ThumbsDown className="h-3 w-3" />
        <span>{stats.notHelpfulCount}</span>
        <span className="text-muted-foreground">({stats.notHelpfulPercentage}%)</span>
      </div>
    </div>
  );
}