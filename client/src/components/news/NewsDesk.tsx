/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Shared ARC Daily newspaper layout, query, date labels and source-aware story
 *          previews. All views read the same modest /api/news archive and typed contract.
 *          08-Oct-2026: newsDate/competitionName now live in shared/news.ts; visual shell
 *          and sourced notebook previews align with the ARC Explainer landing page.
 *          The masthead names both contests; compact links branch into people, community and method pages.
 *          The footer uses the public GPT-6 Sol model spelling. The shared shell
 *          discloses VoynichLabs sponsorship in a compact content-first masthead.
 *          09-Oct-2026 (Claude Opus 5.5): story previews show the faces of the people each
 *          edition cites or covers; notebook cards show the verified people on the team.
 *          Later the same day, per the Boss ("think like a newspaper editor"): a broadsheet
 *          masthead with ears (edition, date and countdown; the sponsor), an Early/Late edition
 *          line, a section nav that includes the wire, and lead stories printed in full.
 * SRP/DRY check: Pass — presentation helpers reuse shared news and competition identities.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { NEWS_NAME, newsArticlePath, competitorPath, newsDate, competitionName, editionLabel, editionName, featuredPerson, wirePath, type NewsArticle, type NewsEdition, type NewsIndex, type CompetitorRecord, type NewsPerson } from '@shared/news';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { MastheadAd } from './SponsorPlacement';
import { StoryFeature, TeamFaces } from './NewsPeople';
import './news.css';

/** The public ARC Prize Discord invite already used by ARC Explainer's other pages. */
export const ARC_DISCORD_URL = 'https://discord.gg/9b77dPAmcA';

export function useNews() {
  return useQuery<NewsIndex>({ queryKey: ['/api/news'], staleTime: 60_000, refetchInterval: 60_000 });
}

// Date labels and competition names moved to shared/news.ts on 08-Oct-2026 so server HTML,
// share cards and these views print them identically.
export { newsDate, competitionName };

export const sortedArticles = (articles: NewsArticle[]) => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

/** Weekday and date in Eastern time, as a dateline prints it: "Friday, October 9, 2026". */
export function datelineDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
    : 'Date unavailable';
}

