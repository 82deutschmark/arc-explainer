/**
 * Author: GPT-6.1 Terra / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6 Astra Extra high; GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 03-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium, story layout): every story (dispatch or edition) renders the three-column
 *          NewsStoryPage under the half-height story masthead: contest wire, story, board and cards. The old single
 *          column, the Sources rail, the sponsor rail unit (the masthead ad stays) and "More from the desk" are gone;
 *          sources are numbered notes, the box score is the board column's table and the wire replaces the archive list.
 * 27-Nov-2026 (Claude Opus 5.5 Medium): "In this story" cards come from the shared storyCast() rule; a feature passes its edition.
 * 14-Nov-2026 (Claude Opus 5.5): a dispatch page prints its headline as the <h1> and takes its title and
 *          description from dispatchTitle/dispatchDescription, like the server-rendered head.
 * 14-Nov-2026 (Claude Opus 5.5, profiles-articles): the Sources rail lists only cited, de-duplicated links;
 *          "Updated <date>: <reason>" notices sit under the byline; a joint report lists teams and leaderboard links
 *          for every contest it covers; box-score movement uses the shared rank/score change wording.
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
import { NewsStoryPage } from '@/components/news/NewsStoryPage';
import { Link, useParams } from 'wouter';
import { useMemo } from 'react';
import { SITE_ORIGIN } from '@shared/seo';
import { articleCompetitionLabel, articleCoversTeam, editionFeature, articleStructuredData, dispatchStructuredData, articleTitle, articleDescription, dispatchTitle, dispatchDescription, articleCardPath, articleCardAlt, competitionName, NEWS_NAME, NEWS_STORY_MISSING, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus } from '@/components/news/NewsDesk';


export default function NewsArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const query = useNewsStory(articleId);
  const article = query.data?.articles.find(item => item.id === articleId);
  const dispatch = !article ? query.data?.dispatches?.find(item => item.id === articleId) : undefined;
  const feature = article ? editionFeature(article, query.data?.dispatches) : undefined;
  const jsonLd = useMemo(() => article ? articleStructuredData(article, SITE_ORIGIN) : dispatch ? dispatchStructuredData(dispatch, SITE_ORIGIN) : undefined, [article, dispatch]);
  const missing = query.isSuccess && query.data === null;
  // Same title, description, card and article fields as the server-rendered head.
  usePageMeta({ title: article ? articleTitle(article) : dispatch ? dispatchTitle(dispatch) : `Story | ${NEWS_NAME}`, description: article ? articleDescription(article) : dispatch ? dispatchDescription(dispatch) : undefined, canonicalPath: `/news/${articleId}`, noindex: !article && !dispatch, type: 'article', jsonLd,
    image: article ? { image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT } : dispatch?.image ? { image: `${SITE_ORIGIN}${dispatch.image.src}`, imageAlt: dispatch.image.alt } : undefined,
    article: article ? { publishedTime: article.publishedAt, section: articleCompetitionLabel(article) } : dispatch ? { publishedTime: dispatch.publishedAt, section: competitionName(dispatch.competition) } : undefined });
  const competitors = article ? (query.data?.competitors ?? []).filter(record => articleCoversTeam(article, record)) : [];

  return <NewsPaper date={article?.date ?? dispatch?.publishedAt} story>
    <NewsStatus loading={query.isLoading} error={false} retry={() => void query.refetch()} />
    {query.isError && !query.data && <section className="news-status" role="alert"><h1 className="news-article-title">We couldn’t load this story</h1><p>The site is temporarily unable to retrieve this article. This is a loading problem; publication status could not be checked.</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Trying…' : 'Try again'}</Button><p><Link href="/news" className="news-read">Back to the front page →</Link></p></section>}
    {missing && !query.isError && <section className="news-status" role="status"><h1 className="news-article-title">{NEWS_STORY_MISSING.heading}</h1><p>{NEWS_STORY_MISSING.description}</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Checking…' : 'Check again'}</Button><p><Link href="/news" className="news-read">Read the latest stories →</Link></p></section>}
    {/* One three-column page for both kinds of story; an edition prints its reserved feature first. */}
    {query.data && (article ?? dispatch) && <NewsStoryPage story={(article ?? dispatch)!} feature={feature} index={query.data} competitors={competitors} />}
  </NewsPaper>;
}
