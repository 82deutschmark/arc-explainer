/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Pure DaisyUI model comparison dashboard showing comprehensive head-to-head metrics.
 * Displays per-model performance, cost analysis, speed comparison, and puzzle-by-puzzle matrix.
 *
 * FEATURES:
 * - DaisyUI hero section with winner indicators
 * - Radial progress cards for accuracy visualization
 * - Stats grid with high-impact metrics
 * - Per-model performance cards with detailed breakdowns
 * - Theme toggle using DaisyUI theme-controller
 * - Comparison matrix table
 *
 * SRP and DRY check: Pass - Single responsibility is model comparison visualization
 * DaisyUI: Pass - Uses ONLY DaisyUI components, no custom UI or shadcn/ui
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Trophy, Zap, DollarSign, TrendingUp, Target, Clock, Brain, AlertCircle, Sun, Moon } from 'lucide-react';
import { NewModelComparisonResults } from '@/components/analytics/NewModelComparisonResults';
import { ModelComparisonResult } from './AnalyticsOverview';

export default function ModelComparisonPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>('dark');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Get comparison data from location state or URL params
  const [comparisonData, setComparisonData] = useState<ModelComparisonResult | null>(() => {
    const stateData = (window.history.state?.comparisonData as ModelComparisonResult | null);
    if (stateData) {
      try {
        localStorage.setItem('arc-comparison-data', JSON.stringify(stateData));
      } catch (e) {
        console.warn('Failed to store comparison data in localStorage:', e);
      }
      return stateData;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const model1 = urlParams.get('model1');
    const model2 = urlParams.get('model2');
    const dataset = urlParams.get('dataset');

    if (model1 && dataset) {
      return null; // Will fetch below
    }

    try {
      const storedData = localStorage.getItem('arc-comparison-data');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed?.summary && Array.isArray(parsed.details)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to retrieve comparison data from localStorage:', e);
    }

    return null;
  });

  // Fetch comparison data when missing
  useEffect(() => {
    const fetchComparisonData = async () => {
      if (comparisonData) return;

      const urlParams = new URLSearchParams(window.location.search);
      const model1 = urlParams.get('model1');
      const model2 = urlParams.get('model2');
      const dataset = urlParams.get('dataset');

      if (!model1 || !dataset) {
        setError('Missing required parameters. Please run a comparison from the Analytics page.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const models = [model1, model2].filter(Boolean);
        const queryParams = new URLSearchParams({
          model1: models[0] || '',
          ...(models[1] && { model2: models[1] }),
          dataset
        });

        const response = await fetch(`/api/metrics/compare?${queryParams.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch comparison data');
        }

        const result = await response.json();

        if (!result.data) {
          throw new Error('No data received from server');
        }

        setComparisonData(result.data);

        try {
          localStorage.setItem('arc-comparison-data', JSON.stringify(result.data));
        } catch (e) {
          console.warn('Failed to store comparison data in localStorage:', e);
        }
      } catch (error) {
        console.error('Comparison error:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch comparison data');
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [comparisonData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="mt-4 text-base-content/70">Loading comparison data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div role="alert" className="alert alert-error shadow-lg">
          <AlertCircle className="h-6 w-6" />
          <span>{error}</span>
        </div>
        <button onClick={() => navigate('/analytics')} className="btn btn-primary mt-4">
          <ArrowLeft className="h-5 w-5" />
          Back to Analytics
        </button>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div role="alert" className="alert alert-warning shadow-lg">
          <AlertCircle className="h-6 w-6" />
          <span>No comparison data found. Please run a comparison from the Analytics page.</span>
        </div>
        <button onClick={() => navigate('/analytics')} className="btn btn-primary mt-4">
          <ArrowLeft className="h-5 w-5" />
          Back to Analytics
        </button>
      </div>
    );
  }

  const { summary } = comparisonData;
  const modelPerf = summary.modelPerformance || [];

  // Helper to format costs
  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined || cost === 0) return 'Free';
    if (cost < 0.01) return `${(cost * 1000).toFixed(2)}m`;
    if (cost < 1) return `${(cost * 100).toFixed(2)}¢`;
    return `$${cost.toFixed(4)}`;
  };

  // Helper to format time
  const formatTime = (ms: number | undefined) => {
    if (!ms || ms === 0) return 'N/A';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="container mx-auto max-w-7xl space-y-6">

        {/* Header with Back Button and Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/analytics')}
            className="btn btn-ghost gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Analytics
          </button>

          <button
            onClick={toggleTheme}
            className="btn btn-circle btn-ghost"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {/* DaisyUI Hero Section */}
        <div className="hero bg-gradient-to-r from-primary to-secondary rounded-box shadow-xl">
          <div className="hero-content text-center py-12 px-6">
            <div className="max-w-4xl">
              <h1 className="text-5xl font-bold text-primary-content mb-4">
                Model Battle: {modelPerf[0]?.modelName || 'Model 1'} vs {modelPerf[1]?.modelName || 'Model 2'}
              </h1>
              <p className="text-xl text-primary-content/80 mb-6">
                {summary.dataset.toUpperCase()} Dataset • {summary.totalPuzzles} Puzzles
              </p>

              {/* Winner Badges */}
              <div className="flex justify-center gap-4 flex-wrap mt-4">
                {summary.winnerModel && (
                  <div className="badge badge-success badge-lg gap-2">
                    <Trophy className="h-4 w-4" />
                    Accuracy Winner: {summary.winnerModel}
                  </div>
                )}
                {summary.mostEfficientModel && (
                  <div className="badge badge-info badge-lg gap-2">
                    <DollarSign className="h-4 w-4" />
                    Most Efficient: {summary.mostEfficientModel}
                  </div>
                )}
                {summary.fastestModel && (
                  <div className="badge badge-warning badge-lg gap-2">
                    <Zap className="h-4 w-4" />
                    Fastest: {summary.fastestModel}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DaisyUI Stats Grid - High-Impact Metrics */}
        <div className="stats stats-vertical lg:stats-horizontal shadow-xl w-full bg-base-100">
          <div className="stat">
            <div className="stat-figure text-success">
              <Target className="h-8 w-8" />
            </div>
            <div className="stat-title">All Correct</div>
            <div className="stat-value text-success">{summary.allCorrect}</div>
            <div className="stat-desc">Both models solved</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-error">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="stat-title">All Incorrect</div>
            <div className="stat-value text-error">{summary.allIncorrect}</div>
            <div className="stat-desc">Both models failed</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-warning">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div className="stat-title">Disagreements</div>
            <div className="stat-value text-warning">
              {summary.totalPuzzles - summary.allCorrect - summary.allIncorrect - summary.allNotAttempted}
            </div>
            <div className="stat-desc">Models differ</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-info">
              <Trophy className="h-8 w-8" />
            </div>
            <div className="stat-title">Fully Solved</div>
            <div className="stat-value text-info">{summary.fullySolvedCount}</div>
            <div className="stat-desc">≥1 model correct</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-base-content/50">
              <Brain className="h-8 w-8" />
            </div>
            <div className="stat-title">Unsolved</div>
            <div className="stat-value">{summary.unsolvedCount}</div>
            <div className="stat-desc">All failed</div>
          </div>
        </div>

        {/* Per-Model Performance Cards with Radial Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modelPerf.map((model, idx) => (
            <div key={model.modelName} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body p-6">
                <h2 className="card-title mb-4">
                  <div className={`badge ${idx === 0 ? 'badge-primary' : 'badge-secondary'} badge-lg`}>
                    {model.modelName}
                  </div>
                  {summary.winnerModel === model.modelName && (
                    <div className="badge badge-success gap-1 ml-2">
                      <Trophy className="h-3 w-3" />
                      Winner
                    </div>
                  )}
                </h2>

                <div className="flex items-center justify-around my-6">
                  {/* Radial Progress for Accuracy */}
                  <div className="flex flex-col items-center">
                    <div
                      className="radial-progress text-primary"
                      style={{ "--value": model.accuracyPercentage, "--size": "8rem", "--thickness": "8px" } as React.CSSProperties}
                      role="progressbar"
                    >
                      <span className="text-2xl font-bold">{model.accuracyPercentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm font-semibold mt-2">Accuracy</p>
                    <p className="text-xs text-base-content/60">{model.correctCount}/{model.attempts} correct</p>
                  </div>

                  {/* Coverage Progress */}
                  <div className="flex flex-col items-center">
                    <div
                      className="radial-progress text-secondary"
                      style={{ "--value": model.coveragePercentage, "--size": "6rem", "--thickness": "6px" } as React.CSSProperties}
                      role="progressbar"
                    >
                      <span className="text-lg font-bold">{model.coveragePercentage.toFixed(0)}%</span>
                    </div>
                    <p className="text-sm font-semibold mt-2">Coverage</p>
                    <p className="text-xs text-base-content/60">{model.attempts}/{model.totalPuzzlesInDataset} puzzles</p>
                  </div>
                </div>

                {/* Detailed Stats */}
                <div className="divider my-4"></div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-base-content/60 mb-1">Cost per Correct</div>
                    <div className="text-lg font-bold text-success">{formatCost(model.costPerCorrectAnswer)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/60 mb-1">Total Cost</div>
                    <div className="text-lg font-bold">{formatCost(model.totalCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/60 mb-1">Avg Speed</div>
                    <div className="text-lg font-bold flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTime(model.avgProcessingTime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/60 mb-1">Confidence</div>
                    <div className="text-lg font-bold">{model.avgConfidence.toFixed(1)}%</div>
                  </div>
                  {model.confidenceWhenCorrect !== null && (
                    <div className="col-span-2">
                      <div className="text-xs text-base-content/60 mb-1">Trustworthiness (Confidence When Correct)</div>
                      <div className="text-lg font-bold text-info">{model.confidenceWhenCorrect.toFixed(1)}%</div>
                    </div>
                  )}
                </div>

                {/* Status Breakdown */}
                <div className="flex gap-2 mt-4">
                  <div className="badge badge-success gap-1">
                    ✅ {model.correctCount}
                  </div>
                  <div className="badge badge-error gap-1">
                    ❌ {model.incorrectCount}
                  </div>
                  <div className="badge badge-ghost gap-1">
                    ⏳ {model.notAttemptedCount}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Matrix */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-6">
            <NewModelComparisonResults result={comparisonData} />
          </div>
        </div>

      </div>
    </div>
  );
}
