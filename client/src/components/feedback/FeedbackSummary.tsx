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
  Zap,
  Puzzle,
  Trophy,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

  const topPuzzles = stats.topPuzzles?.slice(0, 3) ?? [];
  const topModels = stats.topModels?.slice(0, 3) ?? [];
  const [latestDay, previousDay] = stats.feedbackTrends?.daily ?? [];
  const dailyChange = latestDay && previousDay && previousDay.total > 0
    ? ((latestDay.total - previousDay.total) / previousDay.total) * 100
    : null;
  const dailyChangeLabel = dailyChange === null
    ? 'Not enough history'
    : `${dailyChange > 0 ? '+' : ''}${Math.round(dailyChange)}% vs prior day`;
  const changePositive = (dailyChange ?? 0) >= 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-base text-foreground">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Feedback volume
              </span>
              <span className={`inline-flex items-center gap-1 text-xs ${changePositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {changePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {dailyChangeLabel}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-semibold">{stats.totalFeedback.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total reviews captured</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-emerald-600 font-medium">{stats.helpfulCount.toLocaleString()} Helpful</p>
                <p className="text-rose-600 font-medium">{stats.notHelpfulCount.toLocaleString()} Not helpful</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-emerald-600" /> Helpful ratio
                  </span>
                  <span className="font-medium">{stats.helpfulPercentage}%</span>
                </div>
                <Progress value={stats.helpfulPercentage} className="mt-1 h-2" />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Avg. comment length
                </span>
                <span>{stats.averageCommentLength.toLocaleString()} chars</span>
              </div>
              {latestDay && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Latest activity</span>
                  <span>{new Date(latestDay.date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-base text-foreground">
                <Puzzle className="h-5 w-5 text-purple-600" />
                Most discussed puzzles
              </span>
              <span className="text-xs text-muted-foreground">Top {topPuzzles.length || 0}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPuzzles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No puzzle feedback captured yet.</p>
            ) : (
              <ul className="space-y-2">
                {topPuzzles.map((puzzle, index) => (
                  <li key={puzzle.puzzleId} className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Badge variant="secondary" className="font-mono text-[10px]">#{index + 1}</Badge>
                        <span>{puzzle.puzzleId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {puzzle.feedbackCount.toLocaleString()} reviews · {puzzle.helpfulPercentage}% helpful
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Last feedback {formatDistanceToNow(new Date(puzzle.latestFeedbackAt), { addSuffix: true })}
                      </p>
                    </div>
                    <a
                      href={`/task/${puzzle.puzzleId}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Analyze <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-base text-foreground">
                <Trophy className="h-5 w-5 text-amber-500" />
                Models earning praise
              </span>
              <span className="text-xs text-muted-foreground">Top {topModels.length || 0}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No model feedback recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {topModels.map((model, index) => (
                  <li key={model.modelName} className="flex items-center justify-between gap-3 rounded-md border border-border/50 p-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Badge variant="outline" className="font-mono text-[10px]">#{index + 1}</Badge>
                        <span className="truncate">{model.modelName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {model.helpfulCount.toLocaleString()} helpful · {model.feedbackCount.toLocaleString()} total
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-600">{model.helpfulPercentage}% helpful</p>
                      <p className="text-[11px] text-muted-foreground">Avg confidence {model.avgConfidence.toFixed(1)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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