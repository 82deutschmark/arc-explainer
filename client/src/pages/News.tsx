/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-08
 * PURPOSE: ARC Daily landing page for both Kaggle contests, with ARC-AGI-3 as the
 *          lead, separate ARC-AGI-2 coverage, sourced cards, existing Hall of Fame art,
 *          and community/resource links, plus banner and portrait sidebar advertising.
 * SRP/DRY check: Pass — uses shared newspaper presentation, query and news contract.
 */
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC_DISCORD_URL, ArticleArchive, NewsPaper, NewsStatus, NotebookEntry, StoryPreview, sortedArticles, useNews } from '@/components/news/NewsDesk';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

export default function News() {
  const query = useNews();
  const articles = sortedArticles(query.data?.articles ?? []);
  const arc3Articles = articles.filter(article => article.competition === 'arc-3');
  const arc2Articles = articles.filter(article => article.competition === 'arc-2');
  const lead = arc3Articles[0];
  const competitors = [...(query.data?.competitors ?? [])].filter(record => record.competition === 'arc-3').sort((a, b) => b.facts.length - a.facts.length || a.name.localeCompare(b.name));
  usePageMeta({ title: 'The ARC Daily — ARC-AGI-3 and ARC-AGI-2 news', description: 'Daily coverage of both ARC Prize Kaggle contests, with live leaderboard graphics, human records and sourced competitor profiles.', canonicalPath: '/news' });

  return <NewsPaper frontPage date={lead?.date}>
    <section className="news-intro" aria-label="About The ARC Daily">
      <div className="news-intro-copy"><span className="news-eyebrow">ARC Explainer / Competition desk</span><h1>The daily story of ARC-AGI-3 and ARC-AGI-2.</h1><p>Follow both Kaggle contests: the leaders, the challengers, and the moves that change the field. ARC-AGI-3 leads the front page; each contest has its own report and live board.</p></div>
      <a className="news-intro-link" href="/kaggle-leaderboard#medal-race">Explore the ARC-AGI-3 race <span aria-hidden="true">↗</span></a>
    </section>
    <SponsorPlacement format="banner" />
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
          <SponsorPlacement format="rail" />
        </aside>
      </div>
      <section className="news-explore" aria-label="Explore the contests and community">
        <div className="news-section-heading"><div><span className="news-eyebrow">Beyond the headlines</span><h2>Explore the contests</h2></div><p>Live charts, game records and the ARC community put each dispatch in context.</p></div>
        <div className="news-explore-grid">
          <a href="/kaggle-leaderboard#medal-race"><span>01 / ARC-AGI-3</span><strong>Medal race graphic</strong><p>See where teams stand around the public cutoffs, then widen the view to the full board.</p><em>Open chart ↗</em></a>
          <a href="/kaggle-leaderboard#score-history"><span>02 / ARC-AGI-3</span><strong>Score history</strong><p>Trace the leader, medal lines and changing scores through saved leaderboard snapshots.</p><em>Open graphics ↗</em></a>
          <a href="/kaggle-leaderboard/arc-2#medal-race"><span>03 / ARC-AGI-2</span><strong>ARC-AGI-2 leaderboard</strong><p>Follow its separate public standings, medal race, score history and full field.</p><em>Open board ↗</em></a>
          <a href="/human-records.html"><span>04 / The games</span><strong>Human &amp; AI records</strong><p>Compare published human action counts with AI scores, full wins and replay links for the public games.</p><em>Explore records ↗</em></a>
          <Link href="/arc3/games"><span>05 / The rules</span><strong>Official game guides</strong><p>See pictures, per-level notes and play records for the 25 public ARC-AGI-3 games.</p><em>Browse guides ↗</em></Link>
          <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer"><span>06 / The community</span><strong>ARC Discord</strong><p>Join the official ARC Prize community to discuss the contests and the games.</p><em>Join the conversation ↗</em></a>
        </div>
      </section>
      <section className="news-people-archive" aria-label="ARC Hall of Fame cards">
        <div className="news-people-archive-copy"><span className="news-eyebrow">From the ARC Explainer archive</span><h2>The people behind the puzzles.</h2><p>The illustrated Hall of Fame collects past ARC contributors and prize stories. The dossiers below follow the current Kaggle teams with their own sourced records.</p><Link href="/hall-of-fame" className="news-read">Browse the Hall of Fame cards →</Link></div>
        <Link href="/hall-of-fame" className="news-people-archive-art" aria-label="Explore the illustrated ARC Hall of Fame">
          <img src="/ARChitechts.png" alt="Historical ARChitects team card" loading="lazy" />
          <img src="/jfPuget3.png" alt="Historical Jean-François Puget card" loading="lazy" />
          <img src="/dries.png" alt="Historical Dries Smit card" loading="lazy" />
        </Link>
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
