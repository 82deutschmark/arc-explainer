/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-12
 * PURPOSE: Searchable, chronological collected public-tweet archive and selected Kaggle
 *          discussion summaries, reached from the Digest's source columns. Source links,
 *          original dates and verified faces remain visible while readers catch up.
 * SRP/DRY check: Pass — existing news query/shell, source export, shared ordering and portraits.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { NEWS_NAME, personPath, personForXHandle, competitionName, chronologicalSocialPosts, type NewsCompetition } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewsPaper, NewsStatus, useNews, newsDate, useNewsCardImage } from '@/components/news/NewsDesk';
import { PersonLinks, PersonPortrait } from '@/components/news/NewsPeople';
import { FromKaggleBoards } from '@/components/news/NewsSources';

export default function NewsCommunity() {
  const query = useNews();
  const [search, setSearch] = useState('');
  const [competition, setCompetition] = useState<NewsCompetition | 'all'>('all');
  const archive = chronologicalSocialPosts(query.data?.socialArchive ?? query.data?.social ?? []);
  const term = search.trim().toLocaleLowerCase();
  const posts = archive.filter(post => (competition === 'all' || post.competitions.includes(competition))
    && `${post.authorName} ${post.author} ${post.summary} ${post.whyItMatters}`.toLocaleLowerCase().includes(term));
  // Source links can arrive before the query renders their target. Scroll after the first
  // successful load; routine refetches must not pull a reader away from their current place.
  useEffect(() => {
    const scrollToSource = () => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    if (query.isSuccess) scrollToSource();
    window.addEventListener('hashchange', scrollToSource);
    return () => window.removeEventListener('hashchange', scrollToSource);
  }, [query.isSuccess]);
  usePageMeta({ title: `Around the contests | ${NEWS_NAME}`, description: 'Browse the collected ARC tweet archive and selected Kaggle discussions, with original source links.', canonicalPath: '/news/community', image: useNewsCardImage() });
  return <NewsPaper>
    <Link href="/news" className="news-back">← Front page</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    <header className="news-directory-header"><div className="news-kicker">From the community</div><h1>Around the contests</h1><p>Catch up on research, reactions and conversations around ARC. Scores and claims belong to their original source dates.</p></header>
    <nav className="news-source-jump" aria-label="Community sources"><a href="#tweet-archive">Collected tweets ↓</a><a href="#kaggle-boards">Kaggle discussions ↓</a></nav>
    <section id="tweet-archive" aria-label="Collected tweet archive">
      <h2 className="news-flag"><span>From X — the collected archive</span></h2>
      <p className="news-muted">All dated public posts collected by the desk in the past 30 days, newest first. Each entry is a short summary linked to its original tweet.</p>
      <div className="news-source-controls">
        <label htmlFor="tweet-search">Search collected tweets<Input id="tweet-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, handle or topic" /></label>
        <div role="group" aria-label="Filter tweets by competition">{(['all', 'arc-3', 'arc-2'] as const).map(value => <Button key={value} variant="outline" className="news-source-filter" aria-pressed={competition === value} onClick={() => setCompetition(value)}>{value === 'all' ? 'Both contests' : competitionName(value)}</Button>)}</div>
      </div>
      {query.data && <p className="news-muted" role="status">{posts.length} of {archive.length} collected posts</p>}
      <div className="news-community-list">{posts.map(post => {
        const author = personForXHandle(query.data?.people ?? [], post.author);
        return <article id={`post-${post.id}`} key={post.id} className={`news-story${author ? ' news-post-with-face' : ''}`}>
          {author && <Link href={personPath(author.id)} className="news-post-face" tabIndex={-1} aria-hidden="true"><PersonPortrait person={author} size="card" decorative /></Link>}
          <div><div className="news-kicker">{post.category} · {post.competitions.map(competitionName).join(' / ')}</div>
            <h2><a href={post.url}>{post.authorName} · @{post.author} ↗</a></h2>
            <p className="news-dispatch-text">{post.summary}</p><p>{post.whyItMatters}</p>
            <div className="news-byline">{post.postedAt ? `Posted ${newsDate(post.postedAt, true)}` : 'Posting time unavailable'} · checked {newsDate(post.checkedAt)}</div>
            <div className="news-section-sources"><a href={post.url}>Original tweet ↗</a>{post.storyUrl && <a href={post.storyUrl}>Linked release ↗</a>}{post.personIds.map(id => { const person = query.data?.people?.find(item => item.id === id); return person ? <PersonLinks key={id} person={person} honors={0} /> : null; })}</div>
          </div>
        </article>;
      })}</div>
      {query.data && !posts.length && <p className="news-muted">{archive.length ? 'No collected posts match these filters.' : 'No public posts have been collected yet.'}</p>}
    </section>
    <FromKaggleBoards threads={query.data?.discussions ?? []} />
  </NewsPaper>;
}
