/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Sonnet 5.5 (30-Oct-2026 rebuild)
 * Date: 2026-10-30
 * PURPOSE: The ARC Daily Digest's Card Cabinet, rebuilt as a collector's binder and a price-guide checklist.
 *          The rendered cards ARE the page: a grid of real card faces (front and back) and a dense checklist
 *          of the same cards, filtered by Kaggle tier, role and contest. Each card page puts the card beside
 *          its data (Kaggle profile, standings, completed competitions) and links everything we already hold
 *          for the subject: their earlier Hall of Fame cards, team cards, notebook, person page and the Digest
 *          stories that name them. Competitors, sponsors and teams; never "players".
 * SRP/DRY check: Pass — the collection API owns identity, art, standings and career; this page only filters,
 *          lays out and links. Wording helpers live in shared/newsCollection.ts so the server HTML, the share
 *          images and this page say the same thing.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SITE_ORIGIN } from '@shared/seo';
import { competitionName, personPath } from '@shared/news';
import {
  COLLECTION_SHARE_HEIGHT, COLLECTION_SHARE_WIDTH, KAGGLE_TIERS, collectionAsOfLabel, collectionCardDescription, collectionCardPath,
  collectionCardTitle, collectionEarnedLine, collectionLeadEntry, collectionRoleLabel, collectionShareAlt, collectionSharePath, collectionShareVersion, collectionStatus,
  type CollectionArchiveCard, type CollectionCard, type CollectionEntry, type KaggleTier, type NewsCollection,
} from '@shared/newsCollection';
import { NEWS_NAME } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsStatus, newsDate, useNewsCardImage } from '@/components/news/NewsDesk';
import { CabinetShell } from '@/components/news/CabinetShell';

type RoleFilter = 'all' | CollectionCard['role'];
type TierFilter = 'all' | KaggleTier;
type SortKey = 'number' | 'rank' | 'tier' | 'medals';
type View = 'binder' | 'sheet';

