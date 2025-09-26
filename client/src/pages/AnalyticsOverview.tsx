/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24
 * PURPOSE: Analytics and leaderboard dashboard showing model performance statistics.
 * Replaces the poorly named PuzzleOverview.tsx with a focused analytics interface.
 * Uses proper shadcn/ui components and follows established patterns from PuzzleDBViewer.tsx.
 * SRP and DRY check: Pass - Single responsibility of displaying analytics/leaderboards, reuses existing components
 * shadcn/ui: Pass - Uses proper shadcn/ui components throughout (Card, Badge, Button, Select, etc.)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BarChart3,
  TrendingUp,
  Database,
  Settings,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  DollarSign
} from 'lucide-react';

// Import existing analytics components (already well-architected)
import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { ModelDebugModal } from '@/components/ModelDebugModal';
import { ModelPerformanceCard } from '@/components/ui/ModelPerformanceCard';

// Import hooks that follow proper repository pattern
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { useModelComparisons } from '@/hooks/useModelComparisons';
import { useModelDatasetPerformance, useAvailableModels } from '@/hooks/useModelDatasetPerformance';

export default function AnalyticsOverview() {

  // Modal states
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');
  const [modelDebugModalOpen, setModelDebugModalOpen] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState<string>('');

  // Collapsible sections
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  // Display preferences
  const [topModelCount, setTopModelCount] = useState<string>('3');

  // Model dataset performance state
  const [selectedModelForDataset, setSelectedModelForDataset] = useState<string>('');

  // Fetch available models and model dataset performance
  const { models: availableModels, loading: loadingModels } = useAvailableModels();
  const { performance: modelDatasetPerformance, loading: loadingPerformance } = useModelDatasetPerformance(selectedModelForDataset || null);


  // Set page title
  React.useEffect(() => {
    document.title = 'Analytics Dashboard - ARC Explainer';
  }, []);

  // Fetch analytics data using proper repository-backed hooks
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

  // Fetch model comparison data
  const {
    modelComparisons,
    dashboard,
    isLoading: isLoadingComparisons
  } = useModelComparisons();

  const topModelLimit = useMemo(() => {
    const parsed = Number(topModelCount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 3;
    }

    return Math.min(Math.floor(parsed), 10);
  }, [topModelCount]);

  const topAccuracyModels = useMemo(() => {
    if (!accuracyStats?.modelAccuracyRankings?.length) {
      return [];
    }

    return [...accuracyStats.modelAccuracyRankings]
      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
      .slice(0, topModelLimit);
  }, [accuracyStats?.modelAccuracyRankings, topModelLimit]);

  const percentFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
    []
  );

  const currencyFormatterLarge = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    []
  );

  const currencyFormatterSmall = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }),
    []
  );

  const formatCurrency = useCallback(
    (value: number) => {
      if (!Number.isFinite(value) || value === 0) {
        return '$0.00';
      }

      return Math.abs(value) >= 1
        ? currencyFormatterLarge.format(value)
        : currencyFormatterSmall.format(value);
    },
    [currencyFormatterLarge, currencyFormatterSmall]
  );

  const summaryMetrics = useMemo(() => {
    const overallAccuracy =
      dashboard?.accuracyStats.overallAccuracyPercentage ?? accuracyStats?.overallAccuracyPercentage ?? 0;
    const overallTrust =
      dashboard?.trustworthinessStats.overallTrustworthiness ?? performanceStats?.overallTrustworthiness ?? 0;
    const avgCostPerAttempt = dashboard?.performanceMetrics.avgCostPerAttempt ?? 0;
    const totalCost = dashboard?.performanceMetrics.totalCost ?? 0;

    return {
      overallAccuracy,
      overallTrust,
      avgCostPerAttempt,
      totalCost,
    };
  }, [dashboard, accuracyStats, performanceStats]);

  const summaryCards = useMemo(() => {
    const totalAttempts = accuracyStats?.totalSolverAttempts ?? 0;
    const trustAttempts = dashboard?.trustworthinessStats.totalTrustworthinessAttempts ?? 0;

    return [
      {
        key: 'accuracy',
        label: 'Overall Accuracy',
        value: `${percentFormatter.format(summaryMetrics.overallAccuracy)}%`,
        helper: `${totalAttempts.toLocaleString()} solver attempts`,
        icon: <TrendingUp className="h-5 w-5 text-primary" />,
      },
      {
        key: 'trust',
        label: 'Overall Trustworthiness',
        value: `${percentFormatter.format(summaryMetrics.overallTrust * 100)}%`,
        helper: `${trustAttempts.toLocaleString()} analysed responses`,
        icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
      },
      {
        key: 'avgCost',
        label: 'Avg Cost / Attempt',
        value: formatCurrency(summaryMetrics.avgCostPerAttempt),
        helper:
          summaryMetrics.avgCostPerAttempt > 0
            ? 'Per successful analysis run'
            : 'No cost data recorded',
        icon: <DollarSign className="h-5 w-5 text-amber-500" />,
      },
      {
        key: 'totalCost',
        label: 'Total Spend',
        value: formatCurrency(summaryMetrics.totalCost),
        helper:
          summaryMetrics.totalCost > 0
            ? 'Across all recorded attempts'
            : 'No spend tracked yet',
        icon: <Database className="h-5 w-5 text-blue-500" />,
      },
    ];
  }, [
    accuracyStats?.totalSolverAttempts,
    dashboard?.trustworthinessStats.totalTrustworthinessAttempts,
    summaryMetrics,
    percentFormatter,
    formatCurrency,
  ]);

  const topModelVariants: Array<'default' | 'blue' | 'purple'> = ['default', 'blue', 'purple'];


  // Event handlers
  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName);
    setModelDebugModalOpen(true);
  }, []);

  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);


  // Error state
  if (hasAnyError) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Analytics Unavailable</h2>
                <p className="text-muted-foreground">
                  Failed to load analytics data. Please check your connection and try again.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                Analytics Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                Model performance analysis and leaderboards
              </p>
            </div>
          </div>
        </header>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(card => (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                {card.icon}
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{card.value}</p>
                {card.helper && (
                  <p className="text-xs text-muted-foreground mt-1">{card.helper}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Analytics Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Top Models Display</label>
                <Select value={topModelCount} onValueChange={setTopModelCount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Top 3 Models</SelectItem>
                    <SelectItem value="5">Top 5 Models</SelectItem>
                    <SelectItem value="10">Top 10 Models</SelectItem>
                  </SelectContent>
                </Select>
              </div>              <div className="space-y-2">
                <label className="text-sm font-medium">Advanced Options</label>
                <Collapsible open={showAdvancedAnalytics} onOpenChange={setShowAdvancedAnalytics}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Advanced Analytics
                      {showAdvancedAnalytics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Badge variant="secondary" className="text-xs">
                      Cross-model comparisons enabled
                    </Badge>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Leaderboards Section (Reusing existing well-architected component) */}
        <LeaderboardSection
          accuracyStats={accuracyStats}
          performanceStats={performanceStats}
          feedbackStats={feedbackStats}
          overconfidentModels={overconfidentModels}
          isLoadingAccuracy={isLoadingAccuracy}
          isLoadingPerformance={isLoadingPerformance}
          isLoadingFeedback={isLoadingFeedback}
          isLoadingOverconfident={isLoadingOverconfident}
          onModelClick={handleModelClick}
        />

        {/* Model Comparison Matrix (Recently fixed component) */}
        {/* <ModelComparisonMatrix
          modelComparisons={modelComparisons}
          isLoading={isLoadingComparisons}
          onModelClick={handleModelClick}
        />

        {/* Top Performing Models Section */}
        {accuracyStats?.modelAccuracyRankings && accuracyStats.modelAccuracyRankings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Performing Models
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Highest accuracy performers from pure puzzle-solving metrics
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fix: accuracyStats comes sorted ASC (worst first), so reverse to show best first */}
                {accuracyStats.modelAccuracyRankings
                  .slice()
                  .reverse()
                  .slice(0, parseInt(topModelCount))
                  .map((model, index) => {
                    const variants = ['default', 'blue', 'purple'] as const;
                    const emojis = ['🏆', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    const emoji = emojis[index] || `#${index + 1}`;

                    return (
                      <ModelPerformanceCard
                        key={model.modelName}
                        modelName={`${emoji} ${model.modelName}`}
                        accuracy={{
                          accuracyPercentage: model.accuracyPercentage,
                          correctPredictions: model.correctPredictions,
                          totalAttempts: model.totalAttempts
                        }}
                        variant={variants[index % variants.length]}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleModelClick(model.modelName)}
                      />
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}


        {/* Advanced Analytics Section */}
        {showAdvancedAnalytics && (
          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deep-dive model performance insights and cross-comparisons
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4" />
                <p>Advanced analytics features coming soon...</p>
                <p className="text-xs mt-2">
                  Will include cost analysis, time-series trends, and model evolution tracking
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Modals (Reusing existing components) */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        initialPuzzleId={selectedPuzzleId}
      />

      <ModelDebugModal
        open={modelDebugModalOpen}
        onOpenChange={setModelDebugModalOpen}
        modelName={selectedModelName}
      />
    </div>
  );
}






