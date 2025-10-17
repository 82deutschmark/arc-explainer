/**
 * Author: gpt-5-codex
 * Date: 2025-10-17
 * PURPOSE: Presents the ARC puzzle browser with gradient-rich knowledge hubs,
 *          compact filter controls, and interactive navigation for puzzle exploration.
 * SRP/DRY check: Pass — Verified data fetching and filtering logic remain intact.
 */
import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { useModels } from '@/hooks/useModels';
import { Loader2, Grid3X3, ExternalLink, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import type { PuzzleMetadata } from '@shared/types';
import { useHasExplanation } from '@/hooks/useExplanation';
import { CollapsibleMission } from '@/components/ui/collapsible-mission';
import { formatProcessingTime } from '@/utils/timeFormatters';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';
import { EmojiMosaicAccent, type MosaicVariant } from '@/components/browser/EmojiMosaicAccent';

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

type KnowledgeTileLink = {
  href: string;
  label: string;
  icon: string;
};

type KnowledgeTile = {
  id: string;
  title: string;
  gradient: string;
  mosaicVariant: MosaicVariant;
  links: KnowledgeTileLink[];
};

const KNOWLEDGE_TILES: KnowledgeTile[] = [
  {
    id: 'research',
    title: 'Research Papers',
    gradient: 'from-fuchsia-500 via-purple-500 to-indigo-600',
    mosaicVariant: 'heroTwilight',
    links: [
      {
        href: 'https://www.arxiv.org/pdf/2505.11831',
        label: 'ARC2 Technical Report',
        icon: '📄',
      },
    ],
  },
  {
    id: 'data',
    title: 'Data Sources',
    gradient: 'from-sky-500 via-cyan-500 to-indigo-500',
    mosaicVariant: 'datasetSignal',
    links: [
      {
        href: 'https://huggingface.co/arcprize',
        label: 'HuggingFace Datasets',
        icon: '🗂️',
      },
      {
        href: 'https://github.com/fchollet/ARC-AGI',
        label: 'Official Repository',
        icon: '📦',
      },
    ],
  },
  {
    id: 'solutions',
    title: 'Top Solutions',
    gradient: 'from-emerald-500 via-lime-500 to-teal-500',
    mosaicVariant: 'sizeSignal',
    links: [
      {
        href: 'https://github.com/zoecarver',
        label: "zoecarver's Approach",
        icon: '1️⃣',
      },
      {
        href: 'https://github.com/jerber',
        label: "jerber's Solutions",
        icon: '2️⃣',
      },
      {
        href: 'https://github.com/epang080516/arc_agi',
        label: "epang080516's Code",
        icon: '3️⃣',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    mosaicVariant: 'analysisSignal',
    links: [
      {
        href: 'https://github.com/google/ARC-GEN/blob/main/task_list.py#L422',
        label: 'Puzzle Nomenclature',
        icon: '📖',
      },
      {
        href: 'https://github.com/neoneye/arc-notes',
        label: 'All the ARC Resources',
        icon: '📚',
      },
      {
        href: 'https://github.com/neoneye/arc-dataset-collection',
        label: 'Dataset Collection',
        icon: '🗃️',
      },
    ],
  },
];

export default function PuzzleBrowser() {
  const [maxGridSize, setMaxGridSize] = useState<string>('any');
  const [gridSizeConsistent, setGridSizeConsistent] = useState<string>('any');
  const [explanationFilter, setExplanationFilter] = useState<string>('unexplained'); // 'all', 'unexplained', 'explained' - Default to unexplained puzzles for analysis
  const [arcVersion, setArcVersion] = useState<string>('any'); // 'any', 'ARC1', 'ARC2', or 'ARC2-Eval' - Show all datasets by default
  const [multiTestFilter, setMultiTestFilter] = useState<string>('single'); // 'any', 'single', 'multi'
  const [sortBy, setSortBy] = useState<string>('unexplained_first'); // 'default', 'processing_time', 'confidence', 'cost', 'created_at', 'least_analysis_data', 'unexplained_first'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false); // For collapsible ARC-AGI-2 research section
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
        <div className="max-w-[1900px] mx-auto space-y-2">
          <div role="alert" className="alert alert-error">
            <span>Failed to load puzzles. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-2">
      <div className="max-w-[1900px] mx-auto space-y-2">
        <header className="space-y-3">
          <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-[radial-gradient(circle_at_top,_#f8fafc,_#dbeafe_65%,_#1d4ed8_125%)] p-4 shadow-lg">
            <div className="absolute -left-6 -top-6 hidden md:block">
              <EmojiMosaicAccent variant="heroSunrise" size="md" className="-rotate-6 drop-shadow-xl" />
            </div>
            <div className="absolute -bottom-8 right-4 hidden md:block">
              <EmojiMosaicAccent variant="heroTwilight" size="md" className="rotate-6 drop-shadow-xl" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-700 bg-clip-text text-transparent tracking-tight">
                  🟥🟧🟨 ARC-AGI Puzzle Explorer 🟩🟦🟪
                </h1>
                <p className="text-xs text-slate-600 font-mono">
                  3×3 emoji mosaics spotlight the interactive tools—follow the gradients to explore puzzles faster.
                </p>
              </div>

              <CollapsibleMission />

              <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                <span>ARC-AGI Knowledge Hub</span>
                <Sparkles className="h-3 w-3 text-indigo-500" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {KNOWLEDGE_TILES.map((tile) => (
                  <div
                    key={tile.id}
                    className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br ${tile.gradient} p-[1px] shadow-md transition-all duration-200 hover:shadow-xl focus-within:shadow-xl`}
                  >
                    <div className="h-full rounded-[1.1rem] bg-white/92 p-3 text-left space-y-2">
                      <div className="flex items-center gap-2">
                        <EmojiMosaicAccent variant={tile.mosaicVariant} size="xs" className="drop-shadow-sm" />
                        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-700">
                          {tile.title}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {tile.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-700 transition-all duration-150 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                          >
                            <span className="font-mono" aria-hidden="true">{link.icon}</span>
                            {link.label}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>

                      {tile.id === 'community' && (
                        <div className="space-y-1 pt-1 border-t border-orange-100/70">
                          <div
                            className={`collapse ${isOpen ? 'collapse-open' : 'collapse-close'} bg-orange-50/80 border border-orange-200 rounded-xl focus-within:outline-none focus-within:ring-1 focus-within:ring-orange-500`}
                          >
                            <div className="collapse-title p-1">
                              <button
                                className="w-full flex justify-between items-center text-left text-[9px] font-semibold text-orange-800 font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:ring-offset-1 focus-visible:ring-offset-orange-50"
                                onClick={() => setIsOpen(!isOpen)}
                              >
                                <span className="flex items-center gap-1">
                                  🟧🟨🟧 Critical ARC-AGI-2 Research
                                  <span className="text-[8px] text-orange-600">by cristianoc</span>
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="h-2.5 w-2.5 text-orange-600" />
                                ) : (
                                  <ChevronDown className="h-2.5 w-2.5 text-orange-600" />
                                )}
                              </button>
                            </div>
                            <div className="collapse-content px-1 pb-2 text-[8px] text-orange-700 space-y-1">
                              <p className="font-mono">
                                📊 Analysis of 1️⃣1️⃣1️⃣ ARC-AGI-2 tasks reveals composition patterns:
                              </p>
                              <div className="grid grid-cols-2 gap-0.5 font-mono">
                                <p>🟥🟥🟥🟥 4️⃣0️⃣% sequential composition</p>
                                <p>🟧🟧🟧⬜ 3️⃣0️⃣% conditional branching</p>
                                <p>🟨🟨⬜⬜ 2️⃣0️⃣% pattern classification</p>
                                <p>🟩🟩⬜⬜ 2️⃣5️⃣% iteration/loops</p>
                                <p>🟦🟦⬜⬜ 1️⃣5️⃣% nested structures</p>
                                <p>🟪⬜⬜⬜ 1️⃣0️⃣% parallel composition</p>
                                <p>🟫⬜⬜⬜ 5️⃣% graph/DAG structures</p>
                              </div>
                              <p className="italic text-orange-600 font-mono">
                                ⬛⬜⬛ A DSL is emerging from these patterns ⬛⬜⬛
                              </p>
                              <a
                                href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[8px] font-medium text-blue-700 transition-all duration-150 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-orange-50"
                              >
                                View cristianoc's research
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-[9px] font-mono text-slate-600">
                  <EmojiMosaicAccent variant="rainbow" size="xs" />
                  <span>
                    <strong>Special thanks to Simon Strandgaard (@neoneye)</strong> for incredible insights, support, and encouragement!
                  </span>
                </p>
              </div>
            </div>
          </section>
        </header>

        {/* Filters */}
        <div className="card shadow-lg border-0 bg-white/85 backdrop-blur-sm">
          <div className="card-body p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <EmojiMosaicAccent variant="rainbow" size="sm" />
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                  <Grid3X3 className="h-3 w-3 text-indigo-500" />
                  Filter Puzzles
                </h2>
              </div>
              <p className="text-[10px] text-slate-500">
                Gradients highlight the interactive controls below.
              </p>
            </div>

            <div className="grid gap-2 lg:grid-cols-4">
              <fieldset className="lg:col-span-2 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 p-3 shadow-sm">
                <legend className="px-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                    <EmojiMosaicAccent variant="searchSignal" size="xs" className="drop-shadow" />
                    Search
                  </span>
                </legend>
                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-end">
                  <div className="w-full sm:flex-1">
                    <label htmlFor="puzzleSearch" className="text-[10px] font-medium text-slate-600 block mb-0.5">
                      Search by Puzzle ID
                    </label>
                    <input
                      className="input input-xs input-bordered w-full border-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:border-sky-400"
                      id="puzzleSearch"
                      placeholder="Enter puzzle ID (e.g., 1ae2feb7)"
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
                    {searchError && (
                      <p className="mt-1 text-[10px] text-rose-500">{searchError}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex sm:flex-col sm:justify-end">
                    <EmojiMosaicAccent variant="heroSunrise" size="xs" className="rotate-3" />
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-100"
                    onClick={handleSearch}
                  >
                    Search
                  </button>
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 p-3 shadow-sm">
                <legend className="px-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                    <EmojiMosaicAccent variant="sizeSignal" size="xs" className="drop-shadow" />
                    Puzzle Shape
                  </span>
                </legend>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <label htmlFor="maxGridSize" className="text-[10px] font-medium text-slate-600 block mb-0.5">Maximum Grid Size</label>
                    <select
                      className="select select-xs select-bordered w-full border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:border-emerald-400"
                      value={maxGridSize}
                      onChange={(e) => setMaxGridSize(e.target.value)}
                    >
                      <option value="any">Any Size</option>
                      <option value="5">5×5 (Very Small)</option>
                      <option value="10">10×10 (Small)</option>
                      <option value="15">15×15 (Medium)</option>
                      <option value="20">20×20 (Large)</option>
                      <option value="30">30×30 (Very Large)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="gridConsistent" className="text-[10px] font-medium text-slate-600 block mb-0.5">Grid Size Consistency</label>
                    <select
                      className="select select-xs select-bordered w-full border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:border-emerald-400"
                      value={gridSizeConsistent}
                      onChange={(e) => setGridSizeConsistent(e.target.value)}
                    >
                      <option value="any">Any consistency</option>
                      <option value="true">Consistent size only</option>
                      <option value="false">Variable size only</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-50/80 p-3 shadow-sm">
                <legend className="px-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                    <EmojiMosaicAccent variant="datasetSignal" size="xs" className="drop-shadow" />
                    Dataset
                  </span>
                </legend>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <label htmlFor="arcVersion" className="text-[10px] font-medium text-slate-600 block mb-0.5">ARC Version</label>
                    <select
                      className="select select-xs select-bordered w-full border-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:border-cyan-400"
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
                  <div>
                    <label htmlFor="multiTestFilter" className="text-[10px] font-medium text-slate-600 block mb-0.5">Test Cases</label>
                    <select
                      className="select select-xs select-bordered w-full border-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:border-cyan-400"
                      value={multiTestFilter}
                      onChange={(e) => setMultiTestFilter(e.target.value)}
                    >
                      <option value="any">Any number of test cases</option>
                      <option value="single">Single test case (1 output required)</option>
                      <option value="multi">Multiple test cases (2+ outputs required)</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50/80 p-3 shadow-sm">
                <legend className="px-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-violet-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                    <EmojiMosaicAccent variant="statusUnexplained" size="xs" className="drop-shadow" />
                    Analysis
                  </span>
                </legend>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <label htmlFor="explanationFilter" className="text-[10px] font-medium text-slate-600 block mb-0.5">Explanation Status</label>
                    <select
                      className="select select-xs select-bordered w-full border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:border-rose-400"
                      value={explanationFilter}
                      onChange={(e) => setExplanationFilter(e.target.value)}
                    >
                      <option value="all">All Puzzles</option>
                      <option value="unexplained">Unexplained Only</option>
                      <option value="explained">Explained Only</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sortBy" className="text-[10px] font-medium text-slate-600 block mb-0.5">Sort By</label>
                    <select
                      className="select select-xs select-bordered w-full border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:border-rose-400"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="unexplained_first">Unexplained First (recommended)</option>
                      <option value="default">Default (puzzle order)</option>
                      <option value="least_analysis_data">Analysis Data (fewest first)</option>
                      <option value="processing_time">Processing Time (longest first)</option>
                      <option value="confidence">Confidence (highest first)</option>
                      <option value="cost">Cost (highest first)</option>
                      <option value="created_at">Analysis Date (newest first)</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {[
                { id: 'search', label: 'Search', active: searchQuery.trim().length > 0, variant: 'searchSignal' as const },
                { id: 'maxGridSize', label: 'Max Grid', active: maxGridSize !== 'any', variant: 'sizeSignal' as const },
                { id: 'gridSizeConsistent', label: 'Consistency', active: gridSizeConsistent !== 'any', variant: 'sizeSignal' as const },
                { id: 'explanationFilter', label: 'Explanation', active: explanationFilter !== 'unexplained', variant: 'statusUnexplained' as const },
                { id: 'arcVersion', label: 'ARC Version', active: arcVersion !== 'any', variant: 'datasetSignal' as const },
                { id: 'multiTestFilter', label: 'Test Cases', active: multiTestFilter !== 'single', variant: 'analysisSignal' as const },
                { id: 'sortBy', label: 'Sort', active: sortBy !== 'unexplained_first', variant: 'heroTwilight' as const },
              ].map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold transition-colors duration-200 ${
                    item.active
                      ? 'border-indigo-200 bg-gradient-to-r from-indigo-100 via-rose-100 to-amber-100 text-slate-800 shadow-sm'
                      : 'border-slate-200 bg-white/70 text-slate-400'
                  }`}
                >
                  <EmojiMosaicAccent
                    variant={item.active ? item.variant : 'chipInactive'}
                    size="xs"
                    framed={item.active}
                    className={item.active ? 'drop-shadow-[0_0_6px_rgba(79,70,229,0.45)]' : 'opacity-40'}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <div className="card-body p-2">
            <h2 className="card-title text-slate-800 text-sm mb-2">
              Local Puzzles 
              {!isLoading && (
                <div className="badge badge-sm badge-outline ml-1 bg-blue-50 text-blue-700 border-blue-200">
                  {filteredPuzzles.length} found
                </div>
              )}
            </h2>
            <p className="text-[10px] text-gray-600 mb-2">
              Puzzles available for examination
            </p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
        <div className="card">
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
