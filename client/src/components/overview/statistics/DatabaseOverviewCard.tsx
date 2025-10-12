/**
 * DatabaseOverviewCard.tsx
 * Displays the database overview statistics, including feedback totals.
 */

import React from 'react';
import { Database } from 'lucide-react';
import type { FeedbackStats } from '@shared/types';

interface DatabaseOverviewCardProps {
  feedbackStats?: FeedbackStats;
  onViewAllFeedback: () => void;
}

const DatabaseOverviewCard: React.FC<DatabaseOverviewCardProps> = ({ feedbackStats, onViewAllFeedback }) => {
  return (
    <div className="card bg-base-100 shadow lg:col-span-1">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          Database Overview
        </h2>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {feedbackStats?.totalFeedback || 0}
            </div>
            <div className="text-sm text-gray-600">Total Feedback Entries</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Helpful:</span>
              <div className="badge bg-green-100 text-green-800">
                {feedbackStats?.helpfulPercentage || 0}%
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Not Helpful:</span>
              <div className="badge bg-red-100 text-red-800">
                {feedbackStats?.notHelpfulPercentage || 0}%
              </div>
            </div>
          </div>
          
          <button 
            onClick={onViewAllFeedback}
            className="btn btn-outline btn-sm w-full"
          >
            View All Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseOverviewCard;
