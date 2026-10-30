/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: The ARC Daily Digest's permanent, numbered Card Cabinet: commissioned team
 *          and individual art, dated competition records, and sourced career highlights.
 * SRP/DRY check: Pass — the collection API owns identity/art/stat selection; this page
 *          only filters and presents its shared contract inside the existing news shell.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CollectionCard, CollectionEntry, NewsCollection } from '@shared/newsCollection';
import { competitionName, NEWS_NAME } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, newsDate, useNewsCardImage } from '@/components/news/NewsDesk';
import '@/components/news/newsCards.css';

type KindFilter = 'all' | CollectionCard['kind'];
type ContestFilter = 'all' | CollectionEntry['competition'];

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toLocaleUpperCase();
}

function observedLabel(entry: CollectionEntry) {
  if (entry.status === 'unavailable') return 'Standing unavailable';
  const label = entry.status === 'final' ? 'Final standings' : 'Public · provisional';
  return entry.observedAt ? `${label} · ${newsDate(entry.observedAt)}` : label;
}

function standing(entry: CollectionEntry) {
  return entry.status !== 'unavailable' && entry.rank != null ? `#${entry.rank.toLocaleString('en-US')}` : '—';
}

function score(entry: CollectionEntry) {
  return entry.status !== 'unavailable' && entry.score != null ? entry.score.toFixed(2) : '—';
}

export default function NewsCards() {
  const query = useQuery<NewsCollection>({
    queryKey: ['/api/news/cards'],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch('/api/news/cards');
      if (!response.ok) throw new Error('The Card Cabinet could not be loaded.');
      return response.json() as Promise<NewsCollection>;
    },
  });
  const [kind, setKind] = useState<KindFilter>('all');
  const [contest, setContest] = useState<ContestFilter>('all');
  const [search, setSearch] = useState('');
  const allCards = query.data?.cards ?? [];
  const needle = search.trim().toLocaleLowerCase();
  const shown = useMemo(() => allCards.filter(card => {
    if (kind !== 'all' && card.kind !== kind) return false;
    if (contest !== 'all' && !card.entries.some(entry => entry.competition === contest)) return false;
    const words = [card.name, card.number, card.description, ...card.accounts.map(account => account.label),
      ...card.entries.flatMap(entry => [entry.teamName, entry.teamId, ...entry.members.flatMap(member => [member.name, member.handle])])];
    return !needle || words.join(' ').toLocaleLowerCase().includes(needle);
  }).sort((a, b) => a.kind === b.kind ? a.number.localeCompare(b.number, 'en', { numeric: true }) : a.kind === 'team' ? -1 : 1), [allCards, kind, contest, needle]);
  const personCount = allCards.filter(card => card.kind === 'person').length;
  const teamCount = allCards.filter(card => card.kind === 'team').length;

  usePageMeta({
    title: `Card Cabinet | ${NEWS_NAME}`,
    description: 'The ARC Daily Digest’s permanent collection of commissioned competitor and team cards, with sourced career highlights and dated ARC Prize standings.',
    canonicalPath: '/news/cards',
    image: useNewsCardImage(),
  });

  return <NewsPaper>
    <section className="news-cabinet" aria-labelledby="news-cabinet-title">
      <header className="news-cabinet-header">
        <div className="news-cabinet-series">The ARC Daily Digest <span>Collector’s series · {query.data?.season ?? '2026'}</span></div>
        <h1 id="news-cabinet-title">Card Cabinet</h1>
        <p className="news-cabinet-dek">The stars of the grid, collected.</p>
        <p className="news-cabinet-intro">Commissioned illustrations, memorable performances and the people behind the race. Turn a card over for its story and record. The collection stays; verified season honors join it as results become official.</p>
        {query.data && <div className="news-cabinet-colophon">
          <span>Commissioned by {query.data.commissionedBy} · {newsDate(query.data.commissionedAt)}</span>
          <span>{personCount} individual {personCount === 1 ? 'card' : 'cards'} · {teamCount} team {teamCount === 1 ? 'card' : 'cards'}</span>
        </div>}
      </header>

      <form className="news-cabinet-filters" onSubmit={event => event.preventDefault()} aria-label="Find collection cards">
        <div className="news-cabinet-search">
          <label htmlFor="news-cabinet-search">Find a card</label>
          <input id="news-cabinet-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, team or Kaggle handle" />
        </div>
        <fieldset>
          <legend>The collection</legend>
          <div className="news-cabinet-filter-buttons">{(['all', 'person', 'team'] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'all' ? 'All cards' : value === 'person' ? 'Individuals' : 'Teams'}</button>)}</div>
        </fieldset>
        <fieldset>
          <legend>The contest</legend>
          <div className="news-cabinet-filter-buttons">{(['all', 'arc-3', 'arc-2'] as const).map(value => <button key={value} type="button" aria-pressed={contest === value} onClick={() => setContest(value)}>{value === 'all' ? 'Both contests' : value === 'arc-3' ? 'ARC3' : 'ARC2'}</button>)}</div>
        </fieldset>
      </form>

      <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
      {query.data && <>
        <div className="news-cabinet-results" role="status" aria-live="polite">
          <span>{shown.length} of {allCards.length} cards on display</span>
          <span>Public standings are dated observations; honors appear when verified.</span>
        </div>
        <div className="news-cabinet-grid">{shown.map(card => <CabinetCard key={card.id} card={card} contest={contest} />)}</div>
        {!shown.length && <div className="news-cabinet-empty"><h2>No cards match that search.</h2><p>Try another name or show the full collection.</p><button type="button" onClick={() => { setSearch(''); setKind('all'); setContest('all'); }}>Show all cards →</button></div>}
      </>}
    </section>
  </NewsPaper>;
}

