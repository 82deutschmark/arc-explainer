/*
Author: Cascade (Claude Sonnet 4) / Claude Opus 5
Date: 2026-01-31 / 2026-08-28
PURPOSE: Task gallery for the ARC-AGI-3 community set, and the site's landing page.
         2026-08-28 rewrite: presentation now follows the official ARC-AGI-3 task list at
         arcprize.org — near-black ground, dense grid of square task cells, magenta id
         labels, monospace throughout. Colour and geometry are taken from that site's
         computed styles rather than eyeballed, and match the sibling catalog in
         sonpham-org/autoresearch-arena so the two surfaces read as one system.
         The previous card layout printed each game's description on the tile
         ("Rail-switching train routing", "Shape-matching navigation puzzle"), which
         states the mechanic. ARC-AGI-3's premise is that the mechanic is discovered from
         the frame, so a player who reads the tile has been handed the answer and their
         run is worthless as a human baseline. Tiles now carry an id, a deterministic
         sprite and the level count — nothing that describes play.
         Data flow, search, sort, author grouping and navigation are unchanged.
SRP/DRY check: Pass — presentation-only rewrite of this page; reuses Arc3PixelPage and
         SpriteMosaic from components/arc3-community/Arc3PixelUI rather than adding
         new primitives, and the query/// routing behaviour is untouched.
*/

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Search, Upload } from 'lucide-react';
import { Arc3PixelPage, SpriteMosaic } from '@/components/arc3-community/Arc3PixelUI';

interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  playCount: number;
  levelCount: number | null;
  tags: string[];
  uploadedAt: string;
}

interface GamesResponse {
  success: boolean;
  data: {
    games: CommunityGame[];
    total: number;
    limit: number;
    offset: number;
  };
}

/* Official ARC-AGI-3 task-page palette (measured from arcprize.org computed styles). */
const ARC = {
  ground: '#0E0C0C',
  text: '#E3E1DF',
  dim: '#9A9694',
  faint: '#6E6A68',
  cell: '#191919',
  cellBorder: '#262626',
  pink: '#E53AA3',
  pinkAlt: '#C42F89',
  control: '#393736',
};

