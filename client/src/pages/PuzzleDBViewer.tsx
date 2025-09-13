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
import { Database, Filter, Grid, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

// Import puzzle DB hook
import { usePuzzleDBStats, PuzzleDBStats } from '@/hooks/usePuzzleDBStats';


// Helper functions for puzzle categorization
function getPuzzleDifficultyBadge(totalExplanations: number, avgAccuracy: number) {
  if (totalExplanations === 0) {
    return { variant: 'destructive' as const, text: 'No Attempts', icon: AlertTriangle };
  }
  if (totalExplanations <= 2) {
    return { variant: 'secondary' as const, text: 'Few Attempts', icon: XCircle };
  }
  if (avgAccuracy === 0) {
    return { variant: 'destructive' as const, text: 'Never Solved', icon: XCircle };
  }
  if (avgAccuracy < 0.3) {
    return { variant: 'destructive' as const, text: 'Very Hard', icon: AlertTriangle };
  }
  if (avgAccuracy < 0.7) {
    return { variant: 'secondary' as const, text: 'Moderate', icon: AlertTriangle };
  }
  return { variant: 'default' as const, text: 'Easier', icon: CheckCircle };
}

function getCorrectAttempts(totalExplanations: number, avgAccuracy: number) {
  return Math.round(totalExplanations * avgAccuracy);
}

export default function PuzzleDBViewer() {
  // Set page title
  React.useEffect(() => {
    document.title = 'Puzzle Database Viewer - ARC Explainer';
  }, []);

  // Filter state
  const [sortBy, setSortBy] = useState<'composite' | 'accuracy' | 'confidence'>('composite');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [zeroAccuracyOnly, setZeroAccuracyOnly] = useState(false);

  // Fetch puzzle data
  const { data: puzzles, isLoading, error } = usePuzzleDBStats({
    limit: 200,
    sortBy,
    zeroAccuracyOnly,
    includeRichMetrics: true
  });

  // Filter puzzles based on state
  const filteredPuzzles = React.useMemo(() => {
    if (!puzzles) return [];
    if (showZeroOnly) {
      return puzzles.filter(p => p.totalExplanations === 0);
    }
    return puzzles;
  }, [puzzles, showZeroOnly]);


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
            {filteredPuzzles.length} Puzzles
          </Badge>
          {isLoading && (
            <Badge variant="outline" className="text-blue-600">
              Loading...
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="sort-by" className="text-sm font-medium">Sort by:</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="composite">Difficulty Score</SelectItem>
                  <SelectItem value="accuracy">Accuracy (Low to High)</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="zero-only" 
                checked={showZeroOnly} 
                onCheckedChange={setShowZeroOnly}
              />
              <label htmlFor="zero-only" className="text-sm font-medium cursor-pointer">
                Show only puzzles with 0 explanations
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="zero-accuracy" 
                checked={zeroAccuracyOnly} 
                onCheckedChange={setZeroAccuracyOnly}
              />
              <label htmlFor="zero-accuracy" className="text-sm font-medium cursor-pointer">
                Show only never-solved puzzles
              </label>
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
              <p className="text-sm font-medium text-gray-700">No Attempts</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredPuzzles.filter(p => p.totalExplanations === 0).length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Never Solved</p>
              <p className="text-2xl font-bold text-amber-600">
                {filteredPuzzles.filter(p => p.totalExplanations > 0 && p.avgAccuracy === 0).length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">High Attempt Count</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredPuzzles.filter(p => p.totalExplanations >= 10).length}
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
            const difficulty = getPuzzleDifficultyBadge(puzzle.totalExplanations, puzzle.avgAccuracy);
            const correctAttempts = getCorrectAttempts(puzzle.totalExplanations, puzzle.avgAccuracy);
            const DifficultyIcon = difficulty.icon;
            
            return (
              <Card key={puzzle.puzzleId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono">
                      {puzzle.puzzleId}
                    </CardTitle>
                    <Badge variant={difficulty.variant} className="flex items-center gap-1">
                      <DifficultyIcon className="h-3 w-3" />
                      {difficulty.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Binary Accuracy Display */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {correctAttempts} / {puzzle.totalExplanations}
                    </div>
                    <div className="text-sm text-gray-600">correct attempts</div>
                    {puzzle.totalExplanations > 0 && (
                      <div className="text-lg font-semibold text-blue-600">
                        {Math.round(puzzle.avgAccuracy * 100)}% accuracy
                      </div>
                    )}
                  </div>
                  
                  {/* Additional Metrics */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">DB Records:</span>
                      <span className="font-semibold">{puzzle.totalExplanations}</span>
                    </div>
                    {puzzle.avgConfidence > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Confidence:</span>
                        <span className="font-semibold">{Math.round(puzzle.avgConfidence)}%</span>
                      </div>
                    )}
                    {puzzle.negativeFeedback > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Negative Feedback:</span>
                        <span className="font-semibold text-red-600">{puzzle.negativeFeedback}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Button */}
                  <Link href={`/puzzle/${puzzle.puzzleId}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Puzzle
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
