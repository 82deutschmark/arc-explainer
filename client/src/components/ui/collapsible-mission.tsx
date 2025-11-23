/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Presents the ARC-AGI mission statement with community links (Discord, ML Street Talk)
 *          as a dark-themed compact component to match the app's overall design. Badge-triggered
 *          modal keeps full narrative accessible on demand while reducing header clutter.
 * SRP/DRY check: Pass — Reuses existing mission copy, adds community resource links at top.
 */
import React, { useCallback, useState } from 'react';
import { Info, X, MessageSquare, Youtube, ExternalLink } from 'lucide-react';

export function CollapsibleMission() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      {/* Community Links */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a
          href="https://discord.gg/9b77dPAmcA"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-indigo-500/20 hover:border-indigo-400 hover:text-indigo-300 transition-all"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Discord Community
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>

        <a
          href="https://www.youtube.com/c/machinelearningstreettalk"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-rose-500/20 hover:border-rose-400 hover:text-rose-300 transition-all"
        >
          <Youtube className="h-3.5 w-3.5" />
          ML Street Talk
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>

        {/* Mission Button */}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all shadow-sm"
          onClick={handleOpen}
        >
          <Info className="h-4 w-4" />
          Mission &amp; Project Background
        </button>
      </div>

      {/* Modal */}
      <dialog
        className={`modal ${isOpen ? 'modal-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-modal-title"
        aria-describedby="mission-modal-description"
        open={isOpen}
      >
        <div className="modal-box max-w-2xl space-y-4 bg-slate-900 border border-slate-700">
          <div className="flex items-start justify-between">
            <h2 id="mission-modal-title" className="text-lg font-semibold text-slate-100">
              Mission Statement &amp; Project Background
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-ghost hover:bg-slate-800"
              onClick={handleClose}
              aria-label="Close mission statement"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div id="mission-modal-description" className="space-y-4 text-sm leading-relaxed text-slate-300">
            <div className="space-y-3">
              <p>
                I started this project after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite...
                most of these puzzles made me feel <em className="text-slate-200">really</em> dumb. If you've ever stared at a grid and wondered what cosmic joke
                you're missing, you're not alone.
              </p>

              <p>
                I built this app to explain to me WHY these answers are correct.
                These are the tasks directly cloned from the v1 and v2 sets of the ARC-AGI prize. The ARC-AGI puzzles are often described
                as "easy for humans," but let's be honest... they're not easy for most of us.
                These tasks require sophisticated logical reasoning that many people find genuinely challenging.
              </p>

              <p>
                This app takes a different approach: instead of asking AI to solve these puzzles,
                we ask it to explain why correct answers are correct.
                The results are revealing, if AI models can't even articulate the reasoning behind known solutions,
                how can they have any hope of solving novel problems?
              </p>
            </div>

            <div className="rounded-r border-l-4 border-sky-400 bg-slate-800/50 py-3 pl-4">
              <h3 className="mb-2 text-sm font-semibold text-sky-300">Accessibility Focus</h3>
              <p className="mb-2 text-xs leading-relaxed text-slate-300">
                My dad is one of the smartest people I know, yet color-blindness turns half the grid into a monochrome blur for him.
                My nephew dreams of running mission control for rocket ships in twenty years, but genetics means he inherited my dad's colorblindness!
                He'll need the fluid intelligence skills that can be built by solving these puzzles, and I don't want him to bounce off these puzzles just because the color palette got in the way.
              </p>

              <p className="text-xs leading-relaxed text-slate-300">
                That's why this app replaces colors with emojis
                (behind the scenes, it is still all numbers 0-9 and you can switch back to colors and numbers if you want).
                The grids stay playful, the logic stays intact, and anyone—color-blind, math-shy, or simply curious
                can explore the kind of reasoning that eludes AI.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-center">
              <p className="mb-2 text-sm font-semibold text-emerald-300">
                TL;DR: These puzzles are hard for a lot of humans (especially the neurodivergent), emojis are fun,
                and accessibility matters.
              </p>

              <div className="space-y-2 mb-2">
                <p className="text-sm text-slate-300">
                  I also made these projects to help humans develop their fluid intelligence:
                </p>
                <div className="flex flex-col gap-1.5">
                  <a
                    href="https://human-arc.gptpluspro.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-sky-400 underline hover:text-sky-300 hover:bg-sky-500/10 px-2 py-1 rounded transition-all"
                  >
                    Human ARC Challenge →
                  </a>
                  <a
                    href="https://sfmc.markbarney.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-sky-400 underline hover:text-sky-300 hover:bg-sky-500/10 px-2 py-1 rounded transition-all"
                  >
                    Fluid Intelligence Game →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button type="submit" onClick={handleClose}>close</button>
        </form>
      </dialog>
    </div>
  );
}
