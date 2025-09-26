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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  TrendingUp,
  Database,
  Settings,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  DollarSign,
  Search,
  Loader2,
  MessageSquare
} from 'lucide-react';

// Import existing analytics components (already well-architected)
import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { ModelComparisonMatrix } from '@/components/overview/ModelComparisonMatrix';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { ModelDebugModal } from '@/components/ModelDebugModal';
import { ModelPerformanceCard } from '@/components/ui/ModelPerformanceCard';

// Import hooks that follow proper repository pattern
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { useModelComparisons } from '@/hooks/useModelComparisons';

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

  // Custom query functionality
  const [customQuery, setCustomQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<string>('');
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string>('');

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

  const handleCustomQuery = useCallback(async () => {
    if (!customQuery.trim()) {
      setQueryError('Please enter a query');
      return;
    }

    setIsQueryLoading(true);
    setQueryError('');
    setQueryResult('');

    try {
      // For now, let's create a simple pattern matching for common queries
      const query = customQuery.toLowerCase().trim();
      
      let response = '';
      
      // Extract model name from query
      const modelNameMatch = query.match(/(?:gpt-?[4-5][^a-z\s]*|claude|gemini|llama|qwen|o[13]|grok|anthropic|openai)[^\s,]*/i);
      const modelName = modelNameMatch ? modelNameMatch[0] : null;
      
      if (query.includes('how many') && query.includes('puzzle') && query.includes('solved')) {
        if (modelName && accuracyStats?.modelAccuracyRankings) {
          const model = accuracyStats.modelAccuracyRankings.find(m => 
            m.modelName.toLowerCase().includes(modelName.toLowerCase())
          );
          if (model) {
            response = `${model.modelName} has solved ${model.correctPredictions} puzzles out of ${model.totalAttempts} attempts (${model.accuracyPercentage.toFixed(1)}% accuracy).`;
          } else {
            response = `I couldn't find performance data for "${modelName}". Available models include: ${accuracyStats.modelAccuracyRankings.map(m => m.modelName).slice(0, 5).join(', ')}.`;
          }
        } else if (accuracyStats?.totalSolverAttempts) {
          response = `In total, across all models, ${accuracyStats.totalCorrectPredictions} puzzles have been solved out of ${accuracyStats.totalSolverAttempts} attempts (${accuracyStats.overallAccuracyPercentage.toFixed(1)}% overall accuracy).`;
        }
      } else if (query.includes('best') || query.includes('top')) {
        if (accuracyStats?.modelAccuracyRankings && accuracyStats.modelAccuracyRankings.length > 0) {
          const topModel = [...accuracyStats.modelAccuracyRankings].sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)[0];
          response = `The best performing model is ${topModel.modelName} with ${topModel.accuracyPercentage.toFixed(1)}% accuracy (${topModel.correctPredictions}/${topModel.totalAttempts} puzzles solved).`;
        }
      } else if (query.includes('cost') && modelName) {
        if (modelComparisons) {
          const model = modelComparisons.find(m => 
            m.modelName.toLowerCase().includes(modelName.toLowerCase())
          );
          if (model) {
            const costInfo = model.costPerCorrectAnswer 
              ? `$${model.costPerCorrectAnswer.toFixed(4)} per correct answer`
              : 'cost per correct answer not available';
            response = `${model.modelName} has a total cost of $${model.totalCost.toFixed(4)} with an average of $${model.avgCost.toFixed(6)} per attempt and ${costInfo}.`;
          } else {
            response = `I couldn't find cost data for "${modelName}".`;
          }
        }
      } else if (query.includes('accuracy') && modelName) {
        if (accuracyStats?.modelAccuracyRankings) {
          const model = accuracyStats.modelAccuracyRankings.find(m => 
            m.modelName.toLowerCase().includes(modelName.toLowerCase())
          );
          if (model) {
            response = `${model.modelName} has an accuracy of ${model.accuracyPercentage.toFixed(1)}% with ${model.correctPredictions} correct predictions out of ${model.totalAttempts} attempts.`;
          }
        }
      } else {
        response = `I understand you're asking: "${customQuery}"\n\nI can help you with queries like:\n• "How many puzzles has GPT-5 solved?"\n• "What's the best performing model?"\n• "What's the cost for Claude?"\n• "What's the accuracy of Gemini?"\n\nTry rephrasing your question using one of these patterns.`;
      }
      
      setQueryResult(response || "I couldn't understand your query. Please try asking about model performance, costs, or accuracy.");
    } catch (error) {
      setQueryError('Failed to process query. Please try again.');
    } finally {
      setIsQueryLoading(false);
    }
  }, [customQuery, accuracyStats, modelComparisons]);

  const handleQueryKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomQuery();
    }
  }, [handleCustomQuery]);

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
        <ModelComparisonMatrix
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

        {/* Custom Query Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ask Questions About Your Data
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Query your analytics data using natural language. Ask about model performance, costs, or accuracy.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Question</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 'How many puzzles has GPT-5 solved?' or 'What's the best performing model?'"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  onKeyPress={handleQueryKeyPress}
                  className="flex-1"
                />
                <Button 
                  onClick={handleCustomQuery}
                  disabled={isQueryLoading || !customQuery.trim()}
                  size="default"
                >
                  {isQueryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {isQueryLoading ? 'Analyzing...' : 'Ask'}
                </Button>
              </div>
              {queryError && (
                <p className="text-sm text-destructive mt-1">{queryError}</p>
              )}
            </div>

            {queryResult && (
              <div className="space-y-2">
                <Separator />
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Analysis Result:
                  </h4>
                  <div className="text-sm whitespace-pre-line text-foreground">
                    {queryResult}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="text-sm font-semibold mb-1 text-blue-900">Example Queries:</h4>
              <div className="text-xs text-blue-800 space-y-1">
                <div>• "How many puzzles has GPT-5 solved?"</div>
                <div>• "What's the best performing model?"</div>
                <div>• "What's the cost for Claude?"</div>
                <div>• "What's the accuracy of Gemini?"</div>
                <div>• "How many puzzles have been solved in total?"</div>
              </div>
            </div>
          </CardContent>
        </Card>

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






