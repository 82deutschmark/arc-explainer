import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
// import { ResearchDashboard } from '@/components/research/ResearchDashboard';
// import { AdvancedSearchPanel } from '@/components/research/AdvancedSearchPanel';
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
  const [activeTab, setActiveTab] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>('');

  // Research search state
  const [searchCriteria, setSearchCriteria] = useState<any>(null);

  // Handle feedback click
  const handleFeedbackClick = useCallback((puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setFeedbackModalOpen(true);
  }, []);

  // Build query parameters for basic puzzle list (used for research insights)
  const basicQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '1000'); // Get more for research analysis
    params.set('offset', '0');
    return params.toString();
  }, []);

  // Build query parameters for advanced search
  const searchQueryParams = useMemo(() => {
    if (!searchCriteria) return null;
    
    const params = new URLSearchParams();
    if (searchCriteria.puzzleId) params.set('puzzleId', searchCriteria.puzzleId);
    if (searchCriteria.source?.length > 0) params.set('source', searchCriteria.source.join(','));
    if (searchCriteria.hasExplanations !== null) params.set('hasExplanations', searchCriteria.hasExplanations.toString());
    if (searchCriteria.modelName?.length > 0) params.set('modelName', searchCriteria.modelName.join(','));
    
    params.set('limit', ITEMS_PER_PAGE.toString());
    params.set('offset', ((currentPage - 1) * ITEMS_PER_PAGE).toString());
    
    return params.toString();
  }, [searchCriteria, currentPage]);

  // Fetch basic puzzle data for research insights
  const { data: basicPuzzleData, isLoading: basicLoading, error } = useQuery<PuzzleOverviewResponse>({
    queryKey: ['puzzleOverview', basicQueryParams],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzle/overview?${basicQueryParams}`);
      const json = await response.json();
      return json.data;
    },
  });

  // Advanced search - TEMPORARILY DISABLED
  // const { data: searchResults, isLoading: searchLoading } = useQuery<PuzzleOverviewResponse>({
  //   queryKey: ['advancedSearch', searchQueryParams],
  //   queryFn: async () => {
  //     if (!searchQueryParams) return null;
  //     const response = await apiRequest('POST', `/api/research/advanced-search?${searchQueryParams}`);
  //     const json = await response.json();
  //     return json.data;
  //   },
  //   enabled: !!searchQueryParams,
  // });

  // Research insights - TEMPORARILY DISABLED
  // const { data: researchInsights, isLoading: insightsLoading } = useQuery({
  //   queryKey: ['researchInsights'],
  //   queryFn: async () => {
  //     const response = await apiRequest('GET', '/api/research/insights');
  //     const json = await response.json();
  //     return json.data;
  //   },
  // });

  // Model discrepancies - TEMPORARILY DISABLED  
  // const { data: modelDiscrepancies, isLoading: discrepanciesLoading } = useQuery({
  //   queryKey: ['modelDiscrepancies'],
  //   queryFn: async () => {
  //     const response = await apiRequest('GET', '/api/research/model-discrepancies');
  //     const json = await response.json();
  //     return json.data?.discrepancies || [];
  //   },
  // });

  // Saturn analytics - TEMPORARILY DISABLED
  // const { data: saturnAnalytics, isLoading: saturnLoading } = useQuery({
  //   queryKey: ['saturnAnalytics'],
  //   queryFn: async () => {
  //     const response = await apiRequest('GET', '/api/research/saturn-analytics');
  //     const json = await response.json();
  //     return json.data;
  //   },
  // });

  // Fetch solver mode accuracy statistics
  const { data: accuracyStats, isLoading: accuracyLoading } = useQuery<AccuracyStats>({
    queryKey: ['accuracyStats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/accuracy-stats');
      const json = await response.json();
      return json.data;
    },
  });

  const handleAdvancedSearch = useCallback((criteria: any) => {
    setSearchCriteria(criteria);
    setCurrentPage(1);
    setActiveTab('search');
  }, []);

  const handleResetSearch = useCallback(() => {
    setSearchCriteria(null);
    setCurrentPage(1);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    if (confidence >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // Transform accuracy stats for research dashboard
  const modelPerformance = useMemo(() => {
    if (!accuracyStats?.accuracyByModel) return [];
    
    return accuracyStats.accuracyByModel.map(model => {
      const modelInfo = MODELS.find(m => m.key === model.modelName);
      return {
        ...model,
        displayName: modelInfo ? `${modelInfo.name} (${modelInfo.provider})` : model.modelName,
        provider: modelInfo?.provider || 'Unknown'
      };
    });
  }, [accuracyStats]);

  // Transform Saturn analytics for research dashboard - TEMPORARILY DISABLED
  // const saturnPerformance = useMemo(() => {
  //   if (!saturnAnalytics) return {
  //     totalAttempts: 0,
  //     successCount: 0,
  //     failureCount: 0,
  //     successRate: 0,
  //     recentResults: []
  //   };
  //   
  //   return {
  //     totalAttempts: saturnAnalytics.totalAttempts || 0,
  //     successCount: saturnAnalytics.successCount || 0,
  //     failureCount: saturnAnalytics.failureCount || 0,
  //     successRate: saturnAnalytics.successRate || 0,
  //     recentResults: saturnAnalytics.recentResults || []
  //   };
  // }, [saturnAnalytics]);

  // Get current data for display (search disabled, always use basic data)
  const currentData = basicPuzzleData;
  const isLoading = basicLoading;
  
  // Get puzzle counts for dashboard - TEMPORARILY DISABLED
  // const puzzleCounts = useMemo(() => {
  //   const total = researchInsights?.totalPuzzles || 0;
  //   const withExplanations = researchInsights?.puzzlesWithExplanations || 0;
  //   const withSaturnResults = researchInsights?.puzzlesWithSaturnResults || 0;
  //   
  //   return { total, withExplanations, withSaturnResults };
  // }, [researchInsights]);

  const totalPages = currentData ? Math.ceil(currentData.total / ITEMS_PER_PAGE) : 0;

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">ARC Puzzle Research Dashboard</h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Research Dashboard
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Advanced Search
                {searchCriteria && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Puzzle List
                {currentData && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {currentData.total}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Puzzle List View */}
        {activeTab === 'list' && (
          <>
            {searchCriteria && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <strong>Active Search:</strong> {searchCriteria.puzzleId ? `Puzzle ID: ${searchCriteria.puzzleId}` : 'Advanced filters applied'}
                  </div>
                  <button
                    onClick={handleResetSearch}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Clear Search
                  </button>
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="bg-white rounded-lg shadow-sm border p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading puzzles...</p>
                </div>
              </div>
            ) : !currentData?.puzzles || currentData.puzzles.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-8">
                <div className="text-center">
                  <p className="text-gray-600">No puzzles found{searchCriteria ? ' with the current search criteria' : ''}.</p>
                </div>
              </div>
            ) : (
              <PuzzleList
                puzzles={currentData.puzzles}
                total={currentData.total || 0}
                isLoading={isLoading}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onFeedbackClick={handleFeedbackClick}
                formatDate={formatDate}
                getConfidenceColor={getConfidenceColor}
              />
            )}
          </>
        )}
        
        {/* Research Dashboard - TEMPORARILY DISABLED */}
        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Research Dashboard</h3>
              <p className="text-gray-500">Temporarily disabled while backend endpoints are being implemented</p>
            </div>
          </div>
        )}
        
        {/* Advanced Search Panel - TEMPORARILY DISABLED */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="text-center">
              <Search className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Advanced Search</h3>
              <p className="text-gray-500">Temporarily disabled while backend endpoints are being implemented</p>
            </div>
          </div>
        )}


        {/* Feedback Modal */}
        <FeedbackModal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          initialPuzzleId={selectedPuzzleId || undefined}
        />
      </div>
    </div>
  );
}