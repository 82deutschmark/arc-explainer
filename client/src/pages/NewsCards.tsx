/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6 / Codex (reasoning effort not exposed); GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Sonnet 5.5 (30-Oct-2026 rebuild); GPT-6 Astra Extra high
 * Date: 03-November-2026
 * PURPOSE: The ARC Daily Digest's Card Cabinet, rebuilt as a collector's binder and a price-guide checklist.
 *          The rendered cards ARE the page: a grid of real card faces (front and back) and a dense checklist
 *          of the same cards, filtered by Kaggle tier, role and contest. Each card page puts the card beside
 *          its data (Kaggle profile, standings, completed competitions) and links everything we already hold
 *          for the subject: their earlier Hall of Fame cards, team cards, profile, person page and the Digest
 *          stories that name them. Competitors, sponsors and teams; never "players".
 *          02-November-2026: selected card repairs show both original-design faces together,
 *          with existing career records and older cards below the pair.
 * SRP/DRY check: Pass — the collection API owns identity, art, standings and career; this page only filters,
 *          lays out and links. Wording helpers live in shared/newsCollection.ts so the server HTML, the share
 *          images and this page say the same thing.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SITE_ORIGIN } from '@shared/seo';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { uncardedCast } from '@shared/cardCast';
import { competitionName, personPath, competitorPath, type NewsIndex } from '@shared/news';
import {
  COLLECTION_SHARE_HEIGHT, COLLECTION_SHARE_WIDTH, KAGGLE_TIERS, collectionAsOfLabel, collectionCardDescription, collectionCardPath,
  collectionCardTitle, collectionEarnedLine, collectionLeadEntry, collectionRoleLabel, collectionShareAlt, collectionSharePath, collectionShareVersion, collectionStatus,
  type CollectionArchiveCard, type CollectionCard, type CollectionEntry, type KaggleTier, type NewsCollection,
} from '@shared/newsCollection';
import { NEWS_NAME, NEWS_BRAND } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsStatus, newsDate, useNews, useNewsCardImage } from '@/components/news/NewsDesk';
import { CabinetShell } from '@/components/news/CabinetShell';
import { CardPair } from '@/components/news/CardPair';
import { CATALOG_PAGE_SIZE, catalogCompetitions, catalogEntry, catalogSubjectLabel, catalogSet } from '@shared/cardCatalog';
import '@/components/news/cardCatalog.css';
import '@/components/news/cardRelationships.css';

type RoleFilter = 'all' | CollectionCard['role'];
type TierFilter = 'all' | KaggleTier;
type SortKey = 'name' | 'rank' | 'tier' | 'medals';
type View = 'binder' | 'sheet';

