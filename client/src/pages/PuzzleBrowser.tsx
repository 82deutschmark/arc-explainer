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
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 lg:px-6">
        {/* Hero Section - Tight, professional layout */}
        <header className="rounded-xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
          <div className="grid gap-4 px-6 py-4 sm:gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puzzle Browser</div>
              <h1 className="text-3xl font-semibold text-slate-900">ARC-AGI Puzzle Explorer</h1>
              <p className="text-sm text-slate-600">
                Search, triage, and examine ARC tasks with the latest model analysis. Built for focused research workflows.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Search by Puzzle ID</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="input input-bordered w-full"
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
                  className="btn btn-neutral whitespace-nowrap"
                  type="button"
                  onClick={handleSearch}
                >
                  Open Puzzle
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80">
            {statsLoading ? (
              <div className="px-6 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-lg bg-slate-200/60" />
                  ))}
                </div>
                <div className="mt-3 h-24 animate-pulse rounded-lg bg-slate-200/60" />
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
                  <div className="rounded-lg border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total puzzles</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{puzzleStatsSummary.totalPuzzles.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500">Across {datasetBreakdownEntries.length} datasets</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analyzed coverage</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{analyzedCoveragePercent.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-slate-500">{puzzleStatsSummary.analyzedPuzzles.toLocaleString()} puzzles with explanations</p>
                    <progress className="progress progress-primary mt-3 h-2 w-full" value={analyzedCoveragePercent} max={100} />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analysis backlog</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{puzzleStatsSummary.backlogPuzzles.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500">Puzzles still awaiting analysis</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Community acknowledgement */}
        <section className="rounded-xl border border-slate-200 bg-white/90 px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community Support</p>
              <h2 className="text-xl font-semibold text-slate-900">Built with ARC Resources</h2>
              <p className="text-sm text-slate-600 max-w-2xl">
                Special thanks to Simon Strandgaard (@neoneye) for curating and maintaining the comprehensive ARC knowledge base that powers this explorer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/neoneye/arc-notes"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline gap-2"
              >
                <Database className="h-4 w-4" />
                ARC Notes
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/neoneye/arc-dataset-collection"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline gap-2"
              >
                <Trophy className="h-4 w-4" />
                Dataset Collection
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Knowledge hub */}
        <section className="rounded-xl border border-slate-200 bg-white/80 shadow-sm">
          <div className="flex items-center justify-between px-6 py-3.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference Library</p>
              <h3 className="text-lg font-semibold text-slate-900">ARC-AGI Knowledge Hub</h3>
            </div>
            <Sparkles className="h-5 w-5 text-slate-400" />
          </div>
          <div className="grid gap-px border-t border-slate-200 bg-slate-100 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 bg-white px-6 py-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Cpu className="h-4 w-4 text-slate-500" />
                <span className="font-medium">Research Papers</span>
              </div>
              <a
                href="https://www.arxiv.org/pdf/2505.11831"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
              >
                ARC2 Technical Report
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2 bg-white px-6 py-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Database className="h-4 w-4 text-slate-500" />
                <span className="font-medium">Data Sources</span>
              </div>
              <div className="space-y-1">
                <a
                  href="https://huggingface.co/arcprize"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  HuggingFace Datasets
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/fchollet/ARC-AGI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Official Repository
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="space-y-2 bg-white px-6 py-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Trophy className="h-4 w-4 text-slate-500" />
                <span className="font-medium">Top Solutions</span>
              </div>
              <div className="space-y-1">
                <a
                  href="https://github.com/zoecarver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  zoecarver's Approach
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/jerber"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  jerber's Solutions
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/epang080516/arc_agi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  epang080516's Code
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="space-y-2 bg-white px-6 py-4">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4 text-slate-500" />
                <span className="font-medium">Community Signals</span>
              </div>
              <div className="space-y-1 text-slate-700">
                <button
                  className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50"
                  onClick={() => setIsOpen(!isOpen)}
                  type="button"
                >
                  <span>
                    Critical ARC-AGI-2 Research
                    <span className="block text-[11px] font-normal text-slate-500">cristianoc</span>
                  </span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
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
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
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
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Puzzle Nomenclature
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://github.com/neoneye/arc-notes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline"
                >
                  ARC Resources
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Filters - Collapsible */}
        <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-slate-500" />
              <span className="font-semibold text-slate-900">Advanced Filters</span>
              <span className="text-sm text-slate-500">({Object.keys(filters).length > 0 ? 'Active' : 'None'})</span>
            </div>
            <span className="text-slate-400">{filtersOpen ? '−' : '+'}</span>
          </button>

          {filtersOpen && (
            <div className="border-t border-slate-200 px-5 pb-5">
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-3">
                <div className="space-y-1.5">
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
                
                <div className="space-y-1.5">
                  <label htmlFor="explanationFilter" className="label">Explanation Status</label>
                  <select className="select select-bordered w-full" value={explanationFilter} onChange={(e) => setExplanationFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="unexplained">Unexplained Only</option>
                    <option value="explained">Explained Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="namedFilter" className="label">Puzzle Names</label>
                  <select className="select select-bordered w-full" value={namedFilter} onChange={(e) => setNamedFilter(e.target.value)}>
                    <option value="all">All Puzzles</option>
                    <option value="named">Named Only (400 puzzles)</option>
                    <option value="unnamed">Unnamed Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="gridConsistent" className="label">Grid Size Consistency</label>
                  <select className="select select-bordered w-full" value={gridSizeConsistent} onChange={(e) => setGridSizeConsistent(e.target.value)}>
                    <option value="any">Any consistency</option>
                    <option value="true">Consistent size only</option>
                    <option value="false">Variable size only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
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
                
                <div className="space-y-1.5">
                  <label htmlFor="multiTestFilter" className="label">Test Cases</label>
                  <select className="select select-bordered w-full" value={multiTestFilter} onChange={(e) => setMultiTestFilter(e.target.value)}>
                    <option value="any">Any number of test cases</option>
                    <option value="single">Single test case (1 output required)</option>
                    <option value="multi">Multiple test cases (2+ outputs required)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
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
        <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div>
            <h2 className="mb-3.5 text-xl font-semibold text-slate-900">
              Puzzles
              {!isLoading && (
                <div className="badge badge-outline ml-2 border-slate-300 text-slate-700">
                  {filteredPuzzles.length} found
                </div>
              )}
            </h2>
            <p className="text-sm text-slate-600">
              Puzzles available for examination
            </p>
            {isLoading ? (
              <div className="py-7 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3.5" />
                <p>Loading puzzles...</p>
              </div>
            ) : filteredPuzzles.length === 0 ? (
              <div className="py-7 text-center">
                <Grid3X3 className="mx-auto mb-3.5 h-12 w-12 text-slate-400" />
                <p className="text-slate-600">No puzzles match your current filters.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
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
