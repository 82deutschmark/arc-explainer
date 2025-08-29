import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { ModelDebugModal } from '@/components/ModelDebugModal';
import { StatisticsCards } from '@/components/overview/StatisticsCards';
import { SearchFilters } from '@/components/overview/SearchFilters';
import { PuzzleList } from '@/components/overview/PuzzleList';
import type { FeedbackStats, PuzzleOverviewData, PuzzleOverviewResponse, AccuracyStats, ExplanationRecord } from '@shared/types';

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
  const [sortBy, setSortBy] = useState<string>(urlParams.get('sortBy') || 'explanationCount');
  const [sortOrder, setSortOrder] = useState<string>(urlParams.get('sortOrder') || 'asc');
  const [currentPage, setCurrentPage] = useState(parseInt(urlParams.get('page') || '1'));
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');

  // Model debug modal state
  const [modelDebugModalOpen, setModelDebugModalOpen] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState<string>('');

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
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    
    const newUrl = `/overview${params.toString() ? '?' + params.toString() : ''}`;
    if (newUrl !== location) {
      setLocation(newUrl);
    }
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, saturnFilter, sourceFilter, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistencyFilter, processingTimeMin, processingTimeMax, hasPredictionsFilter, predictionAccuracyFilter, confidenceMin, confidenceMax, sortBy, sortOrder, currentPage, location, setLocation]);

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
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, saturnFilter, sourceFilter, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistencyFilter, processingTimeMin, processingTimeMax, hasPredictionsFilter, predictionAccuracyFilter, confidenceMin, confidenceMax, sortBy, sortOrder, currentPage]);

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

  // Fetch general model statistics (includes all explanations, not just solver mode)
  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery<AccuracyStats>({
    queryKey: ['generalStats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/general-stats');
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

  // Separate query for recent activity - get puzzles with explanations sorted by recent activity
  const { data: recentActivityData } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('hasExplanation', 'true'); // Only puzzles with explanations
      params.set('sortBy', 'createdAt'); // Sort by explanation creation date
      params.set('sortOrder', 'desc'); // Most recent first
      params.set('limit', '20'); // Get 20 recent items
      params.set('offset', '0');
      
      const response = await apiRequest('GET', `/api/puzzle/overview?${params.toString()}`);
      const json = await response.json();
      return json.data;
    },
  });

  // Generate recent activity from dedicated query
  const recentActivity = useMemo(() => {
    if (!recentActivityData?.puzzles) {
      console.log('No recentActivityData.puzzles:', recentActivityData);
      return [];
    }
    
    const activities: Array<{
      id: string;
      type: 'explanation' | 'feedback';
      puzzleId: string;
      modelName?: string;
      createdAt: string;
    }> = [];
    
    // Extract explanations from puzzles (include all explanations, not just non-Saturn)
    recentActivityData.puzzles.forEach((puzzle: PuzzleOverviewData) => {
      puzzle.explanations.forEach((explanation: ExplanationRecord) => {
        activities.push({
          id: explanation.id.toString(),
          type: 'explanation',
          puzzleId: puzzle.id,
          modelName: explanation.modelName,
          createdAt: explanation.createdAt
        });
      });
      
      // Also add feedback activities if available
      if (puzzle.feedbacks) {
        puzzle.feedbacks.forEach((feedback: any) => {
          activities.push({
            id: feedback.id.toString(),
            type: 'feedback',
            puzzleId: puzzle.id,
            createdAt: feedback.createdAt
          });
        });
      }
    });
    
    console.log(`Recent activity found ${activities.length} items`);
    
    // Sort by creation date (newest first)
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15); // Take top 15 for display
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

        {/* Statistics Cards */}
        <StatisticsCards
          feedbackStats={feedbackStats}
          accuracyStats={accuracyStats}
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
          accuracyLoading={accuracyLoading}
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
    </div>
  );
}