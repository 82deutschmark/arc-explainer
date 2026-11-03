/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: The pieces every page uses to show Team Turducken's synthetic ARC-AGI-3 games: the
         approved set (the mirror's Trainable feed, playable here), the published picks (the
         public catalog behind the GitHub Pages write-up, with level pictures and human
         numbers), a board tile, a level strip, a pick row and the full wall.

         TWO SOURCES ON PURPOSE. The Trainable feed says what is approved and playable on this
         site, but carries no human numbers. The published catalog carries those, and is hand
         curated by its "featured" list, but can lag behind approvals (LT03 is approved and is
         not in it yet). A pick plays here when the site has that exact id, and on
         arc3.sonpham.net when it does not. If the catalog can't be reached, the picks vanish and the wall still works.

         No game names, descriptions or rules appear here. Working out the rules is the game.
         Every figure is read from a source at runtime; none is typed in.
Updated: 2026-11-02, Claude Opus 5.5 High. The Boss: the picks must be data-dense, a card per game
         with the rest behind a click. PickRow (one tall row per game, human numbers) is replaced by
         PickGrid: twelve small cards in two rows on a laptop, and a click opens the game's spoiler
         panel (what is special, the rules, how it differs from the public 25, its look), all read
         from the catalog's "spoiler" entry. No human numbers anywhere (Boss, 2-Nov-2026).
         Same day: the catalog's "highlight" (ES01 and LT03: outbreak and air strikes, no guardrails
         hit) shows under the grid, edges those two cards and leads their panels, word for word.
SRP/DRY check: Pass - reuses the mirror route, its thumbnails and the published catalog. No
         approval logic lives here: the lab owns approval, the catalog owns the picks.
*/

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { MONO } from '@/pages/arc3-community/landingTheme';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export const WRITEUP_URL = 'https://82deutschmark.github.io/arc3-synthetic-games/';
/** The write-up's home is this site. GitHub Pages is the side door, not the lead. */
export const WHY_PATH = '/arc3/why';
export const REPO_URL = 'https://github.com/82deutschmark/arc3-synthetic-games';

/** The game the front page leads with. Falls back to the first approved game if it leaves the feed. */
export const LEAD_GAME_LABEL = 'LT03';

export const INK = '#141414';
const LINE = '#2C2B2A';
const HOT = '#E53AA3';
const INPUTS: Record<number, string> = { 1: '↑', 2: '↓', 3: '←', 4: '→', 5: 'Space', 6: 'Click', 7: 'Undo' };

export interface ApprovedGame { gameId: string; label?: string }

interface CatalogGame {
  id: string;
  levels: number;
  human: { actions: number; levels: number } | null;
  inputs?: number[];
  play: string;
  media: { play: string; levels: string };
  spoiler?: Spoiler;
}
/** The catalog's hand-checked write-up of one game. Any field can be missing. */
export interface Spoiler { special?: string; rules?: string[]; vsPublic?: string; look?: string; markSaid?: string }
interface Catalog { featured: string[]; games: CatalogGame[]; highlight?: { games: string[]; text: string } }

export interface Pick {
  id: string;
  label: string;
  levels: number;
  inputs: string;
  spoiler: Spoiler;
  /** The catalog's called-out note, when this game is one it names. */
  flag?: string;
  image: string;
  levelStrip: string;
  /** A path on this site when the approved feed has the game, otherwise the lab's page for it. */
  href: string;
}

export function labelOf(game: ApprovedGame): string {
  return game.label || game.gameId;
}
export function playPath(game: ApprovedGame): string {
  return `/arc3/play/${game.gameId}`;
}
export function boardImage(game: ApprovedGame, size = 256): string {
  return `/api/arc3-mirror/games/${game.gameId}/thumbnail?size=${size}`;
}