const tierRank = (card: CollectionCard) => card.career?.tier ? KAGGLE_TIERS.indexOf(card.career.tier) : -1;
const medalScore = (card: CollectionCard) => { const m = card.career?.medals; return m ? m.gold * 1000 + m.silver * 30 + m.bronze : -1; };
/** One class per rung of the ladder (plus sponsor and team) so a border, a badge and a chip always agree. */
const toneOf = (card: CollectionCard) => card.role === 'sponsor' ? 'sponsor' : card.role === 'team' ? 'team' : card.career?.tier?.toLowerCase() ?? 'none';
const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n.toLocaleString('en-US')}${suffix}`;
};
const rankText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : '—';
const fieldText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.fieldSize ? ` of ${entry.fieldSize.toLocaleString('en-US')}` : '';
const scoreText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.score != null ? String(entry.score) : '—';

/** External sources use the browser; the app's own pages use the router. */
function Go({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return /^https?:\/\//i.test(href) || /^\/(?:hall-of-fame|kaggle-leaderboard)/.test(href)
    ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>;
}

const faceSrc = (card: CollectionCard, side: 'front' | 'back', width: number, version: string) =>
  `/api/news/cards/${encodeURIComponent(card.id)}/thumb.webp?side=${side}&w=${width}&v=${version}`;

/** Tier or role badge. The Boss's rule: every tier gets its due, in Kaggle's own words. */
function TierBadge({ card, full = false }: { card: CollectionCard; full?: boolean }) {
  return <span className={`cb-badge tone-${toneOf(card)}`}>{full ? collectionRoleLabel(card) : collectionRoleLabel(card).replace(/^Kaggle /, '')}</span>;
}

/** The real card, front and back, with a flip. The back image loads only when it is asked for. */
function FlipFace({ card, width, priority = false, openHref }: { card: CollectionCard; width: number; priority?: boolean; openHref?: string }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [seenBack, setSeenBack] = useState(false);
  const version = useMemo(() => collectionShareVersion(card), [card]);
  const flip = () => { setSeenBack(true); setSide(side === 'front' ? 'back' : 'front'); };
  return <div className={`cb-face tone-${toneOf(card)}${side === 'back' ? ' is-back' : ''}`}>
    <div className="cb-face-inner">
      <img className="cb-front" src={faceSrc(card, 'front', width, version)} width={width} height={Math.round(width * 1.4)} alt={`${card.name}, ${collectionRoleLabel(card).toLowerCase()} card, front`} loading={priority ? 'eager' : 'lazy'} decoding="async" />
      {seenBack && <img className="cb-reverse" src={faceSrc(card, 'back', width, version)} width={width} height={Math.round(width * 1.4)} alt={`${card.name}, back: the career record`} decoding="async" />}
    </div>
    {openHref && <Link href={openHref} className="cb-open-card" aria-label={`Open ${card.name} ${catalogSubjectLabel(card).toLowerCase()}`} />}
    <button type="button" className="cb-flip" onClick={flip} aria-pressed={side === 'back'} aria-label={`Turn the ${card.name} card over to see the ${side === 'front' ? 'back' : 'front'}`}>{side === 'front' ? 'Back ↻' : 'Front ↻'}</button>
  </div>;
}

export function Tile({ card, index, contest = 'all' }: { card: CollectionCard; index: number; contest?: string }) {
  const lead = catalogEntry(card, contest);
  return <article className={`cb-tile tone-${toneOf(card)}`} id={`card-${card.id}`}>
    <FlipFace card={card} width={300} priority={index < 6} openHref={card.cardUrl} />
    <div className="cb-caption">
      <div className="cb-caption-top"><span className="cb-no">{catalogSubjectLabel(card)}</span><TierBadge card={card} /></div>
      <h2><Link href={card.cardUrl}>{card.name}</Link></h2>
      {lead && lead.status !== 'unavailable' ? <p className="cb-line"><span>{competitionName(lead.competition)}</span><span className="cb-num pl">{rankText(lead)}</span><span className="cb-num sc">{scoreText(lead)}</span></p> : <p className="cb-line cb-dim">{collectionEarnedLine(card) ?? ''}</p>}
    </div>
  </article>;
}

function MedalRow({ card }: { card: CollectionCard }) {
  const m = card.career?.medals;
  if (!m) return <span className="cb-dim">—</span>;
  return <span className="cb-medals" aria-label={`${m.gold} gold, ${m.silver} silver, ${m.bronze} bronze`}><b className="g">{m.gold}</b><b className="s">{m.silver}</b><b className="b">{m.bronze}</b></span>;
}

/** The price-guide view: every card on one dense line, sortable. */
function Sheet({ cards, sort, setSort, contest }: { cards: CollectionCard[]; sort: SortKey; setSort: (key: SortKey) => void; contest: string }) {
  const head = (key: SortKey, label: string) => <th scope="col"><button type="button" onClick={() => setSort(key)} disabled={key === 'rank' && contest === 'all'} aria-pressed={sort === key}>{label}{sort === key ? ' ▾' : ''}</button></th>;
  return <div className="cb-sheet-wrap"><table className="cb-sheet">
    <caption className="sr-only">Every card in the Cabinet, with role, tier, standing and medals</caption>
    <thead><tr><th scope="col">Card</th>{head('tier', 'Tier')}<th scope="col">Contest</th><th scope="col">Team</th>{head('rank', 'Rank')}<th scope="col">Score</th>{head('medals', 'G · S · B')}</tr></thead>
    <tbody>{cards.map(card => {
      const lead = catalogEntry(card, contest);
      const more = card.entries.filter(entry => contest === 'all' && entry !== lead && entry.status !== 'unavailable');
      return <tr key={card.id} className={`tone-${toneOf(card)}`}>
        <th scope="row"><Link href={card.cardUrl}>{card.name}</Link></th>
        <td><TierBadge card={card} /></td>
        <td>{lead ? competitionName(lead.competition) : '—'}{more.map(entry => <small key={entry.competitionId}>{competitionName(entry.competition)}</small>)}</td>
        <td>{lead?.teamName ?? '—'}{more.map(entry => <small key={entry.competitionId}>{entry.teamName}</small>)}</td>
        <td className="cb-num pl">{rankText(lead)}{more.map(entry => <small key={entry.competitionId}>{rankText(entry)}</small>)}</td>
        <td className="cb-num sc">{scoreText(lead)}{more.map(entry => <small key={entry.competitionId}>{scoreText(entry)}</small>)}</td>
        <td><MedalRow card={card} /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

const CATEGORY_LABEL: Record<string, string> = {
  competition_winner: 'Competition winner', paper_award: 'Paper award', top_paper_award: 'Top paper award', researcher: 'Researcher', pioneer: 'Pioneer',
  founder: 'Founders', arc3_preview: 'ARC-AGI-3 preview winner',
};

/** Last year's whole set, kept exactly as it was issued: the painted card where there is one, a plain tile where there is not. */
function ArchiveTile({ card }: { card: CollectionArchiveCard }) {
  const art = card.images[0];
  return <article className="cb-tile tone-none" id={`hof-${card.id}`}>
    <a className="cb-old" href={card.path}>{art ? <img src={encodeURI(art)} alt={`${card.name}, ${card.achievement ?? card.category}`} loading="lazy" /> : <span className="cb-oldtext"><b>{card.name}</b>{card.achievement}</span>}</a>
    <div className="cb-caption">
      <div className="cb-caption-top"><span className="cb-no">{card.year ?? ''}</span><span className="cb-badge tone-none">{CATEGORY_LABEL[card.category] ?? card.category}</span></div>
      <h2><a href={card.path}>{card.name}</a></h2>
      {card.achievement && <p className="cb-line cb-dim"><span>{card.achievement}</span></p>}
      <p className="cb-links"><a href={card.path}>In the Hall of Fame ↗</a>{card.cardUrls.map(link => <Link key={link.url} href={link.url}>{link.name}’s card →</Link>)}</p>
    </div>
  </article>;
}

function Archive({ archive }: { archive: NonNullable<NewsCollection['archive']> }) {
  return <>
    <p className="cb-sub cb-archive-note">{archive.series.title}, {archive.series.season}: the {archive.series.name} cards, kept exactly as they were issued. {archive.cards.length} preserved cards.</p>
    <div className="cb-grid cb-grid-old">{archive.cards.map(card => <ArchiveTile key={card.id} card={card} />)}</div>
  </>;
}

/** The index preserves sourced people and competition entries that have not been issued a card. */
export function UncardedCast({ index, cards, needle, role, contest, season, filtered }: { index: NewsIndex; cards: CollectionCard[]; needle: string; role: RoleFilter; contest: string; season: string; filtered: boolean }) {
  const uncarded = uncardedCast(index, cards);
  const matches = (values: string[]) => !needle || values.join(' ').toLocaleLowerCase().includes(needle);
  const people = uncarded.people.filter(person => !filtered && (role === 'all' || role === (person.role ?? 'competitor'))
    && (season === 'all' || person.memberships.some(member => member.season === season))
    && (contest === 'all' || person.memberships.some(member => member.competitionId === contest))
    && matches([person.name, ...person.accounts.map(account => account.handle), ...person.memberships.map(member => member.teamName)]));
  const teams = uncarded.teams.filter(team => !filtered && (role === 'all' || role === 'team')
    && (season === 'all' || KAGGLE_COMPETITIONS[team.competition]?.season === season)
    && (contest === 'all' || KAGGLE_COMPETITIONS[team.competition]?.slug === contest)
    && matches([team.name, team.teamId, ...team.aliases, ...team.members]));
  if (!people.length && !teams.length) return null;
  return <details className="cb-panel" open={!!needle}><summary>More people and teams without cards ({people.length + teams.length})</summary>
    <p>These sourced records do not have a card yet.</p><ul className="cb-list">
      {people.map(person => <li key={person.id}><Link href={personPath(person.id)}>{person.name} →</Link><small>{person.role === 'sponsor' ? 'Sponsor' : 'Person'}</small></li>)}
      {teams.map(team => <li key={team.id}><Link href={competitorPath(team.id)}>{team.name} →</Link><small>Team · {competitionName(team.competition)}</small></li>)}
    </ul></details>;
}

export function Cabinet({ collection }: { collection: NewsCollection }) {
  const news = useNews();
  const [role, setRole] = useState<RoleFilter>('all');
  const [tier, setTier] = useState<TierFilter>('all');
  const [contest, setContest] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [view, setView] = useState<View>('binder');
  const [set, setSet] = useState<'current' | 'archive'>('current');
  const [season, setSeason] = useState('all');
  const [edition, setEdition] = useState('all');
  const [pageChoice, setPageChoice] = useState({ key: '', page: 0 });
  const cards = collection.cards;
  const seasons = [...new Set(cards.map(card => card.season))].sort().reverse();
  const contests = useMemo(() => [...new Map(cards.flatMap(card => catalogCompetitions(card, collection.sets)).map(entry => [entry.id, entry.key] as const)).entries()]
    .map(([id, key]) => ({ id, label: competitionName(key) })), [cards, collection.sets]);
  const counts = useMemo(() => ({
    competitors: cards.filter(card => card.role === 'competitor').length, sponsors: cards.filter(card => card.role === 'sponsor').length, teams: cards.filter(card => card.role === 'team').length,
    tiers: [...KAGGLE_TIERS].reverse().map(name => ({ name, count: cards.filter(card => card.career?.tier === name).length })).filter(row => row.count),
  }), [cards]);
  const needle = search.trim().toLocaleLowerCase();
  const shown = useMemo(() => cards.filter(card => {
    if (edition !== 'all' && catalogSet(card, collection.sets)?.id !== edition) return false;
    if (season !== 'all' && card.season !== season) return false;
    if (role !== 'all' && card.role !== role) return false;
    if (tier !== 'all' && card.career?.tier !== tier) return false;
    if (contest !== 'all' && !catalogCompetitions(card, collection.sets).some(entry => entry.id === contest)) return false;
    if (!needle) return true;
    const words = [card.name, collectionRoleLabel(card), ...card.accounts.map(account => account.label),
      ...card.entries.flatMap(entry => [entry.teamName, ...entry.members.flatMap(member => [member.name, member.handle])]), ...card.teamHistory.map(team => team.teamName)];
    return words.join(' ').toLocaleLowerCase().includes(needle);
  }).sort((a, b) => {
    const byNumber = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });   // sorted by name: cards carry no invented numbers
    if (sort === 'rank' && contest !== 'all') {
      const rank = (card: CollectionCard) => catalogEntry(card, contest)?.rank ?? Infinity;
      return rank(a) - rank(b) || byNumber;
    }
    if (sort === 'tier') return tierRank(b) - tierRank(a) || medalScore(b) - medalScore(a) || byNumber;
    if (sort === 'medals') return medalScore(b) - medalScore(a) || byNumber;
    return byNumber;
  }), [cards, role, tier, contest, needle, sort, season, edition, collection.sets]);
  const filterKey = JSON.stringify([role, tier, contest, needle, sort, season, edition, view]);
  const pages = Math.max(1, Math.ceil(shown.length / CATALOG_PAGE_SIZE));
  const page = pageChoice.key === filterKey ? Math.min(pageChoice.page, pages - 1) : 0;
  const visible = shown.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);
  const pagination = pages > 1 && <nav className="cb-pagination" aria-label="Card pages"><button type="button" disabled={page === 0} onClick={() => setPageChoice({key: filterKey, page: page - 1})}>← Previous</button><span>Page {page + 1} of {pages}</span><button type="button" disabled={page + 1 === pages} onClick={() => setPageChoice({key: filterKey, page: page + 1})}>Next →</button></nav>;
  const chip = <T extends string>(current: T, set: (value: T) => void, value: T, label: string, count?: number) =>
    <button key={value} type="button" aria-pressed={current === value} onClick={() => set(value)}>{label}{count != null ? <i>{count}</i> : null}</button>;
  return <main className="cb">
    <header className="cb-head">
      <h1>Kaggle card catalog</h1>
      <p className="cb-sub">Individual competitors, teams and sponsors across Kaggle competitions. Each card keeps its own permanent link and season; open it for the full record.</p>
      <ul className="cb-ticker" aria-label="The set">
        <li><b>{cards.length}</b> cards</li><li><b>{counts.competitors}</b> individual cards</li><li><b>{counts.sponsors}</b> sponsor cards</li><li><b>{counts.teams}</b> team cards</li>
        {counts.tiers.map(row => <li key={row.name} className={`tone-${row.name.toLowerCase()}`}><b>{row.count}</b> {row.name}{row.count === 1 ? '' : 's'}</li>)}
      </ul>
      {collection.archive && <div className="cb-chips cb-sets" role="group" aria-label="Set">
        {chip(set, setSet, 'current', `${collection.season} set`, cards.length)}{chip(set, setSet, 'archive', `${collection.archive.series.season} · ${collection.archive.series.title}`, collection.archive.cards.length)}
      </div>}
    </header>
    {set === 'archive' && collection.archive ? <Archive archive={collection.archive} /> : <>
    <form className="cb-controls" onSubmit={event => event.preventDefault()} aria-label="Find cards">
      <label className="cb-search"><span className="sr-only">Find a card</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a name, team or Kaggle handle" /></label>
      <div className="cb-chips" role="group" aria-label="Who">{chip(role, setRole, 'all', 'All')}{chip(role, setRole, 'competitor', 'People', counts.competitors)}{chip(role, setRole, 'sponsor', 'Sponsors', counts.sponsors)}{chip(role, setRole, 'team', 'Teams', counts.teams)}</div>
      <div className="cb-chips" role="group" aria-label="Individual Kaggle tier">{chip(tier, setTier, 'all', 'Any tier')}{[...KAGGLE_TIERS].reverse().map(name => counts.tiers.some(row => row.name === name) && chip(tier, setTier, name as TierFilter, name))}</div>
      {contests.length > 1 && <div className="cb-chips" role="group" aria-label="Competition">{chip(contest, (value: string) => { setContest(value); if (sort === 'rank') setSort('name'); }, 'all', 'Any contest')}{contests.map(row => chip(contest, setContest, row.id, row.label))}</div>}
      <label className="cb-sort"><span>Card set</span><select value={edition} onChange={event => setEdition(event.target.value)}><option value="all">All sets</option>{collection.sets?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="cb-sort"><span>Season</span><select value={season} onChange={event => setSeason(event.target.value)}><option value="all">All seasons</option>{seasons.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="cb-sort"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value as SortKey)}><option value="name">Name</option><option value="rank" disabled={contest === 'all'}>Place in selected contest</option><option value="tier">Kaggle tier</option><option value="medals">Medals</option></select></label>
      <div className="cb-chips cb-view" role="group" aria-label="View">{chip(view, setView, 'binder', 'Binder')}{chip(view, setView, 'sheet', 'Checklist')}</div>
      <p className="cb-shown" role="status" aria-live="polite">{shown.length} card matches · {shown.length ? page * CATALOG_PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * CATALOG_PAGE_SIZE, shown.length)} shown</p>
    </form>
    {pagination}
    {view === 'binder' ? <div className="cb-grid">{visible.map((card, index) => <Tile key={card.id} card={card} index={index} contest={contest} />)}</div> : <Sheet cards={visible} sort={sort} setSort={setSort} contest={contest} />}
    {pagination}
    {news.data && <UncardedCast index={news.data} cards={cards} needle={needle} role={role} contest={contest} season={season} filtered={tier !== 'all' || edition !== 'all'} />}
    {news.isError && !news.data && <p className="cb-note">People and teams without cards could not be loaded. <button type="button" onClick={() => void news.refetch()}>Try again</button></p>}
    {!shown.length && <div className="cb-empty"><h2>No cards match.</h2><button type="button" onClick={() => { setSearch(''); setRole('all'); setTier('all'); setContest('all'); setSeason('all'); setEdition('all'); }}>Show every card →</button></div>}
    </>}
    <footer className="cb-colophon"><p>Collection commissioned by {collection.commissionedBy} and updated {newsDate(collection.updatedAt)}. Every card has its own link and share image. Individual cards follow competitors across contests; team cards represent a specific competition entry. Current standings come from dated Kaggle readings when available.</p></footer>
  </main>;
}

function Panel({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return <section className={`cb-panel${wide ? ' is-wide' : ''}`}><h2>{title}</h2>{children}</section>;
}

export function CopyCardLink({ card }: { card: CollectionCard }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'select'>('idle');
  const url = `${SITE_ORIGIN}${card.cardUrl}`;
  async function copy() {
    setState('copying');
    try { await navigator.clipboard.writeText(url); setState('copied'); } catch { setState('select'); }
  }
  return <span className="cb-copy">
    <button type="button" onClick={() => void copy()} disabled={state === 'copying'} aria-label={`Copy ${card.name} card link`}>{state === 'copying' ? 'Copying…' : 'Copy card link'}</button>
    <span role="status" aria-live="polite">{state === 'copied' ? 'Link copied' : state === 'select' ? 'Select and copy this link:' : ''}</span>
    {state === 'select' && <input aria-label={`${card.name} card link`} readOnly value={url} onFocus={event => event.currentTarget.select()} />}
  </span>;
}

type ShelfItem = { key: string; kind: 'current' | 'past' | 'team' | 'edition'; label: string; sub: string; src: string; alt: string; href?: string };

/**
 * Every card we hold for this subject, laid out like a collection: this season's card, the earlier cards
 * (ARC Hall of Fame), and the Cabinet cards of the teams they play on. Choosing one puts it on the stage.
 */
function Shelf({ items, stage, setStage }: { items: ShelfItem[]; stage: string; setStage: (key: string) => void }) {
  return <section className="cb-shelf" aria-label="All their cards">
    <h2>Their cards <i>{items.length}</i></h2>
    <ul>{items.map(item => <li key={item.key} className={`${item.kind}${stage === item.key ? ' is-staged' : ''}`}>
      {item.kind === 'team' || item.kind === 'edition'
        ? <Link href={item.href!}><img src={item.src} alt={item.alt} loading="lazy" /></Link>
        : <button type="button" onClick={() => setStage(item.key)} aria-pressed={stage === item.key} aria-label={`Show the ${item.label} card`}><img src={item.src} alt={item.alt} loading="lazy" /></button>}
      <span><b>{item.label}</b>{item.sub}{item.kind === 'past' && item.href && <a href={item.href}>In the Hall of Fame ↗</a>}{item.kind === 'team' && <a href={item.href}>Open the team card →</a>}{item.kind === 'edition' && <Link href={item.href!}>Open this edition →</Link>}</span>
    </li>)}</ul>
  </section>;
}

export function Detail({ card, all, sets = [] }: { card: CollectionCard; all: CollectionCard[]; sets?: NewsCollection['sets'] }) {
  const [stage, setStage] = useState('current');
  const version = useMemo(() => collectionShareVersion(card), [card]);
  const career = card.career;
  const asOf = collectionAsOfLabel(card);
  const status = collectionStatus(card);
  const earned = collectionEarnedLine(card);
  const careerRows = career ? [...career.rows].sort((a, b) => a.rank / a.fieldSize - b.rank / b.fieldSize) : [];
  const entries = card.entries.filter(entry => entry.status !== 'unavailable');
  // Include independently recorded memberships as well as the roster on this edition.
  // These are observations at different dates, not a claim that everyone competed together.
  const roster = [...new Map([
    ...all.filter(other => other.kind === 'person' && other.personId && other.teamHistory.some(team =>
      team.season === card.season && card.entries.some(entry => entry.competitionId === team.competitionId && entry.teamId === team.teamId)))
      .map(other => ({ personId: other.personId, handle: other.teamHistory.find(team => team.season === card.season && card.entries.some(entry => entry.competitionId === team.competitionId && entry.teamId === team.teamId))!.memberHandle, name: other.name, cardUrl: other.cardUrl })),
    ...card.entries.flatMap(entry => entry.members),
  ].map(member => [member.personId ?? member.handle, member])).values()];
  const medals = career?.medals;
  // Every card we hold for them: this season's, the Hall of Fame cards, and the Cabinet cards of their teams.
  const shelf: ShelfItem[] = [
    { key: 'current', kind: 'current', label: catalogSet(card, sets)?.name ?? card.season, sub: `${NEWS_BRAND.goose ? 'The Loose Goose' : 'ARC Prize'}`, src: faceSrc(card, 'front', 260, version), alt: `${card.name}, ${card.season} card` },
    ...all.filter(other => card.kind === 'person' && other.kind === 'person' && other.personId === card.personId && other.id !== card.id)
      .map(other => ({ key: other.id, kind: 'edition' as const, label: catalogSet(other, sets)?.name ?? other.season, sub: 'Edition', src: faceSrc(other, 'front', 260, collectionShareVersion(other)), alt: `${other.name}, card`, href: other.cardUrl })),
    ...card.pastCards.filter(past => past.imageSrc).map((past, index) => ({ key: `past-${index}`, kind: 'past' as const, label: past.season ?? 'Earlier', sub: past.label, src: encodeURI(past.imageSrc!), alt: past.imageAlt, href: past.hallOfFameUrl })),
    ...(card.kind === 'person' ? [...new Map(card.teamHistory.filter(team => team.cardUrl).map(team => [team.cardUrl!, team])).values()].flatMap(team => {
      const teamCard = all.find(item => item.cardUrl === team.cardUrl);
      return teamCard ? [{ key: teamCard.id, kind: 'team' as const, label: teamCard.name, sub: 'Team', src: faceSrc(teamCard, 'front', 260, collectionShareVersion(teamCard)), alt: `${teamCard.name}, team card`, href: teamCard.cardUrl }] : [];
    }) : []),
  ];
  const staged = card.pastCards.filter(past => past.imageSrc)[Number(stage.replace('past-', ''))];
  return <main className="cb cb-detail">
    <nav className="cb-crumb" aria-label="Breadcrumb"><Link href="/news/cards">← All cards</Link></nav>
    <header className={`cb-dhead tone-${toneOf(card)}`}><h1>{card.name}</h1><TierBadge card={card} full /><span className="cb-sub">{card.season}{career?.organisation ? ` · ${career.organisation}` : ''}{earned ? ` · Earned this card: ${earned}` : ''}</span></header>
    <div className="cb-dgrid is-paired">
      <div className="cb-dcard">
        {stage === 'current' || !staged ? <CardPair card={card} /> : <figure className="cb-stage"><img src={encodeURI(staged.imageSrc!)} alt={staged.imageAlt} /><figcaption>{staged.season ?? 'Earlier'} · {staged.label} · <a href={staged.hallOfFameUrl}>In the Hall of Fame ↗</a></figcaption></figure>}
        <div className="cb-actions"><CopyCardLink card={card} /><a href={`/api/news/cards/${encodeURIComponent(card.id)}/image.png`} download>Front PNG ↓</a><a href={`/api/news/cards/${encodeURIComponent(card.id)}/image.png?side=back`} download>Back PNG ↓</a></div>
      </div>
      <div className="cb-data">
        {shelf.length > 1 && <Shelf items={shelf} stage={stage} setStage={setStage} />}
        {card.role === 'competitor' && career && (career.tier || medals || career.rank?.current || career.joinedYear || career.organisation) && <Panel title="Kaggle profile">
          <dl className="cb-vitals">
            {career.tier && <div><dt>Competitions tier</dt><dd>{career.tier}</dd></div>}
            {medals && <div><dt>Medals</dt><dd><span className="cb-medals"><b className="g">{medals.gold} gold</b><b className="s">{medals.silver} silver</b><b className="b">{medals.bronze} bronze</b></span></dd></div>}
            {career.rank?.current && <div><dt>Overall rank</dt><dd className="cb-num">#{career.rank.current.toLocaleString('en-US')}{career.rank.outOf ? ` of ${career.rank.outOf.toLocaleString('en-US')}` : ''}</dd></div>}
            {career.rank?.best && <div><dt>Best rank</dt><dd className="cb-num">#{career.rank.best.toLocaleString('en-US')}</dd></div>}
            {career.joinedYear && <div><dt>On Kaggle since</dt><dd>{career.joinedYear}</dd></div>}
            {career.organisation && <div><dt>Organisation</dt><dd>{career.organisation}</dd></div>}
          </dl>
          <p className="cb-note"><a href={career.profileUrl}>Kaggle profile ↗</a></p>
        </Panel>}
        {card.entries.some(entry => entry.status === 'unavailable') && <p className="cb-note">{card.entries.filter(entry => entry.status === 'unavailable').map(entry => <a key={`${entry.competitionId}-${entry.teamId}`} href={entry.sourceUrl ?? entry.profileUrl}>{competitionName(entry.competition)}: current standings at Kaggle ↗ </a>)}</p>}
        {!!entries.length && <Panel title={card.role === 'team' ? 'Team standings' : 'Standings'}>
          <table className="cb-table"><thead><tr><th scope="col">Competition</th><th scope="col">Team</th><th scope="col">Rank</th><th scope="col">Best</th><th scope="col">Score</th><th scope="col">Entries</th></tr></thead>
            <tbody>{entries.map(entry => <tr key={`${entry.competitionId}-${entry.teamId}`}><td>{competitionName(entry.competition)}{entry.zone && <small className={`cb-zone ${entry.zone}`}>{entry.zone} zone</small>}</td>
              <td><Go href={entry.cardUrl ?? entry.profileUrl}>{entry.teamName} →</Go></td><td className="cb-num pl">{rankText(entry)}<small>{fieldText(entry).trim()}</small></td><td className="cb-num pl">{entry.peakRank ? `#${entry.peakRank}` : ''}</td><td className="cb-num sc">{scoreText(entry)}</td><td className="cb-num">{entry.submissions?.toLocaleString('en-US') ?? ''}</td></tr>)}</tbody></table>
          <p className="cb-note">{status === 'final' ? 'Final results' : 'Live'}{asOf ? `, as of ${asOf}` : ''}. {entries.some(entry => entry.sourceUrl) && <a href={entries.find(entry => entry.sourceUrl)!.sourceUrl}>Leaderboard ↗</a>}</p>
        </Panel>}
        {card.role === 'competitor' && !!careerRows.length && <Panel title="Completed Kaggle competitions" wide>
          <table className="cb-table"><thead><tr><th scope="col">Year</th><th scope="col">Competition</th><th scope="col">Team</th><th scope="col">Finish</th><th scope="col">Medal</th></tr></thead>
            <tbody>{careerRows.slice(0, 14).map(row => <tr key={row.competitionUrl}><td className="cb-num">{row.year ?? ''}</td><td><a href={row.competitionUrl}>{row.competition} ↗</a></td><td>{row.team ?? ''}</td>
              <td className="cb-num"><span className="pl">#{row.rank.toLocaleString('en-US')}</span> of {row.fieldSize.toLocaleString('en-US')}</td><td>{row.medal ? <span className={`cb-medal ${row.medal}`}>{row.medal}</span> : ''}</td></tr>)}</tbody></table>
          <p className="cb-note">Best finishes first. {careerRows.length > 14 ? `${careerRows.length - 14} more on ` : 'Full list on '}<a href={`${career!.profileUrl}/competitions`}>Kaggle ↗</a></p>
        </Panel>}
        {!!card.highlights.length && <Panel title="On the record">
          <ul className="cb-list">{card.highlights.map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}>{fact.text} <a href={fact.sourceUrl}>Source ↗</a><small>As of {newsDate(fact.checkedAt)}</small></li>)}</ul>
        </Panel>}
        {!!card.stories.length && <Panel title="In the paper">
          <ul className="cb-list">{card.stories.map(story => <li key={story.id}><Link href={story.url}>{story.headline}</Link><small>{story.kind === 'wire' ? 'The wire' : 'Edition'} · {newsDate(story.publishedAt)}</small></li>)}</ul>
        </Panel>}
    {card.kind === 'team' && roster.length > 0 && <nav className="cb-relations" aria-label="Team members">
      <h2>Team members</h2><ul>{roster.map(member => <li key={member.handle}>
        <Go href={member.cardUrl ?? (member.personId ? personPath(member.personId) : `https://www.kaggle.com/${encodeURIComponent(member.handle)}`)}>{member.name || member.handle} →</Go>
        <small>@{member.handle}</small>
      </li>)}</ul><p>Recorded competition memberships may be from different dates. Open a name for their individual card or profile.</p>
    </nav>}
    {card.kind === 'person' && card.teamHistory.length > 0 && <nav className="cb-relations" aria-label="Competition teams">
      <h2>Competition teams</h2><ul>{card.teamHistory.map(team => <li key={`${team.season}-${team.competitionId}-${team.teamId}`}>
        <Go href={team.cardUrl ?? team.profileUrl}>{team.teamName} →</Go><small>{competitionName(team.competition)} · {team.season}{team.status === 'previous' ? ' · earlier team' : ''}</small>
      </li>)}</ul>
    </nav>}
        <Panel title="Everything else">
          <ul className="cb-list">
            <li><Go href={card.profileUrl}>{card.kind === 'person' ? 'More about this person →' : 'The team profile →'}</Go></li>
            {card.accounts.slice(0, 6).map(account => <li key={account.url}><a href={account.url}>{account.label} ↗</a></li>)}
            <li><a href="/hall-of-fame">The ARC Hall of Fame ↗</a></li>
          </ul>
          {card.art && <p className="cb-note">Illustration: {card.art.credit}.</p>}
        </Panel>
      </div>
    </div>
  </main>;
}

