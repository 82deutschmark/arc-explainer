/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Browse the lab's current Trainable games through the existing public player.
 * SRP/DRY check: Pass — existing mirror, recorded PNGs and Arc3PixelPage; no local approval rules.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Arc3PixelPage } from '@/components/arc3-community/Arc3PixelUI';

interface Game { gameId: string; label?: string }
export default function CommunityGallery() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery<{ data: { games: Game[] } }>({
    queryKey: ['/api/arc3-mirror/games?collection=trainable'], staleTime: 5 * 60 * 1000,
  });
  const games = data?.data.games ?? [];
  const filtered = games.filter(g => `${g.label || ''} ${g.gameId}`.toLowerCase().includes(search.toLowerCase()));
  return <Arc3PixelPage>
    <main className="max-w-6xl mx-auto px-4 py-10 text-[#E3E1DF]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-3">Play ARC-AGI-3 games</h1>
        <p className="text-[#9A9694] max-w-2xl">Original reasoning games selected through human review. Pick a board and discover its rules as you play. No login required.</p>
        <p className="mt-4"><a href="/play" className="text-[#E53AA3] underline">Play a game →</a>{' · '}
          <a href="/arc3" className="underline">How ARC-AGI-3 works</a></p>
      </header>
      <label className="block mb-6 text-sm">Find a game by ID
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          className="block mt-2 px-3 py-2 bg-[#191919] border border-[#393736] text-white w-full max-w-sm"
          placeholder="Game ID" />
      </label>
      {isLoading && <p>Loading games…</p>}
      {isError && <p role="alert">The game catalog is unavailable. Please try again shortly.</p>}
      {!isLoading && !isError && <p className="text-sm text-[#9A9694] mb-4">{filtered.length} of {games.length} games</p>}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
        {filtered.map(g => <a key={g.gameId} href={`/arc3/play/${g.gameId}`} aria-label={`Play ${g.label || g.gameId}`}
          className="block border border-[#262626] hover:border-[#E53AA3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E53AA3]">
          <img src={`/api/arc3-mirror/games/${g.gameId}/thumbnail?size=256`}
            alt={`${g.label || g.gameId} opening board`} width={256} height={256} loading="lazy"
            className="block w-full aspect-square object-contain bg-[#191919] [image-rendering:pixelated]" />
          <span className="block px-2 py-1 text-xs bg-[#E53AA3] text-white">{g.label || g.gameId}</span>
        </a>)}
      </div>
      {!isLoading && !isError && !filtered.length && <p className="mt-4">No games match this selection.</p>}
      <footer className="mt-10 text-sm text-[#9A9694]">
        <a href="/arc3/games" className="underline">Official game guides (spoilers)</a>{' · '}
        <a href="https://arc3.sonpham.net" className="underline">Research lab</a>
      </footer>
    </main>
  </Arc3PixelPage>;
}
