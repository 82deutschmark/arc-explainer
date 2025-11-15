/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-14T00:00:00Z / Updated 2025-11-14
 * PURPOSE: Puzzle Trading Cards page - displays ARC puzzles as 1980s-style baseball trading cards.
 * Shows named puzzles with their grids, nicknames, win/loss records against LLMs, and detailed stats.
 * Based on PuzzleBrowser page structure but focused on trading card display.
 * ADDED: Retro sci-fi hero banner images (arcraiders1.png, arcraiders2.png) with 1980s aesthetic,
 * border glow effects, hover animations, and responsive 2-column grid layout.
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
  const [sortBy, setSortBy] = useState<string>('win_percentage_desc');
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
    if (datasetFilter !== 'all') {
      filtered = filtered.filter(puzzle => puzzle.source === datasetFilter);
    }

    // Apply performance filter
    if (performanceFilter !== 'all') {
      filtered = filtered.filter(puzzle => {
        if (!puzzle.performanceData) return performanceFilter === 'untested';

        const { wrongCount, totalExplanations } = puzzle.performanceData;
        const winPercentage = totalExplanations > 0 ? (wrongCount / totalExplanations) * 100 : 0;

        switch (performanceFilter) {
          case 'legendary': // 90%+ win rate
            return winPercentage >= 90;
          case 'elite': // 70-89% win rate
            return winPercentage >= 70 && winPercentage < 90;
          case 'tough': // 50-69% win rate
            return winPercentage >= 50 && winPercentage < 70;
          case 'moderate': // 30-49% win rate
            return winPercentage >= 30 && winPercentage < 50;
          case 'easy': // <30% win rate
            return winPercentage < 30;
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
        case 'win_percentage_desc': {
          const aWinPct = aPerf && aPerf.totalExplanations > 0
            ? (aPerf.wrongCount / aPerf.totalExplanations) * 100
            : 0;
          const bWinPct = bPerf && bPerf.totalExplanations > 0
            ? (bPerf.wrongCount / bPerf.totalExplanations) * 100
            : 0;
          return bWinPct - aWinPct;
        }
        case 'win_percentage_asc': {
          const aWinPct = aPerf && aPerf.totalExplanations > 0
            ? (aPerf.wrongCount / aPerf.totalExplanations) * 100
            : 0;
          const bWinPct = bPerf && bPerf.totalExplanations > 0
            ? (bPerf.wrongCount / bPerf.totalExplanations) * 100
            : 0;
          return aWinPct - bWinPct;
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

  // Get unique datasets for filter
  const availableDatasets = useMemo(() => {
    if (!data?.puzzles) return [];
    const datasets = new Set(data.puzzles.map(p => p.source).filter(Boolean));
    return Array.from(datasets).sort();
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
                {availableDatasets.map(dataset => (
                  <option key={dataset} value={dataset}>{dataset}</option>
                ))}
              </select>
            </div>

            {/* Performance Filter */}
            <div className="flex flex-col gap-2">
              <label htmlFor="performance" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Difficulty
              </label>
              <select
                id="performance"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={performanceFilter}
                onChange={(e) => setPerformanceFilter(e.target.value)}
              >
                <option value="all">All Difficulties</option>
                <option value="legendary">Legendary (90%+ win rate)</option>
                <option value="elite">Elite (70-89% win rate)</option>
                <option value="tough">Tough (50-69% win rate)</option>
                <option value="moderate">Moderate (30-49% win rate)</option>
                <option value="easy">Easy (&lt;30% win rate)</option>
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
                <option value="win_percentage_desc">Highest Win % First</option>
                <option value="win_percentage_asc">Lowest Win % First</option>
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
              { id: 'dataset', label: datasetFilter !== 'all' ? datasetFilter : 'Dataset', active: datasetFilter !== 'all' },
              { id: 'performance', label: 'Difficulty', active: performanceFilter !== 'all' },
              { id: 'sort', label: 'Sort', active: sortBy !== 'win_percentage_desc' },
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
              A record of 14-4 means the puzzle stumped AI 14 times and was solved correctly 4 times.
            </p>
            <p>
              <strong className="text-slate-300">Dataset as Team:</strong> Each puzzle belongs to a dataset (like a sports team),
              shown with colorful team colors and badges.
            </p>
            <p>
              <strong className="text-slate-300">Difficulty Ratings:</strong> Based on the puzzle's win percentage against AI models.
              Higher percentages indicate tougher puzzles that challenge even the most advanced models.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
