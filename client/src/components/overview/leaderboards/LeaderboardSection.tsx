/**
 * LeaderboardSection Component
 * 
 * Container component that displays three main leaderboards side by side:
 * - Accuracy Leaderboard (pure puzzle-solving performance)
 * - Trustworthiness Leaderboard (confidence reliability)
 * - Feedback Leaderboard (user satisfaction)
 */

import React from 'react';
import { AccuracyLeaderboard } from './AccuracyLeaderboard';
import { TrustworthinessLeaderboard } from './TrustworthinessLeaderboard';
import { FeedbackLeaderboard } from './FeedbackLeaderboard';

interface AccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    singleTestAccuracy: number;
    multiTestAccuracy: number;
  }>;
}

interface PerformanceLeaderboards {
  trustworthinessLeaders: Array<{
    modelName: string;
    avgTrustworthiness: number;
    avgConfidence: number;
    avgProcessingTime: number;
    avgCost: number;
    totalCost: number;
  }>;
  speedLeaders: any[];
  efficiencyLeaders: any[];
  overallTrustworthiness: number;
}

interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: Array<{
    modelName: string;
    feedbackCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    helpfulPercentage: number;
  }>;
  feedbackByModel: Record<string, {
    helpful: number;
    notHelpful: number;
  }>;
}

interface LeaderboardSectionProps {
  accuracyStats?: AccuracyStats;
  performanceStats?: PerformanceLeaderboards;
  feedbackStats?: FeedbackStats;
  isLoadingAccuracy?: boolean;
  isLoadingPerformance?: boolean;
  isLoadingFeedback?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function LeaderboardSection({
  accuracyStats,
  performanceStats,
  feedbackStats,
  isLoadingAccuracy,
  isLoadingPerformance,
  isLoadingFeedback,
  onModelClick
}: LeaderboardSectionProps) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Model Performance Leaderboards
        </h2>
        <p className="text-gray-600 max-w-3xl mx-auto">
          Comprehensive model analysis across three key dimensions: 
          models needing improvement (lowest accuracy), confidence reliability rankings (all models), and user feedback analysis (most appreciated vs most criticized).
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AccuracyLeaderboard 
          accuracyStats={accuracyStats}
          isLoading={isLoadingAccuracy}
          onModelClick={onModelClick}
        />
        
        <TrustworthinessLeaderboard 
          performanceStats={performanceStats}
          isLoading={isLoadingPerformance}
          onModelClick={onModelClick}
        />
        
        <FeedbackLeaderboard 
          feedbackStats={feedbackStats}
          isLoading={isLoadingFeedback}
          onModelClick={onModelClick}
        />
      </div>
    </section>
  );
}