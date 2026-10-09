/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: People directory and durable person profiles with separate, dated competition memberships.
 *          09-Oct-2026 (Claude Opus 5.5): every card and profile leads with the person's face and
 *          their honors from the ARC Explainer Hall of Fame; each card's art appears once.
 * SRP/DRY check: Pass — uses verified public ledger and existing news shell; no inferred identities.
 *          Faces, honors and cards come from components/news/NewsPeople.tsx.
 */
import { Link, useParams } from 'wouter';
import { personPath, competitorPath, NEWS_NAME, competitionName, type CompetitorRecord, type NewsPerson } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, newsDate } from '@/components/news/NewsDesk';
import { PersonCard, PersonHonors, PersonPortrait, PortraitCredit } from '@/components/news/NewsPeople';

export default function NewsPeople() {
  const { personId } = useParams<{ personId?: string }>();
  const query = useNews();
  const people = query.data?.people ?? [];
  const person = people.find(item => item.id === personId);
  usePageMeta({ title: `${person?.name ?? 'People behind the teams'} | ${NEWS_NAME}`, canonicalPath: personId ? personPath(personId) : '/news/people', noindex: !!personId && !person });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {personId
      ? person ? <PersonProfile person={person} competitors={query.data?.competitors ?? []} /> : query.data && <p>No verified person record published for this ID.</p>
      : <>
        <header className="news-directory-header"><div className="news-kicker">Contestants and contenders</div><h1>People behind the teams</h1><p>Follow the people, their observed teams and their place in the ARC archive.</p></header>
        <div className="news-directory-grid">{people.map(item => <PersonCard key={item.id} person={item} />)}</div>
      </>}
  </NewsPaper>;
}

function PersonProfile({ person, competitors }: { person: NewsPerson; competitors: CompetitorRecord[] }) {
  const shownArt = new Set<string>();
  return <>
    <header className="news-person-header">
      <PersonPortrait person={person} size="hero" />
      <div>
        <div className="news-kicker">Contestants and contenders</div>
        <h1>{person.name}</h1>
        <PersonHonors person={person} linked />
        <PortraitCredit person={person} />
      </div>
    </header>
    <div className="news-article-grid">
      <section>
        {!!person.facts.length && <><h2 className="news-section-title">On the record</h2><ul className="news-facts">{person.facts.map((fact, index) => <li key={index}><p>{fact.text}</p><a href={fact.sourceUrl}>{fact.sourceTitle} ↗</a><div className="news-muted">Checked {newsDate(fact.checkedAt)}</div></li>)}</ul></>}
        <h2 className="news-section-title">Observed competition teams</h2>
        <ul className="news-facts">{person.memberships.map(member => <li key={`${member.competitionId}-${member.teamId}`}><h3><Link href={competitors.some(team => team.id === `${member.competition}-${member.teamId}`) ? competitorPath(`${member.competition}-${member.teamId}`) : member.sourceUrl}>{member.teamName}</Link></h3><p>{competitionName(member.competition)} · {member.season} · <code>{member.memberHandle}</code></p><p className="news-muted">Observed {newsDate(member.firstObservedAt)}–{newsDate(member.lastObservedAt)}. <a href={member.sourceUrl}>Roster source ↗</a></p></li>)}</ul>
        {!person.memberships.length && <p className="news-muted">No observed competition roster lists this person’s verified accounts.</p>}
        <p className="news-muted">These are saved roster observations. They do not establish when someone joined or left, or who contributed to a submission.</p>
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
        <Link href="/news/people" className="news-read">All people →</Link>
      </aside>
    </div>
  </>;
}
