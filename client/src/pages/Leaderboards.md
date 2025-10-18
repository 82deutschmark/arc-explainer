/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Dedicated Leaderboards page 
 * Audit: PAGE IS A DISASTER!!!  Coded by a dev who had no idea about how the project worked or what exists already.
 * Needs to be rewritten from scratch.
 * The page somehow manages to say the correct thing in the understanding the metrics section, but the actual implementation is visual garbage.
 * Cannot be using nested scrolling components!!
 * 
 * - Overconfident Models (accuracy leaderboard)  THIS MAKES NO SENSE!!!!
 * - Trustworthiness Leaders (confidence reliability) THIS IS WRONG!!  Trustworthiness is different from confidence reliability
 * - Feedback Analysis (user satisfaction) THIS IS MORE WRONG!!!
 *
 * Enhanced with tooltips, sample size warnings, and data quality indicators
 * Uses data from AccuracyRepository, TrustworthinessRepository, and FeedbackRepository
 *
 * SRP and DRY check: Pass - Single responsibility for leaderboard display, reuses existing components
 * DaisyUI: Pass - Converted to pure DaisyUI components
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
      <div className="min-h-screen bg-base-200">
        <div className="max-w-full mx-auto">
          <div className="text-center py-16">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-base-content/40" />
            <h2 className="text-2xl font-bold mb-2">
              Leaderboards Unavailable
            </h2>
            <p className="text-base-content/70 mb-6">
              Failed to load leaderboard data. Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-full space-y-6">

        {/* Hero Header */}
        <div className="hero bg-gradient-to-r from-primary to-secondary py-12">
          <div className="hero-content text-center">
            <div className="max-w-3xl">
              <div className="flex items-center justify-center gap-3 mb-4">
                <BarChart3 className="h-10 w-10 text-primary-content" />
                <h1 className="text-4xl font-bold text-primary-content">
                  Model Performance Leaderboards
                </h1>
              </div>
              <p className="text-lg text-primary-content/90">
                Comprehensive rankings across three dimensions: overconfidence detection,
                confidence reliability, and user feedback analysis
              </p>
            </div>
          </div>
        </div>

        {/* Data Quality Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-success rounded-full"></span>
            <span className="text-base-content/70">High quality data (&gt;10 samples)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-warning rounded-full"></span>
            <span className="text-base-content/70">Low sample warning (&lt;10 samples)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-error rounded-full"></span>
            <span className="text-base-content/70">High risk detected</span>
          </div>
        </div>

        {/* Metrics Explanation */}
        <div role="alert" className="alert alert-info shadow-lg">
          <div className="w-full">
            <h2 className="text-lg font-semibold mb-3">
              Understanding the Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-1">⚠️ Overconfident Models</h3>
                <p className="opacity-90">
                  Models with high confidence (≥80%) but poor accuracy (&lt;50%). These models
                  are dangerous because they express certainty despite being wrong.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">🛡️ Trustworthiness Score</h3>
                <p className="opacity-90">
                  Measures how well a model's confidence predicts actual correctness. Higher scores
                  mean the model's confidence is more reliable.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">💬 Feedback Analysis</h3>
                <p className="opacity-90">
                  User ratings of explanation quality. Shows which models provide the most helpful
                  explanations according to real users.
                </p>
              </div>
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
