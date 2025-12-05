/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Trading card style component for ARC contributors inspired by 1980s baseball cards.
 * Shows contributor name, handle, achievement, category, and expandable details about their approach.
 * Reuses Badge component and card styling patterns from PuzzleTradingCard.
 * SRP/DRY check: Pass - Single responsibility for trading card display, reuses existing components
 */

import React, { useMemo, useState } from 'react';
import { formatContributorCard } from '@/utils/humanCardHelpers';
import { getRandomGif } from '@/utils/arcGifs';
import type { ArcContributor } from '@shared/types/contributor';
import { ExternalLink, Github, Twitter, Globe, BookOpen, Linkedin, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

interface HumanTradingCardProps {
  contributor: ArcContributor;
}

export const HumanTradingCard: React.FC<HumanTradingCardProps> = ({ contributor }) => {
  const cardData = formatContributorCard(contributor);

  // Get a stable random GIF for this contributor
  const gifUrl = useMemo(() => getRandomGif(contributor.id), [contributor.id]);

  // Handle multiple image URLs (comma-separated) - randomly pick one per render
  const selectedImageUrl = useMemo(() => {
    if (!contributor.imageUrl) return null;
    const imageUrls = contributor.imageUrl.split(',').map(url => url.trim());
    return imageUrls[Math.floor(Math.random() * imageUrls.length)];
  }, [contributor.imageUrl]);

  const ProfileImage = ({ className, showFeatured = false }: { className?: string, showFeatured?: boolean }) => (
    <div className={`relative group ${className}`}>
      <div className={`w-full h-full overflow-hidden rounded-xl border-2 ${cardData.colors.borderGradient} bg-zinc-950 shadow-inner`}>
        {selectedImageUrl ? (
          <img
            src={selectedImageUrl}
            alt={contributor.fullName}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={gifUrl}
            alt="Profile"
            className="w-full h-full object-cover image-pixelated opacity-90 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
      {/* Hover hint so it’s obvious the portrait is interactive */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="mb-2 rounded-full bg-zinc-800/80 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold tracking-wide text-zinc-400 border border-zinc-700/50 shadow-lg">
          Click to zoom
        </div>
      </div>
      {showFeatured && cardData.featured && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-br from-zinc-400 to-zinc-600 text-zinc-900 rounded-full p-1.5 shadow-lg shadow-zinc-500/30 animate-pulse z-10">
          <Sparkles className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  const SocialLinks = () => (
    <div className="flex flex-wrap gap-2">
      {contributor.links?.twitter && (
        <a href={contributor.links.twitter} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-blue-900/40 text-zinc-300 hover:text-blue-400 px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-blue-500/40 transition-all shadow-sm">
          <Twitter className="w-3.5 h-3.5" /> Twitter
        </a>
      )}
      {contributor.links?.github && (
        <a href={contributor.links.github} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-zinc-500 transition-all shadow-sm">
          <Github className="w-3.5 h-3.5" /> GitHub
        </a>
      )}
      {contributor.links?.website && (
        <a href={contributor.links.website} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-emerald-900/40 text-zinc-300 hover:text-emerald-400 px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-emerald-500/40 transition-all shadow-sm">
          <Globe className="w-3.5 h-3.5" /> Website
        </a>
      )}
      {contributor.links?.papers && contributor.links.papers.length > 0 && (
        <a href={contributor.links.papers[0]} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-indigo-900/40 text-zinc-300 hover:text-indigo-400 px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-indigo-500/40 transition-all shadow-sm">
          <BookOpen className="w-3.5 h-3.5" /> Paper
        </a>
      )}
      {contributor.links?.linkedin && (
        <a href={contributor.links.linkedin} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-blue-900/40 text-zinc-300 hover:text-blue-500 px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-blue-500/40 transition-all shadow-sm">
          <Linkedin className="w-3.5 h-3.5" /> LinkedIn
        </a>
      )}
      {contributor.links?.kaggle && (
        <a href={contributor.links.kaggle} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-sky-900/40 text-zinc-300 hover:text-sky-400 px-3 py-2 rounded-lg border border-zinc-700/50 hover:border-sky-500/40 transition-all shadow-sm">
          <ExternalLink className="w-3.5 h-3.5" /> Kaggle
        </a>
      )}
    </div>
  );

  return (
    <>
      <Dialog>
        <div className="w-full h-full flex flex-col">
          {/* IMAGE-FIRST CARD: Large artwork is the primary focus */}
          <div className={`relative rounded-xl border ${cardData.colors.borderGradient} overflow-hidden hover:border-zinc-400 transition-all duration-300 shadow-xl hover:shadow-2xl h-full group`}>
            
            {/* LARGE IMAGE - Primary Focus */}
            <div className="relative aspect-[3/4] w-full bg-black">
              {selectedImageUrl ? (
                <img
                  src={selectedImageUrl}
                  alt={contributor.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={gifUrl}
                  alt="Profile"
                  className="w-full h-full object-cover image-pixelated"
                />
              )}
              
              {/* Gradient overlay at bottom for text legibility */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              
              {/* Featured badge */}
              {cardData.featured && (
                <div className="absolute top-3 right-3 bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-900 rounded-full p-2 shadow-lg shadow-amber-500/30 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
              
              {/* Category badge */}
              <div className="absolute top-3 left-3">
                <Badge variant="outline" className={`${cardData.colors.accentColor} border-opacity-70 uppercase text-[10px] tracking-wider backdrop-blur-sm bg-black/50`}>
                  {cardData.icon} {cardData.categoryName}
                </Badge>
              </div>
              
              {/* Name overlay at bottom of image */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-xl font-bold text-white drop-shadow-lg leading-tight">
                  {contributor.fullName}
                </h3>
                {contributor.handle && (
                  <p className={`text-sm font-mono mt-1 ${cardData.colors.textColor}`}>@{contributor.handle}</p>
                )}
                {contributor.score && (
                  <p className={`text-sm font-mono font-bold mt-1 ${cardData.colors.textColor}`}>{contributor.score}</p>
                )}
              </div>
            </div>

            {/* Minimal footer with View Profile button */}
            <div className="p-3 bg-zinc-900/95">
              <DialogTrigger asChild>
                <button 
                  className="w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/50"
                >
                  View Full Profile <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </DialogTrigger>
            </div>
          </div>
        </div>

        {/* Modal Content - Side-by-side layout with prominent image */}
        <DialogContent className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-zinc-700/50 text-zinc-100 max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <div className="flex flex-col lg:flex-row">
            {/* Left: Large Image Panel */}
            <div className="lg:w-[45%] flex-shrink-0 bg-black/40 p-6 flex items-center justify-center">
              <div className="relative w-full max-w-md">
                {selectedImageUrl ? (
                  <img
                    src={selectedImageUrl}
                    alt={contributor.fullName}
                    className="w-full h-auto rounded-xl shadow-2xl border border-zinc-700/50"
                  />
                ) : (
                  <img
                    src={gifUrl}
                    alt="Profile"
                    className="w-full h-auto rounded-xl shadow-2xl border border-zinc-700/50 image-pixelated"
                  />
                )}
                {/* Floating category badge on image */}
                <div className="absolute bottom-4 left-4 right-4">
                  <Badge variant="outline" className={`${cardData.colors.accentColor} border-opacity-70 uppercase text-xs tracking-wider backdrop-blur-sm bg-black/60 px-3 py-1.5`}>
                    {cardData.icon} {cardData.categoryName}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Content Panel */}
            <div className="lg:w-[55%] p-6 lg:p-8 space-y-6 overflow-y-auto">
              {/* Header */}
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-3xl font-bold text-zinc-50 tracking-tight">
                  {contributor.fullName}
                </DialogTitle>
                {contributor.handle && (
                  <p className={`text-sm font-mono ${cardData.colors.textColor}`}>@{contributor.handle}</p>
                )}
                <DialogDescription className="text-zinc-400 text-base">
                  {contributor.affiliation}
                </DialogDescription>
              </DialogHeader>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Achievement</div>
                  <div className="text-sm font-medium text-zinc-200">{contributor.achievement}</div>
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Best Score</div>
                  <div className={`text-lg font-bold ${cardData.colors.textColor}`}>{contributor.score || 'N/A'}</div>
                </div>
              </div>

              {/* About */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2">About</h4>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  {contributor.description}
                </p>
              </div>

              {/* Technical Details */}
              {(contributor.approach || contributor.uniqueTechnique) && (
                <div className="space-y-4">
                  {contributor.approach && (
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" /> Methodology
                      </h4>
                      <div className="bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/30 text-sm text-zinc-400 leading-relaxed">
                        {contributor.approach}
                      </div>
                    </div>
                  )}

                  {contributor.uniqueTechnique && (
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-fuchsia-400" /> Innovation
                      </h4>
                      <div className="bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/30 text-sm text-zinc-400 leading-relaxed">
                        {contributor.uniqueTechnique}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resources */}
              {contributor.links && Object.keys(contributor.links).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Resources & Links</h4>
                  <SocialLinks />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
