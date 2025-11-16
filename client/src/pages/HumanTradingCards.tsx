/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Human Trading Cards page - displays ARC contributors as 1980s-style trading cards.
 * Shows notable human contributors to the ARC-AGI challenge with their achievements, approaches, and contributions.
 * Based on PuzzleTradingCards page structure but focused on human contributors.
 * SRP/DRY check: Pass - Reuses useArcContributors hook, HumanTradingCard component, and existing UI patterns
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useArcContributors, useContributorStats } from '@/hooks/useArcContributors';
import { HumanTradingCard } from '@/components/human/HumanTradingCard';
import { Loader2, Trophy, Filter, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ContributorCategory } from '@shared/types/contributor';

export default function HumanTradingCards() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('rank_asc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data, isLoading, error } = useArcContributors();
  const { data: stats } = useContributorStats();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Human Contributor Trading Cards';
  }, []);

  // Filter and sort contributors
  const filteredContributors = useMemo(() => {
    if (!data?.contributors) return [];

    let filtered = data.contributors;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        contributor =>
          contributor.fullName.toLowerCase().includes(query) ||
          contributor.handle?.toLowerCase().includes(query) ||
          contributor.affiliation?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(contributor => contributor.category === categoryFilter);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rank_asc':
          // Nulls last
          if (a.rank === null && b.rank === null) return 0;
          if (a.rank === null) return 1;
          if (b.rank === null) return -1;
          return a.rank - b.rank;
        case 'year_desc':
          return (b.yearStart || 0) - (a.yearStart || 0);
        case 'year_asc':
          return (a.yearStart || 0) - (b.yearStart || 0);
        case 'name_asc':
          return a.fullName.localeCompare(b.fullName);
        default:
          return 0;
      }
    });

    return filtered;
  }, [data?.contributors, categoryFilter, sortBy, searchQuery]);

  // Get unique categories for filter
  const availableCategories = useMemo(() => {
    if (!data?.contributors) return [];
    const categories = new Set(data.contributors.map(c => c.category));
    return Array.from(categories).sort();
  }, [data?.contributors]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <div className="container mx-auto px-4 py-10">
          <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-6">
            <span className="text-red-200">Failed to load contributor data. Please check your connection and try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Hero Header */}
        <header className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <Users className="h-12 w-12 text-yellow-500" />
            <h1 className="text-5xl font-black uppercase tracking-tight bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
              ARC Hall of Fame
            </h1>
            <Trophy className="h-12 w-12 text-yellow-500" />
          </div>
          <p className="text-lg text-slate-300">
            Celebrating the brilliant minds pushing the boundaries of AI reasoning and abstraction
          </p>
          {stats && (
            <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
              <Badge className="bg-yellow-500 text-white px-4 py-2">
                {data?.total || 0} Contributors
              </Badge>
              {stats.categoryCounts && Object.entries(stats.categoryCounts).map(([category, count]) => (
                <Badge key={category} className="bg-purple-500 text-white px-4 py-2">
                  {count} {category.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Filters Section */}
        <section className="rounded-xl border-2 border-slate-700 bg-slate-800/60 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-200">Filter & Sort</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="flex flex-col gap-2">
              <label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search by Name
              </label>
              <input
                id="search"
                type="text"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="e.g. Jeremy Berman"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Category
              </label>
              <select
                id="category"
                className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-900 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
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
                <option value="rank_asc">Rank (Highest First)</option>
                <option value="year_desc">Year (Newest First)</option>
                <option value="year_asc">Year (Oldest First)</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-700">
            <span className="text-sm font-semibold text-slate-300">Active Filters:</span>
            {[
              { id: 'search', label: 'Search', active: searchQuery.trim().length > 0 },
              { id: 'category', label: categoryFilter !== 'all' ? categoryFilter.replace('_', ' ').toUpperCase() : 'Category', active: categoryFilter !== 'all' },
              { id: 'sort', label: 'Sort', active: sortBy !== 'rank_asc' },
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
            <h2 className="text-2xl font-bold text-slate-200">Hall of Fame Members</h2>
            {!isLoading && (
              <Badge className="bg-slate-700 text-slate-200 px-4 py-2 text-sm">
                {filteredContributors.length} {filteredContributors.length === 1 ? 'Contributor' : 'Contributors'}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-400" />
              <p className="text-lg text-slate-300">Loading trading cards...</p>
            </div>
          ) : filteredContributors.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-slate-600" />
              <p className="text-xl text-slate-300">No contributors match your filters.</p>
              <p className="mt-2 text-sm text-slate-500">Try adjusting the filters to see more contributors.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredContributors.map((contributor) => (
                <HumanTradingCard key={contributor.id} contributor={contributor} />
              ))}
            </div>
          )}
        </section>

        {/* Info Footer */}
        <footer className="rounded-xl border-2 border-slate-700 bg-slate-800/60 backdrop-blur-sm p-6 space-y-3">
          <h3 className="text-lg font-bold text-slate-200">About the ARC Hall of Fame</h3>
          <div className="space-y-2 text-sm text-slate-400">
            <p>
              <strong className="text-slate-300">Competition Winners:</strong> Top performers in official ARC-AGI competitions,
              achieving breakthrough scores and advancing the state of the art.
            </p>
            <p>
              <strong className="text-slate-300">Paper Awards:</strong> Researchers who published significant findings about
              solving ARC puzzles, including novel techniques like test-time training and program synthesis.
            </p>
            <p>
              <strong className="text-slate-300">Pioneers:</strong> Early contributors who established the foundation for
              modern ARC-AGI solving approaches, including DSL-based program search and neural methods.
            </p>
            <p>
              <strong className="text-slate-300">Founders & Organizers:</strong> The visionaries who created and organize
              the ARC challenge, driving progress toward artificial general intelligence.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
