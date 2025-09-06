import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Github,
  Filter,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { ModelDebugModal } from '@/components/ModelDebugModal';
import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { ModelComparisonMatrix } from '@/components/overview/ModelComparisonMatrix';
import { SearchFilters } from '@/components/overview/SearchFilters';
import { PuzzleList } from '@/components/overview/PuzzleList';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { useModelComparisons } from '@/hooks/useModelComparisons';
import type { PuzzleOverviewData, PuzzleOverviewResponse, ExplanationRecord } from '@shared/types';

const ITEMS_PER_PAGE = 20;

export default function PuzzleOverview() {
  const [location, setLocation] = useLocation();
  
  // Simplified state - only essential filters
  const urlParams = useMemo(() => new URLSearchParams(location.split('?')[1] || ''), [location]);
  
  const [searchQuery, setSearchQuery] = useState(urlParams.get('search') || '');
  const [modelFilter, setModelFilter] = useState<string>(urlParams.get('modelName') || 'all');
  const [performanceTier, setPerformanceTier] = useState<string>(urlParams.get('performanceTier') || 'all');
  const [sortBy, setSortBy] = useState<string>(urlParams.get('sortBy') || 'explanationCount');
  const [sortOrder, setSortOrder] = useState<string>(urlParams.get('sortOrder') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(urlParams.get('page') || '1'));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showPuzzleBrowser, setShowPuzzleBrowser] = useState(false);
  
  // Modal states
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');
  const [modelDebugModalOpen, setModelDebugModalOpen] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState<string>('');

  // Fetch leaderboard data
  const {
    accuracyStats,
    performanceStats, 
    feedbackStats,
    isLoadingAccuracy,
    isLoadingPerformance,
    isLoadingFeedback,
    hasAnyError
  } = useModelLeaderboards();

  // Fetch model comparison data
  const {
    modelComparisons,
    dashboard,
    isLoading: isLoadingComparisons
  } = useModelComparisons();

  // Set page title
  React.useEffect(() => {
    document.title = 'Model Performance Dashboard - ARC Explainer';
  }, []);

  // Simplified URL update
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (modelFilter !== 'all') params.set('modelName', modelFilter);
    if (performanceTier !== 'all') params.set('performanceTier', performanceTier);
    if (sortBy !== 'explanationCount') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    
    const newUrl = `/overview${params.toString() ? '?' + params.toString() : ''}`;
    if (newUrl !== location) {
      setLocation(newUrl);
    }
  }, [searchQuery, modelFilter, performanceTier, sortBy, sortOrder, currentPage, location, setLocation]);

  // Handle feedback click
  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);

  // Handle model click
  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName);
    setModelDebugModalOpen(true);
  }, []);

  // Simplified query parameters for puzzle browser (when enabled)
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (modelFilter !== 'all') params.set('modelName', modelFilter);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchQuery, modelFilter, sortBy, sortOrder, currentPage]);

  // Fetch puzzle overview data (only when puzzle browser is shown)
  const { data, isLoading, error, refetch } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['puzzleOverview', queryParams],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzle/overview?${queryParams}`);
      const json = await response.json();
      return json.data;
    },
    placeholderData: (previousData) => previousData,
    enabled: showPuzzleBrowser, // Only fetch when browser is shown
  });

  // Remove individual stats queries - now handled by hooks

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    if (showPuzzleBrowser) {
      refetch();
    }
  }, [refetch, showPuzzleBrowser]);

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

  // Remove complex model ranking logic - now handled by leaderboard components

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
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline">
                  ← Back to Browser
                </Button>
              </Link>
              <a
                href="https://github.com/82deutschmark/arc-explainer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  <span className="text-xs">Open Source</span>
                </Button>
              </a>
            </div>
          </div>
        </header>

        {/* Statistics Cards */}
        <StatisticsCards
          feedbackStats={feedbackStats}
          accuracyStats={accuracyStats}
          confidenceStats={confidenceStats}
          modelRankings={modelRankings}
          onViewAllFeedback={() => {
            setSelectedPuzzleId('');
            setFeedbackModalOpen(true);
          }}
          onModelClick={(modelName: string) => {
            setSelectedModelName(modelName);
            setModelDebugModalOpen(true);
          }}
          statsLoading={statsLoading}
          accuracyLoading={accuracyLoading || confidenceLoading}
          recentActivity={recentActivity}
        />

        {/* Search and Filters */}
        <SearchFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          hasExplanationFilter={hasExplanationFilter}
          setHasExplanationFilter={setHasExplanationFilter}
          hasFeedbackFilter={hasFeedbackFilter}
          setHasFeedbackFilter={setHasFeedbackFilter}
          modelFilter={modelFilter}
          setModelFilter={setModelFilter}
          saturnFilter={saturnFilter}
          setSaturnFilter={setSaturnFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          multiTestFilter={multiTestFilter}
          setMultiTestFilter={setMultiTestFilter}
          gridSizeMin={gridSizeMin}
          setGridSizeMin={setGridSizeMin}
          gridSizeMax={gridSizeMax}
          setGridSizeMax={setGridSizeMax}
          gridConsistencyFilter={gridConsistencyFilter}
          setGridConsistencyFilter={setGridConsistencyFilter}
          processingTimeMin={processingTimeMin}
          setProcessingTimeMin={setProcessingTimeMin}
          processingTimeMax={processingTimeMax}
          setProcessingTimeMax={setProcessingTimeMax}
          hasPredictionsFilter={hasPredictionsFilter}
          setHasPredictionsFilter={setHasPredictionsFilter}
          predictionAccuracyFilter={predictionAccuracyFilter}
          setPredictionAccuracyFilter={setPredictionAccuracyFilter}
          confidenceMin={confidenceMin}
          setConfidenceMin={setConfidenceMin}
          confidenceMax={confidenceMax}
          setConfidenceMax={setConfidenceMax}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearch={handleSearch}
          onSortChange={handleSortChange}
          getSortIcon={getSortIcon}
          totalTokensMin={totalTokensMin}
          setTotalTokensMin={setTotalTokensMin}
          totalTokensMax={totalTokensMax}
          setTotalTokensMax={setTotalTokensMax}
          estimatedCostMin={estimatedCostMin}
          setEstimatedCostMin={setEstimatedCostMin}
          estimatedCostMax={estimatedCostMax}
          setEstimatedCostMax={setEstimatedCostMax}
          predictionAccuracyMin={predictionAccuracyMin}
          setPredictionAccuracyMin={setPredictionAccuracyMin}
          predictionAccuracyMax={predictionAccuracyMax}
          setPredictionAccuracyMax={setPredictionAccuracyMax}
        />

        {/* Loading indicator for filtering */}
        {isLoading && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <p className="text-blue-800 font-medium">Applying filters and loading puzzles...</p>
                <p className="text-blue-600 text-sm">This may take a few seconds for complex queries</p>
              </div>
            </div>
          </div>
        )}

        {/* Puzzle List with Pagination */}
        <PuzzleList
          puzzles={data?.puzzles}
          total={data?.total || 0}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onFeedbackClick={handleFeedbackClick}
          formatDate={formatDate}
          getConfidenceColor={getConfidenceColor}
        />
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        initialPuzzleId={selectedPuzzleId}
      />

      {/* Model Debug Modal */}
      <ModelDebugModal
        open={modelDebugModalOpen}
        onOpenChange={setModelDebugModalOpen}
        modelName={selectedModelName}
      />
      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        initialPuzzleId={selectedPuzzleId}
      />

      {/* Model Debug Modal */}
      <ModelDebugModal
        open={modelDebugModalOpen}
        onOpenChange={setModelDebugModalOpen}
        modelName={selectedModelName}
      />
    </div>
  );
}