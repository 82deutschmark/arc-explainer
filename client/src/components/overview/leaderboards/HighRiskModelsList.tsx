/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-10-26
 * PURPOSE: Displays list of high-risk/overconfident models as expandable drilldown in summary card.
 *          Shows which models are flagged with risk indicators, overconfidence rates, and accuracy metrics.
 * SRP/DRY check: Pass — single responsibility for rendering high-risk model drilldown list.
 *                Reuses Badge and icon components from leaderboard system.
 */

import React from 'react';
import { ShieldAlert, AlertCircle, Badge as BadgeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface HighRiskModelsListProps {
  models: OverconfidentModel[];
  isLoading?: boolean;
}

export function HighRiskModelsList({ models, isLoading }: HighRiskModelsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!models.length) {
    return (
      <div className="text-center py-2 text-[11px] text-slate-500">
        No flagged models. All systems nominal!
      </div>
    );
  }

  // Sort by risk level: high risk first, then by overconfidence rate
  const sorted = [...models].sort((a, b) => {
    if (a.isHighRisk && !b.isHighRisk) return -1;
    if (!a.isHighRisk && b.isHighRisk) return 1;
    return b.overconfidenceRate - a.overconfidenceRate;
  });

  return (
    <div className="space-y-2">
      {sorted.map((model) => (
        <div
          key={model.modelName}
          className="flex flex-wrap items-center gap-2 text-[10px]"
        >
          {/* Risk Icon */}
          <div className="flex-shrink-0">
            {model.isHighRisk ? (
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" title="High risk" />
            ) : model.overconfidenceRate > 70 ? (
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" title="Elevated risk" />
            ) : (
              <BadgeIcon className="h-3.5 w-3.5 text-slate-400" title="Monitored" />
            )}
          </div>

          {/* Model Name Badge */}
          <Badge
            variant="outline"
            className={`text-[10px] ${
              model.isHighRisk
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {model.modelName}
          </Badge>

          {/* Metrics: Overconfidence Rate */}
          <span
            className={`text-[10px] font-semibold ${
              model.overconfidenceRate > 70
                ? 'text-rose-700'
                : model.overconfidenceRate > 50
                  ? 'text-amber-700'
                  : 'text-slate-600'
            }`}
            title={`${model.overconfidenceRate.toFixed(1)}% overconfidence rate`}
          >
            {model.overconfidenceRate.toFixed(1)}% overconf
          </span>

          {/* Metrics: Accuracy */}
          <span
            className={`text-[10px] font-semibold ${
              model.overallAccuracy < 50
                ? 'text-rose-600'
                : model.overallAccuracy < 70
                  ? 'text-amber-600'
                  : 'text-emerald-600'
            }`}
            title={`${model.overallAccuracy.toFixed(1)}% accuracy`}
          >
            {model.overallAccuracy.toFixed(1)}% acc
          </span>

          {/* Attempts count (optional, more compact) */}
          <span className="text-[10px] text-slate-500" title="Attempts analyzed">
            ({model.totalAttempts.toLocaleString()})
          </span>
        </div>
      ))}

      {models.length > 0 && (
        <div className="mt-1 border-t border-slate-200/50 pt-1.5 text-[10px] text-slate-500">
          <p>
            {models.filter((m) => m.isHighRisk).length} high-risk ·{' '}
            {models.length - models.filter((m) => m.isHighRisk).length} monitored
          </p>
        </div>
      )}
    </div>
  );
}
