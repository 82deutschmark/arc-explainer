/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-08
 * PURPOSE: ARC-AGI-3-first daily landing page with separate ARC-AGI-2 coverage,
 *          sourced competitor cards, and direct routes into Explainer's results and guides.
 * SRP/DRY check: Pass — uses shared newspaper presentation, query and news contract.
 */
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, NewsPaper, NewsStatus, NotebookEntry, StoryPreview, sortedArticles, useNews } from '@/components/news/NewsDesk';

export default function News() {
  const query = useNews();
  const articles = sortedArticles(query.data?.articles ?? []);
  const arc3Articles = articles.filter(article => article.competition === 'arc-3');
  const arc2Articles = articles.filter(article => article.competition === 'arc-2');
  const lead = arc3Articles[0];
  const competitors = [...(query.data?.competitors ?? [])].filter(record => record.competition === 'arc-3').sort((a, b) => b.facts.length - a.facts.length || a.name.localeCompare(b.name));
  usePageMeta({ title: 'The ARC Daily — ARC-AGI-3 Kaggle contest daily', description: 'ARC-AGI-3 Kaggle contest reporting, leaderboard graphics, human records and sourced competitor profiles. ARC-AGI-2 editions are covered separately.', canonicalPath: '/news' });

  return <NewsPaper frontPage date={lead?.date}>
    <section className="news-intro" aria-label="About The ARC Daily">
      <div className="news-intro-copy"><span className="news-eyebrow">ARC Explainer / Competition desk</span><h1>The ARC-AGI-3 Kaggle contest daily.</h1><p>Follow the public race, meet the people on the board, and go straight to the charts and game records behind the story.</p></div>
      <a className="news-intro-link" href="/kaggle-leaderboard#medal-race">Explore the medal race <span aria-hidden="true">↗</span></a>
    </section>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <>
      <div className="news-front-grid">
        <section aria-label="ARC-AGI-3 lead story">
          <h2 className="news-section-title">Latest from ARC-AGI-3</h2>
          {lead ? <StoryPreview article={lead} lead /> : <div className="news-status"><h3>The first ARC-AGI-3 edition is on its way</h3><p>Until then, explore the live public board and its charts.</p><Link href="/kaggle-leaderboard" className="news-read">Open the ARC-AGI-3 board →</Link></div>}
          {!!arc3Articles.slice(1, 3).length && <div className="news-secondary">{arc3Articles.slice(1, 3).map(article => <StoryPreview key={article.id} article={article} />)}</div>}
        </section>
        <aside className="news-sidebar" aria-label="ARC-AGI-2 desk">
          <h2 className="news-section-title">The ARC-AGI-2 desk</h2>
          <p className="news-muted">A separate competition, with its own standings and editions.</p>
          {arc2Articles[0] ? <StoryPreview article={arc2Articles[0]} /> : <p className="news-muted">No ARC-AGI-2 edition has been published yet.</p>}
          <Link href="/kaggle-leaderboard/arc-2" className="news-read">Explore the ARC-AGI-2 board →</Link>
        </aside>
      </div>
      <section className="news-explore" aria-label="Explore ARC-AGI-3">
        <div className="news-section-heading"><div><span className="news-eyebrow">Beyond the headlines</span><h2>Explore the race</h2></div><p>Live charts and dated records put each dispatch in context.</p></div>
        <div className="news-explore-grid">
          <a href="/kaggle-leaderboard#medal-race"><span>01 / The field</span><strong>Medal race graphic</strong><p>See where teams stand around the public cutoffs, then widen the view to the full board.</p><em>Open chart ↗</em></a>
          <a href="/kaggle-leaderboard#score-history"><span>02 / The trend</span><strong>Score history</strong><p>Trace the leader, medal lines and changing scores through saved leaderboard snapshots.</p><em>Open graphics ↗</em></a>
          <a href="/human-records.html"><span>03 / The games</span><strong>Human &amp; AI records</strong><p>Compare published human action counts with AI scores, full wins and replay links for the public games.</p><em>Explore records ↗</em></a>
          <Link href="/arc3/games"><span>04 / The rules</span><strong>Official game guides</strong><p>See pictures, per-level notes and play records for the 25 public ARC-AGI-3 games.</p><em>Browse guides ↗</em></Link>
        </div>
      </section>
      <section className="news-competitor-section" aria-label="ARC-AGI-3 competitor notebook">
        <div className="news-section-heading"><div><span className="news-eyebrow">People and teams</span><h2>The competitor notebook</h2></div><p>Short, sourced dossiers. Team identities stay tied to the competition where they were observed.</p></div>
        <div className="news-directory-grid">{competitors.slice(0, 9).map(competitor => <NotebookEntry key={competitor.id} competitor={competitor} />)}</div>
        {!competitors.length && <p className="news-muted">Competitor records appear as the desk gathers observations and sources.</p>}
        <Link href="/news/competitors" className="news-read">Browse every competitor dossier →</Link>
      </section>
      <div className="news-bottom-links"><Link href="/arc3">ARC-AGI-3 background ↗</Link><Link href="/home">ARC Explainer resource hub ↗</Link><Link href="/kaggle-leaderboard/arc-2">ARC-AGI-2 standings ↗</Link></div>
      <ArticleArchive articles={articles} heading="Every edition" />
    </>}
  </NewsPaper>;
}
