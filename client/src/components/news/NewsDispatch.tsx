/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6.1 Terra / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 13-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the headline is an in-app Link to the dispatch's page, which passes
 *          `permalink` to print it as the page's <h1>; the kicker reads the shared dispatchLabel.
 * PURPOSE: Render complete sourced dispatches and their reviewed illustrations for both
 *          the news front page and permanent editions; production scene books stay linked, not embedded.
 * SRP/DRY check: Pass — moved the existing dispatch view intact so edition links cannot
 *          silently omit the story or cover already shown on the front page.
 */
import { Link } from 'wouter';
import { SportsText } from './SportsText';
import type { NewsDispatch, NewsPerson, NewsStat } from '@shared/news';
import { competitionName, dispatchLabel, newsArticlePath, newsDate, reportedPeople, writerCredit, NEWS_NAME } from '@shared/news';
import { StoryPeopleCards } from './NewsPeople';
import { NewsEditorCredit } from './NewsEditorCredit';
export function DispatchArt({ dispatch, lead = false }: { dispatch: NewsDispatch; lead?: boolean }) {
  return dispatch.image ? <figure className="news-dispatch-art"><a href={dispatch.image.src} aria-label="Open the full editorial illustration"><img src={dispatch.image.src} alt={dispatch.image.alt} loading={lead ? 'eager' : 'lazy'} /></a><figcaption>{dispatch.image.caption}</figcaption></figure> : null;
}

/** A dispatch in full. `permalink` is its own page, where the headline is the <h1> rather than a link to itself. */
export function DispatchPreview({ dispatch, lead = false, people = [], showPeople = true, subjects, stats = [], permalink = false }: { dispatch: NewsDispatch; lead?: boolean; people?: NewsPerson[]; showPeople?: boolean; subjects?: NewsPerson[]; stats?: NewsStat[]; permalink?: boolean }) {
  return <article id={dispatch.id} className={`news-story news-dispatch${lead ? ' news-lead' : ''}`}>
    <div className="news-kicker"><span>{competitionName(dispatch.competition)}</span><span>{dispatchLabel(dispatch)}</span></div>
    {permalink
      ? <h1 className="news-article-title"><SportsText text={dispatch.headline} stats={stats} /></h1>
      : <h2><Link href={newsArticlePath(dispatch.id)}><SportsText text={dispatch.headline} stats={stats} /></Link></h2>}
    {dispatch.dek && <p className="news-dek"><SportsText text={dispatch.dek} stats={stats} /></p>}
    <div className="news-byline"><time dateTime={dispatch.publishedAt}>{newsDate(dispatch.publishedAt, true)}</time>{dispatch.generatedBy && <> · {writerCredit(dispatch.generatedBy)}</>}</div>
    <DispatchArt dispatch={dispatch} lead={lead} />
    {dispatch.sections.map((section, index) => <section key={index}>
      {section.heading && <h3>{section.heading}</h3>}
      <p className="news-dispatch-text"><SportsText text={section.text} stats={stats} /></p>
      {index === 0 && showPeople && <StoryPeopleCards people={subjects ?? reportedPeople([dispatch], people)} competition={dispatch.competition} />}
      <div className="news-section-sources">{section.sourceIds.map(id => {
        const source = dispatch.sources.find(item => item.id === id);
        return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : null;
      })}</div>
      {dispatch.id === 'on-the-private' && index === 0 && <p><a href="/news-scene-books/on-the-private/index.html">Explore the scene book and production stills ↗</a></p>}
    </section>)}
    {dispatch.interpretation && <p className="news-dispatch-take"><strong>{NEWS_NAME}’s take</strong> {dispatch.interpretation}</p>}
    {dispatch.commissionedBy && <NewsEditorCredit note={dispatch.editorNote} />}
  </article>;
}

