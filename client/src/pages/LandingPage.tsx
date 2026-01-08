/**
 * Author: Cascade (Claude claude-sonnet-4-20250514)
 * Date: 2026-01-08T02:15:00Z
 * PURPOSE: Minimal visual landing page with two graphics side-by-side.
 *          Left: rotating ARC 1&2 puzzle GIFs. Right: ARC-3 replay videos playing sequentially to completion.
 *          No descriptive text - just visual showcase with placeholder labels per owner request.
 * SRP/DRY check: Pass — single-page hero composition with minimal UI chrome, rotating data-driven media.
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

const ARC3_REPLAY_GALLERY = [
  { gameId: 'ls20-fa137e247ce6', clip: '/videos/arc3/ls20-fa137e247ce6.mp4' },
  { gameId: 'sp80-0605ab9e5b2a', clip: '/videos/arc3/sp80-0605ab9e5b2a.mp4' },
  { gameId: 'vc33-6ae7bf49eea5', clip: '/videos/arc3/vc33-6ae7bf49eea5.mp4' },
  { gameId: 'as66-821a4dcad9c2', clip: '/videos/arc3/as66-821a4dcad9c2.mp4' },
  { gameId: 'ft09-b8377d4b7815', clip: '/videos/arc3/ft09-b8377d4b7815.mp4' },
  { gameId: 'lp85-d265526edbaa', clip: '/videos/arc3/lp85-d265526edbaa.mp4' },
] satisfies ReadonlyArray<{ gameId: string; clip: string }>;

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeReplayIndex, setActiveReplayIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  useEffect(() => {
    if (prefersReducedMotion && videoRef.current) {
      videoRef.current.pause();
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    // Force-load the current clip to ensure seamless rotation
    videoRef.current.load();
    if (!prefersReducedMotion) {
      const playPromise = videoRef.current.play();
      if (playPromise) {
        playPromise.catch(() => {
          /* Ignore autoplay interruptions */
        });
      }
    }
  }, [activeReplayIndex, prefersReducedMotion]);

  const handleReplayEnded = React.useCallback(() => {
    setActiveReplayIndex((prev) => (prev + 1) % ARC3_REPLAY_GALLERY.length);
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || ARC3_REPLAY_GALLERY.length < 2) {
      return;
    }

    node.addEventListener('ended', handleReplayEnded);
    return () => {
      node.removeEventListener('ended', handleReplayEnded);
    };
  }, [handleReplayEnded]);

  const activeGif = PUZZLE_GIF_GALLERY[activeIndex];
  const activeReplay =
    ARC3_REPLAY_GALLERY[activeReplayIndex] ?? ARC3_REPLAY_GALLERY[0];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-purple-900/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />

      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-16 md:grid-cols-2">
        {/* Left: ARC 1&2 GIF showcase */}
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                {activeGif.label}
              </span>
            </div>
          </div>
        </Link>

        {/* Right: ARC-3 video replay */}
        <Link href="/arc3/games">
          <div className="group relative overflow-hidden rounded-2xl border border-indigo-900/40 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02]">
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-100/90">
              <span>Arc 3</span>
              <span className="tracking-[0.15em] text-indigo-200">{activeReplay.gameId}</span>
            </div>
            <div className="relative aspect-square pt-10">
              <video
                ref={videoRef}
                key={activeReplay.gameId}
                className="h-full w-full object-contain p-6"
                src={activeReplay.clip}
                poster="/images/arc3-placeholder.png"
                autoPlay={!prefersReducedMotion}
                muted
                playsInline
                aria-label={`ARC-3 replay ${activeReplay.gameId}`}
              />
            </div>
          </div>
        </Link>
      </section>
    </main>
  );
}
