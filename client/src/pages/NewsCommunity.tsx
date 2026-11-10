/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); earlier source page by GPT-6.1 Sol / Codex and Claude Opus 5.5
 * Date: 09-November-2026
 * PURPOSE: Browse the published newspaper at the existing community address. Search the story
 *          list and filter by competition using the same archive as the server's plain page.
 * SRP/DRY check: Pass — reuses the news query, shell, chronological groups and story links.
 */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { NEWS_ARCHIVE, NEWS_NAME, archiveMonths, articleCompetitionLabel, competitionName, newsArticlePath, newsDate, publishedStories } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Input } from '@/components/ui/input';
import { NewsPaper, NewsStatus, useNews, useNewsCardImage } from '@/components/news/NewsDesk';

export default function NewsCommunity() {
  const query = useNews();
  const [search, setSearch] = useState('');
  const [competition, setCompetition] = useState('');
  const archive = useMemo(() => publishedStories(query.data?.articles ?? [], query.data?.dispatches), [query.data]);
  const competitions = [...new Set(archive.map(story => story.competition))]
    .sort((a, b) => competitionName(a).localeCompare(competitionName(b)));
  const term = search.trim().toLowerCase();
  const stories = archive.filter(story => (!competition || story.competition === competition)
    && `${story.headline} ${story.dek ?? ''}`.toLowerCase().includes(term));

  usePageMeta({ title: `${NEWS_ARCHIVE.heading} | ${NEWS_NAME}`, description: NEWS_ARCHIVE.description, canonicalPath: NEWS_ARCHIVE.path, image: useNewsCardImage() });

  return <NewsPaper>
    <main className="news-story-archive">
      <Link href="/news" className="news-back">← Front page</Link>
      <header className="news-directory-header">
        <h1>{NEWS_ARCHIVE.heading}</h1>
        <p>{NEWS_ARCHIVE.description}</p>
      </header>
      <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
      {query.data && <>
        <div className="news-archive-controls">
          <label htmlFor="story-search">Search stories
            <Input id="story-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Headline or topic" />
          </label>
          <label htmlFor="story-competition">Competition
            <select id="story-competition" value={competition} onChange={event => setCompetition(event.target.value)}>
              <option value="">All competitions</option>
              {competitions.map(value => <option key={value} value={value}>{competitionName(value)}</option>)}
            </select>
          </label>
        </div>
        <p className="news-muted" role="status">{stories.length
          ? `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · newest first`
          : archive.length ? 'No stories match your search and filters.' : 'No stories have been published yet.'}</p>
        {archiveMonths(stories).map(([month, entries]) => <section key={month} className="news-archive-month">
          <h2 className="news-section-title">{month}</h2>
          <ol>{entries.map(story => <li key={story.id}>
            <article>
              <h3><Link href={newsArticlePath(story.id)}>{story.headline}</Link></h3>
              {story.dek && <p>{story.dek}</p>}
              <div className="news-byline">
                <time dateTime={story.publishedAt}>{newsDate(story.publishedAt)}</time>
                {' · '}{'edition' in story ? articleCompetitionLabel(story) : competitionName(story.competition)}
              </div>
            </article>
          </li>)}</ol>
        </section>)}
      </>}
    </main>
  </NewsPaper>;
}
