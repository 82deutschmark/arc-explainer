/**
 * ReliabilityLeaderboard Component
 *
 * Displays models ranked by technical reliability (successful API responses).
 * Uses data from MetricsRepository via /api/metrics/reliability
 * Follows same patterns as AccuracyLeaderboard and TrustworthinessLeaderboard.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Shield, ShieldCheck, XCircle } from 'lucide-react';

interface ReliabilityStat {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
}

interface ReliabilityLeaderboardProps {
  reliabilityStats?: ReliabilityStat[];
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function ReliabilityLeaderboard({
  reliabilityStats,
  isLoading,
  onModelClick
}: ReliabilityLeaderboardProps) {
  const sortedStats = useMemo(() => {
    if (!reliabilityStats) {
      return [];
    }
    return [...reliabilityStats].sort((a, b) => {
      if (b.reliability !== a.reliability) {
        return b.reliability - a.reliability;
      }
      return b.totalRequests - a.totalRequests;
    });
  }, [reliabilityStats]);

  const containerClasses = 'flex h-full flex-col rounded-md border border-gray-200 bg-white text-xs shadow-sm';
  const rowBaseClasses = 'grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 px-2.5 py-1.5';

  const renderSkeleton = () => (
    <ol className="divide-y divide-gray-200">
      {[...Array(6)].map((_, index) => (
        <li key={index} className={`${rowBaseClasses} animate-pulse`}>
          <div className="h-3.5 w-3.5 rounded bg-gray-200" />
          <div className="space-y-1">
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-2.5 w-36 rounded bg-gray-100" />
          </div>
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-3 w-12 rounded bg-gray-200" />
        </li>
      ))}
    </ol>
  );

  const reliabilityBadge = (value: number) => {
    if (value >= 95) return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />;
    if (value >= 85) return <Shield className="h-3.5 w-3.5 text-amber-600" />;
    return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
  };

  const reliabilityText = (value: number) => `${value.toFixed(2)}%`;

  if (isLoading) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Shield className="h-4 w-4 text-emerald-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Reliability leaderboard</h2>
        </header>
        <div className="flex-1 px-1.5 py-1.5">{renderSkeleton()}</div>
      </section>
    );
  }

  if (!sortedStats.length) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Shield className="h-4 w-4 text-emerald-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Reliability leaderboard</h2>
        </header>
        <div className="flex flex-1 items-center justify-center px-3 py-4 text-center text-[11px] text-gray-500">
          No reliability data available.
        </div>
      </section>
    );
  }

  return (
    <section className={containerClasses}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600" />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Reliability leaderboard</h2>
            <p className="text-[10px] text-gray-500">Successful responses divided by total API calls.</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-500">{sortedStats.length} models</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <ol className="divide-y divide-gray-200">
          {sortedStats.map((stat, index) => (
            <li
              key={stat.modelName}
              className={`${rowBaseClasses} ${onModelClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={() => onModelClick?.(stat.modelName)}
            >
              <div className="flex items-center justify-center">
                {reliabilityBadge(stat.reliability)}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-[12px] font-semibold text-gray-800" title={stat.modelName}>
                  {stat.modelName}
                </p>
                <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  <span>{stat.successfulRequests.toLocaleString()} / {stat.totalRequests.toLocaleString()} success</span>
                  {stat.failedRequests > 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="h-3 w-3" />
                      {stat.failedRequests.toLocaleString()} failed
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right font-mono text-[11px] text-emerald-700" title="Reliability percentage">
                {reliabilityText(stat.reliability)}
              </div>
              <div className="text-right font-mono text-[11px] text-gray-600" title="Request volume rank">
                #{index + 1}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
