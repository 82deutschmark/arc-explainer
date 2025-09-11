/**
 * PuzzleDBViewer.tsx
 * 
 * @author Cascade, Claude (refactored)
 * @description Model Performance Dashboard showing how all AI models are performing overall.
 * Displays reliability, accuracy, trustworthiness, and user feedback statistics.
 */

import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Import leaderboard components
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { ReliabilityLeaderboard } from '@/components/overview/leaderboards/ReliabilityLeaderboard';
import { AccuracyLeaderboard } from '@/components/overview/leaderboards/AccuracyLeaderboard';
import { TrustworthinessLeaderboard } from '@/components/overview/leaderboards/TrustworthinessLeaderboard';
import { FeedbackLeaderboard } from '@/components/overview/leaderboards/FeedbackLeaderboard';


export default function PuzzleDBViewer() {
  // Set page title
  React.useEffect(() => {
    document.title = 'Model Performance Dashboard - ARC Explainer';
  }, []);

  // Fetch model leaderboard data
  const {
    reliabilityStats,
    accuracyStats,
    performanceStats,
    feedbackStats,
    isLoadingReliability,
    isLoadingAccuracy,
    isLoadingPerformance,
    isLoadingFeedback,
    isLoadingAny,
    hasAnyError,
    reliabilityError,
    accuracyError,
    performanceError,
    feedbackError
  } = useModelLeaderboards();


  return (
    <div className="container mx-auto p-3 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-600" />
            Model Performance Dashboard
          </h1>
          <p className="text-gray-600">
            Technical reliability, accuracy, and user feedback across all AI models
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Live Data
          </Badge>
          {isLoadingAny && (
            <Badge variant="outline" className="text-blue-600">
              Updating...
            </Badge>
          )}
        </div>
      </div>

      {/* Error State */}
      {hasAnyError && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading some dashboard data</p>
              <div className="text-sm mt-1 space-y-1">
                {reliabilityError && <p>Reliability: {reliabilityError.message}</p>}
                {accuracyError && <p>Accuracy: {accuracyError.message}</p>}
                {performanceError && <p>Performance: {performanceError.message}</p>}
                {feedbackError && <p>Feedback: {feedbackError.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance Overview</CardTitle>
          <p className="text-sm text-gray-600">
            Comprehensive analysis of AI model performance across technical reliability, puzzle accuracy, confidence calibration, and user satisfaction
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Models Tracked</p>
              <p className="text-2xl font-bold text-gray-900">
                {reliabilityStats?.length || accuracyStats?.modelAccuracyRankings?.length || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">
                {reliabilityStats?.reduce((sum, stat) => sum + stat.totalRequests, 0)?.toLocaleString() || '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Overall Accuracy</p>
              <p className="text-2xl font-bold text-gray-900">
                {accuracyStats?.overallAccuracyPercentage ? `${Math.round(accuracyStats.overallAccuracyPercentage * 10) / 10}%` : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">User Feedback</p>
              <p className="text-2xl font-bold text-gray-900">
                {feedbackStats?.totalFeedback?.toLocaleString() || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ReliabilityLeaderboard 
          reliabilityStats={reliabilityStats}
          isLoading={isLoadingReliability}
        />
        
        <AccuracyLeaderboard 
          accuracyStats={accuracyStats}
          isLoading={isLoadingAccuracy}
        />
        
        <TrustworthinessLeaderboard 
          performanceStats={performanceStats}
          isLoading={isLoadingPerformance}
        />
        
        <FeedbackLeaderboard 
          feedbackStats={feedbackStats}
          isLoading={isLoadingFeedback}
        />
      </div>
    </div>
  );
}
