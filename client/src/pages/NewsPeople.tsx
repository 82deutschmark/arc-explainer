/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 / Codex (reasoning effort not exposed); GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 03-November-2026; 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): "Their cards" reads the shared useNewsCollection() query and names each card by its set
 *          (falling back to the season) in the caption and alt text, so two 2026 cards no longer both read "2026".
 * 14-Nov-2026 (Claude Opus 5.5, profiles-articles): profile only (the /news/people directory redirects to /news/cards);
 *          its own meta description; teams also come from competitor rosters that list a verified handle
 *          (personTeams); sponsors get a Sponsors kicker and no competition-teams section; a team without a
 *          published profile prints as plain text and roster sources open the human leaderboard page.
 * PURPOSE: Durable person profiles with separate, dated competition memberships.
 *          09-Oct-2026 (Claude Opus 5.5): every card and profile leads with the person's face and
 *          their honors from the ARC Explainer Hall of Fame; each card's art appears once.
 * SRP/DRY check: Pass — uses verified public ledger and existing news shell; no inferred identities.
 *          Faces, honors and cards come from components/news/NewsPeople.tsx.
 */
import { Link, useParams } from 'wouter';
import { collectionShareVersion } from '@shared/newsCollection';
import { catalogSetLabel } from '@shared/cardCatalog';
import { useNewsCollection } from '@/hooks/useNewsCollection';
import { personPath, competitorPath, personDescription, personTeams, rosterSourceHref, NEWS_NAME, competitionName, type CompetitorRecord, type NewsPerson } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, newsDate, useNewsCardImage } from '@/components/news/NewsDesk';
import { PersonHonors, PersonPortrait, PortraitCredit } from '@/components/news/NewsPeople';

/** /news/people/:personId. The bare /news/people directory redirects to the card catalog (shared/seo.ts REDIRECTS). */
export default function NewsPeople() {
  const { personId = '' } = useParams<{ personId?: string }>();
  const query = useNews();
  const person = query.data?.people?.find(item => item.id === personId);
  // Same title and description as the server-rendered head (newsPresentation personMeta).
  usePageMeta({ title: `${person?.name ?? 'Person'} | ${NEWS_NAME}`, description: person ? personDescription(person) : undefined, canonicalPath: personPath(personId), noindex: !person, image: useNewsCardImage() });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {person ? <PersonProfile person={person} competitors={query.data?.competitors ?? []} /> : query.data && <p>No verified person record published for this ID.</p>}
  </NewsPaper>;
}

function PersonProfile({ person, competitors }: { person: NewsPerson; competitors: CompetitorRecord[] }) {
  const shownArt = new Set<string>();
  const collection = useNewsCollection();
  const cards = collection.data?.cards.filter(card => card.personId === person.id) ?? [];
  // Sponsors (the ARC Prize co-founders) run the contest; they are on no competition roster.
  const sponsor = person.role === 'sponsor';
  const teams = sponsor ? [] : personTeams(person, competitors);
  return <>
    <header className="news-person-header">
      <PersonPortrait person={person} size="hero" />
      <div>
        <div className="news-kicker">{sponsor ? 'Sponsors' : 'Contestants and contenders'}</div>
        <h1>{person.name}</h1>
        <PersonHonors person={person} linked />
        <PortraitCredit person={person} />
      </div>
    </header>
    <div className="news-article-grid">
      <section>
        {!!cards.length && <><h2 className="news-section-title">Their cards</h2><div className="news-story-cards">{cards.map(card => <Link key={card.id} href={card.cardUrl} className="news-story-card"><img src={`/api/news/cards/${encodeURIComponent(card.id)}/thumb.webp?side=front&w=300&v=${collectionShareVersion(card)}`} width={300} height={420} loading="lazy" alt={`${person.name}, ${catalogSetLabel(card, collection.data?.sets)} card`} /><span className="news-story-card-name">{catalogSetLabel(card, collection.data?.sets)}</span></Link>)}</div></>}
        {person.briefing && <p className="news-dek">{person.briefing}</p>}
        {!!person.facts.length && <><h2 className="news-section-title">On the record</h2><ul className="news-facts">{person.facts.map((fact, index) => <li key={index}><p>{fact.text}</p><a href={fact.sourceUrl}>{fact.sourceTitle} ↗</a><div className="news-muted">Checked {newsDate(fact.checkedAt)}</div></li>)}</ul></>}
        {!sponsor && <>
          <h2 className="news-section-title">Observed competition teams</h2>
          <ul className="news-facts">{teams.map(member => {
            const teamId = `${member.competition}-${member.teamId}`;
            // Only a published team profile is linked (in-app, relative); otherwise the name is plain text.
            return <li key={`${member.competitionId}-${member.teamId}`}><h3>{competitors.some(team => team.id === teamId) ? <Link href={competitorPath(teamId)}>{member.teamName}</Link> : member.teamName}</h3><p>{competitionName(member.competition)} · {member.season} · <code>{member.memberHandle}</code></p><p className="news-muted">Observed {newsDate(member.firstObservedAt)}–{newsDate(member.lastObservedAt)}. <a href={rosterSourceHref(member)}>Roster source</a></p></li>;
          })}</ul>
          {!teams.length && <p className="news-muted">No observed competition roster lists this person’s verified accounts.</p>}
          <p className="news-muted">These are saved roster observations. They do not establish when someone joined or left, or who contributed to a submission.</p>
        </>}
      </section>
      <aside className="news-sidebar">
        <h2 className="news-section-title">Public accounts</h2>
        <ul className="news-facts">{person.accounts.map(account => <li key={account.url}><a href={account.url}>{account.platform === 'x' ? '@' : ''}{account.handle} ↗</a><div className="news-muted"><a href={account.sourceUrl}>Identity source ↗</a> · checked {newsDate(account.checkedAt)}</div></li>)}</ul>
        {!!person.hallOfFame.length && <><h2 className="news-section-title">From the Hall of Fame</h2><ul className="news-facts">{person.hallOfFame.map(card => {
          // A card shared by two honors (the same team art for 2024 and 2025) prints once.
          const art = card.image && !shownArt.has(card.image.src) ? card.image : undefined;
          if (card.image) shownArt.add(card.image.src);
          return <li key={card.path}><Link href={card.path}>{art && <img className="news-historical-card" src={art.src} alt={art.alt} loading="lazy" />}{card.label} →</Link><div className="news-muted"><a href={card.sourceUrl}>{card.sourceTitle} ↗</a> · checked {newsDate(card.checkedAt)}</div></li>;
        })}</ul></>}
        <Link href="/news/cards" className="news-read">All cards →</Link>
      </aside>
    </div>
  </>;
}
