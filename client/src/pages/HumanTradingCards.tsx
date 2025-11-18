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
import { Loader2, Users, Trophy, ScrollText, History, Star } from 'lucide-react';

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  // Categorize contributors
  const { founders, leaderboard2025, winners2024, researchers, pioneers } = useMemo(() => {
    if (!data?.contributors) return { founders: [], leaderboard2025: [], winners2024: [], researchers: [], pioneers: [] };
    
    const contributors = [...data.contributors];
    
    // Founders (Rank 0)
    const founders = contributors.filter(c => c.rank === 0);
    
    // 2025 Leaderboard (Year 2025)
    const leaderboard2025 = contributors
      .filter(c => c.yearStart === 2025 && c.rank !== 0)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // 2024 Winners (Year 2024, Competition Winner category)
    const winners2024 = contributors
      .filter(c => c.yearStart === 2024 && c.category === 'competition_winner' && c.rank !== 0)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // Researchers & Paper Awards
    const researchers = contributors
      .filter(c => ['paper_award', 'researcher'].includes(c.category) && c.rank !== 0)
      .sort((a, b) => b.yearStart! - a.yearStart!); // Newest first

    // Pioneers (Old categories or explicit pioneers)
    const pioneers = contributors
      .filter(c => c.category === 'pioneer' || (c.yearStart && c.yearStart < 2024 && c.rank !== 0 && c.category !== 'founder'))
      .sort((a, b) => b.yearStart! - a.yearStart!);

    return { founders, leaderboard2025, winners2024, researchers, pioneers };
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
      <div className="container mx-auto px-6 py-12 space-y-16">

        {/* Header */}
        <header className="text-center max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Users className="h-10 w-10 text-amber-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-slate-100 tracking-tight">
              ARC Hall of Fame
            </h1>
          </div>
          <p className="text-xl text-slate-400">
            Honoring the researchers, engineers, and pioneers pushing the boundaries of AGI.
          </p>
        </header>

        {isLoading ? (
          <div className="py-32 text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-500" />
            <p className="text-lg text-slate-500">Loading profiles...</p>
          </div>
        ) : (
          <>
            {/* Founders Hero Section */}
            {founders.length > 0 && (
              <section className="max-w-5xl mx-auto relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-purple-600/20 blur-3xl -z-10 rounded-full opacity-50" />
                <div className="border border-slate-800 bg-slate-900/50 backdrop-blur-sm rounded-2xl p-1 shadow-2xl">
                   {founders.map(founder => (
                     <div key={founder.id} className="h-[500px]">
                       <HumanTradingCard contributor={founder} />
                     </div>
                   ))}
                </div>
              </section>
            )}

            {/* 2025 Leaderboard */}
            {leaderboard2025.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <Trophy className="h-6 w-6 text-amber-400" />
                  <h2 className="text-2xl font-bold text-slate-100">2025 Leaderboard</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {leaderboard2025.map(contributor => (
                    <div key={contributor.id} className="h-full">
                      <HumanTradingCard contributor={contributor} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2024 Winners */}
            {winners2024.length > 0 && (
              <section className="space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <Star className="h-6 w-6 text-blue-400" />
                  <h2 className="text-2xl font-bold text-slate-100">2024 ARC Prize Winners</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {winners2024.map(contributor => (
                    <div key={contributor.id} className="h-full">
                      <HumanTradingCard contributor={contributor} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Research & Papers */}
            {researchers.length > 0 && (
              <section className="space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <ScrollText className="h-6 w-6 text-emerald-400" />
                  <h2 className="text-2xl font-bold text-slate-100">Research & Awards</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {researchers.map(contributor => (
                    <div key={contributor.id} className="h-full">
                      <HumanTradingCard contributor={contributor} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pioneers */}
            {pioneers.length > 0 && (
              <section className="space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <History className="h-6 w-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-slate-100">Pioneers</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {pioneers.map(contributor => (
                    <div key={contributor.id} className="h-full">
                      <HumanTradingCard contributor={contributor} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}
