/**
 * Author: gpt-5-codex
 * Date: 2025-10-31  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Presents the ARC puzzle browser with neutral, information-dense layout, compact filters, and PuzzleCard integration.
 * SRP/DRY check: Pass - Verified filter logic and listing rendering after UI cleanup.
 */
import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { Loader2, Grid3X3, ExternalLink } from 'lucide-react';
import type { PuzzleMetadata } from '@shared/types';
import { CollapsibleMission } from '@/components/ui/collapsible-mission';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';

const QUICK_REFERENCE_SECTIONS = [
  {
    title: 'Research',
    items: [
      {
        label: 'ARC-AGI-2 Technical Report',
        href: 'https://www.arxiv.org/pdf/2505.11831',
      },
    ],
  },
  {
    title: 'Datasets',
    items: [
      {
        label: 'HuggingFace Collections',
        href: 'https://huggingface.co/arcprize',
      },
      {
        label: 'Official Repository',
        href: 'https://github.com/fchollet/ARC-AGI',
      },
    ],
  },
  {
    title: 'Community',
    items: [
      {
        label: "zoecarver's approach",
        href: 'https://github.com/zoecarver',
      },
      {
        label: "jerber's solutions",
        href: 'https://github.com/jerber',
      },
      {
        label: "Eric Pang's SOTA kit",
        href: 'https://github.com/epang080516/arc_agi',
      },
      {
        label: 'ARC research notes',
        href: 'https://github.com/neoneye/arc-notes',
      },
      {
        label: 'Puzzle nomenclature',
        href: 'https://github.com/google/ARC-GEN/blob/main/task_list.py#L422',
      },
      {
        label: 'Abstraction dataset',
        href: 'https://github.com/cristianoc/arc-agi-2-abstraction-dataset',
      },
    ],
  },
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
  const [explanationFilter, setExplanationFilter] = useState<string>('unexplained');
  const [arcVersion, setArcVersion] = useState<string>('any');
  const [multiTestFilter, setMultiTestFilter] = useState<string>('single');
  const [sortBy, setSortBy] = useState<string>('unexplained_first');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    document.title = 'ARC Puzzle Browser';
  }, []);

  const filters = React.useMemo(() => {
    const result: Record<string, unknown> = {};
    if (maxGridSize && maxGridSize !== 'any') result.maxGridSize = parseInt(maxGridSize, 10);
    if (gridSizeConsistent === 'true') result.gridSizeConsistent = true;
    if (gridSizeConsistent === 'false') result.gridSizeConsistent = false;
    if (
      arcVersion === 'ARC1' ||
      arcVersion === 'ARC1-Eval' ||
      arcVersion === 'ARC2' ||
      arcVersion === 'ARC2-Eval' ||
      arcVersion === 'ARC-Heavy' ||
      arcVersion === 'ConceptARC'
    ) {
      result.source = arcVersion;
    }
    if (multiTestFilter === 'single') result.multiTestFilter = 'single';
    if (multiTestFilter === 'multi') result.multiTestFilter = 'multi';
    return result;
  }, [maxGridSize, gridSizeConsistent, arcVersion, multiTestFilter]);

  const { puzzles, isLoading, error } = usePuzzleList(filters);

  const filteredPuzzles = React.useMemo(() => {
    let filtered = (puzzles || []) as unknown as EnhancedPuzzleMetadata[];

    if (searchQuery.trim()) {
      const normalized = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((puzzle) => puzzle.id.toLowerCase().includes(normalized));
    }

    if (explanationFilter === 'unexplained') {
      filtered = filtered.filter((puzzle) => !puzzle.hasExplanation);
    } else if (explanationFilter === 'explained') {
      filtered = filtered.filter((puzzle) => puzzle.hasExplanation);
    }

    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'unexplained_first': {
            const aHasExplanation = a.hasExplanation ? 1 : 0;
            const bHasExplanation = b.hasExplanation ? 1 : 0;
            if (aHasExplanation !== bHasExplanation) {
              return aHasExplanation - bHasExplanation;
            }
            return a.id.localeCompare(b.id);
          }
          case 'processing_time': {
            const aTime = a.apiProcessingTimeMs || 0;
            const bTime = b.apiProcessingTimeMs || 0;
            return bTime - aTime;
          }
          case 'confidence': {
            const aConf = a.confidence || 0;
            const bConf = b.confidence || 0;
            return bConf - aConf;
          }
          case 'cost': {
            const aCost = a.estimatedCost || 0;
            const bCost = b.estimatedCost || 0;
            return bCost - aCost;
          }
          case 'created_at': {
            const aDate = a.createdAt || '1970-01-01';
            const bDate = b.createdAt || '1970-01-01';
            return bDate.localeCompare(aDate);
          }
          case 'least_analysis_data': {
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
          }
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [puzzles, explanationFilter, sortBy, searchQuery]);

  const totalPuzzles = React.useMemo(
    () => ((puzzles || []) as unknown as EnhancedPuzzleMetadata[]).length,
    [puzzles],
  );

  const explainedCount = React.useMemo(() => {
    const list = (puzzles || []) as unknown as EnhancedPuzzleMetadata[];
    return list.filter((puzzle) => puzzle.hasExplanation).length;
  }, [puzzles]);

  const unexplainedCount = React.useMemo(() => {
    const list = (puzzles || []) as unknown as EnhancedPuzzleMetadata[];
    return list.filter((puzzle) => !puzzle.hasExplanation).length;
  }, [puzzles]);

  const summaryCards = React.useMemo(
    () => [
      { label: 'Total puzzles', value: totalPuzzles.toLocaleString() },
      { label: 'Explained', value: explainedCount.toLocaleString() },
      { label: 'Unexplained', value: unexplainedCount.toLocaleString() },
      { label: 'Visible now', value: filteredPuzzles.length.toLocaleString() },
    ],
    [totalPuzzles, explainedCount, unexplainedCount, filteredPuzzles.length],
  );

  const activeFilters = React.useMemo(
    () => [
      { id: 'search', label: 'Search', active: searchQuery.trim().length > 0 },
      { id: 'maxGridSize', label: 'Max grid', active: maxGridSize !== 'any' },
      { id: 'gridSizeConsistent', label: 'Consistency', active: gridSizeConsistent !== 'any' },
      { id: 'explanationFilter', label: 'Explanation', active: explanationFilter !== 'unexplained' },
      { id: 'arcVersion', label: 'ARC version', active: arcVersion !== 'any' },
      { id: 'multiTestFilter', label: 'Test cases', active: multiTestFilter !== 'single' },
      { id: 'sortBy', label: 'Sort', active: sortBy !== 'unexplained_first' },
    ],
    [
      searchQuery,
      maxGridSize,
      gridSizeConsistent,
      explanationFilter,
      arcVersion,
      multiTestFilter,
      sortBy,
    ],
  );

  const handleSearch = useCallback(() => {
    if (filteredPuzzles.length === 1 && searchQuery.trim() === filteredPuzzles[0].id) {
      setLocation(`/puzzle/${filteredPuzzles[0].id}`);
    } else if (searchQuery.trim().length > 0 && filteredPuzzles.length === 0) {
      const potentialPuzzleId = searchQuery.trim();
      if (potentialPuzzleId.length > 5 && !potentialPuzzleId.includes(' ')) {
        setLocation(`/puzzle/${potentialPuzzleId}`);
      }
    }
  }, [searchQuery, filteredPuzzles, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-slate-100 text-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col space-y-3 px-4 py-10 sm:px-6 lg:px-8">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <header className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browser Overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">ARC-AGI Puzzle Explorer</h1>
            <p className="mt-3 text-sm text-slate-600">
              Navigate ARC datasets with compact filters, real puzzle counts, and research links curated for fast investigation.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <CollapsibleMission />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick References</h2>
              <div className="mt-3 grid gap-3">
                {QUICK_REFERENCE_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.title}</p>
                    <div className="mt-1 grid gap-2">
                      {section.items.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          {item.label}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="puzzleSearch" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search by Puzzle ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="input input-md input-bordered w-full border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 sm:max-w-sm"
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
                  className="btn btn-md bg-slate-900 text-white hover:bg-slate-700"
                  onClick={handleSearch}
                >
                  Search
                </button>
              </div>
              {searchError && <p className="text-xs font-semibold text-red-600">{searchError}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="maxGridSize" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Max Grid Size
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
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

              <div className="flex flex-col gap-2">
                <label htmlFor="explanationFilter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Explanation Status
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  value={explanationFilter}
                  onChange={(e) => setExplanationFilter(e.target.value)}
                >
                  <option value="all">All puzzles</option>
                  <option value="unexplained">Unexplained only</option>
                  <option value="explained">Explained only</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="gridConsistent" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Grid Consistency
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  value={gridSizeConsistent}
                  onChange={(e) => setGridSizeConsistent(e.target.value)}
                >
                  <option value="any">Any consistency</option>
                  <option value="true">Consistent size only</option>
                  <option value="false">Variable size only</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="arcVersion" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ARC Version
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
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

              <div className="flex flex-col gap-2">
                <label htmlFor="multiTestFilter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Test Cases
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  value={multiTestFilter}
                  onChange={(e) => setMultiTestFilter(e.target.value)}
                >
                  <option value="any">Any number of test cases</option>
                  <option value="single">Single test case</option>
                  <option value="multi">Multiple test cases</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="sortBy" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sort By
                </label>
                <select
                  className="select select-md select-bordered w-full border border-slate-300 bg-white text-sm font-medium focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
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

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 text-[11px]">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Active Filters</span>
            {activeFilters.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${item.active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-100 text-slate-500'}`}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-slate-700">
            <h2 className="text-lg font-semibold text-slate-900">Puzzle Results</h2>
            {!isLoading && (
              <span className="rounded-full bg-slate-900 px-4 py-1 text-sm font-semibold text-white">
                {filteredPuzzles.length.toLocaleString()} found
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-500" />
              <p className="text-sm text-slate-500">Loading puzzles...</p>
            </div>
          ) : filteredPuzzles.length === 0 ? (
            <div className="py-10 text-center">
              <Grid3X3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-600">No puzzles match your current filters.</p>
              <p className="mt-1 text-xs text-slate-500">Adjust the controls above to broaden the search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredPuzzles.map((puzzle: EnhancedPuzzleMetadata) => (
                <PuzzleCard key={puzzle.id} puzzle={puzzle} showGridPreview={true} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">How to Use</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <p>
              <strong className="font-semibold text-slate-900">Goal:</strong> This tool surfaces ARC-AGI puzzles so you can inspect how they work.
              If you&apos;re looking to solve puzzles manually, visit{' '}
              <Link href="https://human-arc.gptpluspro.com/assessment">Puzzle Browser</Link>.
            </p>
            <p>
              <strong className="font-semibold text-slate-900">AI Analysis:</strong> Select “Examine” on a puzzle to review the official answers and
              let the AI attempt to explain the underlying transformations.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
