/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-20 / Updated 2025-11-22
 * PURPOSE: Professional, information-dense ARC puzzle cards using shadcn/ui components.
 *          Compact layout (~200-250px) with side-by-side grid/metrics, automatic dark/light theme support.
 *          Replaces gradients/emojis with clean, tabular data presentation suitable for scientific research platform.
 * DESIGN: Uses CSS variables (bg-card, text-card-foreground, border) for automatic theme adaptation.
 *         shadcn/ui Card + Badge components for consistent styling across light/dark modes.
 * FIXES (2025-11-22):
 *   - REMOVED fabricated "% Solved" metric (was displaying avgAccuracy as solve percentage - WRONG!)
 *   - REMOVED avgAccuracy metric entirely (useless metric, not actionable)
 *   - ADDED rich metrics display (cost, tokens, processing time) using getCompactMetrics utility
 *   - REFACTORED to use utility functions: getGridSizeDisplay, getCompactMetrics, hasRichMetrics
 *   - Fixed layout collision: changed from flex to grid with explicit [80px_1fr] columns
 *   - Added overflow-hidden and max-width/max-height constraints to TinyGrid container
 *   - Fixed null check for maxGridSize (now shows 'N/A' instead of stray 'x')
 *   - Improved visual hierarchy: increased label font from text-[10px] to text-[11px]
 * SRP/DRY check: Pass — Single responsibility (puzzle card display), reuses utilities and shadcn/ui primitives.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { TinyGrid } from './TinyGrid';
import { getPuzzleName, hasPuzzleName } from '@shared/utils/puzzleNames';
import type { ARCTask } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getGridSizeDisplay } from '@/utils/puzzleMetadata';
import { getCompactMetrics } from '@/utils/puzzleCardHelpers';
import { hasRichMetrics } from '@/utils/performanceDataValidator';

interface PuzzleCardProps {
  puzzle: {
    id: string;
    source?: string;
    maxGridSize: number;
    gridSizeConsistent: boolean;
    hasExplanation?: boolean;
    modelName?: string;
    hasMultiplePredictions?: boolean;

    // Performance data (may be optional in some contexts)
    performanceData?: {
      avgAccuracy: number;            // 0.0 - 1.0, server-clamped
      totalExplanations: number;      // Total attempts (explanations)
      // Prefer counts from server-side aggregation when present
      modelsAttemptedCount?: number;  // Distinct models that attempted this puzzle
      // Backwards-compat: some callers may still pass an array
      modelsAttempted?: string[];     // Legacy list of model names
      avgCost?: number;               // Average cost per attempt (USD)
      avgProcessingTime?: number;     // Average processing time (milliseconds)
      avgTotalTokens?: number;        // Average total tokens per attempt
      wrongCount?: number;            // Number of incorrect attempts
      // Fields from worst-performing endpoint (when includeRichMetrics=true)
      avgConfidence?: number;         // Average AI confidence (0-100 scale)
      negativeFeedback?: number;      // Count of "not helpful" feedback
      totalFeedback?: number;         // Total feedback count
      latestAnalysis?: string;        // ISO timestamp of latest attempt
      compositeScore?: number;        // Weighted composite score
      avgReasoningTokens?: number;    // Average reasoning tokens (o-series)
      avgInputTokens?: number;        // Average input tokens
      avgOutputTokens?: number;       // Average output tokens
      multiTestCount?: number;        // Count of multi-test attempts
      singleTestCount?: number;       // Count of single-test attempts
      lowestNonZeroConfidence?: number | null; // Minimum non-zero confidence
      reasoningEffortsCount?: number; // Distinct reasoning effort levels
      worstExplanationId?: number;    // ID of worst-performing explanation
    };
  };
  showGridPreview?: boolean;
}

