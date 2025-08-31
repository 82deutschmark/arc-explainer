/**
 * DatabaseOverviewCard.tsx
 * Displays the database overview statistics, including feedback totals.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import type { FeedbackStats } from '@shared/types';

interface DatabaseOverviewCardProps {
  feedbackStats?: FeedbackStats;
  onViewAllFeedback: () => void;
}

const DatabaseOverviewCard: React.FC<DatabaseOverviewCardProps> = ({ feedbackStats, onViewAllFeedback }) => {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          Database Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
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
              <Badge className="bg-green-100 text-green-800">
                {feedbackStats?.helpfulPercentage || 0}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Not Helpful:</span>
              <Badge className="bg-red-100 text-red-800">
                {feedbackStats?.notHelpfulPercentage || 0}%
              </Badge>
            </div>
          </div>
          
          <Button 
            onClick={onViewAllFeedback}
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            View All Feedback
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DatabaseOverviewCard;
