/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Dr. Fable 5.1's findings on the ARC-AGI-2 hard set at /arc2/hard-set/findings: why these
 *          puzzles resist every logged model, what the recorded reasoning shows breaking, what I could
 *          and could not work out with the answers in hand, and what the synthetic training set for the
 *          ARC-2 Kaggle entry should therefore contain. Written in the first person on purpose; the
 *          Boss asked for my estimation, not a survey. Facts about attempts come from the hard-set
 *          endpoint and the attempt records; the per-puzzle notes live in shared/arc2HardSet.ts.
 *          19-Oct-2026, Claude Opus 5.5 Medium: one dated aside on the spiral, found while coding its generator.
 * SRP/DRY check: Pass — prose page; links to the hard-set page and the plan instead of repeating them.
 */

import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC2_HARD_SET_NOTES } from '@shared/arc2HardSet';

const notes = Object.values(ARC2_HARD_SET_NOTES);
const counts = {
  checked: notes.filter((note) => note.confidence === 'checked').length,
  read: notes.filter((note) => note.confidence === 'read').length,
  partial: notes.filter((note) => note.confidence === 'partial').length,
};

export default function Arc2HardSetFindings() {
  usePageMeta({
    title: 'Why the ARC-AGI-2 hard set is hard — Dr. Fable 5.1',
    description:
      'What the recorded model reasoning shows breaking on the never-solved ARC-AGI-2 puzzles, what Dr. Fable 5.1 could and could not work out with the answers, and what the synthetic set needs.',
    canonicalPath: '/arc2/hard-set/findings',
  });

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-7 sm:py-10 leading-relaxed">
      <header className="space-y-3">
        <Link href="/arc2/hard-set" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> The hard set
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Why the hard set is hard</h1>
        <p className="text-lg text-muted-foreground">
          Dr. Fable 5.1, 19 October 2026. My estimation, with the answers open, of why these puzzles
          resist every model and what that means for the puzzles we make.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">First, the disclosure</h2>
        <p>
          I wrote the solve notes on the hard-set page with the answer grids in front of me. That is not
          solving. The Boss's own research on this site showed over and over that a model handed the
          answer still cannot say how the answer was reached, and this exercise bore that out on me. Of
          the {notes.length} puzzles, I could code a rule that reproduces every training and test pair
          for {counts.checked}. For {counts.read} more I can describe the rule by eye and believe it. For
          {' '}{counts.partial} I could not pin the rule down at all, answer in hand, and the notes say so.
          Nothing below rests on the ones I could not pin down.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What the recorded reasoning shows breaking</h2>
        <p>
          The attempt records on the hard-set page are the evidence. Reading the frontier attempts on
          the never-solved six, five failure shapes come up again and again.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>The rule is right and the hands are wrong.</strong> On the marble maze, Claude Opus 4.8
            and Gemini 3 Deep Think both found the arrow signs, both named the direction for each room,
            both traced every marble square by square, and both let one marble slide diagonally past the
            corner of a wall. A marble cannot squeeze through a corner gap. One square wrong, whole
            answer wrong. The spiral puzzle is the same story stretched out: every attempt says
            "spiral", and the drawn spirals drift by a square somewhere in thirty rows. (Coding it later
            showed part of that drift is a rule detail, not only shaky hands: every corner carries a small
            sideways step as long as the plus arm minus two, so a plain square spiral is wrong from the
            first corner. Claude Opus 5.5 Medium, 19-Oct.)
          </li>
          <li>
            <strong>A rule invented from one example when the secret spans all of them.</strong> The torn
            picture puzzle has one hidden twenty-by-twenty picture shared by every example. No attempt
            noticed. Each one looked inside a single pair, found a tiling or a half-shift that happened
            to fit it, and applied that. The models read examples one at a time; this puzzle only makes
            sense read together.
          </li>
          <li>
            <strong>Almost the right rule, with the last clause guessed.</strong> On the onion rooms,
            Gemini 3 Deep Think wrote down rings, dots, depth, everything, and then decided the deepest
            dot's color continues to the middle. The real rule starts the color list again. Both rules
            fit the first training pair; only one fits the second. The model stopped checking after the
            first.
          </li>
          <li>
            <strong>Structure decided by eye instead of traced.</strong> On fill-the-chain, the models
            understand that hollow shapes get filled with a marker color. Which shapes? Gemini split the
            grid into a left half and a right half and assigned one marker to each. The answer requires
            following the winding line from each marker and seeing what it actually touches. The models
            prefer a tidy geometric guess to a tedious trace.
          </li>
          <li>
            <strong>Loops of recounting.</strong> On the color keys puzzle, Gemini's record is pages of
            parity checks, square by square, each contradicting the last, with no rule ever settled.
            When the picture does not reduce to a sentence, the model has nothing to hold on to and
            starts counting.
          </li>
        </ol>
        <p>
          Put together: these puzzles are not hard because the rule is clever. Three of the checked rules
          fit in a few plain sentences a child would accept: marbles roll and cannot squeeze past corners,
          one torn picture, onion rings that repeat their colors. They are hard because the rule lives in
          physical intuition or across examples rather than in any one grid, and because the drawing is
          long enough that a single slip is fatal. The models' reasoning is fluent and the execution is
          brittle.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What I learned from failing too</h2>
        <p>
          The ones I could not pin down share a shape: a small legend or key somewhere in the grid that
          dictates what happens elsewhere, with the mapping from key to effect never spelled out in any
          single pair. Dot panels, wallpaper stamps, pass-the-color-along, the color keys. On those I
          behaved exactly like the records I was reading: I named the pieces, proposed a mapping,
          checked it on one pair, and watched it fail on the next. Having the answer did not help, because
          the answer shows what happened, not why. That is worth stating plainly for anyone planning to
          train on my notes: a note marked "partial" is a description of my confusion, not a spec.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What the synthetic set should contain</h2>
        <p>
          The synthetic puzzles are for training, reinforcement learning and post-training of our
          ARC-AGI-2 Kaggle entry. They should attack the failure shapes above, not copy the eighteen
          grids. Each family below has a generator that is also its own checker, so every generated task
          comes with a verified answer and can serve as an exact-match reward.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Physical-intuition rules with a trap.</strong> Marbles that slide and stop at walls,
            with the corner-squeeze rule switched on in half the tasks and off in the other half, so the
            model has to look at the examples to know which world it is in. Same idea for rolling marbles
            that turn at walls. This directly targets the marble-maze failure.
          </li>
          <li>
            <strong>Shared secret across examples.</strong> One hidden master picture per task, each
            example a piece of it, the answer the whole picture in the orientation that fits. Vary the
            picture, the piece sizes and whether the piece is placed as-is or flipped. The model cannot
            solve these one pair at a time.
          </li>
          <li>
            <strong>Long faithful execution.</strong> Spirals, onion rings and corridor fills on grids up
            to thirty by thirty where the rule is trivial and the drawing is long. These train the hands,
            not the head, and the hard set says the hands are the problem.
          </li>
          <li>
            <strong>Chain tracing.</strong> Winding lines that touch some hollow shapes and not others,
            with decoy shapes placed where a left-half-right-half guess would get them wrong. Fill what
            the line reaches.
          </li>
          <li>
            <strong>Legend reading.</strong> A small sign in a corner that dictates a direction or a
            color mapping applied elsewhere. Keep these to the mappings we can state and verify (arrow
            signs, one-to-one color swaps). The key-reading families I could not crack are not ready to be
            generated; they go on a waiting list until someone writes a solver that reproduces the real
            puzzle.
          </li>
          <li>
            <strong>Repair and assembly.</strong> Broken lines with their pieces lying nearby, and framed
            pictures cut into scattered jigsaw pieces. Both are readable rules with long, exact outputs.
          </li>
        </ol>
        <p>
          Three rules for the set as a whole. Every family starts from a solver that reproduces the real
          puzzle it is modeled on, or it does not ship. The eighteen real puzzles are never trained on;
          they are the hard test, and the rest of the public eval set is the regression ruler. And the
          loop runs many experiments a day with three seeds before any family is kept or dropped, per the
          Boss's direction of 18 October. The plan for Opus 5.5 that carries this out is in
          docs/2026-10-19-arc2-hard-set-synthetic-data-plan.md.
        </p>
      </section>
    </article>
  );
}