export function useApprovedGames() {
  const query = useQuery<{ data: { games: ApprovedGame[] } }>({
    queryKey: ['/api/arc3-mirror/games?collection=trainable'],
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, games: query.data?.data.games ?? [] };
}

/** Every game the player can open, unfiltered. Callers choose their set by category. */
export function useMirrorGames(): (ApprovedGame & { category?: string })[] {
  const { data } = useQuery<{ data: { games: (ApprovedGame & { category?: string })[] } }>({
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  return data?.data.games ?? [];
}

/** Published picks in the write-up's own order, resolved against what plays here. */
export function usePicks(approved: ApprovedGame[]): Pick[] {
  const { data } = useQuery<Catalog>({
    queryKey: ['arc3-synthetic-catalog'],
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch(`${WRITEUP_URL}catalog.json`);
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      return response.json();
    },
  });
  // Picks not yet in the approved feed (LT02 today) can still be in the wider mirror under their
  // bare id. Exact id only: a look-alike such as wb01-v1 in another collection is a different game.
  const mirror = useMirrorGames();
  return useMemo(() => {
    if (!data) return [];
    const here = new Map(approved.map((g) => [labelOf(g).toLowerCase(), g]));
    for (const g of mirror) if (!here.has(g.gameId)) here.set(g.gameId, g);
    return data.featured.flatMap((id) => {
      const game = data.games.find((g) => g.id === id);
      if (!game) return [];
      const local = here.get(id);
      return [{
        id,
        label: id.toUpperCase(),
        levels: game.levels,
        spoiler: game.spoiler ?? {},
        flag: data.highlight?.games.includes(id) ? data.highlight.text : undefined,
        inputs: (game.inputs ?? []).map((i) => INPUTS[i]).filter(Boolean).join(' '),
        image: `${WRITEUP_URL}${game.media.play}`,
        levelStrip: `${WRITEUP_URL}${game.media.levels}`,
        href: local ? playPath(local) : game.play,
      }];
    });
  }, [data, approved, mirror]);
}

/** One link either way: inside this site by router, out to the lab in a new tab. */
export function PlayLink({ href, className, style, label, children }: {
  href: string; className?: string; style?: React.CSSProperties; label?: string; children: React.ReactNode;
}) {
  return href.startsWith('/')
    ? <Link href={href} className={className} style={style} aria-label={label}>{children}</Link>
    : <a href={href} target="_blank" rel="noreferrer" className={className} style={style} aria-label={label}>{children}</a>;
}

/** A square opening board with its code under it. */
export function BoardTile({ game, size = 128, className = '' }: { game: ApprovedGame; size?: number; className?: string }) {
  const label = labelOf(game);
  return (
    <Link href={playPath(game)} aria-label={`Play ${label}`}
          className={`group block outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E53AA3] ${className}`}>
      <img src={boardImage(game, size)} alt="" width={size} height={size} loading="lazy" decoding="async"
           className="block w-full aspect-square opacity-90 transition-opacity group-hover:opacity-100"
           style={{ imageRendering: 'pixelated', background: '#000' }} />
      <span className="block py-[3px] text-[10.5px] tracking-[.8px] text-[#A8A5A2] group-hover:text-white" style={{ fontFamily: MONO }}>
        {label}
      </span>
    </Link>
  );
}

/** Every approved game, as a wall of boards. Small screens get the first rows and the link to the rest. */
export function BoardWall({ games, loading, columns, phoneLimit }: {
  games: ApprovedGame[]; loading?: boolean; columns: string; phoneLimit?: number;
}) {
  if (loading) {
    return (
      <div className={`grid gap-2 ${columns}`} aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => <div key={i} className="aspect-square animate-pulse" style={{ background: LINE }} />)}
      </div>
    );
  }
  return (
    <div className={`grid gap-x-2 gap-y-1 ${columns}`}>
      {games.map((game, i) => (
        <BoardTile key={game.gameId} game={game} className={phoneLimit !== undefined && i >= phoneLimit ? 'hidden sm:block' : ''} />
      ))}
    </div>
  );
}

/** The opening frame of each level, cut from the catalog's one picture. */
export function LevelStrip({ pick }: { pick: Pick }) {
  return (
    <div role="img" aria-label={`Opening frame of each of ${pick.label}'s levels`}
         className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${pick.levels}, minmax(0, 1fr))` }}>
      {Array.from({ length: pick.levels }, (_, i) => (
        <span key={i} className="block aspect-square" style={{
          backgroundColor: '#000',
          backgroundImage: `url("${pick.levelStrip}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${pick.levels * 100}% 100%`,
          backgroundPosition: `${pick.levels > 1 ? (i / (pick.levels - 1)) * 100 : 0}% 0`,
          imageRendering: 'pixelated',
        }} />
      ))}
    </div>
  );
}

/** Slim top line shared by the pages that lead with the picks: what these are, counts, links. */
export function PicksHeader({ approved }: { approved: number }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 text-[12px]" style={{ fontFamily: MONO }}>
      <h1 className="text-[13px] font-bold tracking-[2px] uppercase" style={{ color: '#E53AA3' }}>Team Turducken · Synthetic ARC-AGI-3 games</h1>
      <span style={{ color: '#A8A5A2' }}>Our best picks{approved > 0 && <> of {approved} approved</>}. Click a card for the rules (spoilers). Play here, no login.</span>
      <span className="flex flex-wrap gap-x-3">
        <Link href="/play" className="font-bold" style={{ color: '#E53AA3' }}>PLAY →</Link>
        <Link href="/arc3/gallery" className="underline">Every game</Link>
        <Link href={WHY_PATH} className="underline">Why</Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline">Source ↗</a>
      </span>
    </div>
  );
}

/** The first sentence of "what is special": all a card face has room for. */
function hook(text = ''): string {
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
}

