/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 Sol / Codex; GPT-6 Astra Extra high; Claude Sonnet 5.5 Medium
 * Date: 05-November-2026; 03-November-2026; 02-November-2026
 * PURPOSE: Competition-scoped competitor profile showing sourced facts, observed
 *          aliases and members, observation dates and the team's published coverage.
 *          08-Oct-2026: title and description from shared/news.ts, matching server HTML;
 *          observed identity dates show without routine clock times.
 *          05-Nov-2026 (Claude Sonnet 5.5 Medium, Boss: "the layout is awful"): redesigned. The roster's real cards lead the page,
 *          the sourced facts read as editorial text, and the raw identifiers (team ID, observation dates, the internal
 *          competition alias) move to a small fact sheet. Observation dates are not shown: they only record when our
 *          intake last saw the team on the public board, which means nothing once a contest has closed. The team's
 *          approved picture (competitor.art) shows under the hero. All data and links are unchanged.
 * SRP/DRY check: Pass — identity and claims come from shared NewsIndex records only; layout is competitorProfile.css.
 */
import { TeamRosterCards } from '@/components/news/NewsPeople';
import { Link, useParams } from 'wouter';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { NEWS_NAME, competitorTitle, competitorDescription, peopleForTeam } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ArticleArchive, NewsPaper, NewsStatus, competitionName, newsDate, sortedArticles, useNews, useNewsCardImage } from '@/components/news/NewsDesk';
import '@/components/news/competitorProfile.css';

export default function NewsCompetitor() {
  const { competitorId } = useParams<{ competitorId: string }>();
  const query = useNews();
  const competitor = query.data?.competitors.find(record => record.id === competitorId);
  const missing = !!query.data && !competitor;
  const articles = competitor ? sortedArticles(query.data?.articles ?? []).filter(article => article.competition === competitor.competition && article.teamIds.includes(competitor.teamId)) : [];
  usePageMeta({ title: competitor ? competitorTitle(competitor) : `Competitor profiles | ${NEWS_NAME}`, description: competitor ? competitorDescription(competitor) : undefined, canonicalPath: `/news/competitors/${competitorId}`, noindex: !competitor, image: useNewsCardImage() });
  // The internal profile id (for example "arc-2-16442485") is an address, not a name the team ever used: keep it out of the aliases.
  const aliases = competitor ? competitor.aliases.filter(alias => alias.toLowerCase() !== competitor.id.toLowerCase()) : [];
  const names = competitor ? peopleForTeam(query.data?.people ?? [], competitor).map(person => person.name) : [];
  const board = competitor ? KAGGLE_COMPETITIONS[competitor.competition] : null;
  return <NewsPaper>
    <Link href="/news/cards" className="news-back">← All cards</Link>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {missing && <section className="news-status"><h1 className="news-article-title">No profile published yet</h1><p>The desk has not published a record for this competition team.</p><Link href="/news/cards" className="news-read">Browse cards →</Link></section>}
    {competitor && board && <>
      <header className="cp-hero">
        <div>
          <div className="news-kicker cp-kicker">{competitionName(competitor.competition)} · Team</div>
          <h1>{competitor.name}</h1>
          {!!names.length && <p className="cp-byline">{names.join(' and ')}</p>}
          {!!aliases.length && <p className="cp-aka">Also entered as {aliases.join(', ')}</p>}
          <div className="cp-actions"><Link href={board.path} className="news-read">See the {competitionName(competitor.competition)} board →</Link></div>
        </div>
        {!!competitor.members.length && <TeamRosterCards team={competitor} people={query.data?.people} />}
      </header>
      {competitor.art && <figure className="cp-figure"><img src={competitor.art.src} alt={competitor.art.alt} loading="lazy" decoding="async" /><figcaption>{competitor.art.caption}</figcaption></figure>}
      <div className="cp-main">
        <section><h2 className="news-section-title">On the record</h2>
          {competitor.facts.length ? <ul className="cp-facts">{competitor.facts.map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}><p>{fact.text}</p><div className="cp-source"><a href={fact.sourceUrl}>{fact.sourceTitle} ↗</a> · checked {newsDate(fact.checkedAt)}</div></li>)}</ul> : <p className="news-muted">No sourced background facts have been added yet.</p>}
        </section>
        <aside className="cp-aside" aria-label="Team details"><h2>Team details</h2>
          <dl><dt>Kaggle team ID</dt><dd>{competitor.teamId}</dd></dl></aside>
      </div>
      <div className="cp-paper"><ArticleArchive articles={articles} heading="In the paper" /></div>
    </>}
  </NewsPaper>;
}
