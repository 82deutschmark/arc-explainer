/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5
 * Date: 02-November-2026; 02-Nov-2026 (Claude Opus 5.5 High: compact, small-label story cards); 14-Nov-2026; 27-Nov-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): "In this story" draws the cards the shared storyCast() rule picks (the subject's
 *          cards newest first, then everyone on the board or named in the text with a card for the contest), the lead card
 *          large and the rest in a grid with name and set lines; the hand-typed card list no longer limits the row.
 * 25-Nov-2026 (GPT-6 / Codex): render the exact front and back faces selected for a dispatch.
 * 14-Nov-2026 (Claude Opus 5.5): story strips and team rosters read the shared useNewsCollection() query and show each
 *          person's card for that contest (their ARC-3 set card on ARC-3 pages) through cardForPerson().
 * 14-Nov-2026 (Claude Opus 5.5, front): "In this story" holds each card's place while the card list loads,
 *          as TeamRosterCards does, instead of flashing portrait tiles that then jump to cards.
 * 14-Nov-2026 (Claude Opus 5.5, profiles-articles): removed PersonCard, used only by the retired /news/people directory.
 * PURPOSE: Reusable person pieces for competition reporting: faces (Hall of Fame crop or saved
 *          Kaggle picture, initials when a person has neither), roster chips, the "in this story"
 *          subject cards for every reported person and honors that link to the person's Hall of Fame cards.
 *          Used by the people pages, team rosters, editions, dispatches and the community desk.
 * SRP/DRY check: Pass — exact verified account matches reuse the shared identity ledger; every
 *          view draws a person through PersonPortrait so a face looks the same everywhere.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { cardForPerson, collectionRoleLabel, collectionShareVersion } from '@shared/newsCollection';
import { storyCast, type StoryCastSource } from '@shared/storyCast';
import { useNewsCollection } from '@/hooks/useNewsCollection';
import { displayPortrait, personPath, peopleForTeam, newsDate, personInitials, shortPersonName, type CompetitorRecord, type NewsCompetition, type NewsPerson } from '@shared/news';

type PortraitSize = 'chip' | 'face' | 'card' | 'hero';

