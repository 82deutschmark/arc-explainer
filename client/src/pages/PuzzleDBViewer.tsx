/**
 * PuzzleDBViewer.tsx
 * 
 * @author Cascade using Claude Sonnet 4.5
 * @date 2025-10-12
 * @description Individual Puzzle Database Viewer showing explanation counts and binary accuracy.
 * Displays puzzle cards with DB record counts to identify difficult puzzles needing more analysis.
 * SRP/DRY check: Pass - Single responsibility for database viewing and puzzle analysis
 * DaisyUI: Pass - Converted to pure DaisyUI components
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { Database, Filter, Grid, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Copy, BarChart3, Loader2, Target, TrendingUp, TrendingDown, DollarSign, Clock, X } from 'lucide-react';
import { useLocation } from 'wouter';

// Import puzzle DB hooks
import { usePuzzleDBStats, PuzzleDBStats, PuzzlePerformanceData } from '@/hooks/usePuzzleDBStats';
import { usePuzzleListAnalysis } from '@/hooks/usePuzzleListAnalysis';


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
  
  // Amazing: Any confidence under 80%
  if (avgConfidence < 80) {
    return { 
      variant: 'default' as const, 
      text: 'HUMBLE AI', 
      icon: CheckCircle,
      description: 'Rare AI uncertainty',
      priority: 2
    };
  }
  
  // Research Hotspots: High activity
  if (totalExplanations >= 15) {
    return { 
      variant: 'secondary' as const, 
      text: 'HOTSPOT', 
      icon: Grid,
      description: 'High research activity',
      priority: 3
    };
  }
  
  // Unexplored
  if (totalExplanations === 0) {
    return { 
      variant: 'outline' as const, 
      text: 'UNEXPLORED', 
      icon: XCircle,
      description: 'No attempts yet',
      priority: 4
    };
  }
  
  // Regular puzzles
  return { 
    variant: 'outline' as const, 
    text: 'REGULAR', 
    icon: Grid,
    description: 'Standard puzzle',
    priority: 5
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

export default function PuzzleDBViewer() {
  // Set page title
  React.useEffect(() => {
    document.title = 'Puzzle Database Viewer - ARC Explainer';
  }, []);

  // Filter state - comprehensive filtering like other pages
  const [sortBy, setSortBy] = useState<'dangerous' | 'humble' | 'research' | 'unexplored' | 'accuracy' | 'confidence'>('dangerous');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [dangerousOnly, setDangerousOnly] = useState(false);
  const [humbleOnly, setHumbleOnly] = useState(false);
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
  const [accuracyRange, setAccuracyRange] = useState<[number, number]>([0, 100]);
  const [attemptRange, setAttemptRange] = useState<[number, number]>([0, 100]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  // Multi-puzzle analysis state
  const [puzzleListInput, setPuzzleListInput] = useState<string>('');
  const [selectedPuzzleIds, setSelectedPuzzleIds] = useState<string[]>([]);
  const { analyzePuzzleList, data: puzzleAnalysisData, isLoading: isAnalyzing, isError: analysisError, error: analysisErrorDetails } = usePuzzleListAnalysis();

  // Fetch puzzle data - get ALL puzzles from all 5 datasets, sort client-side
  const { data: puzzles, isLoading, error } = usePuzzleDBStats({
    limit: 3000, // Ensure we get ALL puzzles from all datasets without any artificial cutoffs
    sortBy: 'composite', // Use backend sorting, we'll sort client-side for more control
    zeroAccuracyOnly: false, // Handle filtering client-side
    includeRichMetrics: true
  });

  // Filter puzzles based on comprehensive state
  const filteredPuzzles = React.useMemo(() => {
    if (!puzzles) return [];
    let filtered = puzzles;
    
    // Apply search query first (matching Browser page)
    if (searchQuery.trim()) {
      filtered = filtered.filter(puzzle => puzzle.id.includes(searchQuery.trim()));
    }
    
    // Apply basic filters
    if (showZeroOnly) {
      filtered = filtered.filter(p => p.performanceData.totalExplanations === 0);
    }
    
    if (dangerousOnly) {
      filtered = filtered.filter(p => 
        p.performanceData.avgConfidence >= 80 && p.performanceData.avgAccuracy <= 0.3
      );
    }
    
    if (humbleOnly) {
      filtered = filtered.filter(p => p.performanceData.avgConfidence < 80);
    }
    
    // Apply range filters
    filtered = filtered.filter(p => {
      const confidence = p.performanceData.avgConfidence || 0;
      const accuracy = p.performanceData.avgAccuracy * 100;
      const attempts = p.performanceData.totalExplanations;
      
      return confidence >= confidenceRange[0] && confidence <= confidenceRange[1] &&
             accuracy >= accuracyRange[0] && accuracy <= accuracyRange[1] &&
             attempts >= attemptRange[0] && attempts <= attemptRange[1];
    });
    
    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(p => p.source && p.source === sourceFilter);
    }
    
    // Sort by selected criteria
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dangerous':
          // Sort by most dangerous (high confidence + wrong answers)
          const aDangerous = a.performanceData.avgConfidence >= 80 && a.performanceData.avgAccuracy <= 0.3;
          const bDangerous = b.performanceData.avgConfidence >= 80 && b.performanceData.avgAccuracy <= 0.3;
          if (aDangerous !== bDangerous) return bDangerous ? 1 : -1;
          return (b.performanceData.avgConfidence - b.performanceData.avgAccuracy) - 
                 (a.performanceData.avgConfidence - a.performanceData.avgAccuracy);
        
        case 'humble':
          // Sort by lowest confidence first (most humble)
          return a.performanceData.avgConfidence - b.performanceData.avgConfidence;
        
        case 'research':
          // Sort by research activity (attempts + model diversity)
          const aResearch = a.performanceData.totalExplanations + (a.performanceData.modelsAttempted?.length || 0);
          const bResearch = b.performanceData.totalExplanations + (b.performanceData.modelsAttempted?.length || 0);
          return bResearch - aResearch;
        
        case 'unexplored':
          // Sort unexplored first, then by other criteria
          if (a.performanceData.totalExplanations === 0 && b.performanceData.totalExplanations > 0) return -1;
          if (b.performanceData.totalExplanations === 0 && a.performanceData.totalExplanations > 0) return 1;
          return b.performanceData.totalExplanations - a.performanceData.totalExplanations;
        
        case 'accuracy':
          return a.performanceData.avgAccuracy - b.performanceData.avgAccuracy;
        
        case 'confidence':
          return a.performanceData.avgConfidence - b.performanceData.avgConfidence;
        
        default:
          // Default to interest level priority
          const aLevel = getPuzzleInterestLevel(a.performanceData);
          const bLevel = getPuzzleInterestLevel(b.performanceData);
          return aLevel.priority - bLevel.priority;
      }
    });
  }, [puzzles, showZeroOnly, dangerousOnly, humbleOnly, confidenceRange, accuracyRange, attemptRange, sourceFilter, sortBy, searchQuery]);

  // Handle puzzle search by ID (matching Browser page functionality)
  const handleSearch = React.useCallback(() => {
    if (filteredPuzzles.length === 1 && searchQuery.trim() === filteredPuzzles[0].id) {
      setLocation(`/puzzle/${filteredPuzzles[0].id}`);
    }
    // If the search query is a full puzzle ID that doesn't exist in the current list, try navigating anyway
    else if (searchQuery.trim().length > 0 && filteredPuzzles.length === 0) {
      const potentialPuzzleId = searchQuery.trim();
      // Basic validation for what a puzzle ID might look like
      if (potentialPuzzleId.length > 5 && !potentialPuzzleId.includes(' ')) {
        setLocation(`/puzzle/${potentialPuzzleId}`);
      }
    }
  }, [searchQuery, filteredPuzzles, setLocation]);

  // Handle multi-puzzle analysis
  const handleAnalyzePuzzleList = React.useCallback(() => {
    if (!puzzleListInput.trim()) {
      return;
    }

    // Parse puzzle IDs from input - handle multiple formats
    const puzzleIds = puzzleListInput
      .split(/[,\n\s]+/)
      .map(id => id.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(id => id.length > 0);

    if (puzzleIds.length === 0) {
      return;
    }

    setSelectedPuzzleIds(puzzleIds);
    analyzePuzzleList(puzzleIds);
  }, [puzzleListInput, analyzePuzzleList]);

  // Copy example puzzle list to clipboard
  const copyExamplePuzzleList = () => {
    const exampleList = "017c7c7b, 19bb5feb, 1a2e2828, 358ba94e, f25fbde4, f8ff0b80, bbc9ae5d";
    navigator.clipboard.writeText(exampleList);
  };

  // Clear multi-puzzle analysis
  const clearAnalysis = () => {
    setSelectedPuzzleIds([]);
    setPuzzleListInput('');
  };

  // Get selected puzzle data
  const selectedPuzzles = React.useMemo(() => {
    if (!puzzles || selectedPuzzleIds.length === 0) return [];
    return puzzles.filter(p => selectedPuzzleIds.includes(p.id));
  }, [puzzles, selectedPuzzleIds]);

  // Calculate aggregate stats for selected puzzles
  const aggregateStats = React.useMemo(() => {
    if (selectedPuzzles.length === 0) {
      return null;
    }

    const totalAttempts = selectedPuzzles.reduce((sum, p) => sum + p.performanceData.totalExplanations, 0);
    const totalCost = selectedPuzzles.reduce((sum, p) => sum + (p.performanceData.avgCost || 0) * p.performanceData.totalExplanations, 0);
    const avgConfidence = selectedPuzzles.reduce((sum, p) => sum + p.performanceData.avgConfidence * p.performanceData.totalExplanations, 0) / Math.max(totalAttempts, 1);
    const avgAccuracy = selectedPuzzles.reduce((sum, p) => sum + p.performanceData.avgAccuracy * p.performanceData.totalExplanations, 0) / Math.max(totalAttempts, 1);
    const avgProcessingTime = selectedPuzzles.reduce((sum, p) => sum + (p.performanceData.avgProcessingTime || 0) * p.performanceData.totalExplanations, 0) / Math.max(totalAttempts, 1);

    // Difficulty distribution
    const dangerous = selectedPuzzles.filter(p => p.performanceData.avgConfidence >= 80 && p.performanceData.avgAccuracy <= 0.3).length;
    const humble = selectedPuzzles.filter(p => p.performanceData.avgConfidence < 80).length;
    const hotspot = selectedPuzzles.filter(p => p.performanceData.totalExplanations >= 15).length;
    const unexplored = selectedPuzzles.filter(p => p.performanceData.totalExplanations === 0).length;

    // Dataset distribution
    const datasets = selectedPuzzles.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Comparative highlights
    const hardest = selectedPuzzles.reduce((min, p) => 
      p.performanceData.avgAccuracy < min.performanceData.avgAccuracy ? p : min
    , selectedPuzzles[0]);
    
    const easiest = selectedPuzzles.reduce((max, p) => 
      p.performanceData.avgAccuracy > max.performanceData.avgAccuracy ? p : max
    , selectedPuzzles[0]);
    
    const mostExpensive = selectedPuzzles.reduce((max, p) => {
      const pCost = (p.performanceData.avgCost || 0) * p.performanceData.totalExplanations;
      const maxCost = (max.performanceData.avgCost || 0) * max.performanceData.totalExplanations;
      return pCost > maxCost ? p : max;
    }, selectedPuzzles[0]);
    
    const mostDangerous = selectedPuzzles.reduce((max, p) => {
      const pGap = p.performanceData.avgConfidence - (p.performanceData.avgAccuracy * 100);
      const maxGap = max.performanceData.avgConfidence - (max.performanceData.avgAccuracy * 100);
      return pGap > maxGap ? p : max;
    }, selectedPuzzles[0]);
    
    const mostHumble = selectedPuzzles.reduce((min, p) => 
      p.performanceData.avgConfidence < min.performanceData.avgConfidence ? p : min
    , selectedPuzzles[0]);

    // Model diversity
    const allModels = new Set<string>();
    selectedPuzzles.forEach(p => {
      p.performanceData.modelsAttempted?.forEach(m => allModels.add(m));
    });

    return {
      totalPuzzles: selectedPuzzles.length,
      totalAttempts,
      totalCost,
      avgConfidence,
      avgAccuracy,
      avgProcessingTime,
      difficulty: { dangerous, humble, hotspot, unexplored },
      datasets,
      highlights: { hardest, easiest, mostExpensive, mostDangerous, mostHumble },
      modelDiversity: allModels.size
    };
  }, [selectedPuzzles]);

  return (
    <div className="container mx-auto p-3 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Puzzle Database Viewer
          </h1>
          <p className="text-base-content/70">
            Individual puzzles with DB record counts and binary accuracy - identify difficult puzzles
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="badge badge-outline gap-1">
            <Grid className="h-3 w-3" />
            {filteredPuzzles.length} / {puzzles?.length || 0} Puzzles
          </div>
          {puzzles && puzzles.length > 0 && (
            <div className="badge badge-secondary text-xs">
              All {puzzles.length} from 5 datasets loaded
            </div>
          )}
          {isLoading && (
            <div className="badge badge-outline badge-primary">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Multi-Puzzle Analysis Section */}
      <div className="card bg-info/10 border border-info/30 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-lg">
            <BarChart3 className="h-5 w-5" />
            Analyze Specific Puzzles
          </h2>
          <p className="text-sm text-base-content/70">
            Enter puzzle IDs to see difficulty cards and comprehensive statistics
          </p>
          <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="puzzleListInput" className="label label-text text-sm font-medium">Puzzle IDs</label>
              <button
                onClick={copyExamplePuzzleList}
                className="btn btn-outline btn-sm gap-1 h-7 px-2"
              >
                <Copy className="h-3 w-3" />
                Example
              </button>
            </div>
            <textarea
              id="puzzleListInput"
              value={puzzleListInput}
              onChange={(e) => setPuzzleListInput(e.target.value)}
              placeholder="017c7c7b, 19bb5feb, 1a2e2828
