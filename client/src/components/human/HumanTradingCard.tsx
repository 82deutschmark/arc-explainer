/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Trading card style component for ARC contributors inspired by 1980s baseball cards.
 * Shows contributor name, handle, achievement, category, and expandable details about their approach.
 * Reuses Badge component and card styling patterns from PuzzleTradingCard.
 * SRP/DRY check: Pass - Single responsibility for trading card display, reuses existing components
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatContributorCard } from '@/utils/humanCardHelpers';
import type { ArcContributor } from '@shared/types/contributor';
import { ChevronDown, ChevronUp, Trophy, Calendar, Users, Sparkles, ExternalLink } from 'lucide-react';

interface HumanTradingCardProps {
  contributor: ArcContributor;
}

export const HumanTradingCard: React.FC<HumanTradingCardProps> = ({ contributor }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const cardData = formatContributorCard(contributor);

  return (
    <div className="w-full">
      {/* Card Container with Category Color Border */}
      <div
        className={`relative rounded-2xl bg-gradient-to-br ${cardData.colors.borderGradient} p-1 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl`}
      >
        {/* Card Inner */}
        <div
          className={`relative rounded-xl bg-gradient-to-br ${cardData.colors.backgroundGradient} overflow-hidden`}
        >
          {/* Card Front */}
          <div className="p-6 space-y-4">
            {/* Header: Category Badge & Featured Badge */}
            <div className="flex items-start justify-between gap-2">
              <Badge
                className={`${cardData.colors.accentColor} text-white font-bold uppercase text-xs tracking-wider px-3 py-1`}
              >
                {cardData.icon} {cardData.categoryName}
              </Badge>
              {cardData.featured && (
                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold uppercase text-xs px-2 py-1">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  Featured
                </Badge>
              )}
            </div>

            {/* Profile Image or Icon Placeholder */}
            <div className="bg-white rounded-xl p-4 shadow-md border-2 border-white">
              <div className="flex items-center justify-center h-32">
                {contributor.imageUrl ? (
                  <img
                    src={contributor.imageUrl}
                    alt={contributor.fullName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-black shadow-lg">
                    {contributor.fullName.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Contributor Name (Large, Bold) */}
            <div className="text-center space-y-1">
              <h3 className="text-3xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {contributor.fullName}
              </h3>
              {contributor.handle && (
                <p className="text-sm font-mono text-purple-600 font-bold">@{contributor.handle}</p>
              )}
              {cardData.rankBadge && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-black text-sm px-3 py-1">
                  {cardData.rankBadge}
                </Badge>
              )}
            </div>

            {/* Achievement Badge - Baseball Card Style */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-purple-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm font-bold text-blue-600">Achievement</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {contributor.score && (
                    <Badge variant={cardData.achievementBadge.variant} className="font-black text-lg">
                      {cardData.achievementBadge.text}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Info Row */}
              <div className="mt-3 pt-3 border-t border-purple-200 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-700 font-semibold">{cardData.yearRange}</span>
                </div>
                {contributor.teamName && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-gray-700 font-semibold text-xs">{contributor.teamName}</span>
                  </div>
                )}
              </div>

              {contributor.affiliation && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-600 font-medium">{contributor.affiliation}</span>
                </div>
              )}
            </div>

            {/* Achievement Text */}
            <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-blue-200">
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                {contributor.achievement}
              </p>
            </div>

            {/* Expand Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${
                isExpanded
                  ? 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                  : `bg-gradient-to-r ${cardData.colors.borderGradient} text-white hover:opacity-90`
              }`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Details
                </>
              )}
            </button>
          </div>

          {/* Expanded Details - Card Back */}
          {isExpanded && (
            <div className="border-t-2 border-white bg-white/50 p-6 space-y-4 backdrop-blur-sm">
              <h4 className="text-lg font-black text-purple-700">
                About {contributor.fullName}
              </h4>

              {/* Description */}
              <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-blue-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {contributor.description}
                </p>
              </div>

              {/* Approach */}
              {contributor.approach && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-green-200">
                  <h5 className="text-sm font-black text-green-600 uppercase tracking-wide mb-2">
                    Approach
                  </h5>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {contributor.approach}
                  </p>
                </div>
              )}

              {/* Unique Technique */}
              {contributor.uniqueTechnique && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-orange-200">
                  <h5 className="text-sm font-black text-orange-600 uppercase tracking-wide mb-2">
                    Unique Technique
                  </h5>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {contributor.uniqueTechnique}
                  </p>
                </div>
              )}

              {/* Links */}
              {contributor.links && Object.keys(contributor.links).length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-pink-200">
                  <h5 className="text-sm font-black text-pink-600 uppercase tracking-wide mb-3">
                    Links & Resources
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {contributor.links.twitter && (
                      <a
                        href={contributor.links.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Twitter
                      </a>
                    )}
                    {contributor.links.github && (
                      <a
                        href={contributor.links.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        GitHub
                      </a>
                    )}
                    {contributor.links.website && (
                      <a
                        href={contributor.links.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {contributor.links.kaggle && (
                      <a
                        href={contributor.links.kaggle}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full hover:bg-cyan-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Kaggle
                      </a>
                    )}
                    {contributor.links.substack && (
                      <a
                        href={contributor.links.substack}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Substack
                      </a>
                    )}
                    {contributor.links.linkedin && (
                      <a
                        href={contributor.links.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        LinkedIn
                      </a>
                    )}
                    {contributor.links.papers && contributor.links.papers.length > 0 && (
                      contributor.links.papers.map((paperUrl, idx) => (
                        <a
                          key={idx}
                          href={paperUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Paper {idx + 1}
                        </a>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
