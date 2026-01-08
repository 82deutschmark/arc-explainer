/**
 * Author: Codex (GPT-5)
 * Date: 2026-01-08T19:34:00Z
 * PURPOSE: Minimal visual landing page with rotating ARC 1&2 GIFs and ARC-3 canvas replays.
 *          Left: rotating ARC 1&2 puzzle GIFs. Right: ARC-3 canvas player rotating non-problem games.
 *          No descriptive text - just visual showcase with placeholder labels per owner request.
 * SRP/DRY check: Pass - single-page hero composition utilizing reusable canvas replay component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';

import { cn } from '@/lib/utils';
import ARC3CanvasPlayer from '@/components/ARC3CanvasPlayer';
import WormArenaLandingReplay from '@/components/WormArenaLandingReplay';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';

const ROTATION_INTERVAL_MS = 4500;
const WORM_ROTATION_INTERVAL_MS = 6000;

const PUZZLE_GIF_GALLERY = [
  { id: '2bee17df', file: 'arc_puzzle_2bee17df_fringes.gif', label: 'Fringes' },
  { id: '3de23699', file: 'arc_puzzle_3de23699_invertandzoom.gif', label: 'Invert & Zoom' },
  { id: '3e980e27', file: 'arc_puzzle_3e980e27_spritefulsky.gif', label: 'Spriteful Sky' },
  { id: '3eda0437', file: 'arc_puzzle_3eda0437_biggestgap.gif', label: 'Biggest Gap' },
  { id: '4be741c5', file: 'arc_puzzle_4be741c5_wetpaint.gif', label: 'Wet Paint' },
  { id: '4c5c2cf0', file: 'arc_puzzle_4c5c2cf0_crablegs.gif', label: 'Crab Legs' },
  { id: '3f7978a0', file: 'arc_puzzle_3f7978a0_glowsticks.gif', label: 'Glowsticks' },
  { id: '6c434453', file: 'arc_puzzle_6c434453_boxtoplus.gif', label: 'Box to Plus' },
  { id: '6d0aefbc', file: 'arc_puzzle_6d0aefbc_fliphoriz.gif', label: 'Flip Horiz' },
  { id: '6d75e8bb', file: 'arc_puzzle_6d75e8bb_velcro.gif', label: 'Velcro' },
  { id: '6d0160f0', file: 'arc_puzzle_6d0160f0_unoamarillo.gif', label: 'Uno Amarillo' },
  { id: '6e4f6532', file: 'arc_puzzle_6e4f6532.gif', label: 'Specter' },
  { id: '6e82a1ae', file: 'arc_puzzle_6e82a1ae_twothreefour.gif', label: 'Two Three Four' },
  { id: '6e19193c', file: 'arc_puzzle_6e19193c_arrows.gif', label: 'Arrows' },
  { id: '7b7f7511', file: 'arc_puzzle_7b7f7511_half.gif', label: 'Half' },
  { id: '7b0280bc', file: 'arc_puzzle_7b0280bc.gif', label: 'Static Fold' },
  { id: '7ddcd7ec', file: 'arc_puzzle_7ddcd7ec_webslinger.gif', label: 'Web Slinger' },
  { id: '7e0986d6', file: 'arc_puzzle_7e0986d6_destatic2.gif', label: 'De-Static' },
  { id: '7fe24cdd', file: 'arc_puzzle_7fe24cdd_pinwheel2.gif', label: 'Pinwheel' },
  { id: '8d5021e8', file: 'arc_puzzle_8d5021e8_sixfold.gif', label: 'Sixfold' },
  { id: '8d510a79', file: 'arc_puzzle_8d510a79_groundsky.gif', label: 'Ground / Sky' },
  { id: '10fcaaa3', file: 'arc_puzzle_10fcaaa3_quadcopter.gif', label: 'Quadcopter' },
] satisfies ReadonlyArray<{ id: string; file: string; label: string }>;

// Game ID to informal name mapping (e.g., 'ls20' -> 'Locksmith')
const ARC3_GAME_NAMES: Record<string, string> = {
  ls20: 'Locksmith',
  sp80: 'Streaming Purple',
  vc33: 'Volume Control',
  as66: 'Always Sliding',
  ft09: 'Functional Tiles',
  lp85: 'Loop and Pull',
};

const ARC3_CANVAS_REPLAYS = [
  {
    gameId: 'ls20',
    shortId: 'ls20-fa137e247ce6',
    replayPath: '/replays/ls20-fa137e247ce6.7405808f-ec5b-4949-a252-a1451b946bae.jsonl',
  },
  {
    gameId: 'vc33',
    shortId: 'vc33-6ae7bf49eea5',
    replayPath: '/replays/vc33-6ae7bf49eea5.29409ce8-c164-447e-8810-828b96fa4ceb.jsonl',
  },
  {
    gameId: 'ft09',
    shortId: 'ft09-b8377d4b7815',
    replayPath: '/replays/ft09-b8377d4b7815.39b51ef3-b565-43fe-b3a8-7374ca4c5058.jsonl',
  },
  {
    gameId: 'lp85',
    shortId: 'lp85-d265526edbaa',
    replayPath: '/replays/lp85-d265526edbaa.dc3d96aa-762b-4c2e-ac68-6418c8f54c74.jsonl',
  },
] as const;

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReplayIndex, setActiveReplayIndex] = useState(0);
  const [activeWormIndex, setActiveWormIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeReplay = ARC3_CANVAS_REPLAYS[activeReplayIndex];
  const {
    games: wormGreatestHits,
    isLoading: wormHitsLoading,
    error: wormHitsError,
  } = useWormArenaGreatestHits(3);
  const [wormReplayMap, setWormReplayMap] = useState<Record<string, any>>({});
  const [wormReplayErrorMap, setWormReplayErrorMap] = useState<Record<string, string>>({});
  const [wormReplayLoadingMap, setWormReplayLoadingMap] = useState<Record<string, boolean>>({});
  const activeWormGame = wormGreatestHits[activeWormIndex];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || PUZZLE_GIF_GALLERY.length < 2 || prefersReducedMotion) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PUZZLE_GIF_GALLERY.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextIndex = (activeIndex + 1) % PUZZLE_GIF_GALLERY.length;
    const nextGif = PUZZLE_GIF_GALLERY[nextIndex];
    const image = new Image();
    image.src = `/images/decoration/${nextGif.file}`;
  }, [activeIndex]);

  const activeGif = PUZZLE_GIF_GALLERY[activeIndex];
  const handleReplayComplete = React.useCallback(() => {
    setActiveReplayIndex((prev) => (prev + 1) % ARC3_CANVAS_REPLAYS.length);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || wormGreatestHits.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveWormIndex((prev) => (prev + 1) % wormGreatestHits.length);
    }, WORM_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, wormGreatestHits.length]);

  useEffect(() => {
    setActiveWormIndex(0);
  }, [wormGreatestHits.length]);

  useEffect(() => {
    const gameId = activeWormGame?.gameId;
    if (!gameId || wormReplayMap[gameId] || wormReplayLoadingMap[gameId]) {
      return;
    }

    setWormReplayLoadingMap((prev) => ({ ...prev, [gameId]: true }));
    fetch(`/api/snakebench/games/${encodeURIComponent(gameId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!json?.success || !json?.data) {
          throw new Error(json?.error || 'Replay unavailable');
        }
        setWormReplayMap((prev) => ({ ...prev, [gameId]: json.data }));
        setWormReplayErrorMap((prev) => ({ ...prev, [gameId]: '' }));
      })
      .catch((err: any) => {
        setWormReplayErrorMap((prev) => ({
          ...prev,
          [gameId]: err?.message || 'Failed to load replay',
        }));
      })
      .finally(() => {
        setWormReplayLoadingMap((prev) => ({ ...prev, [gameId]: false }));
      });
  }, [activeWormGame, wormReplayLoadingMap, wormReplayMap]);

  const wormReplayData = activeWormGame ? wormReplayMap[activeWormGame.gameId] : null;
  const wormReplayLoading = useMemo(() => {
    if (!activeWormGame) return wormHitsLoading;
    return (
      wormHitsLoading ||
      Boolean(wormReplayLoadingMap[activeWormGame.gameId]) ||
      (!wormReplayData && !wormReplayErrorMap[activeWormGame.gameId])
    );
  }, [activeWormGame, wormHitsLoading, wormReplayData, wormReplayErrorMap, wormReplayLoadingMap]);
  const wormReplayError = activeWormGame
    ? wormReplayErrorMap[activeWormGame.gameId] || wormHitsError
    : wormHitsError;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-purple-900/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />

      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-16 md:grid-cols-2 lg:grid-cols-3">
        {/* Left: ARC 1&2 GIF showcase */}
        <div className="flex flex-col gap-4">
          <div className="space-y-1 text-slate-100">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400">
              ARC 1 & 2
            </p>
            <p className="text-lg font-semibold tracking-wide">{activeGif.label}</p>
          </div>
          <Link href={`/task/${activeGif.id}`}>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02]">
              <div className="relative aspect-square p-6">
                {PUZZLE_GIF_GALLERY.map((gif, index) => (
                  <img
                    key={gif.id}
                    src={`/images/decoration/${gif.file}`}
                    alt={`ARC puzzle ${gif.label}`}
                    className={cn(
                      'absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] object-contain transition-opacity duration-700',
                      index === activeIndex ? 'opacity-100' : 'opacity-0'
                    )}
                    loading={index === activeIndex ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
            </div>
          </Link>
        </div>

        {/* Right: ARC-3 canvas replay */}
        <div className="flex flex-col gap-4">
          <div className="space-y-1 text-slate-100">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-indigo-300/80">
              ARC 3
            </p>
            <p className="text-lg font-semibold tracking-wide">
              {`${activeReplay.gameId.toUpperCase()} - ${ARC3_GAME_NAMES[activeReplay.gameId]}`}
            </p>
          </div>
          <Link href="/arc3/games">
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900/60 via-indigo-900/50 to-purple-900/60 p-1 shadow-[0_0_40px_rgba(99,102,241,0.2)] backdrop-blur-sm transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(99,102,241,0.4)]">
              <ARC3CanvasPlayer
                key={activeReplay.gameId}
                replayPath={activeReplay.replayPath}
                gameLabel={`${activeReplay.gameId.toUpperCase()} - ${ARC3_GAME_NAMES[activeReplay.gameId]}`}
                shortId={activeReplay.shortId}
                autoPlay={!prefersReducedMotion}
                onReplayComplete={handleReplayComplete}
              />
            </div>
          </Link>
        </div>

        {/* Worm Arena replay */}
        <div className="flex flex-col gap-4">
          <div className="space-y-1 text-slate-100">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-amber-200/70">
              Worm Arena
            </p>
            <p className="text-lg font-semibold tracking-wide">
              {activeWormGame
                ? `${activeWormGame.modelA ?? 'Model A'} vs ${activeWormGame.modelB ?? 'Model B'}`
                : 'Curated Matches'}
            </p>
          </div>
          {activeWormGame ? (
            <Link href={`/worm-arena?gameId=${encodeURIComponent(activeWormGame.gameId)}`}>
              <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-700/60 via-amber-900/60 to-black p-1 shadow-[0_0_40px_rgba(251,191,36,0.3)] backdrop-blur-sm transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(251,191,36,0.45)]">
                <WormArenaLandingReplay
                  key={activeWormGame.gameId}
                  game={activeWormGame}
                  replayData={wormReplayData}
                  isLoading={wormReplayLoading}
                  error={wormReplayError}
                  autoPlay={!prefersReducedMotion}
                  onReplayComplete={() => {
                    if (wormGreatestHits.length > 1) {
                      setActiveWormIndex((prev) => (prev + 1) % wormGreatestHits.length);
                    }
                  }}
                />
              </div>
            </Link>
          ) : (
            <div className="min-h-[360px] rounded-3xl border border-amber-100/20 bg-gradient-to-br from-amber-900/40 to-black p-6 text-sm text-amber-100/70">
              {wormHitsLoading ? 'Loading Worm Arena matches...' : 'No curated Worm Arena matches available yet.'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}



