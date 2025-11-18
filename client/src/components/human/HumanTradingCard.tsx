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

  const ProfileImage = ({ className, showFeatured = false }: { className?: string, showFeatured?: boolean }) => (
    <div className={`relative group ${className}`}>
      <div className={`w-full h-full overflow-hidden rounded-lg border-2 ${cardData.colors.borderGradient} bg-slate-950 shadow-inner`}>
        {contributor.imageUrl ? (
          <img
            src={contributor.imageUrl}
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
      {showFeatured && cardData.featured && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-slate-900 rounded-full p-1 shadow-lg animate-pulse z-10">
          <Sparkles className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  const SocialLinks = () => (
    <div className="flex flex-wrap gap-2">
      {contributor.links?.twitter && (
        <a href={contributor.links.twitter} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-blue-900/30 text-slate-300 hover:text-blue-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-blue-500/30 transition-all">
          <Twitter className="w-3 h-3" /> Twitter
        </a>
      )}
      {contributor.links?.github && (
        <a href={contributor.links.github} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition-all">
          <Github className="w-3 h-3" /> GitHub
        </a>
      )}
      {contributor.links?.website && (
        <a href={contributor.links.website} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-emerald-900/30 text-slate-300 hover:text-emerald-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-emerald-500/30 transition-all">
          <Globe className="w-3 h-3" /> Website
        </a>
      )}
      {contributor.links?.papers && contributor.links.papers.length > 0 && (
        <a href={contributor.links.papers[0]} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-indigo-900/30 text-slate-300 hover:text-indigo-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-indigo-500/30 transition-all">
          <BookOpen className="w-3 h-3" /> Paper
        </a>
      )}
      {contributor.links?.linkedin && (
        <a href={contributor.links.linkedin} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-blue-900/30 text-slate-300 hover:text-blue-500 px-2.5 py-1.5 rounded border border-slate-700 hover:border-blue-500/30 transition-all">
          <Linkedin className="w-3 h-3" /> LinkedIn
        </a>
      )}
      {contributor.links?.kaggle && (
        <a href={contributor.links.kaggle} target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-sky-900/30 text-slate-300 hover:text-sky-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-sky-500/30 transition-all">
          <ExternalLink className="w-3 h-3" /> Kaggle
        </a>
      )}
    </div>
  );

  return (
    <>
      <Dialog>
        <div className="w-full h-full flex flex-col">
          <div className={`relative rounded-lg border bg-slate-900 ${cardData.colors.borderGradient} flex flex-col overflow-hidden hover:border-slate-400 transition-all duration-200 shadow-lg h-full`}>
            
            {/* Card Header */}
            <div className="p-5 flex gap-4 items-start border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
              {/* Avatar / GIF - Click to view full size */}
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                    <ProfileImage className="w-20 h-20" showFeatured={true} />
                  </div>
                </DialogTrigger>
                <DialogContent className="bg-transparent border-none shadow-none p-0 flex items-center justify-center max-w-[90vw] max-h-[90vh]">
                  <div className="relative">
                    {contributor.imageUrl ? (
                       <img
                         src={contributor.imageUrl}
                         alt={contributor.fullName}
                         className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg shadow-2xl border-2 border-slate-700 bg-black"
                       />
                    ) : (
                       <img
                         src={gifUrl}
                         alt="Profile"
                         className="max-w-[85vw] max-h-[85vh] object-contain image-pixelated rounded-lg shadow-2xl border-2 border-slate-700 bg-black"
                       />
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Name & Title */}
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-xl font-bold text-slate-100 truncate leading-tight tracking-tight">
                  {contributor.fullName}
                </h3>
                {contributor.handle && (
                  <p className={`text-xs font-mono mb-2 ${cardData.colors.textColor}`}>@{contributor.handle}</p>
                )}
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`${cardData.colors.accentColor} border-opacity-50 uppercase text-[10px] tracking-wider`}>
                    {cardData.icon} {cardData.categoryName}
                  </Badge>
                  
                  {contributor.rank && contributor.rank <= 3 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase text-[10px] tracking-wider">
                      Rank #{contributor.rank}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-1 flex flex-col gap-5 bg-gradient-to-b from-slate-900 to-slate-950">
              
              {/* Key Achievement */}
              <div className="bg-slate-800/30 rounded-md p-3 border border-slate-800/50">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Achievement
                </div>
                <p className="text-sm font-medium text-slate-200 leading-relaxed">
                  {contributor.achievement}
                </p>
              </div>

              {/* Description Preview */}
              <div className="flex-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contribution</div>
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                  {contributor.description}
                </p>
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-800/50">
                <div className="text-xs">
                  <span className="text-slate-500 mr-2">Active:</span>
                  <span className="text-slate-300 font-mono">{cardData.yearRange}</span>
                </div>
                {contributor.score && (
                  <div className="text-xs text-right">
                    <span className="text-slate-500 mr-2">Score:</span>
                    <span className={`font-mono font-bold ${cardData.colors.textColor}`}>{contributor.score}</span>
                  </div>
                )}
              </div>

              {/* View Full Profile Button (Modal Trigger) */}
              <DialogTrigger asChild>
                <button 
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider rounded transition-colors bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                >
                  View Full Profile <ExternalLink className="w-3 h-3" />
                </button>
              </DialogTrigger>

            </div>
          </div>
        </div>

        {/* Modal Content */}
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-6 pb-4 border-b border-slate-800">
              <div className="flex-shrink-0 mt-1">
                <ProfileImage className="w-24 h-24" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-slate-100 mb-2">
                  {contributor.fullName}
                </DialogTitle>
                
                <div className="flex flex-wrap gap-2 mb-3">
                   <Badge variant="outline" className={`${cardData.colors.accentColor} border-opacity-50 uppercase text-[10px] tracking-wider`}>
                    {cardData.icon} {cardData.categoryName}
                  </Badge>
                  {contributor.handle && (
                    <span className="text-sm font-mono text-slate-400">@{contributor.handle}</span>
                  )}
                </div>

                <DialogDescription className="text-slate-400">
                  {contributor.affiliation}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Achievement</div>
                <div className="text-sm font-medium text-slate-200">{contributor.achievement}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                 <div className="text-xs font-bold text-slate-500 uppercase mb-1">Best Score</div>
                 <div className={`text-sm font-bold ${cardData.colors.textColor}`}>{contributor.score || 'N/A'}</div>
              </div>
            </div>

            {/* Full Description */}
            <div>
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">About</h4>
              <p className="text-slate-400 leading-relaxed">
                {contributor.description}
              </p>
            </div>

            {/* Technical Details */}
            <div className="grid md:grid-cols-2 gap-6">
              {contributor.approach && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Methodology
                  </h4>
                  <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800/50 text-sm text-slate-400 leading-relaxed">
                    {contributor.approach}
                  </div>
                </div>
              )}

              {contributor.uniqueTechnique && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" /> Innovation
                  </h4>
                  <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800/50 text-sm text-slate-400 leading-relaxed">
                    {contributor.uniqueTechnique}
                  </div>
                </div>
              )}
            </div>

            {/* Resources */}
            {contributor.links && Object.keys(contributor.links).length > 0 && (
               <div>
                  <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Resources & Links</h4>
                  <SocialLinks />
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
