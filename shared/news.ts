/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-07; 08-October-2026
 * PURPOSE: Shared public contract for sourced ARC Daily articles and competitor records,
 *          plus the one copy of their search/share wording: titles, descriptions, Eastern
 *          dates, share-card URLs and alt text, and NewsArticle structured data. Server HTML
 *          (newsPresentation.ts), the share-card renderer (newsCardImage.ts) and the React
 *          pages all read these, so a crawler, a link unfurl and in-app navigation agree.
 *          08-Oct-2026: added the share-card helpers and moved newsDate/competitionName here
 *          from client/src/components/news/NewsDesk.tsx (which re-exports them).
 * SRP/DRY check: Pass — server, browser and newsroom tooling share one documented shape;
 *          competition labels still come from shared/kaggleCompetitions.ts.
 */
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';

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
export const competitionName = (key: NewsCompetition) => KAGGLE_COMPETITIONS[key].label;
export const editionName = (edition: NewsEdition) => edition === 'morning' ? 'Morning' : 'Evening';
/** Edition kicker as printed on the page and the card; launch previews say so. */
export const editionLabel = (article: NewsArticle) => article.id.endsWith('-preview') ? 'Launch preview' : `${editionName(article.edition)} edition`;

/** Newspaper dates are Eastern. Date-only edition labels must not roll back a day. */
export function newsDate(value: string, withTime = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const : {}),
  }).format(date);
}

/**
 * Search results show roughly 60–65 characters of a title. Committed headlines are not
 * rewritten to fit; the masthead suffix is dropped instead when it would push past that.
 */
export const TITLE_BUDGET = 65;
export const newsTitle = (name: string) => `${name} | ${NEWS_NAME}`.length <= TITLE_BUDGET ? `${name} | ${NEWS_NAME}` : name;
export const articleTitle = (article: NewsArticle) => newsTitle(article.headline);
/** Dated lead-in when it fits a snippet (~160 characters), so each edition reads distinctly. */
export function articleDescription(article: NewsArticle): string {
  const dated = `${competitionName(article.competition)} ${editionName(article.edition).toLowerCase()} edition, ${newsDate(article.date)}: ${article.dek}`;
  return dated.length <= 160 ? dated : article.dek;
}
export const competitorTitle = (record: CompetitorRecord) => newsTitle(`${record.name} — ${competitionName(record.competition)} competitor`);
export const competitorDescription = (record: CompetitorRecord) =>
  `The ${competitionName(record.competition)} competitor notebook for ${record.name}: sourced background, observed team names and ARC Daily coverage.`;

/** Share cards: 1200x630, the size every major unfurler renders as a large image. */
export const NEWS_CARD_WIDTH = 1200;
export const NEWS_CARD_HEIGHT = 630;
/** Bump when the card layout changes, so cached article cards are fetched again. */
export const NEWS_CARD_DESIGN = 1;
/** Front page and notebook card. Not versioned: it follows the latest editions. */
export const NEWS_SECTION_CARD_PATH = '/api/news/og-image.png';
export const NEWS_SECTION_CARD_ALT = `${NEWS_NAME} masthead with the latest ARC-AGI-3 and ARC-AGI-2 headlines`;
/** The three leading rows of the article's own box score, the only standings a card shows. */
export const cardStandings = (article: NewsArticle) => [...article.stats].sort((a, b) => a.rank - b.rank).slice(0, 3);

/** FNV-1a: tiny, dependency-free and identical in Node and the browser. Not security. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
/** Changes whenever anything drawn on the article's card changes, so the URL can be immutable. */
export function articleCardVersion(article: NewsArticle): string {
  return shortHash(JSON.stringify([NEWS_CARD_DESIGN, article.headline, article.competition, article.edition, article.date,
    cardStandings(article).map(stat => [stat.rank, stat.name, stat.score, stat.rankChange])]));
}
export const articleCardPath = (article: NewsArticle) => `/api/news/og-image/${article.id}.png?v=${articleCardVersion(article)}`;
export function articleCardAlt(article: NewsArticle): string {
  const standings = cardStandings(article);
  return `${NEWS_NAME} front page for the ${competitionName(article.competition)} ${editionName(article.edition).toLowerCase()} edition of ${newsDate(article.date)}: “${article.headline}”${standings.length ? `, with the top ${standings.length} of the box score` : ''}.`;
}

/** Same article schema for initial HTML and in-app navigation. */
export function articleStructuredData(article: NewsArticle, origin: string): Record<string, unknown> {
  const url = `${origin}${newsArticlePath(article.id)}`;
  const publisher = { '@type': 'Organization', '@id': `${origin}/news#publisher`, name: NEWS_NAME, url: `${origin}/news`,
    logo: { '@type': 'ImageObject', url: `${origin}/android-chrome-512x512.png`, width: 512, height: 512 } };
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'NewsArticle', '@id': `${url}#article`, url, headline: article.headline, description: article.dek,
    datePublished: article.publishedAt, dateModified: article.publishedAt, inLanguage: 'en', isAccessibleForFree: true,
    image: [{ '@type': 'ImageObject', url: `${origin}${articleCardPath(article)}`, width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, caption: articleCardAlt(article) }],
    articleSection: competitionName(article.competition),
    author: { '@type': 'Organization', name: 'ARC Daily sports desk', url: `${origin}/news` },
    publisher, mainEntityOfPage: url, citation: [...new Set(article.sources.map(source => source.url))],
    isPartOf: { '@type': 'WebSite', name: 'ARC Explainer', url: `${origin}/` },
  }] };
}