/** One small card: the opening board, the code, level count and inputs, one line. */
function PickCard({ pick, onOpen }: { pick: Pick; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`${pick.label}: rules and details`}
            className="group flex flex-col justify-start items-stretch h-full w-full p-0 m-0 text-left outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E53AA3]"
            style={{ background: '#1C1B1A', border: `1px solid ${pick.flag ? HOT : LINE}` }}>
      <img src={pick.image} alt="" width={256} height={256} loading="lazy" decoding="async"
           className="block w-full max-w-none h-auto aspect-square" style={{ imageRendering: 'pixelated', background: '#000' }} />
      <span className="block w-full px-2 pt-1.5 pb-2">
        <span className="flex items-baseline justify-between gap-2" style={{ fontFamily: MONO }}>
          <b className="text-[15px] text-white group-hover:text-[#E53AA3]">{pick.label}</b>
          <span className="text-[10px] tracking-[.5px]" style={{ color: '#8E8B88' }}>{pick.levels} LV</span>
        </span>
        <span className="block text-[10px] leading-[1.5] truncate" style={{ color: '#8E8B88', fontFamily: MONO }}>{pick.inputs}</span>
        <span className="mt-1 text-[12px] leading-[1.35] line-clamp-4" style={{ color: '#C9C6C3' }}>{hook(pick.spoiler.special)}</span>
      </span>
    </button>
  );
}

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[10px] font-bold tracking-[1.5px]" style={{ color: HOT, fontFamily: MONO }}>{label}</h3>
      {children}
    </section>
  );
}

/** Everything the catalog says about one game, opened from its card. */
function PickPanel({ pick }: { pick: Pick }) {
  const notes = pick.spoiler;
  return (
    <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="min-w-0">
        <PlayLink href={pick.href} label={`Play ${pick.label}`} className="block">
          <img src={pick.image} alt={`${pick.label} opening board`} width={260} height={260}
               className="block w-full aspect-square" style={{ imageRendering: 'pixelated', background: '#000' }} />
        </PlayLink>
        <div className="mt-2"><LevelStrip pick={pick} /></div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" style={{ color: '#8E8B88', fontFamily: MONO }}>
          <span>{pick.levels} levels · {pick.inputs}</span>
        </div>
        <PlayLink href={pick.href} className="mt-2 block text-center py-2 text-[13px] font-bold tracking-[1px] text-white"
                  style={{ background: HOT, fontFamily: MONO }}>
          PLAY {pick.label} →
        </PlayLink>
      </div>
      <div className="min-w-0 text-[13px] leading-[1.5]" style={{ color: '#D6D3D0' }}>
        {pick.flag && <p className="mb-3 px-3 py-2 text-white" style={{ borderLeft: `3px solid ${HOT}`, background: 'rgba(229,58,163,.1)' }}>{pick.flag}</p>}
        {notes.special && <Part label="WHAT'S SPECIAL"><p className="text-white">{notes.special}</p></Part>}
        {notes.rules && notes.rules.length > 0 && (
          <Part label="THE RULES">
            <ul className="list-disc pl-4 space-y-1 marker:text-[#E53AA3]">{notes.rules.map((rule, i) => <li key={i}>{rule}</li>)}</ul>
          </Part>
        )}
        {notes.vsPublic && <Part label="NOT IN THE PUBLIC 25"><p>{notes.vsPublic}</p></Part>}
        {notes.look && <Part label="THE LOOK"><p>{notes.look}</p></Part>}
        {notes.markSaid && <blockquote className="pl-3 italic" style={{ borderLeft: `3px solid ${HOT}` }}>“{notes.markSaid}” — Mark</blockquote>}
      </div>
    </div>
  );
}

/** The published picks as a dense card grid; a click opens one game's rules and details. */
export function PickGrid({ picks }: { picks: Pick[] }) {
  const [open, setOpen] = useState<Pick | null>(null);
  const flag = picks.find((pick) => pick.flag)?.flag;
  return (
    <>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {picks.map((pick) => <PickCard key={pick.id} pick={pick} onOpen={() => setOpen(pick)} />)}
      </div>
      {flag && <p className="mt-2 px-3 py-2 text-[13px] leading-[1.5]" style={{ color: '#F4F2F0', borderLeft: `3px solid ${HOT}`, background: 'rgba(229,58,163,.1)' }}>{flag}</p>}
      <Dialog open={open !== null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="max-w-[960px] w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto p-4 sm:p-5 rounded-none border-[#2C2B2A]"
                       style={{ background: INK, color: '#F4F2F0' }}>
          {open && <>
            <DialogTitle className="text-[22px] font-bold leading-none pr-10" style={{ fontFamily: MONO }}>{open.label}</DialogTitle>
            <DialogDescription className="sr-only">Rules, what is special and how {open.label} differs from the public 25. Spoilers.</DialogDescription>
            <PickPanel pick={open} />
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
