/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-06
 * PURPOSE: ARC Hall of Fame page - information-dense display of ARC contributors as trading cards.
 * Updated for ARC Prize 2025 results announcement (December 5, 2025).
 * Features compact card grid layout, Hall of Fame header, and external resource links.
 * SRP/DRY check: Pass - Reuses useArcContributors hook, HumanTradingCard component, and existing UI patterns
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useArcContributors } from '@/hooks/useArcContributors';
import { useFirstVisit } from '@/hooks/useFirstVisit';
import { HumanTradingCard } from '@/components/human/HumanTradingCard';
import { CardPackOpening } from '@/components/human/CardPackOpening';
import { TeamWinnerGroup } from '@/components/human/TeamWinnerGroup';
import { teamWinnersConfig } from '@/constants/teamWinners';
import { normalizeTeamName } from '@/utils/teamNameNormalizer';
import { splitTeamIntoMembers } from '@/utils/humanCardHelpers';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  Loader2, Users, Trophy, ScrollText, History, Star, ExternalLink,
  Award, Sparkles, Rocket, Youtube, Medal, Crown
} from 'lucide-react';

// Video links for specific contributors (until added to database)
const CONTRIBUTOR_VIDEOS: Record<string, string> = {
  'Alexia Jolicoeur-Martineau': 'https://www.youtube.com/watch?v=P9zzUM0PrBM',
  'Team NVARC (Jean-François Puget & Ivan Sorokin)': 'https://www.youtube.com/watch?v=t-mIRJJCbKg',
  'Jean-François Puget (2024 Paper)': 'https://www.youtube.com/watch?v=t-mIRJJCbKg',
};

