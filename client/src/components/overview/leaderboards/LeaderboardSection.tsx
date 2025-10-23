/**
 * Author: Cascade using Claude 3.5 Sonnet
 * Date: 2025-09-27T12:28:08-04:00
 * PURPOSE: Enhanced LeaderboardSection with improved responsive layout and scaling
 * 
 * Container component that displays three main leaderboards with better responsive design:
 * - Accuracy Leaderboard (pure puzzle-solving performance)
 * - Trustworthiness Leaderboard (confidence reliability)
 * - Feedback Leaderboard (user satisfaction)
 * 
 * FIXED: Improved grid layout, card height consistency, and mobile responsiveness
 * SRP and DRY check: Pass - Single responsibility for leaderboard layout, reuses existing components
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

interface OverconfidentModel {
  modelName: string;
  totalAttempts: number;
  totalOverconfidentAttempts: number;
  wrongOverconfidentPredictions: number;
  overconfidenceRate: number;
  avgConfidence: number;
  overallAccuracy: number;
  isHighRisk: boolean;
}

interface LeaderboardSectionProps {
  accuracyStats?: AccuracyStats;
  performanceStats?: PerformanceLeaderboards;
  feedbackStats?: FeedbackStats;
  overconfidentModels?: OverconfidentModel[];
  isLoadingAccuracy?: boolean;
  isLoadingPerformance?: boolean;
  isLoadingFeedback?: boolean;
  isLoadingOverconfident?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function LeaderboardSection({
  accuracyStats,
  performanceStats,
  feedbackStats,
  overconfidentModels,
  isLoadingAccuracy,
  isLoadingPerformance,
  isLoadingFeedback,
  isLoadingOverconfident,
  onModelClick
}: LeaderboardSectionProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800">Performance leaderboards</h2>
        <p className="text-[11px] text-gray-500">
          Accuracy · calibration · sentiment in one glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        <AccuracyLeaderboard
          accuracyStats={accuracyStats}
          overconfidentModels={overconfidentModels}
          isLoading={isLoadingAccuracy}
          onModelClick={onModelClick}
        />

        <TrustworthinessLeaderboard
          performanceStats={performanceStats}
          overconfidentModels={overconfidentModels}
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