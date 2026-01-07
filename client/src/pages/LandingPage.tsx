/**
 * Author: Cascade
 * Date: 2026-01-07T03:20:00Z
 * PURPOSE: Owner-mandated landing page that spotlights the retro VisitorCounter (scaled up top-of-page)
 *          and adds a nightmare-inducing gallery of ARC puzzle GIFs linking directly to their tasks.
 * SRP/DRY check: Pass — reuses VisitorCounter + static asset list; keeps routing untouched.
 */
import React from 'react';
import { Link } from 'wouter';
import { VisitorCounter } from '@/components/VisitorCounter';

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
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 flex flex-col">
      <section className="flex flex-col items-center justify-center gap-6 px-4 pt-16 pb-12 text-center">
        <p className="text-sm font-mono uppercase tracking-[0.6em] text-slate-500">
          Visitor Odometer
        </p>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[0.3em] text-lime-200 drop-shadow-[0_0_30px_rgba(190,242,100,0.35)]">
          OBSERVE THE COUNT
        </h1>
        <div className="scale-[1.35] sm:scale-[1.6] md:scale-[1.85] origin-top">
          <VisitorCounter page="landing" />
        </div>
        <p className="max-w-2xl text-lg sm:text-2xl text-slate-400">
          This is the only sanctioned artifact on the landing page—watch the digits climb and
          question who else is staring back.
        </p>
      </section>

      <section className="mt-auto border-t border-slate-900 bg-gradient-to-b from-slate-950 via-black to-[#01010a]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-rose-500/70">
              Do not linger
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-widest text-rose-200">
              THE GRID WATCHES
            </h2>
            <p className="text-base text-slate-400">
              Each flickering relic links to its ARC puzzle. Click if you dare.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PUZZLE_GIF_GALLERY.map((gif) => (
              <Link key={gif.id} href={`/task/${gif.id}`}>
                <div className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-black/70 p-3 transition-all duration-300 hover:border-rose-500 hover:shadow-[0_0_35px_rgba(244,63,94,0.35)]">
                  <div className="relative h-28 w-full overflow-hidden rounded-lg bg-slate-900">
                    <img
                      src={`/images/decoration/${gif.file}`}
                      alt={`Animated ARC preview for puzzle ${gif.id}`}
                      className="h-full w-full object-cover mix-blend-screen saturate-150 opacity-90 transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/60" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono uppercase tracking-wide text-slate-400">
                    <span>{gif.id}</span>
                    <span className="text-rose-300 group-hover:text-rose-200">{gif.label}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
