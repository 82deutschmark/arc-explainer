import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { useModels } from '@/hooks/useModels';
import { Loader2, Grid3X3, Eye, CheckCircle2, MessageCircle, Download, BookOpen, ExternalLink, Heart, Trophy, Sparkles, Database, FileText, Lightbulb, Award, Cpu, User, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import type { PuzzleMetadata } from '@shared/types';
import { useHasExplanation } from '@/hooks/useExplanation';
import { CollapsibleMission } from '@/components/ui/collapsible-mission';
import { formatProcessingTime } from '@/utils/timeFormatters';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';

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
        <header className="text-center space-y-1">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-blue-800 bg-clip-text text-transparent">
              🟦🟦🟦 ⬜⬛⬜ ARC-AGI Puzzle Explorer ⬜⬛⬜ 🟩🟩🟩
            </h1>
            <p className="text-xs text-slate-600 mt-1 font-mono">
              3️⃣×3️⃣ 🟦⬜🟦 → 🟩🟩🟩 ⬜ ARC-AGI Explainer Hub ⬜ 🟥⬜🟥 → 🟪🟪🟪 3️⃣×3️⃣
            </p>
          </div>
          
          {/* Collapsible Mission Statement */}
          <CollapsibleMission />

          {/* Resources & References Section - Enhanced with emojis and better styling */}
          <div className="card shadow-lg border-0 bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <div className="card-body p-2">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Sparkles className="h-3 w-3 text-slate-500" />
                <h3 className="text-sm font-bold bg-gradient-to-r from-slate-800 to-blue-700 bg-clip-text text-transparent">
                  <span className="font-mono">🟥🟥🟥 🟦🟦🟦 🟩🟩🟩</span> ARC-AGI Knowledge Hub <span className="font-mono">🟪🟪🟪 🟧🟧🟧 🟨🟨🟨</span>
                </h3>
                <Sparkles className="h-3 w-3 text-slate-500" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Research Section */}
                <div className="group bg-white/60 rounded p-1.5 hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-slate-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Cpu className="h-3 w-3 text-slate-600" />
                    <p className="font-bold text-slate-800 text-[10px] font-mono">⬛️⬜️⬛️ Research Papers</p>
                  </div>
                  <a href="https://www.arxiv.org/pdf/2505.11831" target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:text-blue-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">📄</span> ARC2 Technical Report <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                {/* Data Sources Section */}
                <div className="group bg-white/60 rounded p-1.5 hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-blue-100">
                  <div className="flex items-center gap-1 mb-1">
                    <Database className="h-3 w-3 text-blue-600" />
                    <p className="font-bold text-blue-800 text-[10px] font-mono">🟦⬛🟦 Data Sources</p>
                  </div>
                  <div className="space-y-0.5">
                    <a href="https://huggingface.co/arcprize" target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:text-blue-700 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">🗂️</span> HuggingFace Datasets <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a href="https://github.com/fchollet/ARC-AGI" target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:text-blue-700 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">📦</span> Official Repository <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>

                {/* SOTA Solutions Section */}
                <div className="group bg-white/60 rounded p-1.5 hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-green-100">
                  <div className="flex items-center gap-1 mb-1">
                    <Trophy className="h-3 w-3 text-green-600" />
                    <p className="font-bold text-green-800 text-[10px] font-mono">🟩⬜🟩 Top Solutions</p>
                  </div>
                  <div className="space-y-0.5">
                    <a href="https://github.com/zoecarver" target="_blank" rel="noopener noreferrer"
                       className="text-green-700 hover:text-green-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">1️⃣</span> zoecarver's Approach <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a href="https://github.com/jerber" target="_blank" rel="noopener noreferrer"
                       className="text-green-700 hover:text-green-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">2️⃣</span> jerber's Solutions <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a href="https://github.com/epang080516/arc_agi" target="_blank" rel="noopener noreferrer"
                       className="text-green-700 hover:text-green-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">3️⃣</span> epang080516's Code <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>

                {/* Community Section */}
                <div className="group bg-white/60 rounded p-1.5 hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-orange-100">
                  <div className="flex items-center gap-1 mb-1">
                    <User className="h-3 w-3 text-orange-600" />
                    <p className="font-bold text-orange-800 text-[10px] font-mono">🟧🟨🟧 Community</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="mb-1">
                      <div className={`collapse ${isOpen ? 'collapse-open' : 'collapse-close'} bg-orange-50 border border-orange-200 rounded`}>
                        <div className="collapse-title p-1">
                          <button
                            className="w-full flex justify-between items-center h-auto"
                            onClick={() => setIsOpen(!isOpen)}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-semibold text-orange-800 font-mono">🟧🟨🟧 Critical ARC-AGI-2 Research</span>
                              <span className="text-[8px] text-orange-600">by cristianoc</span>
                            </div>
                            {isOpen ? (
                              <ChevronUp className="h-2.5 w-2.5 text-orange-600" />
                            ) : (
                              <ChevronDown className="h-2.5 w-2.5 text-orange-600" />
                            )}
                          </button>
                        </div>

                        <div className="collapse-content px-1 pb-1">
                          <div className="text-[8px] text-orange-700 space-y-1">
                            <p className="font-mono">
                              📊 Analysis of 1️⃣1️⃣1️⃣ ARC-AGI-2 tasks reveals composition patterns:
                            </p>
                            <div className="grid grid-cols-2 gap-0.5 text-[8px] font-mono">
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
                            <a href="https://github.com/cristianoc/arc-agi-2-abstraction-dataset"
                               target="_blank" rel="noopener noreferrer"
                               className="text-blue-600 hover:text-blue-800 hover:underline text-[8px] flex items-center gap-1">
                              View cristianoc's research <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    <a href="https://github.com/google/ARC-GEN/blob/main/task_list.py#L422" target="_blank" rel="noopener noreferrer"
                       className="text-orange-700 hover:text-orange-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">📖</span> Puzzle Nomenclature <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a href="https://github.com/neoneye/arc-notes" target="_blank" rel="noopener noreferrer"
                       className="text-orange-700 hover:text-orange-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">📚</span> All the ARC Resources <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a href="https://github.com/neoneye/arc-dataset-collection" target="_blank" rel="noopener noreferrer"
                       className="text-orange-700 hover:text-orange-800 hover:underline text-[9px] flex items-center gap-1 transition-colors">
                      <span className="font-mono">🗃️</span> Dataset Collection <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-1 text-center">
                <p className="text-[9px] text-gray-600 bg-white/40 rounded-full px-2 py-1 inline-block font-mono">
                  🟥🟦🟩🟪🟧🟨 <strong>Special thanks to Simon Strandgaard (@neoneye)</strong> for his incredible insights, support, and encouragement! 🟨🟧🟪🟩🟦🟥
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <div className="card-body p-2">
            <h2 className="card-title flex items-center gap-1 text-slate-800 text-sm mb-2">
              <Grid3X3 className="h-3 w-3 text-blue-600" />
              Filter Puzzles
            </h2>
            {/* Search Bar */}
            <div className="mb-2">
              <div className="flex flex-col md:flex-row gap-2 items-start md:items-end">
                <div className="w-full md:flex-1">
                  <label htmlFor="puzzleSearch" className="text-[10px] font-medium text-slate-600 block mb-0.5">Search by Puzzle ID</label>
                  <div className="relative">
                    <input
                      className="input input-sm input-bordered w-full"
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
                  </div>
                  {searchError && (
                    <p className="text-[10px] text-red-500">{searchError}</p>
                  )}
                </div>
                <button 
                  className="btn btn-sm btn-primary min-w-[80px]"
                  onClick={handleSearch}
                >
                  Search
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div>
                <label htmlFor="maxGridSize" className="text-[10px] font-medium text-slate-600 block mb-0.5">Maximum Grid Size</label>
                <select className="select select-sm select-bordered w-full" value={maxGridSize} onChange={(e) => setMaxGridSize(e.target.value)}>
                  <option value="any">Any Size</option>
                  <option value="5">5×5 (Very Small)</option>
                  <option value="10">10×10 (Small)</option>
                  <option value="15">15×15 (Medium)</option>
                  <option value="20">20×20 (Large)</option>
                  <option value="30">30×30 (Very Large)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="explanationFilter" className="text-[10px] font-medium text-slate-600 block mb-0.5">Explanation Status</label>
                <select className="select select-sm select-bordered w-full" value={explanationFilter} onChange={(e) => setExplanationFilter(e.target.value)}>
                  <option value="all">All Puzzles</option>
                  <option value="unexplained">Unexplained Only</option>
                  <option value="explained">Explained Only</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="gridConsistent" className="text-[10px] font-medium text-slate-600 block mb-0.5">Grid Size Consistency</label>
                <select className="select select-sm select-bordered w-full" value={gridSizeConsistent} onChange={(e) => setGridSizeConsistent(e.target.value)}>
                  <option value="any">Any consistency</option>
                  <option value="true">Consistent size only</option>
                  <option value="false">Variable size only</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="arcVersion" className="text-[10px] font-medium text-slate-600 block mb-0.5">ARC Version</label>
                <select className="select select-sm select-bordered w-full" value={arcVersion} onChange={(e) => setArcVersion(e.target.value)}>
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
                <select className="select select-sm select-bordered w-full" value={multiTestFilter} onChange={(e) => setMultiTestFilter(e.target.value)}>
                  <option value="any">Any number of test cases</option>
                  <option value="single">Single test case (1 output required)</option>
                  <option value="multi">Multiple test cases (2+ outputs required)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="sortBy" className="text-[10px] font-medium text-slate-600 block mb-0.5">Sort By</label>
                <select className="select select-sm select-bordered w-full" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