/** Days until both boards close (they share a deadline) and the close date in Eastern time; null once past or unknown. */
function theClose(now = Date.now()): { days: number; date: string } | null {
  const close = KAGGLE_COMPETITIONS['arc-3'].closeAt;
  if (!close) return null;
  const days = Math.ceil((Date.parse(close) - now) / 864e5);
  return days > 0 ? { days, date: new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' }).format(new Date(close)) } : null;
}

export function NewsPaper({ children, frontPage = false, date, edition, issue }: { children: ReactNode; frontPage?: boolean; date?: string; edition?: NewsEdition; issue?: number }) {
  const close = theClose();
  return (
    <div className="arc-daily">
      <div className="news-paper">
        <header className={`news-masthead${frontPage ? ' is-front' : ''}`}>
          <div className="news-topline"><span><Link href="/home">ARC Explainer</Link> · The competition desk</span><span>{issue ? `Vol. I · No. ${issue} · ` : ''}Free</span></div>
          <div className="news-brand-row">
            <div className="news-ear">
              <strong>{edition ? `${editionName(edition)} edition` : 'Competition desk'}</strong>
              {date && <span>{datelineDate(date)}</span>}
              {close && <span>{close.days} {close.days === 1 ? 'day' : 'days'} to the {close.date} close</span>}
            </div>
            {frontPage ? <h1 className="news-name">{NEWS_NAME}</h1> : <Link href="/news" className="news-name">{NEWS_NAME}</Link>}
            <MastheadAd />
          </div>
          <div className="news-edition-line"><span>ARC Prize 2026 · ARC-AGI-3 &amp; ARC-AGI-2 on Kaggle</span><span>Early edition 6 am · Late edition 6 pm Eastern · The wire all day</span></div>
          <nav className="news-nav" aria-label="ARC Daily sections">
            <Link href="/news">Front page</Link>
            <Link href={wirePath()}>The wire</Link>
            <Link href="/news/competitors">Notebook</Link>
            <Link href="/news/people">People</Link>
            <Link href="/news/community">Around the contests</Link>
            <a href="/kaggle-leaderboard">ARC-AGI-3 board ↗</a>
            <a href="/kaggle-leaderboard/arc-2">ARC-AGI-2 board ↗</a>
            <a href="/human-records.html">Records ↗</a>
            <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord ↗</a>
          </nav>
        </header>
        {children}
        <footer className="news-footer">
          <strong>{NEWS_NAME}</strong><span>Editions by GPT-6 Sol · the wire by GPT-6 Luna</span>
          <p>AI-written competition reporting from dated leaderboard observations and linked sources. Public standings are provisional; final results use the private leaderboard. Sponsored by VoynichLabs.</p>
          <p><a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Can't get enough ARC gossip? Come join us in the ARC Discord.</a></p>
          <Link href="/news/how-this-is-made">How this is made →</Link> · <Link href="/home">An ARC Explainer publication →</Link>
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

/**
 * An edition on the front page. `sections` is how much of the report runs here: all of it for the
 * lead, the opening sections for the second story; the article page keeps sources and box score.
 * `art` is a same-day illustration that runs beside the text.
 */
export function StoryPreview({ article, lead = false, people = [], sections = 0, art }: { article: NewsArticle; lead?: boolean; people?: NewsPerson[]; sections?: number; art?: ReactNode }) {
  const shown = article.sections.slice(0, sections);
  const more = article.sections.length > shown.length;
  return <article className={lead ? 'news-story news-lead' : 'news-story'}>
    <EditionLabel article={article} />
    <h2><Link href={newsArticlePath(article.id)}>{article.headline}</Link></h2>
    <p className="news-dek">{article.dek}</p>
    <div className="news-byline">By the ARC Daily Digest sports desk <span>· {newsDate(article.date)}</span></div>
    <StoryFeature person={featuredPerson(article, people)} competition={article.competition} />
    {art}
    {!!shown.length && <div className="news-story-body">{shown.map((section, index) => <section key={index}>
      {section.heading && <h3>{section.heading}</h3>}
      <p>{section.text}</p>
    </section>)}</div>}
    <Link href={newsArticlePath(article.id)} className="news-read">{more ? 'Continue reading, with sources and the box score →' : 'Sources and the box score →'}</Link>
  </article>;
}

export function NotebookEntry({ competitor, people = [] }: { competitor: CompetitorRecord; people?: NewsPerson[] }) {
  return <article className="news-notebook-entry">
    <div className="news-kicker">{competitionName(competitor.competition)} <span>Team {competitor.teamId}</span></div>
    <h3><Link href={competitorPath(competitor.id)}>{competitor.name}</Link></h3>
    {!!competitor.members.length && <p className="news-card-members">Observed members: {competitor.members.slice(0, 3).join(', ')}{competitor.members.length > 3 ? ` +${competitor.members.length - 3} more` : ''}</p>}
    <TeamFaces team={competitor} people={people} />
    {competitor.facts.length ? <ul className="news-card-facts">{competitor.facts.slice(0, 2).map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}><p>{fact.text}</p><a className="news-card-source" href={fact.sourceUrl}>Source: {fact.sourceTitle} ↗</a></li>)}</ul> : <p>Observed team identity and competition coverage.</p>}
    <Link href={competitorPath(competitor.id)} className="news-read">Open the full dossier →</Link>
  </article>;
}

export function ArticleArchive({ articles, heading = 'From the archive' }: { articles: NewsArticle[]; heading?: string }) {
  return <section className="news-archive" aria-label={heading}>
    <h2 className="news-section-title">{heading}</h2>
    {articles.length ? <ol>{articles.map(article => <li key={article.id}>
      <div className="news-archive-date"><time dateTime={article.publishedAt}>{newsDate(article.date)}</time><span>{editionName(article.edition)} · {competitionName(article.competition)}</span></div>
      <Link href={newsArticlePath(article.id)}>{article.headline}</Link>
    </li>)}</ol> : <p className="news-muted">No earlier editions have been published.</p>}
  </section>;
}