export const PuzzleCard: React.FC<PuzzleCardProps> = ({ 
  puzzle, 
  showGridPreview = true 
}) => {
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const puzzleName = getPuzzleName(puzzle.id);
  const hasName = hasPuzzleName(puzzle.id);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!showGridPreview || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [showGridPreview]);

  // Load puzzle data when visible
  useEffect(() => {
    if (!isVisible || taskData) return;

    fetch(`/api/puzzle/task/${puzzle.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTaskData(data.data);
        }
      })
      .catch(() => {
        // Silent fail - just don't show grid
      });
  }, [isVisible, puzzle.id, taskData]);

  const firstTrainingExample = taskData?.train?.[0];
  const isExplained = Boolean(puzzle.hasExplanation);

  // Calculate metrics
  const hasAttempts = puzzle.performanceData && puzzle.performanceData.totalExplanations > 0;
  const showRichMetrics = hasRichMetrics(puzzle.performanceData as any);
  const compactMetrics = getCompactMetrics(puzzle.performanceData as any, 2);

  return (
    <Link href={`/puzzle/${puzzle.id}`}>
      <Card
        ref={cardRef}
        className="group h-full transition-shadow hover:shadow-md cursor-pointer"
      >
        <CardContent className="p-3 h-full flex flex-col gap-2.5">
          {/* Header: ID/Name + Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {hasName && puzzleName ? (
                <>
                  <h3 className="text-sm font-semibold text-card-foreground capitalize truncate">
                    {puzzleName}
                  </h3>
                  <code className="text-xs font-mono text-muted-foreground block truncate">
                    {puzzle.id}
                  </code>
                </>
              ) : (
                <code className="text-sm font-mono font-semibold text-card-foreground block truncate">
                  {puzzle.id}
                </code>
              )}
            </div>
            <Badge variant={isExplained ? "secondary" : "outline"} className="text-[10px] shrink-0">
              {isExplained ? "Analyzed" : "New"}
            </Badge>
          </div>

          {/* Source Badge */}
          {puzzle.source && (
            <Badge variant="outline" className="text-[9px] w-fit">
              {puzzle.source.replace('-Eval', '').replace('-Heavy', '').replace('ARC', 'ARC-')}
            </Badge>
          )}

          {/* Main Content: Grid + Metrics Side-by-Side */}
          <div className="grid grid-cols-[80px_1fr] gap-3 flex-1">
            {/* Grid Preview - Left Side */}
            {showGridPreview && firstTrainingExample && (
              <div className="w-20 h-20 flex items-center justify-center bg-white rounded border overflow-hidden">
                <TinyGrid
                  grid={firstTrainingExample.input}
                  style={{
                    maxWidth: '80px',
                    maxHeight: '80px'
                  }}
                />
              </div>
            )}

            {/* Metrics Table - Right Side */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
              {/* Rich Metrics Row - Only show if available */}
              {showRichMetrics && compactMetrics.length > 0 && compactMetrics.map((metric) => (
                <div key={metric.label}>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    {metric.label}
                  </div>
                  <div className="text-sm font-semibold text-card-foreground">
                    {metric.value}
                  </div>
                </div>
              ))}

              {/* Attempts */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Attempts</div>
                <div className="text-sm font-semibold text-card-foreground">
                  {puzzle.performanceData?.totalExplanations || 0}
                </div>
              </div>

              {/* Wrong Attempts */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Wrong</div>
                <div className="text-sm font-semibold text-card-foreground">
                  {puzzle.performanceData?.wrongCount || 0}
                </div>
              </div>

              {/* Grid Size */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Grid</div>
                <div className="text-sm font-semibold text-card-foreground">
                  {getGridSizeDisplay(taskData, puzzle.maxGridSize)}
                </div>
              </div>

              {/* Test Cases */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tests</div>
                <div className="text-sm font-semibold text-card-foreground">
                  {puzzle.hasMultiplePredictions ? 'Multi' : 'Single'}
                </div>
              </div>
            </div>
          </div>

          {/* Footer: View Link */}
          <div className="pt-1.5 mt-auto border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-primary transition-colors">
              <span className="font-medium">View Details</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
