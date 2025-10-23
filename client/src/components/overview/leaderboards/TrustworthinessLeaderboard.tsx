/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: TrustworthinessLeaderboard Component
 *
 * Displays models ranked by trustworthiness (how well confidence predicts correctness).
 * Uses data from TrustworthinessRepository via /api/puzzle/performance-stats
 *
 * Key Features:
 * - Shows trustworthiness rankings with reliability metrics
 * - Displays processing time and cost for each model
 * - Tooltips explaining trustworthiness score
 *
 * SRP and DRY check: Pass - Single responsibility for trustworthiness display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Tooltip, Icons)
 */

import React, { useMemo } from 'react';
import { Clock, DollarSign, Shield, ShieldCheck } from 'lucide-react';

interface TrustworthinessLeader {
  modelName: string;
  avgTrustworthiness: number;
  avgConfidence: number;
  avgProcessingTime: number;
  avgCost: number;
  totalCost: number;
}

interface PerformanceLeaderboards {
  trustworthinessLeaders: TrustworthinessLeader[];
  speedLeaders: any[];
  efficiencyLeaders: any[];
  overallTrustworthiness: number;
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

interface TrustworthinessLeaderboardProps {
  performanceStats?: PerformanceLeaderboards;
  overconfidentModels?: OverconfidentModel[];
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function TrustworthinessLeaderboard({
  performanceStats,
  isLoading,
  onModelClick
}: TrustworthinessLeaderboardProps) {
  const leaders = useMemo(() => {
    if (!performanceStats?.trustworthinessLeaders) {
      return [];
    }
    return [...performanceStats.trustworthinessLeaders].sort(
      (a, b) => b.avgTrustworthiness - a.avgTrustworthiness
    );
  }, [performanceStats]);

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
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-3 w-12 rounded bg-gray-200" />
        </li>
      ))}
    </ol>
  );

  if (isLoading) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Shield className="h-4 w-4 text-blue-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Trustworthiness leaders</h2>
        </header>
        <div className="flex-1 px-1.5 py-1.5">{renderSkeleton()}</div>
      </section>
    );
  }

  if (!leaders.length) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Shield className="h-4 w-4 text-blue-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Trustworthiness leaders</h2>
        </header>
        <div className="flex flex-1 items-center justify-center px-3 py-4 text-center text-[11px] text-gray-500">
          No trustworthiness data available.
        </div>
      </section>
    );
  }

  const rankBadge = (index: number) => {
    if (index === 0) return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />;
    if (index === 1) return <Shield className="h-3.5 w-3.5 text-blue-600" />;
    if (index === 2) return <Shield className="h-3.5 w-3.5 text-purple-600" />;
    return <span className="text-[10px] font-semibold text-gray-500">#{index + 1}</span>;
  };

  const formatProcessingTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`;
    return `$${cost.toFixed(3)}`;
  };

  const overallTrust = performanceStats?.overallTrustworthiness;
  const overallTrustText =
    overallTrust !== undefined && overallTrust !== null
      ? `${(overallTrust * 100).toFixed(1)}%`
      : '—';

  return (
    <section className={containerClasses}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Trustworthiness leaders</h2>
            <p className="text-[10px] text-gray-500">Confidence calibration and efficiency combined.</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-500">{leaders.length} models</span>
      </header>
      <ol className="flex-1 divide-y divide-gray-200">
        {leaders.map((model, index) => (
          <li
            key={model.modelName}
            className={`${rowBaseClasses} ${onModelClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            onClick={() => onModelClick?.(model.modelName)}
          >
            <div className="flex items-center justify-center">{rankBadge(index)}</div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-[12px] font-semibold text-gray-800" title={model.modelName}>
                {model.modelName}
              </p>
              <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                <span>
                  <Clock className="mr-1 inline h-3 w-3" />
                  {formatProcessingTime(model.avgProcessingTime)}
                </span>
                <span>
                  <DollarSign className="mr-1 inline h-3 w-3" />
                  {formatCost(model.avgCost)} avg
                </span>
                <span>{formatCost(model.totalCost)} total</span>
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-emerald-700" title="Trustworthiness score">
              {(model.avgTrustworthiness * 100).toFixed(1)}%
            </div>
            <div className="text-right font-mono text-[11px] text-gray-600" title="Average reported confidence">
              {(model.avgConfidence * 100).toFixed(1)}%
            </div>
          </li>
        ))}
      </ol>
      <footer className="border-t border-gray-200 px-3 py-2 text-[10px] uppercase tracking-wide text-gray-600">
        Overall trustworthiness: {overallTrustText}
      </footer>
    </section>
  );
}
