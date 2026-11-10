/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex
 * Date: 09-November-2026
 * PURPOSE: Original-thread links and attributed summaries from the public Kaggle discussion
 *          export, shown in the front-page wire column.
 * SRP/DRY check: Pass — shared source contract and ordering; no collection or identity inference.
 */
import { competitionName, newsDate, recentDiscussions, type NewsDiscussion } from '@shared/news';

export function FromKaggleBoards({ threads }: { threads: NewsDiscussion[] }) {
  const selected = recentDiscussions(threads).slice(0, 3);
  if (!selected.length) return null;
  return <section id="kaggle-boards" className="news-boards is-compact" aria-label="From the Kaggle boards">
    <h2 className="news-section-title"><span>From the Kaggle boards</span></h2>
    <ul>{selected.map(thread => <li key={`${thread.competition}-${thread.id}`}>
      <div className="news-kicker">{competitionName(thread.competition)} · @{thread.author}</div>
      <h3><a href={thread.url} target="_blank" rel="noopener noreferrer">{thread.title} ↗</a></h3>
      <p className="news-board-summary">{thread.summary}</p>
      <div className="news-byline">Activity {newsDate(thread.latestActivityAt ?? thread.postedAt!, true)} · {thread.commentCount} {thread.commentCount === 1 ? 'reply' : 'replies'}</div>
    </li>)}</ul>
  </section>;
}