const tierRank = (card: CollectionCard) => card.career?.tier ? KAGGLE_TIERS.indexOf(card.career.tier) : -1;
const medalScore = (card: CollectionCard) => { const m = card.career?.medals; return m ? m.gold * 1000 + m.silver * 30 + m.bronze : -1; };
const bestRank = (card: CollectionCard) => { const e = collectionLeadEntry(card); return e?.status !== 'unavailable' && e?.rank != null ? e.rank : Infinity; };
/** One class per rung of the ladder (plus sponsor and team) so a border, a badge and a chip always agree. */
const toneOf = (card: CollectionCard) => card.role === 'sponsor' ? 'sponsor' : card.role === 'team' ? 'team' : card.career?.tier?.toLowerCase() ?? 'none';
const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n.toLocaleString('en-US')}${suffix}`;
};
const rankText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : '—';
const fieldText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.fieldSize ? ` of ${entry.fieldSize.toLocaleString('en-US')}` : '';
const scoreText = (entry: CollectionEntry | undefined) => entry && entry.status !== 'unavailable' && entry.score != null ? entry.score.toFixed(2) : '—';

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
function FlipFace({ card, width, priority = false }: { card: CollectionCard; width: number; priority?: boolean }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [seenBack, setSeenBack] = useState(false);
  const version = useMemo(() => collectionShareVersion(card), [card]);
  const flip = () => { setSeenBack(true); setSide(side === 'front' ? 'back' : 'front'); };
  return <div className={`cb-face tone-${toneOf(card)}${side === 'back' ? ' is-back' : ''}`}>
    <div className="cb-face-inner">
      <img className="cb-front" src={faceSrc(card, 'front', width, version)} width={width} height={Math.round(width * 1.4)} alt={`${card.name}, ${collectionRoleLabel(card).toLowerCase()} card ${card.number}, front`} loading={priority ? 'eager' : 'lazy'} decoding="async" />
      {seenBack && <img className="cb-reverse" src={faceSrc(card, 'back', width, version)} width={width} height={Math.round(width * 1.4)} alt={`${card.name}, card ${card.number}, back: the career record`} decoding="async" />}
    </div>
    <button type="button" className="cb-flip" onClick={flip} aria-pressed={side === 'back'} aria-label={`Turn the ${card.name} card over to see the ${side === 'front' ? 'back' : 'front'}`}>{side === 'front' ? 'Back ↻' : 'Front ↻'}</button>
  </div>;
}

export function Tile({ card, index }: { card: CollectionCard; index: number }) {
  const lead = collectionLeadEntry(card);
  return <article className={`cb-tile tone-${toneOf(card)}`} id={`card-${card.id}`}>
    <FlipFace card={card} width={300} priority={index < 6} />
    <div className="cb-caption">
      <div className="cb-caption-top"><span className="cb-no">{card.number}</span><TierBadge card={card} /></div>
      <h2><Link href={card.cardUrl}>{card.name}</Link></h2>
      {lead && lead.status !== 'unavailable' ? <p className="cb-line"><span>{competitionName(lead.competition)}</span><span className="cb-num">{rankText(lead)}</span><span className="cb-num">{scoreText(lead)}</span></p> : <p className="cb-line cb-dim">{collectionEarnedLine(card) ?? ''}</p>}
    </div>
  </article>;
}

function MedalRow({ card }: { card: CollectionCard }) {
  const m = card.career?.medals;
  if (!m) return <span className="cb-dim">—</span>;
  return <span className="cb-medals" aria-label={`${m.gold} gold, ${m.silver} silver, ${m.bronze} bronze`}><b className="g">{m.gold}</b><b className="s">{m.silver}</b><b className="b">{m.bronze}</b></span>;
}

/** The price-guide view: every card on one dense line, sortable. */
function Sheet({ cards, sort, setSort }: { cards: CollectionCard[]; sort: SortKey; setSort: (key: SortKey) => void }) {
  const head = (key: SortKey, label: string) => <th scope="col"><button type="button" onClick={() => setSort(key)} aria-pressed={sort === key}>{label}{sort === key ? ' ▾' : ''}</button></th>;
  return <div className="cb-sheet-wrap"><table className="cb-sheet">
    <caption className="sr-only">Every card in the Cabinet, with role, tier, standing and medals</caption>
    <thead><tr>{head('number', 'No.')}<th scope="col">Card</th>{head('tier', 'Tier')}<th scope="col">Contest</th><th scope="col">Team</th>{head('rank', 'Rank')}<th scope="col">Score</th>{head('medals', 'G · S · B')}</tr></thead>
    <tbody>{cards.map(card => {
      const lead = collectionLeadEntry(card);
      const more = card.entries.filter(entry => entry !== lead && entry.status !== 'unavailable');
      return <tr key={card.id} className={`tone-${toneOf(card)}`}>
        <td className="cb-no">{card.number}</td>
        <th scope="row"><Link href={card.cardUrl}>{card.name}</Link></th>
        <td><TierBadge card={card} /></td>
        <td>{lead ? competitionName(lead.competition) : '—'}{more.map(entry => <small key={entry.competitionId}>{competitionName(entry.competition)}</small>)}</td>
        <td>{lead?.teamName ?? '—'}{more.map(entry => <small key={entry.competitionId}>{entry.teamName}</small>)}</td>
        <td className="cb-num">{rankText(lead)}{more.map(entry => <small key={entry.competitionId}>{rankText(entry)}</small>)}</td>
        <td className="cb-num">{scoreText(lead)}{more.map(entry => <small key={entry.competitionId}>{scoreText(entry)}</small>)}</td>
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
      <p className="cb-links"><a href={card.path}>In the Hall of Fame ↗</a>{card.cardUrls.map(link => <Link key={link.url} href={link.url}>{link.name}’s 2026 card →</Link>)}</p>
    </div>
  </article>;
}

function Archive({ archive }: { archive: NonNullable<NewsCollection['archive']> }) {
  return <>
    <p className="cb-sub cb-archive-note">{archive.series.title}, {archive.series.season}: the {archive.series.name} cards, kept exactly as they were issued. {archive.cards.length} cards, from the 2020 winner to the 2025 champions.</p>
    <div className="cb-grid cb-grid-old">{archive.cards.map(card => <ArchiveTile key={card.id} card={card} />)}</div>
  </>;
}

function Cabinet({ collection }: { collection: NewsCollection }) {
  const [role, setRole] = useState<RoleFilter>('all');
  const [tier, setTier] = useState<TierFilter>('all');
  const [contest, setContest] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('number');
  const [view, setView] = useState<View>('binder');
  const [set, setSet] = useState<'current' | 'archive'>('current');
  const cards = collection.cards;
  const contests = useMemo(() => [...new Map(cards.flatMap(card => card.entries).map(entry => [entry.competitionId, entry.competition] as const)).entries()]
    .map(([id, key]) => ({ id, label: competitionName(key) })), [cards]);
  const counts = useMemo(() => ({
    competitors: cards.filter(card => card.role === 'competitor').length, sponsors: cards.filter(card => card.role === 'sponsor').length, teams: cards.filter(card => card.role === 'team').length,
    tiers: [...KAGGLE_TIERS].reverse().map(name => ({ name, count: cards.filter(card => card.career?.tier === name).length })).filter(row => row.count),
  }), [cards]);
  const needle = search.trim().toLocaleLowerCase();
  const shown = useMemo(() => cards.filter(card => {
    if (role !== 'all' && card.role !== role) return false;
    if (tier !== 'all' && card.career?.tier !== tier) return false;
    if (contest !== 'all' && !card.entries.some(entry => entry.competitionId === contest)) return false;
    if (!needle) return true;
    const words = [card.name, card.number, collectionRoleLabel(card), ...card.accounts.map(account => account.label),
      ...card.entries.flatMap(entry => [entry.teamName, ...entry.members.flatMap(member => [member.name, member.handle])]), ...card.teamHistory.map(team => team.teamName)];
    return words.join(' ').toLocaleLowerCase().includes(needle);
  }).sort((a, b) => {
    const byNumber = a.number.localeCompare(b.number, 'en', { numeric: true });
    if (sort === 'rank') return bestRank(a) - bestRank(b) || byNumber;
    if (sort === 'tier') return tierRank(b) - tierRank(a) || medalScore(b) - medalScore(a) || byNumber;
    if (sort === 'medals') return medalScore(b) - medalScore(a) || byNumber;
    return byNumber;
  }), [cards, role, tier, contest, needle, sort]);
  const chip = <T extends string>(current: T, set: (value: T) => void, value: T, label: string, count?: number) =>
    <button key={value} type="button" aria-pressed={current === value} onClick={() => set(value)}>{label}{count != null ? <i>{count}</i> : null}</button>;
  return <main className="cb">
    <header className="cb-head">
      <h1>ARC Prize 2026 Cards</h1>
      <p className="cb-sub">Every Kaggle competitor, sponsor and team in the ARC Prize {collection.season} competitions, one card each. Open a card for its full record.</p>
      <ul className="cb-ticker" aria-label="The set">
        <li><b>{cards.length}</b> cards</li><li><b>{counts.competitors}</b> competitors</li><li><b>{counts.sponsors}</b> sponsors</li><li><b>{counts.teams}</b> teams</li>
        {counts.tiers.map(row => <li key={row.name} className={`tone-${row.name.toLowerCase()}`}><b>{row.count}</b> {row.name}{row.count === 1 ? '' : 's'}</li>)}
      </ul>
      {collection.archive && <div className="cb-chips cb-sets" role="group" aria-label="Set">
        {chip(set, setSet, 'current', `${collection.season} set`, cards.length)}{chip(set, setSet, 'archive', `${collection.archive.series.season} · ${collection.archive.series.title}`, collection.archive.cards.length)}
      </div>}
    </header>
    {set === 'archive' && collection.archive ? <Archive archive={collection.archive} /> : <>
    <form className="cb-controls" onSubmit={event => event.preventDefault()} aria-label="Find cards">
      <label className="cb-search"><span className="sr-only">Find a card</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a name, team or Kaggle handle" /></label>
      <div className="cb-chips" role="group" aria-label="Who">{chip(role, setRole, 'all', 'All')}{chip(role, setRole, 'competitor', 'Competitors', counts.competitors)}{chip(role, setRole, 'sponsor', 'Sponsors', counts.sponsors)}{chip(role, setRole, 'team', 'Teams', counts.teams)}</div>
      <div className="cb-chips" role="group" aria-label="Kaggle tier">{chip(tier, setTier, 'all', 'Any tier')}{[...KAGGLE_TIERS].reverse().map(name => counts.tiers.some(row => row.name === name) && chip(tier, setTier, name as TierFilter, name))}</div>
      {contests.length > 1 && <div className="cb-chips" role="group" aria-label="Competition">{chip(contest, setContest, 'all', 'Any contest')}{contests.map(row => chip(contest, setContest, row.id, row.label))}</div>}
      <label className="cb-sort"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value as SortKey)}><option value="number">Card number</option><option value="rank">Best rank</option><option value="tier">Kaggle tier</option><option value="medals">Medals</option></select></label>
      <div className="cb-chips cb-view" role="group" aria-label="View">{chip(view, setView, 'binder', 'Binder')}{chip(view, setView, 'sheet', 'Checklist')}</div>
      <p className="cb-shown" role="status" aria-live="polite">{shown.length} of {cards.length}</p>
    </form>
    {view === 'binder' ? <div className="cb-grid">{shown.map((card, index) => <Tile key={card.id} card={card} index={index} />)}</div> : <Sheet cards={shown} sort={sort} setSort={setSort} />}
    {!shown.length && <div className="cb-empty"><h2>No cards match.</h2><button type="button" onClick={() => { setSearch(''); setRole('all'); setTier('all'); setContest('all'); }}>Show every card →</button></div>}
    </>}
    <footer className="cb-colophon"><p>The {collection.season} set, commissioned by {collection.commissionedBy} and updated {newsDate(collection.updatedAt)}. Every card has its own link and share image. Illustrations are ARC Hall of Fame renderings of the real competitors; the tier, standings and medals are drawn from Kaggle.</p></footer>
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

type ShelfItem = { key: string; kind: 'current' | 'past' | 'team'; label: string; sub: string; src: string; alt: string; href?: string };

/**
 * Every card we hold for this subject, laid out like a collection: this season's card, the earlier cards
 * (ARC Hall of Fame), and the Cabinet cards of the teams they play on. Choosing one puts it on the stage.
 */
function Shelf({ items, stage, setStage }: { items: ShelfItem[]; stage: string; setStage: (key: string) => void }) {
  return <section className="cb-shelf" aria-label="All their cards">
    <h2>Their cards <i>{items.length}</i></h2>
    <ul>{items.map(item => <li key={item.key} className={`${item.kind}${stage === item.key ? ' is-staged' : ''}`}>
      {item.kind === 'team'
        ? <Link href={item.href!}><img src={item.src} alt={item.alt} loading="lazy" /></Link>
        : <button type="button" onClick={() => setStage(item.key)} aria-pressed={stage === item.key} aria-label={`Show the ${item.label} card`}><img src={item.src} alt={item.alt} loading="lazy" /></button>}
      <span><b>{item.label}</b>{item.sub}{item.kind === 'past' && item.href && <a href={item.href}>In the Hall of Fame ↗</a>}{item.kind === 'team' && <a href={item.href}>Open the team card →</a>}</span>
    </li>)}</ul>
  </section>;
}

export function Detail({ card, all }: { card: CollectionCard; all: CollectionCard[] }) {
  const [stage, setStage] = useState('current');
  const version = useMemo(() => collectionShareVersion(card), [card]);
  const career = card.career;
  const asOf = collectionAsOfLabel(card);
  const status = collectionStatus(card);
  const earned = collectionEarnedLine(card);
  const careerRows = career ? [...career.rows].sort((a, b) => a.rank / a.fieldSize - b.rank / b.fieldSize) : [];
  const entries = card.entries.filter(entry => entry.status !== 'unavailable');
  const roster = [...new Map(card.entries.flatMap(entry => entry.members).map(member => [member.personId ?? member.handle, member])).values()];
  const medals = career?.medals;
  // Every card we hold for them: this season's, the Hall of Fame cards, and the Cabinet cards of their teams.
  const shelf: ShelfItem[] = [
    { key: 'current', kind: 'current', label: `${card.season}`, sub: `ARC Prize · No. ${card.number}`, src: faceSrc(card, 'front', 260, version), alt: `${card.name}, ${card.season} card` },
    ...card.pastCards.filter(past => past.imageSrc).map((past, index) => ({ key: `past-${index}`, kind: 'past' as const, label: past.season ?? 'Earlier', sub: past.label, src: encodeURI(past.imageSrc!), alt: past.imageAlt, href: past.hallOfFameUrl })),
    ...(card.kind === 'person' ? [...new Map(card.teamHistory.filter(team => team.cardUrl).map(team => [team.cardUrl!, team])).values()].flatMap(team => {
      const teamCard = all.find(item => item.cardUrl === team.cardUrl);
      return teamCard ? [{ key: teamCard.id, kind: 'team' as const, label: teamCard.name, sub: `Team · No. ${teamCard.number}`, src: faceSrc(teamCard, 'front', 260, collectionShareVersion(teamCard)), alt: `${teamCard.name}, team card ${teamCard.number}`, href: teamCard.cardUrl }] : [];
    }) : []),
  ];
  const staged = card.pastCards.filter(past => past.imageSrc)[Number(stage.replace('past-', ''))];
  return <main className="cb cb-detail">
    <nav className="cb-crumb" aria-label="Breadcrumb"><Link href="/news/cards">← All cards</Link><span>{card.number}</span></nav>
    <header className={`cb-dhead tone-${toneOf(card)}`}><h1>{card.name}</h1><TierBadge card={card} full /><span className="cb-sub">{card.season}{career?.organisation ? ` · ${career.organisation}` : ''}{earned ? ` · Earned this card: ${earned}` : ''}</span></header>
    <div className="cb-dgrid">
      <div className="cb-dcard">
        {stage === 'current' || !staged ? <FlipFace card={card} width={560} priority /> : <figure className="cb-stage"><img src={encodeURI(staged.imageSrc!)} alt={staged.imageAlt} /><figcaption>{staged.season ?? 'Earlier'} · {staged.label} · <a href={staged.hallOfFameUrl}>In the Hall of Fame ↗</a></figcaption></figure>}
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
        {!!entries.length && <Panel title={card.role === 'team' ? 'Team standings' : 'Standings'}>
          <table className="cb-table"><thead><tr><th scope="col">Competition</th><th scope="col">Team</th><th scope="col">Rank</th><th scope="col">Best</th><th scope="col">Score</th><th scope="col">Entries</th></tr></thead>
            <tbody>{entries.map(entry => <tr key={`${entry.competitionId}-${entry.teamId}`}><td>{competitionName(entry.competition)}{entry.zone && <small className={`cb-zone ${entry.zone}`}>{entry.zone} zone</small>}</td>
              <td><Go href={entry.cardUrl ?? entry.profileUrl}>{entry.teamName} →</Go></td><td className="cb-num">{rankText(entry)}<small>{fieldText(entry).trim()}</small></td><td className="cb-num">{entry.peakRank ? `#${entry.peakRank}` : ''}</td><td className="cb-num">{scoreText(entry)}</td><td className="cb-num">{entry.submissions?.toLocaleString('en-US') ?? ''}</td></tr>)}</tbody></table>
          <p className="cb-note">{status === 'final' ? 'Final results' : 'Live'}{asOf ? `, as of ${asOf}` : ''}. {entries.some(entry => entry.sourceUrl) && <a href={entries.find(entry => entry.sourceUrl)!.sourceUrl}>Leaderboard ↗</a>}</p>
        </Panel>}
        {card.role === 'team' && !!roster.length && <Panel title="Roster">
          <ul className="cb-list">{roster.map(member => <li key={member.handle}><Go href={member.cardUrl ?? `https://www.kaggle.com/${encodeURIComponent(member.handle)}`}>{member.name || member.handle}{member.cardUrl ? ' →' : ' ↗'}</Go></li>)}</ul>
        </Panel>}
        {card.role === 'competitor' && !!careerRows.length && <Panel title="Completed Kaggle competitions" wide>
          <table className="cb-table"><thead><tr><th scope="col">Year</th><th scope="col">Competition</th><th scope="col">Team</th><th scope="col">Finish</th><th scope="col">Medal</th></tr></thead>
            <tbody>{careerRows.slice(0, 14).map(row => <tr key={row.competitionUrl}><td className="cb-num">{row.year ?? ''}</td><td><a href={row.competitionUrl}>{row.competition} ↗</a></td><td>{row.team ?? ''}</td>
              <td className="cb-num">{ordinal(row.rank)} of {row.fieldSize.toLocaleString('en-US')}</td><td>{row.medal ? <span className={`cb-medal ${row.medal}`}>{row.medal}</span> : ''}</td></tr>)}</tbody></table>
          <p className="cb-note">Best finishes first. {careerRows.length > 14 ? `${careerRows.length - 14} more on ` : 'Full list on '}<a href={`${career!.profileUrl}/competitions`}>Kaggle ↗</a></p>
        </Panel>}
        {card.role === 'competitor' && !!card.teamHistory.length && <Panel title="Teams">
          <ul className="cb-list">{card.teamHistory.map(team => <li key={`${team.competitionId}-${team.teamId}`}><Go href={team.cardUrl ?? team.profileUrl}>{team.teamName} →</Go>
            <small>{competitionName(team.competition)} · {team.season}{team.status === 'previous' ? ' · earlier team' : ''}</small></li>)}</ul>
        </Panel>}
        {!!card.stories.length && <Panel title="In the Digest">
          <ul className="cb-list">{card.stories.map(story => <li key={story.id}><Link href={story.url}>{story.headline}</Link><small>{story.kind === 'wire' ? 'The wire' : 'Edition'} · {newsDate(story.publishedAt)}</small></li>)}</ul>
        </Panel>}
        <Panel title="Everything else">
          <ul className="cb-list">
            <li><Go href={card.profileUrl}>{card.kind === 'person' ? 'Their page in the Digest →' : 'The team notebook →'}</Go></li>
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
    title: selected ? collectionCardTitle(selected) : cardId && query.data ? `Card not found | ${NEWS_NAME}` : `ARC Prize Cards | ${NEWS_NAME}`,
    description: selected ? collectionCardDescription(selected) : 'The ARC Daily Digest’s ARC Prize cards: a trading card for every Kaggle competitor, competition sponsor and team in the ARC Prize competitions, with linked teams, career records and standings.',
    canonicalPath: cardId ? collectionCardPath(cardId) : '/news/cards',
    noindex: !!cardId && !!query.data && !selected,
    image: selected ? { image: `${SITE_ORIGIN}${collectionSharePath(selected)}`, imageAlt: collectionShareAlt(selected), imageWidth: COLLECTION_SHARE_WIDTH, imageHeight: COLLECTION_SHARE_HEIGHT } : sectionImage,
  });
  return <CabinetShell>
    <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
    {query.data && (cardId
      ? selected ? <Detail card={selected} all={query.data.cards} /> : <main className="cb"><div className="cb-empty"><h1>Card not found</h1><p>This card isn’t in the collection.</p><Link href="/news/cards">Browse the ARC Prize cards →</Link></div></main>
      : <Cabinet collection={query.data} />)}
  </CabinetShell>;
}
