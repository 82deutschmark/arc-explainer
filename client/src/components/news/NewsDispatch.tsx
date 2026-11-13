/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6.1 Terra / Codex (reasoning effort not exposed)
 * Date: 13-November-2026
 * PURPOSE: Render complete sourced dispatches and their reviewed illustrations for both
 *          the news front page and permanent editions that reserve a commissioned feature.
 * SRP/DRY check: Pass — moved the existing dispatch view intact so edition links cannot
 *          silently omit the story or cover already shown on the front page.
 */
import { SportsText } from './SportsText';
import type { NewsDispatch, NewsPerson, NewsStat } from '@shared/news';
import { competitionName, newsDate, reportedPeople, writerCredit, NEWS_NAME } from '@shared/news';
import { StoryPeopleCards } from './NewsPeople';
import { NewsEditorCredit } from './NewsEditorCredit';
import { useEffect, useRef } from 'react';

/** Keep the scene book in the article's scroll flow as its lazy images load. */
function SceneBook() {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  const resize = () => {
    const document = frame.current?.contentDocument;
    if (!document || !frame.current) return;
    const update = () => { if (frame.current) frame.current.style.height = `${document.documentElement.scrollHeight}px`; };
    observer.current?.disconnect();
    observer.current = new ResizeObserver(update);
    observer.current.observe(document.body);
    update();
  };
  return <section aria-label="On the Private scene book">
    <p>These frames show the public leaderboard as it appeared during production; private results remain hidden.</p>
    <p><a href="/news-scene-books/on-the-private/index.html">Open the scene book on its own ↗</a></p>
    <iframe ref={frame} onLoad={resize} title="On the Private widescreen scene book" src="/news-scene-books/on-the-private/index.html" style={{ width: '100%', height: 900, border: 0 }} />
  </section>;
}

export function DispatchArt({ dispatch, lead = false }: { dispatch: NewsDispatch; lead?: boolean }) {
  return dispatch.image ? <figure className="news-dispatch-art"><a href={dispatch.image.src} aria-label="Open the full editorial illustration"><img src={dispatch.image.src} alt={dispatch.image.alt} loading={lead ? 'eager' : 'lazy'} /></a><figcaption>{dispatch.image.caption}</figcaption></figure> : null;
}

export function DispatchPreview({ dispatch, lead = false, people = [], showPeople = true, subjects, stats = [] }: { dispatch: NewsDispatch; lead?: boolean; people?: NewsPerson[]; showPeople?: boolean; subjects?: NewsPerson[]; stats?: NewsStat[] }) {
  return <article id={dispatch.id} className={`news-story news-dispatch${lead ? ' news-lead' : ''}`}>
    <div className="news-kicker"><span>{competitionName(dispatch.competition)}</span><span>{dispatch.commissionedBy ? 'Commissioned analysis' : 'From the contenders'}</span></div>
    <h2><a href={`/news/${dispatch.id}`}><SportsText text={dispatch.headline} stats={stats} /></a></h2>
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
      {dispatch.id === 'on-the-private' && index === 0 && <SceneBook />}
    </section>)}
    {dispatch.interpretation && <p className="news-dispatch-take"><strong>{NEWS_NAME}’s take</strong> {dispatch.interpretation}</p>}
    {dispatch.commissionedBy && <NewsEditorCredit note={dispatch.editorNote} />}
  </article>;
}

