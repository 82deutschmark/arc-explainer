/**
 * Author: GPT-6.1 Terra / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6 Astra Extra high; GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
 * Date: 03-November-2026
 * Permanent special-report links repaired by GPT-6 / Codex, 2026-11-01.
 * PURPOSE: Permanent ARC Daily article view including the complete reserved feature and cover,
 *          with evidence timestamps, linked section
 *          sources, box scores and competition-scoped competitor links.
 *          08-Oct-2026: head metadata and share card from shared/news.ts; visible
 *          publication and source labels use dates while exact times stay in evidence.
 *          The article rail carries a disclosed VoynichLabs advertisement.
 *          09-Oct-2026 (Claude Opus 5.5): faces of the people the edition cites or covers sit
 *          under the byline; roster names in the rail carry their faces too.
 * SRP/DRY check: Pass — reads the shared news archive; no derived standings or invented facts.
 */
import { useNewsStory } from '@/hooks/useNewsStory';
import { Button } from '@/components/ui/button';
import { SportsText, NumberKey } from '@/components/news/SportsText';
import { DispatchPreview } from '@/components/news/NewsDispatch';
import { NewsArticleSectionExtras } from '@/components/news/NewsArticleSectionExtras';
import { StoryPeopleCards, TeamPeople } from '@/components/news/NewsPeople';
import { Link, useParams } from 'wouter';
import { useMemo } from 'react';
import { SITE_ORIGIN } from '@shared/seo';
import { articleCompetitionLabel, articleFigureStats, competitorPath, editionFeature, reportedPeople, writerCredit, articleStructuredData, dispatchStructuredData, articleTitle, articleDescription, articleCardPath, articleCardAlt, competitionName, NEWS_NAME, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT } from '@shared/news';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, EditionArtwork, EditionLabel, NewsPaper, NewsStatus, newsDate, sortedArticles } from '@/components/news/NewsDesk';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

const points = (value: number) => String(value);

