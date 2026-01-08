/**
 * Author: Cascade (Claude claude-sonnet-4-20250514)
 * Date: 2026-01-08T01:20:00Z
 * PURPOSE: Minimal visual landing page with two graphics side-by-side.
 *          Left: rotating ARC 1&2 puzzle GIFs. Right: ARC-3 replay video.
 *          No descriptive text - just visual showcase with placeholder labels.
 * SRP/DRY check: Pass — single-page hero composition with minimal UI chrome.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

import { cn } from '@/lib/utils';

const ROTATION_INTERVAL_MS = 4500;

const PUZZLE_GIF_GALLERY = [
  { id: '2bee17df', file: 'arc_puzzle_2bee17df_fringes.gif' },
  { id: '3de23699', file: 'arc_puzzle_3de23699_invertandzoom.gif' },
  { id: '3e980e27', file: 'arc_puzzle_3e980e27_spritefulsky.gif' },
  { id: '3eda0437', file: 'arc_puzzle_3eda0437_biggestgap.gif' },
  { id: '4be741c5', file: 'arc_puzzle_4be741c5_wetpaint.gif' },
  { id: '4c5c2cf0', file: 'arc_puzzle_4c5c2cf0_crablegs.gif' },
  { id: '3f7978a0', file: 'arc_puzzle_3f7978a0_glowsticks.gif' },
  { id: '6c434453', file: 'arc_puzzle_6c434453_boxtoplus.gif' },
  { id: '6d0aefbc', file: 'arc_puzzle_6d0aefbc_fliphoriz.gif' },
  { id: '6d75e8bb', file: 'arc_puzzle_6d75e8bb_velcro.gif' },
  { id: '6d0160f0', file: 'arc_puzzle_6d0160f0_unoamarillo.gif' },
  { id: '6e4f6532', file: 'arc_puzzle_6e4f6532.gif' },
  { id: '6e82a1ae', file: 'arc_puzzle_6e82a1ae_twothreefour.gif' },
  { id: '6e19193c', file: 'arc_puzzle_6e19193c_arrows.gif' },
  { id: '7b7f7511', file: 'arc_puzzle_7b7f7511_half.gif' },
  { id: '7b0280bc', file: 'arc_puzzle_7b0280bc.gif' },
  { id: '7ddcd7ec', file: 'arc_puzzle_7ddcd7ec_webslinger.gif' },
  { id: '7e0986d6', file: 'arc_puzzle_7e0986d6_destatic2.gif' },
  { id: '7fe24cdd', file: 'arc_puzzle_7fe24cdd_pinwheel2.gif' },
  { id: '8d5021e8', file: 'arc_puzzle_8d5021e8_sixfold.gif' },
  { id: '8d510a79', file: 'arc_puzzle_8d510a79_groundsky.gif' },
  { id: '10fcaaa3', file: 'arc_puzzle_10fcaaa3_quadcopter.gif' },
] satisfies ReadonlyArray<{ id: string; file: string }>;

const ARC3_REPLAY_CLIP = '/videos/arc3/choose-your-path.mp4';

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
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

  const activeGif = PUZZLE_GIF_GALLERY[activeIndex];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#010512] via-[#050a1d] to-[#060919]">
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-12 md:grid-cols-2 md:gap-8">
        {/* Left: ARC 1&2 GIF showcase */}
        <Link href={`/task/${activeGif.id}`}>
          <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02]">
            <div className="relative aspect-square">
              {PUZZLE_GIF_GALLERY.map((gif, index) => (
                <img
                  key={gif.id}
                  src={`/images/decoration/${gif.file}`}
                  alt="ARC puzzle preview"
                  className={cn(
                    'absolute inset-0 h-full w-full object-contain transition-opacity duration-700',
                    index === activeIndex ? 'opacity-100' : 'opacity-0'
                  )}
                  loading={index === activeIndex ? 'eager' : 'lazy'}
                />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Placeholder text
              </span>
            </div>
          </div>
        </Link>

        {/* Right: ARC-3 video replay */}
        <Link href="/arc3/games">
          <div className="group relative overflow-hidden rounded-2xl border border-indigo-900/40 bg-black/40 shadow-2xl transition-transform hover:scale-[1.02]">
            <div className="relative aspect-square">
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                src={ARC3_REPLAY_CLIP}
                poster="/images/arc3-placeholder.png"
                autoPlay={!prefersReducedMotion}
                muted
                playsInline
                loop
                aria-label="ARC-3 replay"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-widest text-indigo-300">
                Placeholder text
              </span>
            </div>
          </div>
        </Link>
      </section>
    </main>
  );
}
