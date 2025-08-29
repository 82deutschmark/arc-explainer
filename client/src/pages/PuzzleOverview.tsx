import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { 
  Database, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Home
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { StatisticsCards } from '@/components/overview/StatisticsCards';
import { SearchFilters } from '@/components/overview/SearchFilters';
import { PuzzleList } from '@/components/overview/PuzzleList';
import type { FeedbackStats } from '@shared/types';

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
    // Accuracy and trustworthiness fields
    isPredictionCorrect?: boolean;
    predictionAccuracyScore?: number;
    multiTestAllCorrect?: boolean;
    multiTestAverageAccuracy?: number;
    // Database fields for filtering and display
    totalTokens?: number;
    estimatedCost?: number;
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
  const [location, setLocation] = useLocation();
  
  // Initialize state from URL parameters
  const urlParams = useMemo(() => new URLSearchParams(location.split('?')[1] || ''), [location]);
  
  const [searchQuery, setSearchQuery] = useState(urlParams.get('search') || '');
  const [hasExplanationFilter, setHasExplanationFilter] = useState<string>(urlParams.get('hasExplanation') || 'all');
  const [hasFeedbackFilter, setHasFeedbackFilter] = useState<string>(urlParams.get('hasFeedback') || 'all');
  const [modelFilter, setModelFilter] = useState<string>(urlParams.get('modelName') || 'all');
  const [saturnFilter, setSaturnFilter] = useState<string>(urlParams.get('saturnFilter') || 'all');
  const [sourceFilter, setSourceFilter] = useState<string>(urlParams.get('source') || 'all');
  const [multiTestFilter, setMultiTestFilter] = useState<string>(urlParams.get('multiTestFilter') || 'all');
  const [gridSizeMin, setGridSizeMin] = useState<string>(urlParams.get('gridSizeMin') || '');
  const [gridSizeMax, setGridSizeMax] = useState<string>(urlParams.get('gridSizeMax') || '');
  const [gridConsistencyFilter, setGridConsistencyFilter] = useState<string>(urlParams.get('gridConsistency') || 'all');
  const [processingTimeMin, setProcessingTimeMin] = useState<string>(urlParams.get('processingTimeMin') || '');
  const [processingTimeMax, setProcessingTimeMax] = useState<string>(urlParams.get('processingTimeMax') || '');
  const [hasPredictionsFilter, setHasPredictionsFilter] = useState<string>(urlParams.get('hasPredictions') || 'all');
  const [predictionAccuracyFilter, setPredictionAccuracyFilter] = useState<string>(urlParams.get('predictionAccuracy') || 'all');
  const [confidenceMin, setConfidenceMin] = useState<string>(urlParams.get('confidenceMin') || '');
  const [confidenceMax, setConfidenceMax] = useState<string>(urlParams.get('confidenceMax') || '');
  const [totalTokensMin, setTotalTokensMin] = useState<string>(urlParams.get('totalTokensMin') || '');
  const [totalTokensMax, setTotalTokensMax] = useState<string>(urlParams.get('totalTokensMax') || '');
  const [estimatedCostMin, setEstimatedCostMin] = useState<string>(urlParams.get('estimatedCostMin') || '');
  const [estimatedCostMax, setEstimatedCostMax] = useState<string>(urlParams.get('estimatedCostMax') || '');
  const [predictionAccuracyMin, setPredictionAccuracyMin] = useState<string>(urlParams.get('predictionAccuracyMin') || '');
  const [predictionAccuracyMax, setPredictionAccuracyMax] = useState<string>(urlParams.get('predictionAccuracyMax') || '');
  const [sortBy, setSortBy] = useState<string>(urlParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<string>(urlParams.get('sortOrder') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(urlParams.get('page') || '1'));
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');

  // Set page title
  React.useEffect(() => {
    document.title = 'Puzzle Database Overview';
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (hasExplanationFilter !== 'all') params.set('hasExplanation', hasExplanationFilter);
    if (hasFeedbackFilter !== 'all') params.set('hasFeedback', hasFeedbackFilter);
    if (modelFilter && modelFilter !== 'all') params.set('modelName', modelFilter);
    if (saturnFilter !== 'all') params.set('saturnFilter', saturnFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (multiTestFilter !== 'all') params.set('multiTestFilter', multiTestFilter);
    if (gridSizeMin) params.set('gridSizeMin', gridSizeMin);
    if (gridSizeMax) params.set('gridSizeMax', gridSizeMax);
    if (gridConsistencyFilter !== 'all') params.set('gridConsistency', gridConsistencyFilter);
    if (processingTimeMin) params.set('processingTimeMin', processingTimeMin);
    if (processingTimeMax) params.set('processingTimeMax', processingTimeMax);
    if (hasPredictionsFilter !== 'all') params.set('hasPredictions', hasPredictionsFilter);
    if (predictionAccuracyFilter !== 'all') params.set('predictionAccuracy', predictionAccuracyFilter);
    if (confidenceMin) params.set('confidenceMin', confidenceMin);
    if (confidenceMax) params.set('confidenceMax', confidenceMax);
    if (totalTokensMin) params.set('totalTokensMin', totalTokensMin);
    if (totalTokensMax) params.set('totalTokensMax', totalTokensMax);
    if (estimatedCostMin) params.set('estimatedCostMin', estimatedCostMin);
    if (estimatedCostMax) params.set('estimatedCostMax', estimatedCostMax);
    if (predictionAccuracyMin) params.set('predictionAccuracyMin', predictionAccuracyMin);
    if (predictionAccuracyMax) params.set('predictionAccuracyMax', predictionAccuracyMax);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    
    const newUrl = `/overview${params.toString() ? '?' + params.toString() : ''}`;
    if (newUrl !== location) {
      setLocation(newUrl);
    }
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, saturnFilter, sourceFilter, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistencyFilter, processingTimeMin, processingTimeMax, hasPredictionsFilter, predictionAccuracyFilter, confidenceMin, confidenceMax, totalTokensMin, totalTokensMax, estimatedCostMin, estimatedCostMax, predictionAccuracyMin, predictionAccuracyMax, sortBy, sortOrder, currentPage, location, setLocation]);

  // Handle feedback click
  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);

  // Build query parameters for API calls
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (hasExplanationFilter !== 'all') params.set('hasExplanation', hasExplanationFilter);
    if (hasFeedbackFilter !== 'all') params.set('hasFeedback', hasFeedbackFilter);
    if (modelFilter && modelFilter !== 'all') params.set('modelName', modelFilter);
    if (saturnFilter !== 'all') params.set('saturnFilter', saturnFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (multiTestFilter !== 'all') params.set('multiTestFilter', multiTestFilter);
    if (gridSizeMin) params.set('gridSizeMin', gridSizeMin);
    if (gridSizeMax) params.set('gridSizeMax', gridSizeMax);
    if (gridConsistencyFilter !== 'all') params.set('gridConsistency', gridConsistencyFilter);
    if (processingTimeMin) params.set('processingTimeMin', processingTimeMin);
    if (processingTimeMax) params.set('processingTimeMax', processingTimeMax);
    if (hasPredictionsFilter !== 'all') params.set('hasPredictions', hasPredictionsFilter);
    if (predictionAccuracyFilter !== 'all') params.set('predictionAccuracy', predictionAccuracyFilter);
    if (confidenceMin) params.set('confidenceMin', confidenceMin);
    if (confidenceMax) params.set('confidenceMax', confidenceMax);
    if (totalTokensMin) params.set('totalTokensMin', totalTokensMin);
    if (totalTokensMax) params.set('totalTokensMax', totalTokensMax);
    if (estimatedCostMin) params.set('estimatedCostMin', estimatedCostMin);
    if (estimatedCostMax) params.set('estimatedCostMax', estimatedCostMax);
    if (predictionAccuracyMin) params.set('predictionAccuracyMin', predictionAccuracyMin);
    if (predictionAccuracyMax) params.set('predictionAccuracyMax', predictionAccuracyMax);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, saturnFilter, sourceFilter, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistencyFilter, processingTimeMin, processingTimeMax, hasPredictionsFilter, predictionAccuracyFilter, confidenceMin, confidenceMax, totalTokensMin, totalTokensMax, estimatedCostMin, estimatedCostMax, predictionAccuracyMin, predictionAccuracyMax, sortBy, sortOrder, currentPage]);

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

  // Fetch solver mode accuracy statistics (DEPRECATED - using fake satisfaction data)
  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery<AccuracyStats>({
    queryKey: ['accuracyStats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/accuracy-stats');
      const json = await response.json();
      return json.data;
    },
  });

  // Fetch recent activity independently of filters
  const { data: recentActivityData } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/overview?limit=20&sortBy=createdAt&sortOrder=desc');
      const json = await response.json();
      return json.data;
    },
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

  // Generate recent activity from separate recent activity data (AI models only)
  const recentActivity = useMemo(() => {
    if (!recentActivityData?.puzzles) return [];
    
    const activities: Array<{
      id: string;
      type: 'explanation' | 'feedback';
      puzzleId: string;
      modelName?: string;
      createdAt: string;
    }> = [];
    
    // Extract explanations from all puzzles (exclude Saturn)
    recentActivityData.puzzles.forEach((puzzle: any) => {
      puzzle.explanations.forEach((explanation: any) => {
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
  }, [recentActivityData]);


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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Database Overview</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 flex items-center justify-center lg:justify-start gap-3">
                <Database className="h-8 w-8 lg:h-10 lg:w-10 text-indigo-600" />
                Puzzle Database Overview
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                Browse all puzzles and their explanations stored in the database
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" size="lg" className="shrink-0">
                ← Back to Browser
              </Button>
            </Link>
          </div>
        </header>

        {/* Statistics Cards */}
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
          saturnResults={[]}
        />

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8">
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
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearch={handleSearch}
          onSortChange={handleSortChange}
          getSortIcon={getSortIcon}
          isLoading={isLoading}
          />
        </div>

        {/* Puzzle List with Pagination */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        initialPuzzleId={selectedPuzzleId}
      />
    </div>
  );
}