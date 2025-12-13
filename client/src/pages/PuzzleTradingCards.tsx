/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-14T00:00:00Z / Updated 2025-11-20
 * PURPOSE: Puzzle Trading Cards page - displays ARC puzzles as 1980s-style baseball trading cards.
 * Shows named puzzles with their grids, nicknames, win/loss records against LLMs, and detailed stats.
 * Based on PuzzleBrowser page structure but focused on trading card display.
 *
 * UPDATES 2025-11-20:
 * - REMOVED imaginary "Legendary/Elite/Tough/Moderate/Easy" difficulty ratings
 * - REPLACED with actual LLM accuracy-based performance filters (Unbeatable, Very Hard, Hard, etc.)
 * - FIXED sort logic to show puzzles that defeat LLMs most (lowest LLM accuracy = hardest)
 * - ADDED "Most LLM Defeats" sort option (based on wrongCount)
 * - CLARIFIED filter labels and footer descriptions with accurate terminology
 * - Default sort now shows hardest puzzles first (those that defeat LLMs most often)
 * - PRIORITIZED dataset filter: ARC2-Eval and ARC1-Eval shown first with ⭐ markers
 * - ADDED "All Evaluation" combined filter option (shows both ARC1-Eval + ARC2-Eval)
 * - Datasets now ordered by importance: Eval datasets first, then training datasets
 *
 * SRP/DRY check: Pass - Reuses usePuzzleStats hook, PuzzleTradingCard component, and existing UI patterns
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePuzzleStats } from '@/hooks/usePuzzleStats';
import { PuzzleTradingCard } from '@/components/puzzle/PuzzleTradingCard';
import { hasPuzzleName } from '@shared/utils/puzzleNames';
import { Loader2, Grid3X3, Trophy, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PuzzleTradingCards() {
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [performanceFilter, setPerformanceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('hardest_first');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data, isLoading, error, summary } = usePuzzleStats();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Puzzle Trading Cards';
  }, []);

  // Filter and sort puzzles
  const filteredPuzzles = useMemo(() => {
    if (!data?.puzzles) return [];

    let filtered = data.puzzles
      // Only show named puzzles
      .filter(puzzle => hasPuzzleName(puzzle.id));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(puzzle => puzzle.id.toLowerCase().includes(query));
    }

    // Apply dataset filter
    if (datasetFilter === 'all_evaluation') {
      // Show both evaluation datasets
      filtered = filtered.filter(puzzle =>
        puzzle.source === 'ARC2-Eval' || puzzle.source === 'ARC1-Eval'
      );
    } else if (datasetFilter !== 'all') {
      // Show specific dataset
      filtered = filtered.filter(puzzle => puzzle.source === datasetFilter);
    }

    // Apply performance filter based on LLM accuracy
    if (performanceFilter !== 'all') {
      filtered = filtered.filter(puzzle => {
        if (!puzzle.performanceData) return performanceFilter === 'untested';

        const { avgAccuracy, totalExplanations } = puzzle.performanceData;
        const llmAccuracyPct = avgAccuracy * 100; // Convert 0-1 to 0-100%

        switch (performanceFilter) {
          case 'unbeatable': // 0% LLM accuracy - puzzle always defeats LLMs
            return llmAccuracyPct === 0 && totalExplanations > 0;
          case 'very_hard': // 1-20% LLM accuracy
            return llmAccuracyPct > 0 && llmAccuracyPct <= 20;
          case 'hard': // 21-40% LLM accuracy
            return llmAccuracyPct > 20 && llmAccuracyPct <= 40;
          case 'medium': // 41-60% LLM accuracy
            return llmAccuracyPct > 40 && llmAccuracyPct <= 60;
          case 'easy': // 61-80% LLM accuracy
            return llmAccuracyPct > 60 && llmAccuracyPct <= 80;
          case 'very_easy': // 81-99% LLM accuracy
            return llmAccuracyPct > 80 && llmAccuracyPct < 100;
          case 'always_solved': // 100% LLM accuracy - puzzle never defeats LLMs
            return llmAccuracyPct === 100;
          case 'untested':
            return totalExplanations === 0;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const aPerf = a.performanceData;
      const bPerf = b.performanceData;

      switch (sortBy) {
        case 'hardest_first': {
          // Hardest = Lowest LLM accuracy (defeats LLMs most often)
          const aAccuracy = aPerf?.avgAccuracy ?? 1; // Default to 1 (easiest) if no data
          const bAccuracy = bPerf?.avgAccuracy ?? 1;
          return aAccuracy - bAccuracy; // Lower accuracy first
        }
        case 'easiest_first': {
          // Easiest = Highest LLM accuracy (LLMs solve it most often)
          const aAccuracy = aPerf?.avgAccuracy ?? 0; // Default to 0 (hardest) if no data
          const bAccuracy = bPerf?.avgAccuracy ?? 0;
          return bAccuracy - aAccuracy; // Higher accuracy first
        }
        case 'most_defeats': {
          // Most times this puzzle has defeated LLMs
          const aWrong = aPerf?.wrongCount || 0;
          const bWrong = bPerf?.wrongCount || 0;
          return bWrong - aWrong; // Higher wrong count first
        }
        case 'total_attempts': {
          const aAttempts = aPerf?.totalExplanations || 0;
          const bAttempts = bPerf?.totalExplanations || 0;
          return bAttempts - aAttempts;
        }
        case 'id':
          return a.id.localeCompare(b.id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [data?.puzzles, datasetFilter, performanceFilter, sortBy, searchQuery]);

  // Get unique datasets for filter with priority ordering
  const availableDatasets = useMemo(() => {
    if (!data?.puzzles) return [];
    const isDatasetSource = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
    const datasets = new Set(data.puzzles.map(p => p.source).filter(isDatasetSource));
    const datasetArray: string[] = Array.from(datasets);

    // Define priority order - Evaluation datasets first!
    const priorityOrder = ['ARC2-Eval', 'ARC1-Eval', 'ARC2', 'ARC1', 'ARC-Heavy', 'ConceptARC'];

    // Sort: priority datasets first, then alphabetically for any others
    return datasetArray.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);

      // Both in priority list - sort by priority order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // Only a is in priority list - a comes first
      if (aIndex !== -1) return -1;
      // Only b is in priority list - b comes first
      if (bIndex !== -1) return 1;
      // Neither in priority list - alphabetical
      return a.localeCompare(b);
    });
  }, [data?.puzzles]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <div className="container mx-auto px-4 py-10">
          <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-6">
            <span className="text-red-200">Failed to load puzzle data. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Retro Hero Images Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl overflow-hidden border-4 border-amber-500/30 shadow-2xl shadow-purple-500/20 hover:border-amber-500/50 transition-all duration-300 hover:scale-105">
            <img
              src="/arcraiders1.png"
              alt="ARC Raider - Retro Sci-Fi Challenge"
              className="w-full h-auto"
            />
          </div>
          <div className="rounded-xl overflow-hidden border-4 border-amber-500/30 shadow-2xl shadow-blue-500/20 hover:border-amber-500/50 transition-all duration-300 hover:scale-105">
            <img
              src="/arcraiders2.png"
              alt="ARC Prize Raiders - A Retro Sci-Fi Challenge"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Hero Header */}
        <header className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="h-12 w-12 text-yellow-500" />
            <h1 className="text-5xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ARC Puzzle Trading Cards
            </h1>
            <Trophy className="h-12 w-12 text-yellow-500" />
          </div>
          <p className="text-lg text-slate-300">
            Collect them all! Named puzzles from the ARC dataset, featuring their performance records against AI models.
          </p>
          {summary && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <Badge className="bg-blue-500 text-white px-4 py-2">
                {filteredPuzzles.length} Cards Available
              </Badge>
              <Badge className="bg-purple-500 text-white px-4 py-2">
                {summary.totalPuzzles} Total Puzzles
              </Badge>
              <Badge className="bg-pink-500 text-white px-4 py-2">
                {summary.analyzedPuzzles} Analyzed
              </Badge>
            </div>
          )}
        </header>

        {/* Filters Section */}
        <section className="rounded-xl border-2 border-slate-700 bg-slate-800/60 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-200">Filter & Sort</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="flex flex-col gap-2">
              <label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search by ID
              </label>
              <input
                id="search"
                type="text"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="e.g. 007bbfb7"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Dataset Filter */}
            <div className="flex flex-col gap-2">
              <label htmlFor="dataset" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dataset
              </label>
              <select
                id="dataset"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={datasetFilter}
                onChange={(e) => setDatasetFilter(e.target.value)}
              >
                <option value="all">All Datasets</option>
                <option value="all_evaluation">🏆 All Evaluation (ARC1-Eval + ARC2-Eval)</option>
                <option disabled>───────────────</option>
                {availableDatasets.map(dataset => (
                  <option key={dataset} value={dataset}>
                    {dataset === 'ARC2-Eval' || dataset === 'ARC1-Eval' ? `⭐ ${dataset}` : dataset}
                  </option>
                ))}
              </select>
            </div>

            {/* Performance Filter */}
            <div className="flex flex-col gap-2">
              <label htmlFor="performance" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                LLM Performance
              </label>
              <select
                id="performance"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={performanceFilter}
                onChange={(e) => setPerformanceFilter(e.target.value)}
              >
                <option value="all">All Performance Levels</option>
                <option value="unbeatable">Unbeatable (0% LLM accuracy)</option>
                <option value="very_hard">Very Hard (1-20% LLM accuracy)</option>
                <option value="hard">Hard (21-40% LLM accuracy)</option>
                <option value="medium">Medium (41-60% LLM accuracy)</option>
                <option value="easy">Easy (61-80% LLM accuracy)</option>
                <option value="very_easy">Very Easy (81-99% LLM accuracy)</option>
                <option value="always_solved">Always Solved (100% LLM accuracy)</option>
                <option value="untested">Untested</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-2">
              <label htmlFor="sort" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sort By
              </label>
              <select
                id="sort"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="hardest_first">Hardest First (Defeats LLMs Most)</option>
                <option value="easiest_first">Easiest First (LLMs Solve Most)</option>
                <option value="most_defeats">Most LLM Defeats</option>
                <option value="total_attempts">Most Attempted</option>
                <option value="id">Puzzle ID</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-700">
            <span className="text-sm font-semibold text-slate-300">Active Filters:</span>
            {[
              { id: 'search', label: 'Search', active: searchQuery.trim().length > 0 },
              {
                id: 'dataset',
                label: datasetFilter === 'all_evaluation' ? '🏆 All Evaluation' :
                       datasetFilter !== 'all' ? datasetFilter : 'Dataset',
                active: datasetFilter !== 'all'
              },
              { id: 'performance', label: 'Performance', active: performanceFilter !== 'all' },
              { id: 'sort', label: 'Sort', active: sortBy !== 'hardest_first' },
            ].map((filter) => (
              <Badge
                key={filter.id}
                variant={filter.active ? 'default' : 'secondary'}
                className={filter.active ? 'border-blue-500 bg-blue-500/20 text-blue-200' : ''}
              >
                {filter.label}
              </Badge>
            ))}
          </div>
        </section>

        {/* Cards Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-200">Card Collection</h2>
            {!isLoading && (
              <Badge className="bg-slate-700 text-slate-200 px-4 py-2 text-sm">
                {filteredPuzzles.length} {filteredPuzzles.length === 1 ? 'Card' : 'Cards'}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-400" />
              <p className="text-lg text-slate-300">Loading trading cards...</p>
            </div>
          ) : filteredPuzzles.length === 0 ? (
            <div className="py-20 text-center">
              <Grid3X3 className="mx-auto mb-4 h-16 w-16 text-slate-600" />
              <p className="text-xl text-slate-300">No cards match your filters.</p>
              <p className="mt-2 text-sm text-slate-500">Try adjusting the filters to see more cards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPuzzles.map((puzzle) => (
                <PuzzleTradingCard key={puzzle.id} puzzle={puzzle} />
              ))}
            </div>
          )}
        </section>

        {/* Info Footer */}
        <footer className="rounded-xl border-2 border-slate-700 bg-slate-800/60 backdrop-blur-sm p-6 space-y-3">
          <h3 className="text-lg font-bold text-slate-200">About Trading Cards</h3>
          <div className="space-y-2 text-sm text-slate-400">
            <p>
              <strong className="text-slate-300">Win/Loss Record:</strong> Puzzles "win" when AI models fail to solve them correctly.
              A record of 14-4 means the puzzle defeated LLMs 14 times and was solved correctly 4 times.
            </p>
            <p>
              <strong className="text-slate-300">Dataset as Team:</strong> Each puzzle belongs to a dataset (like a sports team),
              shown with colorful team colors and badges.
            </p>
            <p>
              <strong className="text-slate-300">LLM Accuracy:</strong> Shows how often large language models successfully solve each puzzle.
              0% accuracy means unbeatable (puzzle always defeats LLMs), 100% means always solved by LLMs.
            </p>
            <p>
              <strong className="text-slate-300">Filtering by Performance:</strong> Use the "LLM Performance" filter to find puzzles
              that have the best record of defeating LLMs (Unbeatable/Very Hard) or those that LLMs solve easily (Easy/Always Solved).
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
