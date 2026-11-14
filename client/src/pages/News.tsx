/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 03-November-2026; 02-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the masthead dates the paper by its newest published story (edition or
 *          dispatch), prints an edition label only when that story is an edition, and counts dispatches in
 *          the issue number. An old /news#<id> link scrolls to the story when it is on the page, else opens
 *          the story's own page.
 * PURPOSE: ARC Daily landing page for both Kaggle contests, laid out like a broadsheet's front
 *          page: masthead with ears, the terminal ticker, public X coverage, What's News (the wire), the lead
 *          reports run in full, the board in agate type, the past day's movers, where the past
 *          prize winners stand now, an index of the rest of the site, the
 *          notebook in board order and every edition.
 *          09-Oct-2026 (Claude Opus 5.5): rebuilt per the Boss ("think like a newspaper editor ...
 *          information-dense, like a financial terminal, like a sports page"). The card grid
 *          ("Explore the contests") became the Inside index; the Hall of Fame band became the
 *          past-winners table, faces and honors included. Live figures come from
 *          GET /api/news/markets; without them the reporting still leads the page.
 * SRP/DRY check: Pass — composition only; sections live in components/news, story order in shared/news.ts.
 */
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { NEWS_NAME, NEWS_BRAND, editionLabel, newsArticlePath, publishedStories } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AboutThisPaper, ArticleArchive, NewsPaper, NewsStatus, sortedArticles, useNews, useNewsCardImage } from '@/components/news/NewsDesk';
import { NewsFrontPage } from '@/components/news/NewsFrontPage';
import { InsideIndex, MoversBand, PastWinners, useMarkets } from '@/components/news/NewsMarkets';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

export default function News() {
  const query = useNews();
  const markets = useMarkets();
  const [, navigate] = useLocation();
  const articles = sortedArticles(query.data?.articles ?? []);
  const dispatches = query.data?.dispatches ?? [];
  // The paper is dated by whatever was published last, edition or dispatch.
  const lead = publishedStories(articles, dispatches)[0];
  const leadEdition = lead && 'edition' in lead ? lead : undefined;
  // One issue per scheduled edition (date and edition, never previews) and one per dispatch.
  const issue = (new Set(articles.filter(article => !article.id.endsWith('-preview')).map(article => `${article.date}-${article.edition}`)).size + dispatches.length) || undefined;
  usePageMeta({ title: `${NEWS_NAME} — ${NEWS_BRAND.goose ? "the sports tabloid of the Kaggleverse" : "ARC-AGI-3 and ARC-AGI-2 news"}`, description: NEWS_BRAND.goose ? 'Major Kaggle competitions, meaningful moves, public methods and the people behind the teams, with original source links and continuing illustrated coverage.' : 'Daily coverage of both ARC Prize Kaggle contests: live standings and movers, wire stories, early and late editions, and sourced competitor profiles.', canonicalPath: '/news', image: useNewsCardImage() });
  const people = query.data?.people ?? [];
  const links = { competitors: query.data?.competitors ?? [], people };

  // Stories mount after the archive loads. Citations once pointed at /news#<id>: scroll to a story still
  // on the front page, otherwise open its own page so the link never lands on the top of the paper.
  useEffect(() => {
    if (!query.data || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
      else if ([...query.data.articles, ...(query.data.dispatches ?? [])].some(story => story.id === id)) navigate(newsArticlePath(id), { replace: true });
    });
  }, [query.data, navigate]);

  return <NewsPaper frontPage date={leadEdition ? leadEdition.date : lead?.publishedAt} editionTitle={leadEdition && editionLabel(leadEdition)} issue={issue}>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <>
      <NewsFrontPage index={query.data} markets={markets.data} />
      <MoversBand markets={markets.data} links={links} />
      <div className="news-lower">
        <PastWinners markets={markets.data} people={people} links={links} />
        <InsideIndex />
      </div>
      <SponsorPlacement format="banner" />
      <AboutThisPaper />
      <ArticleArchive articles={articles} heading="Every edition" />
    </>}
  </NewsPaper>;
}
