import React from 'react';
import { MinimalOverview } from '@/components/overview/MinimalOverview';

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

interface AccuracyStats {
  accuracyByModel: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    avgAccuracyScore: number;
    avgConfidence: number;
    successfulExtractions: number;
    extractionSuccessRate: number;
  }>;
  totalSolverAttempts: number;
}

const ITEMS_PER_PAGE = 20;

export default function PuzzleOverview() {
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Enhanced search and basic filters
  const [searchQuery, setSearchQuery] = useState('');
  
  // New ARC dataset filters
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  
  // Grid size filters
  const [gridSizeRange, setGridSizeRange] = useState<[number, number]>([1, 30]);
  const [gridConsistency, setGridConsistency] = useState<string>('all');
  
  // AI Provider filters (grouped)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  
  // Performance filters
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
  const [processingTimeRange, setProcessingTimeRange] = useState<[number, number]>([0, 300000]);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Legacy engagement filters (maintained for compatibility)
  const [hasExplanationFilter, setHasExplanationFilter] = useState<string>('all');
  const [hasFeedbackFilter, setHasFeedbackFilter] = useState<string>('all');
  const [saturnFilter, setSaturnFilter] = useState<string>('all');
  
  // Sorting
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');

  // Handle feedback click
  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);

  // Build query parameters that match what the backend actually supports
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    // Basic search (only searches puzzle IDs)
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    
    // Supported engagement filters
    if (hasExplanationFilter !== 'all') params.set('hasExplanation', hasExplanationFilter);
    if (hasFeedbackFilter !== 'all') params.set('hasFeedback', hasFeedbackFilter);
    
    // Model filter (only supports single model, not multiple)
    if (selectedModels.length === 1) params.set('modelName', selectedModels[0]);
    
    // Confidence range
    if (confidenceRange[0] > 0) params.set('confidenceMin', confidenceRange[0].toString());
    if (confidenceRange[1] < 100) params.set('confidenceMax', confidenceRange[1].toString());
    
    // Sorting (supported by backend)
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    // Pagination
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [
    searchQuery, hasExplanationFilter, hasFeedbackFilter, selectedModels,
    confidenceRange, sortBy, sortOrder, currentPage
  ]);

  // Fetch puzzle overview data
  const { data, isLoading, error, refetch } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['puzzleOverview', queryParams],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzle/overview?${queryParams}`);
      const json = await response.json();
      return json.data;
    },
    placeholderData: (previousData) => previousData,
  });

  // Fetch feedback statistics
  const { data: feedbackStats, isLoading: statsLoading } = useQuery<FeedbackStats>({
    queryKey: ['feedbackStats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feedback/stats');
      const json = await response.json();
      return json.data;
    },
  });

  // Fetch solver mode accuracy statistics
  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery<AccuracyStats>({
    queryKey: ['accuracyStats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/accuracy-stats');
      const json = await response.json();
      return json.data;
    },
  });

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    refetch();
  }, [refetch]);

  const handleClearAll = useCallback(() => {
    // Reset only the filters that actually work with the backend
    setSearchQuery('');
    setSelectedModels([]);
    setConfidenceRange([0, 100]);
    setHasExplanationFilter('all');
    setHasFeedbackFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  }, []);

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

  // Calculate model performance rankings based on feedback
  const modelRankings = useMemo(() => {
    if (!feedbackStats) return [];
    
    return Object.entries(feedbackStats.feedbackByModel)
      .map(([modelName, stats]) => {
        const total = stats.helpful + stats.notHelpful;
        const helpfulPercentage = total > 0 ? Math.round((stats.helpful / total) * 100) : 0;
        
        // Find model display name from MODELS array
        const modelInfo = MODELS.find(m => m.key === modelName);
        const displayName = modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : modelName;
        
        return {
          modelName,
          displayName,
          helpful: stats.helpful,
          notHelpful: stats.notHelpful,
          total,
          helpfulPercentage,
          provider: modelInfo?.provider || 'Unknown'
        };
      })
      .filter(model => model.total >= 1) // Show all models with at least 1 feedback entry
      .sort((a, b) => {
        // Sort by helpful percentage first, then by total feedback count
        if (a.helpfulPercentage !== b.helpfulPercentage) {
          return b.helpfulPercentage - a.helpfulPercentage;
        }
        return b.total - a.total;
      });
  }, [feedbackStats]);

  // Generate recent activity from puzzle data (AI models only)
  const recentActivity = useMemo(() => {
    if (!data?.puzzles) return [];
    
    const activities: Array<{
      id: string;
      type: 'explanation' | 'feedback';
      puzzleId: string;
      modelName?: string;
      createdAt: string;
    }> = [];
    
    // Extract explanations from all puzzles (exclude Saturn)
    data.puzzles.forEach(puzzle => {
      puzzle.explanations.forEach(explanation => {
        // Skip Saturn results in recent activity
        if (explanation.saturnSuccess !== undefined) return;
        
        activities.push({
          id: explanation.id.toString(),
          type: 'explanation',
          puzzleId: puzzle.id,
          modelName: explanation.modelName,
          createdAt: explanation.createdAt
        });
      });
    });
    
    // Sort by creation date (newest first) and take the most recent
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20); // Keep more items for the scrollable list
  }, [data]);

  // Generate Saturn results separately
  const saturnResults = useMemo(() => {
    if (!data?.puzzles) return [];
    
    const results: Array<{
      puzzleId: string;
      solved: boolean;
      createdAt: string;
    }> = [];
    
    // Extract Saturn results from all puzzles
    data.puzzles.forEach(puzzle => {
      puzzle.explanations.forEach(explanation => {
        // Only include Saturn results
        if (explanation.saturnSuccess !== undefined) {
          results.push({
            puzzleId: puzzle.id,
            solved: explanation.saturnSuccess,
            createdAt: explanation.createdAt
          });
        }
      });
    });
    
    // Sort by creation date (newest first)
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-6 w-6" />
                Puzzle Database Overview
              </h1>
              <p className="text-sm text-gray-600">
                Browse and analyze ARC-AGI puzzles with enhanced filtering
              </p>
            </div>
          </div>
          
          <Link href="/">
            <Button variant="outline" size="sm">
              ← Back to Browser
            </Button>
          </Link>
        </div>
      </header>

      {/* Statistics Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <StatisticsCards
          feedbackStats={feedbackStats}
          accuracyStats={accuracyStats}
          modelRankings={modelRankings}
          onViewAllFeedback={() => {
            setSelectedPuzzleId('');
            setFeedbackModalOpen(true);
          }}
          statsLoading={statsLoading}
          accuracyLoading={accuracyLoading}
          recentActivity={recentActivity}
          saturnResults={saturnResults}
        />
      </div>

      {/* Active Filters */}
      <ActiveFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        gridSizeRange={gridSizeRange}
        setGridSizeRange={setGridSizeRange}
        gridConsistency={gridConsistency}
        setGridConsistency={setGridConsistency}
        selectedProviders={selectedProviders}
        setSelectedProviders={setSelectedProviders}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        confidenceRange={confidenceRange}
        setConfidenceRange={setConfidenceRange}
        processingTimeRange={processingTimeRange}
        setProcessingTimeRange={setProcessingTimeRange}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        hasExplanationFilter={hasExplanationFilter}
        setHasExplanationFilter={setHasExplanationFilter}
        hasFeedbackFilter={hasFeedbackFilter}
        setHasFeedbackFilter={setHasFeedbackFilter}
        saturnFilter={saturnFilter}
        setSaturnFilter={setSaturnFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      {/* Main content area with sidebar */}
      <div className="flex h-[calc(100vh-300px)]">
        {/* Working Filter Sidebar */}
        {sidebarOpen && (
          <div className="lg:block hidden">
            <WorkingFilterSidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedModels={selectedModels}
              setSelectedModels={setSelectedModels}
              confidenceRange={confidenceRange}
              setConfidenceRange={setConfidenceRange}
              hasExplanationFilter={hasExplanationFilter}
              setHasExplanationFilter={setHasExplanationFilter}
              hasFeedbackFilter={hasFeedbackFilter}
              setHasFeedbackFilter={setHasFeedbackFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              onSearch={handleSearch}
              onClearAll={handleClearAll}
              resultCount={data?.total}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Enhanced Puzzle Grid */}
        <EnhancedPuzzleGrid
          puzzles={data?.puzzles}
          total={data?.total || 0}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onFeedbackClick={handleFeedbackClick}
          formatDate={formatDate}
          getConfidenceColor={getConfidenceColor}
          hasMore={data?.hasMore}
        />
      </div>

      {/* Mobile Filter Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}>
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white" onClick={(e) => e.stopPropagation()}>
            <WorkingFilterSidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedModels={selectedModels}
              setSelectedModels={setSelectedModels}
              confidenceRange={confidenceRange}
              setConfidenceRange={setConfidenceRange}
              hasExplanationFilter={hasExplanationFilter}
              setHasExplanationFilter={setHasExplanationFilter}
              hasFeedbackFilter={hasFeedbackFilter}
              setHasFeedbackFilter={setHasFeedbackFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              onSearch={handleSearch}
              onClearAll={handleClearAll}
              resultCount={data?.total}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        initialPuzzleId={selectedPuzzleId}
      />
    </div>
  );
}