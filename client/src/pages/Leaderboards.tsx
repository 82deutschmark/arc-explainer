/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-05
 * PURPOSE: Dedicated Leaderboards page for model performance analysis
 *
 * Displays comprehensive leaderboards for model performance across three key dimensions:
 * - Overconfident Models (accuracy leaderboard)
 * - Trustworthiness Leaders (confidence reliability)
 * - Feedback Analysis (user satisfaction)
 *
 * Enhanced with tooltips, sample size warnings, and data quality indicators
 * Uses data from AccuracyRepository, TrustworthinessRepository, and FeedbackRepository
 *
 * SRP and DRY check: Pass - Single responsibility for leaderboard display, reuses existing components
 * shadcn/ui: Pass - Uses shadcn/ui components and reuses LeaderboardSection
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';

export default function Leaderboards() {
  // Set page title
  React.useEffect(() => {
    document.title = 'Model Leaderboards - ARC Explainer';
    window.scrollTo(0, 0);
  }, []);

  // Fetch leaderboard data
  const {
    accuracyStats,
    performanceStats,
    feedbackStats,
    overconfidentModels,
    isLoadingAccuracy,
    isLoadingPerformance,
    isLoadingFeedback,
    isLoadingOverconfident,
    hasAnyError
  } = useModelLeaderboards();

  // Error state
  if (hasAnyError) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Leaderboards Unavailable
            </h2>
            <p className="text-gray-600 mb-6">
              Failed to load leaderboard data. Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <header className="text-center space-y-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <BarChart3 className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Model Performance Leaderboards
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Comprehensive rankings across three dimensions: overconfidence detection,
            confidence reliability, and user feedback analysis
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
              High quality data (&gt;10 samples)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full"></span>
              Low sample warning (&lt;10 samples)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
              High risk detected
            </div>
          </div>
        </header>

        {/* Metrics Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            Understanding the Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-blue-900 mb-1">⚠️ Overconfident Models</h3>
              <p className="text-blue-800">
                Models with high confidence (≥80%) but poor accuracy (&lt;50%). These models
                are dangerous because they express certainty despite being wrong.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">🛡️ Trustworthiness Score</h3>
              <p className="text-blue-800">
                Measures how well a model's confidence predicts actual correctness. Higher scores
                mean the model's confidence is more reliable.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">💬 Feedback Analysis</h3>
              <p className="text-blue-800">
                User ratings of explanation quality. Shows which models provide the most helpful
                explanations according to real users.
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboards */}
        <LeaderboardSection
          accuracyStats={accuracyStats}
          performanceStats={performanceStats}
          feedbackStats={feedbackStats}
          overconfidentModels={overconfidentModels}
          isLoadingAccuracy={isLoadingAccuracy}
          isLoadingPerformance={isLoadingPerformance}
          isLoadingFeedback={isLoadingFeedback}
          isLoadingOverconfident={isLoadingOverconfident}
        />

      </div>
    </div>
  );
}
