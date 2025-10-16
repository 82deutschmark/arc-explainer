import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { useModels } from '@/hooks/useModels';
import { Loader2, Grid3X3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import type { PuzzleMetadata } from '@shared/types';
import { useHasExplanation } from '@/hooks/useExplanation';
import { formatProcessingTime } from '@/utils/timeFormatters';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';
import { hasPuzzleName } from '@shared/utils/puzzleNames';

// Extended type to include feedback counts and processing metadata from our enhanced API
interface EnhancedPuzzleMetadata extends PuzzleMetadata {
  explanationId?: number;
  feedbackCount?: number;
  apiProcessingTimeMs?: number;
  modelName?: string;
  createdAt?: string;
  confidence?: number;
  estimatedCost?: number;
  isPredictionCorrect?: boolean;
  multiplePredictedOutputs?: any;
  multiTestResults?: any;
  multiTestAllCorrect?: boolean;
  multiTestAverageAccuracy?: number;
  hasMultiplePredictions?: boolean;
  multiTestPredictionGrids?: any;
}

export default function PuzzleBrowser() {
  const [maxGridSize, setMaxGridSize] = useState<string>('any');
  const [gridSizeConsistent, setGridSizeConsistent] = useState<string>('any');
  const [explanationFilter, setExplanationFilter] = useState<string>('unexplained'); // 'all', 'unexplained', 'explained' - Default to unexplained puzzles for analysis
  const [namedFilter, setNamedFilter] = useState<string>('all'); // 'all', 'named', 'unnamed'
  const [arcVersion, setArcVersion] = useState<string>('any'); // 'any', 'ARC1', 'ARC2', or 'ARC2-Eval' - Show all datasets by default
  const [multiTestFilter, setMultiTestFilter] = useState<string>('single'); // 'any', 'single', 'multi'
  const [sortBy, setSortBy] = useState<string>('named_first'); // 'named_first', 'unexplained_first', 'default', etc.
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [location, setLocation] = useLocation();
  const { data: models = [] } = useModels();
  const { toast } = useToast();

  // Set page title
  React.useEffect(() => {
    document.title = 'ARC Puzzle Browser';
  }, []);

  // Create filters object for the hook
  const filters = React.useMemo(() => {
    const result: any = {};
    if (maxGridSize && maxGridSize !== 'any') result.maxGridSize = parseInt(maxGridSize);
    if (gridSizeConsistent === 'true') result.gridSizeConsistent = true;
    if (gridSizeConsistent === 'false') result.gridSizeConsistent = false;
    // Don't use prioritize flags anymore, as we'll filter the results ourselves
    if (arcVersion === 'ARC1' || arcVersion === 'ARC1-Eval' || arcVersion === 'ARC2' || arcVersion === 'ARC2-Eval' || arcVersion === 'ARC-Heavy' || arcVersion === 'ConceptARC') result.source = arcVersion;
    if (multiTestFilter === 'single') result.multiTestFilter = 'single';
    if (multiTestFilter === 'multi') result.multiTestFilter = 'multi';
    return result;
  }, [maxGridSize, gridSizeConsistent, arcVersion, multiTestFilter]);

  const { puzzles, isLoading, error } = usePuzzleList(filters);
  
  // Apply explanation filtering and sorting after getting puzzles from the hook
  const filteredPuzzles = React.useMemo(() => {
    let filtered = (puzzles || []) as unknown as EnhancedPuzzleMetadata[];

    // Apply search query first
    if (searchQuery.trim()) {
      filtered = filtered.filter(puzzle => puzzle.id.includes(searchQuery.trim()));
    }

    // Apply explanation filter
    if (explanationFilter === 'unexplained') {
      filtered = filtered.filter(puzzle => !puzzle.hasExplanation);
    } else if (explanationFilter === 'explained') {
      filtered = filtered.filter(puzzle => puzzle.hasExplanation);
    }

    // Apply named puzzle filter
    if (namedFilter === 'named') {
      filtered = filtered.filter(puzzle => hasPuzzleName(puzzle.id));
    } else if (namedFilter === 'unnamed') {
      filtered = filtered.filter(puzzle => !hasPuzzleName(puzzle.id));
    }

    // Apply sorting
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'named_first':
            // Sort named puzzles first, then by puzzle ID
            const aHasName = hasPuzzleName(a.id) ? 0 : 1;
            const bHasName = hasPuzzleName(b.id) ? 0 : 1;
            if (aHasName !== bHasName) {
              return aHasName - bHasName; // Named (0) comes before unnamed (1)
            }
            return a.id.localeCompare(b.id); // Secondary sort by puzzle ID
          case 'unexplained_first':
            // Sort unexplained puzzles first, then by puzzle ID
            const aHasExplanation = a.hasExplanation ? 1 : 0;
            const bHasExplanation = b.hasExplanation ? 1 : 0;
            if (aHasExplanation !== bHasExplanation) {
              return aHasExplanation - bHasExplanation; // Unexplained (0) comes before explained (1)
            }
            return a.id.localeCompare(b.id); // Secondary sort by puzzle ID
          case 'processing_time':
            const aTime = a.apiProcessingTimeMs || 0;
            const bTime = b.apiProcessingTimeMs || 0;
            return bTime - aTime;
          case 'confidence':
            const aConf = a.confidence || 0;
            const bConf = b.confidence || 0;
            return bConf - aConf;
          case 'cost':
            const aCost = a.estimatedCost || 0;
            const bCost = b.estimatedCost || 0;
            return bCost - aCost;
          case 'created_at':
            const aDate = a.createdAt || '1970-01-01';
            const bDate = b.createdAt || '1970-01-01';
            return bDate.localeCompare(aDate);
          case 'least_analysis_data':
            const countAnalysisFields = (puzzle: EnhancedPuzzleMetadata) => {
              let count = 0;
              if (puzzle.isPredictionCorrect !== null && puzzle.isPredictionCorrect !== undefined) count++;
              if (puzzle.multiplePredictedOutputs !== null && puzzle.multiplePredictedOutputs !== undefined) count++;
              if (puzzle.multiTestResults !== null && puzzle.multiTestResults !== undefined) count++;
              if (puzzle.multiTestAllCorrect !== null && puzzle.multiTestAllCorrect !== undefined) count++;
              if (puzzle.multiTestAverageAccuracy !== null && puzzle.multiTestAverageAccuracy !== undefined) count++;
              if (puzzle.hasMultiplePredictions !== null && puzzle.hasMultiplePredictions !== undefined) count++;
              if (puzzle.multiTestPredictionGrids !== null && puzzle.multiTestPredictionGrids !== undefined) count++;
              return count;
            };
            const aAnalysisCount = countAnalysisFields(a);
            const bAnalysisCount = countAnalysisFields(b);
            return aAnalysisCount - bAnalysisCount;
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [puzzles, explanationFilter, namedFilter, sortBy, searchQuery]);

  const getGridSizeColor = (size: number) => {
    if (size <= 5) return 'bg-green-100 text-green-800 hover:bg-green-200';
    if (size <= 10) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    return 'bg-red-100 text-red-800 hover:bg-red-200';
  };


  // Format cost for display
  const formatCost = (cost: number | string | null | undefined) => {
    if (!cost) return null;
    const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;
    if (isNaN(numCost)) return null;
    return `$${numCost.toFixed(3)}`;
  };

  // Handle puzzle search by ID
  const handleSearch = useCallback(() => {
    // The filtering is now handled by the useMemo hook.
    // This function is kept for the Enter key press and button click, but it can be simplified.
    // If a single puzzle is found, navigate to it.
    if (filteredPuzzles.length === 1 && searchQuery.trim() === filteredPuzzles[0].id) {
      setLocation(`/puzzle/${filteredPuzzles[0].id}`);
    }
    // If the search query is a full puzzle ID that doesn't exist in the current list, try navigating anyway
    else if (searchQuery.trim().length > 0 && filteredPuzzles.length === 0) {
        const potentialPuzzleId = searchQuery.trim();
        // Basic validation for what a puzzle ID might look like
        if (potentialPuzzleId.length > 5 && !potentialPuzzleId.includes(' ')) {
             setLocation(`/puzzle/${potentialPuzzleId}`);
        }
    }

  }, [searchQuery, filteredPuzzles, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Hero Section - Action Focused */}
        <header className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-gray-900">ARC-AGI Puzzle Explorer</h1>
              <p className="text-gray-600">
                Search and examine abstract reasoning puzzles with AI analysis
              </p>
            </div>

            {/* Primary Search Action */}
            <div className="space-y-4">
              <div className="relative">
                <input
                  className="input input-bordered w-full input-lg"
                  placeholder="Search by puzzle ID (e.g., 1ae2feb7) or browse below..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchError(null);
                  }}
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
              
              {/* Quick Stats */}
              <div className="flex justify-center gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">{filteredPuzzles.length}</span> puzzles
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{filteredPuzzles.filter(p => hasPuzzleName(p.id)).length}</span> named
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{filteredPuzzles.filter(p => p.hasExplanation).length}</span> analyzed
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filters - Collapsible */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Advanced Filters</span>
              <span className="text-sm text-gray-500">({Object.keys(filters).length > 0 ? 'Active' : 'None'})</span>
            </div>
            <span className="text-gray-400">{filtersOpen ? '−' : '+'}</span>
          </button>
          
          {filtersOpen && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-2">
                  <label htmlFor="maxGridSize" className="label">Maximum Grid Size</label>
                  <select className="select select-bordered w-full" value={maxGridSize} onChange={(e) => setMaxGridSize(e.target.value)}>
                    <option value="any">Any Size</option>
                    <option value="5">5×5 (Very Small)</option>
                    <option value="10">10×10 (Small)</option>
                    <option value="15">15×15 (Medium)</option>
                    <option value="20">20×20 (Large)</option>
                    <option value="30">30×30 (Very Large)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="explanationFilter" className="label">Explanation Status</label>
                  <select className="select select-bordered w-full" value={explanationFilter} onChange={(e) => setExplanationFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="unexplained">Unexplained Only</option>
                    <option value="explained">Explained Only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="namedFilter" className="label">Puzzle Names</label>
                  <select className="select select-bordered w-full" value={namedFilter} onChange={(e) => setNamedFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="named">Named Only (400 puzzles)</option>
                    <option value="unnamed">Unnamed Only</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="gridConsistent" className="label">Grid Size Consistency</label>
                  <select className="select select-bordered w-full" value={gridSizeConsistent} onChange={(e) => setGridSizeConsistent(e.target.value)}>
                    <option value="any">Any consistency</option>
                    <option value="true">Consistent size only</option>
                    <option value="false">Variable size only</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="arcVersion" className="label">ARC Version</label>
                  <select className="select select-bordered w-full" value={arcVersion} onChange={(e) => setArcVersion(e.target.value)}>
                    <option value="any">Any ARC version</option>
                    <option value="ARC1">ARC1 Training</option>
                    <option value="ARC1-Eval">ARC1 Evaluation</option>
                    <option value="ARC2">ARC2 Training</option>
                    <option value="ARC2-Eval">ARC2 Evaluation</option>
                    <option value="ARC-Heavy">ARC-Heavy Dataset</option>
                    <option value="ConceptARC">ConceptARC Dataset</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="multiTestFilter" className="label">Test Cases</label>
                  <select className="select select-bordered w-full" value={multiTestFilter} onChange={(e) => setMultiTestFilter(e.target.value)}>
                    <option value="any">Any number of test cases</option>
                    <option value="single">Single test case (1 output required)</option>
                    <option value="multi">Multiple test cases (2+ outputs required)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="sortBy" className="label">Sort By</label>
                  <select className="select select-bordered w-full" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="named_first">Named First</option>
                    <option value="unexplained_first">Unexplained First</option>
                    <option value="default">Default (puzzle order)</option>
                    <option value="least_analysis_data">Analysis Data (fewest first)</option>
                    <option value="processing_time">Processing Time (longest first)</option>
                    <option value="confidence">Confidence (highest first)</option>
                    <option value="cost">Cost (highest first)</option>
                    <option value="created_at">Analysis Date (newest first)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Puzzles 
              {!isLoading && (
                <div className="badge badge-outline ml-2 bg-blue-50 text-blue-700 border-blue-200">
                  {filteredPuzzles.length} found
                </div>
              )}
            </h2>
            <p className="text-sm text-gray-600">
              Puzzles available for examination
            </p>
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
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPuzzles.map((puzzle: EnhancedPuzzleMetadata) => (
                  <PuzzleCard 
                    key={puzzle.id} 
                    puzzle={puzzle}
                    showGridPreview={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About This Project</Link>
            <a href="https://github.com/82deutschmark/arc-explainer" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">GitHub</a>
            <a href="https://www.arxiv.org/pdf/2505.11831" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">ARC2 Paper</a>
            <a href="https://github.com/fchollet/ARC-AGI" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Official ARC-AGI</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
