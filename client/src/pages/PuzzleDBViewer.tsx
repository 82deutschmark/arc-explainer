/**
 * PuzzleDBViewer.tsx
 * 
 * @author Cascade, Claude (redesigned)
 * @description Individual Puzzle Database Viewer showing explanation counts and binary accuracy.
 * Displays puzzle cards with DB record counts to identify difficult puzzles needing more analysis.
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Filter, Grid, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Copy, BarChart3, Loader2, Target, TrendingUp, TrendingDown, DollarSign, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
            <Database className="h-6 w-6 text-blue-600" />
            Puzzle Database Viewer
          </h1>
          <p className="text-gray-600">
            Individual puzzles with DB record counts and binary accuracy - identify difficult puzzles
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Grid className="h-3 w-3" />
            {filteredPuzzles.length} / {puzzles?.length || 0} Puzzles
          </Badge>
          {puzzles && puzzles.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              All {puzzles.length} from 5 datasets loaded
            </Badge>
          )}
          {isLoading && (
            <Badge variant="outline" className="text-blue-600">
              Loading...
            </Badge>
          )}
        </div>
      </div>

      {/* Multi-Puzzle Analysis Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Analyze Specific Puzzles
          </CardTitle>
          <p className="text-sm text-gray-600">
            Enter puzzle IDs to see difficulty cards and comprehensive statistics
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="puzzleListInput" className="text-sm font-medium">Puzzle IDs</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={copyExamplePuzzleList}
                className="flex items-center gap-1 h-7 px-2"
              >
                <Copy className="h-3 w-3" />
                Example
              </Button>
            </div>
            <Textarea
              id="puzzleListInput"
              value={puzzleListInput}
              onChange={(e) => setPuzzleListInput(e.target.value)}
              placeholder="017c7c7b, 19bb5feb, 1a2e2828&#10;Or one per line:&#10;017c7c7b&#10;19bb5feb"
              className="font-mono text-sm h-20"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma, space, or newline separated puzzle IDs
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAnalyzePuzzleList}
              disabled={!puzzleListInput.trim() || isAnalyzing}
              className="flex-1"
              size="sm"
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
            </Button>
            {selectedPuzzleIds.length > 0 && (
              <Button
                onClick={clearAnalysis}
                variant="outline"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Analysis Error */}
          {analysisError && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-700">
                Error: {analysisErrorDetails?.message || 'Failed to analyze puzzles'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Aggregate Statistics Dashboard (shown when puzzles are selected) */}
      {aggregateStats && (
        <>
          {/* Aggregate Overview */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Aggregate Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Difficulty Distribution */}
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Grid className="h-5 w-5 text-purple-600" />
                Difficulty Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
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
              <div className="mt-4 pt-4 border-t border-purple-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Dataset Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(aggregateStats.datasets).map(([dataset, count]) => (
                    <Badge key={dataset} variant="outline" className="text-sm">
                      {dataset}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model×Puzzle Matrix */}
          {puzzleAnalysisData && (
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-600" />
                  Model Performance Matrix
                </CardTitle>
                <p className="text-sm text-gray-600">
                  ✅ = Correct, ❌ = Incorrect, ⏳ = Not Attempted
                </p>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Comparative Highlights */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                Comparative Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Hardest Puzzle */}
                <div className="bg-white p-3 rounded border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-700">Hardest Puzzle</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.hardest.id}`}>
                    <Badge variant="outline" className="font-mono cursor-pointer hover:bg-gray-100">
                      {aggregateStats.highlights.hardest.id}
                    </Badge>
                  </Link>
                  <p className="text-xs text-gray-600 mt-1">
                    Accuracy: {Math.round(aggregateStats.highlights.hardest.performanceData.avgAccuracy * 100)}%
                  </p>
                </div>

                {/* Easiest Puzzle */}
                <div className="bg-white p-3 rounded border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-700">Easiest Puzzle</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.easiest.id}`}>
                    <Badge variant="outline" className="font-mono cursor-pointer hover:bg-gray-100">
                      {aggregateStats.highlights.easiest.id}
                    </Badge>
                  </Link>
                  <p className="text-xs text-gray-600 mt-1">
                    Accuracy: {Math.round(aggregateStats.highlights.easiest.performanceData.avgAccuracy * 100)}%
                  </p>
                </div>

                {/* Most Expensive */}
                <div className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-semibold text-purple-700">Most Expensive</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostExpensive.id}`}>
                    <Badge variant="outline" className="font-mono cursor-pointer hover:bg-gray-100">
                      {aggregateStats.highlights.mostExpensive.id}
                    </Badge>
                  </Link>
                  <p className="text-xs text-gray-600 mt-1">
                    Cost: {formatCurrency((aggregateStats.highlights.mostExpensive.performanceData.avgCost || 0) * aggregateStats.highlights.mostExpensive.performanceData.totalExplanations)}
                  </p>
                </div>

                {/* Most Dangerous */}
                <div className="bg-white p-3 rounded border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-700">Most Dangerous</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostDangerous.id}`}>
                    <Badge variant="outline" className="font-mono cursor-pointer hover:bg-gray-100">
                      {aggregateStats.highlights.mostDangerous.id}
                    </Badge>
                  </Link>
                  <p className="text-xs text-gray-600 mt-1">
                    Confidence-Accuracy Gap: {Math.round(aggregateStats.highlights.mostDangerous.performanceData.avgConfidence - (aggregateStats.highlights.mostDangerous.performanceData.avgAccuracy * 100))}%
                  </p>
                </div>

                {/* Most Humble */}
                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-700">Most Humble</p>
                  </div>
                  <Link href={`/puzzle/${aggregateStats.highlights.mostHumble.id}`}>
                    <Badge variant="outline" className="font-mono cursor-pointer hover:bg-gray-100">
                      {aggregateStats.highlights.mostHumble.id}
                    </Badge>
                  </Link>
                  <p className="text-xs text-gray-600 mt-1">
                    Confidence: {Math.round(aggregateStats.highlights.mostHumble.performanceData.avgConfidence)}%
                  </p>
                </div>

                {/* Fastest */}
                <div className="bg-white p-3 rounded border border-green-200">
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
            </CardContent>
          </Card>

          {/* Selected Puzzle Cards */}
          <Card className="border-gray-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Grid className="h-5 w-5 text-gray-600" />
                Selected Puzzle Difficulty Cards
                <Badge variant="outline">{selectedPuzzles.length} puzzles</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedPuzzles.map((puzzle) => {
                  const interestLevel = getPuzzleInterestLevel(puzzle.performanceData);
                  const correctAttempts = getCorrectAttempts(puzzle.performanceData.totalExplanations, puzzle.performanceData.avgAccuracy);
                  const InterestIcon = interestLevel.icon;
                  const totalCost = puzzle.performanceData.avgCost ? puzzle.performanceData.avgCost * puzzle.performanceData.totalExplanations : 0;
                  
                  return (
                    <Card key={puzzle.id} className={`hover:shadow-md transition-shadow ${
                      interestLevel.priority === 1 ? 'border-red-200 bg-red-50' :
                      interestLevel.priority === 2 ? 'border-blue-200 bg-blue-50' :
                      'border-gray-200'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-mono flex items-center gap-2">
                            {puzzle.id}
                            <Badge variant="outline" className="text-xs">
                              {puzzle.source}
                            </Badge>
                          </CardTitle>
                          <Badge variant={interestLevel.variant} className="flex items-center gap-1">
                            <InterestIcon className="h-3 w-3" />
                            {interestLevel.text}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{interestLevel.description}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                          <Button variant="outline" size="sm" className="w-full">
                            {puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis'}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
              <div className="w-full md:flex-1 space-y-2">
                <Label htmlFor="puzzleSearch">Search by Puzzle ID</Label>
                <div className="relative">
                  <Input
                    id="puzzleSearch"
                    placeholder="Enter puzzle ID (e.g., 1ae2feb7)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    className="pr-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                </div>
                {searchError && (
                  <p className="text-sm text-red-500">{searchError}</p>
                )}
              </div>
              <Button 
                onClick={handleSearch}
                className="min-w-[120px]"
              >
                Search
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="sort-by" className="text-sm font-medium">Sort by:</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dangerous">Dangerous</SelectItem>
                  <SelectItem value="humble">Humble</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="unexplored">Unexplored</SelectItem>
                  <SelectItem value="accuracy">Accuracy (Low to High)</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="zero-only" 
                checked={showZeroOnly} 
                onCheckedChange={(checked) => setShowZeroOnly(checked === true)}
              />
              <label htmlFor="zero-only" className="text-sm font-medium cursor-pointer">
                Show only UNEXPLORED puzzles (0 explanations)
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="dangerous-only" 
                checked={dangerousOnly} 
                onCheckedChange={(checked) => setDangerousOnly(checked === true)}
              />
              <label htmlFor="dangerous-only" className="text-sm font-medium cursor-pointer">
                Show dangerous overconfident failures only
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="source-filter" className="text-sm font-medium">Dataset:</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Datasets</SelectItem>
                  <SelectItem value="training">Training (400)</SelectItem>
                  <SelectItem value="training2">Training2 (1000)</SelectItem>
                  <SelectItem value="evaluation">Evaluation (400)</SelectItem>
                  <SelectItem value="evaluation2">Evaluation2 (120)</SelectItem>
                  <SelectItem value="arc-heavy">ARC-Heavy (300)</SelectItem>
                  <SelectItem value="ConceptARC">ConceptARC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading puzzle data</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Database Overview</CardTitle>
          <p className="text-sm text-gray-600">
            Individual puzzle analysis attempts and binary accuracy statistics
          </p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
              <Card key={puzzle.id} className={`hover:shadow-md transition-shadow ${
                interestLevel.priority === 1 ? 'border-red-200 bg-red-50' :
                interestLevel.priority === 2 ? 'border-blue-200 bg-blue-50' :
                'border-gray-200'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      {puzzle.id}
                      <Badge variant="outline" className="text-xs">
                        {puzzle.source}
                      </Badge>
                    </CardTitle>
                    <Badge variant={interestLevel.variant} className="flex items-center gap-1">
                      <InterestIcon className="h-3 w-3" />
                      {interestLevel.text}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{interestLevel.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    <Button variant="outline" size="sm" className="w-full">
                      {puzzle.performanceData.totalExplanations === 0 ? 'Analyze First' : 'View Analysis'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
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
