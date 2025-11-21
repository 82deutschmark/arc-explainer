/**
 * PuzzleDBViewer.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-20
 * PURPOSE: Displays Arc 1 and Arc 2 evaluation puzzles that NO LLM has solved correctly (0% accuracy).
 * Shows exact puzzle IDs organized by dataset with ARC2-Eval as top priority for research focus.
 * Uses useWorstPerformingPuzzles hook with zeroAccuracyOnly filter to query unsolved puzzles.
 *
 * PRIORITY ORDER:
 * 1. ARC2 Evaluation (evaluation2) - 120 puzzles - PRIMARY FOCUS
 * 2. ARC1 Evaluation (evaluation) - 400 puzzles - SECONDARY FOCUS
 *
 * SRP/DRY check: Pass - Single responsibility (display unsolved eval puzzles), reuses existing hooks
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Select, Button, Input, Alert)
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

// Compact puzzle card component with lazy-loaded TinyGrid preview
interface CompactPuzzleCardProps {
  puzzle: PuzzleDBStats;
  interestLevel: ReturnType<typeof getPuzzleInterestLevel>;
}

function CompactPuzzleCard({ puzzle, interestLevel }: CompactPuzzleCardProps) {
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const InterestIcon = interestLevel.icon;

  const correctAttempts = getCorrectAttempts(puzzle.performanceData.totalExplanations, puzzle.performanceData.avgAccuracy);
  const totalCost = puzzle.performanceData.avgCost ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations : 0;

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

  const firstTrainingExample = taskData?.train?.[0]?.input;

  return (
    <div
      ref={cardRef}
      className={`card shadow-lg hover:shadow-xl transition-shadow ${
        interestLevel.priority === 1 ? 'border border-error bg-error/5' :
        interestLevel.priority === 2 ? 'border border-info bg-info/5' :
        'bg-base-100'
      }`}
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
          <div className={`badge badge-sm ${
            interestLevel.priority === 1 ? 'badge-error' :
            interestLevel.priority === 2 ? 'badge-info' :
            'badge-outline'
          } gap-1 shrink-0`}>
            <InterestIcon className="h-3 w-3" />
            {interestLevel.text}
          </div>
        </div>

        <p className="text-xs text-base-content/70 mb-2">{interestLevel.description}</p>

        <div className="flex gap-2">
          {/* TinyGrid Preview */}
          {firstTrainingExample && (
            <div className="shrink-0" style={{ width: '64px', height: '64px' }}>
              <TinyGrid
                grid={firstTrainingExample}
                style={{ width: '64px', height: '64px' }}
              />
            </div>
          )}

          {/* Compact Metrics */}
          <div className="flex-1 min-w-0">
            {puzzle.performanceData.totalExplanations > 0 ? (
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <div className="font-bold">{Math.round(puzzle.performanceData.avgConfidence)}%</div>
                  <div className="text-base-content/60">Conf</div>
                </div>
                <div>
                  <div className="font-bold">{Math.round(puzzle.performanceData.avgAccuracy * 100)}%</div>
                  <div className="text-base-content/60">Acc</div>
                </div>
                <div>
                  <div className="font-semibold">{correctAttempts}/{puzzle.performanceData.totalExplanations}</div>
                  <div className="text-base-content/60">Attempts</div>
                </div>
                {puzzle.performanceData.modelsAttemptedCount && (
                  <div>
                    <div className="font-semibold">{puzzle.performanceData.modelsAttemptedCount}</div>
                    <div className="text-base-content/60">Models</div>
                  </div>
                )}
                {totalCost > 0 && (
                  <div className="col-span-2">
                    <div className="font-semibold">{formatCurrency(totalCost)}</div>
                    <div className="text-base-content/60">Total Cost</div>
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
    false          // Don't need rich metrics
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
    false
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
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-blue-50 via-white to-purple-50 border-2 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <CardTitle className="text-3xl font-bold text-gray-900">
                🗂️ Unsolved ARC Evaluation Puzzles
              </CardTitle>
              <p className="text-base text-gray-600 mt-2">
                Focus: ARC2 Eval (120 total) → ARC1 Eval (400 total)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <Badge variant="default" className="text-base px-4 py-2 bg-purple-100 text-purple-800 border-purple-300">
              🎯 ARC2 Eval: {arc2Total} unsolved
            </Badge>
            <Badge variant="default" className="text-base px-4 py-2 bg-blue-100 text-blue-800 border-blue-300">
              ARC1 Eval: {arc1Total} unsolved
            </Badge>
            <Badge variant="default" className="text-base px-4 py-2 bg-gray-100 text-gray-800 border-gray-300">
              📊 Total: {grandTotal} unsolved evaluation puzzles
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Dataset Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Dataset</label>
              <Select value={datasetFilter} onValueChange={(value: any) => setDatasetFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Datasets</SelectItem>
                  <SelectItem value="ARC2-Eval">ARC2-Eval Only</SelectItem>
                  <SelectItem value="ARC1-Eval">ARC1-Eval Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Search by Puzzle ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="e.g., 9d9a15e8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-pink-50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">⭐</span>
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ARC2 Evaluation - PRIMARY FOCUS
              </span>
            </CardTitle>
            <p className="text-base text-gray-600 mt-2">
              THE HARDEST PUZZLES - Research Priority
            </p>
            <div className="mt-2">
              <Badge variant="default" className="text-base px-3 py-1 bg-purple-100 text-purple-800 border-purple-300">
                {arc2Total} / 120 unsolved
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {filteredArc2.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? 'No puzzles match your search.' : 'No unsolved puzzles found.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredArc2.map((puzzle) => (
                  <ClickablePuzzleBadge
                    key={puzzle.id as string}
                    puzzleId={puzzle.id as string}
                    variant="error"
                    className="text-sm font-mono"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ARC1 Evaluation Section (SECONDARY - shown below) */}
      {!isLoading && showArc1 && (
        <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-white to-sky-50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">✨</span>
              <span className="text-blue-700">
                ARC1 Evaluation - SECONDARY
              </span>
            </CardTitle>
            <div className="mt-2">
              <Badge variant="default" className="text-base px-3 py-1 bg-blue-100 text-blue-800 border-blue-300">
                {arc1Total} / 400 unsolved
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {filteredArc1.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? 'No puzzles match your search.' : 'No unsolved puzzles found.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredArc1.map((puzzle) => (
                  <ClickablePuzzleBadge
                    key={puzzle.id as string}
                    puzzleId={puzzle.id as string}
                    variant="error"
                    className="text-sm font-mono"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && grandTotal === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">All Puzzles Solved!</h3>
          <p className="text-gray-600">
            Congratulations! All evaluation puzzles have been solved by at least one model.
          </p>
        </div>
      )}
    </div>
  );
}
