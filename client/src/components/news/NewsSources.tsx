/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-12
 * PURPOSE: Original-thread links and attributed summaries from the public Kaggle discussion
 *          export, reused by the modest front-page column and the full community source page.
 * SRP/DRY check: Pass — shared source contract and ordering; no collection or identity inference.
 */
import { Link } from 'wouter';
import { competitionName, newsDate, recentDiscussions, type NewsDiscussion } from '@shared/news';

export function FromKaggleBoards({ threads, compact = false }: { threads: NewsDiscussion[]; compact?: boolean }) {
  const selected = recentDiscussions(threads).slice(0, compact ? 3 : undefined);
  if (!selected.length && compact) return null;
  return <section id="kaggle-boards" className={`news-boards${compact ? ' is-compact' : ''}`} aria-label="From the Kaggle boards">
    <h2 className={compact ? 'news-section-title' : 'news-flag'}><span>From the Kaggle boards</span></h2>
    {!compact && <p className="news-muted">Interesting discussions selected by the desk, with attributed summaries and links to the original threads.</p>}
    <ul>{selected.map(thread => <li key={`${thread.competition}-${thread.id}`}>
      <div className="news-kicker">{competitionName(thread.competition)} · @{thread.author}</div>
      <h3><a href={thread.url} target="_blank" rel="noopener noreferrer">{thread.title} ↗</a></h3>
      <p className="news-board-summary">{thread.summary}</p>
      <div className="news-byline">Activity {newsDate(thread.latestActivityAt ?? thread.postedAt!, true)} · {thread.commentCount} {thread.commentCount === 1 ? 'reply' : 'replies'}</div>
      {!compact && <div className="news-section-sources"><a href={thread.url}>Original thread ↗</a><span>Read {newsDate(thread.checkedAt, true)}</span></div>}
    </li>)}</ul>
    {compact && <Link href="/news/community#kaggle-boards" className="news-read">All selected discussions →</Link>}
    {!selected.length && <p className="news-muted">No selected public discussion summaries have been published yet.</p>}
  </section>;
}
