/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 / Codex; Claude Opus 5.5; GPT-6 Astra Extra high
 * Date: 14-Nov-2026 (Claude Opus 5.5); 02-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): /news/wire/:storyId is each story's permanent page, read from
 *          GET /api/news/wire/:id so it outlives the index's week, with a not-found and a loading-failure
 *          state. When the desk filed nothing this week the index shows its latest filings under
 *          "Desk paused since <date>" instead of claiming it never filed. An old /news/wire#<id> link to a
 *          story no longer on the index is sent to that story's page.
 * PURPOSE: /news/wire, the past week of wire stories (the news index carries a week, at most 40;
 *          the files in content/news/wire are the permanent record), newest first and grouped by
 *          UTC date, each at its own anchor with its sources, people, profile links and evidence;
 *          and /news/wire/:storyId, one story on its own page.
 *          The wire desk checks both boards every two hours and writes from a prepared market brief
 *          (docs/newsroom/WIRE_DESK.md); the front page's What's News column runs the newest.
 * SRP/DRY check: Pass — page composition only; a story renders through WireStory, titles and
 *          descriptions come from shared/news.ts, the missing-story copy mirrors the server's.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { NEWS_NAME, NEWS_STORY_MISSING, competitionName, newsDate, wireDeskPausedSince, wireDescription, wirePath, wireTitle, type NewsIndex, type NewsWireStory } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, useNewsCardImage } from '@/components/news/NewsDesk';
import { WireStory, sortedWire } from '@/components/news/NewsWire';

/** One wire story and the people and teams it names; null when no story was published at the address. */
function useWireStory(id: string) {
  return useQuery<NewsIndex | null>({
    queryKey: ['/api/news/wire', id],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/news/wire/${encodeURIComponent(id)}`, { cache: 'no-store', signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Unable to load this wire story');
      const index: NewsIndex = await response.json();
      // A successful but incompatible response is a loading failure, not an unpublished story.
      if (!index.wire?.some(story => story.id === id)) throw new Error('The server did not return the requested wire story');
      return index;
    },
    staleTime: 60_000,
    retry: 1,
  });
}

function WirePermalink({ id }: { id: string }) {
  const query = useWireStory(id);
  const story: NewsWireStory | undefined = query.data?.wire?.find(item => item.id === id);
  const missing = query.isSuccess && query.data === null;
  usePageMeta({ title: story ? wireTitle(story) : `The wire | ${NEWS_NAME}`, description: story ? wireDescription(story) : undefined,
    canonicalPath: wirePath(id), noindex: !story, type: 'article', image: useNewsCardImage(),
    article: story ? { publishedTime: story.publishedAt, section: competitionName(story.competition) } : undefined });
  return <NewsPaper>
    <Link href={wirePath()} className="news-back">← The wire</Link>
    <NewsStatus loading={query.isLoading} error={false} retry={() => void query.refetch()} />
    {query.isError && !query.data && <section className="news-status" role="alert"><h1 className="news-article-title">We couldn’t load this story</h1><p>The site is temporarily unable to retrieve this wire story. This is a loading problem; publication status could not be checked.</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Trying…' : 'Try again'}</Button></section>}
    {missing && <section className="news-status" role="status"><h1 className="news-article-title">{NEWS_STORY_MISSING.heading}</h1><p>{NEWS_STORY_MISSING.description}</p><p><Link href={wirePath()} className="news-read">Read the latest wire →</Link></p></section>}
    {story && query.data && <div className="news-wire-page"><WireStory story={story} index={query.data} permalink /></div>}
  </NewsPaper>;
}

function WireIndex() {
  const query = useNews();
  const [, navigate] = useLocation();
  const week = sortedWire(query.data?.wire ?? []);
  // Nothing filed this week: show the newest filings, whatever their age, and when the desk paused.
  const pausedSince = query.data ? wireDeskPausedSince(query.data) : null;
  const stories = week.length ? week : sortedWire(query.data?.wireLatest ?? []);
  usePageMeta({ title: `The wire | ${NEWS_NAME}`, description: 'Source-linked competition developments, with dated observations and the writer credited on each story.', canonicalPath: '/news/wire', image: useNewsCardImage() });
  // Stories mount after the archive loads; honor a link to one of them once they exist. An old
  // anchor link to a story that has left the index goes to that story's own page.
  useEffect(() => {
    if (!query.data || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
      else if (/^[a-z0-9-]+$/.test(id)) navigate(wirePath(id), { replace: true });
    });
  }, [query.data, navigate]);
  const days = [...new Set(stories.map(story => newsDate(story.publishedAt)))];
  return <NewsPaper>
    <Link href="/news" className="news-back">← Front page</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    <header className="news-directory-header"><div className="news-kicker">The wire desk</div><h1>The wire</h1><p>The latest moves, stories and results from both ARC competitions.</p></header>
    {query.data && <div className="news-wire-page">
      {pausedSince && <p className="news-wire-paused"><strong>Desk paused since {newsDate(pausedSince, true)}.</strong> Nothing has been filed in the past week; these are the latest filings.</p>}
      {days.map(day => <section key={day} aria-label={day}>
        <h2 className="news-section-title">{day}</h2>
        {stories.filter(story => newsDate(story.publishedAt) === day).map(story => <WireStory key={story.id} story={story} index={query.data} />)}
      </section>)}
      {!stories.length && <p className="news-muted">The wire desk has not filed yet. Its stories appear here and in the front page’s What’s News column.</p>}
    </div>}
  </NewsPaper>;
}

export default function NewsWire() {
  const { storyId } = useParams<{ storyId?: string }>();
  return storyId ? <WirePermalink id={storyId} /> : <WireIndex />;
}
