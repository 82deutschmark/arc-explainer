/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-08
 * PURPOSE: Shared ARC Daily newspaper layout, query, date labels and source-aware story
 *          previews. All views read the same modest /api/news archive and typed contract.
 *          08-Oct-2026: newsDate/competitionName now live in shared/news.ts; visual shell
 *          and sourced notebook previews align with the ARC Explainer landing page.
 *          The masthead now names both contests and links the established ARC Discord.
 * SRP/DRY check: Pass — presentation helpers reuse shared news and competition identities.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { NEWS_NAME, newsArticlePath, competitorPath, newsDate, competitionName, editionLabel, type NewsArticle, type NewsIndex, type CompetitorRecord } from '@shared/news';
import './news.css';

/** The public ARC Prize Discord invite already used by ARC Explainer's other pages. */
export const ARC_DISCORD_URL = 'https://discord.gg/9b77dPAmcA';

export function useNews() {
  return useQuery<NewsIndex>({ queryKey: ['/api/news'], staleTime: 60_000 });
}

// Date labels and competition names moved to shared/news.ts on 08-Oct-2026 so server HTML,
// share cards and these views print them identically.
export { newsDate, competitionName };

export const sortedArticles = (articles: NewsArticle[]) => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

export function NewsPaper({ children, frontPage = false, date }: { children: ReactNode; frontPage?: boolean; date?: string }) {
  return (
    <div className="arc-daily">
      <div className="news-paper">
        <header className="news-masthead">
          <div className="news-topline"><span><Link href="/home">ARC Explainer</Link> / The competition desk</span><span>ARC-AGI-3 &amp; ARC-AGI-2</span></div>
          {frontPage ? <div className="news-name">{NEWS_NAME}</div> : <Link href="/news" className="news-name">{NEWS_NAME}</Link>}
          <div className="news-motto">The moves. The margins. The race.</div>
          <div className="news-edition-line"><span>{date ? newsDate(date) : 'The competition newspaper'}</span><span>Two Kaggle contests. One daily paper.</span></div>
          <nav className="news-nav" aria-label="ARC Daily sections">
            <Link href="/news">Front page</Link>
            <Link href="/news/competitors">Competitor notebook</Link>
            <a href="/kaggle-leaderboard#medal-race">Leaderboard graphics ↗</a>
            <a href="/human-records.html">Human &amp; AI records ↗</a>
            <Link href="/kaggle-leaderboard/arc-2">ARC-2 desk ↗</Link>
            <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">ARC Discord ↗</a>
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
  return <div className="news-kicker"><span>{competitionName(article.competition)}</span><span>{editionLabel(article)}</span></div>;
}

export function StoryPreview({ article, lead = false }: { article: NewsArticle; lead?: boolean }) {
  return <article className={lead ? 'news-story news-lead' : 'news-story'}>
    <EditionLabel article={article} />
    <h2><Link href={newsArticlePath(article.id)}>{article.headline}</Link></h2>
    <p className="news-dek">{article.dek}</p>
    <div className="news-byline">The ARC Daily sports desk <span>· {newsDate(article.date)}</span></div>
    {lead && article.sections[0] && <p className="news-lead-excerpt">{article.sections[0].text}</p>}
    <Link href={newsArticlePath(article.id)} className="news-read">Read the dispatch →</Link>
  </article>;
}

export function NotebookEntry({ competitor }: { competitor: CompetitorRecord }) {
  return <article className="news-notebook-entry">
    <div className="news-kicker">{competitionName(competitor.competition)} <span>Team {competitor.teamId}</span></div>
    <h3><Link href={competitorPath(competitor.id)}>{competitor.name}</Link></h3>
    {!!competitor.members.length && <p className="news-card-members">Observed members: {competitor.members.slice(0, 3).join(', ')}{competitor.members.length > 3 ? ` +${competitor.members.length - 3} more` : ''}</p>}
    {competitor.facts.length ? <ul className="news-card-facts">{competitor.facts.slice(0, 2).map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}><p>{fact.text}</p><a className="news-card-source" href={fact.sourceUrl}>Source: {fact.sourceTitle} ↗</a></li>)}</ul> : <p>Observed team identity and competition coverage.</p>}
    <Link href={competitorPath(competitor.id)} className="news-read">Open the full dossier →</Link>
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
