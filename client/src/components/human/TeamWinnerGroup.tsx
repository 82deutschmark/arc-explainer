/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Component that renders a 2025 ARC Prize team winner as a grouped display.
 * Shows the team-level card with both member images side-by-side, alongside individual member cards.
 * Designed for Hall of Fame "2025 Competition Winners" section.
 * SRP/DRY check: Pass - Single responsibility for team winner group layout and rendering.
 */

import React from 'react';
import { HumanTradingCard } from './HumanTradingCard';
import { formatContributorCard } from '@/utils/humanCardHelpers';
import { getRandomGif } from '@/utils/arcGifs';
import type { ArcContributor } from '@shared/types/contributor';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

interface TeamWinnerGroupProps {
  teamContributor: ArcContributor;
  members: ArcContributor[];
}

export const TeamWinnerGroup: React.FC<TeamWinnerGroupProps> = ({ teamContributor, members }) => {
  const cardData = formatContributorCard(teamContributor);
  const gifUrl = useMemo(() => getRandomGif(teamContributor.id), [teamContributor.id]);

  // Parse comma-separated image URLs for team card dual-image display
  const teamImageUrls = useMemo(() => {
    if (!teamContributor.imageUrl) return [];
    return teamContributor.imageUrl
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);
  }, [teamContributor.imageUrl]);

  // Team card with side-by-side images
  const TeamCardWithDualImages = () => (
    <div className="w-full h-full flex flex-col max-w-sm mx-auto">
      <div className={`relative rounded-xl border ${cardData.colors.borderGradient} overflow-hidden shadow-xl h-full flex flex-col`}>
        {/* Dual image display - side by side */}
        <div className="relative aspect-[3/4] w-full bg-black flex">
          {teamImageUrls.length >= 2 ? (
            <>
              {/* Left image */}
              <div className="flex-1 overflow-hidden border-r border-zinc-700">
                <img
                  src={teamImageUrls[0]}
                  alt={teamContributor.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Right image */}
              <div className="flex-1 overflow-hidden">
                <img
                  src={teamImageUrls[1]}
                  alt={teamContributor.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
            </>
          ) : teamImageUrls.length === 1 ? (
            <img
              src={teamImageUrls[0]}
              alt={teamContributor.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={gifUrl}
              alt="Team Profile"
              className="w-full h-full object-cover image-pixelated opacity-90"
            />
          )}

          {/* Gradient overlay at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

          {/* Category badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className={`${cardData.colors.accentColor} border-opacity-70 uppercase text-[9px] tracking-wider backdrop-blur-sm bg-black/50`}>
              🏆 Team
            </Badge>
          </div>

          {/* Name overlay at bottom of image */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="text-lg font-bold text-white drop-shadow-lg leading-tight">
              {teamContributor.fullName}
            </h3>
            {teamContributor.score && (
              <p className={`text-xs font-mono font-bold mt-0.5 ${cardData.colors.textColor}`}>{teamContributor.score}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full border border-zinc-700/50 rounded-xl bg-gradient-to-br from-zinc-900/50 to-black/50 p-4 shadow-lg">
      {/* Desktop: side-by-side layout */}
      <div className="hidden md:flex gap-4">
        {/* Left: Team card */}
        <div className="flex-shrink-0 w-full max-w-xs">
          <TeamCardWithDualImages />
        </div>

        {/* Right: Member cards in 2-column grid */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {members.map(member => (
            <div key={member.id} className="flex justify-center">
              <div className="w-full max-w-[240px]">
                <HumanTradingCard contributor={member} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Stacked vertical layout */}
      <div className="flex md:hidden flex-col gap-4">
        {/* Team card */}
        <div className="w-full max-w-sm mx-auto">
          <TeamCardWithDualImages />
        </div>

        {/* Member cards stacked */}
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="flex justify-center">
              <div className="w-full max-w-[280px]">
                <HumanTradingCard contributor={member} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
