/**
 * RecentActivityCard.tsx
 * Displays a feed of recent activity, such as new explanations and feedback.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface Activity {
  id: string;
  type: 'explanation' | 'feedback';
  puzzleId: string;
  modelName?: string;
  createdAt: string;
}

interface RecentActivityCardProps {
  recentActivity?: Activity[];
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({ recentActivity = [] }) => {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {recentActivity.slice(0, 8).map((activity) => (
            <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              {activity.type === 'explanation' ? (
                <span className="text-lg">🧠</span>
              ) : (
                <span className="text-lg">👍</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-gray-800 truncate text-xs">
                  {activity.type === 'explanation' ? (
                    `${activity.modelName} analyzed ${activity.puzzleId}`
                  ) : (
                    `Feedback for ${activity.puzzleId}`
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(activity.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivityCard;
