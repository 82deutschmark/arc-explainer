/**
 * Author: gpt-5-codex
 * Date: 2025-02-15
 * PURPOSE: Restores the research-focused Puzzle Browser layout with muted slate styling, compact filters, and plain-text resource references.
 * SRP/DRY check: Pass - Verified filter logic, navigation, and rendering after UI refinements.
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
      <div className="min-h-screen w-full bg-slate-950 text-slate-100">
        <div className="flex w-full flex-col gap-4 py-10">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 px-1.5">
      <div className="flex min-h-screen w-full flex-col gap-2 pb-5 pt-3">

        <header className="w-full space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Research Overview</p>
              <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
                ARC-AGI Puzzle Explorer
              </h1>
            </div>
            <EmojiMosaicAccent
              pattern={HERO_STREAMER_PATTERN}
              columns={10}
              maxColumns={10}
              size="sm"
              framed
              className="self-start opacity-70"
            />
          </div>

          <div>
            <CollapsibleMission />
          </div>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <Sparkles className="h-4 w-4 text-slate-300" />
              <span>Reference material</span>
            </div>

            <div className="mt-2 grid gap-3 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Research Papers</p>
                <ul className="space-y-0.5">
                  <li>
                    <a
                      href="https://www.arxiv.org/pdf/2505.11831"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      ARC-AGI-2 Technical Report
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data Sources</p>
                <ul className="space-y-0.5">
                  <li>
                    <a
                      href="https://huggingface.co/arcprize"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      HuggingFace datasets
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/fchollet/ARC-AGI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      Official repository
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Solution References</p>
                <ul className="space-y-0.5">
                  <li>
                    <a
                      href="https://github.com/zoecarver"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      zoecarver's approach
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/jerber"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      jerber's solutions
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/epang080516/arc_agi"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      Eric Pang's SOTA solution
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Community Notes</p>
                <ul className="space-y-0.5">
                  <li>
                    <a
                      href="https://github.com/google/ARC-GEN/blob/main/task_list.py#L422"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      Puzzle nomenclature
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://cdg.openai.nl/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      Synthetic Data
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/neoneye/arc-notes"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      ARC notes by @neoneye
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-slate-200 hover:text-sky-300"
                    >
                      Abstraction dataset
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-300" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Special Acknowledgement: Simon Strandgaard (@neoneye) for his invaluable support, feedback, and collection of resources.
            </p>
          </section>
        </header>

        {/* Filters */}

        <section className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="maxGridSize" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Max Grid Size</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

            <div className="flex flex-col gap-1">
              <label htmlFor="explanationFilter" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Explanation Status</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={explanationFilter}
                onChange={(e) => setExplanationFilter(e.target.value)}
              >
                <option value="all">All puzzles</option>
                <option value="unexplained">Unexplained only</option>
                <option value="explained">Explained only</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="gridConsistent" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Grid Consistency</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={gridSizeConsistent}
                onChange={(e) => setGridSizeConsistent(e.target.value)}
              >
                <option value="any">Any consistency</option>
                <option value="true">Consistent size only</option>
                <option value="false">Variable size only</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="arcVersion" className="text-xs font-semibold uppercase tracking-wide text-slate-400">ARC Version</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

            <div className="flex flex-col gap-1">
              <label htmlFor="multiTestFilter" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Test Cases</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={multiTestFilter}
                onChange={(e) => setMultiTestFilter(e.target.value)}
              >
                <option value="any">Any number of test cases</option>
                <option value="single">Single test case</option>
                <option value="multi">Multiple test cases</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="sortBy" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sort By</label>
              <select
                className="select select-sm select-bordered w-full border border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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

          <div className="mt-2 flex flex-col gap-2 border-t border-slate-800 pt-2 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Active filters</span>
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
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-colors ${item.active ? 'border-sky-500 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-500'}`}
                >
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <label htmlFor="puzzleSearch" className="font-semibold uppercase tracking-wide">Direct ID lookup</label>
              <input
                className="input input-xs input-bordered w-48 border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                id="puzzleSearch"
                placeholder="e.g. 1ae2feb7"
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
                className="btn btn-xs border border-slate-600 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-sky-300"
                onClick={handleSearch}
              >
                Go
              </button>
              {searchError && (
                <span className="text-[10px] font-semibold text-rose-400">{searchError}</span>
              )}
            </div>
          </div>
        </section>
        {/* Results */}
        <section className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-slate-200">
            <h2 className="text-base font-semibold uppercase tracking-wide text-slate-300">Puzzle results</h2>
            {!isLoading && (
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                {filteredPuzzles.length} found
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="py-6 text-center text-slate-400">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              <p className="text-xs">Loading puzzles…</p>
            </div>
          ) : filteredPuzzles.length === 0 ? (
            <div className="py-6 text-center text-slate-400">
              <Grid3X3 className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-300">No puzzles match the current filters.</p>
              <p className="mt-1 text-xs text-slate-500">Adjust the criteria to broaden the search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredPuzzles.map((puzzle: EnhancedPuzzleMetadata) => (
                <PuzzleCard
                  key={puzzle.id}
                  puzzle={puzzle}
                  showGridPreview={true}
                />
              ))}
            </div>
          )}
        </section>
        {/* Instructions */}
        <section className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Working notes</h2>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
            <p>
              <strong className="text-slate-200">Goal:</strong> Use the browser to study puzzle structure, metadata, and historical attempts. For hands-on solving, pivot to the dedicated human challenge interface at{' '}
              <Link href="https://human-arc.gptpluspro.com/assessment" className="text-sky-300 hover:text-sky-200">Puzzle Browser</Link>.
            </p>

            <p>
              <strong className="text-slate-200">AI Analysis:</strong> Selecting “Examine” on any puzzle surfaces the canonical answers and current explanation attempts. Expect gaps—flag them for follow-up rather than assuming correctness.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
