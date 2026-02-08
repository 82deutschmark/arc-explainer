/**
 * Author: Cascade (GPT-5.2)
 * Date: 2026-02-07
 * PURPOSE: Dedicated tribute page for Johan Land (@beetree / @LandJohan), a longtime friend
 *          of the ARC Explainer project. Celebrates his new SOTA public submission to ARC-AGI
 *          (V1: 94.5%, V2: 72.9%) based on GPT-5.2 bespoke refinement ensemble. Hosts his
 *          paper PDF, embeds official ARC Prize verification tweets, and links to his solver
 *          which is already integrated into this project as the Beetree Ensemble Solver.
 * SRP/DRY check: Pass - Single-responsibility tribute/profile page, reuses existing UI patterns.
 */

import React, { useEffect } from 'react';
import { Link } from 'wouter';
import {
  ExternalLink, Github, Twitter, FileText, Trophy, Trees,
  ArrowLeft, Download, Sparkles, Zap, Star, Crown, TrendingUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Twitter embed loader - injects the widget script once
function useTwitterEmbed() {
  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
    } else {
      // Script already exists - re-render any new tweet embeds
      (window as any).twttr?.widgets?.load();
    }
  }, []);
}

export default function JohanLandTribute() {
  useTwitterEmbed();

  useEffect(() => {
    document.title = 'Johan Land - ARC-AGI Grand Master | ARC Explainer';
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Subtle gradient accent at top */}
      <div className="fixed top-0 inset-x-0 h-64 bg-gradient-to-b from-cyan-900/15 via-zinc-950/50 to-transparent pointer-events-none z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Back nav */}
        <nav className="flex items-center gap-3">
          <Link href="/hall-of-fame">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Hall of Fame
            </Button>
          </Link>
        </nav>

        {/* ── Hero Section ── */}
        <header className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-900/20">
          {/* Wide banner image */}
          <img
            src="/johanLandwide.png"
            alt="Johan Land (@beetree) - ARC Raiders trading card art showing a figure relaxing among walls of ARC puzzle monitors"
            className="w-full h-auto object-cover"
          />
          {/* Gradient overlay for text */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/30 to-transparent" />

          {/* Title overlay */}
          <div className="absolute bottom-0 inset-x-0 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-xs uppercase tracking-widest text-amber-300 font-bold">
                    New SOTA Public Submission
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                  Johan Land
                </h1>
                <p className="text-cyan-300 font-mono text-sm mt-1">
                  @LandJohan &middot; @beetree
                </p>
              </div>
              <div className="flex gap-3">
                {/* V1 score badge */}
                <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-4 py-2 text-center backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">V1 Score</div>
                  <div className="text-2xl md:text-3xl font-black text-emerald-400">94.5%</div>
                  <div className="text-[10px] text-emerald-300/70">$11.4/task</div>
                </div>
                {/* V2 score badge */}
                <div className="bg-sky-500/20 border border-sky-500/40 rounded-xl px-4 py-2 text-center backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">V2 Score</div>
                  <div className="text-2xl md:text-3xl font-black text-sky-400">72.9%</div>
                  <div className="text-[10px] text-sky-300/70">$38.9/task</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Quick Stats Bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Achievement</div>
              <div className="text-sm font-bold text-zinc-100 mt-1">SOTA Public Submission</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Zap className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Approach</div>
              <div className="text-sm font-bold text-zinc-100 mt-1">Bespoke Refinement</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Trees className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Engine</div>
              <div className="text-sm font-bold text-zinc-100 mt-1">Multi-Model Ensemble</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 text-fuchsia-400 mx-auto mb-1" />
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Based On</div>
              <div className="text-sm font-bold text-zinc-100 mt-1">GPT-5.2 + Gemini-3 + Opus 4.5</div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: About + Approach (2 cols wide) */}
          <div className="lg:col-span-2 space-y-6">

            {/* About Section */}
            <section className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/60">
              <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                About Johan
              </h2>
              <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Johan Land is a longtime friend of the ARC Explainer project and a prolific contributor 
                  to the ARC-AGI community. Known by his handle <span className="font-mono text-cyan-400">@beetree</span> on 
                  GitHub, Johan has been pushing the boundaries of what's possible with multi-model ensemble 
                  approaches to abstract reasoning.
                </p>
                <p>
                  His solver, which we've integrated directly into ARC Explainer as the{' '}
                  <Link href="/puzzle/beetree/0a938d79">
                  <span className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer">
                    Beetree Ensemble Solver
                  </span>
                  </Link>, uses what he calls <strong className="text-zinc-100">Multi-Model Reflective Reasoning</strong> - 
                  a sophisticated pipeline that orchestrates GPT-5.2, Gemini-3, and Opus 4.5 through multiple 
                  search stages with a council of judges to evaluate and refine solutions.
                </p>
                <p>
                  On <strong className="text-zinc-100">February 3, 2026</strong>, ARC Prize officially verified Johan's 
                  new state-of-the-art public submission: <strong className="text-emerald-400">94.5% on V1</strong> at 
                  $11.4/task and <strong className="text-sky-400">72.9% on V2</strong> at $38.9/task. This represents 
                  a massive leap from his earlier results (76.11% in January 2026, 70.7% in December 2025, 50.3% 
                  in December 2025 initial run).
                </p>
              </div>
            </section>

            {/* Methodology Section */}
            <section className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/60">
              <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-fuchsia-400" />
                Methodology: Multi-Model Reflective Reasoning
              </h2>
              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Johan's approach ensembles many techniques together through a multi-stage pipeline 
                  with long-horizon reasoning (~6 hours per problem), agentic code generation (100,000+ 
                  Python calls), visual reasoning, and a council of judges.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Solver cards */}
                  {[
                    {
                      title: 'Multimodal Solver',
                      desc: 'Generates images of problems and uses them as part of the prompt to extract visual insights.',
                      color: 'border-purple-500/30 bg-purple-500/5'
                    },
                    {
                      title: 'Hint Extraction',
                      desc: 'Extracts key hints about how to solve the problem separately, then supplies hints to guide models.',
                      color: 'border-amber-500/30 bg-amber-500/5'
                    },
                    {
                      title: 'Three-Step Search',
                      desc: 'Labels objects, identifies transformations, then uses both to find a solution systematically.',
                      color: 'border-emerald-500/30 bg-emerald-500/5'
                    },
                    {
                      title: 'Deep Search',
                      desc: 'Specialized prompting to trigger maximum depth of reasoning for the hardest problems.',
                      color: 'border-cyan-500/30 bg-cyan-500/5'
                    }
                  ].map(solver => (
                    <div key={solver.title} className={`rounded-lg border ${solver.color} p-3`}>
                      <h4 className="font-semibold text-zinc-100 text-xs uppercase tracking-wide mb-1">{solver.title}</h4>
                      <p className="text-xs text-zinc-400">{solver.desc}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-zinc-500 italic">
                  All solvers output full reasoning traces. Two judges (Logic Judge + Consistency Judge) 
                  score every candidate, deciding whether further search is needed or a likely solution 
                  has been reached.
                </p>
              </div>
            </section>

            {/* Paper Section */}
            <section className="border border-fuchsia-500/30 rounded-xl p-6 bg-gradient-to-br from-fuchsia-950/30 to-zinc-900/80">
              <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-fuchsia-400" />
                Research Paper
              </h2>
              <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                Johan's paper details his bespoke refinement approach and the full methodology behind 
                the SOTA submission. We're hosting the PDF here since it's currently difficult 
                to access elsewhere.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/paper.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 border border-fuchsia-500/40 rounded-lg text-sm font-medium text-fuchsia-200 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Read Paper (PDF)
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <a
                  href="/paper.pdf"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 rounded-lg text-sm font-medium text-zinc-300 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            </section>

            {/* Official Verification - Tweet Embeds */}
            <section className="border border-amber-500/30 rounded-xl p-6 bg-gradient-to-br from-amber-950/20 to-zinc-900/80">
              <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Official ARC Prize Verification
              </h2>
              <p className="text-sm text-zinc-400 mb-4">
                The ARC Prize team officially verified and announced Johan's SOTA submission on February 3, 2026.
              </p>
              <div className="space-y-4">
                {/* Tweet embed 1 - main announcement with scores */}
                <div className="bg-zinc-900/80 rounded-lg p-4 border border-zinc-800">
                  <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
                    <p lang="en" dir="ltr">
                      New SOTA public submission to ARC-AGI:<br /><br />
                      - V1: 94.5%, $11.4/task<br />
                      - V2: 72.9%, $38.9/task<br /><br />
                      Based on GPT 5.2, this bespoke refinement submission by{' '}
                      <a href="https://twitter.com/LandJohan">@LandJohan</a> ensembles many approaches together{' '}
                      <a href="https://t.co/9NxTqHyn6S">pic.twitter.com/9NxTqHyn6S</a>
                    </p>
                    &mdash; ARC Prize (@arcprize){' '}
                    <a href="https://twitter.com/arcprize/status/2018746794310766668">February 3, 2026</a>
                  </blockquote>
                </div>

                {/* Tweet embed 2 - additional context */}
                <div className="bg-zinc-900/80 rounded-lg p-4 border border-zinc-800">
                  <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
                    <a href="https://twitter.com/arcprize/status/2018746796672258506">
                      View the full thread from @arcprize
                    </a>
                  </blockquote>
                </div>
              </div>
            </section>

            {/* Score History */}
            <section className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/60">
              <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Score Progression
              </h2>
              <div className="space-y-3">
                {[
                  { date: 'Feb 3, 2026', score: '94.5% V1 / 72.9% V2', label: 'SOTA', highlight: true },
                  { date: 'Jan 5, 2026', score: '76.11% ARC-AGI-2 Eval', label: 'V7', highlight: false },
                  { date: 'Dec 15, 2025', score: '70.7% ARC-AGI-2 Eval', label: 'V6', highlight: false },
                  { date: 'Dec 1, 2025', score: '50.3% ARC-AGI-2 Eval', label: 'V5', highlight: false },
                ].map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      entry.highlight
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex-shrink-0 w-24 text-xs text-zinc-500 font-mono">{entry.date}</div>
                    <div className="flex-1">
                      <span className={`font-bold text-sm ${entry.highlight ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {entry.score}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={entry.highlight
                        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                        : 'text-zinc-500 border-zinc-700'}
                    >
                      {entry.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right column: Links & Resources */}
          <div className="space-y-6">

            {/* Quick Links Card */}
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-lg font-bold text-zinc-100 mb-3">Links & Resources</h3>
                <a
                  href="https://github.com/beetree/ARC-AGI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-zinc-600 transition-all group"
                >
                  <Github className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">beetree/ARC-AGI</div>
                    <div className="text-xs text-zinc-500">Open source solver on GitHub</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto" />
                </a>

                <a
                  href="https://x.com/LandJohan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/60 hover:bg-sky-900/30 border border-zinc-700/50 hover:border-sky-500/40 transition-all group"
                >
                  <Twitter className="w-5 h-5 text-zinc-400 group-hover:text-sky-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">@LandJohan</div>
                    <div className="text-xs text-zinc-500">Follow on X / Twitter</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto" />
                </a>

                <a
                  href="/paper.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/60 hover:bg-fuchsia-900/30 border border-zinc-700/50 hover:border-fuchsia-500/40 transition-all group"
                >
                  <FileText className="w-5 h-5 text-zinc-400 group-hover:text-fuchsia-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Research Paper</div>
                    <div className="text-xs text-zinc-500">Read the full PDF</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto" />
                </a>

                <Separator className="bg-zinc-800" />

                {/* In-project link to Beetree solver */}
                <Link href="/puzzle/beetree/0a938d79">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer group">
                    <Trees className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-medium text-emerald-200">Try the Beetree Solver</div>
                      <div className="text-xs text-emerald-400/60">Run it now on sample puzzle 0a938d79</div>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            {/* Kaggle Results */}
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-lg font-bold text-zinc-100 mb-2">Kaggle & Results</h3>
                <a
                  href="https://www.kaggle.com/code/johanland/johan-land-solver-v6-public/output?scriptVersionId=286318109&select=submissions.tgz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  V6 Public Results on Kaggle
                </a>
                <a
                  href="https://github.com/beetree/ARC-AGI/blob/main/docs/RESULTS.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Results Documentation
                </a>
                <a
                  href="https://github.com/beetree/ARC-AGI/tree/Johan_Land_Solver_V7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  V7 Solver Branch
                </a>
                <a
                  href="https://x.com/LandJohan/status/2008197725263716589"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  76.11% Announcement (Jan 5)
                </a>
              </CardContent>
            </Card>

            {/* Friend of the Project callout */}
            <div className="border border-cyan-500/30 rounded-xl p-5 bg-gradient-to-br from-cyan-950/40 to-zinc-900/80">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold">
                  Friend of the Project
                </span>
              </div>
              <p className="text-sm text-cyan-100/80 leading-relaxed">
                Johan's Beetree solver has been part of ARC Explainer since December 2025. 
                His open-source work, willingness to share analysis, and presence in the ARC 
                Discord community have been invaluable. We're proud to host his research 
                and celebrate this incredible achievement.
              </p>
            </div>

            {/* ARC Prize Official Link */}
            <a
              href="https://arcprize.org"
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 hover:bg-zinc-800/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-200 group-hover:text-white">ARC Prize</div>
                  <div className="text-xs text-zinc-500">arcprize.org</div>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto" />
              </div>
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-800 pt-4 mt-8">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
            <Link href="/hall-of-fame">
              <span className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1">
                <Crown className="w-3 h-3" /> Back to Hall of Fame
              </span>
            </Link>
            <Link href="/puzzle/beetree/0a938d79">
              <span className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1">
                <Trees className="w-3 h-3" /> Try Beetree Solver
              </span>
            </Link>
            <a
              href="https://github.com/beetree/ARC-AGI"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <Github className="w-3 h-3" /> beetree/ARC-AGI
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
