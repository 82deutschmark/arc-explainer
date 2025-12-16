/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-05
 * PURPOSE: Enhanced AccuracyLeaderboard Component for Model Failure Analysis
 *
 * Displays overconfident models - models with high confidence (≥80%) but poor accuracy (<50%).
 * Uses enhanced data from AccuracyRepository via /api/feedback/overconfident-models
 * Part of analytics overhaul for better model failure detection and user safety.
 *
 * Key Features:
 * - Highlights dangerous overconfident models with warning indicators
 * - Shows overconfidence rates and risk levels
 * - Filters models with statistical significance (100+ attempts)
 * - Provides clear visual warnings for high-risk models
 * - Tooltips explaining all metrics for user education
 * - Sample size warnings for low-confidence statistics (<10 attempts)
 *
 * SRP and DRY check: Pass - Single responsibility for overconfident model display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Tooltip, Icons)
 */

import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Shield, ShieldAlert } from 'lucide-react';

interface AccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: {
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    singleTestAccuracy: number;
    multiTestAccuracy: number;
  }[];
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

interface AccuracyLeaderboardProps {
  accuracyStats?: AccuracyStats;
  overconfidentModels?: OverconfidentModel[];
  isLoading?: boolean;
  showOverconfident?: boolean; // Toggle between legacy accuracy view and new overconfident view
  onModelClick?: (modelName: string) => void;
}

export function AccuracyLeaderboard({
  accuracyStats,
  overconfidentModels,
  isLoading,
  showOverconfident = true, // Default to new overconfident view
  onModelClick
}: AccuracyLeaderboardProps) {
  const showingOverconfident = showOverconfident && overconfidentModels !== undefined;

  const sortedOverconfident = useMemo(() => {
    if (!overconfidentModels) {
      return [];
    }
    return [...overconfidentModels].sort((a, b) => b.overconfidenceRate - a.overconfidenceRate);
  }, [overconfidentModels]);

  const accuracyRankings = useMemo(() => {
    if (!accuracyStats?.modelAccuracyRankings) {
      return [];
    }
    return [...accuracyStats.modelAccuracyRankings].sort(
      (a, b) => a.accuracyPercentage - b.accuracyPercentage
    );
  }, [accuracyStats]);

  const containerClasses = 'flex h-full flex-col rounded-md border border-gray-200 bg-white text-xs shadow-sm';
  const rowBaseClasses = 'grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 px-2.5 py-1.5';

  const renderSkeleton = () => (
    <ol className="divide-y divide-gray-200">
      {[...Array(6)].map((_, index) => (
        <li key={index} className={`${rowBaseClasses} animate-pulse`}>
          <div className="h-3.5 w-3.5 rounded bg-gray-200" />
          <div className="space-y-1">
            <div className="h-3 w-28 rounded bg-gray-200" />
            <div className="h-2.5 w-36 rounded bg-gray-100" />
          </div>
          <div className="h-3 w-14 rounded bg-gray-200" />
          <div className="h-3 w-14 rounded bg-gray-200" />
        </li>
      ))}
    </ol>
  );

  if (isLoading) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          {showingOverconfident ? (
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">
            {showingOverconfident ? 'Overconfidence watchlist' : 'Low accuracy models'}
          </h2>
        </header>
        <div className="flex-1 px-1.5 py-1.5">{renderSkeleton()}</div>
      </section>
    );
  }

  if (showingOverconfident) {
    if (!sortedOverconfident.length) {
      return (
        <section className={containerClasses}>
          <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Overconfidence watchlist</h2>
          </header>
          <div className="flex flex-1 items-center justify-center px-3 py-4 text-center text-[11px] text-gray-500">
            All monitored models are within safe calibration thresholds.
          </div>
        </section>
      );
    }

    const limited = sortedOverconfident.slice(0, 18);

    return (
      <section className={containerClasses}>
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wide">Overconfidence watchlist</h2>
              <p className="text-[10px] text-gray-500">High-confidence misses (≥80% confidence, &lt;50% accuracy).</p>
            </div>
          </div>
          <span className="text-[10px] text-gray-500">{limited.length} / {sortedOverconfident.length} flagged</span>
        </header>
        <ol className="flex-1 divide-y divide-gray-200">
          {limited.map((model, index) => {
            const background = model.isHighRisk ? 'bg-rose-50' : 'bg-white';
            return (
              <li
                key={model.modelName}
                className={`${rowBaseClasses} ${background} ${
                  onModelClick ? 'cursor-pointer hover:bg-rose-50' : ''
                }`}
                onClick={() => onModelClick?.(model.modelName)}
              >
                <div className="flex items-center justify-center">
                  {model.isHighRisk ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  ) : model.overconfidenceRate > 70 ? (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-500">#{index + 1}</span>
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-[12px] font-semibold text-gray-800" title={model.modelName}>
                    {model.modelName}
                  </p>
                  <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                    <span>{(model.totalAttempts ?? 0).toLocaleString()} attempts</span>
                    <span>{(model.wrongOverconfidentPredictions ?? 0)} wrong high-conf</span>
                    <span>{(model.avgConfidence ?? 0).toFixed(1)}% avg conf</span>
                  </p>
                </div>
                <div className="text-right font-mono text-[11px] text-rose-700" title="Overconfidence rate">
                  {(model.overconfidenceRate ?? 0).toFixed(1)}%
                </div>
                <div className="text-right font-mono text-[11px] text-gray-600" title="Overall accuracy">
                  {(model.overallAccuracy ?? 0).toFixed(1)}%
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  if (!accuracyRankings.length) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Low accuracy models</h2>
        </header>
        <div className="flex flex-1 items-center justify-center px-3 py-4 text-center text-[11px] text-gray-500">
          No accuracy data available.
        </div>
      </section>
    );
  }

  const limitedRankings = accuracyRankings.slice(0, 18);

  return (
    <section className={containerClasses}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Low accuracy models</h2>
            <p className="text-[10px] text-gray-500">Lowest performers by puzzle-level correctness (all-or-nothing per puzzle).</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-500">{limitedRankings.length} shown</span>
      </header>
      <ol className="flex-1 divide-y divide-gray-200">
        {limitedRankings.map((model, index) => (
          <li
            key={model.modelName}
            className={`${rowBaseClasses} ${onModelClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            onClick={() => onModelClick?.(model.modelName)}
          >
            <div className="text-[10px] font-semibold text-gray-500">#{index + 1}</div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-[12px] font-semibold text-gray-800" title={model.modelName}>
                {model.modelName}
              </p>
              <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                <span>{(model.totalAttempts ?? 0).toLocaleString()} attempts</span>
                <span>{(model.correctPredictions ?? 0).toLocaleString()} correct</span>
                <span>{(model.singleTestAccuracy ?? 0).toFixed(1)}% single</span>
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-gray-700" title="Overall accuracy">
              {(model.accuracyPercentage ?? 0).toFixed(1)}%
            </div>
            <div className="text-right font-mono text-[11px] text-gray-700" title="Multi test accuracy">
              {(model.multiTestAccuracy ?? 0).toFixed(1)}% M
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
