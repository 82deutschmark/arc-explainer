/*
Author: Claude Opus 5
Date: 2026-08-30
PURPOSE: The blind task grid — arc3.markbarney.net's play surface. Every tile is one
         ARC-AGI-3 task, shown as its own opening frame and nothing else.

         2026-08-30 rewrite: the catalog now comes from /api/arc3-mirror/games, which
         mirrors arc3.sonpham.net (the source of truth for the synthetic programme) and
         strips every mechanic-naming field upstream of this component. The page it
         replaces read a DB-backed community catalog that had drifted months stale — 66
         rows covering ~40 games, against 300 upstream, with 13 duplicate rows for one
         game and a "ARC Prize Foundation — 3 tasks" section over 3 of 25.

         NO-SPOILER RULE. A player is meant to infer the rules, the controls and the goal
         from the frame; anything that names the mechanic turns their run into worthless
         baseline data. This page therefore renders no title, no description and no tags.
         The previous version passed `title={game.displayName}` as a hover tooltip, which
         handed "Light Bender" to anyone who rested a cursor on a tile — that is removed
         and must not come back. Category headings ("Official", "Community") stay: they
         name provenance, not play.

         The frame itself is safe and is the point: it is exactly what a player sees on
         starting, rendered server-side from a single RESET.
SRP/DRY check: Pass — presentation only; fetching/stripping lives in Arc3MirrorCatalog,
         and this reuses Arc3PixelPage + SpriteMosaic rather than adding new primitives.
*/

import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Arc3PixelPage, SpriteMosaic } from '@/components/arc3-community/Arc3PixelUI';

/** Mirrors MirroredGame in server/services/arc3Mirror/Arc3MirrorCatalog.ts. */
interface MirroredGame {
  gameId: string;
  className: string;
  category: 'official' | 'custom' | 'redbluepill';
  official: boolean;
  defaultFps: number;
  tileScale: number;
}

