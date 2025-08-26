import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, Eye, RefreshCw, CheckCircle2, MessageCircle, Database } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import type { PuzzleMetadata } from '@shared/types';
import { useHasExplanation } from '@/hooks/useExplanation';
import { CollapsibleMission } from '@/components/ui/collapsible-mission';
import { formatProcessingTime } from '@/utils/timeFormatters';

// Extended type to include feedback counts and processing metadata from our enhanced API
interface EnhancedPuzzleMetadata extends PuzzleMetadata {
  explanationId?: number;
  feedbackCount?: number;
  apiProcessingTimeMs?: number;
  modelName?: string;
  createdAt?: string;
  confidence?: number;
  estimatedCost?: number;
}

export default function PuzzleBrowser() {
  const [maxGridSize, setMaxGridSize] = useState<string>('10');
  const [gridSizeConsistent, setGridSizeConsistent] = useState<string>('any');
  const [explanationFilter, setExplanationFilter] = useState<string>('unexplained'); // 'all', 'unexplained', 'explained' - Default to unexplained as requested
  const [arcVersion, setArcVersion] = useState<string>('any'); // 'any', 'ARC1', 'ARC2', or 'ARC2-Eval'
  const [multiTestFilter, setMultiTestFilter] = useState<string>('any'); // 'any', 'single', 'multi'
  const [sortBy, setSortBy] = useState<string>('default'); // 'default', 'processing_time', 'confidence', 'cost', 'created_at'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Set page title
  React.useEffect(() => {
    document.title = 'ARC Puzzle Browser';
  }, []);

  // Create filters object for the hook
  const filters = React.useMemo(() => {
    const result: any = {};
    if (maxGridSize) result.maxGridSize = parseInt(maxGridSize);
    if (gridSizeConsistent === 'true') result.gridSizeConsistent = true;
    if (gridSizeConsistent === 'false') result.gridSizeConsistent = false;
    // Don't use prioritize flags anymore, as we'll filter the results ourselves
    if (arcVersion === 'ARC1' || arcVersion === 'ARC1-Eval' || arcVersion === 'ARC2' || arcVersion === 'ARC2-Eval') result.source = arcVersion;
    if (multiTestFilter === 'single') result.multiTestFilter = 'single';
    if (multiTestFilter === 'multi') result.multiTestFilter = 'multi';
    return result;
  }, [maxGridSize, gridSizeConsistent, arcVersion, multiTestFilter]);

  const { puzzles, isLoading, error } = usePuzzleList(filters);
  
  // Apply explanation filtering and sorting after getting puzzles from the hook
  const filteredPuzzles = React.useMemo(() => {
    const allPuzzles = (puzzles || []) as EnhancedPuzzleMetadata[];
    
    // Apply explanation filter
    let filtered = allPuzzles;
    if (explanationFilter === 'unexplained') {
      filtered = allPuzzles.filter(puzzle => !puzzle.hasExplanation);
    } else if (explanationFilter === 'explained') {
      filtered = allPuzzles.filter(puzzle => puzzle.hasExplanation);
    }
    
    // Apply sorting
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'processing_time':
            // Longest processing time first (nulls last)
            const aTime = a.apiProcessingTimeMs || 0;
            const bTime = b.apiProcessingTimeMs || 0;
            return bTime - aTime;
          case 'confidence':
            // Highest confidence first (nulls last)
            const aConf = a.confidence || 0;
            const bConf = b.confidence || 0;
            return bConf - aConf;
          case 'cost':
            // Highest cost first (nulls last)
            const aCost = a.estimatedCost || 0;
            const bCost = b.estimatedCost || 0;
            return bCost - aCost;
          case 'created_at':
            // Most recent first (nulls last)
            const aDate = a.createdAt || '1970-01-01';
            const bDate = b.createdAt || '1970-01-01';
            return bDate.localeCompare(aDate);
          default:
            return 0;
        }
      });
    }
    
    return filtered;
  }, [puzzles, explanationFilter, sortBy]);

  const getGridSizeColor = (size: number) => {
    if (size <= 5) return 'bg-green-100 text-green-800 hover:bg-green-200';
    if (size <= 10) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    return 'bg-red-100 text-red-800 hover:bg-red-200';
  };


  // Format cost for display
  const formatCost = (cost: number | string | null | undefined) => {
    if (!cost) return null;
    const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;
    if (isNaN(numCost)) return null;
    return `$${numCost.toFixed(3)}`;
  };

  // Handle puzzle search by ID
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a puzzle ID');
      return;
    }

    // Check if the puzzle ID exists in the available puzzles
    const puzzleId = searchQuery.trim();
    const puzzleExists = filteredPuzzles.some(p => p.id === puzzleId) ||
                         puzzles?.some(p => p.id === puzzleId);
    
    if (puzzleExists) {
      // Navigate to the puzzle page
      setLocation(`/puzzle/${puzzleId}`);
    } else {
      // Try to directly navigate to the puzzle
      // The server will handle if it exists or not
      setLocation(`/puzzle/${puzzleId}`);
      
      // Note: We're removing the API check because we'll let the puzzle page handle
      // showing an error if the puzzle doesn't exist. This avoids needing to add
      // a new API endpoint just for this feature.
    }
  }, [searchQuery, filteredPuzzles, puzzles, setLocation]);

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900">ARC-AGI Puzzle Explorer</h1>
              <p className="text-lg text-gray-600">
                Colorblindness Aid & AI Reasoning Analysis
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/model-examiner">
                <Button variant="outline" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Model Examiner
                </Button>
              </Link>
              <Link href="/overview">
                <Button variant="outline" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Overview
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Collapsible Mission Statement */}
          <CollapsibleMission />
        </header>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Filter Puzzles
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label htmlFor="explanationFilter">Explanation Status</Label>
                <Select value={explanationFilter} onValueChange={setExplanationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by explanation status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Puzzles</SelectItem>
                    <SelectItem value="unexplained">Unexplained Only</SelectItem>
                    <SelectItem value="explained">Explained Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gridConsistent">Grid Size Consistency</Label>
                <Select value={gridSizeConsistent} onValueChange={setGridSizeConsistent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any consistency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any consistency</SelectItem>
                    <SelectItem value="true">Consistent size only</SelectItem>
                    <SelectItem value="false">Variable size only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="arcVersion">ARC Version</Label>
                <Select value={arcVersion} onValueChange={setArcVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any ARC version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any ARC version</SelectItem>
                    <SelectItem value="ARC1">ARC1 Training</SelectItem>
                    <SelectItem value="ARC1-Eval">ARC1 Evaluation</SelectItem>
                    <SelectItem value="ARC2">ARC2 Training</SelectItem>
                    <SelectItem value="ARC2-Eval">ARC2 Evaluation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="multiTestFilter">Test Cases</Label>
                <Select value={multiTestFilter} onValueChange={setMultiTestFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any number of test cases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any number of test cases</SelectItem>
                    <SelectItem value="single">Single test case (1 output required)</SelectItem>
                    <SelectItem value="multi">Multiple test cases (2+ outputs required)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Default sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (puzzle order)</SelectItem>
                    <SelectItem value="processing_time">Processing Time (longest first)</SelectItem>
                    <SelectItem value="confidence">Confidence (highest first)</SelectItem>
                    <SelectItem value="cost">Cost (highest first)</SelectItem>
                    <SelectItem value="created_at">Analysis Date (newest first)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>
              Local Puzzles 
              {!isLoading && (
                <Badge variant="outline" className="ml-2">
                  {filteredPuzzles.length} found
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600">
              Puzzles available for examination
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading puzzles...</p>
              </div>
            ) : filteredPuzzles.length === 0 ? (
              <div className="text-center py-8">
                <Grid3X3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No puzzles match your current filters.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPuzzles.map((puzzle: EnhancedPuzzleMetadata) => (
                  <Card key={puzzle.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {puzzle.id}
                          </code>
                          <div className="text-xs flex items-center gap-1">
                            <Grid3X3 className="h-3 w-3" /> {puzzle.maxGridSize}x{puzzle.maxGridSize}
                            {puzzle.gridSizeConsistent ? 
                              <Badge variant="outline" className="text-xs">Consistent</Badge> : 
                              <Badge variant="outline" className="text-xs bg-amber-50">Variable</Badge>
                            }
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
                        
                        {/* Analysis Status and Metadata */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {puzzle.hasExplanation ? (
                            <>
                              <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                ✓ Explained
                              </Badge>
                              {puzzle.modelName && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                  {puzzle.modelName}
                                </Badge>
                              )}
                              {formatProcessingTime(puzzle.apiProcessingTimeMs) && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                                  {formatProcessingTime(puzzle.apiProcessingTimeMs)}
                                </Badge>
                              )}
                              {puzzle.confidence && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                  {puzzle.confidence}% conf
                                </Badge>
                              )}
                              {formatCost(puzzle.estimatedCost) && (
                                <Badge variant="outline" className="bg-green-50 text-green-600 text-xs">
                                  {formatCost(puzzle.estimatedCost)}
                                </Badge>
                              )}
                              {(puzzle.feedbackCount || 0) > 0 && (
                                <Badge variant="outline" className="bg-pink-50 text-pink-700 flex items-center gap-1 text-xs">
                                  <MessageCircle className="h-3 w-3" />
                                  {puzzle.feedbackCount}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              📝 Needs Analysis
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Max Size:</span>
                            <span className="font-medium">{puzzle.maxGridSize}×{puzzle.maxGridSize}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Input:</span>
                            <span className="font-medium">{puzzle.inputSize[0]}×{puzzle.inputSize[1]}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Output:</span>
                            <span className="font-medium">{puzzle.outputSize[0]}×{puzzle.outputSize[1]}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Consistent:</span>
                            <span className={`font-medium ${puzzle.gridSizeConsistent ? 'text-green-600' : 'text-orange-600'}`}>
                              {puzzle.gridSizeConsistent ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button asChild size="sm" className="flex-1">
                            <Link href={`/puzzle/${puzzle.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Examine
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Goal:</strong> This tool helps you examine ARC-AGI puzzles to understand how they work, 
              rather than trying to solve them yourself (which is very difficult for some humans).
            </p>
            <p>
              <strong>Focus:</strong> We're focusing on smaller puzzles (10×10 or smaller) as they're easier 
              to understand and analyze.
            </p>
            <p>
              <strong>Alien Communication:</strong> Each number (0-9) represents a different element in an 
              alien communication system, displayed using space-themed emojis.
            </p>
            <p>
              <strong>AI Analysis:</strong> Click "Examine" on any puzzle to see the correct answers (from the .json file) and
              have the AI try (and often fail!) to explain the logic behind the puzzle.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}