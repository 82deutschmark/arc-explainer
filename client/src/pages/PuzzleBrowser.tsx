/**
 * Author: gpt-5-codex
 * Date: 2025-10-17  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Presents the ARC puzzle browser with streamlined research links, lean filter controls, and PuzzleCard integration.
 * SRP/DRY check: Pass - Verified filter logic and listing rendering after UI cleanup.
 */
import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { Loader2, Grid3X3, ExternalLink, Sparkles } from 'lucide-react';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';
import type { PuzzleMetadata } from '@shared/types';
import { CollapsibleMission } from '@/components/ui/collapsible-mission';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';

const HERO_STREAMER_PATTERN = [
  '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '🟥', '🟧', '🟨',
  '🟩', '🟦', '🟪', '⬛', '🟩', '🟦', '🟪', '⬛', '🟥', '🟧',
  '🟦', '🟪', '⬛', '🟩', '🟦', '🟪', '⬛', '🟥', '🟧', '🟨',
];

const HERO_TWILIGHT_PATTERN = [
  '🟪', '🟦', '🟪', '🟦', '⬛', '🟪', '🟦', '⬛', '🟪', '🟦',
  '🟦', '⬛', '🟪', '🟦', '⬛', '🟪', '🟦', '⬛', '🟪', '🟦',
  '🟪', '🟦', '⬛', '🟪', '🟦', '⬛', '🟪', '🟦', '⬛', '🟪',
];



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
  const [arcVersion, setArcVersion] = useState<string>('any'); // 'any', 'ARC1', 'ARC2', or 'ARC2-Eval' - Show all datasets by default
  const [multiTestFilter, setMultiTestFilter] = useState<string>('single'); // 'any', 'single', 'multi'
  const [sortBy, setSortBy] = useState<string>('unexplained_first'); // 'default', 'processing_time', 'confidence', 'cost', 'created_at', 'least_analysis_data', 'unexplained_first'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

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

    // Apply sorting
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
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
  }, [puzzles, explanationFilter, sortBy, searchQuery]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2">
        <div className="mx-auto max-w-5xl space-y-2">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2">
      <div className="mx-auto max-w-7xl space-y-4">

        <header className="text-center">
          {/* Top decorative corner mosaics */}
          <div className="-mb-4 flex items-start justify-between px-4">
            <EmojiMosaicAccent
              pattern={HERO_STREAMER_PATTERN}
              columns={10}
              maxColumns={10}
              size="md"
              framed
              className="drop-shadow-lg"
            />
            <EmojiMosaicAccent
              pattern={HERO_TWILIGHT_PATTERN}
              columns={10}
              maxColumns={10}
              size="md"
              framed
              className="drop-shadow-lg"
            />
          </div>

          <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center gap-4">
              <EmojiMosaicAccent variant="rainbow" size="md" framed className="drop-shadow" />
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  ARC-AGI Puzzle Explorer
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Navigate the ARC datasets with streamlined filters and curated research links.
                </p>
              </div>
              <EmojiMosaicAccent variant="rainbow" size="md" framed className="drop-shadow" />
            </div>

            <CollapsibleMission />
          </div>

          <div className="mx-auto mt-6 max-w-5xl">
            <div className="card border-0 bg-white/90 shadow-lg backdrop-blur-sm">
              <div className="card-body space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                  <EmojiMosaicAccent variant="datasetSignal" size="sm" framed />
                  <Sparkles className="h-4 w-4 text-slate-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    ARC-AGI Knowledge Hub
                  </h3>
                  <Sparkles className="h-4 w-4 text-slate-600" />
                  <EmojiMosaicAccent variant="analysisSignal" size="sm" framed />
                </div>

                <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-[11px]">
                  <div className="flex items-center gap-2 mb-2">
                    <EmojiMosaicAccent variant="statusExplained" size="xs" framed={false} />
                    <p className="font-bold text-slate-900 uppercase tracking-wide">Research Papers</p>
                  </div>
                  <a href="https://www.arxiv.org/pdf/2505.11831" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
                    ARC-AGI-2 Technical Report
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-[11px]">
                  <div className="flex items-center gap-2 mb-2">
                    <EmojiMosaicAccent variant="sizeSignal" size="xs" framed={false} />
                    <p className="font-bold text-slate-900 uppercase tracking-wide">Data Sources</p>
                  </div>
                  <div className="mt-1 space-y-1">
                    <a href="https://huggingface.co/arcprize" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
                      HuggingFace Datasets
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="https://github.com/fchollet/ARC-AGI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
                      Official Repository
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-[11px]">
                  <div className="flex items-center gap-2 mb-2">
                    <EmojiMosaicAccent variant="searchSignal" size="xs" framed={false} />
                    <p className="font-bold text-slate-900 uppercase tracking-wide">Top Solutions</p>
                  </div>
                  <div className="mt-1 space-y-1">
                    <a href="https://github.com/zoecarver" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900">
                      zoecarver's approach
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="https://github.com/jerber" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900">
                      jerber's solutions
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-[11px]">
                  <div className="flex items-center gap-2 mb-2">
                    <EmojiMosaicAccent variant="statusUnexplained" size="xs" framed={false} />
                    <p className="font-bold text-slate-900 uppercase tracking-wide">Community Knowledge</p>
                  </div>
                  <div className="mt-1 space-y-1">
                    <a href="https://github.com/google/ARC-GEN/blob/main/task_list.py#L422" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900">
                      Puzzle nomenclature
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="https://github.com/neoneye/arc-notes" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900">
                      ARC notes
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900">
                      Abstraction dataset
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="text-center flex items-center justify-center gap-2">
                <EmojiMosaicAccent variant="heroTwilight" size="xs" framed={false} />
                <p className="text-[11px] text-slate-700 font-medium">
                  <strong>Special thanks to Simon Strandgaard (@neoneye)</strong> for his insights, support, and encouragement.
                </p>
                <EmojiMosaicAccent variant="heroSunrise" size="xs" framed={false} />
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}

        <div className="card border-2 border-slate-300 bg-white shadow-md max-w-5xl mx-auto">
          <div className="card-body py-3 px-4">
            <div className="flex flex-wrap items-end justify-center gap-4">
              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <label htmlFor="puzzleSearch" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Search by Puzzle ID</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input input-sm input-bordered w-56 border-2 border-slate-400 bg-white text-slate-900 placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    id="puzzleSearch"
                    placeholder="e.g., 1ae2feb7"
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
                  <button
                    type="button"
                    className="btn btn-sm btn-primary normal-case font-semibold"

                    onClick={handleSearch}
                  >
                    Search
                  </button>
                </div>

                {searchError && (
                  <p className="text-xs text-red-700 font-semibold">{searchError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-end justify-center gap-4">
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                  <label htmlFor="maxGridSize" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Max Grid Size</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={maxGridSize}
                    onChange={(e) => setMaxGridSize(e.target.value)}
                  >
                    <option value="any">Any size</option>
                    <option value="5">Up to 5x5</option>
                    <option value="10">Up to 10x10</option>
                    <option value="15">Up to 15x15</option>
                    <option value="20">Up to 20x20</option>
                    <option value="30">Up to 30x30</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[160px]">
                  <label htmlFor="explanationFilter" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Explanation Status</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={explanationFilter}
                    onChange={(e) => setExplanationFilter(e.target.value)}
                  >
                    <option value="all">All puzzles</option>
                    <option value="unexplained">Unexplained only</option>
                    <option value="explained">Explained only</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[170px]">
                  <label htmlFor="gridConsistent" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Grid Consistency</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={gridSizeConsistent}
                    onChange={(e) => setGridSizeConsistent(e.target.value)}
                  >
                    <option value="any">Any consistency</option>
                    <option value="true">Consistent size only</option>
                    <option value="false">Variable size only</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[160px]">
                  <label htmlFor="arcVersion" className="text-xs font-bold text-slate-900 uppercase tracking-wide">ARC Version</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={arcVersion}
                    onChange={(e) => setArcVersion(e.target.value)}
                  >
                    <option value="any">Any ARC version</option>
                    <option value="ARC1">ARC1 Training</option>
                    <option value="ARC1-Eval">ARC1 Evaluation</option>
                    <option value="ARC2">ARC2 Training</option>
                    <option value="ARC2-Eval">ARC2 Evaluation</option>
                    <option value="ARC-Heavy">ARC-Heavy Dataset</option>
                    <option value="ConceptARC">ConceptARC Dataset</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[170px]">
                  <label htmlFor="multiTestFilter" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Test Cases</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={multiTestFilter}
                    onChange={(e) => setMultiTestFilter(e.target.value)}
                  >
                    <option value="any">Any number of test cases</option>
                    <option value="single">Single test case</option>
                    <option value="multi">Multiple test cases</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 min-w-[200px]">
                  <label htmlFor="sortBy" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Sort By</label>
                  <select
                    className="select select-sm select-bordered w-full border-2 border-slate-400 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="unexplained_first">Unexplained first (recommended)</option>
                    <option value="default">Default order</option>
                    <option value="least_analysis_data">Analysis data (fewest first)</option>
                    <option value="processing_time">Processing time</option>
                    <option value="confidence">Confidence</option>
                    <option value="cost">Cost</option>
                    <option value="created_at">Analysis date</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 pt-3 text-[10px]">
              <span className="text-xs font-bold text-slate-900">Active Filters:</span>
              {[
                { id: 'search', label: 'Search', active: searchQuery.trim().length > 0 },
                { id: 'maxGridSize', label: 'Max grid', active: maxGridSize !== 'any' },
                { id: 'gridSizeConsistent', label: 'Consistency', active: gridSizeConsistent !== 'any' },
                { id: 'explanationFilter', label: 'Explanation', active: explanationFilter !== 'unexplained' },
                { id: 'arcVersion', label: 'ARC version', active: arcVersion !== 'any' },
                { id: 'multiTestFilter', label: 'Test cases', active: multiTestFilter !== 'single' },
                { id: 'sortBy', label: 'Sort', active: sortBy !== 'unexplained_first' },
              ].map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors ${ item.active ? 'border-blue-600 bg-blue-100 text-blue-900 shadow-sm' : 'border-slate-300 bg-slate-50 text-slate-500' }`}
                >
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Results */}
        <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm max-w-6xl mx-auto">
          <div className="card-body p-2">
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-slate-800">
              <h2 className="text-base font-semibold">Puzzle Results</h2>
              {!isLoading && (
                <div className="badge badge-sm badge-outline bg-blue-50 text-blue-700 border-blue-200">
                  {filteredPuzzles.length} found
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading puzzles...</p>
              </div>
            ) : filteredPuzzles.length === 0 ? (
              <div className="text-center py-4">
                <Grid3X3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600 text-sm">No puzzles match your current filters.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

        {/* Instructions */}
        <div className="card max-w-5xl mx-auto">
          <div className="card-body p-2">
            <h2 className="card-title text-sm mb-1">How to Use</h2>
            <div className="space-y-1 text-[10px]">
            <p>
              <strong>Goal:</strong> This tool helps you examine ARC-AGI puzzles to understand how they work, 
              rather than trying to solve them yourself, but if you want to do that, visit <Link href="https://human-arc.gptpluspro.com/assessment">Puzzle Browser</Link>.
            </p>
            
            <p>
              <strong>AI Analysis:</strong> Click "Examine" on any puzzle to see the correct answers (from the .json file) and
              have the AI try (and often fail!) to explain the logic behind the puzzle.
            </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