/** A person's face. Decorative when their name is printed right beside it. */
export function PersonPortrait({ person, size, decorative = false }: { person: NewsPerson; size: PortraitSize; decorative?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const portrait = [displayPortrait(person), person.portrait].find(item => item && !failed.includes(item.src));
  const className = `news-portrait news-portrait-${size}`;
  if (!portrait) return <span className={`${className} news-portrait-initials`} aria-hidden="true">{personInitials(person.name)}</span>;
  return <img className={className} src={portrait.src} alt={decorative ? '' : portrait.alt} loading="lazy" decoding="async" onError={() => setFailed(previous => [...previous, portrait.src])} />;
}

/** Name with face and the person's top honor, for rosters and source lines. */
export function PersonLinks({ person, honors = 1 }: { person: NewsPerson; honors?: number }) {
  return <span className="news-person-chip"><PersonPortrait person={person} size="chip" decorative /><span><Link href={personPath(person.id)}>{person.name} →</Link>{person.hallOfFame.slice(0, honors).map(card => <span key={card.path} className="news-person-history"> · <Link href={card.path}>{card.label} ↗</Link></span>)}</span></span>;
}

/** Columns that put the cards after the lead in two rows beside it, so a short cast is one compact block. */
export const castColumns = (tiles: number) => 2 + Math.max(1, Math.ceil((tiles - 1) / 2));

/**
 * "In this story": the cards storyCast() chooses for the story (shared with the server HTML, so both show the same
 * cards in the same order). The lead card is drawn large, the rest in a tidy grid, each with the person's name and the
 * set or contest under it; anyone past the card budget is a linked name. A listed person with no card yet keeps the
 * compact portrait tile.
 */
export function StoryPeopleCards({ stories, people }: { stories: StoryCastSource[]; people: NewsPerson[] }) {
  const cabinet = useNewsCollection();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a call site always passes the same number of stories
  const cast = useMemo(() => cabinet.data ? storyCast(cabinet.data, stories) : null, [cabinet.data, ...stories]);
  // While the card list loads, hold the lead's and a row's place so the block does not jump from nothing to cards.
  if (cabinet.isLoading) return <section className="news-story-people" aria-label="In this story" aria-busy="true">
    <h2 className="news-story-people-label">In this story</h2>
    <div className="news-story-cards">{(people.length ? people : [{ id: 'lead', name: '' }]).slice(0, 6).map((person, position) =>
      <span key={person.id} className={`news-story-card${position === 0 ? ' news-story-card-lead' : ''}`} aria-hidden="true"><span className="news-story-card-skeleton" /><span className="news-story-card-name">{person.name}</span></span>)}</div>
  </section>;
  const tiles = cast?.tiles ?? [], more = cast?.more ?? [];
  const shown = new Set([...tiles.map(tile => tile.personId), ...more.map(item => item.key.replace(/^person:/, ''))]);
  const without = people.filter(person => !shown.has(person.id));
  if (!tiles.length && !more.length && !without.length) return null;
  return <section className="news-story-people" aria-label="In this story">
    <h2 className="news-story-people-label">In this story</h2>
    {!!tiles.length && <div className="news-story-cards" style={{ '--cast-columns': castColumns(tiles.length) } as React.CSSProperties}>{tiles.map(tile => {
      const face = <><img src={tile.src} width={tile.width} height={tile.height} loading={tile.lead ? 'eager' : 'lazy'} decoding="async" alt={tile.alt} />
        <span className="news-story-card-name">{tile.name}</span><span className="news-story-card-set">{tile.set}</span></>;
      const className = `news-story-card${tile.lead ? ' news-story-card-lead' : ''}`;
      // Card pages stay inside the app; a back-face image or a Hall of Fame page is an ordinary link.
      return tile.kind === 'card' && tile.side === 'front'
        ? <Link key={tile.key} href={tile.href} className={className} data-card={tile.cardId}>{face}</Link>
        : <a key={tile.key} href={tile.href} className={className} data-card={tile.cardId ?? tile.kind}>{face}</a>;
    })}</div>}
    {!!more.length && <p className="news-story-more"><span>Also in this story</span> {more.map((item, position) => <span key={item.key}>{position ? ' · ' : ''}<Link href={item.href}>{item.name}</Link></span>)}</p>}
    {!!without.length && <div className="news-story-people-grid">{without.map(person => {
      const team = [...person.memberships].reverse().find(member => member.competition === stories[0]?.competition);
      return <Link key={person.id} href={personPath(person.id)} className="news-subject-card">
        <PersonPortrait person={person} size="card" decorative />
        <span className="news-subject-details"><strong>{person.name}</strong>{team && <span>{team.teamName}</span>}{person.hallOfFame[0] && <span className="news-subject-honor">{person.hallOfFame[0].label}</span>}</span>
      </Link>;
    })}</div>}
  </section>;
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

/**
 * A team's roster as a spread of real cards (the hero of a team profile): each verified person's card front, large, with the
 * name beneath and a link to the card page. A person with no card yet gets their portrait tile; an unmatched Kaggle handle
 * gets a plain profile link. Reads the same cabinet query as StoryPeopleCards.
 */
export function TeamRosterCards({ team, people = [] }: { team: CompetitorRecord; people?: NewsPerson[] }) {
  const cabinet = useNewsCollection();
  const known = peopleForTeam(people, team);
  return <ul className="cp-roster" aria-label={`${team.name} roster`}>{team.members.map(handle => {
    const person = known.find(item => item.accounts.some(account => account.platform === 'kaggle' && account.handle === handle));
    const card = person && cabinet.data && cardForPerson(cabinet.data.cards, person.id, team.competition, cabinet.data.sets);
    // while the card list loads, hold the card's place so the page does not jump or flash a plain tile
    if (person && cabinet.isLoading) return <li key={handle}><span className="cp-card" aria-hidden="true"><span className="cp-skeleton" /><span className="cp-card-name">{person.name}</span></span></li>;
    if (card && person) return <li key={handle}><Link href={card.cardUrl} className="cp-card">
      <img src={`/api/news/cards/${encodeURIComponent(card.id)}/thumb.webp?side=front&w=420&v=${collectionShareVersion(card)}`} width={420} height={588} loading="lazy" alt={`${person.name}, ${collectionRoleLabel(card).toLowerCase()} card, front`} />
      <span className="cp-card-name">{person.name}</span></Link></li>;
    return <li key={handle}>{person
      ? <Link href={personPath(person.id)} className="cp-card cp-card-plain"><PersonPortrait person={person} size="card" decorative /><span className="cp-card-name">{person.name}</span></Link>
      : <a href={`https://www.kaggle.com/${encodeURIComponent(handle)}`} className="cp-card cp-card-plain"><span className="cp-card-name">{handle} ↗</span></a>}</li>;
  })}</ul>;
}

/** Faces of the verified people on a team, for notebook cards. */
export function TeamFaces({ team, people = [] }: { team: CompetitorRecord; people?: NewsPerson[] }) {
  return <StoryFaces people={peopleForTeam(people, team)} max={4} label={`People on ${team.name}`} competition={team.competition} showLabel={false} />;
}

export function PersonHonors({ person, linked = false }: { person: NewsPerson; linked?: boolean }) {
  if (!person.hallOfFame.length) return null;
  return <ul className="news-honors">{person.hallOfFame.map(card => <li key={card.path}>{linked ? <Link href={card.path}>{card.label}</Link> : card.label}</li>)}</ul>;
}

/** Where a face came from, printed under the profile portrait. */
export function PortraitCredit({ person }: { person: NewsPerson }) {
  if (person.editorialPortrait) return <p className="news-muted">AI editorial portrait based on <a href={person.editorialPortrait.sourceUrl}>{person.editorialPortrait.sourceTitle} ↗</a>.</p>;
  const portrait = person.portrait;
  if (!portrait) return null;
  return <p className="news-muted">{portrait.kind === 'kaggle'
    ? <>Picture: <a href={portrait.sourceUrl}>Kaggle profile ↗</a></>
    : <>Picture: <Link href={portrait.sourceUrl.replace(/^https:\/\/arc\.markbarney\.net/, '')}>ARC Explainer Hall of Fame card →</Link></>}</p>;
}
