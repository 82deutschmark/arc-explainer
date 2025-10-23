/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Shared TypeScript interfaces for the leaderboards experience.
 *          Centralizes the shapes returned by MetricsRepository and AccuracyRepository-backed
 *          API endpoints so page components can consume strongly-typed data without re-declaring
 *          structures in multiple places.
 * SRP/DRY check: Pass — consolidates leaderboard data contracts in a single module.
 */

export interface AccuracyModelRanking {
  modelName: string;
  totalAttempts: number;
  correctPredictions: number;
  accuracyPercentage: number;
  singleTestAccuracy: number;
  multiTestAccuracy: number;
}

export interface AccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: AccuracyModelRanking[];
}

export interface OverconfidentModel {
  modelName: string;
  totalAttempts: number;
  totalOverconfidentAttempts: number;
  wrongOverconfidentPredictions: number;
  overconfidenceRate: number;
  avgConfidence: number;
  overallAccuracy: number;
  isHighRisk: boolean;
}

export interface TrustworthinessLeader {
  modelName: string;
  avgTrustworthiness: number;
  avgConfidence: number;
  avgProcessingTime: number;
  avgCost: number;
  totalCost: number;
}

export interface PerformanceLeaderboards {
  trustworthinessLeaders: TrustworthinessLeader[];
  speedLeaders: Array<Record<string, unknown>>;
  efficiencyLeaders: Array<Record<string, unknown>>;
  overallTrustworthiness: number;
}

export interface FeedbackTopModel {
  modelName: string;
  feedbackCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
}

export interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: FeedbackTopModel[];
  feedbackByModel: Record<string, { helpful: number; notHelpful: number }>;
}

export interface ReliabilityStat {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
}

export interface ModelPerformanceRow {
  modelName: string;
  accuracyPercentage?: number;
  totalAttempts?: number;
  trustworthiness?: number;
  avgConfidence?: number;
  reliability?: number;
}

export interface LeaderboardSummaryTotals {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracyPercentage: number | null;
  trackedModels: number;
}

export interface LeaderboardSummary {
  totals: LeaderboardSummaryTotals;
  topAccuracyModels: AccuracyModelRanking[];
  topTrustworthyModels: TrustworthinessLeader[];
  mostReliableModels: ReliabilityStat[];
  highestRiskModels: OverconfidentModel[];
}

export interface LeaderboardData {
  accuracyStats?: AccuracyStats;
  performanceStats?: PerformanceLeaderboards;
  feedbackStats?: FeedbackStats;
  reliabilityStats?: ReliabilityStat[];
  overconfidentModels?: OverconfidentModel[];
}

export interface LeaderboardQueryState {
  isLoadingAny: boolean;
  isLoadingAll: boolean;
  hasAnyError: boolean;
  isSuccess: boolean;
}

