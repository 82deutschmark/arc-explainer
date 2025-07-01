import React, { useState } from 'react';
import { Link } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, Download, Eye, Github, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PuzzleMetadata } from '@shared/types';

export default function PuzzleBrowser() {
  const [maxGridSize, setMaxGridSize] = useState<string>('10');
  const [gridSizeConsistent, setGridSizeConsistent] = useState<string>('true');
  const [showUnexplainedOnly, setShowUnexplainedOnly] = useState<boolean>(true);
  const { toast } = useToast();

  // Get GitHub repository info
  const { data: githubInfo } = useQuery({
    queryKey: ['/api/puzzle/github/available'],
  });

  // Download more puzzles
  const downloadMutation = useMutation({
    mutationFn: async (count?: number) => {
      const body = count ? { count } : {};
      const response = await apiRequest('POST', '/api/puzzle/github/download', body);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      // Refetch puzzle list
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to download puzzles from GitHub",
        variant: "destructive",
      });
    }
  });
  
  // Create filters object for the hook
  const filters = React.useMemo(() => {
    const result: any = {};
    if (maxGridSize) result.maxGridSize = parseInt(maxGridSize);
    if (gridSizeConsistent === 'true') result.gridSizeConsistent = true;
    if (gridSizeConsistent === 'false') result.gridSizeConsistent = false;
    if (showUnexplainedOnly) result.prioritizeUnexplained = true;
    return result;
  }, [maxGridSize, gridSizeConsistent, showUnexplainedOnly]);

  const { puzzles, isLoading, error } = usePuzzleList(filters);
  const filteredPuzzles = puzzles || [];

  const getGridSizeColor = (size: number) => {
    if (size <= 5) return 'bg-green-100 text-green-800 hover:bg-green-200';
    if (size <= 10) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    return 'bg-red-100 text-red-800 hover:bg-red-200';
  };

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
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold">ARC-AGI Puzzle Explorer</h1>
          <p className="text-lg text-gray-600">
            Examine alien communication patterns and learn logical reasoning
          </p>
          <p className="text-sm text-gray-500">
            Focusing on puzzles with smaller grids that are easier for humans to understand
          </p>
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
                <Label htmlFor="unexplained">Show Unexplained Only</Label>
                <Select value={showUnexplainedOnly.toString()} onValueChange={(value) => setShowUnexplainedOnly(value === 'true')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by explanation status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Unexplained Only</SelectItem>
                    <SelectItem value="false">All Puzzles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gridConsistent">Grid Size Consistency</Label>
                <Select value={gridSizeConsistent} onValueChange={setGridSizeConsistent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select consistency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Consistent (Same size)</SelectItem>
                    <SelectItem value="false">Variable (Different sizes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Repository Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              ARC-AGI Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm">
                  {githubInfo && (githubInfo as any).count ? `${(githubInfo as any).count} puzzles available in repository` : 'Loading repository info...'}
                </p>
                <p className="text-xs text-gray-500">
                  Puzzles are downloaded locally for analysis and filtering
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => downloadMutation.mutate(undefined)}
                  disabled={downloadMutation.isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {downloadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Download All Puzzles
                </Button>
                <Button 
                  onClick={() => downloadMutation.mutate(50)}
                  disabled={downloadMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  Download 50 More
                </Button>
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
              Downloaded puzzles available for examination
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
                  Try adjusting your filters or downloading more puzzles.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPuzzles.map((puzzle: PuzzleMetadata) => (
                  <Card key={puzzle.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {puzzle.id}
                          </code>
                          <Badge className={getDifficultyColor(puzzle.difficulty)}>
                            {puzzle.difficulty}
                          </Badge>
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
              rather than trying to solve them yourself (which is very difficult for humans).
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
              <strong>AI Analysis:</strong> Click "Examine" on any puzzle to see the correct answers and 
              get AI-powered explanations of the logical patterns.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}