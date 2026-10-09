/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Permanent ARC Daily article view with evidence timestamps, linked section
 *          sources, box scores and competition-scoped competitor links.
 *          08-Oct-2026: head metadata and share card from shared/news.ts; visible
 *          publication and source labels use dates while exact times stay in evidence.
 *          The article rail carries a disclosed VoynichLabs advertisement.
 *          09-Oct-2026 (Claude Opus 5.5): faces of the people the edition cites or covers sit
 *          under the byline; roster names in the rail carry their faces too.
 * SRP/DRY check: Pass — reads the shared news archive; no derived standings or invented facts.
 */
import { StoryFaces, TeamPeople } from '@/components/news/NewsPeople';
import { Link, useParams } from 'wouter';
import { useMemo } from 'react';
import { SITE_ORIGIN } from '@shared/seo';
import { competitorPath, storyPeople, articleStructuredData, articleTitle, articleDescription, articleCardPath, articleCardAlt, competitionName, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT } from '@shared/news';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, EditionLabel, NewsPaper, NewsStatus, newsDate, sortedArticles, useNews } from '@/components/news/NewsDesk';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

const points = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 4 });

export default function NewsArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const query = useNews();
  const article = query.data?.articles.find(item => item.id === articleId);
  const jsonLd = useMemo(() => article ? articleStructuredData(article, SITE_ORIGIN) : undefined, [article]);
  const missing = !!query.data && !article;
  // Same title, description, card and article fields as the server-rendered head.
  usePageMeta({ title: article ? articleTitle(article) : 'Dispatch | The ARC Daily Digest', description: article ? articleDescription(article) : undefined, canonicalPath: `/news/${articleId}`, noindex: !article, type: 'article', jsonLd,
    image: article ? { image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT } : undefined,
    article: article ? { publishedTime: article.publishedAt, section: competitionName(article.competition) } : undefined });
  const competitors = article ? (query.data?.competitors ?? []).filter(record => record.competition === article.competition && article.teamIds.includes(record.teamId)) : [];

  return <NewsPaper date={article?.date}>
    <Link className="news-back" href="/news">← Back to the front page</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {missing && <section className="news-status"><h1 className="news-article-title">Dispatch not found</h1><p>This edition is not in the published archive.</p><Link href="/news" className="news-read">Browse published editions →</Link></section>}
    {article && <article>
      <header className="news-article-header">
        <EditionLabel article={article} />
        <h1 className="news-article-title">{article.headline}</h1>
        <p className="news-dek">{article.dek}</p>
        <p className="news-byline">The ARC Daily Digest sports desk <span>· <time dateTime={article.publishedAt}>{newsDate(article.date)}</time></span></p>
        <StoryFaces people={storyPeople(article, query.data?.people ?? [], query.data?.competitors ?? [])} max={10} />
      </header>
      <div className="news-article-grid">
        <div>
          <div className="news-prose">{article.sections.map((section, index) => <section key={index}>
            {section.heading && <h2>{section.heading}</h2>}
            <p>{section.text}</p>
            {!!section.sourceIds.length && <div className="news-section-sources">{section.sourceIds.map(id => {
              const source = article.sources.find(item => item.id === id);
              return source ? <a key={id} href={source.url}>{source.title} ↗</a> : null;
            })}</div>}
          </section>)}</div>
          {!!article.stats.length && <div className="news-boxscore-wrap" tabIndex={0} role="region" aria-label="Scrollable edition box score">
            <table className="news-boxscore"><caption>The box score</caption><thead><tr><th scope="col">Team</th><th scope="col">Rank</th><th scope="col">Score</th><th scope="col">Rank change</th><th scope="col">Score change</th></tr></thead>
              <tbody>{article.stats.map(stat => <tr key={stat.teamId}><td>{stat.name}</td><td>#{stat.rank}</td><td>{points(stat.score)}</td><td>{stat.rankChange == null ? 'Not available' : stat.rankChange === 0 ? 'Unchanged' : `${stat.rankChange > 0 ? '↑' : '↓'} ${Math.abs(stat.rankChange)}`}</td><td>{stat.scoreChange == null ? 'Not available' : `${stat.scoreChange > 0 ? '+' : ''}${points(stat.scoreChange)}`}</td></tr>)}</tbody>
            </table><p className="news-muted">Scores and movement recorded for this edition, not live standings.</p>
          </div>}
          <Link className="news-read" href={KAGGLE_COMPETITIONS[article.competition].path}>Explore the full leaderboard →</Link>
        </div>
        <aside className="news-sidebar" aria-label="Reporting notes and sources">
          <h2 className="news-section-title">How this report was checked</h2>
          <div className="news-note"><p><strong>Board date</strong><time dateTime={article.dataAsOf}>{newsDate(article.dataAsOf)}</time></p><p><strong>Comparison</strong>{article.baselineAt ? <time dateTime={article.baselineAt}>{newsDate(article.baselineAt)}</time> : 'No comparable earlier snapshot'}</p><p><strong>Coverage</strong>{article.coverageNote}</p></div>
          <a className="news-read" href={`/api/news/${article.id}/evidence`}>Exact observations and reporting data →</a>
          <SponsorPlacement format="rail" />
          <h2 className="news-section-title">Sources</h2>
          <ol className="news-source-list">{article.sources.map(source => <li key={source.id}><a href={source.url}>{source.title} ↗</a><span>Checked {newsDate(source.accessedAt)}</span></li>)}</ol>
          {!!competitors.length && <><h2 className="news-section-title">Names in this edition</h2><ul className="news-observations">{competitors.map(competitor => <li key={competitor.id}><Link href={competitorPath(competitor.id)}>{competitor.name} →</Link><TeamPeople team={competitor} people={query.data?.people} /></li>)}</ul></>}
        </aside>
      </div>
      <ArticleArchive articles={sortedArticles(query.data?.articles ?? []).filter(item => item.id !== article.id).slice(0, 8)} heading="More from the desk" />
    </article>}
  </NewsPaper>;
}