/** Stable per-game seed so a task's sprite never changes between visits. */
function seedFor(gameId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < gameId.length; i++) {
    hash ^= gameId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function TaskCell({ game, index, onPlay }: {
  game: CommunityGame;
  index: number;
  onPlay: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      onClick={onPlay}
      className="group block text-left w-full"
      /* displayName is a name, not a rule, so it is safe as a tooltip. The description
         is not, and is deliberately never rendered here. */
      title={game.displayName}
    >
      <div
        className="relative aspect-square overflow-hidden transition-colors"
        style={{ background: ARC.cell, border: `1px solid ${ARC.cellBorder}` }}
      >
        {/* The tile is the task's own opening frame, rendered server-side from a single
            RESET. A frame is not a spoiler — it is exactly what a player sees on
            starting, and it is what makes the grid readable at a glance. If rendering
            fails the deterministic sprite stands in so the grid never shows a hole. */}
        {broken ? (
          <SpriteMosaic
            seed={seedFor(game.gameId)}
            width={8}
            height={8}
            className="!border-0 !shadow-none w-full h-full opacity-40"
          />
        ) : (
          <img
            src={`/api/arc3-community/games/${encodeURIComponent(game.gameId)}/thumbnail?size=256`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
            /* Pixel grids must not be smoothed. */
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />
        )}
        {/* CRT scanlines, matching the official task screen treatment. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.38) 2px 4px)',
          }}
        />
      </div>
      <div
        className="flex items-center justify-between gap-2 px-2 py-1"
        style={{ background: index % 2 === 0 ? ARC.pink : ARC.pinkAlt }}
      >
        <span className="text-[11px] tracking-[.55px] text-white truncate">
          {game.gameId}
        </span>
        {game.levelCount ? (
          <span className="text-[10px] text-white/75 shrink-0">{game.levelCount}L</span>
        ) : null}
      </div>
    </button>
  );
}

function TaskSection({ title, games, startIndex, onPlay }: {
  title: string;
  games: CommunityGame[];
  startIndex: number;
  onPlay: (gameId: string) => void;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-[12px] tracking-[2px] uppercase" style={{ color: ARC.text }}>
          {title}
        </h2>
        <span className="text-[11px]" style={{ color: ARC.faint }}>
          {games.length} {games.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
        {games.map((game, i) => (
          <TaskCell
            key={game.gameId}
            game={game}
            index={startIndex + i}
            onPlay={() => onPlay(game.gameId)}
          />
        ))}
      </div>
    </section>
  );
}

export default function CommunityGallery() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState<string>('playCount');

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  queryParams.set('orderBy', orderBy);
  queryParams.set('orderDir', 'DESC');
  // The set is already larger than the old 50 cap, and this page is the site's front
  // door — a silently truncated list reads as "that is all of them".
  queryParams.set('limit', '250');

  const { data, isLoading } = useQuery<GamesResponse>({
    queryKey: [`/api/arc3-community/games?${queryParams.toString()}`],
  });

  const games = data?.data?.games || [];
  const total = data?.data?.total || 0;

  const arcPrizeGames = games.filter((g) => g.authorName === 'ARC Prize Foundation');
  const teamGames = games.filter((g) => g.authorName !== 'ARC Prize Foundation');

  return (
    <Arc3PixelPage>
      <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh' }}
           className="font-mono">
        <div className="max-w-[1180px] mx-auto px-5 py-6">

          {/* Breadcrumb, matching the official task page furniture. */}
          <div className="flex items-start justify-between gap-5 mb-8">
            <div className="text-[13px] leading-[1.7] tracking-[.4px]">
              <div>
                <span className="underline">ALL TASKS</span>
                <span className="mx-2 opacity-50">|</span>
                {total} TASK{total === 1 ? '' : 'S'}
              </div>
              <div>DATASET: ARC-AGI-3 COMMUNITY SET</div>
            </div>
            <button
              onClick={() => setLocation('/arc3/upload')}
              className="flex items-center gap-2 px-4 h-[34px] text-[11px] tracking-[.5px] rounded-[4px] shrink-0"
              style={{ background: ARC.control, color: ARC.text }}
            >
              <Upload className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>

          <p className="text-[12px] leading-[1.9] max-w-[62ch] mb-6" style={{ color: ARC.dim }}>
            Pick a task and work out what it does. You are not told the rules, the controls
            or the goal — that is the experiment.
          </p>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                      style={{ color: ARC.faint }} />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 h-[34px] text-[12px] rounded-[4px] focus:outline-none"
                style={{ background: ARC.cell, color: ARC.text, border: `1px solid ${ARC.cellBorder}` }}
              />
            </div>
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="h-[34px] px-2 text-[12px] rounded-[4px] focus:outline-none"
              style={{ background: ARC.cell, color: ARC.text, border: `1px solid ${ARC.cellBorder}` }}
            >
              <option value="playCount">Most played</option>
              <option value="uploadedAt">Newest</option>
              <option value="displayName">Name</option>
            </select>
          </div>

          {isLoading ? (
            <p className="text-[12px] py-10" style={{ color: ARC.faint }}>Loading tasks…</p>
          ) : games.length === 0 ? (
            <div className="py-10">
              <p className="text-[13px] mb-4" style={{ color: ARC.faint }}>
                {search ? 'No tasks match that search.' : 'No tasks available yet.'}
              </p>
              <Link href="/arc3/upload">
                <span className="text-[12px] underline cursor-pointer">Submit the first one</span>
              </Link>
            </div>
          ) : (
            <>
              <TaskSection
                title="ARC Prize Foundation"
                games={arcPrizeGames}
                startIndex={0}
                onPlay={(id) => setLocation(`/arc3/play/${id}`)}
              />
              <TaskSection
                title="Community"
                games={teamGames}
                startIndex={arcPrizeGames.length}
                onPlay={(id) => setLocation(`/arc3/play/${id}`)}
              />
            </>
          )}

          <footer className="pt-4 text-[11px] leading-[1.9]" style={{ color: ARC.faint }}>
            <Link href="/arc3"><span className="underline cursor-pointer">ARC-AGI-3 reference</span></Link>
            <span className="mx-2 opacity-50">·</span>
            <Link href="/home"><span className="underline cursor-pointer">ARC Explainer</span></Link>
          </footer>
        </div>
      </div>
    </Arc3PixelPage>
  );
}