Or one per line:
017c7c7b
19bb5feb"
              className="textarea textarea-bordered w-full font-mono text-sm h-20"
            />
            <p className="text-xs text-base-content/60 mt-1">
              Comma, space, or newline separated puzzle IDs
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAnalyzePuzzleList}
              disabled={!puzzleListInput.trim() || isAnalyzing}
              className="btn btn-primary btn-sm flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Analyze Puzzles
                </>
              )}
            </button>
            {selectedPuzzleIds.length > 0 && (
              <button
                onClick={clearAnalysis}
                className="btn btn-outline btn-sm"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>

          {/* Analysis Error */}
          {analysisError && (
            <div role="alert" className="alert alert-error">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">
                Error: {analysisErrorDetails?.message || 'Failed to analyze puzzles'}
              </span>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Aggregate Statistics Dashboard (shown when puzzles are selected) */}
      {aggregateStats && (
        <>
          {/* Aggregate Overview */}
          <div className="card bg-success/10 border border-success/30 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <Target className="h-5 w-5 text-success" />
                Aggregate Statistics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Total Puzzles</p>
                  <p className="text-2xl font-bold text-gray-900">{aggregateStats.totalPuzzles}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Total Attempts</p>
                  <p className="text-2xl font-bold text-gray-900">{aggregateStats.totalAttempts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Avg Confidence</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(aggregateStats.avgConfidence)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Avg Accuracy</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(aggregateStats.avgAccuracy * 100)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(aggregateStats.totalCost)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Avg Time</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(aggregateStats.avgProcessingTime)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Model Diversity</p>
                  <p className="text-2xl font-bold text-gray-900">{aggregateStats.modelDiversity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Datasets</p>
                  <p className="text-2xl font-bold text-gray-900">{Object.keys(aggregateStats.datasets).length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Difficulty Distribution */}
          <div className="card bg-secondary/10 border border-secondary/30 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <Grid className="h-5 w-5 text-secondary" />
                Difficulty Distribution
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-700">Dangerous</p>
                  <p className="text-2xl font-bold text-red-600">{aggregateStats.difficulty.dangerous}</p>
                  <p className="text-xs text-gray-600">Overconfident failures</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-700">Humble AI</p>
                  <p className="text-2xl font-bold text-blue-600">{aggregateStats.difficulty.humble}</p>
                  <p className="text-xs text-gray-600">&lt;80% confidence</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-orange-700">Hotspot</p>
                  <p className="text-2xl font-bold text-orange-600">{aggregateStats.difficulty.hotspot}</p>
                  <p className="text-xs text-gray-600">High activity (15+ attempts)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Unexplored</p>
                  <p className="text-2xl font-bold text-gray-600">{aggregateStats.difficulty.unexplored}</p>
                  <p className="text-xs text-gray-600">No attempts</p>
                </div>
              </div>

              {/* Dataset Distribution */}
              <div className="mt-4 pt-4 border-t border-secondary/20">
                <p className="text-sm font-medium mb-2">Dataset Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(aggregateStats.datasets).map(([dataset, count]) => (
                    <div key={dataset} className="badge badge-outline text-sm">
                      {dataset}: {count}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Model×Puzzle Matrix */}
          {puzzleAnalysisData && (
            <div className="card bg-primary/10 border border-primary/30 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-lg">
                  <Database className="h-5 w-5 text-primary" />
                  Model Performance Matrix
                </h2>
                <p className="text-sm text-base-content/70">
                  ✅ = Correct, ❌ = Incorrect, ⏳ = Not Attempted
                </p>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="bg-green-100 p-2 rounded">
                    <div className="text-xl font-bold text-green-700">{puzzleAnalysisData.summary.perfectModels}</div>
                    <div className="text-xs text-green-600">Perfect Models</div>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded">
                    <div className="text-xl font-bold text-yellow-700">{puzzleAnalysisData.summary.partialModels}</div>
                    <div className="text-xs text-yellow-600">Partial Models</div>
                  </div>
                  <div className="bg-gray-100 p-2 rounded">
                    <div className="text-xl font-bold text-gray-700">{puzzleAnalysisData.summary.notAttemptedModels}</div>
                    <div className="text-xs text-gray-600">Not Attempted</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="text-left py-2 px-2 font-medium sticky left-0 bg-gray-100">Model</th>
                        {puzzleAnalysisData.puzzleResults.map((puzzle) => (
                          <th key={puzzle.puzzle_id} className="text-center py-2 px-2 font-medium min-w-16">
                            {puzzle.puzzle_id.slice(0, 8)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {puzzleAnalysisData.modelPuzzleMatrix.map((model) => (
                        <tr key={model.modelName} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium truncate max-w-32 sticky left-0 bg-white" title={model.modelName}>
                            {model.modelName}
                          </td>
                          {model.puzzleStatuses.map((puzzle) => (
                            <td key={puzzle.puzzleId} className="text-center py-2 px-2">
                              {puzzle.status === 'correct' && '✅'}
                              {puzzle.status === 'incorrect' && '❌'}
                              {puzzle.status === 'not_attempted' && '⏳'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Comparative Highlights */}
          <div className="card bg-warning/10 border border-warning/30 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <TrendingUp className="h-5 w-5 text-warning" />
                Comparative Highlights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Hardest Puzzle */}
                <div className="bg-white p-3 rounded border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-700">Hardest Puzzle</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.hardest.id}`}>
                    <div className="badge badge-outline font-mono cursor-pointer hover:bg-base-200">
                      {aggregateStats.highlights.hardest.id}
                    </div>
                  </Link>
                  <p className="text-xs text-base-content/60 mt-1">
                    Accuracy: {Math.round(aggregateStats.highlights.hardest.performanceData.avgAccuracy * 100)}%
                  </p>
                </div>

                {/* Easiest Puzzle */}
                <div className="bg-base-100 p-3 rounded border border-success">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <p className="text-sm font-semibold text-success">Easiest Puzzle</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.easiest.id}`}>
                    <div className="badge badge-outline font-mono cursor-pointer hover:bg-base-200">
                      {aggregateStats.highlights.easiest.id}
                    </div>
                  </Link>
                  <p className="text-xs text-base-content/60 mt-1">
                    Accuracy: {Math.round(aggregateStats.highlights.easiest.performanceData.avgAccuracy * 100)}%
                  </p>
                </div>

                {/* Most Expensive */}
                <div className="bg-base-100 p-3 rounded border border-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-secondary" />
                    <p className="text-sm font-semibold text-secondary">Most Expensive</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostExpensive.id}`}>
                    <div className="badge badge-outline font-mono cursor-pointer hover:bg-base-200">
                      {aggregateStats.highlights.mostExpensive.id}
                    </div>
                  </Link>
                  <p className="text-xs text-base-content/60 mt-1">
                    Cost: {formatCurrency((aggregateStats.highlights.mostExpensive.performanceData.avgCost || 0) * aggregateStats.highlights.mostExpensive.performanceData.totalExplanations)}
                  </p>
                </div>

                {/* Most Dangerous */}
                <div className="bg-base-100 p-3 rounded border border-error">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-error" />
                    <p className="text-sm font-semibold text-error">Most Dangerous</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostDangerous.id}`}>
                    <div className="badge badge-outline font-mono cursor-pointer hover:bg-base-200">
                      {aggregateStats.highlights.mostDangerous.id}
                    </div>
                  </Link>
                  <p className="text-xs text-base-content/60 mt-1">
                    Confidence-Accuracy Gap: {Math.round(aggregateStats.highlights.mostDangerous.performanceData.avgConfidence - (aggregateStats.highlights.mostDangerous.performanceData.avgAccuracy * 100))}%
                  </p>
                </div>

                {/* Most Humble */}
                <div className="bg-base-100 p-3 rounded border border-info">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-info" />
                    <p className="text-sm font-semibold text-info">Most Humble</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostHumble.id}`}>
                    <div className="badge badge-outline font-mono cursor-pointer hover:bg-base-200">
                      {aggregateStats.highlights.mostHumble.id}
                    </div>
                  </Link>
                  <p className="text-xs text-base-content/60 mt-1">
                    Confidence: {Math.round(aggregateStats.highlights.mostHumble.performanceData.avgConfidence)}%
                  </p>
                </div>

                {/* Fastest */}
                <div className="bg-base-100 p-3 rounded border border-success">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-700">Processing Time</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatDuration(aggregateStats.avgProcessingTime)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Average across selection</p>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Puzzle Cards */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <Grid className="h-5 w-5" />
                Selected Puzzle Difficulty Cards
                <div className="badge badge-outline">{selectedPuzzles.length} puzzles</div>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedPuzzles.map((puzzle) => {
                  const interestLevel = getPuzzleInterestLevel(puzzle.performanceData);
                  const correctAttempts = getCorrectAttempts(puzzle.performanceData.totalExplanations, puzzle.performanceData.avgAccuracy);
                  const InterestIcon = interestLevel.icon;
                  const totalCost = puzzle.performanceData.avgCost ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations : 0;
                  
                  return (
                    <div key={puzzle.id} className={`card shadow-lg hover:shadow-xl transition-shadow ${
                      interestLevel.priority === 1 ? 'border border-error bg-error/5' :
                      interestLevel.priority === 2 ? 'border border-info bg-info/5' :
                      'bg-base-100'
                    }`}>
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="card-title text-sm font-mono flex items-center gap-2">
                            {puzzle.id}
                            <div className="badge badge-outline text-xs">
                              {puzzle.source}
                            </div>
                          </h3>
                          <div className={`badge ${
                            interestLevel.priority === 1 ? 'badge-error' :
                            interestLevel.priority === 2 ? 'badge-info' :
                            'badge-outline'
                          } gap-1`}>
                            <InterestIcon className="h-3 w-3" />
                            {interestLevel.text}
                          </div>
                        </div>
                        <p className="text-xs text-base-content/70">{interestLevel.description}</p>
                        <div className="space-y-3">
                        {puzzle.performanceData.totalExplanations > 0 ? (
                          <>
                            <div className="grid grid-cols-2 gap-4 text-center">
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-lg font-bold">
                                  {Math.round(puzzle.performanceData.avgConfidence)}%
                                </div>
                                <div className="text-xs text-gray-600">Confidence</div>
                              </div>
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-lg font-bold">
                                  {Math.round(puzzle.performanceData.avgAccuracy * 100)}%
                                </div>
                                <div className="text-xs text-gray-600">Accuracy</div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Attempts:</span>
                                <span className="font-semibold">
                                  {correctAttempts}/{puzzle.performanceData.totalExplanations}
                                </span>
                              </div>
                              
                              {puzzle.performanceData.modelsAttempted && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Models:</span>
                                  <span className="font-semibold">
                                    {puzzle.performanceData.modelsAttempted.length}
                                  </span>
                                </div>
                              )}
                              
                              {totalCost > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Cost:</span>
                                  <span className="font-semibold">
                                    {formatCurrency(totalCost)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-500">No Attempts</div>
                            <div className="text-sm text-gray-600">Untested puzzle</div>
                          </div>
                        )}
                        
                        <Link href={`/puzzle/${puzzle.id}`}>
                          <button className="btn btn-outline btn-sm w-full">
                            {puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis'}
                          </button>
                        </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            <Filter className="h-5 w-5" />
            Filters & Sorting
          </h2>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
              <div className="w-full md:flex-1 space-y-2">
                <label htmlFor="puzzleSearch" className="label label-text">Search by Puzzle ID</label>
                <div className="relative">
                  <input
                    id="puzzleSearch"
                    placeholder="Enter puzzle ID (e.g., 1ae2feb7)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    className="input input-bordered w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                </div>
                {searchError && (
                  <p className="text-sm text-error">{searchError}</p>
                )}
              </div>
              <button 
                onClick={handleSearch}
                className="btn btn-primary min-w-[120px]"
              >
                Search
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="sort-by" className="label label-text text-sm font-medium">Sort by:</label>
              <select 
                id="sort-by"
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="select select-bordered w-40"
              >
                <option value="dangerous">Dangerous</option>
                <option value="humble">Humble</option>
                <option value="research">Research</option>
                <option value="unexplored">Unexplored</option>
                <option value="accuracy">Accuracy (Low to High)</option>
                <option value="confidence">Confidence</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <input 
                  type="checkbox"
                  id="zero-only" 
                  checked={showZeroOnly} 
                  onChange={(e) => setShowZeroOnly(e.target.checked)}
                  className="checkbox checkbox-primary"
                />
                <span className="label-text">Show only UNEXPLORED puzzles (0 explanations)</span>
              </label>
            </div>
            
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <input 
                  type="checkbox"
                  id="dangerous-only" 
                  checked={dangerousOnly} 
                  onChange={(e) => setDangerousOnly(e.target.checked)}
                  className="checkbox checkbox-error"
                />
                <span className="label-text">Show dangerous overconfident failures only</span>
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="source-filter" className="label label-text text-sm font-medium">Dataset:</label>
              <select 
                id="source-filter"
                value={sourceFilter} 
                onChange={(e) => setSourceFilter(e.target.value)}
                className="select select-bordered w-40"
              >
                <option value="all">All Datasets</option>
                <option value="training">Training (400)</option>
                <option value="training2">Training2 (1000)</option>
                <option value="evaluation">Evaluation (400)</option>
                <option value="evaluation2">Evaluation2 (120)</option>
                <option value="arc-heavy">ARC-Heavy (300)</option>
                <option value="ConceptARC">ConceptARC</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div role="alert" className="alert alert-error">
          <div className="text-center w-full">
            <p className="font-medium">Error loading puzzle data</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Database Overview</h2>
          <p className="text-sm text-base-content/70">
            Individual puzzle analysis attempts and binary accuracy statistics
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Total Puzzles</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredPuzzles.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700">Dangerous (Overconfident)</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredPuzzles.filter(p => p.performanceData.avgConfidence >= 80 && p.performanceData.avgAccuracy <= 0.3).length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-700">Humble AI (&lt;80% confidence)</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredPuzzles.filter(p => p.performanceData.avgConfidence < 80).length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Unexplored</p>
              <p className="text-2xl font-bold text-gray-600">
                {filteredPuzzles.filter(p => p.performanceData.totalExplanations === 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Puzzle Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading puzzle data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPuzzles.map((puzzle) => {
            const interestLevel = getPuzzleInterestLevel(puzzle.performanceData);
            const correctAttempts = getCorrectAttempts(puzzle.performanceData.totalExplanations, puzzle.performanceData.avgAccuracy);
            const InterestIcon = interestLevel.icon;
            const totalCost = puzzle.performanceData.avgCost ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations : 0;
            
            return (
              <div key={puzzle.id} className={`card shadow-lg hover:shadow-xl transition-shadow ${
                interestLevel.priority === 1 ? 'border border-error bg-error/5' :
                interestLevel.priority === 2 ? 'border border-info bg-info/5' :
                'bg-base-100'
              }`}>
                <div className="card-body p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="card-title text-sm font-mono flex items-center gap-2">
                      {puzzle.id}
                      <div className="badge badge-outline text-xs">
                        {puzzle.source}
                      </div>
                    </h3>
                    <div className={`badge ${
                      interestLevel.priority === 1 ? 'badge-error' :
                      interestLevel.priority === 2 ? 'badge-info' :
                      'badge-outline'
                    } gap-1`}>
                      <InterestIcon className="h-3 w-3" />
                      {interestLevel.text}
                    </div>
                  </div>
                  <p className="text-xs text-base-content/70">{interestLevel.description}</p>
                  <div className="space-y-3">
                  {/* Key Metrics Display */}
                  {puzzle.performanceData.totalExplanations > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold">
                            {Math.round(puzzle.performanceData.avgConfidence)}%
                          </div>
                          <div className="text-xs text-gray-600">Confidence</div>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold">
                            {Math.round(puzzle.performanceData.avgAccuracy * 100)}%
                          </div>
                          <div className="text-xs text-gray-600">Accuracy</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Attempts:</span>
                          <span className="font-semibold">
                            {correctAttempts}/{puzzle.performanceData.totalExplanations}
                          </span>
                        </div>
                        
                        {puzzle.performanceData.modelsAttempted && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Models:</span>
                            <span className="font-semibold">
                              {puzzle.performanceData.modelsAttempted.length}
                            </span>
                          </div>
                        )}
                        
                        {totalCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-semibold">
                              {formatCurrency(totalCost)}
                            </span>
                          </div>
                        )}
                        
                        {puzzle.performanceData.avgProcessingTime && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg Time:</span>
                            <span className="font-semibold">
                              {formatDuration(puzzle.performanceData.avgProcessingTime)}
                            </span>
                          </div>
                        )}
                        
                        {puzzle.performanceData.lowestNonZeroConfidence && puzzle.performanceData.lowestNonZeroConfidence < 50 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Lowest Confidence:</span>
                            <span className="font-semibold text-blue-600">
                              {puzzle.performanceData.lowestNonZeroConfidence}%
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-500">No Attempts</div>
                      <div className="text-sm text-gray-600">Untested puzzle</div>
                    </div>
                  )}
                  
                  {/* Action Button */}
                  <Link href={`/puzzle/${puzzle.id}`}>
                    <button className="btn btn-outline btn-sm w-full">
                      {puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis'}
                    </button>
                  </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {filteredPuzzles.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No puzzles found</h3>
          <p className="text-gray-500">Try adjusting your filters to see more results.</p>
        </div>
      )}
    </div>
  );
}
