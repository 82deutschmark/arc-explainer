import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Database, 
  Search, 
  Filter, 
  Eye, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Brain,
  CheckCircle2,
  Clock,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';

interface PuzzleOverviewData {
  id: string;
  source: string;
  maxGridSize: number;
  gridSizeConsistent: boolean;
  hasExplanation: boolean;
  explanations: Array<{
    id: number;
    patternDescription: string;
    solvingStrategy: string;
    alienMeaning: string;
    confidence: number;
    alienMeaningConfidence?: number;
    modelName: string;
    hasReasoningLog: boolean;
    apiProcessingTimeMs?: number;
    saturnSuccess?: boolean;
    createdAt: string;
  }>;
  totalExplanations: number;
  latestExplanation?: any;
  feedbackCount?: number;
}

interface PuzzleOverviewResponse {
  puzzles: PuzzleOverviewData[];
  total: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function PuzzleOverview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasExplanationFilter, setHasExplanationFilter] = useState<string>('all');
  const [hasFeedbackFilter, setHasFeedbackFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [confidenceMin, setConfidenceMin] = useState<string>('');
  const [confidenceMax, setConfidenceMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (hasExplanationFilter !== 'all') params.set('hasExplanation', hasExplanationFilter);
    if (hasFeedbackFilter !== 'all') params.set('hasFeedback', hasFeedbackFilter);
    if (modelFilter) params.set('modelName', modelFilter);
    if (confidenceMin) params.set('confidenceMin', confidenceMin);
    if (confidenceMax) params.set('confidenceMax', confidenceMax);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, confidenceMin, confidenceMax, sortBy, sortOrder, currentPage]);

  // Fetch puzzle overview data
  const { data, isLoading, error, refetch } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['puzzleOverview', queryParams],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzle/overview?${queryParams}`);
      const json = await response.json();
      return json.data;
    },
    keepPreviousData: true,
  });

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    refetch();
  }, [refetch]);

  const handleSortChange = useCallback((newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  const getSortIcon = useCallback((field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  }, [sortBy, sortOrder]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    if (confidence >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <Alert className="border-red-500 bg-red-50">
            <AlertDescription>
              Failed to load puzzle overview. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-8 w-8" />
                Puzzle Database Overview
              </h1>
              <p className="text-lg text-gray-600">
                Browse all puzzles and their explanations stored in the database
              </p>
            </div>
            <Link href="/">
              <Button variant="outline">
                ← Back to Browser
              </Button>
            </Link>
          </div>
        </header>

        {/* Filters & Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search Puzzle ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Enter puzzle ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="sm">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Explanation Filter */}
              <div className="space-y-2">
                <Label htmlFor="hasExplanation">Explanation Status</Label>
                <Select value={hasExplanationFilter} onValueChange={setHasExplanationFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Puzzles</SelectItem>
                    <SelectItem value="true">Has Explanations</SelectItem>
                    <SelectItem value="false">No Explanations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Feedback Filter */}
              <div className="space-y-2">
                <Label htmlFor="hasFeedback">Feedback Status</Label>
                <Select value={hasFeedbackFilter} onValueChange={setHasFeedbackFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Puzzles</SelectItem>
                    <SelectItem value="true">Has Feedback</SelectItem>
                    <SelectItem value="false">No Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Model Filter */}
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Models</SelectItem>
                    {MODELS.map((model) => (
                      <SelectItem key={model.key} value={model.key}>
                        {model.name} ({model.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Confidence Range */}
              <div className="space-y-2">
                <Label>Confidence Range</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Min"
                    type="number"
                    min="0"
                    max="100"
                    value={confidenceMin}
                    onChange={(e) => setConfidenceMin(e.target.value)}
                  />
                  <Input
                    placeholder="Max"
                    type="number"
                    min="0"
                    max="100"
                    value={confidenceMax}
                    onChange={(e) => setConfidenceMax(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Label className="self-center">Sort by:</Label>
              <Button
                variant={sortBy === 'puzzleId' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('puzzleId')}
                className="flex items-center gap-1"
              >
                Puzzle ID {getSortIcon('puzzleId')}
              </Button>
              <Button
                variant={sortBy === 'createdAt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('createdAt')}
                className="flex items-center gap-1"
              >
                Latest Analysis {getSortIcon('createdAt')}
              </Button>
              <Button
                variant={sortBy === 'explanationCount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('explanationCount')}
                className="flex items-center gap-1"
              >
                # Explanations {getSortIcon('explanationCount')}
              </Button>
              <Button
                variant={sortBy === 'latestConfidence' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('latestConfidence')}
                className="flex items-center gap-1"
              >
                Confidence {getSortIcon('latestConfidence')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Results</span>
              {data && (
                <Badge variant="outline">
                  {data.total} puzzles total
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading puzzle data...</p>
              </div>
            ) : !data?.puzzles?.length ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No puzzles match your current filters.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your filters or search terms.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {data.puzzles.map((puzzle) => (
                    <Card key={puzzle.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <code className="text-lg font-mono bg-gray-100 px-3 py-1 rounded">
                                {puzzle.id}
                              </code>
                              
                              {puzzle.source && (
                                <Badge variant="outline" className={`${
                                  puzzle.source === 'ARC1' ? 'bg-blue-50 text-blue-700' : 
                                  puzzle.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700' : 
                                  puzzle.source === 'ARC2' ? 'bg-purple-50 text-purple-700' : 
                                  puzzle.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700' :
                                  'bg-gray-50 text-gray-700'
                                }`}>
                                  {puzzle.source.replace('-Eval', ' Eval')}
                                </Badge>
                              )}

                              <Badge variant="outline" className="bg-gray-50">
                                {puzzle.maxGridSize}×{puzzle.maxGridSize}
                              </Badge>

                              {puzzle.gridSizeConsistent ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  Consistent
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                  Variable
                                </Badge>
                              )}
                            </div>

                            {puzzle.hasExplanation ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="font-medium text-green-700">
                                      {puzzle.totalExplanations} explanation{puzzle.totalExplanations !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  {puzzle.feedbackCount !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <MessageSquare className={`h-4 w-4 ${puzzle.feedbackCount > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                      <span className={`text-sm font-medium ${puzzle.feedbackCount > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                                        {puzzle.feedbackCount || 0} feedback
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                {puzzle.latestExplanation && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">Latest Model:</span>
                                      <Badge variant="outline" className="ml-2">
                                        <Brain className="h-3 w-3 mr-1" />
                                        {puzzle.latestExplanation.modelName}
                                      </Badge>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-500">Confidence:</span>
                                      <Badge className={`ml-2 ${getConfidenceColor(puzzle.latestExplanation.confidence)}`}>
                                        <BarChart3 className="h-3 w-3 mr-1" />
                                        {puzzle.latestExplanation.confidence}%
                                      </Badge>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-500">Analysis Date:</span>
                                      <div className="flex items-center gap-1 mt-1">
                                        <Clock className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs">{formatDate(puzzle.latestExplanation.createdAt)}</span>
                                      </div>
                                    </div>

                                    {puzzle.latestExplanation.apiProcessingTimeMs && (
                                      <div>
                                        <span className="text-gray-500">Processing:</span>
                                        <span className="ml-2 text-xs">
                                          {puzzle.latestExplanation.apiProcessingTimeMs}ms
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {puzzle.explanations.length > 1 && (
                                  <div className="mt-3">
                                    <details className="text-sm">
                                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                        View all {puzzle.explanations.length} explanations
                                      </summary>
                                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
                                        {puzzle.explanations.slice(1).map((explanation) => (
                                          <div key={explanation.id} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" size="sm">
                                                {explanation.modelName}
                                              </Badge>
                                              <Badge className={`${getConfidenceColor(explanation.confidence)}`} size="sm">
                                                {explanation.confidence}%
                                              </Badge>
                                            </div>
                                            <span className="text-gray-500">
                                              {formatDate(explanation.createdAt)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500">
                                <span>No explanations yet</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button asChild size="sm">
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages} ({data.total} total puzzles)
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}