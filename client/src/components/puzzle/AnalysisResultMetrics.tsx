/**
 * AnalysisResultMetrics.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12T21:34:00Z
 * PURPOSE: Displays Saturn Visual Solver-specific metrics including generated images,
 * execution logs, and event traces. Conditionally rendered only for Saturn results.
 * SRP/DRY check: Pass - Single responsibility (Saturn metrics display)
 * shadcn/ui: Pass - Uses shadcn Badge component
 */

import React from 'react';
import { ExplanationData } from '@/types/puzzle';
import { Badge } from '@/components/ui/badge';

interface AnalysisResultMetricsProps {
  result: ExplanationData;
  isSaturnResult: boolean;
}

export const AnalysisResultMetrics: React.FC<AnalysisResultMetricsProps> = ({ result, isSaturnResult }) => {
  if (!isSaturnResult) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Saturn Images */}
      {result.saturnImages && result.saturnImages.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded p-3">
          <h5 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
            🖼️ Generated Images 
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
              {result.saturnImages.length} image{result.saturnImages.length !== 1 ? 's' : ''}
            </Badge>
          </h5>
          <div className="text-xs text-purple-600 space-y-1">
            {result.saturnImages.slice(0, 3).map((imagePath, i) => (
              <div key={i} className="font-mono bg-white p-1 rounded border">
                {imagePath.split('/').pop() || imagePath}
              </div>
            ))}
            {result.saturnImages.length > 3 && (
              <div className="text-purple-500 font-medium">
                +{result.saturnImages.length - 3} more images...
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Saturn Detailed Log */}
      {result.saturnLog && (
        <div className="bg-gray-50 border border-gray-200 rounded">
          <div className="p-3 border-b border-gray-200">
            <h5 className="font-semibold text-gray-800 flex items-center gap-2">
              📋 Saturn Execution Log
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
                {(result.saturnLog.length / 1024).toFixed(1)}KB
              </Badge>
            </h5>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
              {result.saturnLog.slice(0, 2000)}{result.saturnLog.length > 2000 ? '\n\n... (truncated)' : ''}
            </pre>
          </div>
        </div>
      )}
      
      {/* Saturn Events */}
      {result.saturnEvents && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            ⚡ Event Trace
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
              NDJSON
            </Badge>
          </h5>
          <div className="text-xs text-blue-600">
            <div className="bg-white p-2 rounded border font-mono max-h-32 overflow-y-auto">
              {(() => {
                const events = result.saturnEvents as string | string[] | any;
                if (typeof events === 'string') {
                  return `${events.slice(0, 500)}${events.length > 500 ? '...' : ''}`;
                } else if (Array.isArray(events)) {
                  return `${events.slice(0, 10).join('\n')}${events.length > 10 ? '\n...' : ''}`;
                } else if (events) {
                  return JSON.stringify(events).slice(0, 500);
                } else {
                  return 'No events';
                }
              })()}
            </div>
            <p className="mt-1 text-blue-500">
              {(() => {
                const events = result.saturnEvents;
                if (Array.isArray(events)) {
                  return `Contains ${events.length} events (${(JSON.stringify(events).length / 1024).toFixed(1)}KB)`;
                } else if (typeof events === 'string') {
                  return `Contains ${events.split('\n').length} events (${(events.length / 1024).toFixed(1)}KB)`;
                } else {
                  return 'Contains 0 events (0KB)';
                }
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
