/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08T20:40:00Z
 * PURPOSE: Minimal visual landing page with rotating ARC 1&2 GIFs, ARC-3 MP4 video replays,
 *          and a concise hiatus status indicator for January 2026.
 *          Left: rotating ARC 1&2 puzzle GIFs. Right: ARC-3 MP4 videos rotating through games.
 *          Two-column layout. No Worm Arena slice. Simple and working.
 * SRP/DRY check: Pass - single-page hero composition with video elements and status banner reuse.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

import { cn } from '@/lib/utils';

const ROTATION_INTERVAL_MS = 4500;

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

// Game ID to informal name mapping
const ARC3_GAME_NAMES: Record<string, string> = {
  ls20: 'Locksmith',
  vc33: 'Volume Control',
  ft09: 'Functional Tiles',
  lp85: 'Loop and Pull',
};

// MP4 video replays that work correctly
const ARC3_VIDEO_REPLAYS = [
  { gameId: 'ls20', videoPath: '/videos/arc3/ls20-fa137e247ce6.mp4' },
  { gameId: 'vc33', videoPath: '/videos/arc3/vc33-6ae7bf49eea5.mp4' },
  { gameId: 'ft09', videoPath: '/videos/arc3/ft09-b8377d4b7815.mp4' },
  { gameId: 'lp85', videoPath: '/videos/arc3/lp85-d265526edbaa.mp4' },
] as const;

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReplayIndex, setActiveReplayIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeReplay = ARC3_VIDEO_REPLAYS[activeReplayIndex];

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

  const handleVideoEnded = () => {
    setActiveReplayIndex((prev) => (prev + 1) % ARC3_VIDEO_REPLAYS.length);
  };

  useEffect(() => {
    if (videoRef.current && !prefersReducedMotion) {
      videoRef.current.play().catch(() => {});
    }
  }, [activeReplayIndex, prefersReducedMotion]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start gap-8 overflow-hidden bg-black px-4 py-12 md:px-0">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-purple-900/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />

      <p
        aria-live="polite"
        className="relative z-10 mb-6 text-center text-xs font-semibold uppercase tracking-[0.6em] text-rose-200/80 md:text-sm"
      >
        On Hiatus – January 2026
      </p>
      <section className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-0 md:px-4 md:grid-cols-2">
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

        {/* Right: ARC-3 video replay */}
        <div className="flex flex-col gap-4">
          <div className="space-y-1 text-slate-100">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-indigo-300/80">
              ARC 3
            </p>
            <p className="text-lg font-semibold tracking-wide">
              {`${activeReplay.gameId.toUpperCase()} - ${ARC3_GAME_NAMES[activeReplay.gameId]}`}
            </p>
          </div>
          <Link href="/arc3">
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900/60 via-indigo-900/50 to-purple-900/60 p-1 shadow-[0_0_40px_rgba(99,102,241,0.2)] backdrop-blur-sm transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(99,102,241,0.4)]">
              <div className="rounded-[1.25rem] bg-black/90 p-4">
                <video
                  ref={videoRef}
                  key={activeReplay.gameId}
                  src={activeReplay.videoPath}
                  className="w-full rounded-xl"
                  autoPlay={!prefersReducedMotion}
                  muted
                  playsInline
                  onEnded={handleVideoEnded}
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
