/**
 * SolverPerformanceCard.tsx
 * Displays the solver performance overview statistics.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';
import type { AccuracyStats } from '@shared/types';

interface SolverPerformanceCardProps {
  accuracyStats?: AccuracyStats;
}

const SolverPerformanceCard: React.FC<SolverPerformanceCardProps> = ({ accuracyStats }) => {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-6 w-6 text-green-600" />
          Solver Performance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accuracyStats && accuracyStats.totalSolverAttempts > 0 ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {accuracyStats.totalSolverAttempts}
              </div>
              <div className="text-sm text-gray-600">Total Solver Attempts</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-semibold text-green-700">
                  {accuracyStats.totalCorrectPredictions || 0}
                </div>
                <div className="text-xs text-green-600">Correct Predictions</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-semibold text-blue-700">
                  {accuracyStats.totalSolverAttempts > 0 
                    ? Math.round(((accuracyStats.totalCorrectPredictions || 0) / accuracyStats.totalSolverAttempts) * 100) : 0}%
                </div>
                <div className="text-xs text-blue-600">Overall Success Rate</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No solver mode data available</p>
            <p className="text-xs">Run analyses in solver mode to see performance metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SolverPerformanceCard;
