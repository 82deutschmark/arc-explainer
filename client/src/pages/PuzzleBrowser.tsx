/**
 * Author: gpt-5-codex
 * Date: 2025-10-31  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Restores the ARC puzzle browser hero and knowledge hub while tightening neutral spacing around filters and results.
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
      <div className="min-h-screen w-full bg-slate-100">
        <div className="flex w-full flex-col space-y-3 px-3 py-8 sm:px-5 lg:px-8 xl:px-10">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100">
      <div className="flex min-h-screen w-full flex-col gap-8 pb-12">

        <header className="space-y-6 px-3 pt-8 sm:px-5 lg:px-8 xl:px-10">
          {/* Top decorative corner mosaics */}
          <div className="flex items-start justify-between">
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

          <div className="flex w-full flex-col items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <EmojiMosaicAccent variant="rainbow" size="md" framed className="drop-shadow" />
              <div className="text-center sm:text-left">
                <h1 className="text-4xl font-extrabold text-slate-900">
                  ARC-AGI Puzzle Explorer
                </h1>
                <p className="mt-1 text-base font-medium text-slate-800">
                  Navigate the ARC datasets with streamlined filters and curated research links.
                </p>
              </div>
              <EmojiMosaicAccent variant="rainbow" size="md" framed className="drop-shadow" />
            </div>

            <CollapsibleMission />
          </div>

          <div className="mt-6">
            <div className="card border-0 bg-white shadow-[0_28px_60px_-40px_rgba(15,23,42,0.55)]">
              <div className="card-body space-y-4 px-6 py-6">
                <div className="flex flex-wrap items-center justify-center gap-4 text-center">
                  <EmojiMosaicAccent variant="datasetSignal" size="sm" framed />
                  <Sparkles className="h-4 w-4 text-slate-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    ARC-AGI Knowledge Hub
                  </h3>
                  <Sparkles className="h-4 w-4 text-slate-600" />
                  <EmojiMosaicAccent variant="analysisSignal" size="sm" framed />
                </div>

                <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-5 text-xs shadow-sm transition-all hover:-translate-y-1.5 hover:border-blue-500 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <EmojiMosaicAccent variant="statusExplained" size="xs" framed={false} />
                      <p className="font-bold text-slate-900 uppercase tracking-wide">Research Papers</p>
                    </div>
                    <a
                      href="https://www.arxiv.org/pdf/2505.11831"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm justify-between gap-3 border-2 border-blue-500 bg-white text-blue-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:text-white"
                    >
                      ARC-AGI-2 Technical Report
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-5 text-xs shadow-sm transition-all hover:-translate-y-1.5 hover:border-blue-500 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <EmojiMosaicAccent variant="sizeSignal" size="xs" framed={false} />
                      <p className="font-bold text-slate-900 uppercase tracking-wide">Data Sources</p>
                    </div>
                    <div className="mt-1 space-y-2">
                      <a
                        href="https://huggingface.co/arcprize"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-blue-500 bg-white text-blue-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:text-white"
                      >
                        HuggingFace Datasets
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://github.com/fchollet/ARC-AGI"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-blue-500 bg-white text-blue-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:text-white"
                      >
                        Official Repository
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-5 text-xs shadow-sm transition-all hover:-translate-y-1.5 hover:border-emerald-500 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <EmojiMosaicAccent variant="searchSignal" size="xs" framed={false} />
                      <p className="font-bold text-slate-900 uppercase tracking-wide">Top Solutions</p>
                    </div>
                    <div className="mt-1 space-y-2">
                      <a
                        href="https://github.com/zoecarver"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-emerald-500 bg-white text-emerald-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:text-white"
                      >
                        zoecarver's approach
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://github.com/jerber"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-emerald-500 bg-white text-emerald-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:text-white"
                      >
                        jerber's solutions
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://github.com/epang080516/arc_agi"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-emerald-500 bg-white text-emerald-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:text-white"
                      >
                        Eric Pang's SOTA solution
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-5 text-xs shadow-sm transition-all hover:-translate-y-1.5 hover:border-orange-500 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <EmojiMosaicAccent variant="statusUnexplained" size="xs" framed={false} />
                      <p className="font-bold text-slate-900 uppercase tracking-wide">Community Knowledge</p>
                    </div>
                    <div className="mt-1 space-y-2">
                      <a
                        href="https://github.com/google/ARC-GEN/blob/main/task_list.py#L422"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-orange-500 bg-white text-orange-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white"
                      >
                        Puzzle nomenclature
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://github.com/neoneye/arc-notes"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-orange-500 bg-white text-orange-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white"
                      >
                        ARC notes
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm justify-between gap-3 border-2 border-orange-500 bg-white text-orange-700 font-semibold transition-all hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white"
                      >
                        Abstraction dataset
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 text-center">
                  <EmojiMosaicAccent variant="heroTwilight" size="xs" framed={false} />
                  <p className="text-xs font-medium text-slate-700">
                    <strong>Special thanks to Simon Strandgaard (@neoneye)</strong> for his insights, support, and encouragement.
                  </p>
                  <EmojiMosaicAccent variant="heroSunrise" size="xs" framed={false} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}

        <div className="card border-0 bg-white shadow-[0_26px_60px_-40px_rgba(15,23,42,0.55)] px-3 sm:px-5 lg:px-8 xl:px-10">
          <div className="card-body px-0 py-4">
            <div className="flex flex-wrap items-end justify-center gap-4">
              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <label htmlFor="puzzleSearch" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Search by Puzzle ID</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input input-md input-bordered w-64 border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="btn btn-md bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 border-0 text-white font-semibold shadow-lg hover:from-sky-600 hover:via-cyan-600 hover:to-emerald-600"
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
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <label htmlFor="maxGridSize" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Max Grid Size</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                <div className="flex flex-col gap-2 min-w-[170px]">
                  <label htmlFor="explanationFilter" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Explanation Status</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={explanationFilter}
                    onChange={(e) => setExplanationFilter(e.target.value)}
                  >
                    <option value="all">All puzzles</option>
                    <option value="unexplained">Unexplained only</option>
                    <option value="explained">Explained only</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  <label htmlFor="gridConsistent" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Grid Consistency</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={gridSizeConsistent}
                    onChange={(e) => setGridSizeConsistent(e.target.value)}
                  >
                    <option value="any">Any consistency</option>
                    <option value="true">Consistent size only</option>
                    <option value="false">Variable size only</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  <label htmlFor="arcVersion" className="text-xs font-bold text-slate-900 uppercase tracking-wide">ARC Version</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                <div className="flex flex-col gap-2 min-w-[190px]">
                  <label htmlFor="multiTestFilter" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Test Cases</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={multiTestFilter}
                    onChange={(e) => setMultiTestFilter(e.target.value)}
                  >
                    <option value="any">Any number of test cases</option>
                    <option value="single">Single test case</option>
                    <option value="multi">Multiple test cases</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 min-w-[210px]">
                  <label htmlFor="sortBy" className="text-xs font-bold text-slate-900 uppercase tracking-wide">Sort By</label>
                  <select
                    className="select select-md select-bordered w-full border-2 border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 pt-3 text-[10px]">
              <span className="text-sm font-bold text-slate-900">Active Filters:</span>
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
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${ item.active ? 'border-blue-600 bg-blue-100 text-blue-900 shadow-md' : 'border-slate-300 bg-slate-50 text-slate-500' }`}
                >
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Results */}
        <div className="card w-full border-0 bg-white shadow-[0_32px_70px_-45px_rgba(15,23,42,0.6)] px-3 sm:px-5 lg:px-8 xl:px-10">
          <div className="card-body px-0 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-slate-800">
              <h2 className="text-lg font-semibold">Puzzle Results</h2>
              {!isLoading && (
                <div className="badge badge-md border-0 bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow">
                  {filteredPuzzles.length} found
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="py-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading puzzles...</p>
              </div>
            ) : filteredPuzzles.length === 0 ? (
              <div className="py-6 text-center">
                <Grid3X3 className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600">No puzzles match your current filters.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="card w-full border-0 bg-white shadow-[0_26px_60px_-45px_rgba(15,23,42,0.55)] px-3 sm:px-5 lg:px-8 xl:px-10">
          <div className="card-body px-0 py-5">
            <h2 className="card-title mb-2 text-base">How to Use</h2>
            <div className="space-y-2 text-xs leading-relaxed text-slate-700">
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
