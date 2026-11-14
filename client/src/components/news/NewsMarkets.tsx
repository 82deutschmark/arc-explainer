/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex; Claude Opus 5.5; GPT-6 Astra Extra high
 * Date: 14-Nov-2026 (Claude Opus 5.5); 09-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the ticker and movers print each board's save with its full date; a board
 *          that stopped updating (boardFreshAt) says "not updated since" and its movers cover the day before that
 *          save, so a frozen board can no longer pass for today's.
 * PURPOSE: The ARC Daily Digest's market pages, drawn from the live digest (GET /api/news/markets,
 *          shared/newsMarkets.ts): the ticker of both boards, the standings in agate type, the
 *          past day's movers, where the past prize winners stand now, and the index of the rest
 *          of the site. Every change compares with the snapshot saved about a day earlier; an
 *          unknown comparison prints as a blank, never as zero. When the digest is unavailable
 *          these pieces render nothing and the reporting still leads the page. Scores and
 *          derived score differences retain the source precision without binary arithmetic tails.
 *          Submission status follows the current UTC deadline while standings keep their save time.
 * SRP/DRY check: Pass — figures come only from the digest; names link through the existing
 *          profile, people and Kaggle helpers; faces use PersonPortrait.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { NEWS_ARCHIVE, competitorPath, newsDate, personPath, shortPersonName, type CompetitorRecord, type NewsCompetition, type NewsPerson } from '@shared/news';
import { boardFreshAt, daysToClose, marketClimb, marketGain, type MarketBoard, type MarketRow, type MarketsPayload } from '@shared/newsMarkets';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { formatOptionalNumber } from '@shared/utils/formatters';
import { ARC_DISCORD_URL } from './NewsDesk';
import { PersonPortrait } from './NewsPeople';

export const BOARD_ORDER: NewsCompetition[] = Object.keys(KAGGLE_COMPETITIONS);

export function useMarkets() {
  return useQuery<MarketsPayload>({ queryKey: ['/api/news/markets'], staleTime: 120_000, refetchInterval: 300_000 });
}

export const marketBoards = (markets?: MarketsPayload) =>
  BOARD_ORDER.map(key => markets?.boards[key]).filter((board): board is MarketBoard => !!board);

const fig = (value: number) => String(value);
/** Decimal arithmetic cannot introduce more places than either of its source values. */
const decimalPlaces = (value: number) => {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
};
const differencePrecision = (now: number, then: number | null) => then == null ? undefined : Math.max(decimalPlaces(now), decimalPlaces(then));
const differenceFigure = (value: number, precision?: number) => {
  if (precision != null && precision <= 100) return String(Number(formatOptionalNumber(value, precision)));
  const text = String(value);
  // For an already-derived value without its operands, remove only long binary-noise tails.
  return /\.\d*(?:0{8,}|9{8,})\d{0,3}$/.test(text) ? String(Number(value.toPrecision(12))) : text;
};
const count = (value: number) => value.toLocaleString('en-US');
const ordinal = (n: number) => `#${n.toLocaleString('en-US')}`;
/** A board's save as a reader should see it: its full UTC date and time, flagged when the board has stopped updating. */
export const boardSaved = (board: MarketBoard, now = Date.now()) =>
  boardFreshAt(board.fetched, board.closeAt, now) ? `${board.label} saved ${newsDate(board.fetched, true)}` : `${board.label} not updated since ${newsDate(board.fetched, true)}`;
/** One 24-hour UTC clock for every reader. */
export const clockUtc = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) + ' UTC';

/** A signed change with a direction mark, a dash when unchanged, blank when unknown. */
export function Change({ value, integer = false, precision }: { value: number | null; integer?: boolean; precision?: number }) {
  if (value == null) return null;
  const size = integer ? count(Math.abs(value)) : differenceFigure(Math.abs(value), precision);
  if (Number(size.replaceAll(',', '')) === 0) return <span className="news-chg is-flat" title="Unchanged">–</span>;
  return <span className={`news-chg ${integer ? "" : "sd"} ${value > 0 ? 'is-up' : 'is-down'}`}><span aria-hidden="true">{value > 0 ? '▲' : '▼'}</span>{value > 0 ? '+' : '−'}{size}</span>;
}

