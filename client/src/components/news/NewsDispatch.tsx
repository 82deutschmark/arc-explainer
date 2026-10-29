/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Render complete sourced dispatches and their reviewed illustrations for both
 *          the news front page and permanent editions that reserve a commissioned feature.
 * SRP/DRY check: Pass — moved the existing dispatch view intact so edition links cannot
 *          silently omit the story or cover already shown on the front page.
 */
import type { NewsDispatch, NewsPerson } from '@shared/news';
import { competitionName, newsDate, reportedPeople, writerCredit } from '@shared/news';
import { StoryPeopleCards } from './NewsPeople';
import { NewsEditorCredit } from './NewsEditorCredit';

export function DispatchArt({ dispatch, lead = false }: { dispatch: NewsDispatch; lead?: boolean }) {
  return dispatch.image ? <figure className="news-dispatch-art"><a href={dispatch.image.src} aria-label="Open the full editorial illustration"><img src={dispatch.image.src} alt={dispatch.image.alt} loading={lead ? 'eager' : 'lazy'} /></a><figcaption>{dispatch.image.caption}</figcaption></figure> : null;
}

export function DispatchPreview({ dispatch, lead = false, people = [], showPeople = true }: { dispatch: NewsDispatch; lead?: boolean; people?: NewsPerson[]; showPeople?: boolean }) {
  return <article id={dispatch.id} className={`news-story news-dispatch${lead ? ' news-lead' : ''}`}>
    <div className="news-kicker"><span>{competitionName(dispatch.competition)}</span><span>{dispatch.commissionedBy ? 'Commissioned analysis' : 'From the contenders'}</span></div>
    <h2><a href={`#${dispatch.id}`}>{dispatch.headline}</a></h2>
    <div className="news-byline"><time dateTime={dispatch.publishedAt}>{newsDate(dispatch.publishedAt, true)}</time>{dispatch.generatedBy && <> · {writerCredit(dispatch.generatedBy)}</>}</div>
    <DispatchArt dispatch={dispatch} lead={lead} />
    {dispatch.sections.map((section, index) => <section key={index}>
      {section.heading && <h3>{section.heading}</h3>}
      <p className="news-dispatch-text">{section.text}</p>
      <div className="news-section-sources">{section.sourceIds.map(id => {
        const source = dispatch.sources.find(item => item.id === id);
        return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : null;
      })}</div>
    </section>)}
    {showPeople && <StoryPeopleCards people={reportedPeople([dispatch], people)} competition={dispatch.competition} />}
    {dispatch.interpretation && <p className="news-dispatch-take"><strong>The ARC Daily Digest’s take</strong> {dispatch.interpretation}</p>}
    {dispatch.commissionedBy && <NewsEditorCredit note={dispatch.editorNote} />}
  </article>;
}

