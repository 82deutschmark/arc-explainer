/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Content-first ARC Daily front-page desks. Dated social dispatches and
 *          immutable daily editions compete for the lead by publication time.
 * SRP/DRY check: Pass — reuses article previews, shared sources and sponsor placement.
 */
import { Link } from 'wouter';
import type { NewsIndex, NewsDispatch, NewsArticle, NewsCompetition } from '@shared/news';
import { competitionName, newsDate, newsArticlePath } from '@shared/news';
import { StoryPreview, sortedArticles } from './NewsDesk';
import { SponsorPlacement } from './SponsorPlacement';

function DispatchArt({ dispatch, lead = false }: { dispatch: NewsDispatch; lead?: boolean }) {
  return dispatch.image ? <figure className="news-dispatch-art"><a href={dispatch.image.src} aria-label="Open the full editorial illustration"><img src={dispatch.image.src} alt={dispatch.image.alt} loading={lead ? 'eager' : 'lazy'} /></a><figcaption>{dispatch.image.caption}</figcaption></figure> : null;
}

export function DispatchPreview({ dispatch, lead = false }: { dispatch: NewsDispatch; lead?: boolean }) {
  return <article id={dispatch.id} className={`news-story news-dispatch${lead ? ' news-lead' : ''}`}>
    <div className="news-kicker"><span>{competitionName(dispatch.competition)}</span><span>From the contenders</span></div>
    <h2><a href={`#${dispatch.id}`}>{dispatch.headline}</a></h2>
    <div className="news-byline"><time dateTime={dispatch.publishedAt}>{newsDate(dispatch.publishedAt, true)}</time></div>
    <DispatchArt dispatch={dispatch} lead={lead} />
    {dispatch.sections.map((section, index) => <section key={index}>
      {section.heading && <h3>{section.heading}</h3>}
      <p className="news-dispatch-text">{section.text}</p>
      <div className="news-section-sources">{section.sourceIds.map(id => {
        const source = dispatch.sources.find(item => item.id === id);
        return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : null;
      })}</div>
    </section>)}
    {dispatch.interpretation && <p className="news-dispatch-take"><strong>The ARC Daily’s take</strong> {dispatch.interpretation}</p>}
  </article>;
}

function CompetitionDesk({ articles, dispatches, competition, lead = false }: { articles: NewsArticle[]; dispatches: NewsDispatch[]; competition: NewsCompetition; lead?: boolean }) {
  const stories = [
    ...articles.filter(article => article.competition === competition).map(article => ({ publishedAt: article.publishedAt, id: article.id, article })),
    ...dispatches.filter(dispatch => dispatch.competition === competition).map(dispatch => ({ publishedAt: dispatch.publishedAt, id: dispatch.id, dispatch })),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  const first = stories[0];
  if (!first) return <p className="news-muted">No published coverage yet. <Link href={competition === 'arc-3' ? '/kaggle-leaderboard' : '/kaggle-leaderboard/arc-2'}>Open the live board →</Link></p>;
  // Same-day artwork keeps its dated caption when an evening edition succeeds a dispatch.
  const companionArt = 'article' in first ? dispatches.find(dispatch => dispatch.competition === competition && dispatch.image && newsDate(dispatch.publishedAt) === newsDate(first.publishedAt)) : undefined;
  return <>
    {'article' in first ? <StoryPreview article={first.article} lead={lead} /> : <DispatchPreview dispatch={first.dispatch} lead={lead} />}
    {lead && companionArt && <DispatchArt dispatch={companionArt} lead />}
    <div className="news-latest-list">{stories.slice(1, lead ? 4 : 3).map(story => <div key={story.id}>
      <span>{'article' in story ? `${story.article.edition} edition` : 'From the contenders'} · {newsDate(story.publishedAt)}</span>
      {'article' in story ? <Link href={newsArticlePath(story.id)}>{story.article.headline}</Link> : <a href={`#${story.id}`}>{story.dispatch.headline}</a>}
    </div>)}</div>
    {/* Older dispatches keep their permanent front-page anchors after a new edition leads. */}
    {stories.slice(1).filter(story => 'dispatch' in story).map(story => 'dispatch' in story && <details className="news-older-dispatch" key={story.id}><summary>{story.dispatch.headline}</summary><DispatchPreview dispatch={story.dispatch} /></details>)}
  </>;
}

export function NewsFrontPage({ index }: { index: NewsIndex }) {
  const articles = sortedArticles(index.articles);
  const dispatches = index.dispatches ?? [];
  return <div className="news-front-grid">
    <section aria-label="Latest ARC-AGI-3 coverage"><h2 className="news-section-title">ARC-AGI-3 / Latest</h2><CompetitionDesk articles={articles} dispatches={dispatches} competition="arc-3" lead /></section>
    <aside className="news-sidebar" aria-label="ARC-AGI-2 desk"><h2 className="news-section-title">ARC-AGI-2 / Latest</h2><CompetitionDesk articles={articles} dispatches={dispatches} competition="arc-2" /><Link href="/kaggle-leaderboard/arc-2" className="news-read">Explore the ARC-AGI-2 board →</Link><SponsorPlacement format="rail" /></aside>
  </div>;
}