/** Places moved: ▲4, ▼2, NEW, a dash for no move, blank when unknown. */
function Places({ row }: { row: MarketRow }) {
  if (row.isNew) return <span className="news-chg is-new">NEW</span>;
  const climb = marketClimb(row);
  if (climb == null) return null;
  if (climb === 0) return <span className="news-chg is-flat">–</span>;
  return <span className={`news-chg ${climb > 0 ? 'is-up' : 'is-down'}`} title={`${climb > 0 ? 'Up' : 'Down'} ${count(Math.abs(climb))} places`}>{climb > 0 ? '▲' : '▼'}{count(Math.abs(climb))}</span>;
}

export interface TeamLinks { competitors: CompetitorRecord[]; people: NewsPerson[] }

/** A team links to its notebook dossier when there is one, else to its first member's Kaggle profile. */
function TeamName({ row, competition, links }: { row: MarketRow; competition: NewsCompetition; links: TeamLinks }) {
  const dossier = links.competitors.find(record => record.competition === competition && record.teamId === row.teamId);
  if (dossier) return <Link href={competitorPath(dossier.id)}>{row.name}</Link>;
  return row.members[0] ? <a href={`https://www.kaggle.com/${encodeURIComponent(row.members[0])}`} title={`Kaggle profile: ${row.members[0]}`}>{row.name}</a> : <>{row.name}</>;
}

function Quote({ label, value, then, integer = false, note }: { label: ReactNode; value: number | null; then: number | null; integer?: boolean; note?: string }) {
  if (value == null) return null;
  return <div title={note}><dt>{label}</dt><dd><b className={integer ? undefined : 'sc'}>{integer ? count(value) : fig(value)}</b> <Change value={then == null ? null : value - then} integer={integer} precision={differencePrecision(value, then)} /></dd></div>;
}

/** The terminal strip under the masthead: leader, medal lines, field and countdown for both boards. */
export function MarketTicker({ markets }: { markets?: MarketsPayload }) {
  const boards = marketBoards(markets);
  if (!boards.length) return null;
  const currentUtc = new Date().toISOString();
  return <section className="news-ticker" aria-label="Both boards at a glance">
    {boards.map(board => {
      const days = daysToClose({ closeAt: board.closeAt, fetched: currentUtc });
      return <dl key={board.competition}>
        <div className="news-ticker-board"><dt className="sr-only">Board</dt><dd><a href={board.boardPath}>{board.label}</a></dd></div>
        <Quote label={<>Leader · <span className="news-ticker-name">{board.leader.row.name}</span></>} value={board.lines.top.now} then={board.lines.top.then} />
        <Quote label={`Gold · ${ordinal(board.lines.gold.rank)}`} value={board.lines.gold.now} then={board.lines.gold.then} note={`Score of the last gold place, ${ordinal(board.lines.gold.rank)}`} />
        <Quote label={`Silver · ${ordinal(board.lines.silver.rank)}`} value={board.lines.silver.now} then={board.lines.silver.then} />
        <Quote label={`Bronze · ${ordinal(board.lines.bronze.rank)}`} value={board.lines.bronze.now} then={board.lines.bronze.then} />
        <Quote label="Field" value={board.teams} then={board.teamsThen} integer note="Teams on the public board" />
        {days === 0 ? <div><dt>Submissions</dt><dd><b>closed</b></dd></div>
          : days != null ? <div><dt>Close</dt><dd><b>{days}</b> {days === 1 ? 'day' : 'days'}</dd></div> : null}
      </dl>;
    })}
    <p className="news-ticker-note">{boards.map(board => boardSaved(board)).join(' · ')} · change over the day before each save · medals settle on the private board</p>
  </section>;
}

/** The standings in agate: rank, move, team, score and the day's change, with the gold line ruled in. */
export function BoardTable({ board, links, limit = 25 }: { board: MarketBoard; links: TeamLinks; limit?: number }) {
  const rows = board.standings.slice(0, limit);
  const medal = (rank: number) => rank <= board.medalRanks.gold ? 'is-gold' : rank <= board.medalRanks.silver ? 'is-silver' : rank <= board.medalRanks.bronze ? 'is-bronze' : '';
  return <div className="news-agate-block">
    <table className="news-agate">
      <caption><a href={board.boardPath}>{board.label}</a> <span>top {rows.length} of {count(board.teams)}</span></caption>
      <thead><tr><th scope="col" className="num">Place</th><th scope="col"><span className="sr-only">Places moved</span></th><th scope="col">Team</th><th scope="col" className="num">Score</th><th scope="col" className="num">Δ Score</th></tr></thead>
      <tbody>{rows.map(row => <BoardRow key={row.teamId} row={row} board={board} links={links} medal={medal(row.rank)} />)}</tbody>
    </table>
    <a className="news-read" href={board.boardPath}>All {count(board.teams)} teams, charts and history →</a>
  </div>;
}

