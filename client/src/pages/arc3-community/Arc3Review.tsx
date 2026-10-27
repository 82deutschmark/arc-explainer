/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Send the existing Play entrance to a current approved game, preferring unplayed ones.
 * SRP/DRY check: Pass — reuses the approved mirror and existing anonymous human-play statistics.
 */
import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

export default function Arc3Review() {
  const [, setLocation] = useLocation();
  const catalog = useQuery<{ data: { games: { gameId: string }[] } }>({
    queryKey: ['/api/arc3-mirror/games?collection=trainable'], staleTime: 5 * 60 * 1000,
  });
  const stats = useQuery<{ data: { games: { game_id: string }[] } }>({
    queryKey: ['/api/arc3-play/human-stats'], staleTime: 60 * 1000, retry: false,
  });
  const target = useMemo(() => {
    const games = catalog.data?.data.games ?? [];
    const played = new Set((stats.data?.data.games ?? []).map(g => g.game_id));
    return (games.find(g => !played.has(g.gameId)) ?? games[0])?.gameId;
  }, [catalog.data, stats.data]);
  useEffect(() => {
    if (target && !stats.isLoading) setLocation(`/arc3/play/${target}`, { replace: true });
  }, [target, stats.isLoading, setLocation]);
  return <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a0a0c] text-[#e8e6e3] px-6">
    <h1 className="text-xl">Play an ARC-AGI-3 game</h1>
    <p>{catalog.isError ? 'The catalog is unavailable. Please try again shortly.' : catalog.isLoading || target ? 'Finding a game…' : 'No approved games are available right now.'}</p>
    <a href="/arc3/gallery" className="underline text-[#e0218a]">Browse the games</a>
  </main>;
}
