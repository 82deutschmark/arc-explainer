/**
 * Author: Cascade (OpenAI)
 * Date: 2025-11-19
 * PURPOSE: Plain-language explainer page about how LLM pattern matching differs from human reasoning.
 * SRP/DRY check: Pass — dedicated to LLM reasoning content and reuses shared layout/meta hooks.
 */

import React from 'react';
import { Link } from 'wouter';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function LLMReasoning() {
  usePageMeta({
    title: 'Do AI Language Models Really Think? – ARC Explainer',
    description:
      'A simple, non-technical explanation of how AI language models match patterns instead of truly thinking.',
    canonicalPath: '/llm-reasoning',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        <header className="relative space-y-6">
          <div className="flex items-center justify-between mb-2">
            <EmojiMosaicAccent pattern="rainbow" width={10} height={2} size="sm" framed />
            <EmojiMosaicAccent pattern="pattern" width={8} height={2} size="sm" framed />
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">LLM reasoning explainer</p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Do AI Language Models Really Think?
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              A simple explanation of how tools like ChatGPT work under the hood, and why their answers can look
              thoughtful even when they are mostly pattern machines.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mt-2">
            <EmojiMosaicAccent pattern="logic" width={9} height={2} size="sm" framed />
            <Link
              href="/llm-reasoning/advanced"
              className="text-xs sm:text-sm font-medium text-blue-300 hover:text-blue-200 underline-offset-4 hover:underline"
            >
              Advanced explanation
            </Link>
          </div>
        </header>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">What This Article Is About</h2>
          <p className="text-slate-300 leading-relaxed">
            You&apos;ve probably used ChatGPT or similar AI programs. They can answer questions, write stories, and
            even solve simple math problems. But are they actually <em>thinking</em>, or are they doing something
            different? Let&apos;s find out.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">The Big Question: Thinking vs. Pattern Matching</h2>
          <p className="text-slate-300 leading-relaxed">
            When you solve a puzzle, you think about it. You understand what the pieces mean and why they fit
            together. AI language models work differently. They are <strong>really good at matching patterns</strong>{' '}
            they&apos;ve seen before, kind of like a super-powered autocomplete on your phone.
          </p>
          <h3 className="text-lg font-semibold text-slate-100 mt-4">Example: The Apple Test</h3>
          <p className="text-slate-300 leading-relaxed">When you think of an apple, you remember:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>What it looks like (round, red or green)</li>
            <li>How it tastes (sweet or sour)</li>
            <li>How it feels in your hand</li>
            <li>The crunchy sound when you bite it</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            But when an AI &quot;thinks&quot; about an apple, it only knows that the word &quot;apple&quot; usually appears near words
            like &quot;fruit,&quot; &quot;red,&quot; &quot;eat,&quot; and &quot;tree&quot; in its training data. It has never seen, tasted, or touched an
            apple. It just knows which words go together.
          </p>
        </section>

        <section className="space-y-5 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            Five Key Differences Between Human Thinking and AI Processing
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="absolute -top-2 -left-2 rounded-br-lg bg-blue-500/80 px-2 py-1 text-xs font-semibold text-slate-950">
                1
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100">Pattern Matching Instead of Understanding</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What humans do:</strong> We actually understand what words mean because we connect them to
                  real experiences.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What AI does:</strong> It finds patterns in billions of sentences it memorized during
                  training, then copies those patterns.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>Example:</strong> If you ask an AI &quot;Why is the sky blue?&quot;, it doesn&apos;t picture the sky or
                  understand light. It just knows that in its training data, questions about sky color are usually
                  followed by words about &quot;light,&quot; &quot;atmosphere,&quot; and &quot;scattering.&quot;
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="absolute -top-2 -left-2 rounded-br-lg bg-purple-500/80 px-2 py-1 text-xs font-semibold text-slate-950">
                2
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100">No Sense of Truth</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What humans do:</strong> We check if something is true by comparing it to what we know about
                  the real world.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What AI does:</strong> It checks if something <em>sounds like</em> what usually appears in
                  books and websites, even if it&apos;s completely wrong.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>Example:</strong> An AI might confidently tell you that George Washington had a pet dragon,
                  because it can create a sentence that follows all the grammar rules and sounds historically-themed.
                  It can&apos;t fact-check itself against reality.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="absolute -top-2 -left-2 rounded-br-lg bg-emerald-500/80 px-2 py-1 text-xs font-semibold text-slate-950">
                3
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100">Following a Recipe vs. Problem Solving</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What humans do:</strong> When we get stuck, we can stop, think differently, ask ourselves
                  questions, and try a new approach.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What AI does:</strong> It follows the same process every time—predict the next word, then the
                  next, then the next. It can&apos;t pause to reconsider or change its strategy.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>Example:</strong> If you&apos;re building a LEGO set and realize you made a mistake, you might
                  take it apart and start over. An AI just keeps adding the next piece based on what usually comes next
                  in the instructions it memorized.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="absolute -top-2 -left-2 rounded-br-lg bg-amber-500/80 px-2 py-1 text-xs font-semibold text-slate-950">
                4
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100">Remixing vs. Creating</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What humans do:</strong> We can have truly original ideas by understanding concepts deeply.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What AI does:</strong> It mixes together pieces from things it has read before, like
                  shuffling a deck of cards.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>Example:</strong> Imagine reading Harry Potter and The Hunger Games, then writing a story
                  about a wizard entering a survival competition. That&apos;s similar to what AI does—it combines elements
                  it has seen before into new arrangements.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
              <div className="absolute -top-2 -left-2 rounded-br-lg bg-rose-500/80 px-2 py-1 text-xs font-semibold text-slate-950">
                5
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-100">No &quot;Why&quot; Understanding</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What humans do:</strong> We know <em>why</em> an answer is correct, not just <em>that</em> it&apos;s
                  correct.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>What AI does:</strong> It produces answers that look right based on patterns, but has no
                  understanding of why.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong>Example:</strong> An AI might correctly say &quot;2 + 2 = 4,&quot; but it doesn&apos;t understand what
                  numbers mean or why addition works. It just knows those symbols appear together frequently in its
                  training data.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">What Does This Mean?</h2>
          <p className="text-slate-300 leading-relaxed">
            AI language models are incredibly useful tools. They can:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>Help you write better</li>
            <li>Answer many questions accurately</li>
            <li>Explain complicated topics</li>
            <li>Generate creative content</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            But they&apos;re more like <strong>extremely sophisticated copying and remixing machines</strong> than
            thinking beings. They create &quot;shadows of reasoning&quot;—outputs that <em>look like</em> someone thought about
            them, but are actually produced by matching patterns.
          </p>
        </section>

        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-100">The Bottom Line</h2>
          <p className="text-slate-300 leading-relaxed">
            When an AI gives you a great answer, it&apos;s not because it understood your question and reasoned through
            the problem. It&apos;s because it found similar patterns in the billions of examples it studied, then
            reassembled them in a way that fits your question.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Think of it this way: If you memorized every conversation you ever heard, you could probably respond to
            new questions by remixing pieces of those old conversations. You&apos;d sound smart, but you wouldn&apos;t
            necessarily understand what you were saying. That&apos;s closer to what AI does.
          </p>
          <p className="text-slate-300 leading-relaxed">
            This doesn&apos;t make AI less useful—it just helps us understand what it really is and what it isn&apos;t.
          </p>
        </section>
      </div>
    </div>
  );
}