function BoardRow({ row, board, links, medal }: { row: MarketRow; board: MarketBoard; links: TeamLinks; medal: string }) {
  const cut = row.rank === board.medalRanks.gold;
  return <>
    <tr className={medal}>
      <td className="num pl">#{count(row.rank)}</td>
      <td className="move"><Places row={row} /></td>
      <td className="team"><TeamName row={row} competition={board.competition} links={links} /></td>
      <td className="num sc">{fig(row.score)}</td>
      <td className="num"><Change value={marketGain(row)} precision={differencePrecision(row.score, row.scoreThen)} /></td>
    </tr>
    {cut && <tr className="news-agate-cut"><td colSpan={5}>Gold line · {board.medalRanks.gold} places</td></tr>}
  </>;
}

function MoverList({ title, rows, value, empty, board, links }: { title: string; rows: MarketRow[]; value: (row: MarketRow) => ReactNode; empty: string; board: MarketBoard; links: TeamLinks }) {
  return <div className="news-mover">
    <h4>{title}</h4>
    {rows.length ? <ol>{rows.map(row => <li key={row.teamId}><span className="team"><TeamName row={row} competition={board.competition} links={links} /></span><span className="num">{value(row)}</span></li>)}</ol>
      : <p className="news-muted">{empty}</p>}
  </div>;
}

/** The past day's movers for each board: gains, climbs, newcomers, the bubble and the gold-line changes. */
export function MoversBand({ markets, links }: { markets?: MarketsPayload; links: TeamLinks }) {
  const boards = marketBoards(markets);
  if (!boards.length) return null;
  return <section className="news-movers" aria-label="The past day's movers">
    <h2 className="news-flag"><span>Market movers</span><em>The day before each board’s latest save</em></h2>
    {boards.map(board => {
      const gold = board.lines.gold.now;
      const fresh = boardFreshAt(board.fetched, board.closeAt);
      return <div key={board.competition} className="news-movers-board">
        <h3><a href={board.boardPath}>{board.label}</a></h3>
        {!fresh && <p className="news-board-stale" role="note">Board not updated since {newsDate(board.fetched, true)}. These moves cover the day before {newsDate(board.fetched)}, not today.</p>}
        <div className="news-movers-grid">
          <MoverList title="Biggest gains" board={board} links={links} rows={board.gainers} empty="No supported score gains."
            value={row => <><Change value={marketGain(row)} precision={differencePrecision(row.score, row.scoreThen)} /> <small>to <span className="sc">{fig(row.score)}</span></small></>} />
          <MoverList title="Biggest climbs" board={board} links={links} rows={board.climbers} empty="No supported place gains."
            value={row => <><Places row={row} /> <small>to <span className="pl">{ordinal(row.rank)}</span></small></>} />
          <MoverList title="New on the board" board={board} links={links} rows={board.newcomers} empty="No new team reached the top 500."
            value={row => <><b className="pl">{ordinal(row.rank)}</b> <small className="sc">{fig(row.score)}</small></>} />
          <MoverList title="On the bubble" board={board} links={links} rows={board.bubble} empty="No teams below the gold line."
            value={row => <><span className={gold == null ? 'sc' : 'sd'}>{gold == null ? fig(row.score) : <>−{differenceFigure(gold - row.score, differencePrecision(gold, row.score))}</>}</span> <small>{ordinal(row.rank)}</small></>} />
        </div>
        {(!!board.intoGold.length || !!board.outOfGold.length) && <p className="news-movers-gold">
          {!!board.intoGold.length && <><strong>Into gold:</strong> {board.intoGold.map((row, index) => <span key={row.teamId}>{index ? ', ' : ''}<TeamName row={row} competition={board.competition} links={links} /> ({ordinal(row.rank)})</span>)}. </>}
          {!!board.outOfGold.length && <><strong>Out of gold:</strong> {board.outOfGold.map((row, index) => <span key={row.teamId}>{index ? ', ' : ''}<TeamName row={row} competition={board.competition} links={links} /> ({ordinal(row.rank)})</span>)}.</>}
        </p>}
        <p className="news-muted">{board.since
          ? <>{count(board.improved)} teams with comparison evidence raised their score{board.teamsThen != null ? <> and the field grew by {count(Math.max(0, board.teams - board.teamsThen))}</> : null} since the save at {newsDate(board.since, true)}.</>
          : 'No save from a day earlier, so the past day’s changes are unknown.'}</p>
      </div>;
    })}
  </section>;
}

