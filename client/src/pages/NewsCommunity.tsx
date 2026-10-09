/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: Public community-source page branching from the edition-led front page.
 *          09-Oct-2026 (Claude Opus 5.5): a post by a verified person carries their face, and
 *          people named in a post appear with theirs.
 * SRP/DRY check: Pass — renders only the server-validated public social subset.
 */
import { Link } from 'wouter';
import { NEWS_NAME, personPath, personForXHandle, competitionName } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, newsDate } from '@/components/news/NewsDesk';
import { PersonLinks, PersonPortrait } from '@/components/news/NewsPeople';

export default function NewsCommunity() {
  const query = useNews();
  const posts = query.data?.social ?? [];
  usePageMeta({ title: `Around the contests | ${NEWS_NAME}`, description: 'Public posts, research releases and reactions from ARC contestants and organizers, with original source links.', canonicalPath: '/news/community' });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} /><header className="news-directory-header"><div className="news-kicker">From the community</div><h1>Around the contests</h1><p>Research, reactions and friendly banter from linked public sources. Scores in these posts belong to their original dates; the editions carry the checked standings.</p></header><div className="news-community-list">{posts.map(post => { const author = personForXHandle(query.data?.people ?? [], post.author); return <article id={`post-${post.id}`} key={post.id} className={`news-story${author ? ' news-post-with-face' : ''}`}>{author && <Link href={personPath(author.id)} className="news-post-face" tabIndex={-1} aria-hidden="true"><PersonPortrait person={author} size="card" decorative /></Link>}<div><div className="news-kicker">{post.category} · {post.competitions.map(competitionName).join(' / ')}</div><h2><a href={post.url}>{post.authorName} · @{post.author} ↗</a></h2><p className="news-dispatch-text">{post.summary}</p><p>{post.whyItMatters}</p><div className="news-byline">{post.postedAt ? `Posted ${newsDate(post.postedAt, true)}` : 'Posting time unavailable'} · checked {newsDate(post.checkedAt)}</div><div className="news-section-sources"><a href={post.url}>Original post ↗</a>{post.storyUrl && <a href={post.storyUrl}>Linked release ↗</a>}{post.personIds.map(id => { const person = query.data?.people?.find(item => item.id === id); return person ? <PersonLinks key={id} person={person} honors={0} /> : null; })}</div></div></article>; })}{query.data && !posts.length && <p className="news-muted">No public source roundup has been published yet.</p>}</div></NewsPaper>;
}
