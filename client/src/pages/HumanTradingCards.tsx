/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-06
 * PURPOSE: ARC Hall of Fame page - information-dense display of ARC contributors as trading cards.
 * Updated for ARC Prize 2025 results announcement (December 5, 2025).
 * Features compact card grid layout, Hall of Fame header, and external resource links.
 * SRP/DRY check: Pass - Reuses useArcContributors hook, HumanTradingCard component, and existing UI patterns
 */

import React, { useEffect, useMemo } from 'react';
import { useArcContributors } from '@/hooks/useArcContributors';
import { HumanTradingCard } from '@/components/human/HumanTradingCard';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  Loader2, Users, Trophy, ScrollText, History, Star, ExternalLink,
  Award, Sparkles, Rocket, Youtube, Medal, Crown
} from 'lucide-react';

// Video links for specific contributors (until added to database)
const CONTRIBUTOR_VIDEOS: Record<string, string> = {
  'Alexia Jolicoeur-Martineau': 'https://www.youtube.com/watch?v=P9zzUM0PrBM',
  'Team NVARC (JF Puget & Ivan Sorokin)': 'https://www.youtube.com/watch?v=t-mIRJJCbKg',
  'Jean-François Puget (2024 Paper)': 'https://www.youtube.com/watch?v=t-mIRJJCbKg',
};

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();

  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  // Categorize contributors for 2025 results
  const { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers, arc3Preview } = useMemo(() => {
    if (!data?.contributors) return { founders: [], topPaperAward2025: [], winners2025: [], winners2024: [], researchers: [], pioneers: [], arc3Preview: [] };

    const contributors = [...data.contributors];

    const founders = contributors.filter(c => c.category === 'founder');

    const topPaperAward2025 = contributors
      .filter(c => c.category === 'top_paper_award' && c.yearStart === 2025)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const winners2025 = contributors
      .filter(c => {
        if (!c.yearStart) return false;
        const endYear = c.yearEnd ?? 9999;
        return c.yearStart <= 2025 && endYear >= 2025 && c.category === 'competition_winner' && c.rank !== 0;
      })
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const winners2024 = contributors
      .filter(c => c.yearStart === 2024 && c.category === 'competition_winner' && c.rank !== 0)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const researchers = contributors
      .filter(c => ['paper_award', 'researcher'].includes(c.category) && c.rank !== 0)
      .sort((a, b) => b.yearStart! - a.yearStart!);

    const pioneers = contributors
      .filter(c => c.category === 'pioneer' || (c.yearStart && c.yearStart < 2024 && c.rank !== 0 && c.category !== 'founder'))
      .sort((a, b) => b.yearStart! - a.yearStart!);

    const arc3Preview = contributors
      .filter(c => c.category === 'arc3_preview')
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    return { founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers, arc3Preview };
  }, [data?.contributors]);

  // Inject YouTube video links into contributors (until stored in DB)
  const enrichContributor = (contributor: typeof winners2025[0]) => {
    const videoUrl = CONTRIBUTOR_VIDEOS[contributor.fullName];
    if (videoUrl && !contributor.links?.youtube) {
      return {
        ...contributor,
        links: { ...contributor.links, youtube: videoUrl }
      };
    }
    return contributor;
  };

  if (error) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
        <div className="container mx-auto px-4 py-6">
          <div className="rounded-md border border-red-900 bg-red-950/30 p-4">
            <span className="text-red-200">Failed to load data. Please try again later.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-200">
      {/* Subtle top gradient accent */}
      <div className="fixed top-0 inset-x-0 h-48 bg-gradient-to-b from-amber-900/10 via-zinc-950/50 to-transparent pointer-events-none" />

      <div className="relative container mx-auto px-4 py-4 space-y-5">

        {/* Compact Hall of Fame Header */}
        <header className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                <Crown className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                  ARC Hall of Fame
                  <span className="text-xs font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    2025
                  </span>
                </h1>
                <p className="text-sm text-zinc-500">Celebrating brilliant minds pushing AGI boundaries</p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://www.kaggle.com/competitions/arc-prize-2025/leaderboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-sky-900/50 text-zinc-300 hover:text-sky-300 px-3 py-1.5 rounded-md border border-zinc-700/50 hover:border-sky-500/50 transition-all"
              >
                <Medal className="w-3.5 h-3.5" />
                Kaggle Leaderboard
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              <a
                href="https://www.youtube.com/@ARCprize"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-red-900/50 text-zinc-300 hover:text-red-300 px-3 py-1.5 rounded-md border border-zinc-700/50 hover:border-red-500/50 transition-all"
              >
                <Youtube className="w-3.5 h-3.5" />
                Winner Talks
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-zinc-500">Loading profiles...</p>
          </div>
        ) : (
          <>
            {/* Founders - Compact Banner */}
            {founders.length > 0 && (
              <section>
                {founders.map(founder => (
                  <Dialog key={founder.id}>
                    <div className="border border-zinc-800 bg-zinc-900/60 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-zinc-700 bg-black hover:border-amber-500/60 transition-all hover:scale-105"
                        >
                          {founder.imageUrl && (
                            <img src={founder.imageUrl} alt={founder.fullName} className="w-full h-full object-cover" />
                          )}
                        </button>
                      </DialogTrigger>

                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80 flex items-center gap-1.5 mb-0.5">
                          <Users className="w-3 h-3" /> Founders & Organizers
                        </p>
                        <h2 className="text-lg font-bold text-zinc-100 truncate">{founder.fullName}</h2>
                        {founder.achievement && (
                          <p className="text-xs text-zinc-500 truncate">{founder.achievement}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-zinc-500">
                          {founder.yearStart}{founder.yearEnd ? `–${founder.yearEnd}` : '–Present'}
                        </span>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-all"
                          >
                            View <ExternalLink className="w-3 h-3" />
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

            {/* 2025 Top Paper Award */}
            {topPaperAward2025.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-fuchsia-500/20 pb-2">
                  <Award className="h-4 w-4 text-fuchsia-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2025 Top Paper Award</h2>
                  <span className="ml-auto text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/30 uppercase tracking-wider font-bold">
                    Featured
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {topPaperAward2025.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* 2025 Competition Winners */}
            {winners2025.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2025 Competition Winners</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {winners2025.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* 2024 Winners */}
            {winners2024.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2">
                  <Star className="h-4 w-4 text-blue-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2024 ARC Prize Winners</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {winners2024.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* Research & Awards */}
            {researchers.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                  <ScrollText className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-lg font-bold text-zinc-100">Research & Awards</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {researchers.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* Pioneers */}
            {pioneers.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-violet-500/20 pb-2">
                  <History className="h-4 w-4 text-violet-400" />
                  <h2 className="text-lg font-bold text-zinc-100">Pioneers</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {pioneers.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* ARC3 2026 Preview */}
            {arc3Preview.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2">
                  <Rocket className="h-4 w-4 text-cyan-400" />
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-100">ARC3 2026</h2>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                      Rising Stars
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {arc3Preview.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* Footer with additional resources */}
            <footer className="border-t border-zinc-800 pt-4 mt-6">
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
                <span>Learn more about ARC-AGI:</span>
                <a
                  href="https://www.kaggle.com/competitions/arc-prize-2025/leaderboard"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Medal className="w-3 h-3" /> Official Leaderboard
                </a>
                <a
                  href="https://www.youtube.com/@ARCprize"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Youtube className="w-3 h-3" /> ARC Prize YouTube
                </a>
                <a
                  href="https://arcprize.org"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> arcprize.org
                </a>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
