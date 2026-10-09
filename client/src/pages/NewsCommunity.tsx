/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Public community-source page branching from the edition-led front page.
 * SRP/DRY check: Pass — renders only the server-validated public social subset.
 */
import { Link } from 'wouter';
import { NEWS_NAME, personPath, competitionName } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, newsDate } from '@/components/news/NewsDesk';

export default function NewsCommunity() {
  const query = useNews();
  const posts = query.data?.social ?? [];
  usePageMeta({ title: `Around the contests | ${NEWS_NAME}`, description: 'Public posts, research releases and reactions from ARC contestants and organizers, with original source links.', canonicalPath: '/news/community' });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} /><header className="news-directory-header"><div className="news-kicker">From the community</div><h1>Around the contests</h1><p>Research, reactions and friendly banter from linked public sources. Scores in these posts belong to their original dates; the editions carry the checked standings.</p></header><div className="news-community-list">{posts.map(post => <article id={`post-${post.id}`} key={post.id} className="news-story"><div className="news-kicker">{post.category} · {post.competitions.map(competitionName).join(' / ')}</div><h2><a href={post.url}>{post.authorName} · @{post.author} ↗</a></h2><p className="news-dispatch-text">{post.summary}</p><p>{post.whyItMatters}</p><div className="news-byline">{post.postedAt ? `Posted ${newsDate(post.postedAt, true)}` : 'Posting time unavailable'} · checked {newsDate(post.checkedAt)}</div><div className="news-section-sources"><a href={post.url}>Original post ↗</a>{post.storyUrl && <a href={post.storyUrl}>Linked release ↗</a>}{post.personIds.map(id => { const person = query.data?.people?.find(item => item.id === id); return person ? <Link key={id} href={personPath(id)}>{person.name} →</Link> : null; })}</div></article>)}{query.data && !posts.length && <p className="news-muted">No public source roundup has been published yet.</p>}</div></NewsPaper>;
}
