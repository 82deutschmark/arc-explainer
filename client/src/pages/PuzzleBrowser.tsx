/**
 * Author: gpt-5-codex
 * Date: 2025-02-03  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Professionalizes the ARC Puzzle Browser layout while reusing existing
 *          puzzle filtering/search logic for a research-focused presentation.
 *          Integrates with the existing hooks (usePuzzleList, useModels) and
 *          retains DaisyUI components for consistency.
 * SRP/DRY check: Pass — Verified puzzle list filtering and navigation remain unchanged after UI updates.
 * DaisyUI: Pass - Continues using DaisyUI buttons and form controls.
 */
import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { usePuzzleStats } from '@/hooks/usePuzzleStats';
import { Loader2, Grid3X3, Sparkles, Cpu, Database, Trophy, User, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import type { PuzzleMetadata } from '@shared/types';
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
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
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
  const { summary: puzzleStatsSummary, isLoading: statsLoading, error: statsError } = usePuzzleStats();
  const datasetBreakdownEntries = React.useMemo(
    () =>
      Object.entries(puzzleStatsSummary.datasetBreakdown).sort(([, a], [, b]) => {
        return b.total - a.total;
      }),
    [puzzleStatsSummary.datasetBreakdown]
  );
  const analyzedCoveragePercent = React.useMemo(
    () => Math.min(Math.max(puzzleStatsSummary.analyzedCoverage * 100, 0), 100),
    [puzzleStatsSummary.analyzedCoverage]
  );
  
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
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 lg:px-6">
        {/* Hero Section - Colorful and vibrant layout */}
        <header className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-white via-blue-50/80 to-indigo-100/60 shadow-lg backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-indigo-400/10"></div>
          <div className="relative grid gap-4 px-6 py-6 sm:gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                <Sparkles className="h-3 w-3" />
                Puzzle Browser
              </div>
              <h1 className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-4xl font-bold text-transparent">ARC-AGI Puzzle Explorer</h1>
              <p className="text-base text-slate-700">
                Search, triage, and examine ARC tasks with the latest model analysis. Built for focused research workflows.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Search by Puzzle ID</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="input input-bordered w-full border-indigo-200 bg-white/80 focus:border-purple-400 focus:ring-purple-400"
                  placeholder="e.g. 1ae2feb7"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <button
                  className="btn bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
                  type="button"
                  onClick={handleSearch}
                >
                  Open Puzzle
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-indigo-200/50 bg-gradient-to-r from-slate-50/60 via-blue-50/40 to-indigo-50/60">
            {statsLoading ? (
              <div className="px-6 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-lg bg-gradient-to-r from-slate-200/60 to-slate-300/60" />
                  ))}
                </div>
                <div className="mt-3 h-24 animate-pulse rounded-lg bg-gradient-to-r from-slate-200/60 to-slate-300/60" />
              </div>
            ) : statsError ? (
              <div className="px-6 py-4">
                <div role="alert" className="alert alert-error">
                  <span>Unable to load global puzzle statistics. Please refresh and try again.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 px-6 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total puzzles</p>
                    <p className="mt-2 text-2xl font-bold text-blue-900">{puzzleStatsSummary.totalPuzzles.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-blue-700">Across {datasetBreakdownEntries.length} datasets</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Analyzed coverage</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-900">{analyzedCoveragePercent.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-emerald-700">{puzzleStatsSummary.analyzedPuzzles.toLocaleString()} puzzles with explanations</p>
                    <progress className="progress progress-success mt-3 h-2 w-full" value={analyzedCoveragePercent} max={100} />
                  </div>
                  <div className="rounded-xl border border-orange-200/50 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Analysis backlog</p>
                    <p className="mt-2 text-2xl font-bold text-orange-900">{puzzleStatsSummary.backlogPuzzles.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-orange-700">Puzzles still awaiting analysis</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Community acknowledgement */}
        <section className="relative overflow-hidden rounded-2xl border border-purple-200/50 bg-gradient-to-br from-white via-purple-50/60 to-pink-50/40 px-6 py-5 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/5 via-pink-400/5 to-indigo-400/5"></div>
          <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Community Support</p>
              <h2 className="text-xl font-bold text-purple-900">Built with ARC Resources</h2>
              <p className="text-sm text-purple-700 max-w-2xl">
                Special thanks to Simon Strandgaard (@neoneye) for curating and maintaining the comprehensive ARC knowledge base that powers this explorer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/neoneye/arc-notes"
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 gap-2"
              >
                <Database className="h-4 w-4" />
                ARC Notes
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/neoneye/arc-dataset-collection"
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 gap-2"
              >
                <Trophy className="h-4 w-4" />
                Dataset Collection
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Knowledge hub */}
        <section className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-white via-indigo-50/60 to-blue-50/40 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/5 via-blue-400/5 to-purple-400/5"></div>
          <div className="relative flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Reference Library</p>
              <h3 className="text-lg font-bold text-indigo-900">ARC-AGI Knowledge Hub</h3>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="grid gap-px border-t border-indigo-200/50 bg-indigo-100/50 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 px-6 py-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Cpu className="h-4 w-4 text-blue-600" />
                <span className="font-semibold">Research Papers</span>
              </div>
              <a
                href="https://www.arxiv.org/pdf/2505.11831"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-800 hover:text-blue-900 hover:underline transition-colors"
              >
                ARC2 Technical Report
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2 bg-gradient-to-br from-emerald-50/80 to-green-50/60 px-6 py-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Database className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold">Data Sources</span>
              </div>
              <div className="space-y-1">
                <a
                  href="https://huggingface.co/arcprize"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-800 hover:text-emerald-900 hover:underline transition-colors"
                >
                  HuggingFace Datasets
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/fchollet/ARC-AGI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-800 hover:text-emerald-900 hover:underline transition-colors"
                >
                  Official Repository
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="space-y-2 bg-gradient-to-br from-orange-50/80 to-amber-50/60 px-6 py-4">
              <div className="flex items-center gap-2 text-orange-700">
                <Trophy className="h-4 w-4 text-orange-600" />
                <span className="font-semibold">Top Solutions</span>
              </div>
              <div className="space-y-1">
                <a
                  href="https://github.com/zoecarver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-800 hover:text-orange-900 hover:underline transition-colors"
                >
                  zoecarver's Approach
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/jerber"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-800 hover:text-orange-900 hover:underline transition-colors"
                >
                  jerber's Solutions
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/epang080516/arc_agi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-800 hover:text-orange-900 hover:underline transition-colors"
                >
                  epang080516's Code
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="space-y-2 bg-gradient-to-br from-purple-50/80 to-pink-50/60 px-6 py-4">
              <div className="flex items-center gap-2 text-purple-700">
                <User className="h-4 w-4 text-purple-600" />
                <span className="font-semibold">Community Signals</span>
              </div>
              <div className="space-y-1 text-purple-800">
                <button
                  className="flex w-full items-center justify-between rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2 text-left text-xs font-medium hover:bg-purple-100/70 transition-colors"
                  onClick={() => setIsOpen(!isOpen)}
                  type="button"
                >
                  <span>
                    Critical ARC-AGI-2 Research
                    <span className="block text-[11px] font-normal text-purple-600">cristianoc</span>
                  </span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-purple-500" /> : <ChevronDown className="h-4 w-4 text-purple-500" />}
                </button>
                {isOpen && (
                  <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-3 text-[11px] text-purple-700">
                    <p>Analysis of 111 ARC-AGI-2 tasks reveals composition patterns:</p>
                    <div className="grid grid-cols-2 gap-1">
                      <p>• 40% sequential composition</p>
                      <p>• 30% conditional branching</p>
                      <p>• 20% pattern classification</p>
                      <p>• 25% iteration/loops</p>
                      <p>• 15% nested structures</p>
                      <p>• 10% parallel composition</p>
                      <p>• 5% graph/DAG structures</p>
                    </div>
                    <a
                      href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-800 hover:text-purple-900 hover:underline transition-colors"
                    >
                      View cristianoc's research
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                <a
                  href="https://github.com/google/ARC-GEN/blob/main/task_list.py#L422"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-800 hover:text-purple-900 hover:underline transition-colors"
                >
                  Puzzle Nomenclature
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/neoneye/arc-notes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-800 hover:text-purple-900 hover:underline transition-colors"
                >
                  ARC Resources
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Filters - Collapsible */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-white via-emerald-50/60 to-green-50/40 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-green-400/5 to-teal-400/5"></div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="relative flex w-full items-center justify-between px-6 py-4 transition-all duration-200 hover:bg-emerald-50/70"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 p-2">
                <Grid3X3 className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-emerald-900">Advanced Filters</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                {Object.keys(filters).length > 0 ? 'Active' : 'None'}
              </span>
            </div>
            <span className="text-emerald-600 transition-transform duration-200">
              {filtersOpen ? '−' : '+'}
            </span>
          </button>

          {filtersOpen && (
            <div className="border-t border-emerald-200/50 px-6 pb-6 bg-gradient-to-br from-emerald-50/30 to-green-50/20">
              <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="maxGridSize" className="text-sm font-semibold text-emerald-800">Maximum Grid Size</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={maxGridSize} onChange={(e) => setMaxGridSize(e.target.value)}>
                    <option value="any">Any Size</option>
                    <option value="5">5×5 (Very Small)</option>
                    <option value="10">10×10 (Small)</option>
                    <option value="15">15×15 (Medium)</option>
                    <option value="20">20×20 (Large)</option>
                    <option value="30">30×30 (Very Large)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="explanationFilter" className="text-sm font-semibold text-emerald-800">Explanation Status</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={explanationFilter} onChange={(e) => setExplanationFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="unexplained">Unexplained Only</option>
                    <option value="explained">Explained Only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="namedFilter" className="text-sm font-semibold text-emerald-800">Puzzle Names</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={namedFilter} onChange={(e) => setNamedFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="named">Named Only (400 puzzles)</option>
                    <option value="unnamed">Unnamed Only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="gridConsistent" className="text-sm font-semibold text-emerald-800">Grid Size Consistency</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={gridSizeConsistent} onChange={(e) => setGridSizeConsistent(e.target.value)}>
                    <option value="any">Any consistency</option>
                    <option value="true">Consistent size only</option>
                    <option value="false">Variable size only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="arcVersion" className="text-sm font-semibold text-emerald-800">ARC Version</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={arcVersion} onChange={(e) => setArcVersion(e.target.value)}>
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
                  <label htmlFor="multiTestFilter" className="text-sm font-semibold text-emerald-800">Test Cases</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={multiTestFilter} onChange={(e) => setMultiTestFilter(e.target.value)}>
                    <option value="any">Any number of test cases</option>
                    <option value="single">Single test case (1 output required)</option>
                    <option value="multi">Multiple test cases (2+ outputs required)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sortBy" className="text-sm font-semibold text-emerald-800">Sort By</label>
                  <select className="select select-bordered w-full border-emerald-200 bg-white/80 focus:border-emerald-400 focus:ring-emerald-400" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
        <div className="relative overflow-hidden rounded-2xl border border-rose-200/50 bg-gradient-to-br from-white via-rose-50/60 to-pink-50/40 p-6 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-400/5 via-pink-400/5 to-purple-400/5"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 p-2">
                <Grid3X3 className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-rose-900">
                Puzzles
                {!isLoading && (
                  <span className="ml-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700">
                    {filteredPuzzles.length} found
                  </span>
                )}
              </h2>
            </div>
            <p className="text-base text-rose-700 mb-6">
              Puzzles available for examination
            </p>
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-rose-500" />
                <p className="text-rose-700">Loading puzzles...</p>
              </div>
            ) : filteredPuzzles.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 p-4 w-fit">
                  <Grid3X3 className="h-12 w-12 text-rose-400" />
                </div>
                <p className="text-rose-600 text-lg font-medium">No puzzles match your current filters.</p>
                <p className="mt-2 text-sm text-rose-500">
                  Try adjusting your filters above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      </main>
    </div>
  );
}
