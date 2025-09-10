/**
 * ReliabilityLeaderboard Component
 * 
 * Displays models ranked by technical reliability (successful API responses).
 * Uses data from MetricsRepository via /api/metrics/reliability
 * Follows same patterns as AccuracyLeaderboard and TrustworthinessLeaderboard.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

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
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Technical Reliability
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
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
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

  if (!reliabilityStats || !reliabilityStats.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Technical Reliability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No reliability data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by reliability descending, then by total requests descending
  const sortedStats = [...reliabilityStats].sort((a, b) => {
    if (b.reliability !== a.reliability) {
      return b.reliability - a.reliability;
    }
    return b.totalRequests - a.totalRequests;
  });

  const getReliabilityIcon = (reliability: number) => {
    if (reliability >= 95) return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (reliability >= 85) return <Shield className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getReliabilityColor = (reliability: number) => {
    if (reliability >= 95) return 'text-green-600 bg-green-50';
    if (reliability >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100) / 100}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Technical Reliability
          <Badge variant="outline" className="ml-2">
            {sortedStats.length} models
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Percentage of API requests that result in successful parsing and storage
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {sortedStats.map((stat, index) => (
              <div
                key={stat.modelName}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  onModelClick ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'
                }`}
                onClick={() => onModelClick?.(stat.modelName)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border">
                    <span className="text-sm font-medium text-gray-600">
                      {index + 1}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {stat.modelName}
                      </span>
                      {getReliabilityIcon(stat.reliability)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stat.successfulRequests.toLocaleString()} / {stat.totalRequests.toLocaleString()} successful
                      {stat.failedRequests > 0 && (
                        <span className="text-red-600 ml-1">
                          ({stat.failedRequests} failed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`font-medium ${getReliabilityColor(stat.reliability)}`}
                >
                  {formatPercentage(stat.reliability)}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}