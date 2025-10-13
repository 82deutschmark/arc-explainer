/**
 * AnalysisResults.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Displays analysis results with memoized correctness filtering.
 * Extracted from PuzzleExaminer lines 891-993 to follow SRP.
 * Uses useFilteredResults hook for performance-optimized filtering.
 * 
 * SRP/DRY check: Pass - Single responsibility (results display), uses shared filtering logic
 * DaisyUI: Pass - Uses DaisyUI card, btn-group, alert components
 */

import React from 'react';
import { Brain, Filter, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AnalysisResultCard } from './AnalysisResultCard';
import { useFilteredResults, type CorrectnessFilter } from '@/hooks/useFilteredResults';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';
import type { ARCTask } from '@shared/types';

interface AnalysisResultsProps {
  allResults: ExplanationData[];
  correctnessFilter: CorrectnessFilter;
  onFilterChange: (filter: CorrectnessFilter) => void;
  models: ModelConfig[] | undefined;
  task: ARCTask;
  isAnalyzing: boolean;
  currentModel: ModelConfig | null;
}

/**
 * Displays analysis results with correctness filtering
 * 
 * Performance: Uses useFilteredResults hook which memoizes correctness determination
 * and caches counts, preventing redundant calculations on every render.
 */
export function AnalysisResults({
  allResults,
  correctnessFilter,
  onFilterChange,
  models,
  task,
  isAnalyzing,
  currentModel
}: AnalysisResultsProps) {
  // PERFORMANCE FIX: Use memoized filtering hook
  // Previously: determineCorrectness() called multiple times per render (lines 916-933)
  const { filtered: filteredResults, counts } = useFilteredResults(allResults, correctnessFilter);

  if (allResults.length === 0 && !isAnalyzing) {
    return null;
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body pb-2">
        <div className="flex items-center justify-between">
          <h2 className="card-title flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Analysis Results ({counts.all})
          </h2>

          {/* Correctness Filter - DaisyUI btn-group */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 opacity-50" />
            <div className="btn-group">
              <button
                className={`btn btn-xs ${correctnessFilter === 'all' ? 'btn-active' : 'btn-outline'}`}
                onClick={() => onFilterChange('all')}
              >
                All ({counts.all})
              </button>
              <button
                className={`btn btn-xs ${
                  correctnessFilter === 'correct' ? 'btn-active btn-success' : 'btn-outline'
                } text-green-700`}
                onClick={() => onFilterChange('correct')}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Correct ({counts.correct})
              </button>
              <button
                className={`btn btn-xs ${
                  correctnessFilter === 'incorrect' ? 'btn-active btn-error' : 'btn-outline'
                } text-red-700`}
                onClick={() => onFilterChange('incorrect')}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Incorrect ({counts.incorrect})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body pt-2">
        {/* Show loading state when analysis is in progress */}
        {isAnalyzing && (
          <div role="alert" className="alert alert-info mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <div>
              <p className="text-xs font-medium">Analysis in progress...</p>
              {currentModel && (
                <p className="text-[10px] opacity-80">
                  Running {currentModel.name}
                  {currentModel.responseTime && (
                    <span className="ml-2">(Expected: {currentModel.responseTime.estimate})</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Show existing results */}
        {filteredResults.length > 0 && (
          <div className="space-y-2">
            {filteredResults.map((result) => (
              <AnalysisResultCard
                key={`${result.id}-${result.modelName}`}
                modelKey={result.modelName}
                result={result}
                model={models?.find(m => m.key === result.modelName)}
                testCases={task.test}
              />
            ))}
          </div>
        )}

        {/* Show message when no results match filter */}
        {filteredResults.length === 0 && allResults.length > 0 && (
          <div className="text-center py-8 opacity-60">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No {correctnessFilter === 'correct' ? 'correct' : 'incorrect'} results found.</p>
            <p className="text-sm mt-1">
              {correctnessFilter === 'correct'
                ? 'Try running more analyses or switch to "All" to see all results.'
                : 'All results appear to be correct, or switch to "All" to see all results.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
