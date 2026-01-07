/**
 * Author: Codex (GPT-5)
 * Date: 2026-01-07T03:47:07Z
 * PURPOSE: Landing page hero that rotates through existing ARC puzzle GIFs and links directly to
 *          each puzzle route without introducing new assets or dependencies.
 * SRP/DRY check: Pass - did you verify existing functionality? Reused the existing GIF list and routing helpers.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';

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
] as const;

export default function LandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || PUZZLE_GIF_GALLERY.length < 2) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PUZZLE_GIF_GALLERY.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || PUZZLE_GIF_GALLERY.length === 0) {
      return;
    }

    const nextIndex = (activeIndex + 1) % PUZZLE_GIF_GALLERY.length;
    const nextGif = PUZZLE_GIF_GALLERY[nextIndex];
    // Prefetch the next GIF to keep transitions smooth.
    const image = new Image();
    image.src = `/images/decoration/${nextGif.file}`;
  }, [activeIndex]);

  const activeGif = PUZZLE_GIF_GALLERY[activeIndex];

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl">
          <Link href={`/task/${activeGif.id}`}>
            <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-black/80 shadow-[0_0_60px_rgba(15,23,42,0.65)]">
              <div className="relative aspect-[4/3] sm:aspect-[16/9]">
                {PUZZLE_GIF_GALLERY.map((gif, index) => (
                  <img
                    key={gif.id}
                    src={`/images/decoration/${gif.file}`}
                    alt={`Animated ARC preview for puzzle ${gif.id}`}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
                      index === activeIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                    loading={index === activeIndex ? 'eager' : 'lazy'}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-black/70 px-4 py-3 text-xs sm:text-sm">
                <span className="font-mono uppercase tracking-[0.3em] text-slate-400">
                  {activeGif.id}
                </span>
                <span className="font-semibold uppercase tracking-[0.2em] text-rose-200">
                  {activeGif.label}
                </span>
                <span className="text-slate-500">Click to open puzzle</span>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