export default function NewsCards() {
  const { cardId } = useParams<{ cardId?: string }>();
  const query = useQuery<NewsCollection>({
    queryKey: ['/api/news/cards'], staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch('/api/news/cards');
      if (!response.ok) throw new Error('The cards could not be loaded.');
      return response.json() as Promise<NewsCollection>;
    },
  });
  const selected = query.data?.cards.find(card => card.id === cardId);
  const sectionImage = useNewsCardImage();
  usePageMeta({
    title: selected ? collectionCardTitle(selected) : cardId && query.data ? `Card not found | ${NEWS_NAME}` : `Kaggle card catalog | ${NEWS_NAME}`,
    description: selected ? collectionCardDescription(selected) : `${NEWS_NAME} cards: illustrated competitors and teams, linked history and original Kaggle sources for current standings.`,
    canonicalPath: cardId ? collectionCardPath(cardId) : '/news/cards',
    noindex: !!cardId && !!query.data && !selected,
    image: selected ? { image: `${SITE_ORIGIN}${collectionSharePath(selected)}`, imageAlt: collectionShareAlt(selected), imageWidth: COLLECTION_SHARE_WIDTH, imageHeight: COLLECTION_SHARE_HEIGHT } : sectionImage,
  });
  return <CabinetShell cardProof={!!selected}>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && (cardId
      ? selected ? <Detail card={selected} all={query.data.cards} sets={query.data.sets} /> : <main className="cb"><div className="cb-empty"><h1>Card not found</h1><p>This card isn’t in the collection.</p><Link href="/news/cards">Browse the card catalog →</Link></div></main>
      : <Cabinet collection={query.data} />)}
  </CabinetShell>;
}
