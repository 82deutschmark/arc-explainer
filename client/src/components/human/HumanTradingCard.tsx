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
import { ExternalLink, Github, Twitter, Globe, BookOpen, Linkedin, ChevronDown, ChevronUp, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HumanTradingCardProps {
  contributor: ArcContributor;
}

export const HumanTradingCard: React.FC<HumanTradingCardProps> = ({ contributor }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardData = formatContributorCard(contributor);
  
  // Get a stable random GIF for this contributor
  const gifUrl = useMemo(() => getRandomGif(contributor.id), [contributor.id]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className={`relative rounded-lg border bg-slate-900 ${cardData.colors.borderGradient} flex flex-col overflow-hidden hover:border-slate-400 transition-all duration-200 shadow-lg h-full`}>
        
        {/* Card Header */}
        <div className="p-5 flex gap-4 items-start border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
          {/* Avatar / GIF */}
          <div className="flex-shrink-0 relative group">
            <div className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${cardData.colors.borderGradient} bg-slate-950 shadow-inner`}>
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
            {cardData.featured && (
              <div className="absolute -top-2 -right-2 bg-amber-500 text-slate-900 rounded-full p-1 shadow-lg animate-pulse">
                <Sparkles className="w-3 h-3" />
              </div>
            )}
          </div>

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

          {/* Description */}
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contribution</div>
            <p className={`text-sm text-slate-400 leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
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

          {/* Expandable Details Section */}
          {isExpanded && (
            <div className="space-y-5 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Approach */}
              {contributor.approach && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">
                    Methodology & Approach
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800/30">
                    {contributor.approach}
                  </p>
                </div>
              )}

              {/* Unique Technique */}
              {contributor.uniqueTechnique && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-1">
                    Unique Innovation
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800/30">
                    {contributor.uniqueTechnique}
                  </p>
                </div>
              )}

              {/* Affiliation */}
              {contributor.affiliation && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Affiliation</div>
                  <p className="text-sm text-slate-400">{contributor.affiliation}</p>
                </div>
              )}

              {/* Links */}
              {contributor.links && Object.keys(contributor.links).length > 0 && (
                <div className="pt-2">
                   <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Resources</div>
                   <div className="flex flex-wrap gap-2">
                    {contributor.links.twitter && (
                      <a href={contributor.links.twitter} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-blue-900/30 text-slate-300 hover:text-blue-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-blue-500/30 transition-all">
                        <Twitter className="w-3 h-3" /> Twitter
                      </a>
                    )}
                    {contributor.links.github && (
                      <a href={contributor.links.github} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition-all">
                        <Github className="w-3 h-3" /> GitHub
                      </a>
                    )}
                    {contributor.links.website && (
                      <a href={contributor.links.website} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-emerald-900/30 text-slate-300 hover:text-emerald-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-emerald-500/30 transition-all">
                        <Globe className="w-3 h-3" /> Website
                      </a>
                    )}
                    {contributor.links.papers && contributor.links.papers.length > 0 && (
                      <a href={contributor.links.papers[0]} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-indigo-900/30 text-slate-300 hover:text-indigo-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-indigo-500/30 transition-all">
                        <BookOpen className="w-3 h-3" /> Paper
                      </a>
                    )}
                    {contributor.links.linkedin && (
                      <a href={contributor.links.linkedin} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-blue-900/30 text-slate-300 hover:text-blue-500 px-2.5 py-1.5 rounded border border-slate-700 hover:border-blue-500/30 transition-all">
                        <Linkedin className="w-3 h-3" /> LinkedIn
                      </a>
                    )}
                    {contributor.links.kaggle && (
                      <a href={contributor.links.kaggle} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-sky-900/30 text-slate-300 hover:text-sky-400 px-2.5 py-1.5 rounded border border-slate-700 hover:border-sky-500/30 transition-all">
                        <ExternalLink className="w-3 h-3" /> Kaggle
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expand Toggle Button */}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full mt-2 py-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider rounded transition-colors ${isExpanded ? 'bg-slate-800 text-slate-400' : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
          >
            {isExpanded ? (
              <>Show Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>View Full Profile <ChevronDown className="w-3 h-3" /></>
            )}
          </button>

        </div>
      </div>
    </div>
  );
};
