/**
 * Author: gpt-5-codex
 * Date: 2025-02-15
 * PURPOSE: Presents the ARC-AGI mission statement as a compact badge-triggered modal to
 *          reduce header clutter while keeping the full narrative accessible on demand.
 * SRP/DRY check: Pass — Reuses existing mission copy without duplicating layout logic elsewhere.
 */
import React, { useCallback, useState } from 'react';
import { Info, X } from 'lucide-react';

export function CollapsibleMission() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        className="badge badge-lg border-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={handleOpen}
      >
        <Info className="mr-2 h-4 w-4" />
        Mission &amp; Project Background
      </button>

      <dialog
        className={`modal ${isOpen ? 'modal-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-modal-title"
        aria-describedby="mission-modal-description"
        open={isOpen}
      >
        <div className="modal-box max-w-2xl space-y-4">
          <div className="flex items-start justify-between">
            <h2 id="mission-modal-title" className="text-lg font-semibold text-slate-900">
              Mission Statement &amp; Project Background
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleClose}
              aria-label="Close mission statement"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div id="mission-modal-description" className="space-y-4 text-sm leading-relaxed text-gray-700">
            <div className="space-y-3">
              <p>
                I started this project after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite...
                most of these puzzles made me feel <em>really</em> dumb. If you've ever stared at a grid and wondered what cosmic joke
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

            <div className="rounded-r border-l-4 border-blue-200 bg-blue-50 py-3 pl-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Accessibility Focus</h3>
              <p className="mb-2 text-xs leading-relaxed text-gray-700">
                My dad is one of the smartest people I know, yet color-blindness turns half the grid into a monochrome blur for him.
                My nephew dreams of running mission control for rocket ships in twenty years, but genetics means he inherited my dad's colorblindness!
                He'll need the fluid intelligence skills that can be built by solving these puzzles, and I don't want him to bounce off these puzzles just because the color palette got in the way.
              </p>

              <p className="text-xs leading-relaxed text-gray-700">
                That's why this app replaces colors with emojis
                (behind the scenes, it is still all numbers 0-9 and you can switch back to colors and numbers if you want).
                The grids stay playful, the logic stays intact, and anyone—color-blind, math-shy, or simply curious
                can explore the kind of reasoning that eludes AI.
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-green-50 p-3 text-center transition-colors hover:bg-blue-100">
              <p className="mb-2 text-sm font-semibold text-gray-800">
                TL;DR: These puzzles are hard for a lot of humans (especially the neurodivergent), emojis are fun,
                and accessibility matters.
              </p>

              <p className="mb-2 text-sm text-red-800">
                I also made this game based on ARC puzzles to help humans develop their fluid intelligence.
              </p>
              <a
                href="https://sfmc.markbarney.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
              >
                Check out my experiment here →
              </a>
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
