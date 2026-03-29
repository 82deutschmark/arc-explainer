/*
 * Author: Cascade (Claude Opus 4.6 thinking)
 * Date: 2026-03-29
 * PURPOSE: ARC-AGI-3 reference and history page. Dense, dark-themed layout modeled on
 *          ClaudeCodeGuide.tsx (/cc). Presents useful links up top, brief explainer prose,
 *          compact timeline table, preview-era game reference tables, and external resources.
 *          Replaces the marketing-style story page from 2026-03-27.
 *          Content is restricted to facts documented in this repo's own analysis files,
 *          game metadata (shared/arc3Games/), and the ARC3-HISTORY-PAGE-BRIEF.md.
 * SRP/DRY check: Pass — single-purpose reference page, reuses usePageMeta hook and shared game data types.
 */

import React from 'react';
import { Link } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

/* ------------------------------------------------------------------ */
/*  Static data — sourced from shared/arc3Games metadata + analysis   */
/* ------------------------------------------------------------------ */

const QUICK_LINKS = [
  { label: 'Play games / run agents', url: 'https://arc3.sonpham.net', note: 'Son Pham\u2019s open-source harness' },
  { label: 'Official ARC-AGI-3 platform', url: 'https://three.arcprize.org' },
  { label: 'ARCEngine source', url: 'https://github.com/arcprize/ARCEngine', note: 'The game engine, open-sourced March 2026' },
  { label: 'ARC Prize overview', url: 'https://arcprize.org/arc-agi/3/' },
];

/* Timeline rows. Only facts documented in ARC3-HISTORY-PAGE-BRIEF.md and the repo git history. */
const TIMELINE = [
  { when: 'Late July 2025', what: 'Preview competition launches. Three games released publicly: ls20 (Locksmith), as66 (Always Sliding), ft09 (Functional Tiles).' },
  { when: 'August 2025', what: 'Evaluation set revealed: lp85 (Loop and Pull), sp80 (Streaming Purple), vc33 (Volume Control). Six games total now documented on this site.' },
  { when: 'Late 2025', what: 'Dries Smit\u2019s StochasticGoose agent wins the preview competition.' },
  { when: 'March 2026', what: 'ARCEngine open-sourced with 40+ games. as66 is notably absent from the new catalog. Son Pham launches arc3.sonpham.net as the community play/agent harness.' },
  { when: 'Now', what: 'ARC Prize 2026 competition underway. Game catalog continues to expand.' },
];

interface PreviewGame {
  id: string;
  name: string;
  input: string;
  difficulty: string;
  note?: string;
}

/* Preview set — the 3 games public from the start of the preview period */
const PREVIEW_SET: PreviewGame[] = [
  { id: 'ls20', name: 'Locksmith', input: 'D-pad (Up/Down/Left/Right)', difficulty: 'Hard' },
  { id: 'as66', name: 'Always Sliding', input: 'D-pad (Up/Down/Left/Right)', difficulty: 'Easy', note: 'Missing from March 2026 catalog' },
  { id: 'ft09', name: 'Functional Tiles', input: 'Click', difficulty: 'Medium' },
];

/* Evaluation set — held back, revealed after the preview period */
const EVAL_SET: PreviewGame[] = [
  { id: 'lp85', name: 'Loop and Pull', input: 'Click', difficulty: 'Hard' },
  { id: 'sp80', name: 'Streaming Purple', input: 'Click + Interact', difficulty: 'Medium' },
  { id: 'vc33', name: 'Volume Control', input: 'Click', difficulty: 'Medium' },
];

const RESOURCES = [
  { title: 'ARC-AGI-3 Preview: 30-Day Learnings', url: 'https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings', desc: 'ARC Prize blog post on preview-period findings.' },
  { title: 'StochasticGoose \u2014 1st Place Preview Agent', url: 'https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db', desc: 'Dries Smit\u2019s writeup on winning the preview competition.' },
  { title: 'Son Pham\u2019s ARC-AGI-3 Harness', url: 'https://arc3.sonpham.net', desc: 'Play games and run agents in-browser. Multi-provider LLM support, Python sandbox, replay sharing.' },
  { title: 'ARCEngine on GitHub', url: 'https://github.com/arcprize/ARCEngine', desc: 'Official open-source game engine powering ARC-AGI-3.' },
  { title: 'ARC-AGI-3 Technical Docs', url: 'https://docs.arcprize.org', desc: 'API docs, game format spec, agent building guide.' },
];

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 transition-colors"
    >
      {children}
    </a>
  );
}