/** People with a past prize or credit who are on this year's boards, best current placing first. */
export function PastWinners({ markets, people, links }: { markets?: MarketsPayload; people: NewsPerson[]; links: TeamLinks }) {
  const boards = marketBoards(markets);
  const entries = people.filter(person => person.hallOfFame.length).map(person => ({
    person,
    teams: person.memberships.flatMap(member => {
      const board = boards.find(item => item.competition === member.competition);
      const row = board?.watch.find(item => item.teamId === member.teamId) ?? board?.standings.find(item => item.teamId === member.teamId);
      return board && row ? [{ board, row }] : [];
    }).filter((team, index, all) => all.findIndex(other => other.board === team.board && other.row.teamId === team.row.teamId) === index)
      .sort((a, b) => a.row.rank - b.row.rank),
  })).filter(entry => entry.teams.length).sort((a, b) => a.teams[0].row.rank - b.teams[0].row.rank);
  if (!entries.length) return null;
  return <section className="news-winners" aria-label="Where the past winners stand">
    <h2 className="news-flag"><span>Where the past winners stand</span><em>Prize winners and credited contenders on this year’s boards</em></h2>
    <table className="news-agate news-winners-table">
      <thead><tr><th scope="col">Person and honor</th><th scope="col">Team now</th><th scope="col" className="num">Place</th><th scope="col" className="num">Score</th><th scope="col" className="num">Δ Score</th></tr></thead>
      <tbody>{entries.flatMap(({ person, teams }) => teams.map(({ board, row }, index) => <tr key={`${person.id}-${row.teamId}`}>
        {index === 0 && <td rowSpan={teams.length} className="news-winner"><div className="news-winner-cell">
          <Link href={personPath(person.id)} tabIndex={-1} aria-hidden="true"><PersonPortrait person={person} size="face" decorative /></Link>
          <span><Link href={personPath(person.id)} className="news-winner-name">{shortPersonName(person.name)}</Link><Link href={person.hallOfFame[0].path} className="news-winner-honor">{person.hallOfFame[0].label}</Link></span>
        </div></td>}
        <td className="team"><TeamName row={row} competition={board.competition} links={links} /> <small>{board.label}</small></td>
        <td className="num pl">#{count(row.rank)}</td>
        <td className="num sc">{fig(row.score)}</td>
        <td className="num"><Change value={marketGain(row)} precision={differencePrecision(row.score, row.scoreThen)} /></td>
      </tr>))}</tbody>
    </table>
    <p className="news-muted">Honors link to the illustrated <Link href="/hall-of-fame">Hall of Fame</Link>. Teams are this year’s observed rosters; a past result belongs to its own year and team.</p>
  </section>;
}

const INSIDE: { href: string; title: string; text: string; external?: boolean }[] = [
  { href: '/kaggle-leaderboard#medal-race', title: 'Medal race', text: 'every ARC-AGI-3 team against the cut lines', external: true },
  { href: '/kaggle-leaderboard#score-history', title: 'Score history', text: 'the leader and medal lines over time', external: true },
  { href: '/kaggle-leaderboard/arc-2', title: 'ARC-AGI-2 board', text: 'standings, medal race and history', external: true },
  { href: '/human-records.html', title: 'Human and AI records', text: 'action counts against AI scores', external: true },
  { href: '/arc3/games', title: 'Game guides', text: 'the 25 public ARC-AGI-3 games' },
  { href: '/news/cards', title: 'Cards', text: 'the competitors, teams and their stories' },
  { href: NEWS_ARCHIVE.path, title: NEWS_ARCHIVE.heading, text: 'published stories by date and competition' },
  { href: '/hall-of-fame', title: 'Hall of Fame', text: 'illustrated cards of past winners' },
  { href: ARC_DISCORD_URL, title: 'ARC Discord', text: 'the official community', external: true },
];

/** A newspaper's index box in place of a grid of link cards. */
export function InsideIndex() {
  return <nav className="news-inside" aria-label="Inside the Digest">
    <h2 className="news-flag"><span>Inside</span></h2>
    <ul>{INSIDE.map(item => <li key={item.href}>{item.external
      ? <a href={item.href} {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><strong>{item.title}</strong> <span>{item.text}</span></a>
      : <Link href={item.href}><strong>{item.title}</strong> <span>{item.text}</span></Link>}</li>)}</ul>
  </nav>;
}
