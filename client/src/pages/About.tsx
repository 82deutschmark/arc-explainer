/**
 * Author: Cascade (OpenAI)
 * Date: 2025-11-11
 * PURPOSE: About page highlighting ARC Explainer story, community resources, and acknowledgements.
 * Integrates ReferenceMaterial component, community outreach, and updated gratitude messaging.
 * SRP/DRY check: Pass — dedicated to About content while reusing shared components.
 */

import React from 'react';
import { Github, ExternalLink, Sparkles } from 'lucide-react';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';
import { ReferenceMaterial } from '@/components/browser/ReferenceMaterial';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function About() {
  usePageMeta({
    title: 'About – ARC Explainer',
    description:
      'Learn the story, accessibility goals, and community behind ARC Explainer, plus links to related reasoning projects.',
    canonicalPath: '/about',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section with Mosaic Border */}
        <div className="relative mb-12">
          <div className="flex items-center justify-between mb-4">
            <EmojiMosaicAccent
              pattern="rainbow"
              width={12}
              height={2}
              size="sm"
              framed
            />
            <EmojiMosaicAccent
              pattern="sunset"
              width={8}
              height={3}
              size="sm"
              framed
            />
          </div>

          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              About ARC Explainer
            </h1>
            <p className="text-xl text-slate-400">
              Born from confusion. Built for understanding.
            </p>
          </div>

          <div className="flex items-center justify-between mt-4">
            <EmojiMosaicAccent
              pattern="ocean"
              width={8}
              height={3}
              size="sm"
              framed
            />
            <EmojiMosaicAccent
              pattern="forest"
              width={10}
              height={2}
              size="sm"
              framed
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - The Story */}
          <div className="lg:col-span-2 space-y-6">
            {/* What Is This */}
            <div className="relative border border-slate-700 rounded-lg p-6 bg-slate-900/70 backdrop-blur shadow-lg shadow-slate-900/60">
              <div className="absolute -top-3 -left-3">
                <EmojiMosaicAccent
                  pattern="success"
                  width={4}
                  height={4}
                  size="xs"
                  framed
                />
              </div>
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 mb-3">The Honest Truth</h2>
                  <p className="text-slate-200 leading-relaxed mb-3">
                    My personal wetware operates on far less CPUs than the absolute geniuses that I've encountered in the ARC-AGI community. I stumbled onto ARC-AGI puzzles tagged "easy for humans" and immediately felt really dumb.
                    These weren't easy at all for me... and I'm fascinated by the tools that we're using to benchmark LLMs. And so the gauntlet had been tossed and this very humble hobby project began. 
                  </p>
                  <p className="text-slate-200 leading-relaxed">
                    So I built this app to explain <em>why</em> the answers are correct. Not to solve them,
                    but to understand them. I thought, "Well, if I give it the answer, it can explain to me why the correct answer is correct, right?" Surprisingly, no. If AI can't explain known solutions, how can it solve new problems?  Luckily, nothing in the creation or maintenance of this project is a novel problem, and LLMs have been able to help me with it extensively.
                  </p>
                  <p className="mt-3 text-slate-200 leading-relaxed">
                    While it started as a personal tool, thanks to the Discord community in particular, it has grown into a open-source resource shaped by
                    fellow ARC explorers who share their insights, tools, and encouragement.  
                  </p>
                </div>
              </div>
            </div>

            {/* Accessibility Focus */}
            <div className="relative border border-slate-800 rounded-lg p-6 bg-slate-900/40 backdrop-blur">
              <div className="absolute -top-3 -right-3">
                <EmojiMosaicAccent
                  pattern="difficultyMedium"
                  width={4}
                  height={4}
                  size="xs"
                  framed
                />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3">Why Emojis?</h2>
              <div className="space-y-3 text-slate-300 leading-relaxed">
                <p>
                  My dad is brilliant but colorblind. My nephew dreams of running mission control
                  but inherited the same genetics. Standard ARC puzzles use colors that turn into
                  a confusing blur for them.
                </p>
                <p>
                  This app replaces colors with emojis. The logic stays intact, the grids stay playful,
                  and everyone, colorblind, math-shy, or just curious, can access these reasoning challenges.
                </p>
                <p className="text-sm text-slate-400 italic">
                  (You can still switch back to colors and numbers if you prefer.)
                </p>
              </div>
            </div>

            {/* Related Projects */}
            <div className="relative border border-slate-800 rounded-lg p-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur">
              <div className="absolute -bottom-3 -left-3">
                <EmojiMosaicAccent
                  pattern="pattern"
                  width={5}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4">My Other Projects</h2>
              <div className="space-y-3">
                <a
                  href="https://human-arc.gptpluspro.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors group"
                >
                  <span className="font-semibold">Human ARC Challenge</span>
                  <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <p className="text-sm text-slate-400 ml-6">
                  Interactive ARC puzzles designed specifically for human solvers
                </p>

                <a
                  href="https://sfmc.markbarney.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors group"
                >
                  <span className="font-semibold">Fluid Intelligence Game</span>
                  <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <p className="text-sm text-slate-400 ml-6">
                  Game-based training to develop pattern recognition and reasoning skills
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Info & Links */}
          <div className="space-y-6">
            {/* Tech Stack */}
            <div className="relative border border-slate-800 rounded-lg p-5 bg-slate-900/40 backdrop-blur">
              <div className="absolute -top-3 -right-3">
                <EmojiMosaicAccent
                  pattern="logic"
                  width={3}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Open Source</h3>
              <p className="text-sm text-slate-400 mb-4">
                Built with React, TypeScript, PostgreSQL, and modern web tech.
                Integrates with multiple AI providers to test reasoning capabilities.
              </p>
              <a
                href="https://github.com/82deutschmark/arc-explainer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Github className="h-4 w-4" />
                View on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Simon Spotlight */}
            <div className="relative border border-amber-500/50 rounded-lg p-5 bg-gradient-to-br from-amber-950/80 via-slate-950 to-purple-950/80 backdrop-blur">
              <div className="absolute -top-3 -left-3">
                <EmojiMosaicAccent
                  pattern="training"
                  width={4}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h3 className="text-lg font-bold text-amber-100 mb-3">Simon Strandgaard Spotlight</h3>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-md overflow-hidden border border-amber-400/70 bg-black/60 flex-shrink-0">
                  <img
                    src="/images/decoration/arc_puzzle_1bfc4729_frame.gif"
                    alt="Animated ARC puzzle grid decoration"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-amber-50 font-semibold">
                    Simon Strandgaard <span className="text-amber-200">@neoneye</span>
                  </p>
                  <p className="text-amber-100/90">
                    Simon&apos;s documentation, visualization tools, and deep ARC curation have been the
                    single biggest external influence on this project.
                  </p>
                  <p className="text-xs text-amber-200/80">
                    If ARC Explainer helps you, you are standing on years of Simon&apos;s groundwork.
                  </p>
                </div>
              </div>
            </div>

            {/* Acknowledgments */}
            <div className="relative border border-slate-800 rounded-lg p-5 bg-slate-900/40 backdrop-blur">
              <div className="absolute -bottom-3 -left-3">
                <EmojiMosaicAccent
                  pattern="training"
                  width={3}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Thanks To</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <span className="text-slate-300 font-semibold">Simon Strandgaard (@neoneye)</span> for
                  tireless documentation, tooling, and personal encouragement.
                </p>
                <p>
                  <span className="text-slate-300 font-semibold">David Lu (@conundrumer)</span> for
                  RE-ARC Bench, the project&apos;s first major external contribution.
                </p>
                <p>
                  <span className="text-slate-300 font-semibold">François Chollet</span> for creating ARC-AGI
                </p>
                <p>
                  <span className="text-slate-300 font-semibold">Open Source Community</span> for amazing tools
                </p>
                <p>
                  <span className="text-slate-300 font-semibold">You!</span> for caring about accessibility
                </p>
              </div>
            </div>

            {/* Research Links */}
            <div className="relative border border-slate-800 rounded-lg p-5 bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur">
              <div className="absolute -top-3 -left-3">
                <EmojiMosaicAccent
                  pattern="evaluation"
                  width={3}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Learn More</h3>
              <div className="space-y-2">
                <a
                  href="https://www.arxiv.org/pdf/2505.11831"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm group"
                >
                  <span>ARC2 Research Paper</span>
                  <ExternalLink className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="https://github.com/82deutschmark/arc-explainer/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm group"
                >
                  <span>Report an Issue</span>
                  <ExternalLink className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* Community Invitation */}
            <div className="relative border border-slate-800 rounded-lg p-5 bg-slate-900/40 backdrop-blur">
              <div className="absolute -top-3 -right-3">
                <EmojiMosaicAccent
                  pattern="logic"
                  width={3}
                  height={3}
                  size="xs"
                  framed
                />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-3">Join the Community</h3>
              <p className="text-sm text-slate-400 mb-4">
                Dive deeper with fellow ARC enthusiasts, share your findings, and learn from ongoing
                experiments in the official ARC Discord.
              </p>
              <a
                href="https://discord.gg/9b77dPAmcA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900/60 hover:bg-blue-800 rounded-lg transition-colors text-sm font-medium text-blue-200"
              >
                Join the ARC Discord
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Reference Material */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-100">Reference Materials &amp; Tools</h2>
            <EmojiMosaicAccent
              pattern="pattern"
              width={6}
              height={2}
              size="sm"
              framed
            />
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Explore curated research, datasets, and community resources that keep ARC Explainer grounded in
            the broader ecosystem of abstraction and reasoning work.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
            <ReferenceMaterial />
          </div>
        </section>

        {/* Bottom Mosaic Border */}
        <div className="flex items-center justify-center gap-4 mt-12 mb-6">
          <EmojiMosaicAccent
            pattern="transformation"
            width={6}
            height={2}
            size="sm"
            framed
          />
          <div className="flex items-center gap-3">
            <EmojiMosaicAccent
              pattern="success"
              width={4}
              height={2}
              size="sm"
              framed
            />
            <span className="text-sm text-slate-300">
              Made with curiosity for humans who don&apos;t find these puzzles easy.
            </span>
            <EmojiMosaicAccent
              pattern="training"
              width={4}
              height={2}
              size="sm"
              framed
            />
          </div>
          <EmojiMosaicAccent
            pattern="hover"
            width={6}
            height={2}
            size="sm"
            framed
          />
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-slate-500 mt-6">
          <p>
            A hobby project for 4-5 users who share my confusion about "easy for humans" puzzles.
          </p>
        </div>
      </div>
    </div>
  );
}
