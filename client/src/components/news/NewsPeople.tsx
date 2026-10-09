/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Reusable person and roster links for competition reporting, including sourced historical cards.
 * SRP/DRY check: Pass — exact verified account matches reuse the shared identity ledger.
 */
import { Link } from 'wouter';
import { personPath, peopleForTeam, newsDate, type CompetitorRecord, type NewsPerson } from '@shared/news';

export function PersonLinks({ person }: { person: NewsPerson }) {
  return <><Link href={personPath(person.id)}>{person.name} →</Link>{person.hallOfFame.map(card => <span key={card.path} className="news-person-history"> · <Link href={card.path}>{card.label} ↗</Link></span>)}</>;
}

export function TeamPeople({ team, people = [] }: { team: CompetitorRecord; people?: NewsPerson[] }) {
  const known = peopleForTeam(people, team);
  return <div className="news-team-people"><ul>{team.members.map(handle => {
    const person = known.find(item => item.accounts.some(account => account.platform === 'kaggle' && account.handle === handle));
    return <li key={handle}>{person ? <PersonLinks person={person} /> : <a href={`https://www.kaggle.com/${encodeURIComponent(handle)}`}>{handle} ↗</a>}</li>;
  })}</ul><p className="news-muted">Roster observed {newsDate(team.lastObservedAt)}.</p></div>;
}
