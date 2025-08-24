import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [hasExplanationFilter, setHasExplanationFilter] = useState<string>('all');
  const [hasFeedbackFilter, setHasFeedbackFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [saturnFilter, setSaturnFilter] = useState<string>('all');
  const [confidenceMin, setConfidenceMin] = useState<string>('');
  const [confidenceMax, setConfidenceMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');

  // Handle feedback click
  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (hasExplanationFilter !== 'all') params.set('hasExplanation', hasExplanationFilter);
    if (hasFeedbackFilter !== 'all') params.set('hasFeedback', hasFeedbackFilter);
    if (modelFilter && modelFilter !== 'all') params.set('modelName', modelFilter);
    if (saturnFilter !== 'all') params.set('saturnFilter', saturnFilter);
    if (confidenceMin) params.set('confidenceMin', confidenceMin);
    if (confidenceMax) params.set('confidenceMax', confidenceMax);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchQuery, hasExplanationFilter, hasFeedbackFilter, modelFilter, saturnFilter, confidenceMin, confidenceMax, sortBy, sortOrder, currentPage]);

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

  // Generate Saturn results separately - filtered by saturnFilter state
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
          // Apply Saturn filter
          let includeResult = false;
          if (saturnFilter === 'all' || saturnFilter === 'attempted') {
            includeResult = true;
          } else if (saturnFilter === 'solved') {
            includeResult = explanation.saturnSuccess === true;
          } else if (saturnFilter === 'failed') {
            includeResult = explanation.saturnSuccess === false;
          }
          
          if (includeResult) {
            results.push({
              puzzleId: puzzle.id,
              solved: explanation.saturnSuccess,
              createdAt: explanation.createdAt
            });
          }
        }
      });
    });
    
    // Sort by creation date (newest first)
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, saturnFilter]);

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
          statsLoading={statsLoading}
          accuracyLoading={accuracyLoading}
          recentActivity={recentActivity}
          saturnResults={saturnResults}
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
    </div>
  );
}