export default function HumanTradingCards() {
  const { data, isLoading, error } = useArcContributors();
  const { isFirstVisit, markVisited } = useFirstVisit();
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    document.title = 'ARC Hall of Fame';
  }, []);

  const handleAnimationComplete = () => {
    setAnimationComplete(true);
    markVisited();
  };

  // Show animation on first visit (if not already complete)
  const shouldShowAnimation = isFirstVisit === true && !animationComplete;

  // Categorize contributors for 2025 results
  const { founders, topPaperAward2025, competitionWinners2025, winners2024, researchers, pioneers, arc3Preview } = useMemo(() => {
    if (!data?.contributors) return { founders: [], topPaperAward2025: [], competitionWinners2025: [], winners2024: [], researchers: [], pioneers: [], arc3Preview: [] };

    const contributors = [...data.contributors];

    const founders = contributors.filter(c => c.category === 'founder');

    const topPaper2025Winners = contributors
      .filter(c => c.category === 'top_paper_award' && c.yearStart === 2025);

    const paperAwards2025 = contributors
      .filter(c => c.category === 'paper_award' && c.yearStart === 2025 && c.rank !== 0);

    const topPaperAward2025 = [...topPaper2025Winners, ...paperAwards2025]
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // All 2025 competition winners
    const allWinners2025 = contributors
      .filter(c => {
        if (!c.yearStart) return false;
        const endYear = c.yearEnd ?? 9999;
        return c.yearStart <= 2025 && endYear >= 2025 && c.category === 'competition_winner' && c.rank !== 0;
      })
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // Process each 2025 competition winner
    const competitionWinners2025 = allWinners2025.map(winner => {
      // Check if this is a team with dual images that should be split into individual cards
      const hasMultipleImages = winner.imageUrl?.includes(',');

      if (hasMultipleImages) {
        // Teams like NVARC and MindsAI with dual images
        // Extract member names from fullName (e.g., "Team NVARC (Jean-François Puget & Ivan Sorokin)")
        const memberNamesMatch = winner.fullName.match(/\((.*?)\)/);
        if (memberNamesMatch) {
          const memberNamesPart = memberNamesMatch[1];
          const memberNames = memberNamesPart.split('&').map(name => name.trim());
          const memberCards = splitTeamIntoMembers(winner, memberNames);

          return {
            type: 'team_with_members' as const,
            teamContributor: winner,
            members: memberCards,
            rank: winner.rank || 999
          };
        }
      }

      // Single person or team without individual member cards (like ARChitects)
      return {
        type: 'solo' as const,
        contributor: winner,
        rank: winner.rank || 999
      };
    });

    const winners2024 = contributors
      .filter(c => c.yearStart === 2024 && c.category === 'competition_winner' && c.rank !== 0)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const researchers = contributors
      .filter(c =>
        ['paper_award', 'researcher'].includes(c.category) &&
        c.rank !== 0 &&
        !(c.category === 'paper_award' && c.yearStart === 2025)
      )
      .sort((a, b) => b.yearStart! - a.yearStart!);

    const pioneers = contributors
      .filter(c => c.category === 'pioneer' || (c.yearStart && c.yearStart < 2024 && c.rank !== 0 && c.category !== 'founder'))
      .sort((a, b) => b.yearStart! - a.yearStart!);

    const arc3Preview = contributors
      .filter(c => c.category === 'arc3_preview')
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));

    return { founders, topPaperAward2025, competitionWinners2025, winners2024, researchers, pioneers, arc3Preview };
  }, [data?.contributors]);

  // Inject YouTube video links into contributors (until stored in DB)
  const enrichContributor = (contributor: any) => {
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

  // Show animation overlay on first visit
  if (shouldShowAnimation) {
    return (
      <div className="min-h-screen w-full bg-zinc-950">
        <CardPackOpening onComplete={handleAnimationComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-200">
      {/* Subtle top gradient accent */}
      <div className="fixed top-0 inset-x-0 h-48 bg-gradient-to-b from-amber-900/10 via-zinc-950/50 to-transparent pointer-events-none" />

      <div className="relative container mx-auto px-4 py-3 space-y-4">

        {/* Compact Hall of Fame Header */}
        <header className="border-b border-zinc-800 pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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

            {/* 2025 Paper Awards */}
            {topPaperAward2025.length > 0 && (
              <section id="2025-top-paper-award" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-fuchsia-500/20 pb-2">
                  <Award className="h-4 w-4 text-fuchsia-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2025 Paper Awards</h2>
                  <span className="ml-auto text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/30 uppercase tracking-wider font-bold">
                    Featured
                  </span>
                </div>
                {/* Horizontal layout with larger cards and placement indicators */}
                <div className="flex flex-wrap justify-center gap-6 py-2">
                  {topPaperAward2025.map((contributor, index) => {
                    const placementLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
                    const placementColors = ['text-amber-400', 'text-slate-400', 'text-orange-600'];
                    const placementLabel = placementLabels[index] || `#${index + 1}`;
                    const placementColor = placementColors[index] || 'text-zinc-400';

                    return (
                      <div key={contributor.id} className="flex flex-col items-center gap-2">
                        <span className={`text-sm font-bold ${placementColor} uppercase tracking-wide`}>
                          {placementLabel}
                        </span>
                        <div className="w-64 hover:scale-105 transition-transform duration-200">
                          <HumanTradingCard contributor={enrichContributor(contributor)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2025 Competition Winners */}
            {competitionWinners2025.length > 0 && (
              <section id="2025-competition-winners" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2025 Competition Winners</h2>
                </div>

                <div className="space-y-3">
                  {competitionWinners2025.map((winner, idx) => {
                    const rankLabel = winner.rank === 1 ? '🥇 1st Place' : winner.rank === 2 ? '🥈 2nd Place' : winner.rank === 3 ? '🥉 3rd Place' : `#${winner.rank}`;

                    if (winner.type === 'team_with_members') {
                      // Teams with individual member cards (NVARC, MindsAI)
                      const anchorId = `contributor-${winner.teamContributor.id}`;
                      return (
                        <div key={`team-${idx}`} id={anchorId} className="scroll-mt-20">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-bold text-amber-400">{rankLabel}</span>
                          </div>
                          <TeamWinnerGroup
                            teamContributor={enrichContributor(winner.teamContributor)}
                            members={winner.members.map(enrichContributor)}
                          />
                        </div>
                      );
                    } else {
                      // Solo winners or teams without individual cards (ARChitects)
                      const anchorId = `contributor-${winner.contributor.id}`;
                      return (
                        <div key={`solo-${idx}`} id={anchorId} className="scroll-mt-20">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-bold text-amber-400">{rankLabel}</span>
                          </div>
                          <div className="max-w-xs hover:scale-105 transition-transform duration-200">
                            <HumanTradingCard contributor={enrichContributor(winner.contributor)} />
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </section>
            )}

            {/* 2024 Winners */}
            {winners2024.length > 0 && (
              <section id="2024-winners" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2">
                  <Star className="h-4 w-4 text-blue-400" />
                  <h2 className="text-lg font-bold text-zinc-100">2024 ARC Prize Winners</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                  {winners2024.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* Research & Awards */}
            {researchers.length > 0 && (
              <section id="research-awards" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                  <ScrollText className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-lg font-bold text-zinc-100">Research & Awards</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                  {researchers.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* Pioneers */}
            {pioneers.length > 0 && (
              <section id="pioneers" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-violet-500/20 pb-2">
                  <History className="h-4 w-4 text-violet-400" />
                  <h2 className="text-lg font-bold text-zinc-100">Pioneers</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                  {pioneers.map(contributor => (
                    <HumanTradingCard key={contributor.id} contributor={enrichContributor(contributor)} />
                  ))}
                </div>
              </section>
            )}

            {/* ARC3 2026 Preview */}
            {arc3Preview.length > 0 && (
              <section id="arc3-preview" className="space-y-2 scroll-mt-20">
                <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2">
                  <Rocket className="h-4 w-4 text-cyan-400" />
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-100">ARC3 2026</h2>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                      Rising Stars
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
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
