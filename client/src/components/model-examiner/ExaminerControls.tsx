/**
 * ExaminerControls.tsx
 *
 * @description Renders the control buttons for the batch analysis session.
 * @author Cascade
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RefreshCw } from 'lucide-react';

// Props Interface
interface ExaminerControlsProps {
  isPaused: boolean;
  isRunning: boolean;
  progress: any; // Replace with a more specific type if available
  handleStart: () => void;
  handlePause: () => void;
  handleResume: () => void;
  handleCancel: () => void;
}

const ExaminerControls: React.FC<ExaminerControlsProps> = ({
  isPaused,
  isRunning,
  progress,
  handleStart,
  handlePause,
  handleResume,
  handleCancel,
}) => {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-gray-100 rounded-lg border">
      {!isRunning ? (
        <Button
          onClick={handleStart}
          className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6 rounded-full shadow-lg transform hover:scale-105 transition-transform"
        >
          <Play className="mr-2 h-6 w-6" />
          Start Analysis
        </Button>
      ) : (
        <>
          {!isPaused ? (
            <Button
              onClick={handlePause}
              variant="secondary"
              className="text-lg px-8 py-6 rounded-full shadow-lg transform hover:scale-105 transition-transform"
            >
              <Pause className="mr-2 h-6 w-6" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={handleResume}
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 rounded-full shadow-lg transform hover:scale-105 transition-transform"
            >
              <RefreshCw className="mr-2 h-6 w-6" />
              Resume
            </Button>
          )}
          <Button
            onClick={handleCancel}
            variant="destructive"
            className="text-lg px-8 py-6 rounded-full shadow-lg transform hover:scale-105 transition-transform"
            disabled={progress && progress.progress.percentage >= 100}
          >
            <Square className="mr-2 h-6 w-6" />
            Cancel
          </Button>
        </>
      )}
    </div>
  );
};

export default ExaminerControls;