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
         not in it yet). A pick plays here when the feed has it, and on arc3.sonpham.net when
         it does not. If the catalog can't be reached, the picks vanish and the wall still works.

         No game names, descriptions or rules appear here. Working out the rules is the game.
         Every figure is read from a source at runtime; none is typed in.
SRP/DRY check: Pass - reuses the mirror route, its thumbnails and the published catalog. No
         approval logic lives here: the lab owns approval, the catalog owns the picks.
*/

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { MONO } from '@/pages/arc3-community/landingTheme';

export const WRITEUP_URL = 'https://82deutschmark.github.io/arc3-synthetic-games/';
export const WHY_URL = `${WRITEUP_URL}why.html`;
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
}
interface Catalog { featured: string[]; games: CatalogGame[] }

export interface Pick {
  id: string;
  label: string;
  levels: number;
  human: CatalogGame['human'];
  inputs: string;
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
  return useMemo(() => {
    if (!data) return [];
    const here = new Map(approved.map((g) => [labelOf(g).toLowerCase(), g]));
    return data.featured.flatMap((id) => {
      const game = data.games.find((g) => g.id === id);
      if (!game) return [];
      const local = here.get(id);
      return [{
        id,
        label: id.toUpperCase(),
        levels: game.levels,
        human: game.human,
        inputs: (game.inputs ?? []).map((i) => INPUTS[i]).filter(Boolean).join(' '),
        image: `${WRITEUP_URL}${game.media.play}`,
        levelStrip: `${WRITEUP_URL}${game.media.levels}`,
        href: local ? playPath(local) : game.play,
      }];
    });
  }, [data, approved]);
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

/** One published pick: board, human record, inputs, every level's opening frame. */
export function PickRow({ pick }: { pick: Pick }) {
  return (
    <article className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[132px_minmax(0,1fr)] gap-3 py-3"
             style={{ borderTop: `1px solid ${LINE}` }}>
      <PlayLink href={pick.href} label={`Play ${pick.label}`} className="block">
        <img src={pick.image} alt="" width={132} height={132} loading="lazy" decoding="async"
             className="block w-full aspect-square" style={{ imageRendering: 'pixelated', background: '#000' }} />
      </PlayLink>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <PlayLink href={pick.href} className="text-[20px] font-bold leading-none text-white hover:underline" style={{ fontFamily: MONO }}>
            {pick.label}
          </PlayLink>
          <PlayLink href={pick.href} label={`Play ${pick.label}`} className="text-[11px] font-bold tracking-[1px]" style={{ color: HOT, fontFamily: MONO }}>
            PLAY →
          </PlayLink>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 mb-2 text-[12px] leading-[1.45]" style={{ color: '#C9C6C3' }}>
          <dt className="text-[10px] tracking-[1px] leading-[17px]" style={{ color: '#8E8B88', fontFamily: MONO }}>HUMAN</dt>
          {/* A dash is the write-up's own convention: no person's play is on record yet. */}
          <dd>{pick.human ? `${pick.human.actions} actions, ${pick.human.levels}/${pick.levels} levels` : '—'}</dd>
          <dt className="text-[10px] tracking-[1px] leading-[17px]" style={{ color: '#8E8B88', fontFamily: MONO }}>INPUTS</dt>
          <dd>{pick.inputs || '—'}</dd>
        </dl>
        <LevelStrip pick={pick} />
      </div>
    </article>
  );
}
