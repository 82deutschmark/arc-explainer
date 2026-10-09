/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: ARC Daily landing page for both Kaggle contests, with ARC-AGI-3 as the
 *          lead, separate ARC-AGI-2 coverage, sourced cards, existing Hall of Fame art,
 *          and community links. Latest editions and sourced social dispatches lead
 *          the page immediately, above the resource shelf and display advertising.
 *          09-Oct-2026 (Claude Opus 5.5): the Hall of Fame band shows the cards of past winners
 *          in the latest editions first, so it changes with the news; notebook cards show faces.
 * SRP/DRY check: Pass — uses shared newspaper presentation, query and news contract.
 */
import { Link } from 'wouter';
import { personPath, storyPeople, type NewsIndex } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC_DISCORD_URL, ArticleArchive, NewsPaper, NewsStatus, NotebookEntry, sortedArticles, useNews } from '@/components/news/NewsDesk';
import { NewsFrontPage } from '@/components/news/NewsFrontPage';
import { SponsorPlacement } from '@/components/news/SponsorPlacement';

/** Three Hall of Fame cards: past winners in the latest editions first, then the rest of the ledger's past winners. */
function archiveCards(index: NewsIndex) {
  const people = index.people ?? [];
  const inTheNews = sortedArticles(index.articles).slice(0, 4).flatMap(article => storyPeople(article, people, index.competitors));
  const cards: { src: string; alt: string; href: string }[] = [];
  for (const person of [...inTheNews, ...people]) {
    const card = person.hallOfFame.find(item => item.image && !cards.some(shown => shown.src === item.image!.src));
    if (card?.image && cards.length < 3) cards.push({ src: card.image.src, alt: card.image.alt, href: personPath(person.id) });
  }
  return cards;
}

export default function News() {
  const query = useNews();
  const articles = sortedArticles(query.data?.articles ?? []);
  const latestAt = [articles[0]?.publishedAt, ...(query.data?.dispatches ?? []).map(dispatch => dispatch.publishedAt)].filter((date): date is string => !!date).sort().at(-1);
  const competitors = [...(query.data?.competitors ?? [])].filter(record => record.competition === 'arc-3').sort((a, b) => b.facts.length - a.facts.length || a.name.localeCompare(b.name));
  usePageMeta({ title: 'The ARC Daily Digest — ARC-AGI-3 and ARC-AGI-2 news', description: 'Daily coverage of both ARC Prize Kaggle contests, with live leaderboard graphics, human records and sourced competitor profiles.', canonicalPath: '/news' });

  return <NewsPaper frontPage date={latestAt}>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && <>
      <NewsFrontPage index={query.data} />
      <SponsorPlacement format="banner" />
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
        <div className="news-people-archive-art">{archiveCards(query.data).map(card => <Link key={card.src} href={card.href}><img src={card.src} alt={card.alt} loading="lazy" /></Link>)}</div>
      </section>
      <section className="news-competitor-section" aria-label="ARC-AGI-3 competitor notebook">
        <div className="news-section-heading"><div><span className="news-eyebrow">People and teams</span><h2>The competitor notebook</h2></div><p>Short, sourced dossiers. Team identities stay tied to the competition where they were observed.</p></div>
        <div className="news-directory-grid">{competitors.slice(0, 9).map(competitor => <NotebookEntry key={competitor.id} competitor={competitor} people={query.data.people} />)}</div>
        {!competitors.length && <p className="news-muted">Competitor records appear as the desk gathers observations and sources.</p>}
        <Link href="/news/competitors" className="news-read">Browse every competitor dossier →</Link>
      </section>
      <div className="news-bottom-links"><Link href="/arc3">ARC-AGI-3 background ↗</Link><Link href="/home">ARC Explainer resource hub ↗</Link><Link href="/kaggle-leaderboard/arc-2">ARC-AGI-2 standings ↗</Link></div>
      <ArticleArchive articles={articles} heading="Every edition" />
    </>}
  </NewsPaper>;
}
