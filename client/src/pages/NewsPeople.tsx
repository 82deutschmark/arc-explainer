/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: People directory and durable person profiles with separate, dated competition memberships.
 * SRP/DRY check: Pass — uses verified public ledger and existing news shell; no inferred identities.
 */
import { Link, useParams } from 'wouter';
import { personPath, competitorPath, NEWS_NAME, competitionName } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, newsDate } from '@/components/news/NewsDesk';
import { PersonLinks } from '@/components/news/NewsPeople';

export default function NewsPeople() {
  const { personId } = useParams<{ personId?: string }>();
  const query = useNews();
  const people = query.data?.people ?? [];
  const person = people.find(item => item.id === personId);
  usePageMeta({ title: `${person?.name ?? 'People behind the teams'} | ${NEWS_NAME}`, canonicalPath: personId ? personPath(personId) : '/news/people', noindex: !!personId && !person });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    <header className="news-directory-header"><div className="news-kicker">Contestants and contenders</div><h1>{person?.name ?? 'People behind the teams'}</h1><p>Follow the people, their observed teams and their place in the ARC archive.</p></header>
    {personId ? person ? <div className="news-article-grid"><section><h2 className="news-section-title">On the record</h2><ul className="news-facts">{person.facts.map((fact, index) => <li key={index}><p>{fact.text}</p><a href={fact.sourceUrl}>{fact.sourceTitle} ↗</a><div className="news-muted">Checked {newsDate(fact.checkedAt)}</div></li>)}</ul><h2 className="news-section-title">Observed competition teams</h2><ul className="news-facts">{person.memberships.map(member => <li key={`${member.competitionId}-${member.teamId}`}><h3><Link href={query.data?.competitors.some(team => team.id === `${member.competition}-${member.teamId}`) ? competitorPath(`${member.competition}-${member.teamId}`) : member.sourceUrl}>{member.teamName}</Link></h3><p>{competitionName(member.competition)} · {member.season} · <code>{member.memberHandle}</code></p><p className="news-muted">Observed {newsDate(member.firstObservedAt)}–{newsDate(member.lastObservedAt)}. <a href={member.sourceUrl}>Roster source ↗</a></p></li>)}</ul><p className="news-muted">These are saved roster observations. They do not establish when someone joined or left, or who contributed to a submission.</p></section><aside className="news-sidebar"><h2 className="news-section-title">Public accounts</h2><ul className="news-facts">{person.accounts.map(account => <li key={account.url}><a href={account.url}>{account.platform === 'x' ? '@' : ''}{account.handle} ↗</a><div className="news-muted"><a href={account.sourceUrl}>Identity source ↗</a> · checked {newsDate(account.checkedAt)}</div></li>)}</ul>{!!person.hallOfFame.length && <><h2 className="news-section-title">From the Hall of Fame</h2><ul className="news-facts">{person.hallOfFame.map(card => <li key={card.path}><Link href={card.path}>{card.image && <img className="news-historical-card" src={card.image.src} alt={card.image.alt} loading="lazy" />}{card.label} →</Link><div className="news-muted">Historical artwork from the ARC Hall of Fame. <a href={card.sourceUrl}>Archive source ↗</a></div></li>)}</ul></>}<Link href="/news/people" className="news-read">All people →</Link></aside></div> : query.data && <p>No verified person record published for this ID.</p> : <div className="news-directory-grid">{people.map(item => <article key={item.id} className="news-notebook-entry"><h2><PersonLinks person={item} /></h2><p>{item.memberships.map(member => `${member.teamName} (${competitionName(member.competition)}, ${member.season})`).join(' · ')}</p>{item.facts[0] && <p>{item.facts[0].text}</p>}</article>)}</div>}
  </NewsPaper>;
}
