import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Eye, RefreshCw, XCircle, ThumbsDown, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { PuzzleOverviewData, PuzzleOverviewResponse } from '@shared/types';

// Use PuzzleOverviewData which includes explanation fields
type ProblematicPuzzle = PuzzleOverviewData;

export default function PuzzleDiscussion() {
  const [maxGridSize, setMaxGridSize] = useState<string>('10');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Set page title
  React.useEffect(() => {
    document.title = 'Puzzle Discussion - Retry Failed Analysis';
  }, []);

  // Query parameters for overview API - focus on problematic puzzles
  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    if (maxGridSize) params.set('gridSizeMax', maxGridSize);
    // Only get puzzles that have explanations
    params.set('hasExplanation', 'true');
    // Set limit to get more puzzles for filtering
    params.set('limit', '100');
    params.set('offset', '0');
    return params;
  }, [maxGridSize]);

  // Use overview API to get puzzles with explanation data
  const { data: overviewResponse, isLoading, error } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['puzzle-overview-discussion', queryParams.toString()],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzle/overview?${queryParams}`);
      return await response.json();
    },
  });

  const puzzles = overviewResponse?.puzzles || [];
  
  // Filter and sort to show worst-performing puzzles first
  const problemPuzzles = React.useMemo(() => {
    const allPuzzles = puzzles;
    
    // Filter to only problematic puzzles
    let filtered = allPuzzles.filter(puzzle => {
      // Must have explanation to be considered problematic
      if (!puzzle.hasExplanation || !puzzle.latestExplanation) return false;
      
      const latest = puzzle.latestExplanation;
      
      // Include if:
      // 1. Prediction was incorrect
      if (latest.isPredictionCorrect === false) return true;
      
      // 2. Low trustworthiness score (predictionAccuracyScore)
      if (latest.predictionAccuracyScore !== undefined && latest.predictionAccuracyScore !== null) {
        if (latest.predictionAccuracyScore < 0.5) return true;
      }
      
      // 3. More negative feedback than positive (if we have feedback data)
      // This would require additional API calls, skip for now
      
      return false;
    });
    
    // Sort by "worst" first
    filtered = filtered.sort((a, b) => {
      const aLatest = a.latestExplanation;
      const bLatest = b.latestExplanation;
      
      if (!aLatest || !bLatest) return 0;
      
      // Priority 1: Incorrect predictions first
      if (aLatest.isPredictionCorrect === false && bLatest.isPredictionCorrect !== false) return -1;
      if (bLatest.isPredictionCorrect === false && aLatest.isPredictionCorrect !== false) return 1;
      
      // Priority 2: Lower trustworthiness scores first
      const aScore = aLatest.predictionAccuracyScore || 1.0;
      const bScore = bLatest.predictionAccuracyScore || 1.0;
      if (aScore !== bScore) return aScore - bScore;
      
      // Priority 3: Lower confidence first
      const aConf = aLatest.confidence || 100;
      const bConf = bLatest.confidence || 100;
      return aConf - bConf;
    });
    
    // Limit to top 20 worst
    return filtered.slice(0, 20);
  }, [puzzles]);

  const getProblemBadge = (puzzle: ProblematicPuzzle) => {
    const issues = [];
    const latest = puzzle.latestExplanation;
    
    if (!latest) return issues;
    
    if (latest.isPredictionCorrect === false) {
      issues.push('Wrong Answer');
    }
    
    if (latest.predictionAccuracyScore !== undefined && latest.predictionAccuracyScore < 0.5) {
      issues.push('Low Trustworthiness');
    }
    
    return issues;
  };

  // Handle puzzle search by ID
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a puzzle ID');
      return;
    }

    const puzzleId = searchQuery.trim();
    setLocation(`/puzzle/${puzzleId}`);
  }, [searchQuery, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Alert className="border-red-500 bg-red-50">
            <AlertDescription>
              Failed to load puzzles. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 to-orange-800 bg-clip-text text-transparent">
                Puzzle Discussion
              </h1>
              <p className="text-lg text-slate-600 mt-2">
                Retry Analysis on Problematic Puzzles
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/browser">
                <Button variant="outline" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Puzzle Browser
                </Button>
              </Link>
              <Link href="/overview">
                <Button variant="outline" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Database Overview
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Search and Filters */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Find Problematic Puzzles
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxGridSize">Maximum Grid Size</Label>
                <Select value={maxGridSize} onValueChange={setMaxGridSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select max size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5×5 (Very Small)</SelectItem>
                    <SelectItem value="10">10×10 (Small)</SelectItem>
                    <SelectItem value="15">15×15 (Medium)</SelectItem>
                    <SelectItem value="20">20×20 (Large)</SelectItem>
                    <SelectItem value="30">30×30 (Very Large)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Showing</Label>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                  <p className="text-sm text-orange-800">
                    Puzzles with wrong predictions or low trustworthiness scores
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">
              Problematic Puzzles 
              {!isLoading && (
                <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700 border-orange-200">
                  {problemPuzzles.length} found
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600">
              Puzzles that need better analysis - sorted by worst performance first
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading puzzles...</p>
              </div>
            ) : problemPuzzles.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 text-green-400" />
                <p className="text-gray-600">Great! No problematic puzzles found with current filters.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting the grid size filter to find more puzzles to improve.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {problemPuzzles.map((puzzle: ProblematicPuzzle) => {
                  const issues = getProblemBadge(puzzle);
                  return (
                    <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white/90 backdrop-blur-sm hover:bg-white/95 hover:scale-[1.02] border-l-4 border-l-orange-400">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                              {puzzle.id}
                            </code>
                            <div className="text-xs flex items-center gap-1">
                              {puzzle.maxGridSize}x{puzzle.maxGridSize}
                              {puzzle.source && (
                                <Badge variant="outline" className={`text-xs ${
                                  puzzle.source === 'ARC1' ? 'bg-blue-50 text-blue-700' : 
                                  puzzle.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700 font-semibold' : 
                                  puzzle.source === 'ARC2' ? 'bg-purple-50 text-purple-700' : 
                                  puzzle.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700 font-bold' :
                                  'bg-gray-50 text-gray-700'
                                }`}>
                                  {puzzle.source.replace('-Eval', ' Eval')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Problem indicators */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {issues.map((issue, idx) => (
                              <Badge key={idx} variant="outline" className="bg-red-50 text-red-700 text-xs flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                {issue}
                              </Badge>
                            ))}
                            
                            {puzzle.latestExplanation?.modelName && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 text-xs">
                                {puzzle.latestExplanation.modelName}
                              </Badge>
                            )}
                            
                            {puzzle.latestExplanation?.predictionAccuracyScore !== undefined && (
                              <Badge variant="outline" className={`text-xs ${
                                puzzle.latestExplanation.predictionAccuracyScore < 0.3 
                                  ? 'bg-red-50 text-red-700'
                                  : puzzle.latestExplanation.predictionAccuracyScore < 0.6
                                    ? 'bg-orange-50 text-orange-700' 
                                    : 'bg-yellow-50 text-yellow-700'
                              }`}>
                                Trust: {Math.round(puzzle.latestExplanation.predictionAccuracyScore * 100)}%
                              </Badge>
                            )}
                            
                            {puzzle.latestExplanation?.confidence && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                {puzzle.latestExplanation.confidence}% conf
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>Max Size:</span>
                              <span className="font-medium">{puzzle.maxGridSize}×{puzzle.maxGridSize}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Explanations:</span>
                              <span className="font-medium">{puzzle.totalExplanations}</span>
                            </div>
                            {puzzle.feedbackCount !== undefined && (
                              <div className="flex justify-between">
                                <span>Feedback:</span>
                                <span className="font-medium">{puzzle.feedbackCount}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button asChild size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600">
                              <Link href={`/puzzle/${puzzle.id}?retry=true`}>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Retry Analysis
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use Discussion Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Purpose:</strong> This page shows puzzles where AI models made incorrect predictions 
              or had low trustworthiness scores, indicating the analysis needs improvement.
            </p>
            
            <p>
              <strong>Retry Analysis:</strong> Click "Retry Analysis" on any puzzle to see the original 
              failed analysis and run a new analysis with enhanced prompting that tells the model 
              the previous attempt was wrong.
            </p>
            
            <p>
              <strong>Problem Types:</strong> Red badges show specific issues like "Wrong Answer" 
              (prediction was incorrect) or "Low Trustworthiness" (model confidence vs. accuracy mismatch).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}