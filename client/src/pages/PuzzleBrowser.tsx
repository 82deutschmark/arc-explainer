import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { useModels } from '@/hooks/useModels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, Eye, CheckCircle2, MessageCircle, Download } from 'lucide-react';
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
  isPredictionCorrect?: boolean;
  multiplePredictedOutputs?: any;
  multiTestResults?: any;
  multiTestAllCorrect?: boolean;
  multiTestAverageAccuracy?: number;
  hasMultiplePredictions?: boolean;
  multiTestPredictionGrids?: any;
}

export default function PuzzleBrowser() {
  const [maxGridSize, setMaxGridSize] = useState<string>('any');
  const [gridSizeConsistent, setGridSizeConsistent] = useState<string>('any');
  const [explanationFilter, setExplanationFilter] = useState<string>('unexplained'); // 'all', 'unexplained', 'explained' - Default to unexplained puzzles for analysis
  const [arcVersion, setArcVersion] = useState<string>('ARC2-Eval'); // 'any', 'ARC1', 'ARC2', or 'ARC2-Eval'
  const [multiTestFilter, setMultiTestFilter] = useState<string>('single'); // 'any', 'single', 'multi'
  const [sortBy, setSortBy] = useState<string>('unexplained_first'); // 'default', 'processing_time', 'confidence', 'cost', 'created_at', 'least_analysis_data', 'unexplained_first'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { data: models = [] } = useModels();
  const { toast } = useToast();

  // Set page title
  React.useEffect(() => {
    document.title = 'ARC Puzzle Browser';
  }, []);

  // Create filters object for the hook
  const filters = React.useMemo(() => {
    const result: any = {};
    if (maxGridSize && maxGridSize !== 'any') result.maxGridSize = parseInt(maxGridSize);
    if (gridSizeConsistent === 'true') result.gridSizeConsistent = true;
    if (gridSizeConsistent === 'false') result.gridSizeConsistent = false;
    // Don't use prioritize flags anymore, as we'll filter the results ourselves
    if (arcVersion === 'ARC1' || arcVersion === 'ARC1-Eval' || arcVersion === 'ARC2' || arcVersion === 'ARC2-Eval' || arcVersion === 'ARC-Heavy') result.source = arcVersion;
    if (multiTestFilter === 'single') result.multiTestFilter = 'single';
    if (multiTestFilter === 'multi') result.multiTestFilter = 'multi';
    return result;
  }, [maxGridSize, gridSizeConsistent, arcVersion, multiTestFilter]);

  const { puzzles, isLoading, error } = usePuzzleList(filters);
  
  // Apply explanation filtering and sorting after getting puzzles from the hook
  const filteredPuzzles = React.useMemo(() => {
    let filtered = (puzzles || []) as EnhancedPuzzleMetadata[];

    // Apply search query first
    if (searchQuery.trim()) {
      filtered = filtered.filter(puzzle => puzzle.id.includes(searchQuery.trim()));
    }

    // Apply explanation filter
    if (explanationFilter === 'unexplained') {
      filtered = filtered.filter(puzzle => !puzzle.hasExplanation);
    } else if (explanationFilter === 'explained') {
      filtered = filtered.filter(puzzle => puzzle.hasExplanation);
    }

    // Apply sorting
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'unexplained_first':
            // Sort unexplained puzzles first, then by puzzle ID
            const aHasExplanation = a.hasExplanation ? 1 : 0;
            const bHasExplanation = b.hasExplanation ? 1 : 0;
            if (aHasExplanation !== bHasExplanation) {
              return aHasExplanation - bHasExplanation; // Unexplained (0) comes before explained (1)
            }
            return a.id.localeCompare(b.id); // Secondary sort by puzzle ID
          case 'processing_time':
            const aTime = a.apiProcessingTimeMs || 0;
            const bTime = b.apiProcessingTimeMs || 0;
            return bTime - aTime;
          case 'confidence':
            const aConf = a.confidence || 0;
            const bConf = b.confidence || 0;
            return bConf - aConf;
          case 'cost':
            const aCost = a.estimatedCost || 0;
            const bCost = b.estimatedCost || 0;
            return bCost - aCost;
          case 'created_at':
            const aDate = a.createdAt || '1970-01-01';
            const bDate = b.createdAt || '1970-01-01';
            return bDate.localeCompare(aDate);
          case 'least_analysis_data':
            const countAnalysisFields = (puzzle: EnhancedPuzzleMetadata) => {
              let count = 0;
              if (puzzle.isPredictionCorrect !== null && puzzle.isPredictionCorrect !== undefined) count++;
              if (puzzle.multiplePredictedOutputs !== null && puzzle.multiplePredictedOutputs !== undefined) count++;
              if (puzzle.multiTestResults !== null && puzzle.multiTestResults !== undefined) count++;
              if (puzzle.multiTestAllCorrect !== null && puzzle.multiTestAllCorrect !== undefined) count++;
              if (puzzle.multiTestAverageAccuracy !== null && puzzle.multiTestAverageAccuracy !== undefined) count++;
              if (puzzle.hasMultiplePredictions !== null && puzzle.hasMultiplePredictions !== undefined) count++;
              if (puzzle.multiTestPredictionGrids !== null && puzzle.multiTestPredictionGrids !== undefined) count++;
              return count;
            };
            const aAnalysisCount = countAnalysisFields(a);
            const bAnalysisCount = countAnalysisFields(b);
            return aAnalysisCount - bAnalysisCount;
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [puzzles, explanationFilter, sortBy, searchQuery]);

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
    // The filtering is now handled by the useMemo hook.
    // This function is kept for the Enter key press and button click, but it can be simplified.
    // If a single puzzle is found, navigate to it.
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 to-blue-800 bg-clip-text text-transparent">ARC-AGI Puzzle Explorer</h1>
            <p className="text-lg text-slate-600 mt-2">
              Colorblindness Aid & AI Reasoning Analysis
            </p>
          </div>
          
          {/* Collapsible Mission Statement */}
          <CollapsibleMission />
        </header>

        {/* Filters */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Grid3X3 className="h-5 w-5 text-blue-600" />
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
                    <SelectItem value="any">Any Size</SelectItem>
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
                    <SelectItem value="ARC-Heavy">ARC-Heavy Dataset</SelectItem>
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
                    <SelectValue placeholder="Unexplained first (recommended)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unexplained_first">Unexplained First (recommended)</SelectItem>
                    <SelectItem value="default">Default (puzzle order)</SelectItem>
                    <SelectItem value="least_analysis_data">Analysis Data (fewest first)</SelectItem>
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
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">
              Local Puzzles 
              {!isLoading && (
                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
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
                  <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white/90 backdrop-blur-sm hover:bg-white/95 hover:scale-[1.02]">
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
                                puzzle.source === 'ARC-Heavy' ? 'bg-orange-50 text-orange-700 font-semibold' :
                                'bg-gray-50 text-gray-700'
                              }`}>
                                {puzzle.source.replace('-Eval', ' Eval').replace('-Heavy', ' Heavy')}
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
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                                  <span>{puzzle.modelName}</span>
                                  {(() => {
                                    const model = models.find((m: { name: string }) => m.name === puzzle.modelName);
                                    return model?.releaseDate ? (
                                      <span className="text-blue-500 text-[10px] opacity-75">
                                        ({model.releaseDate})
                                      </span>
                                    ) : null;
                                  })()}
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
                          {puzzle.importSource && (
                            <div className="flex justify-between">
                              <span>Import:</span>
                              <span className="font-medium text-xs text-gray-500" title={puzzle.importSource}>
                                {puzzle.importSource.includes('/') ? puzzle.importSource.split('/')[1] : puzzle.importSource}
                              </span>
                            </div>
                          )}
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
              <strong>AI Analysis:</strong> Click "Examine" on any puzzle to see the correct answers (from the .json file) and
              have the AI try (and often fail!) to explain the logic behind the puzzle.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}