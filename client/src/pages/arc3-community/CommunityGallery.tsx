/**
 * Author: Claude Opus 5.5 High; GPT-6 / Codex
 * Date: 2026-11-01
 * PURPOSE: Every approved synthetic game, through the existing public player: the published picks
 *          first, then the searchable wall at a size where the boards can be read.
 * Updated: 2026-11-02, Claude Opus 5.5 High — slim one-line header; the picks as a dense card grid, click for rules.
 * SRP/DRY check: Pass — all game data and tiles come from components/arc3/SyntheticGames; no local approval rules.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { Arc3PixelPage } from '@/components/arc3-community/Arc3PixelUI';
import { BoardWall, PickGrid, PicksHeader, labelOf, useApprovedGames, usePicks } from '@/components/arc3/SyntheticGames';

export default function CommunityGallery() {
  const [search, setSearch] = useState('');
  const { games, isLoading, isError } = useApprovedGames();
  const picks = usePicks(games);
  const needle = search.trim().toLowerCase();
  const filtered = games.filter(g => `${labelOf(g)} ${g.gameId}`.toLowerCase().includes(needle));
  return <Arc3PixelPage>
    <main className="max-w-[1180px] mx-auto px-4 sm:px-5 pt-3 pb-10 text-[#E3E1DF]">
      <PicksHeader approved={games.length} />
      {picks.length > 0 && !needle && <section className="mb-6"><PickGrid picks={picks} /></section>}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <h2 className="text-[11px] tracking-[2.5px] uppercase">
            Every approved game{!isLoading && !isError && <span className="text-[#9A9694]"> · {filtered.length} of {games.length}</span>}
          </h2>
          <label className="block text-xs text-[#9A9694]"><span className="sr-only">Find a game by ID</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              className="block px-3 py-2 bg-[#191919] border border-[#393736] text-white w-56" placeholder="Find a game by ID" />
          </label>
        </div>
        {isError
          ? <p role="alert">The game catalog is unavailable. Please try again shortly.</p>
          : <BoardWall games={filtered} loading={isLoading} columns="grid-cols-3 sm:grid-cols-5 lg:grid-cols-8" />}
        {!isLoading && !isError && !filtered.length && <p className="mt-4">No games match this selection.</p>}
      </section>
      <footer className="mt-10 text-sm text-[#9A9694]">
        <Link href="/arc3/games" className="underline">Official game guides (spoilers)</Link>{' · '}
        <a href="https://arc3.sonpham.net" className="underline">Research lab</a>
      </footer>
    </main>
  </Arc3PixelPage>;
}
