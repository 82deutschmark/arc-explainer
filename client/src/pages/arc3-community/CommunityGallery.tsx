/**
 * Author: Claude Opus 5.5 High; GPT-6 / Codex
 * Date: 2026-11-01
 * PURPOSE: Every approved synthetic game, through the existing public player: the published picks
 *          first, then the searchable wall at a size where the boards can be read.
 * SRP/DRY check: Pass — all game data and tiles come from components/arc3/SyntheticGames; no local approval rules.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { Arc3PixelPage } from '@/components/arc3-community/Arc3PixelUI';
import { BoardWall, PickRow, REPO_URL, WHY_PATH, labelOf, useApprovedGames, usePicks } from '@/components/arc3/SyntheticGames';

export default function CommunityGallery() {
  const [search, setSearch] = useState('');
  const { games, isLoading, isError } = useApprovedGames();
  const picks = usePicks(games);
  const needle = search.trim().toLowerCase();
  const filtered = games.filter(g => `${labelOf(g)} ${g.gameId}`.toLowerCase().includes(needle));
  return <Arc3PixelPage>
    <main className="max-w-[1180px] mx-auto px-4 sm:px-5 py-10 text-[#E3E1DF]">
      <header className="mb-10 max-w-[62ch]">
        <p className="text-[11px] tracking-[3px] uppercase mb-4 text-[#E53AA3]">Team Turducken · Synthetic ARC-AGI-3 games</p>
        <h1 className="text-[36px] sm:text-[48px] leading-[1.05] font-bold tracking-[-1px] mb-4">Pick a board. Work out the rules.</h1>
        <p className="text-[#C9C6C3] leading-[1.7]">No instructions and no login. Coding agents built these; a person playing decided which were worth keeping.</p>
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href="/play" className="px-5 py-2.5 font-semibold bg-[#E53AA3] text-white">Play a game →</Link>
          <Link href={WHY_PATH} className="underline">Why these exist</Link>
          <Link href="/home" className="underline">ARC-3 resource hub</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline">Source ↗</a>
        </p>
      </header>
      {picks.length > 0 && !needle && <section className="mb-12">
        <h2 className="text-[11px] tracking-[2.5px] uppercase mb-3">The picks</h2>
        <div className="grid gap-x-8 lg:grid-cols-2">{picks.map(pick => <PickRow key={pick.id} pick={pick} />)}</div>
      </section>}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
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
