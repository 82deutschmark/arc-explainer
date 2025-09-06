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

        {/* Main Leaderboards Section */}
        <LeaderboardSection
          accuracyStats={accuracyStats}
          performanceStats={performanceStats}
          feedbackStats={feedbackStats}
          isLoadingAccuracy={isLoadingAccuracy}
          isLoadingPerformance={isLoadingPerformance}
          isLoadingFeedback={isLoadingFeedback}
          onModelClick={handleModelClick}
        />

        {/* Model Comparison Matrix */}
        <ModelComparisonMatrix
          modelComparisons={modelComparisons}
          isLoading={isLoadingComparisons}
          onModelClick={handleModelClick}
        />

        {/* Smart Discovery Section */}
        {dashboard && (
          <section className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Smart Discovery
              </h2>
              <p className="text-gray-600">
                Quick insights and recommendations based on current performance data
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">🏆 Top Performer</h3>
                <p className="text-sm text-green-700">
                  {dashboard.accuracyStats.topAccurateModels[0]?.modelName || 'N/A'} leads with {dashboard.accuracyStats.topAccurateModels[0]?.accuracy.toFixed(1) || '0'}% accuracy
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">🛡️ Most Trustworthy</h3>
                <p className="text-sm text-blue-700">
                  {dashboard.trustworthinessStats.topTrustworthyModels[0]?.modelName || 'N/A'} has the most reliable confidence
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-4 rounded-lg border border-pink-200">
                <h3 className="font-semibold text-pink-800 mb-2">❤️ User Favorite</h3>
                <p className="text-sm text-pink-700">
                  {dashboard.feedbackStats.topRatedModels[0]?.modelName || 'N/A'} has {dashboard.feedbackStats.topRatedModels[0]?.helpfulPercentage.toFixed(1) || '0'}% satisfaction
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Simplified Discovery Filters */}
        {showPuzzleBrowser && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Puzzle Explorer</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
              </Button>
            </div>
            
            <div className="bg-white p-4 rounded-lg border space-y-4">
              {/* Basic Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search puzzles..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <select
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Models</option>
                    <option value="gpt-4">GPT-4 Family</option>
                    <option value="claude">Claude Family</option>
                    <option value="gemini">Gemini Family</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Performance Tier
                  </label>
                  <select
                    value={performanceTier}
                    onChange={(e) => setPerformanceTier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Performance Levels</option>
                    <option value="high">High Performers (≥80%)</option>
                    <option value="medium">Medium Performers (60-80%)</option>
                    <option value="low">Learning Opportunity (&lt;60%)</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <Button onClick={handleSearch} className="w-full">
                    Search
                  </Button>
                </div>
              </div>
              
              {/* Advanced Filters (collapsible) */}
              {showAdvancedFilters && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-3">
                    Advanced filtering options would go here if needed. Current focus is on model performance discovery.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Puzzle List (only shown when browser is enabled) */}
        {showPuzzleBrowser && (
          <>
            {/* Loading indicator for filtering */}
            {isLoading && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <div>
                    <p className="text-blue-800 font-medium">Loading puzzles...</p>
                    <p className="text-blue-600 text-sm">This may take a few seconds</p>
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
          </>
        )}
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
    </div>
  );
}