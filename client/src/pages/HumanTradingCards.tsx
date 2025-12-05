/**
 * Author: Claude 3.5 Sonnet / Cascade
 * Date: 2025-12-05
 * PURPOSE: Human Trading Cards page - displays ARC contributors as 1980s-style trading cards.
 * Updated for ARC Prize 2025 results announcement (December 5, 2025).
 * Shows official 2025 winners, Top Paper Award, and notable contributors.
 * SRP/DRY check: Pass - Reuses useArcContributors hook, HumanTradingCard component, and existing UI patterns
 */

import React, { useEffect, useMemo } from 'react';
import { useArcContributors } from '@/hooks/useArcContributors';
import { HumanTradingCard } from '@/components/human/HumanTradingCard';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Users, Trophy, ScrollText, History, Star, ExternalLink, Award, Sparkles, Calendar } from 'lucide-react';

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  // Categorize contributors for 2025 results
  const { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers } = useMemo(() => {
    if (!data?.contributors) return { founders: [], topPaperAward2025: [], winners2025: [], winners2024: [], researchers: [], pioneers: [] };
    
    const contributors = [...data.contributors];
    
    // Founders hero card (category 'founder')
    const founders = contributors.filter(c => c.category === 'founder');
    
    // 2025 Top Paper Award (special category)
    const topPaperAward2025 = contributors
      .filter(c => c.category === 'top_paper_award' && c.yearStart === 2025)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // 2025 Competition Winners
    const winners2025 = contributors
      .filter(c => {
        if (!c.yearStart) return false;
        const endYear = c.yearEnd ?? 9999;
        return c.yearStart <= 2025 && endYear >= 2025 && c.category === 'competition_winner' && c.rank !== 0;
      })
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // 2024 Winners (Year 2024, Competition Winner category)
    const winners2024 = contributors
      .filter(c => c.yearStart === 2024 && c.category === 'competition_winner' && c.rank !== 0)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // Researchers & Paper Awards (excluding top_paper_award which has its own section)
    const researchers = contributors
      .filter(c => ['paper_award', 'researcher'].includes(c.category) && c.rank !== 0)
      .sort((a, b) => b.yearStart! - a.yearStart!);

    // Pioneers (Old categories or explicit pioneers)
    const pioneers = contributors
      .filter(c => c.category === 'pioneer' || (c.yearStart && c.yearStart < 2024 && c.rank !== 0 && c.category !== 'founder'))
      .sort((a, b) => b.yearStart! - a.yearStart!);

    return { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers };
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
      <div className="container mx-auto px-6 py-10 space-y-10">

        {/* 2025 Announcement Hero */}
        <header className="text-center max-w-5xl mx-auto space-y-6 relative">
          {/* Decorative glow */}
          <div className="absolute -inset-10 bg-gradient-to-r from-fuchsia-600/20 via-amber-500/20 to-blue-600/20 blur-3xl -z-10 rounded-full opacity-60" />
          
          {/* Date badge */}
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-full px-4 py-1.5 text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>December 5, 2025</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-semibold">Official Results</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Trophy className="h-10 w-10 text-amber-500 animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-bold text-slate-100 tracking-tight">
              ARC Prize 2025 Winners
            </h1>
            <Sparkles className="h-8 w-8 text-fuchsia-400" />
          </div>
          
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Celebrating the brilliant minds who pushed the boundaries of artificial general intelligence.
            The 2025 ARC Prize results are in!
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
              <section className="max-w-6xl mx-auto relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-purple-600/20 blur-3xl -z-10 rounded-full opacity-50" />
                {founders.map(founder => (
                  <Dialog key={founder.id}>
                    <div className="border border-slate-800 bg-slate-900/80 backdrop-blur-md rounded-xl px-5 py-3 shadow-2xl flex flex-col md:flex-row md:items-center gap-4 md:h-[10vh] overflow-hidden">
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-black hover:border-amber-400/60 transition-colors"
                        >
                          {founder.imageUrl && (
                            <img
                              src={founder.imageUrl}
                              alt={founder.fullName}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      </DialogTrigger>

                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Founders & organizers
                        </p>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-100 truncate">
                          {founder.fullName}
                        </h2>
                        {founder.achievement && (
                          <p className="text-sm text-slate-400 line-clamp-1">
                            {founder.achievement}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">
                        <div className="text-xs text-slate-400">
                          <span className="mr-1 text-slate-500">Active:</span>
                          <span className="font-mono text-slate-200">
                            {founder.yearStart}
                            {founder.yearEnd ? `–${founder.yearEnd}` : '–Present'}
                          </span>
                        </div>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300 hover:bg-amber-500/20 hover:text-amber-100 transition-colors"
                          >
                            View full profile
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </DialogTrigger>
                      </div>
                    </div>

                    <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-3xl max-h-[90vh] overflow-y-auto">
                      <HumanTradingCard contributor={founder} />
                    </DialogContent>
                  </Dialog>
                ))}
              </section>
            )}

            {/* 2025 Top Paper Award - Featured Section */}
            {topPaperAward2025.length > 0 && (
              <section className="space-y-6 relative">
                {/* Special glow for this section */}
                <div className="absolute -inset-6 bg-gradient-to-r from-fuchsia-600/10 to-purple-600/10 blur-2xl -z-10 rounded-3xl" />
                
                <div className="flex items-center gap-3 border-b border-fuchsia-500/30 pb-4">
                  <Award className="h-7 w-7 text-fuchsia-400" />
                  <h2 className="text-2xl font-bold text-slate-100">2025 Top Paper Award</h2>
                  <span className="ml-2 text-xs bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded-full border border-fuchsia-500/30 uppercase tracking-wider font-semibold">
                    Featured
                  </span>
                </div>
                
                {/* Featured large card layout for top paper award winner */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {topPaperAward2025.map(contributor => (
                    <div key={contributor.id} className="lg:col-span-2 max-w-3xl mx-auto w-full">
                      <HumanTradingCard contributor={contributor} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2025 Competition Winners */}
            {winners2025.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-amber-500/30 pb-4">
                  <Trophy className="h-6 w-6 text-amber-400" />
                  <h2 className="text-2xl font-bold text-slate-100">2025 Competition Winners</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {winners2025.map(contributor => (
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
