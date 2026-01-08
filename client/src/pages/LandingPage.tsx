/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08T00:05:00Z
 * PURPOSE: “Choose Your Path” landing hero that juxtaposes ARC 1&2 exploration with an ARC-3 replay.
 *          Implements split layout, motion guards, CTA wiring, and metadata overlays per design plan.
 * SRP/DRY check: Pass — single-page hero composition that reuses shared UI primitives.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';

import { Button, buttonVariants } from '@/components/ui/button';
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

const ARC3_REPLAY_METADATA = {
  gameId: 'ls20-fa137e247ce6',
  clipPath: '/videos/arc3/choose-your-path.mp4',
  durationSeconds: 20,
  frameCount: 120,
};

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || PUZZLE_GIF_GALLERY.length < 2 || prefersReducedMotion) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PUZZLE_GIF_GALLERY.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextIndex = (activeIndex + 1) % PUZZLE_GIF_GALLERY.length;
    const nextGif = PUZZLE_GIF_GALLERY[nextIndex];
    // Prefetch the next GIF to keep transitions smooth.
    const image = new Image();
    image.src = `/images/decoration/${nextGif.file}`;
  }, [activeIndex]);

  const activeGif = PUZZLE_GIF_GALLERY[activeIndex];
  const leftCtas = useMemo(
    () => [
      { label: 'Browse ARC 1&2 puzzles', href: '/browser', emphasis: true },
      { label: 'View analytics', href: '/analytics', emphasis: false },
    ],
    []
  );

  useEffect(() => {
    if (prefersReducedMotion && videoRef.current) {
      videoRef.current.pause();
    }
  }, [prefersReducedMotion]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#010512] via-[#050a1d] to-[#060919] text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-16 lg:grid lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.6em] text-slate-500">Choose your path</p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Explore ARC classics or watch ARC-3 agents strategize in real time.
          </h1>
          <p className="text-base text-slate-300">
            Dive into the curated ARC 1&2 dataset with animated previews or jump to a live-feeling ARC-3
            replay to study agent behavior. Both experiences share the same tooling, so your intuition travels
            with you.
          </p>

          <ArcClassicSlice
            activeGif={activeGif}
            activeIndex={activeIndex}
            prefersReducedMotion={prefersReducedMotion}
            ctas={leftCtas}
          />
        </div>

        <ArcThreeReplaySlice prefersReducedMotion={prefersReducedMotion} videoRef={videoRef} />
      </section>
    </main>
  );
}

type ClassicSliceProps = {
  activeGif: (typeof PUZZLE_GIF_GALLERY)[number];
  activeIndex: number;
  prefersReducedMotion: boolean;
  ctas: { label: string; href: string; emphasis: boolean }[];
};

function ArcClassicSlice({ activeGif, activeIndex, prefersReducedMotion, ctas }: ClassicSliceProps) {
  return (
    <div className="space-y-5 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-5 shadow-[0_25px_60px_rgba(1,7,23,0.45)]">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
        <span>Arc 1 & 2 Explorer</span>
        <span>{prefersReducedMotion ? 'Static preview' : 'Ambient rotation'}</span>
      </div>
      <Link href={`/task/${activeGif.id}`}>
        <div className="group relative overflow-hidden rounded-2xl border border-slate-900 bg-black/70">
          <div className="relative aspect-[4/3] sm:aspect-[16/10]">
            {PUZZLE_GIF_GALLERY.map((gif, index) => (
              <img
                key={gif.id}
                src={`/images/decoration/${gif.file}`}
                alt={`Animated ARC preview for puzzle ${gif.id}`}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out',
                  index === activeIndex || prefersReducedMotion ? 'opacity-100' : 'opacity-0'
                )}
                loading={index === activeIndex ? 'eager' : 'lazy'}
              />
            ))}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/80 bg-black/70 px-4 py-3 text-xs sm:text-sm">
            <span className="font-mono uppercase tracking-[0.3em] text-slate-400">{activeGif.id}</span>
            <span className="font-semibold uppercase tracking-[0.2em] text-rose-200">{activeGif.label}</span>
            <span className="text-slate-500">Enter puzzle</span>
          </div>
        </div>
      </Link>
      <div className="flex flex-wrap gap-3">
        {ctas.map(({ label, href, emphasis }) =>
          emphasis ? (
            <Link key={href} href={href}>
              <Button className="min-w-[200px]" size="lg">
                {label}
              </Button>
            </Link>
          ) : (
            <Link key={href} href={href}>
              <span
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'lg' }),
                  'min-w-[200px] border border-transparent text-slate-300 hover:border-slate-700'
                )}
              >
                {label}
              </span>
            </Link>
          )
        )}
      </div>
      <p className="text-sm text-slate-400">
        Dataset coverage: <span className="font-semibold text-slate-200">1,000+</span> puzzles •{' '}
        <span className="font-semibold text-slate-200">4</span> solver families •{' '}
        <span className="font-semibold text-slate-200">Live analytics</span> via `/analytics`.
      </p>
    </div>
  );
}

type ArcThreeSliceProps = {
  prefersReducedMotion: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
};

function ArcThreeReplaySlice({ prefersReducedMotion, videoRef }: ArcThreeSliceProps) {
  return (
    <div className="rounded-3xl border border-indigo-900/60 bg-[#030718]/80 p-5 shadow-[0_25px_60px_rgba(5,5,30,0.65)] backdrop-blur">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.4em] text-indigo-200/80">
        <span>Arc 3 live replay</span>
        <span>{prefersReducedMotion ? 'Paused for accessibility' : 'Looping mp4'}</span>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-indigo-900/60 bg-black/70">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full"
          src={ARC3_REPLAY_METADATA.clipPath}
          poster="/images/arc3-placeholder.png"
          autoPlay={!prefersReducedMotion}
          muted
          playsInline
          loop
          controls={!prefersReducedMotion}
          aria-label={`ARC-3 replay for ${ARC3_REPLAY_METADATA.gameId}`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 text-xs font-mono uppercase tracking-[0.2em] text-indigo-100/80 backdrop-blur">
          <span>{ARC3_REPLAY_METADATA.gameId}</span>
          <span>
            {ARC3_REPLAY_METADATA.durationSeconds}s · {ARC3_REPLAY_METADATA.frameCount} frames
          </span>
        </div>
      </div>
      <p className="mt-4 text-sm text-indigo-100/80">
        Miniature is rendered from the raw scorecard JSONL using the new `scripts/arc3/generate_arc3_video.py`
        pipeline. Opening the arena loads the live ARC-3 agent runner.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/arc3/games">
          <Button className="min-w-[200px]" size="lg" variant="secondary">
            Launch ARC-3 arena
          </Button>
        </Link>
        <Link href="/docs/arc3-agent-plan">
          <span
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'lg' }),
              'min-w-[200px] border border-indigo-900/40 text-indigo-100 hover:border-indigo-700 hover:text-white'
            )}
          >
            See agent plan
          </span>
        </Link>
      </div>
    </div>
  );
}
