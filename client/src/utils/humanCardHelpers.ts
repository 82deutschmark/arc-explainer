/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Helper utilities for Human Contributor Trading Cards.
 * Provides functions for formatting contributor data, determining card colors, and badge styles.
 * SRP/DRY check: Pass - Single responsibility for human trading card data formatting
 */

import type { ArcContributor, ContributorCategory } from '@shared/types/contributor';

/**
 * Get vibrant gradient colors for contributor category "team colors"
 * Returns gradient classes for card styling
 */
export function getCategoryGradient(category: ContributorCategory): {
  borderGradient: string;
  backgroundGradient: string;
  accentColor: string;
  textColor: string;
} {
  const gradients: Record<ContributorCategory, {
    borderGradient: string;
    backgroundGradient: string;
    accentColor: string;
    textColor: string;
  }> = {
    'competition_winner': {
      borderGradient: 'border-amber-500/50',
      backgroundGradient: 'bg-slate-900',
      accentColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      textColor: 'text-amber-500'
    },
    'paper_award': {
      borderGradient: 'border-blue-500/50',
      backgroundGradient: 'bg-slate-900',
      accentColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      textColor: 'text-blue-500'
    },
    'researcher': {
      borderGradient: 'border-emerald-500/50',
      backgroundGradient: 'bg-slate-900',
      accentColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      textColor: 'text-emerald-500'
    },
    'founder': {
      borderGradient: 'border-indigo-500/50',
      backgroundGradient: 'bg-slate-900',
      accentColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      textColor: 'text-indigo-500'
    },
    'pioneer': {
      borderGradient: 'border-slate-500/50',
      backgroundGradient: 'bg-slate-900',
      accentColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      textColor: 'text-slate-400'
    }
  };

  return gradients[category];
}

/**
 * Get display name for category
 */
export function getCategoryDisplayName(category: ContributorCategory): string {
  const names: Record<ContributorCategory, string> = {
    'competition_winner': 'Competition Winner',
    'paper_award': 'Paper Award',
    'researcher': 'Researcher',
    'founder': 'Founder & Organizer',
    'pioneer': 'Pioneer'
  };

  return names[category];
}

/**
 * Format year range for display
 */
export function formatYearRange(yearStart: number | null, yearEnd: number | null): string {
  if (!yearStart) return 'Unknown';
  if (!yearEnd) return `${yearStart}–Present`;
  if (yearStart === yearEnd) return `${yearStart}`;
  return `${yearStart}–${yearEnd}`;
}

/**
 * Get icon for category (emoji or lucide-react icon name)
 */
export function getCategoryIcon(category: ContributorCategory): string {
  const icons: Record<ContributorCategory, string> = {
    'competition_winner': '🏆',
    'paper_award': '📄',
    'researcher': '🔬',
    'founder': '🚀',
    'pioneer': '⭐'
  };

  return icons[category];
}

/**
 * Format achievement badge based on score
 */
export function formatAchievementBadge(contributor: ArcContributor): {
  text: string;
  variant: 'default' | 'secondary' | 'destructive';
} {
  // Extract percentage from score if available
  const scoreMatch = contributor.score?.match(/(\d+\.?\d*)%/);

  if (scoreMatch) {
    const scoreValue = parseFloat(scoreMatch[1]);

    if (scoreValue >= 70) {
      return { text: contributor.score!, variant: 'destructive' }; // Elite
    } else if (scoreValue >= 50) {
      return { text: contributor.score!, variant: 'default' }; // Strong
    } else {
      return { text: contributor.score!, variant: 'secondary' }; // Good
    }
  }

  // For non-percentage scores (like "1st Place")
  if (contributor.score?.includes('1st')) {
    return { text: contributor.score, variant: 'destructive' };
  } else if (contributor.score?.includes('2nd') || contributor.score?.includes('3rd')) {
    return { text: contributor.score, variant: 'default' };
  }

  // Default: show achievement text
  return {
    text: contributor.achievement.slice(0, 50) + (contributor.achievement.length > 50 ? '...' : ''),
    variant: 'secondary'
  };
}

/**
 * Get rank badge for display
 */
export function getRankBadge(rank: number | null): string | null {
  if (!rank) return null;

  if (rank === 1) return '🥇 #1';
  if (rank === 2) return '🥈 #2';
  if (rank === 3) return '🥉 #3';
  return `#${rank}`;
}

/**
 * Determine if contributor should have a "featured" badge
 */
export function isFeatured(contributor: ArcContributor): boolean {
  // Feature top 3 ranks, current record holders, or founders
  return (
    (contributor.rank !== null && contributor.rank <= 3) ||
    contributor.category === 'founder' ||
    (contributor.score?.includes('SOTA') ?? false) ||
    (contributor.score?.includes('Record') ?? false)
  );
}

/**
 * Format contributor card data for display
 */
export function formatContributorCard(contributor: ArcContributor) {
  const colors = getCategoryGradient(contributor.category);
  const categoryName = getCategoryDisplayName(contributor.category);
  const yearRange = formatYearRange(contributor.yearStart, contributor.yearEnd);
  const achievementBadge = formatAchievementBadge(contributor);
  const rankBadge = getRankBadge(contributor.rank);
  const icon = getCategoryIcon(contributor.category);
  const featured = isFeatured(contributor);

  return {
    colors,
    categoryName,
    yearRange,
    achievementBadge,
    rankBadge,
    icon,
    featured
  };
}