function GameTable({ games, label }: { games: PreviewGame[]; label: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 pr-4 font-semibold text-slate-400">ID</th>
              <th className="text-left py-2 pr-4 font-semibold text-slate-400">Name</th>
              <th className="text-left py-2 pr-4 font-semibold text-slate-400">Input</th>
              <th className="text-left py-2 pr-4 font-semibold text-slate-400">Difficulty</th>
              <th className="text-left py-2 font-semibold text-slate-400">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {games.map((g) => (
              <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 pr-4">
                  <Link href={`/arc3/games/${g.id}`} className="font-mono text-green-400 hover:text-green-300 transition-colors">
                    {g.id}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-slate-300">{g.name}</td>
                <td className="py-2.5 pr-4 text-slate-400 text-xs">{g.input}</td>
                <td className="py-2.5 pr-4 text-slate-400">{g.difficulty}</td>
                <td className="py-2.5 text-slate-500 text-xs italic">{g.note || '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function Arc3Story() {
  usePageMeta({
    title: 'ARC-AGI-3 \u2014 Reference & History',
    description:
      'Reference page for ARC-AGI-3 interactive reasoning benchmarks. Timeline, preview-era game documentation, useful links, and community resources.',
    canonicalPath: '/arc3',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10 border-b border-slate-800 pb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">ARC-AGI-3</h1>
          <p className="text-sm text-slate-400">
            Reference and history of ARC-AGI-3 interactive reasoning benchmarks.
            This site documents what we\u2019ve learned since the preview period and links to where the action is now.
          </p>
        </div>

        {/* Quick Links */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-3 rounded border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/70 transition-colors group"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">{link.label}</p>
                  {link.note && <p className="text-xs text-slate-500">{link.note}</p>}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* What Is ARC-AGI-3? */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">What Is ARC-AGI-3?</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              ARC-AGI-3 is a collection of interactive games. Each game runs on a 64\u00d764 pixel grid
              with a 16-color palette. There are no instructions, no tutorials, and no hints. The player
              gets up to 7 actions and has to figure out what the game is, what the controls do, and how
              to win — purely by experimenting and observing what happens.
            </p>
            <p>
              The benchmark measures whether an AI system can learn a completely new game from scratch,
              in real time, with no prior training on that specific task. ARC Prize calls these{' '}
              <em>Interactive Reasoning Benchmarks</em>.
            </p>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Timeline</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-6 font-semibold text-slate-400 whitespace-nowrap">When</th>
                  <th className="text-left py-2 font-semibold text-slate-400">What</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {TIMELINE.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-6 text-slate-400 whitespace-nowrap align-top">{row.when}</td>
                    <td className="py-2.5 text-slate-300">{row.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Preview-Era Games */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Preview-Era Games (2025)</h2>
          <p className="text-xs text-slate-500 mb-5">
            The six games documented during the preview competition. Click a game ID for mechanics, screenshots, and analysis.
            Games have been updated since this period — our documentation reflects the preview-era versions.
          </p>
          <GameTable games={PREVIEW_SET} label="Preview set (public from the start)" />
          <GameTable games={EVAL_SET} label="Evaluation set (revealed after the preview)" />
          <p className="text-xs text-slate-500 border-l-2 border-slate-700 pl-3">
            <strong className="text-slate-400">as66</strong> did not appear in the March 2026 ARCEngine catalog.
            It may be held back for evaluation, or retired. Our documentation of that game may cover content
            no longer publicly available.
          </p>
        </section>

        {/* How Scoring Works */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">How Games Work</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              Each game has multiple levels. An agent observes the grid state, chooses an action (numbered 1\u20137,
              plus a reset action), and receives the updated grid. There is no text, no explicit reward signal —
              the agent infers everything from visual changes to the grid.
            </p>
            <p>
              Games track a <strong className="text-slate-100">win score</strong>: the number of levels
              successfully completed within the allowed number of steps.
            </p>
            <p className="text-xs text-slate-500 border-l-2 border-slate-700 pl-3">
              Competition scoring details for 2026 (prize structure, aggregate scoring protocol) are still being
              confirmed. This section will be updated as official information is published.
            </p>
          </div>
        </section>

        {/* Resources */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Resources</h2>
          <div className="divide-y divide-slate-800">
            {RESOURCES.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-3 group"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-8 mt-4">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            \u2190 Back to ARC Explainer
          </Link>
        </div>

      </div>
    </div>
  );
}
