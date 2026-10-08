/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Shared ARC Daily newspaper layout, query, date labels and source-aware story
 *          previews. All views read the same modest /api/news archive and typed contract.
 * SRP/DRY check: Pass — presentation helpers reuse shared news and competition identities.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { NEWS_NAME, newsArticlePath, competitorPath, type NewsArticle, type NewsIndex, type NewsCompetition, type CompetitorRecord } from '@shared/news';
import './news.css';

export function useNews() {
  return useQuery<NewsIndex>({ queryKey: ['/api/news'], staleTime: 60_000 });
}

export function newsDate(value: string, withTime = false): string {
  // Date-only edition labels must not roll back a day when displayed in Eastern Time.
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const : {}),
  }).format(date);
}

export const competitionName = (key: NewsCompetition) => KAGGLE_COMPETITIONS[key].label;
export const sortedArticles = (articles: NewsArticle[]) => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

export function NewsPaper({ children, frontPage = false, date }: { children: ReactNode; frontPage?: boolean; date?: string }) {
  return (
    <div className="arc-daily">
      <div className="news-paper">
        <header className="news-masthead">
          <div className="news-topline"><span>The independent competition desk</span><span>ARC-AGI-2 &amp; ARC-AGI-3</span></div>
          {frontPage ? <h1 className="news-name">{NEWS_NAME}</h1> : <Link href="/news" className="news-name">{NEWS_NAME}</Link>}
          <div className="news-motto">The moves. The margins. The race.</div>
          <div className="news-edition-line"><span>{date ? newsDate(date) : 'The competition newspaper'}</span><span>Morning &amp; evening · 6 am / 6 pm Eastern</span></div>
          <nav className="news-nav" aria-label="ARC Daily sections">
            <Link href="/news">Front page</Link>
            <Link href="/news/competitors">Competitor notebook</Link>
            <Link href="/kaggle-leaderboard">ARC-3 standings ↗</Link>
            <Link href="/kaggle-leaderboard/arc-2">ARC-2 standings ↗</Link>
          </nav>
        </header>
        {children}
        <footer className="news-footer">
          <strong>{NEWS_NAME}</strong><span>ARC Daily • GPT-6 SOL</span>
          <p>AI-written competition reporting from dated leaderboard observations and linked sources. Public standings are provisional; final results use the private leaderboard.</p>
          <Link href="/home">An ARC Explainer publication →</Link>
        </footer>
      </div>
    </div>
  );
}

export function NewsStatus({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="news-status" role="status">Opening the newspaper…</div>;
  if (error) return <div className="news-status" role="alert"><h2>The desk is temporarily unavailable</h2><p>We could not load the editions. Please try again.</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
  return null;
}

export function EditionLabel({ article }: { article: NewsArticle }) {
  return <div className="news-kicker"><span>{competitionName(article.competition)}</span><span>{article.id.endsWith('-preview') ? 'Launch preview' : article.edition === 'morning' ? 'Morning edition' : 'Evening edition'}</span></div>;
}

export function StoryPreview({ article, lead = false }: { article: NewsArticle; lead?: boolean }) {
  return <article className={lead ? 'news-story news-lead' : 'news-story'}>
    <EditionLabel article={article} />
    <h2><Link href={newsArticlePath(article.id)}>{article.headline}</Link></h2>
    <p className="news-dek">{article.dek}</p>
    <div className="news-byline">ARC Daily • GPT-6 SOL <span>· {newsDate(article.date)}</span></div>
    {lead && article.sections[0] && <p className="news-lead-excerpt">{article.sections[0].text}</p>}
    <Link href={newsArticlePath(article.id)} className="news-read">Read the dispatch →</Link>
  </article>;
}

export function NotebookEntry({ competitor }: { competitor: CompetitorRecord }) {
  return <article className="news-notebook-entry">
    <div className="news-kicker">{competitionName(competitor.competition)} · Team {competitor.teamId}</div>
    <h3><Link href={competitorPath(competitor.id)}>{competitor.name}</Link></h3>
    <p>{competitor.facts[0]?.text || 'A record of observed names, members and competition coverage.'}</p>
    <Link href={competitorPath(competitor.id)} className="news-read">Open the notebook →</Link>
  </article>;
}

export function ArticleArchive({ articles, heading = 'From the archive' }: { articles: NewsArticle[]; heading?: string }) {
  return <section className="news-archive" aria-label={heading}>
    <h2 className="news-section-title">{heading}</h2>
    {articles.length ? <ol>{articles.map(article => <li key={article.id}>
      <div className="news-archive-date"><time dateTime={article.publishedAt}>{newsDate(article.date)}</time><span>{article.edition === 'morning' ? 'Morning' : 'Evening'} · {competitionName(article.competition)}</span></div>
      <Link href={newsArticlePath(article.id)}>{article.headline}</Link>
    </li>)}</ol> : <p className="news-muted">No earlier editions have been published.</p>}
  </section>;
}
