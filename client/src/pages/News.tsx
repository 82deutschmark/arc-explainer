/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: ARC Daily landing page for both Kaggle contests, laid out like a broadsheet's front
 *          page: masthead with ears, the terminal ticker, What's News (the wire), the lead
 *          reports run in full, the board in agate type, the past day's movers, where the past
 *          prize winners stand now, around the contests, an index of the rest of the site, the
 *          notebook in board order and every edition.
 *          09-Oct-2026 (Claude Opus 5.5): rebuilt per the Boss ("think like a newspaper editor ...
 *          information-dense, like a financial terminal, like a sports page"). The card grid
 *          ("Explore the contests") became the Inside index; the Hall of Fame band became the
 *          past-winners table, faces and honors included. Live figures come from
 *          GET /api/news/markets; without them the reporting still leads the page.
 * SRP/DRY check: Pass — composition only; sections live in components/news.
 */
import { NEWS_NAME } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AboutThisPaper, ArticleArchive, NewsPaper, NewsStatus, sortedArticles, useNews, useNewsCardImage } from '@/components/news/NewsDesk';
import { AroundTheContests, NewsFrontPage, NotebookColumns } from '@/components/news/NewsFrontPage';
import { InsideIndex, MoversBand, PastWinners, useMarkets } from '@/components/news/NewsMarkets';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

export default function News() {
  const query = useNews();
  const markets = useMarkets();
  const articles = sortedArticles(query.data?.articles ?? []);
  const latest = articles[0];
  // The issue number counts published scheduled editions (one per date and edition), never previews.
  const issue = new Set(articles.filter(article => !article.id.endsWith('-preview')).map(article => `${article.date}-${article.edition}`)).size || undefined;
  usePageMeta({ title: `${NEWS_NAME} — ARC-AGI-3 and ARC-AGI-2 news`, description: 'Daily coverage of both ARC Prize Kaggle contests: live standings and movers, wire stories, early and late editions, and sourced competitor profiles.', canonicalPath: '/news', image: useNewsCardImage() });
  const people = query.data?.people ?? [];
  const links = { competitors: query.data?.competitors ?? [], people };

  return <NewsPaper frontPage date={latest?.date} edition={latest?.edition} issue={issue}>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <>
      <NewsFrontPage index={query.data} markets={markets.data} />
      <MoversBand markets={markets.data} links={links} />
      <div className="news-lower">
        <PastWinners markets={markets.data} people={people} links={links} />
        <AroundTheContests index={query.data} />
        <InsideIndex />
      </div>
      <SponsorPlacement format="banner" />
      <NotebookColumns index={query.data} markets={markets.data} />
      <AboutThisPaper />
      <ArticleArchive articles={articles} heading="Every edition" />
    </>}
  </NewsPaper>;
}
