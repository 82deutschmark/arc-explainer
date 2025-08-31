/**
 * StatisticsCards Component
 * Displays feedback and solver mode accuracy statistics in a modular card layout
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useModels } from '@/hooks/useModels';
import type { FeedbackStats, AccuracyStats } from '@shared/types';

import SolverPerformanceCard from './statistics/SolverPerformanceCard';
import DatabaseOverviewCard from './statistics/DatabaseOverviewCard';
import TopModelsCard from './statistics/TopModelsCard';
import RecentActivityCard from './statistics/RecentActivityCard';

interface StatisticsCardsProps {
  feedbackStats?: FeedbackStats;
  accuracyStats?: AccuracyStats;
  onViewAllFeedback: () => void;
  onModelClick: (modelName: string) => void;
  statsLoading: boolean;
  accuracyLoading: boolean;
  recentActivity?: Array<{
    id: string;
    type: 'explanation' | 'feedback';
    puzzleId: string;
    modelName?: string;
    createdAt: string;
  }>;
}

export function StatisticsCards({
  feedbackStats,
  accuracyStats,
  onViewAllFeedback,
  onModelClick,
  statsLoading,
  accuracyLoading,
  recentActivity = [],
}: StatisticsCardsProps) {
  const { data: models, isLoading: modelsLoading } = useModels();

  if (statsLoading || modelsLoading || accuracyLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="h-12 bg-gray-200 rounded-lg"></div>
                    <div className="h-12 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SolverPerformanceCard accuracyStats={accuracyStats} />
        <DatabaseOverviewCard feedbackStats={feedbackStats} onViewAllFeedback={onViewAllFeedback} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopModelsCard 
          accuracyStats={accuracyStats} 
          models={models}
          onModelClick={onModelClick}
        />
        <RecentActivityCard recentActivity={recentActivity} />
      </div>
    </div>
  );
}