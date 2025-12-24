/**
 * DifficultPuzzlesSection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Displays puzzles with the lowest LLM accuracy rates. Extracted from PuzzleDiscussion
 * to properly belong in Analytics section. Provides advanced filtering by accuracy, dataset source,
 * test type, and includes rich metrics display for comprehensive puzzle difficulty analysis.
 * SRP/DRY check: Pass - Single responsibility (display difficult puzzles), reuses existing hooks and components
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Button, Badge, Select, Slider, Input, Alert)
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useWorstPerformingPuzzles } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Grid3X3, Eye, AlertTriangle, MessageSquare, Target, TrendingDown, Clock, DollarSign, Zap, BarChart3, Filter } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function DifficultPuzzlesSection() {
  const [selectedLimit, setSelectedLimit] = useState<number>(50);
  const [sortBy, setSortBy] = useState<string>('accuracy');
  const [compactView, setCompactView] = useState<boolean>(false);
  const [accuracyRange, setAccuracyRange] = useState<[number, number]>([0, 100]);
  const [zeroAccuracyOnly, setZeroAccuracyOnly] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC' | 'all'>('all');
  const [multiTestFilter, setMultiTestFilter] = useState<'single' | 'multi' | 'all'>('all');
  const [showRichMetrics, setShowRichMetrics] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  const { puzzles, total, isLoading, error } = useWorstPerformingPuzzles(
    selectedLimit,
    sortBy,
    accuracyRange[0],
    accuracyRange[1],
    zeroAccuracyOnly,
    selectedSource === 'all' ? undefined : selectedSource,
    multiTestFilter === 'all' ? undefined : multiTestFilter,
    showRichMetrics
  );

  // Filter puzzles based on search query
  const filteredPuzzles = React.useMemo(() => {
    if (!puzzles) return [];
    if (!searchQuery.trim()) return puzzles;
    return puzzles.filter((puzzle: any) => puzzle.id.includes(searchQuery.trim()));
  }, [puzzles, searchQuery]);

  // Handle puzzle search by ID
  const handleSearch = React.useCallback(() => {
    if (filteredPuzzles.length === 1 && searchQuery.trim() === filteredPuzzles[0].id) {
      setLocation(`/task/${filteredPuzzles[0].id}`);
    }
    // If the search query is a full puzzle ID that doesn't exist in the current list, try navigating anyway
    else if (searchQuery.trim().length > 0 && filteredPuzzles.length === 0) {
      const potentialPuzzleId = searchQuery.trim();
      // Basic validation for what a puzzle ID might look like
      if (potentialPuzzleId.length > 5 && !potentialPuzzleId.includes(' ')) {
        setLocation(`/task/${potentialPuzzleId}`);
      }
    }
  }, [searchQuery, filteredPuzzles, setLocation]);

  if (error) {
    return (
      <Alert className="border-red-500 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load worst-performing puzzles. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const formatAccuracy = (accuracy: number) => {
    return (accuracy * 100).toFixed(2) + '%';
  };

  const getAccuracyBadgeColor = (accuracy: number) => {
    if (accuracy === 0) return 'bg-red-100 text-red-800';
    if (accuracy < 0.3) return 'bg-orange-100 text-orange-800';
    if (accuracy < 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence < 0.1) return 'bg-red-100 text-red-800 border-red-200';
    if (confidence < 0.25) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (confidence < 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const formatConfidence = (confidence: number) => {
    return (confidence * 100).toFixed(2) + '%';
  };

  return (
    <div className="space-y-6">
      {/* Mission Statement */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Most Challenging Puzzles</h3>
            <p>
              This section shows puzzles where LLMs have the most difficulty - sorted by lowest accuracy rates.
              These are the hardest puzzles for AI models to solve correctly, with 0% accuracy puzzles at the top.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Filter className="h-5 w-5 text-red-600" />
            Advanced Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* First row - existing controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="limit-select" className="text-sm font-medium">
                Show hardest:
              </label>
              <select
                id="limit-select"
                value={selectedLimit}
                onChange={(e) => setSelectedLimit(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm"
              >
                <option value={25}>25 puzzles</option>
                <option value={50}>50 puzzles</option>
                <option value={75}>75 puzzles</option>
                <option value={100}>100 puzzles</option>
                <option value={150}>150 puzzles</option>
                <option value={200}>200 puzzles</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm font-medium">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm"
              >
                <option value="accuracy">Lowest Accuracy</option>
                <option value="confidence">Lowest Confidence (1-25%)</option>
                <option value="feedback">Most Negative Feedback</option>
                <option value="cost">Highest Cost</option>
                <option value="processing_time">Slowest Processing</option>
                <option value="composite">Composite Difficulty</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="compact-toggle" className="text-sm font-medium">
                Compact view:
              </label>
              <input
                id="compact-toggle"
                type="checkbox"
                checked={compactView}
                onChange={(e) => setCompactView(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-xs text-gray-500">{compactView ? 'On' : 'Off'}</span>
            </div>
          </div>

          {/* Second row - source and test type filtering */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Source filtering */}
              <div className="flex items-center gap-2">
                <label htmlFor="source-select" className="text-sm font-medium">
                  ARC Dataset:
                </label>
                <select
                  id="source-select"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                >
                  <option value="all">All Datasets</option>
                  <option value="ARC2-Eval">ARC 2 Evaluation</option>
                  <option value="ARC2">ARC 2 Training</option>
                  <option value="ARC1-Eval">ARC 1 Evaluation</option>
                  <option value="ARC1">ARC 1 Training</option>
                  <option value="ARC-Heavy">ARC Heavy</option>
                  <option value="ConceptARC">ConceptARC</option>
                </select>
                {selectedSource === 'ARC2-Eval' && (
                  <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                    Focus Dataset
                  </Badge>
                )}
              </div>

              {/* Multi-test filtering */}
              <div className="flex items-center gap-2">
                <label htmlFor="multitest-select" className="text-sm font-medium">
                  Test Cases:
                </label>
                <select
                  id="multitest-select"
                  value={multiTestFilter}
                  onChange={(e) => setMultiTestFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="single">Single Test Only</option>
                  <option value="multi">Multi-Test Only</option>
                </select>
              </div>

              {/* Rich metrics toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="rich-metrics-toggle"
                  type="checkbox"
                  checked={showRichMetrics}
                  onChange={(e) => setShowRichMetrics(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="rich-metrics-toggle" className="text-sm font-medium text-blue-700">
                  Show Rich Metrics
                </label>
                {showRichMetrics && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Third row - accuracy filtering */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Zero accuracy quick filter */}
              <div className="flex items-center gap-2">
                <input
                  id="zero-accuracy-toggle"
                  type="checkbox"
                  checked={zeroAccuracyOnly}
                  onChange={(e) => setZeroAccuracyOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="zero-accuracy-toggle" className="text-sm font-medium text-red-700">
                  Only Unsolved (0%)
                </label>
                {zeroAccuracyOnly && (
                  <Badge variant="destructive" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>

              {/* Accuracy range slider */}
              {!zeroAccuracyOnly && (
                <div className="flex items-center gap-4 flex-1 min-w-80">
                  <label className="text-sm font-medium whitespace-nowrap">
                    Accuracy Range:
                  </label>
                  <div className="flex-1">
                    <Slider
                      value={accuracyRange}
                      onValueChange={(value) => setAccuracyRange(value as [number, number])}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{accuracyRange[0]}%</span>
                      <span>{accuracyRange[1]}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preset accuracy buttons and dataset shortcuts */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Quick accuracy:</span>
                {!zeroAccuracyOnly && (
                  <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([0, 0])}
                  className="text-xs h-7"
                >
                  0%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([0, 10])}
                  className="text-xs h-7"
                >
                  0-10%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([10, 30])}
                  className="text-xs h-7"
                >
                  10-30%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([30, 50])}
                  className="text-xs h-7"
                >
                  30-50%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([50, 100])}
                  className="text-xs h-7"
                >
                  50%+
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccuracyRange([0, 100])}
                  className="text-xs h-7"
                >
                  All
                </Button>
                  </>
                )}
              </div>

              {/* Dataset quick filters */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Quick datasets:</span>
                <Button
                  variant={selectedSource === 'ARC2-Eval' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource('ARC2-Eval')}
                  className="text-xs h-7"
                >
                  ARC 2 Eval
                </Button>
                <Button
                  variant={selectedSource === 'ARC2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource('ARC2')}
                  className="text-xs h-7"
                >
                  ARC 2
                </Button>
                <Button
                  variant={selectedSource === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource('all')}
                  className="text-xs h-7"
                >
                  All
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Summary */}
      {!isLoading && puzzles.length > 0 && (selectedSource !== 'all' || multiTestFilter !== 'all' || showRichMetrics) && (
        <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Filter Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {selectedSource !== 'all' && (
                <div className="bg-white/70 rounded p-3 text-center">
                  <div className="font-semibold text-green-700">{selectedSource}</div>
                  <div className="text-xs text-gray-600">Dataset Focus</div>
                </div>
              )}
              {multiTestFilter !== 'all' && (
                <div className="bg-white/70 rounded p-3 text-center">
                  <div className="font-semibold text-purple-700">{multiTestFilter === 'multi' ? 'Multi-Test' : 'Single-Test'}</div>
                  <div className="text-xs text-gray-600">Test Type</div>
                </div>
              )}
              {showRichMetrics && puzzles.length > 0 && (
                <>
                  <div className="bg-white/70 rounded p-3 text-center">
                    <div className="font-semibold text-blue-700">
                      {Math.round(puzzles.reduce((total: number, p: any) => {
                        const tokens = p.performanceData?.avgTotalTokens || 0;
                        const count = p.performanceData?.totalExplanations || 1;
                        return total + (tokens * count);
                      }, 0) / puzzles.reduce((sum: number, p: any) => sum + (p.performanceData?.totalExplanations || 1), 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">Avg Tokens</div>
                  </div>
                  <div className="bg-white/70 rounded p-3 text-center">
                    <div className="font-semibold text-orange-700">
                      ${(puzzles.reduce((total: number, p: any) => {
                        const cost = p.performanceData?.avgCost || 0;
                        const count = p.performanceData?.totalExplanations || 1;
                        return total + (cost * count);
                      }, 0) / puzzles.reduce((sum: number, p: any) => sum + (p.performanceData?.totalExplanations || 1), 0)).toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-600">Avg Cost</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-800 flex flex-wrap items-center gap-2">
            Most Difficult Puzzles
            {!isLoading && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {searchQuery.trim() ? `${filteredPuzzles.length} of ${total}` : `${total} found`}
              </Badge>
            )}
            {selectedSource !== 'all' && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {selectedSource.replace('-', ' ')}
              </Badge>
            )}
            {multiTestFilter !== 'all' && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                {multiTestFilter === 'multi' ? 'Multi-test only' : 'Single-test only'}
              </Badge>
            )}
            {showRichMetrics && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                Rich metrics
              </Badge>
            )}
            {zeroAccuracyOnly && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                0% accuracy only
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Puzzles with lowest LLM accuracy rates - sorted by {sortBy === 'composite' ? 'composite difficulty' : sortBy}
            {selectedSource === 'ARC2-Eval' && (
              <span className="text-green-700 font-medium"> • Focus: ARC 2 Evaluation Dataset</span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading most difficult puzzles...</p>
            </div>
          ) : filteredPuzzles.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No analyzed puzzles found.</p>
              <p className="text-sm text-gray-500 mt-2">
                Run some AI analyses first!
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 ${
              compactView
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {filteredPuzzles.map((puzzle: any) => (
                <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white/90 backdrop-blur-sm hover:bg-white/95 hover:scale-[1.02] border-l-4 border-l-red-400">
                  <CardContent className={compactView ? "p-3" : "p-4"}>
                    <div className={compactView ? "space-y-2" : "space-y-3"}>
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono bg-red-100 px-2 py-1 rounded text-red-800">
                          {puzzle.id}
                        </code>
                        <div className="text-xs flex items-center gap-1">
                          <Grid3X3 className="h-3 w-3" />
                          {puzzle.maxGridSize ? `${puzzle.maxGridSize}x${puzzle.maxGridSize}` : 'Unknown'}
                          {puzzle.source && (
                            <Badge variant="outline" className={`text-xs ${
                              puzzle.source === 'ARC1' ? 'bg-blue-50 text-blue-700' :
                              puzzle.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700 font-semibold' :
                              puzzle.source === 'ARC2' ? 'bg-purple-50 text-purple-700' :
                              puzzle.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700 font-bold' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {puzzle.source?.replace('-Eval', ' Eval')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Difficulty Metrics */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-red-700">LLM Difficulty</span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-xs ${getAccuracyBadgeColor(puzzle.performanceData?.avgAccuracy || 0)}`}>
                            {formatAccuracy(puzzle.performanceData?.avgAccuracy || 0)} accuracy
                          </Badge>
                          {puzzle.performanceData?.wrongCount > 0 && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                              {puzzle.performanceData.wrongCount} wrong
                            </Badge>
                          )}
                          {puzzle.performanceData?.negativeFeedback > 0 && (
                            <Badge variant="outline" className="bg-pink-50 text-pink-700 text-xs flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {puzzle.performanceData.negativeFeedback} negative
                            </Badge>
                          )}
                          {puzzle.performanceData?.lowestNonZeroConfidence !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getConfidenceBadgeColor(puzzle.performanceData.lowestNonZeroConfidence)}`}
                              title="Lowest non-zero confidence score across all attempts"
                            >
                              {formatConfidence(puzzle.performanceData.lowestNonZeroConfidence)} confidence
                            </Badge>
                          )}
                          {/* Multi-test indicator */}
                          {showRichMetrics && puzzle.performanceData?.multiTestCount > 0 && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                              {puzzle.performanceData.multiTestCount} multi-test
                            </Badge>
                          )}
                          {showRichMetrics && puzzle.performanceData?.singleTestCount > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              {puzzle.performanceData.singleTestCount} single-test
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Total Analyses:</span>
                          <span className="font-medium">{puzzle.performanceData?.totalExplanations || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Feedback:</span>
                          <span className="font-medium">{puzzle.performanceData?.totalFeedback || 0}</span>
                        </div>
                        {puzzle.performanceData?.latestAnalysis && (
                          <div className="flex justify-between">
                            <span>Latest:</span>
                            <span className="font-medium text-xs">
                              {new Date(puzzle.performanceData.latestAnalysis).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {/* Rich metrics display */}
                        {showRichMetrics && (
                          <>
                            {puzzle.performanceData?.avgCost > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3 text-green-600" />
                                  Avg Cost:
                                </span>
                                <span className="font-medium text-xs">${(puzzle.performanceData.avgCost).toFixed(4)}</span>
                              </div>
                            )}
                            {puzzle.performanceData?.avgProcessingTime > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-600" />
                                  Processing:
                                </span>
                                <span className="font-medium text-xs">{(puzzle.performanceData.avgProcessingTime / 1000).toFixed(1)}s</span>
                              </div>
                            )}
                            {puzzle.performanceData?.avgTotalTokens > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-orange-600" />
                                  Tokens:
                                </span>
                                <span className="font-medium text-xs">{Math.round(puzzle.performanceData.avgTotalTokens).toLocaleString()}</span>
                              </div>
                            )}
                            {puzzle.performanceData?.modelsAttemptedCount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <Target className="h-3 w-3 text-purple-600" />
                                  Models:
                                </span>
                                <span className="font-medium text-xs">
                                  {puzzle.performanceData.modelsAttemptedCount} tried
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button asChild size="sm" className="flex-1 bg-red-600 hover:bg-red-700">
                          <Link href={`/examine/${puzzle.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Analyze Puzzle
                          </Link>
                        </Button>
                        <Button asChild size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                          <Link href={`/puzzle/${puzzle.id}/view`}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            View Database
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
    </div>
  );
}
