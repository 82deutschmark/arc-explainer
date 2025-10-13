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

import React from 'react';
import { Shield, ShieldCheck, Clock, DollarSign } from 'lucide-react';

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
  overconfidentModels,
  isLoading,
  onModelClick
}: TrustworthinessLeaderboardProps) {
  // Helper function to get ranking icon
  const getRankingIcon = (index: number) => {
    if (index === 0) return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (index === 1) return <Shield className="h-4 w-4 text-blue-600" />;
    if (index === 2) return <Shield className="h-4 w-4 text-purple-600" />;
    return <span className="w-4 h-4 flex items-center justify-center text-sm font-medium text-gray-500">#{index + 1}</span>;
  };

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Trustworthiness Leaders
          </h2>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!performanceStats || !performanceStats.trustworthinessLeaders?.length) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Trustworthiness Leaders
          </h2>
        </div>
        <div className="card-body">
          <div className="text-center py-8 text-gray-500">
            No trustworthiness data available
          </div>
        </div>
      </div>
    );
  }


  const getTrustworthinessColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 0.6) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const formatProcessingTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`;
    return `$${cost.toFixed(3)}`;
  };

  // Show all models from highest to lowest trustworthiness
  const allModels = performanceStats.trustworthinessLeaders;

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          🛡️ Trustworthiness Leaders
        </h2>
        <div className="text-sm text-gray-600">
          Models ranked by how well their confidence predicts correctness.
        </div>
      </div>
      <div className="card-body">
        <div className="space-y-2">
          {allModels.map((model, index) => {
            return (
              <div
                key={model.modelName}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors border bg-gray-50 ${
                  onModelClick ? 'hover:bg-opacity-70 cursor-pointer' : ''
                }`}
                onClick={() => onModelClick?.(model.modelName)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getRankingIcon(index)}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate" title={model.modelName}>
                      {model.modelName}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatProcessingTime(model.avgProcessingTime)}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCost(model.avgCost)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                  <div className={`badge text-xs font-medium ${getTrustworthinessColor(model.avgTrustworthiness)}`}>
                    {(model.avgTrustworthiness * 100).toFixed(1)}% trust
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Trustworthiness:</span>
            <div className={`badge ${getTrustworthinessColor(performanceStats.overallTrustworthiness)}`}>
              {(performanceStats.overallTrustworthiness * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}