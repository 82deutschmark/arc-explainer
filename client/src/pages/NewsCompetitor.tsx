/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Competition-scoped competitor notebook showing sourced facts, observed
 *          aliases and members, observation dates and the team's published coverage.
 * SRP/DRY check: Pass — identity and claims come from shared NewsIndex records only.
 */
import { Link, useParams } from 'wouter';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, NewsPaper, NewsStatus, competitionName, newsDate, sortedArticles, useNews } from '@/components/news/NewsDesk';

export default function NewsCompetitor() {
  const { competitorId } = useParams<{ competitorId: string }>();
  const query = useNews();
  const competitor = query.data?.competitors.find(record => record.id === competitorId);
  const missing = !!query.data && !competitor;
  const articles = competitor ? sortedArticles(query.data?.articles ?? []).filter(article => article.competition === competitor.competition && article.teamIds.includes(competitor.teamId)) : [];
  usePageMeta({ title: competitor ? `${competitor.name} — ${competitionName(competitor.competition)} notebook | The ARC Daily` : 'Competitor notebook | The ARC Daily', description: competitor ? `Sourced facts and observed team identities for ${competitor.name} in ${competitionName(competitor.competition)}, with competition coverage from The ARC Daily.` : undefined, canonicalPath: `/news/competitors/${competitorId}`, noindex: !competitor });
  return <NewsPaper>
    <Link href="/news/competitors" className="news-back">← All competitor notebooks</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {missing && <section className="news-status"><h1 className="news-article-title">No notebook published yet</h1><p>The desk has not published a record for this competition team.</p><Link href="/news/competitors" className="news-read">Browse the competitor notebook →</Link></section>}
    {competitor && <>
      <header className="news-directory-header"><div className="news-kicker">{competitionName(competitor.competition)} · Competitor notebook</div><h1>{competitor.name}</h1><p>A record of sourced facts and observed identities, with dispatches from the competition desk.</p></header>
      <div className="news-identity"><span><strong>Competition</strong><br /><code>{KAGGLE_COMPETITIONS[competitor.competition].slug}</code></span><span><strong>Kaggle team ID</strong><br />{competitor.teamId}</span><span><strong>First observed</strong><br />{newsDate(competitor.firstObservedAt, true)}</span><span><strong>Last observed</strong><br />{newsDate(competitor.lastObservedAt, true)}</span></div>
      <div className="news-article-grid">
        <section><h2 className="news-section-title">On the record</h2>
          {competitor.facts.length ? <ul className="news-facts">{competitor.facts.map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}><p>{fact.text}</p><div className="news-fact-source"><a href={fact.sourceUrl}>{fact.sourceTitle} ↗</a><br />Checked {newsDate(fact.checkedAt)}</div></li>)}</ul> : <p className="news-muted">No sourced background facts have been added. Observed competition names and members are recorded alongside.</p>}
        </section>
        <aside className="news-sidebar news-observations" aria-label="Observed team identity"><h2 className="news-section-title">Identity ledger</h2><h3>Observed aliases</h3>{competitor.aliases.length ? <ul>{competitor.aliases.map(alias => <li key={alias}>{alias}</li>)}</ul> : <p>No additional aliases recorded.</p>}<h3>Observed members</h3>{competitor.members.length ? <ul>{competitor.members.map(member => <li key={member}>{member}</li>)}</ul> : <p>No member names recorded.</p>}<p className="news-muted" style={{ marginTop: 20 }}>These observations describe this competition team. First observed is the first saved observation, not a claim about when the team entered.</p><Link href={KAGGLE_COMPETITIONS[competitor.competition].path} className="news-read">Open this competition's board →</Link></aside>
      </div>
      <ArticleArchive articles={articles} heading="In the paper" />
    </>}
  </NewsPaper>;
}
