/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: TypeScript types for ARC contributor trading cards.
 * Defines the data structure for notable human contributors to the ARC-AGI challenge.
 * SRP/DRY check: Pass - Single responsibility for contributor type definitions
 */

export interface ArcContributor {
  id: number;
  fullName: string;
  handle: string | null;
  affiliation: string | null;
  achievement: string;
  description: string;
  yearStart: number | null;
  yearEnd: number | null;
  score: string | null;
  approach: string | null;
  uniqueTechnique: string | null;
  links: {
    twitter?: string;
    github?: string;
    website?: string;
    kaggle?: string;
    papers?: string[];
    linkedin?: string;
    substack?: string;
  };
  teamName: string | null;
  category: ContributorCategory;
  imageUrl: string | null;
  rank: number | null;
  createdAt?: Date;
}

export type ContributorCategory =
  | 'competition_winner'
  | 'paper_award'
  | 'top_paper_award'
  | 'researcher'
  | 'founder'
  | 'pioneer';

export interface ArcContributorsResponse {
  contributors: ArcContributor[];
  total: number;
}

export interface CreateContributorRequest {
  fullName: string;
  handle?: string;
  affiliation?: string;
  achievement: string;
  description: string;
  yearStart?: number;
  yearEnd?: number;
  score?: string;
  approach?: string;
  uniqueTechnique?: string;
  links?: ArcContributor['links'];
  teamName?: string;
  category: ContributorCategory;
  imageUrl?: string;
  rank?: number;
}
