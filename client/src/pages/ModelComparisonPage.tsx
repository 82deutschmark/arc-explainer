/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-12T14:09:00-04:00
 * PURPOSE: Professional model comparison dashboard with maximum information density.
 * Displays per-model performance metrics and detailed puzzle-by-puzzle comparison matrix.
 *
 * DESIGN PRINCIPLES:
 * - Light theme only (professional research platform)
 * - No cartoonish language ("Model Battle" removed)
 * - Information density maximized
 * - Clean tabular layouts for data comparison
 * - Emphasis on statistical accuracy and completeness
 *
 * SRP and DRY check: Pass - Single responsibility is model comparison visualization
 * DaisyUI: Pass - Uses DaisyUI components with professional styling
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
  // Force light theme for professional appearance
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl space-y-4">

        {/* Professional Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/analytics')}
            className="btn btn-sm btn-ghost gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Analytics
          </button>
        </div>

        {/* Professional Header Card */}
        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  Model Performance Comparison
                </h1>
                <p className="text-sm text-gray-600">
                  Dataset: {summary.dataset.toUpperCase()} • {summary.totalPuzzles} Total Puzzles • {summary.fullySolvedCount} Correct by ≥1 Model
                </p>
              </div>
              <div className="flex gap-2">
                {summary.winnerModel && (
                  <div className="text-xs font-medium text-gray-700">
                    Highest Accuracy: <span className="font-semibold text-green-700">{summary.winnerModel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actionable Comparison Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="card bg-white shadow-sm border border-gray-200">
            <div className="card-body p-3">
              <div className="text-xs text-gray-600 mb-1">Consensus: Both Correct</div>
              <div className="text-2xl font-bold text-green-600">{summary.allCorrect}</div>
              <div className="text-xs text-gray-500 mt-1">Reliable solutions</div>
            </div>
          </div>
          <div className="card bg-white shadow-sm border border-gray-200">
            <div className="card-body p-3">
              <div className="text-xs text-gray-600 mb-1">{summary.model1Name} Only Correct</div>
              <div className="text-2xl font-bold text-blue-600">{summary.model1OnlyCorrect}</div>
              <div className="text-xs text-gray-500 mt-1">Unique {summary.model1Name} wins</div>
            </div>
          </div>
          <div className="card bg-white shadow-sm border border-gray-200">
            <div className="card-body p-3">
              <div className="text-xs text-gray-600 mb-1">{summary.model2Name} Only Correct</div>
              <div className="text-2xl font-bold text-purple-600">{summary.model2OnlyCorrect}</div>
              <div className="text-xs text-gray-500 mt-1">Unique {summary.model2Name} wins</div>
            </div>
          </div>
          <div className="card bg-white shadow-sm border border-gray-200">
            <div className="card-body p-3">
              <div className="text-xs text-gray-600 mb-1">Systematic Failures</div>
              <div className="text-2xl font-bold text-red-600">{summary.allIncorrect}</div>
              <div className="text-xs text-gray-500 mt-1">Both models failed</div>
            </div>
          </div>
        </div>

        {/* Professional Data Table */}
        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Model Performance Metrics</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="font-semibold text-gray-700">Model</th>
                    <th className="font-semibold text-gray-700 text-center">Accuracy</th>
                    <th className="font-semibold text-gray-700 text-center">Correct</th>
                    <th className="font-semibold text-gray-700 text-center">Incorrect</th>
                    <th className="font-semibold text-gray-700 text-center">Not Attempted</th>
                    <th className="font-semibold text-gray-700 text-center">Coverage</th>
                    <th className="font-semibold text-gray-700 text-center">Avg Speed</th>
                    <th className="font-semibold text-gray-700 text-center">Total Cost</th>
                    <th className="font-semibold text-gray-700 text-center">Cost/Correct</th>
                    <th className="font-semibold text-gray-700 text-center">Avg Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {modelPerf.map((model) => (
                    <tr key={model.modelName} className="hover:bg-gray-50">
                      <td className="font-medium text-gray-900">
                        {model.modelName}
                        {summary.winnerModel === model.modelName && (
                          <span className="ml-2 text-xs font-semibold text-green-600">★ Highest Accuracy</span>
                        )}
                      </td>
                      <td className="text-center font-semibold text-lg">
                        <span className={model.accuracyPercentage >= 50 ? "text-green-600" : "text-red-600"}>
                          {model.accuracyPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center text-green-600 font-medium">✅ {model.correctCount}</td>
                      <td className="text-center text-red-600 font-medium">❌ {model.incorrectCount}</td>
                      <td className="text-center text-gray-500 font-medium">⏳ {model.notAttemptedCount}</td>
                      <td className="text-center">{model.attempts}/{model.totalPuzzlesInDataset} ({model.coveragePercentage.toFixed(0)}%)</td>
                      <td className="text-center text-sm">{formatTime(model.avgProcessingTime)}</td>
                      <td className="text-center text-sm font-medium">{formatCost(model.totalCost)}</td>
                      <td className="text-center text-sm font-medium text-blue-600">{formatCost(model.costPerCorrectAnswer)}</td>
                      <td className="text-center text-sm">{model.avgConfidence.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Puzzle-by-Puzzle Comparison Matrix */}
        <div className="card bg-white shadow-sm border border-gray-200">
          <div className="card-body p-4">
            <NewModelComparisonResults result={comparisonData} />
          </div>
        </div>

      </div>
    </div>
  );
}