interface GamesResponse {
  success: boolean;
  data: { games: MirroredGame[]; total: number };
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

/**
 * Section headings name where a task came from, never what it does. Upstream's own
 * category slugs leak nothing, but "redbluepill" is a repo name rather than English.
 */
const SECTIONS: { key: MirroredGame['category']; label: string; note: string }[] = [
  { key: 'official', label: 'ARC Prize Foundation', note: 'The official ARC-AGI-3 set.' },
  { key: 'custom', label: 'Built in-house', note: 'Made by us and by Son Pham.' },
  { key: 'redbluepill', label: 'Community catalog', note: 'Contributed tasks.' },
];

const PAGE_SIZE = 60;

/** Stable per-game seed so a task's fallback sprite never changes between visits. */
function seedFor(gameId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < gameId.length; i++) {
    hash ^= gameId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function TaskCell({ game, index, onPlay }: {
  game: MirroredGame;
  index: number;
  onPlay: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      onClick={onPlay}
      className="group block text-left w-full"
      /* No `title` attribute. A tooltip is a spoiler surface like any other. */
      aria-label={`Play task ${game.gameId}`}
    >
      <div
        className="relative aspect-square overflow-hidden transition-colors"
        style={{ background: ARC.cell, border: `1px solid ${ARC.cellBorder}` }}
      >
        {/* The task's own opening frame, rendered server-side from a single RESET. If
            rendering fails the deterministic sprite stands in so the grid never holes. */}
        {broken ? (
          <SpriteMosaic
            seed={seedFor(game.gameId)}
            width={8}
            height={8}
            className="!border-0 !shadow-none w-full h-full opacity-40"
          />
        ) : (
          <img
            src={`/api/arc3-mirror/games/${encodeURIComponent(game.gameId)}/thumbnail?size=256`}
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
        className="flex items-center px-2 py-1"
        style={{ background: index % 2 === 0 ? ARC.pink : ARC.pinkAlt }}
      >
        <span className="text-[11px] tracking-[.55px] text-white truncate">
          {game.gameId}
        </span>
      </div>
    </button>
  );
}

export default function CommunityGallery() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, isError } = useQuery<GamesResponse>({
    queryKey: ['/api/arc3-mirror/games'],
    // The catalog is one upstream fetch behind a 5-minute server cache; re-fetching it
    // on every window focus buys nothing and costs a round trip on a page that is mostly
    // images.
    staleTime: 5 * 60 * 1000,
  });

  const games = useMemo(() => data?.data?.games ?? [], [data]);

  /* Search matches the id only. There is nothing else to match on, by design. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.gameId.toLowerCase().includes(q));
  }, [games, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Counts come from `filtered`, not `visible`. Sectioning the current page and then
  // counting it reports "how many of this category landed on page 1" -- which is how the
  // old page came to announce "ARC Prize Foundation - 3 tasks" over a set of 25.
  const sections = SECTIONS
    .map((s) => ({
      ...s,
      games: visible.filter((g) => g.category === s.key),
      total: filtered.filter((g) => g.category === s.key).length,
    }))
    .filter((s) => s.games.length > 0);

  return (
    <Arc3PixelPage vars={{ '--arc3-bg': ARC.ground }}>
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-[13px] tracking-[3px] uppercase mb-2" style={{ color: ARC.text }}>
            ARC-AGI-3 tasks
          </h1>
          <p className="text-[13px] leading-relaxed max-w-[64ch]" style={{ color: ARC.dim }}>
            Pick one and work out what it does. You are not told the rules, the controls or
            the goal — that is the experiment. Nothing here is timed and there is no score
            to beat.
          </p>
        </header>

        <div className="flex items-center gap-2 mb-8 max-w-[360px]">
          <div className="relative flex-1">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: ARC.faint }}
            />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Filter by task id…"
              className="w-full bg-transparent pl-7 pr-2 py-1.5 text-[12px] outline-none"
              style={{ border: `1px solid ${ARC.control}`, color: ARC.text }}
            />
          </div>
          <span className="text-[11px] shrink-0" style={{ color: ARC.faint }}>
            {filtered.length}
          </span>
        </div>

        {isLoading && (
          <p className="text-[12px]" style={{ color: ARC.faint }}>Loading tasks…</p>
        )}

        {isError && (
          <p className="text-[12px]" style={{ color: ARC.pink }}>
            The task catalog is unreachable right now. Try again in a moment.
          </p>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-[12px]" style={{ color: ARC.faint }}>No task ids match that filter.</p>
        )}

        {sections.map((section) => (
          <section key={section.key} className="mb-10">
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-[12px] tracking-[2px] uppercase" style={{ color: ARC.text }}>
                {section.label}
              </h2>
              <span className="text-[11px]" style={{ color: ARC.faint }}>
                {section.games.length < section.total
                  ? `${section.games.length} of ${section.total}`
                  : section.total}
              </span>
            </div>
            <p className="text-[11px] mb-3" style={{ color: ARC.faint }}>{section.note}</p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {section.games.map((game, i) => (
                <TaskCell
                  key={game.gameId}
                  game={game}
                  index={i}
                  onPlay={() => setLocation(`/arc3/play/${game.gameId}`)}
                />
              ))}
            </div>
          </section>
        ))}

        {pageCount > 1 && (
          <div className="flex items-center gap-4 text-[11px]" style={{ color: ARC.dim }}>
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="disabled:opacity-30 px-2 py-1"
              style={{ border: `1px solid ${ARC.control}` }}
            >
              ‹ Prev
            </button>
            <span>
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <button
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="disabled:opacity-30 px-2 py-1"
              style={{ border: `1px solid ${ARC.control}` }}
            >
              Next ›
            </button>
          </div>
        )}

        <footer className="mt-12 pt-6 text-[11px]" style={{ borderTop: `1px solid ${ARC.cellBorder}`, color: ARC.faint }}>
          Tasks mirrored from{' '}
          <a href="https://arc3.sonpham.net" className="underline" style={{ color: ARC.dim }}>
            arc3.sonpham.net
          </a>
          , the source of truth for the synthetic ARC-AGI-3 programme.
        </footer>
      </div>
    </Arc3PixelPage>
  );
}
