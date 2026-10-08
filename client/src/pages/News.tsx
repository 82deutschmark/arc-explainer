/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: ARC Daily front page with a lead dispatch, latest stories from both competitions,
 *          a competitor notebook rail and permanent edition archive from /api/news.
 * SRP/DRY check: Pass — uses shared newspaper presentation, query and news contract.
 */
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, NewsPaper, NewsStatus, NotebookEntry, StoryPreview, sortedArticles, useNews } from '@/components/news/NewsDesk';

export default function News() {
  const query = useNews();
  const articles = sortedArticles(query.data?.articles ?? []);
  const lead = articles[0];
  // Give the other competition a place on the front page even when one desk publishes more often.
  const otherCompetition = articles.find(article => article.competition !== lead?.competition);
  const secondary = [...new Map([otherCompetition, ...articles.slice(1)].filter(article => !!article).map(article => [article.id, article])).values()].slice(0, 2);
  const competitors = [...(query.data?.competitors ?? [])].sort((a, b) => b.facts.length - a.facts.length);
  usePageMeta({ title: 'The ARC Daily — competition news', description: 'Morning and evening dispatches from the ARC-AGI-2 and ARC-AGI-3 competition leaderboards, with sourced competitor notebooks.', canonicalPath: '/news' });

  return <NewsPaper frontPage date={lead?.date}>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <>
      <div className="news-front-grid">
        <div>
          {lead ? <StoryPreview article={lead} lead /> : <section className="news-status"><h2>The first edition is on its way</h2><p>Published morning and evening reports will appear here. The public standings are available now.</p><Link href="/kaggle-leaderboard" className="news-read">Read the ARC-3 board →</Link><br /><Link href="/kaggle-leaderboard/arc-2" className="news-read">Read the ARC-2 board →</Link></section>}
          {!!secondary.length && <div className="news-secondary">{secondary.map(article => <StoryPreview key={article.id} article={article} />)}</div>}
        </div>
        <aside className="news-sidebar" aria-label="Competitor notebook">
          <h2 className="news-section-title">The competitor notebook</h2>
          {competitors.slice(0, 4).map(competitor => <NotebookEntry key={competitor.id} competitor={competitor} />)}
          {!competitors.length && <p className="news-muted">Competitor records appear as the desk gathers observations and sources.</p>}
          <Link href="/news/competitors" className="news-read">Browse every competitor →</Link>
          <div className="news-note" style={{ marginTop: 28 }}><strong>At the desk</strong><p>Morning editions look at movement since UTC midnight. Evening editions compare the daily race. Each dispatch records its actual snapshot and comparison time.</p></div>
        </aside>
      </div>
      <ArticleArchive articles={articles} heading="Every edition" />
    </>}
  </NewsPaper>;
}
