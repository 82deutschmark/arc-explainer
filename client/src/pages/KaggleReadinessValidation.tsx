/**
 * Author: Claude Opus 5
 * Date: 2026-08-29
 * PURPOSE: Plain-language explainer covering two things a visitor keeps running into around
 * ARC and never gets told outright: what machine learning actually is, and what Kaggle is.
 * Written for someone with no maths background -- no gradient descent, no loss functions, no
 * framework name-drops, no formulas. Deliberately dull and factual rather than persuasive.
 * Replaces the former "Kaggle Challenge Readiness Validation" form, which scored a visitor's
 * technical answers and gated them on the result; that page was built for a different purpose
 * (screening people who arrived claiming mystical insight into AI) and is no longer wanted.
 * Route stays /kaggle-readiness so nothing that already points here breaks.
 * SRP/DRY check: Pass - static content page only, no state and no assessment logic. Reuses
 * usePageMeta and EmojiMosaicAccent, matching the sibling explainer at /llm-reasoning.
 */

import React from 'react';
import { Link } from 'wouter';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function KaggleReadinessValidation() {
  usePageMeta({
    title: 'What Are Machine Learning and Kaggle? – ARC Explainer',
    description:
      'A plain-language explanation of what machine learning is and what Kaggle is, written for people without a maths or programming background.',
    canonicalPath: '/kaggle-readiness',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        <header className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <EmojiMosaicAccent pattern="rainbow" width={10} height={2} size="sm" framed />
            <EmojiMosaicAccent pattern="pattern" width={8} height={2} size="sm" framed />
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Plain-language explainer</p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-slate-100">
              What Are Machine Learning and Kaggle?
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl">
              Two words that come up constantly around ARC, explained without any maths. If you already build
              models for a living, there is nothing here for you.
            </p>
          </div>
        </header>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">Ordinary Software vs. Machine Learning</h2>
          <p className="text-slate-300 leading-relaxed">
            Normally, a computer only does what somebody told it to do, step by step. If you want a program that
            spots junk mail, a person has to sit down and write out the rules: if the subject line shouts in capital
            letters, if the sender is unknown, if the message mentions a lottery win, then call it junk.
          </p>
          <p className="text-slate-300 leading-relaxed">
            That works until it doesn&apos;t. Junk mail keeps changing, real mail sometimes shouts in capital letters,
            and the rule list grows into something nobody can maintain. Writing down every rule by hand turns out to
            be impossible for most interesting problems.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Machine learning flips the job around. Instead of writing the rules, you collect{' '}
            <strong>examples where you already know the answer</strong> — here are fifty thousand messages, and here
            is which ones were junk — and you let the computer work out the rules for itself. Nobody tells it what
            to look for. It finds whatever happens to separate one pile from the other.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">How the Learning Part Works</h2>
          <p className="text-slate-300 leading-relaxed">
            The process is less mysterious than it sounds. The computer makes a guess about an example, checks its
            guess against the known answer, and nudges itself slightly in whatever direction would have been less
            wrong. Then it does that again with the next example. And again, millions of times.
          </p>
          <p className="text-slate-300 leading-relaxed">
            No single nudge matters. The pattern comes out of doing it an enormous number of times — the same way
            you got better at a game by playing badly for a while rather than by reading the manual. There is
            mathematics underneath all this, but the mathematics is just bookkeeping for &quot;guess, check, adjust.&quot;
          </p>
          <p className="text-slate-300 leading-relaxed">
            What you end up with is called a <strong>model</strong>. It is not a program someone wrote and not a
            database of stored answers. It is a very large pile of numbers that happens to produce useful guesses,
            and generally nobody — including the people who built it — can read those numbers and say why it decides
            what it decides.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">The Catch: Memorising Isn&apos;t Learning</h2>
          <p className="text-slate-300 leading-relaxed">
            There is one failure that shows up everywhere, and it is worth understanding because it explains how
            machine learning is judged.
          </p>
          <p className="text-slate-300 leading-relaxed">
            A model can get every practice example right by memorising them, the way a student can memorise the
            answers to last year&apos;s exam without learning the subject. That student scores brilliantly on last
            year&apos;s paper and falls apart on this year&apos;s.
          </p>
          <p className="text-slate-300 leading-relaxed">
            So the honest test is always the same: hold back some examples, never let the model see them while it is
            learning, and check it on those at the end. Performance on questions it has already seen tells you
            nothing. Performance on questions it has never seen is the only number worth quoting. Nearly every
            argument about whether some AI system is genuinely impressive comes down to this distinction.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">So What Is Kaggle?</h2>
          <p className="text-slate-300 leading-relaxed">
            Kaggle is a website where people compete at exactly that task. An organisation with a prediction problem
            posts their data publicly, and anyone in the world can try to build the model that predicts best.
          </p>
          <p className="text-slate-300 leading-relaxed">A competition runs roughly like this:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Someone posts a dataset and a question — predict which customers will cancel, read the handwriting on these forms, work out what this puzzle is doing.</li>
            <li>You download the data, including a set of examples with the answers attached.</li>
            <li>You build something that makes predictions, using whatever approach you like.</li>
            <li>You upload your predictions for a second batch of questions whose answers are kept hidden.</li>
            <li>Kaggle scores you against those hidden answers and puts you on a public leaderboard.</li>
            <li>At the deadline, the best scores win — often real prize money, sometimes a substantial amount.</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            The hidden answers are the whole point. You cannot memorise your way up the leaderboard, because you
            never get to see what you are being marked on. It is the memorisation problem from the previous section,
            turned into the rules of a contest.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">Why Any of This Matters Here</h2>
          <p className="text-slate-300 leading-relaxed">
            ARC is a set of puzzles built to be easy for people and hard for machines. Each one shows you a few
            examples of a grid changing, and asks you to apply the same idea to a new grid. Most people work them
            out without being told the rule. Computers, historically, have not.
          </p>
          <p className="text-slate-300 leading-relaxed">
            ARC runs its competition on Kaggle, and the structure above is the reason it is taken seriously. The
            puzzles that decide the winner are ones nobody has published, so a system cannot score well by having
            encountered them before. It has to work out an unfamiliar rule from a handful of examples — which is
            what the whole benchmark is trying to measure.
          </p>
          <p className="text-slate-300 leading-relaxed">
            That is also what the rest of this site is for: watching various AI models attempt these puzzles, and
            being fairly blunt about how often they fail.
          </p>
        </section>

        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">Where to Go Next</h2>
          <ul className="space-y-2 text-slate-300">
            <li>
              <Link href="/llm-reasoning" className="text-blue-300 hover:text-blue-200 underline-offset-4 hover:underline">
                Do AI language models really think?
              </Link>{' '}
              — the companion explainer, on why chatbots sound cleverer than they are.
            </li>
            <li>
              <Link href="/arc3/gallery" className="text-blue-300 hover:text-blue-200 underline-offset-4 hover:underline">
                Try an ARC-AGI-3 task yourself
              </Link>{' '}
              — you get no instructions, which is the experiment.
            </li>
            <li>
              <a
                href="https://www.kaggle.com/learn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline-offset-4 hover:underline"
              >
                Kaggle&apos;s own free courses
              </a>{' '}
              — if you want to actually build one of these rather than read about it.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
