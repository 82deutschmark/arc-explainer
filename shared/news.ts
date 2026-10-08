/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Shared public contract for sourced ARC Daily articles and competitor records.
 * SRP/DRY check: Pass — server, browser and newsroom tooling share one documented shape.
 */
export type NewsCompetition = 'arc-3' | 'arc-2';
export type NewsEdition = 'morning' | 'evening';
export interface NewsSource { id: string; title: string; url: string; accessedAt: string }
export interface NewsSection { heading?: string; text: string; sourceIds: string[] }
export interface NewsStat { teamId: string; name: string; rank: number; score: number; rankChange: number | null; scoreChange: number | null }
export interface NewsArticle {
  id: string; date: string; edition: NewsEdition; competition: NewsCompetition;
  headline: string; dek: string; sections: NewsSection[]; teamIds: string[];
  sources: NewsSource[]; publishedAt: string; dataAsOf: string;
  baselineAt: string | null; generatedBy: 'gpt-6-sol'; stats: NewsStat[];
  coverageNote: string; discord: string;
}
export interface CompetitorFact { text: string; sourceUrl: string; sourceTitle: string; checkedAt: string }
export interface CompetitorRecord {
  id: string; competition: NewsCompetition; teamId: string; name: string;
  aliases: string[]; members: string[]; firstObservedAt: string; lastObservedAt: string;
  facts: CompetitorFact[];
}
export interface NewsIndex { articles: NewsArticle[]; competitors: CompetitorRecord[] }
export const NEWS_NAME = 'The ARC Daily';
export const newsArticlePath = (id: string) => `/news/${id}`;
export const competitorPath = (id: string) => `/news/competitors/${id}`;

/** Same article schema for initial HTML and in-app navigation. */
export function articleStructuredData(article: NewsArticle, origin: string, image: string): Record<string, unknown> {
  const url = `${origin}${newsArticlePath(article.id)}`;
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'NewsArticle', '@id': `${url}#article`, url, headline: article.headline, description: article.dek,
    datePublished: article.publishedAt, dateModified: article.publishedAt, inLanguage: 'en',
    image: [image], articleSection: article.competition === 'arc-2' ? 'ARC-AGI-2' : 'ARC-AGI-3',
    author: { '@type': 'Organization', name: 'ARC Daily sports desk', url: `${origin}/news` },
    publisher: { '@type': 'Organization', name: NEWS_NAME, url: `${origin}/news` },
    mainEntityOfPage: url, citation: article.sources.map(source => source.url),
    isPartOf: { '@type': 'WebSite', name: 'ARC Explainer', url: `${origin}/` },
  }] };
}
