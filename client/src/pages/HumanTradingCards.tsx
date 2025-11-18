/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Human Trading Cards page - displays ARC contributors as 1980s-style trading cards.
 * Shows notable human contributors to the ARC-AGI challenge with their achievements, approaches, and contributions.
 * Based on PuzzleTradingCards page structure but focused on human contributors.
 * SRP/DRY check: Pass - Reuses useArcContributors hook, HumanTradingCard component, and existing UI patterns
 */

import React, { useEffect, useMemo } from 'react';
import { useArcContributors } from '@/hooks/useArcContributors';
import { HumanTradingCard } from '@/components/human/HumanTradingCard';
import { Loader2, Users } from 'lucide-react';

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  // Sort contributors: Year (Desc) -> Rank (Asc) -> Name (Asc)
  const sortedContributors = useMemo(() => {
    if (!data?.contributors) return [];
    
    return [...data.contributors].sort((a, b) => {
      // 1. Year Descending (newest first)
      const yearA = a.yearStart || 0;
      const yearB = b.yearStart || 0;
      if (yearA !== yearB) return yearB - yearA;

      // 2. Rank Ascending (1 is better than 2)
      // Treat null rank as Infinity (bottom of list)
      const rankA = a.rank ?? 999;
      const rankB = b.rank ?? 999;
      if (rankA !== rankB) return rankA - rankB;

      // 3. Name tie-breaker
      return a.fullName.localeCompare(b.fullName);
    });
  }, [data?.contributors]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100">
        <div className="container mx-auto px-4 py-10">
          <div className="rounded-md border border-red-900 bg-red-950/30 p-6">
            <span className="text-red-200">Failed to load data. Please try again later.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-200">
      <div className="container mx-auto px-6 py-12 space-y-10">

        {/* Minimal Header */}
        <header className="border-b border-slate-800 pb-8">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-8 w-8 text-slate-400" />
            <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
              Hall of Fame
            </h1>
          </div>
          <p className="text-lg text-slate-400 max-w-3xl">
            Recognizing the humans involved in the ARC-AGI challenge.
          </p>
        </header>

        {/* Content Grid */}
        <section>
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-600" />
              <p className="text-sm text-slate-500">Loading profiles...</p>
            </div>
          ) : !sortedContributors.length ? (
            <div className="py-20 text-center border border-dashed border-slate-800 rounded-lg">
              <p className="text-slate-500">No contributors found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedContributors.map((contributor) => (
                <div key={contributor.id} className="h-full">
                  <HumanTradingCard contributor={contributor} />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