export default function NewsArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const query = useNewsStory(articleId);
  const article = query.data?.articles.find(item => item.id === articleId);
  const dispatch = !article ? query.data?.dispatches?.find(item => item.id === articleId) : undefined;
  const feature = article ? editionFeature(article, query.data?.dispatches) : undefined;
  const figureStats = article ? articleFigureStats(article) : [];
  const jsonLd = useMemo(() => article ? articleStructuredData(article, SITE_ORIGIN) : dispatch ? dispatchStructuredData(dispatch, SITE_ORIGIN) : undefined, [article, dispatch]);
  const missing = query.isSuccess && query.data === null;
  // Same title, description, card and article fields as the server-rendered head.
  usePageMeta({ title: article ? articleTitle(article) : dispatch ? `${dispatch.headline} | ${NEWS_NAME}` : `Story | ${NEWS_NAME}`, description: article ? articleDescription(article) : dispatch?.dek ?? dispatch?.sections[0]?.text, canonicalPath: `/news/${articleId}`, noindex: !article && !dispatch, type: 'article', jsonLd,
    image: article ? { image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT } : dispatch?.image ? { image: `${SITE_ORIGIN}${dispatch.image.src}`, imageAlt: dispatch.image.alt } : undefined,
    article: article ? { publishedTime: article.publishedAt, section: articleCompetitionLabel(article) } : dispatch ? { publishedTime: dispatch.publishedAt, section: competitionName(dispatch.competition) } : undefined });
  const competitors = article ? (query.data?.competitors ?? []).filter(record => record.competition === article.competition && article.teamIds.includes(record.teamId)) : [];

  return <NewsPaper date={article?.date}>
    <Link className="news-back" href="/news">← Back to the front page</Link>
    <NewsStatus loading={query.isLoading} error={false} retry={() => void query.refetch()} />
    {query.isError && !query.data && <section className="news-status" role="alert"><h1 className="news-article-title">We couldn’t load this story</h1><p>The site is temporarily unable to retrieve this article. This is a loading problem; publication status could not be checked.</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Trying…' : 'Try again'}</Button><p><Link href="/news" className="news-read">Back to the front page →</Link></p></section>}
    {missing && !query.isError && <section className="news-status" role="status"><h1 className="news-article-title">No story has been published at this address</h1><p>The archive was checked successfully. This link may have been shared before publication, or the address may be incorrect.</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Checking…' : 'Check again'}</Button><p><Link href="/news" className="news-read">Read the latest stories →</Link></p></section>}
    {dispatch && <DispatchPreview dispatch={dispatch} lead people={query.data?.people} />}
    {article && <article>
      <header className="news-article-header">
        <EditionLabel article={article} />
        <h1 className="news-article-title"><SportsText text={article.headline} stats={figureStats} teamNames={article.verifiedTeamNames} /></h1>
        <p className="news-dek"><SportsText text={article.dek} stats={figureStats} teamNames={article.verifiedTeamNames} /></p>
        <p className="news-byline">{NEWS_NAME} sports desk <span>· {writerCredit(article.generatedBy)} · <time dateTime={article.publishedAt}>{newsDate(article.date)}</time></span></p>
      </header>
      {feature && <DispatchPreview dispatch={feature} stats={article.stats} lead people={query.data?.people} subjects={reportedPeople([feature, article], query.data?.people ?? [])} />}
      {feature?.image?.src !== article.image?.src && <EditionArtwork article={article} lead={!feature} />}
      <div className="news-article-grid">
        <div>
          <div className="news-prose">{article.sections.map((section, index) => <section key={index}>
            {section.heading && <h2>{section.heading}</h2>}
            <p><SportsText text={section.text} stats={figureStats} teamNames={article.verifiedTeamNames} /></p>
            <NewsArticleSectionExtras section={section} />
            {index === 0 && !feature && <StoryPeopleCards people={reportedPeople([article], query.data?.people ?? [])} competition={article.competition} />}
            {!!section.sourceIds.length && <div className="news-section-sources">{section.sourceIds.map(id => {
              const source = article.sources.find(item => item.id === id);
              return source ? <a key={id} href={source.url}>{source.title} ↗</a> : null;
            })}</div>}
          </section>)}</div>
          {!!article.stats.length && <><NumberKey stats={article.stats} competition={article.competition} /><div className="news-boxscore-wrap" tabIndex={0} role="region" aria-label="Scrollable edition box score">
            <table className="news-boxscore"><caption>The box score</caption><thead><tr><th scope="col">Team</th><th scope="col">Rank</th><th scope="col">Score</th><th scope="col">Rank change</th><th scope="col">Score change</th></tr></thead>
              <tbody>{article.stats.map(stat => <tr key={stat.teamId}><td>{stat.name}</td><td className="pl">#{stat.rank.toLocaleString('en-US')}</td><td className="sc">{String(stat.score)}</td><td>{stat.rankChange == null ? 'Not available' : stat.rankChange === 0 ? 'Unchanged' : `${stat.rankChange > 0 ? '↑' : '↓'} ${Math.abs(stat.rankChange)}`}</td><td className="sd">{stat.scoreChange == null ? 'Not available' : `${stat.scoreChange > 0 ? '+' : ''}${points(stat.scoreChange)}`}</td></tr>)}</tbody>
            </table><p className="news-muted">Scores and movement recorded for this edition, not live standings.</p>
          </div></>}
          <Link className="news-read" href={KAGGLE_COMPETITIONS[article.competition].path}>Explore the full leaderboard →</Link>
        </div>
        <aside className="news-sidebar" aria-label="Reporting notes and sources">
          <h2 className="news-section-title">How this report was checked</h2>
          <div className="news-note"><p><strong>Board date</strong><time dateTime={article.dataAsOf}>{newsDate(article.dataAsOf, true)}</time></p><p><strong>Comparison</strong>{article.baselineAt ? <time dateTime={article.baselineAt}>{newsDate(article.baselineAt, true)}</time> : 'No comparable earlier snapshot'}</p><p><strong>Coverage</strong>{article.coverageNote}</p></div>
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
