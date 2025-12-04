/**
 * PuzzleDBViewer.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-21 (Updated - Major UI overhaul)
 * PURPOSE: Displays Arc 1 and Arc 2 evaluation puzzles that NO LLM has solved correctly (0% accuracy).
 * Shows exact puzzle IDs organized by dataset with ARC2-Eval as top priority for research focus.
 * Uses useWorstPerformingPuzzles hook with zeroAccuracyOnly filter to query unsolved puzzles.
 *
 * MAJOR UI REDESIGN (v5.16.4):
 * - Drastically reduced bloated header from ~200px to ~50px with compact dark theme design
 * - Replaced massive filter Card with single compact inline row (~80% space reduction)
 * - Removed gradient backgrounds and oversized badges throughout
 * - Added PuzzleCard grid previews (first 12) below pill lists for visual puzzle inspection
 * - Pills now open in new tabs for better workflow
 * - Consistent with PuzzleBrowser dark theme and spacing patterns
 * - Total vertical space saved: ~400-450px
 *
 * PRIORITY ORDER:
 * 1. ARC2 Evaluation (evaluation2) - 120 puzzles - PRIMARY FOCUS
 * 2. ARC1 Evaluation (evaluation) - 400 puzzles - SECONDARY FOCUS
 *
 * SRP/DRY check: Pass - Single responsibility (display unsolved eval puzzles), reuses existing hooks and PuzzleCard component
 * shadcn/ui: Pass - Uses shadcn/ui components with compact styling
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'wouter';
import { Database, Grid, AlertTriangle, XCircle, Loader2, Search, AlertCircle } from 'lucide-react';
import type { PuzzleDBStats, PuzzlePerformanceData } from '@/hooks/usePuzzleDBStats';
import { useWorstPerformingPuzzles } from '@/hooks/usePuzzle';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';

// ARCTask type for puzzle data
interface ARCTask {
  train: Array<{ input: number[][], output: number[][] }>;
  test: Array<{ input: number[][], output?: number[][] }>;
}


// Helper functions for puzzle categorization based on AI confidence patterns
function getPuzzleInterestLevel(performanceData: PuzzlePerformanceData) {
  const { avgConfidence, avgAccuracy, totalExplanations } = performanceData;
  
  // Most Dangerous: High confidence + Wrong answers
  if (avgConfidence >= 80 && avgAccuracy <= 0.3) {
    return {
      variant: 'destructive' as const,
      text: 'DANGEROUS',
      icon: AlertTriangle,
      description: 'Overconfident failures',
      priority: 1
    };
  }

  // Research Hotspots: High activity
  if (totalExplanations >= 15) {
    return {
      variant: 'secondary' as const,
      text: 'HOTSPOT',
      icon: Grid,
      description: 'High research activity',
      priority: 2
    };
  }
  
  // Unexplored
  if (totalExplanations === 0) {
    return {
      variant: 'outline' as const,
      text: 'UNEXPLORED',
      icon: XCircle,
      description: 'No attempts yet',
      priority: 3
    };
  }

  // Regular puzzles
  return {
    variant: 'outline' as const,
    text: 'REGULAR',
    icon: Grid,
    description: 'Standard puzzle',
    priority: 4
  };
}

function getCorrectAttempts(totalExplanations: number, avgAccuracy: number) {
  return Math.round(totalExplanations * avgAccuracy);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }).format(amount);
}

function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

// Compact puzzle card component with lazy-loaded TinyGrid preview
interface CompactPuzzleCardProps {
  puzzle: PuzzleDBStats;
}

function CompactPuzzleCard({ puzzle }: CompactPuzzleCardProps) {
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Cost and resource metrics
  const totalSpend = puzzle.performanceData.avgCost && puzzle.performanceData.totalExplanations
    ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations
    : 0;
  const totalTokens = puzzle.performanceData.avgTotalTokens && puzzle.performanceData.totalExplanations
    ? puzzle.performanceData.avgTotalTokens * puzzle.performanceData.totalExplanations
    : 0;

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!cardRef.current) return;

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
  }, []);

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
        // Silently fail - preview just won't show
      });
  }, [isVisible, puzzle.id, taskData]);

  // Prefer the first TEST output grid so researchers see actual evaluation targets.
  const firstPuzzleGrid =
    taskData?.test?.[0]?.output ??
    taskData?.test?.[0]?.input ??
    taskData?.train?.[0]?.output ??
    taskData?.train?.[0]?.input;

  return (
    <div
      ref={cardRef}
      className="card shadow-lg hover:shadow-xl transition-shadow bg-base-100"
    >
      <div className="card-body p-2">
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-mono flex items-center gap-1 flex-wrap">
              <span className="truncate">{puzzle.id}</span>
              <div className="badge badge-outline badge-xs">
                {puzzle.source}
              </div>
            </h3>
          </div>
        </div>

        <div className="flex gap-2">
          {/* TinyGrid Preview */}
          {firstPuzzleGrid && (
            <div className="shrink-0" style={{ width: '64px', height: '64px' }}>
              <TinyGrid
                grid={firstPuzzleGrid}
                style={{ width: '64px', height: '64px' }}
              />
            </div>
          )}

          {/* Cost & Resource Metrics */}
          <div className="flex-1 min-w-0">
            {puzzle.performanceData.totalExplanations > 0 ? (
              <div className="grid grid-cols-2 gap-1 text-xs">
                {/* Total Spend */}
                {totalSpend > 0 && (
                  <div>
                    <div className="font-bold">{formatCurrency(totalSpend)}</div>
                    <div className="text-base-content/60">Total $</div>
                  </div>
                )}
                {/* Avg Cost per Attempt */}
                {puzzle.performanceData.avgCost && puzzle.performanceData.avgCost > 0 && (
                  <div>
                    <div className="font-semibold">{formatCurrency(puzzle.performanceData.avgCost)}</div>
                    <div className="text-base-content/60">$/Attempt</div>
                  </div>
                )}
                {/* Avg Tokens per Attempt */}
                {puzzle.performanceData.avgTotalTokens && puzzle.performanceData.avgTotalTokens > 0 && (
                  <div>
                    <div className="font-semibold">{formatNumber(Math.round(puzzle.performanceData.avgTotalTokens))}</div>
                    <div className="text-base-content/60">Tok/Attempt</div>
                  </div>
                )}
                {/* Total Tokens */}
                {totalTokens > 0 && (
                  <div>
                    <div className="font-semibold">{formatNumber(Math.round(totalTokens))}</div>
                    <div className="text-base-content/60">Total Tok</div>
                  </div>
                )}
                {/* Models Tested */}
                {puzzle.performanceData.modelsAttemptedCount && puzzle.performanceData.modelsAttemptedCount > 0 && (
                  <div>
                    <div className="font-semibold">{puzzle.performanceData.modelsAttemptedCount}</div>
                    <div className="text-base-content/60">Models</div>
                  </div>
                )}
                {/* Avg Latency */}
                {puzzle.performanceData.avgProcessingTime && puzzle.performanceData.avgProcessingTime > 0 && (
                  <div>
                    <div className="font-semibold">{formatTime(Math.round(puzzle.performanceData.avgProcessingTime / 1000))}</div>
                    <div className="text-base-content/60">Avg Time</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <div className="text-sm font-bold text-base-content/50">No Attempts</div>
                <div className="text-xs text-base-content/60">Untested puzzle</div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Link href={`/puzzle/${puzzle.id}`}>
          <button className="btn btn-outline btn-xs w-full mt-2">
            {puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis'}
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PuzzleDBViewer() {
  // Set page title
  React.useEffect(() => {
    document.title = 'Unsolved ARC Evaluation Puzzles - ARC Explainer';
  }, []);

  // State for filtering
  const [datasetFilter, setDatasetFilter] = useState<'all' | 'ARC2-Eval' | 'ARC1-Eval'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch ARC2-Eval unsolved puzzles (TOP PRIORITY - 120 puzzles)
  const {
    puzzles: arc2EvalUnsolved,
    isLoading: loading2,
    error: error2
  } = useWorstPerformingPuzzles(
    200,           // High limit to get all unsolved from 120 total
    'accuracy',    // Sort by accuracy
    0,             // minAccuracy = 0
    0,             // maxAccuracy = 0
    true,          // zeroAccuracyOnly = TRUE (critical!)
    'ARC2-Eval',   // evaluation2 dataset - TOP PRIORITY!
    undefined,     // No multi-test filter
    true           // Include rich metrics (cost, tokens, models tested)
  );

  // Fetch ARC1-Eval unsolved puzzles (SECOND PRIORITY - 400 puzzles)
  const {
    puzzles: arc1EvalUnsolved,
    isLoading: loading1,
    error: error1
  } = useWorstPerformingPuzzles(
    500,           // High limit to get all unsolved from 400 total
    'accuracy',
    0,
    0,
    true,          // zeroAccuracyOnly = TRUE
    'ARC1-Eval',   // evaluation dataset - SECOND PRIORITY
    undefined,
    true           // Include rich metrics (cost, tokens, models tested)
  );

  // Combined loading and error states
  const isLoading = loading1 || loading2;
  const error = error1 || error2;

  // Filter puzzles based on dataset filter and search query
  const filteredArc2 = useMemo(() => {
    if (!arc2EvalUnsolved) return [];
    let filtered = arc2EvalUnsolved;

    if (searchQuery.trim()) {
      filtered = filtered.filter(p =>
        (p.id as string).toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
    }

    return filtered;
  }, [arc2EvalUnsolved, searchQuery]);

  const filteredArc1 = useMemo(() => {
    if (!arc1EvalUnsolved) return [];
    let filtered = arc1EvalUnsolved;

    if (searchQuery.trim()) {
      filtered = filtered.filter(p =>
        (p.id as string).toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
    }

    return filtered;
  }, [arc1EvalUnsolved, searchQuery]);

  // Calculate totals
  const arc2Total = filteredArc2.length;
  const arc1Total = filteredArc1.length;
  const grandTotal = arc2Total + arc1Total;

  // Determine which sections to show based on dataset filter
  const showArc2 = datasetFilter === 'all' || datasetFilter === 'ARC2-Eval';
  const showArc1 = datasetFilter === 'all' || datasetFilter === 'ARC1-Eval';

  return (
    <div className="min-h-screen w-full bg-white text-slate-900">
      <div className="w-full px-4 py-4 space-y-3">
        {/* Header - Compact, White Theme */}
        <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-500" />
              <h1 className="text-base font-semibold text-slate-900">Unsolved ARC Evaluation Puzzles</h1>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                ARC2: {arc2Total}
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                ARC1: {arc1Total}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                Total: {grandTotal}
              </span>
            </div>
          </div>
        </div>

        {/* Compact Filters - White Theme */}
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap gap-2 items-center text-xs">
          <label className="text-slate-700 font-semibold uppercase tracking-wide">Filter:</label>
          <Select value={datasetFilter} onValueChange={(value: any) => setDatasetFilter(value)}>
            <SelectTrigger className="w-36 h-8 text-xs bg-white border-slate-300 text-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Datasets</SelectItem>
              <SelectItem value="ARC2-Eval">ARC2-Eval</SelectItem>
              <SelectItem value="ARC1-Eval">ARC1-Eval</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search puzzle ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading puzzle data: {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-600">Loading unsolved puzzles...</p>
          </div>
        </div>
      )}

        {/* ARC2 Evaluation Section (PRIMARY - shown first) */}
        {!isLoading && showArc2 && (
          <div className="w-full rounded-lg border border-purple-200 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-purple-700 flex items-center gap-1">
                ⭐ ARC2 Evaluation - PRIMARY FOCUS
              </h2>
              <span className="rounded-full border border-purple-300 bg-purple-100 px-3 py-1 text-sm font-bold text-purple-800 whitespace-nowrap">
                {arc2Total} / 120 unsolved
              </span>
            </div>
            {filteredArc2.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {searchQuery ? 'No puzzles match your search.' : 'No unsolved puzzles found.'}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {filteredArc2.map((puzzle) => (
                    <ClickablePuzzleBadge
                      key={puzzle.id as string}
                      puzzleId={puzzle.id as string}
                      variant="error"
                      className="text-sm font-mono"
                      openInNewTab={true}
                    />
                  ))}
                </div>

                {/* Puzzle Card Grid Display */}
                <div className="mt-3 pt-3 border-t border-purple-100">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Puzzle Previews (First 12)</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredArc2.slice(0, 12).map((puzzle) => (
                      <PuzzleCard
                        key={`card-${puzzle.id as string}`}
                        puzzle={puzzle as any}
                        showGridPreview={true}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ARC1 Evaluation Section (SECONDARY - shown below) */}
        {!isLoading && showArc1 && (
          <div className="w-full rounded-lg border border-blue-200 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700 flex items-center gap-1">
                ✨ ARC1 Evaluation - SECONDARY
              </h2>
              <span className="rounded-full border border-blue-300 bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800 whitespace-nowrap">
                {arc1Total} / 400 unsolved
              </span>
            </div>
            {filteredArc1.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {searchQuery ? 'No puzzles match your search.' : 'No unsolved puzzles found.'}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {filteredArc1.map((puzzle) => (
                    <ClickablePuzzleBadge
                      key={puzzle.id as string}
                      puzzleId={puzzle.id as string}
                      variant="error"
                      className="text-sm font-mono"
                      openInNewTab={true}
                    />
                  ))}
                </div>

                {/* Puzzle Card Grid Display */}
                <div className="mt-3 pt-3 border-t border-blue-100">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Puzzle Previews (First 12)</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredArc1.slice(0, 12).map((puzzle) => (
                      <PuzzleCard
                        key={`card-${puzzle.id as string}`}
                        puzzle={puzzle as any}
                        showGridPreview={true}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && grandTotal === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">All Puzzles Solved!</h3>
            <p className="text-slate-600">
              Congratulations! All evaluation puzzles have been solved by at least one model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