function CabinetCard({ card, contest }: { card: CollectionCard; contest: ContestFilter }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const nameId = `cabinet-${card.id}-name`;
  const faceId = `cabinet-${card.id}-face`;
  const entries = contest === 'all' ? card.entries : card.entries.filter(entry => entry.competition === contest);
  const frontEntries = entries.slice(0, 2);
  const availableArt = card.art && !failedImages.includes(card.art.src) ? card.art : null;

  return <article className={`news-cabinet-card is-${card.kind}`} id={`card-${card.id}`} aria-labelledby={nameId}>
    <div className="news-cabinet-card-top">
      <span className="news-cabinet-number">No. {String(card.number).padStart(3, '0')}</span>
      <span className="news-cabinet-type">{card.kind === 'person' ? 'Individual' : 'Team'} · {card.season}</span>
    </div>
    <div className="news-cabinet-turn" role="group" aria-label={`View ${card.name} card`}>
      {(['front', 'back'] as const).map(value => <button type="button" key={value} aria-pressed={side === value} aria-controls={faceId} onClick={() => setSide(value)}>{value === 'front' ? 'Front' : 'Back'}</button>)}
    </div>
    <div className={`news-cabinet-face is-${side}`} id={faceId}>
      {side === 'front' ? <>
        <div className="news-cabinet-art">
          {availableArt ? <img src={availableArt.src} alt={availableArt.alt} loading="lazy" decoding="async" onError={() => setFailedImages(previous => [...previous, availableArt.src])} />
            : <div className="news-cabinet-initials" aria-label={`${card.name} initials`}><span>{initials(card.name)}</span><small>The ARC Daily Digest</small></div>}
        </div>
        <div className="news-cabinet-nameplate">
          <span>{card.kind === 'person' ? 'The competitor' : 'The crew'}</span>
          <h2 id={nameId}>{card.name}</h2>
        </div>
        <div className="news-cabinet-front-record">
          {frontEntries.map(entry => <div className="news-cabinet-stat-strip" key={`${entry.competitionId}-${entry.teamId}`}>
            <div className="news-cabinet-stat-heading"><strong>{competitionName(entry.competition)}</strong><span>{observedLabel(entry)}</span></div>
            <dl><div><dt>Rank</dt><dd>{standing(entry)}</dd></div><div><dt>Score</dt><dd>{score(entry)}</dd></div></dl>
          </div>)}
          {!frontEntries.length && <p className="news-cabinet-no-standing">Career card · the record continues on the reverse.</p>}
          {entries.length > frontEntries.length && <span className="news-cabinet-more-records">More competition records on the reverse →</span>}
        </div>
        {card.highlights[0] && <p className="news-cabinet-front-highlight">{card.highlights[0].text}</p>}
        <div className="news-cabinet-stamp">The ARC Daily Digest <span>Card Cabinet</span></div>
      </> : <>
        <header className="news-cabinet-back-header"><span>The record · No. {String(card.number).padStart(3, '0')}</span><h2 id={nameId}>{card.name}</h2></header>
        {card.description && <p className="news-cabinet-bio">{card.description}</p>}
        {!!card.honors.length && <section className="news-cabinet-back-section"><h3>Honors</h3><ul className="news-cabinet-honors">{card.honors.map((honor, index) => <li key={`${honor.sourceUrl}-${index}`}><span>{honor.kind === 'arc-prize' ? 'ARC Prize award' : 'Kaggle medal'} · {honor.season}</span><a href={honor.sourceUrl}>{honor.label} ↗</a><small>{competitionName(honor.competition)} · {honor.scope === 'individual' ? 'Individual honor' : 'Team honor'}</small></li>)}</ul></section>}
        {!!entries.length && <section className="news-cabinet-back-section"><h3>Competition record</h3>{entries.map(entry => <EntryRecord key={`${entry.competitionId}-${entry.teamId}`} entry={entry} />)}</section>}
        {!!card.highlights.length && <section className="news-cabinet-back-section"><h3>From the file</h3><ul className="news-cabinet-facts">{card.highlights.map((highlight, index) => <li key={`${highlight.sourceUrl}-${index}`}><p>{highlight.text}</p><a href={highlight.sourceUrl}>{highlight.sourceTitle} ↗</a><small>Checked {newsDate(highlight.checkedAt)}</small></li>)}</ul></section>}
        {!!card.accounts.length && <section className="news-cabinet-back-section"><h3>Public accounts</h3><ul className="news-cabinet-accounts">{card.accounts.map(account => <li key={account.url}><a href={account.url}>{account.label} ↗</a></li>)}</ul></section>}
        <section className="news-cabinet-back-section news-cabinet-art-credit"><h3>The illustration</h3>
          <p>{card.art?.credit ?? 'An individual illustration is not available for this card.'}</p>
          {card.art?.commissionedAt && <small>Commissioned {newsDate(card.art.commissionedAt)}</small>}
          {!!card.artNotes.length && <ul>{card.artNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
        </section>
      </>}
    </div>
    <footer className="news-cabinet-card-links">
      <a href={card.profileUrl}>{card.kind === 'person' ? 'Open profile' : 'Team notebook'} →</a>
      <a href={`/api/news/cards/${encodeURIComponent(card.id)}/image.png`} download>Save card PNG ↓</a>
    </footer>
  </article>;
}

function EntryRecord({ entry }: { entry: CollectionEntry }) {
  return <div className="news-cabinet-entry">
    <h4>{competitionName(entry.competition)} <span>{entry.teamName}</span></h4>
    <p className="news-cabinet-entry-date">{observedLabel(entry)}</p>
    {entry.sourceUrl && <a className="news-cabinet-entry-date" href={entry.sourceUrl}>Standings source ↗</a>}
    <dl><div><dt>Rank</dt><dd>{standing(entry)}</dd></div><div><dt>Score</dt><dd>{score(entry)}</dd></div><div><dt>Submissions</dt><dd>{entry.submissions?.toLocaleString('en-US') ?? '—'}</dd></div></dl>
    {!!entry.members.length && <ul className="news-cabinet-roster">{entry.members.map(member => <li key={member.handle}><a href={`https://www.kaggle.com/${encodeURIComponent(member.handle)}`}>{member.name || member.handle}{member.name && member.name !== member.handle && <span> · {member.handle}</span>} ↗</a></li>)}</ul>}
  </div>;
}
