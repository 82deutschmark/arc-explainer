/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: /news/wire, the past week of wire stories (the news index carries a week, at most 40;
 *          the files in content/news/wire are the permanent record), newest first and grouped by
 *          Eastern date, each at its own anchor with its sources, people, notebook links and evidence.
 *          GPT-6 Luna writes them several times a day from a prepared market brief
 *          (docs/newsroom/WIRE_DESK.md); the front page's What's News column runs the newest.
 * SRP/DRY check: Pass — page composition only; a story renders through WireStory.
 */
import { useEffect } from 'react';
import { Link } from 'wouter';
import { NEWS_NAME, newsDate } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews } from '@/components/news/NewsDesk';
import { WireStory, sortedWire } from '@/components/news/NewsWire';

export default function NewsWire() {
  const query = useNews();
  const stories = sortedWire(query.data?.wire ?? []);
  usePageMeta({ title: `The wire | ${NEWS_NAME}`, description: 'Short sourced stories on the ARC-AGI-3 and ARC-AGI-2 boards, filed by the ARC Daily Digest wire desk several times a day.', canonicalPath: '/news/wire' });
  // Stories mount after the archive loads; honor a link to one of them once they exist.
  useEffect(() => {
    if (stories.length && window.location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView());
  }, [stories.length]);
  const days = [...new Set(stories.map(story => newsDate(story.publishedAt)))];
  return <NewsPaper>
    <Link href="/news" className="news-back">← Front page</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    <header className="news-directory-header"><div className="news-kicker">The wire desk</div><h1>The wire</h1><p>The past week of short stories on both boards, filed several times a day by GPT-6 Luna from the saved leaderboard, the people ledger and the notebook. Every figure is checked against the saved board before a story is published.</p></header>
    {query.data && <div className="news-wire-page">
      {days.map(day => <section key={day} aria-label={day}>
        <h2 className="news-section-title">{day}</h2>
        {stories.filter(story => newsDate(story.publishedAt) === day).map(story => <WireStory key={story.id} story={story} index={query.data} />)}
      </section>)}
      {!stories.length && <p className="news-muted">The wire desk has not filed yet. Its stories appear here and in the front page’s What’s News column.</p>}
    </div>}
  </NewsPaper>;
}
