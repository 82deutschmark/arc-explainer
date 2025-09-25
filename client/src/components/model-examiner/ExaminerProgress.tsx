/**Deprecated!!!  NEEDS REMOVAL!!!
 * ExaminerProgress.tsx
 *
 * @description Displays the live progress of a batch analysis session.
 * @author Cascade
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import type { ModelConfig } from '@shared/types';

// Props Interface
interface ExaminerProgressProps {
  progress: any; // Replace with a more specific type if available
  currentModel: ModelConfig | null | undefined;
  selectedModel: string;
  dataset: string;
}

const ExaminerProgress: React.FC<ExaminerProgressProps> = ({
  progress,
  currentModel,
  selectedModel,
  dataset,
}) => {
  if (!progress) return null;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          Live Analysis Progress
        </CardTitle>
        <p className="text-sm text-blue-700">
          Running <strong>{currentModel?.name || selectedModel}</strong> on <strong>{dataset}</strong> dataset
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress.progress.completed} / {progress.progress.total} puzzles</span>
          </div>
          <Progress value={progress.progress.percentage} className="w-full h-3" />
          <div className="text-sm font-medium text-center text-blue-700">
            {progress.progress.percentage}% complete
          </div>
        </div>

        {/* Live Statistics */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
            <div className="text-lg font-bold text-green-700">
              {progress.progress.successful}
            </div>
            <div className="text-xs text-green-600">✅ Successful</div>
          </div>
          <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
            <div className="text-lg font-bold text-red-700">
              {progress.progress.failed}
            </div>
            <div className="text-xs text-red-600">❌ Failed</div>
          </div>
          <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
            <div className="text-lg font-bold text-blue-700">
              {progress.stats.overallAccuracy}%
            </div>
            <div className="text-xs text-blue-600">🎯 Accuracy</div>
          </div>
          <div className="text-center p-3 bg-amber-100 rounded-lg border border-amber-200">
            <div className="text-lg font-bold text-amber-700">
              {Math.round(progress.stats.averageProcessingTime / 1000)}s
            </div>
            <div className="text-xs text-amber-600">⏱️ Avg Time</div>
          </div>
        </div>

        {/* Status and ETA */}
        <div className="flex justify-between items-center">
          <Badge 
            variant={progress.status === 'completed' ? 'default' : progress.status === 'running' ? 'secondary' : 'destructive'}
            className="capitalize text-sm px-3 py-1"
          >
            {progress.status === 'running' ? '🔄 Processing...' : progress.status}
          </Badge>
          {progress.stats.eta > 0 && progress.progress.percentage < 100 && (
            <div className="text-sm text-gray-600">
              ETA: {Math.round(progress.stats.eta / 60)} min
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExaminerProgress;
