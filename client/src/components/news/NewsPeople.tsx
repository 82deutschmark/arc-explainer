/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: Reusable person pieces for competition reporting: faces (Hall of Fame crop or saved
 *          Kaggle picture, initials when a person has neither), roster chips, the "in this story"
 *          face strip, directory cards and honors that link to the person's Hall of Fame cards.
 *          Used by the people pages, team rosters, editions, dispatches and the community desk.
 * SRP/DRY check: Pass — exact verified account matches reuse the shared identity ledger; every
 *          view draws a person through PersonPortrait so a face looks the same everywhere.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { personPath, peopleForTeam, newsDate, competitionName, personInitials, shortPersonName, type CompetitorRecord, type NewsCompetition, type NewsPerson } from '@shared/news';

type PortraitSize = 'chip' | 'face' | 'card' | 'hero';

/** A person's face. Decorative when their name is printed right beside it. */
export function PersonPortrait({ person, size, decorative = false }: { person: NewsPerson; size: PortraitSize; decorative?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = `news-portrait news-portrait-${size}`;
  if (!person.portrait || failed) return <span className={`${className} news-portrait-initials`} aria-hidden="true">{personInitials(person.name)}</span>;
  return <img className={className} src={person.portrait.src} alt={decorative ? '' : person.portrait.alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

/** Name with face and the person's top honor, for rosters and source lines. */
export function PersonLinks({ person, honors = 1 }: { person: NewsPerson; honors?: number }) {
  return <span className="news-person-chip"><PersonPortrait person={person} size="chip" decorative /><span><Link href={personPath(person.id)}>{person.name} →</Link>{person.hallOfFame.slice(0, honors).map(card => <span key={card.path} className="news-person-history"> · <Link href={card.path}>{card.label} ↗</Link></span>)}</span></span>;
}

/**
 * The one person a story features (featuredPerson in shared/news.ts: named in the headline, then
 * the dek, then first cited); roster members who are not in the story never get pulled in. Face, name, their team
 * in this contest and their top honor, so it reads as the subject, never as a byline.
 */
export function StoryFeature({ person, competition }: { person?: NewsPerson; competition: NewsCompetition }) {
  if (!person) return null;
  const team = [...person.memberships].reverse().find(member => member.competition === competition);
  return <Link href={personPath(person.id)} className="news-story-feature">
    <PersonPortrait person={person} size="card" decorative />
    <span><em>In this story</em><strong>{person.name}</strong>{team && <span>{team.teamName}</span>}{person.hallOfFame[0] && <span className="news-story-feature-honor">{person.hallOfFame[0].label}</span>}</span>
  </Link>;
}

/** What a face is doing in a story: the person's team in this contest, else their top honor. */
function faceCaption(person: NewsPerson, competition?: NewsCompetition) {
  const team = competition && [...person.memberships].reverse().find(member => member.competition === competition);
  return team ? team.teamName : person.hallOfFame[0]?.label;
}

/** The contenders a story is about, labeled as such and captioned with their team so they never read as a byline. */
export function StoryFaces({ people, max = 6, label = 'In this story', competition, showLabel = true }: { people: NewsPerson[]; max?: number; label?: string; competition?: NewsCompetition; showLabel?: boolean }) {
  if (!people.length) return null;
  return <div className="news-faces-block" role="group" aria-label={label}>
    {showLabel && <div className="news-faces-label">{label}</div>}
    <div className="news-faces">{people.slice(0, max).map(person => {
      const caption = faceCaption(person, competition);
      return <Link key={person.id} href={personPath(person.id)} className="news-face"><PersonPortrait person={person} size="face" decorative /><span><strong>{shortPersonName(person.name)}</strong>{caption && <em>{caption}</em>}</span></Link>;
    })}</div>
  </div>;
}

export function TeamPeople({ team, people = [] }: { team: CompetitorRecord; people?: NewsPerson[] }) {
  const known = peopleForTeam(people, team);
  return <div className="news-team-people"><ul>{team.members.map(handle => {
    const person = known.find(item => item.accounts.some(account => account.platform === 'kaggle' && account.handle === handle));
    return <li key={handle}>{person ? <PersonLinks person={person} /> : <a href={`https://www.kaggle.com/${encodeURIComponent(handle)}`}>{handle} ↗</a>}</li>;
  })}</ul><p className="news-muted">Roster observed {newsDate(team.lastObservedAt)}.</p></div>;
}

/** Faces of the verified people on a team, for notebook cards. */
export function TeamFaces({ team, people = [] }: { team: CompetitorRecord; people?: NewsPerson[] }) {
  return <StoryFaces people={peopleForTeam(people, team)} max={4} label={`People on ${team.name}`} competition={team.competition} showLabel={false} />;
}

export function PersonHonors({ person, linked = false }: { person: NewsPerson; linked?: boolean }) {
  if (!person.hallOfFame.length) return null;
  return <ul className="news-honors">{person.hallOfFame.map(card => <li key={card.path}>{linked ? <Link href={card.path}>{card.label}</Link> : card.label}</li>)}</ul>;
}

/** Directory card: face, name, honors, current teams and the first sourced fact. */
export function PersonCard({ person }: { person: NewsPerson }) {
  return <article className="news-person-card">
    <div className="news-person-card-top">
      <Link href={personPath(person.id)} tabIndex={-1} aria-hidden="true"><PersonPortrait person={person} size="card" decorative /></Link>
      <div>
        <h2><Link href={personPath(person.id)}>{person.name}</Link></h2>
        <PersonHonors person={person} />
      </div>
    </div>
    {!!person.memberships.length && <p className="news-card-members">{person.memberships.map(member => `${member.teamName} — ${competitionName(member.competition)} ${member.season}`).join(' · ')}</p>}
    {person.facts[0] && <p>{person.facts[0].text}</p>}
    <Link href={personPath(person.id)} className="news-read">Open the profile →</Link>
  </article>;
}

/** Where a face came from, printed under the profile portrait. */
export function PortraitCredit({ person }: { person: NewsPerson }) {
  const portrait = person.portrait;
  if (!portrait) return null;
  return <p className="news-muted">{portrait.kind === 'kaggle'
    ? <>Picture: <a href={portrait.sourceUrl}>Kaggle profile ↗</a></>
    : <>Picture: <Link href={portrait.sourceUrl.replace(/^https:\/\/arc\.markbarney\.net/, '')}>ARC Explainer Hall of Fame card →</Link></>}</p>;
}
