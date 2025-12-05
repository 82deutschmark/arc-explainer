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
import { Loader2, Users, Trophy, ScrollText, History, Star, ExternalLink, Award, Sparkles, Calendar, Rocket } from 'lucide-react';

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();

  // Set page title
  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  // Categorize contributors for 2025 results
  const { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers, arc3Preview } = useMemo(() => {
    if (!data?.contributors) return { founders: [], topPaperAward2025: [], winners2025: [], winners2024: [], researchers: [], pioneers: [], arc3Preview: [] };
    
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

    // ARC3 2026 Preview - Rising Stars
    const arc3Preview = contributors
      .filter(c => c.category === 'arc3_preview')
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    return { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers, arc3Preview };
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
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-200">
      {/* Subtle background texture */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative container mx-auto px-6 py-10 space-y-12">

        {/* 2025 Announcement Hero */}
        <header className="text-center max-w-5xl mx-auto space-y-6 relative py-8">
          {/* Decorative glow */}
          <div className="absolute -inset-20 bg-gradient-to-r from-amber-500/10 via-fuchsia-500/15 to-violet-500/10 blur-3xl -z-10 rounded-full" />
          
          {/* Date badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50 rounded-full px-5 py-2 text-sm text-zinc-300 shadow-lg">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="font-medium">December 5, 2025</span>
            <span className="text-zinc-600">•</span>
            <span className="text-amber-400 font-semibold">Official Results</span>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Trophy className="h-12 w-12 text-amber-400 drop-shadow-lg" />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 bg-clip-text text-transparent tracking-tight">
              ARC Prize 2025
            </h1>
            <Sparkles className="h-10 w-10 text-fuchsia-400 drop-shadow-lg" />
          </div>
          
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Celebrating the brilliant minds pushing the boundaries of artificial general intelligence.
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
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/15 to-violet-500/15 blur-3xl -z-10 rounded-full" />
                {founders.map(founder => (
                  <Dialog key={founder.id}>
                    <div className="border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl flex flex-col md:flex-row md:items-center gap-5 overflow-hidden">
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-zinc-600/50 bg-black hover:border-amber-400/60 transition-all hover:scale-105 shadow-lg"
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

                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Founders & Organizers
                        </p>
                        <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 truncate">
                          {founder.fullName}
                        </h2>
                        {founder.achievement && (
                          <p className="text-sm text-zinc-400 line-clamp-1">
                            {founder.achievement}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-3">
                        <div className="text-sm text-zinc-400">
                          <span className="mr-1 text-zinc-500">Active:</span>
                          <span className="font-mono text-zinc-200">
                            {founder.yearStart}
                            {founder.yearEnd ? `–${founder.yearEnd}` : '–Present'}
                          </span>
                        </div>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 hover:text-amber-100 transition-all shadow-lg"
                          >
                            View Profile
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                      </div>
                    </div>

                    <DialogContent className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-700/50 text-zinc-200 max-w-5xl max-h-[90vh] overflow-y-auto p-0">
                      <HumanTradingCard contributor={founder} />
                    </DialogContent>
                  </Dialog>
                ))}
              </section>
            )}

            {/* 2025 Top Paper Award - Featured Section */}
            {topPaperAward2025.length > 0 && (
              <section className="space-y-8 relative">
                {/* Special glow for this section */}
                <div className="absolute -inset-10 bg-gradient-to-r from-fuchsia-600/10 via-violet-600/10 to-purple-600/10 blur-3xl -z-10 rounded-3xl" />
                
                <div className="flex items-center gap-4 border-b border-fuchsia-500/30 pb-5">
                  <div className="p-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30">
                    <Award className="h-7 w-7 text-fuchsia-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-100">2025 Top Paper Award</h2>
                  <span className="ml-auto text-xs bg-fuchsia-500/20 text-fuchsia-300 px-3 py-1.5 rounded-full border border-fuchsia-500/30 uppercase tracking-wider font-bold shadow-lg">
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
              <section className="space-y-8">
                <div className="flex items-center gap-4 border-b border-amber-500/30 pb-5">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <Trophy className="h-6 w-6 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-100">2025 Competition Winners</h2>
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
              <section className="space-y-8">
                <div className="flex items-center gap-4 border-b border-zinc-700/50 pb-5">
                  <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
                    <Star className="h-6 w-6 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-100">2024 ARC Prize Winners</h2>
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
              <section className="space-y-8">
                <div className="flex items-center gap-4 border-b border-zinc-700/50 pb-5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <ScrollText className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-100">Research & Awards</h2>
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
              <section className="space-y-8">
                <div className="flex items-center gap-4 border-b border-zinc-700/50 pb-5">
                  <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                    <History className="h-6 w-6 text-violet-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-100">Pioneers</h2>
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

            {/* ARC3 2026 Preview - Rising Stars */}
            {arc3Preview.length > 0 && (
              <section className="space-y-8">
                <div className="flex items-center gap-4 border-b border-cyan-500/30 pb-5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                    <Rocket className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100">ARC3 2026</h2>
                    <p className="text-sm text-cyan-400">Rising Stars & Agent Preview Winners</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {arc3Preview.map(contributor => (
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
