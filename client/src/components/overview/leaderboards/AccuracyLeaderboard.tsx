/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-25
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
 *
 * SRP and DRY check: Pass - Single responsibility for overconfident model display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Icons)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, ShieldAlert, AlertCircle } from 'lucide-react';

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
  // Determine which view to show and handle loading states
  const showingOverconfident = showOverconfident && overconfidentModels !== undefined;
  const title = showingOverconfident ? "⚠️ Overconfident Models" : "Models Needing Improvement";
  const icon = showingOverconfident ? ShieldAlert : AlertTriangle;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(icon, { className: "h-5 w-5 text-red-600" })}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle empty states for both views
  if (showingOverconfident) {
    if (!overconfidentModels || overconfidentModels.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              ✅ No Overconfident Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              No dangerous overconfident models found with 100+ attempts.
              <br />
              <span className="text-sm">This is good - models are being appropriately cautious.</span>
            </div>
          </CardContent>
        </Card>
      );
    }
  } else {
    if (!accuracyStats || !accuracyStats.modelAccuracyRankings?.length) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Models Needing Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              No accuracy data available
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  // Helper functions for overconfident models view
  const getRiskIcon = (model: OverconfidentModel, index: number) => {
    if (model.isHighRisk) return <ShieldAlert className="h-4 w-4 text-red-600" />;
    if (model.overconfidenceRate > 70) return <AlertCircle className="h-4 w-4 text-orange-500" />;
    if (model.overconfidenceRate > 50) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <span className="w-4 h-4 flex items-center justify-center text-sm font-medium text-gray-500">#{index + 1}</span>;
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (index === 1) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    if (index === 2) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <span className="w-4 h-4 flex items-center justify-center text-sm font-medium text-gray-500">#{index + 1}</span>;
  };

  const getOverconfidenceColor = (rate: number, isHighRisk: boolean) => {
    if (isHighRisk) return 'bg-red-100 text-red-800 border-red-300';
    if (rate > 70) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (rate > 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (confidence >= 80) return 'bg-red-100 text-red-800 border-red-200';
    if (confidence >= 70) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (accuracy >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (accuracy >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  // Render overconfident models view
  if (showingOverconfident && overconfidentModels && overconfidentModels.length > 0) {
    const topModels = overconfidentModels.slice(0, 15);

    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            ⚠️ Overconfident Models
          </CardTitle>
          <div className="text-sm text-gray-600">
            Models with high confidence (≥80%) but poor accuracy (&lt;50%) - minimum 100 attempts
            {overconfidentModels.length === 0 && (
              <div className="text-green-600 font-medium mt-1">
                ✅ No dangerous overconfident models found!
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topModels.map((model, index) => (
              <div
                key={model.modelName}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${
                  model.isHighRisk ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                } ${
                  onModelClick ? 'hover:bg-opacity-70 cursor-pointer' : ''
                }`}
                onClick={() => onModelClick?.(model.modelName)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getRiskIcon(model, index)}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate flex items-center gap-2" title={model.modelName}>
                      {model.modelName}
                      {model.isHighRisk && (
                        <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                          HIGH RISK
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      {model.totalAttempts} total • {model.totalOverconfidentAttempts} overconfident • {model.wrongOverconfidentPredictions} wrong
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-col sm:flex-row">
                  <Badge
                    variant="secondary"
                    className={`text-xs font-medium ${getOverconfidenceColor(model.overconfidenceRate, model.isHighRisk)}`}
                  >
                    {model.overconfidenceRate.toFixed(1)}% wrong
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-medium ${getConfidenceColor(model.avgConfidence)}`}
                  >
                    {model.avgConfidence.toFixed(0)}% conf
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-medium ${getAccuracyColor(model.overallAccuracy)}`}
                  >
                    {model.overallAccuracy.toFixed(1)}% acc
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {overconfidentModels.length > 15 && (
            <div className="mt-4 pt-3 border-t text-center">
              <span className="text-sm text-gray-500">
                +{overconfidentModels.length - 15} more overconfident models
              </span>
            </div>
          )}

          <div className="mt-4 pt-3 border-t">
            <div className="text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Overconfident Models:</span>
                <Badge className="bg-orange-100 text-orange-800">
                  {overconfidentModels.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">High Risk Models:</span>
                <Badge className="bg-red-100 text-red-800">
                  {overconfidentModels.filter(m => m.isHighRisk).length}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render legacy accuracy view (fallback)
  if (!accuracyStats || !accuracyStats.modelAccuracyRankings) return null;

  const topModels = accuracyStats.modelAccuracyRankings.slice(0, 15);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Models Needing Improvement
        </CardTitle>
        <div className="text-sm text-gray-600">
          Models with lowest accuracy rates - {accuracyStats.totalSolverAttempts.toLocaleString()} solver attempts
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topModels.map((model, index) => (
            <div
              key={model.modelName}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                onModelClick ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
              }`}
              onClick={() => onModelClick?.(model.modelName)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getRankIcon(index)}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate" title={model.modelName}>
                    {model.modelName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {model.totalAttempts} attempts • {model.correctPredictions} correct
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={`text-xs font-medium ${getAccuracyColor(model.accuracyPercentage)}`}
                >
                  {model.accuracyPercentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {accuracyStats.modelAccuracyRankings.length > 15 && (
          <div className="mt-4 pt-3 border-t text-center">
            <span className="text-sm text-gray-500">
              +{accuracyStats.modelAccuracyRankings.length - 15} more models
            </span>
          </div>
        )}

        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Accuracy:</span>
            <Badge className={getAccuracyColor(accuracyStats.overallAccuracyPercentage)}>
              {accuracyStats.overallAccuracyPercentage.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}