/**
 * ModelProgressIndicator Component
 * Enhanced visual feedback for AI model processing with progress bars and timers
 * Author: Kimi K2
 */

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Clock, Zap, Timer } from 'lucide-react';
import { ModelConfig } from '@/types/puzzle';

interface ModelProgressIndicatorProps {
  model: ModelConfig;
  isAnalyzing: boolean;
  actualTime?: number; // Actual processing time in seconds
}

export function ModelProgressIndicator({ 
  model, 
  isAnalyzing, 
  actualTime 
}: ModelProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Parse estimated time from model responseTime
  const getEstimatedDuration = () => {
    if (!model.responseTime?.estimate) return 30; // Default 30 seconds
    
    const estimate = model.responseTime.estimate;
    
    if (estimate.includes('min')) {
      // Handle time ranges like "5-10 min" or "<5 min"
      if (estimate.includes('-')) {
        // For ranges like "5-10 min", take the average
        const parts = estimate.split('-');
        const minMinutes = parseInt(parts[0].replace(/[^\d]/g, '') || '1');
        const maxMinutes = parseInt(parts[1].replace(/[^\d]/g, '') || '5');
        // Use average of min and max as a better estimate
        return Math.round((minMinutes + maxMinutes) / 2) * 60;
      } else {
        // Handle "<5 min" or just "5 min"
        const minutes = parseInt(estimate.replace(/[^\d]/g, '') || '3');
        return minutes * 60;
      }
    } else if (estimate.includes('sec')) {
      // Handle "<30 sec" or "30 sec" format
      const seconds = parseInt(estimate.replace(/[^\d]/g, '') || '30');
      return seconds;
    }
    
    // If we can't parse it, use a reasonable default based on model speed
    return model.responseTime?.speed === 'fast' ? 20 : 
           model.responseTime?.speed === 'moderate' ? 60 : 180; // 20s, 1m, or 3m
  };

  const estimatedDuration = getEstimatedDuration();

  useEffect(() => {
    if (isAnalyzing && !isComplete) {
      // Start timing
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      setProgress(0);

      // Start progress simulation based on estimated time
      const progressInterval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          const progressPercent = Math.min((newTime / estimatedDuration) * 100, 95); // Cap at 95% until completion
          setProgress(progressPercent);
          return newTime;
        });
      }, 1000);

      intervalRef.current = progressInterval;
    } else if (!isAnalyzing && startTimeRef.current) {
      // Analysis complete
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setProgress(100);
      setIsComplete(true);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAnalyzing, estimatedDuration, isComplete]);

  // Reset when actual time is provided
  useEffect(() => {
    if (actualTime && isAnalyzing) {
      setElapsedTime(actualTime);
      setProgress(100);
      setIsComplete(true);
    }
  }, [actualTime, isAnalyzing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getSpeedColor = () => {
    switch (model.responseTime?.speed) {
      case 'fast': return 'text-green-600';
      case 'moderate': return 'text-amber-600';
      case 'slow': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getProgressColor = () => {
    switch (model.responseTime?.speed) {
      case 'fast': return 'bg-green-500';
      case 'moderate': return 'bg-amber-500';
      case 'slow': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  if (!isAnalyzing && !actualTime) {
    return null; // Don't show when not analyzing and no actual time
  }

  return (
    <div className="space-y-2">
      {isAnalyzing && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Processing...
            </span>
            <span className={`${getSpeedColor()}`}>
              {formatTime(elapsedTime)} / ~{formatTime(estimatedDuration)}
            </span>
          </div>
          <Progress 
            value={progress} 
            className={`h-2 ${getProgressColor()}`}
          />
        </div>
      )}

      {actualTime && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Timer className="h-3 w-3" />
          <span>Actual time: {formatTime(actualTime)}</span>
          {model.responseTime?.estimate && (
            <span className={`${Math.abs(actualTime - estimatedDuration) > 30 ? 'text-amber-600' : 'text-green-600'}`}>
              ({actualTime > estimatedDuration ? 'slower' : 'faster'} than estimated)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
