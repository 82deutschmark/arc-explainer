/*
 * Author: Cascade (Claude Opus 4.6 thinking); updated by Claude Fable 5; updated by Claude Opus 5
 * Date: 2026-03-29 (updated 2026-07-30)
 * PURPOSE: ARC-AGI-3 reference and history page. Dense, dark-themed layout modeled on
 *          ClaudeCodeGuide.tsx (/cc). Presents useful links up top, brief explainer prose,
 *          compact timeline table, preview-era game reference tables, environment-construction
 *          breakdown, RHAE scoring spec, leaderboard policy, duck harness section, and
 *          external resources.
 *          Content is restricted to facts documented in the official ARC-AGI-3 Technical
 *          Report (arcprize.org/media/ARC_AGI_3_Technical_Report.pdf, April 22 2026, read in
 *          full 2026-07-30), this repo's own analysis files, game metadata (shared/arc3Games/),
 *          ARC3-HISTORY-PAGE-BRIEF.md, and the Tufa Labs duck harness publication.
 * SRP/DRY check: Pass — single-purpose reference page. Reuses usePageMeta, shared game data
 *          types, and a local RefTable helper for all non-game reference tables rather than
 *          repeating <table> markup per section.
 Updated 2026-08-28 (Claude Opus 5): hub links retargeted from "/" to "/home", since "/" now redirects to the ARC-AGI-3 game gallery.
 */

import React from 'react';
import { Link } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

/* ------------------------------------------------------------------ */
/*  Static data — technical report + shared/arc3Games metadata         */
/* ------------------------------------------------------------------ */

const REPORT_URL = 'https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf';

const QUICK_LINKS = [
  { label: 'ARC-AGI-3 Technical Report (PDF)', url: REPORT_URL, note: 'The official spec — April 22, 2026' },
  { label: 'Play games / run agents', url: 'https://arc3.sonpham.net', note: 'Son Pham’s open-source harness' },
  { label: 'Official ARC-AGI-3 platform', url: 'https://three.arcprize.org' },
  { label: 'ARCEngine source', url: 'https://github.com/arcprize/ARCEngine', note: 'The game engine, open-sourced March 2026' },
  { label: 'ARC Prize overview', url: 'https://arcprize.org/arc-agi/3/' },
];

/* The four functional components of agentic intelligence the benchmark targets (report §2.1) */
const PILLARS = [
  ['Exploration', 'Information is never handed over. The agent has to go get it by poking at the environment.'],
  ['Modeling', 'Turn raw frames into a world model that predicts what happens next.'],
  ['Goal-setting', 'Decide what is even worth aiming for. Nobody says what winning looks like.'],
  ['Planning and execution', 'Map a path from here to that goal, and course-correct when the environment disagrees.'],
];

/* Dataset composition — report Table 1 */
const DATASETS = [
  ['Public demo', 'Shows the format and basic mechanics. The community front door.', '25'],
  ['Semi-private', 'Tests frontier models behind an external API. Small leakage risk, knowingly accepted.', '55'],
  ['Fully private', 'The competition set. Handed to a very limited number of partners.', '55'],
];

/* Production pipeline — report §3.2 */
const PIPELINE = [
  ['1. Specification', 'The developer writes a concept description. The team reviews it before any code exists.', 'Design problems get caught before implementation cost is sunk.'],
  ['2. Internal', 'The developer builds a prototype and the team plays it.', 'It works, and the mechanics are legible with no instructions.'],
  ['3. External', 'Ten members of the public attempt it cold.', 'At least two must independently finish every level. Failures go back to the developer.'],
  ['4. Done', 'Sorted into the public, semi-private, or fully private set.', '—'],
];

/* Design constraints every candidate environment must satisfy — report §3.4 */
const DESIGN_RULES = [
  ['Core knowledge priors only', 'Objectness, geometry and topology, intuitive physics, agentness. Nothing you had to be taught.'],
  ['No language, no culture', 'No numbers, no letters, no recognisable clip-art like keys or flowers, no conventions like green meaning "go".'],
  ['Novel against every other environment', 'The concrete test: if one program can solve two environments while being at least 50% shorter than two separate solutions glued together, those environments are too alike.'],
  ['Solvable by a human in ~20 minutes', 'Most take only a few minutes.'],
  ['Difficulty through composition', 'Later levels combine mechanics learned earlier. Not bigger grids, not obscurity.'],
  ['Multiple mechanics per environment', 'A single mechanic scaled up in size or difficulty is treated as an anti-pattern.'],
  ['Level 1 is a tutorial', 'Deliberately easy, and it teaches the interaction pattern. A random agent occasionally stumbling through it is fine by design.'],
  ['At least six levels', 'Levels run in sequence and a completed one cannot be revisited.'],
  ['Opaque four-character IDs', 'Longer internal names exist but are never published — the name would leak the goal.'],
];

/* Automated validation gates — report §3.5 */
const VALIDATION = [
  ['Random play, short', '50,000 steps', 'No level can be beaten by accident. A sanity check against degenerate reward paths.'],
  ['Random play, long', '1,000,000 steps', 'Non-tutorial levels stay unbeaten under uninformed random play. Progress has to require structure, not luck.'],
  ['Full sweep / fuzzing', '1,000,000 steps across all levels', 'Surfaces crashes, malformed transitions, invalid frame output, inconsistent hidden state, and rare action-sequence defects.'],
  ['Recorded playback', 'Known-good win and loss recordings', 'The engine replays action traces faithfully. Proof it can serialise and re-execute, which regression testing and auditing both depend on.'],
  ['State-space graph', 'Step, time, node and edge budgets', 'A random policy must not solve a level more often than 1 in 10,000 attempts.'],
];

/* RHAE scoring — report §4.1 and §4.2 */
const SCORING = [
  ['Level score', 'min(1.15, (human baseline ÷ agent actions)²)', 'Squaring punishes waste hard — 10× the human action count earns 1%, not 10%. The 1.15 cap stops one exploited level from carrying an environment.'],
  ['Level weighting', 'Level l carries weight l', 'In a five-level environment, level 1 is 1/15th of the score and level 5 is 5/15ths. Tutorials count for almost nothing.'],
  ['Environment cap', 'Weighted fraction of levels completed', 'Finish 3 of 5 levels and the environment cannot score above 6/15 = 40%, however efficient you were on those three.'],
  ['Benchmark score', 'Mean of all environment scores', 'Lands between 0% and 100%.'],
  ['Action budget', '5× the human median per level', 'A run is cut off after 5n actions on a level whose human median is n. A cost control — with power-law decay the score difference is negligible.'],
];

/* Semi-private leaderboard at release — report Table 2 */
const RELEASE_SCORES = [
  ['Anthropic', 'Opus 4.6 (Max)', '0.50%'],
  ['Google', 'Gemini 3.1 Pro Preview', '0.40%'],
  ['OpenAI', 'GPT 5.4 (High)', '0.20%'],
  ['xAI', 'Grok-4.20 (Beta 0309 Reasoning)', '0.10%'],
];

/* Timeline rows. Facts from the technical report, ARC3-HISTORY-PAGE-BRIEF.md, and repo git history. */
const TIMELINE = [
  { when: 'Jul–Aug 2025', what: 'Preview agent competition runs for 30 days (July 18 – August 19). Three public environments — ls20 (Locksmith), as66 (Always Sliding), ft09 (Functional Tiles) — with three more held back as a hidden evaluation set.' },
  { when: 'August 2025', what: 'Evaluation set revealed: lp85 (Loop and Pull), sp80 (Streaming Purple), vc33 (Volume Control). Six games total now documented on this site.' },
  { when: 'Late 2025', what: 'StochasticGoose (Dries Smit, Tufa Labs) wins the preview competition with 12.58% and 18 levels completed, using a four-layer CNN with reinforcement learning to predict which actions change the frame. Blind Squirrel takes second at 6.71% by building a directed state graph.' },
  { when: 'March 2026', what: 'ARCEngine open-sourced with 40+ games. as66 is notably absent from the new catalog. Son Pham launches arc3.sonpham.net as the community play/agent harness.' },
  { when: 'April 22, 2026', what: 'ARC-AGI-3 technical report published: 135 environments across three sets, RHAE scoring, and the first official leaderboard — every frontier model under 1%.' },
  { when: 'July 2026', what: 'Tufa Labs publishes the duck harness — a minimal REPL-based coding harness for the ARC-AGI-3 Kaggle competition, open-sourced on GitHub.' },
  { when: 'Now', what: 'ARC Prize 2026 is underway on Kaggle with a $2M pool across two tracks. This is the final year of the ARC-AGI-2 track, and its grand prize is guaranteed to pay out.' },
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
  { title: 'ARC-AGI-3 Technical Report (PDF)', url: REPORT_URL, desc: 'The official 23-page specification: benchmark design, RHAE scoring, environment construction, human calibration. April 22, 2026.' },
  { title: 'Duck Harness — Tufa Labs', url: 'https://tufalabs.ai/research/duck-harness/', desc: 'Research post on the REPL-based coding harness for the 2026 Kaggle competition.' },
  { title: 'duck-harness on GitHub', url: 'https://github.com/Tufalabs/duck-harness', desc: 'Open-source code for the duck harness, including diagnostic tools.' },
  { title: 'Duck Harness — Kaggle technical write-up', url: 'https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/717133', desc: 'Technical details on the Kaggle competition forum.' },
  { title: 'ARC-AGI-3 Technical Report on arXiv', url: 'https://arxiv.org/abs/2603.24621', desc: 'Mirror of the same report, if you prefer arXiv’s reader to the PDF.' },
  { title: 'Arcgentica — Symbolica AI', url: 'https://github.com/symbolica-ai/ARC-AGI-3-Agents', desc: 'Orchestrator/subagent harness. The orchestrator never touches the environment; subagents return compressed summaries.' },
  { title: 'ARC-AGI Community Leaderboard', url: 'https://github.com/arcprize/ARC-AGI-Community-Leaderboard', desc: 'The code behind the public, self-reported community leaderboard.' },
  { title: 'ARC-AGI-3 Preview: 30-Day Learnings', url: 'https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings', desc: 'ARC Prize blog post on preview-period findings.' },
  { title: 'StochasticGoose — 1st Place Preview Agent', url: 'https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db', desc: 'Dries Smit’s writeup on winning the preview competition.' },
  { title: 'Son Pham’s ARC-AGI-3 Harness', url: 'https://arc3.sonpham.net', desc: 'Play games and run agents in-browser. Multi-provider LLM support, Python sandbox, replay sharing.' },
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

/* Generic reference table. First column is emphasised; remaining columns are body text. */
function RefTable({
  headers,
  rows,
  label,
  numericLastColumn = false,
}: {
  headers: string[];
  rows: string[][];
  label?: string;
  numericLastColumn?: boolean;
}) {
  return (
    <div className="mb-1">
      {label && <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`py-2 font-semibold text-slate-400 ${i === headers.length - 1 ? '' : 'pr-4'} ${
                    numericLastColumn && i === headers.length - 1 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row, r) => (
              <tr key={r} className="align-top">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`py-2.5 ${c === row.length - 1 ? '' : 'pr-4'} ${
                      c === 0
                        ? 'text-slate-200 font-medium whitespace-nowrap'
                        : 'text-slate-400'
                    } ${numericLastColumn && c === row.length - 1 ? 'text-right font-mono text-slate-300' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
                <td className="py-2.5 text-slate-500 text-xs italic">{g.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Small emphasised aside, used for caveats and source notes. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-500 border-l-2 border-slate-700 pl-3 leading-relaxed">{children}</p>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function Arc3Story() {
  usePageMeta({
    title: 'ARC-AGI-3 — Reference & History',
    description:
      'Reference page for ARC-AGI-3 interactive reasoning benchmarks. How the environments are built, how RHAE scoring works, timeline, preview-era game documentation, and community resources.',
    canonicalPath: '/arc3',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10 border-b border-slate-800 pb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">ARC-AGI-3</h1>
          <p className="text-sm text-slate-400">
            Reference and history of ARC-AGI-3 interactive reasoning benchmarks. Built from the
            official <ExtLink href={REPORT_URL}>technical report</ExtLink> (April 22, 2026), what
            we’ve learned here since the preview period, and links to where the action is now.
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
              ARC-AGI-3 is a collection of interactive, turn-based environments. Each one runs on a
              64×64 grid with a 16-color palette. There are no instructions, no tutorials, and no
              hints. The player has to work out what the game is, what the controls do, and what
              counts as winning — purely by experimenting and watching what changes.
            </p>
            <p>
              Where ARC-AGI-1 and 2 tested inferring a rule from static example pairs, ARC-AGI-3
              targets <strong className="text-slate-100">agentic</strong> intelligence, and measures it
              as <strong className="text-slate-100">efficiency</strong>: how many actions you burn
              getting through an environment you have never seen before. Everything — data, time,
              compute, risk — is collapsed into that one number so humans and AI can be compared on the
              same scale.
            </p>
          </div>

          <div className="mt-5">
            <RefTable
              label="Four things it measures"
              headers={['Component', 'What it means']}
              rows={PILLARS}
            />
          </div>

          <div className="mt-5">
            <Note>
              Humans solve 100% of the environments. As of March 2026, frontier AI systems score
              under 1%. The benchmark is beaten when an AI matches or beats human action efficiency
              on environments it is seeing for the first time, averaged across the private sets.
            </Note>
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
          <Note>
            <strong className="text-slate-400">as66</strong> did not appear in the March 2026 ARCEngine catalog.
            It may be held back for evaluation, or retired. Our documentation of that game may cover content
            no longer publicly available.
          </Note>
        </section>

        {/* How Games Work */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">How Games Work</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              An environment is a series of levels. Each turn the agent receives a{' '}
              <strong className="text-slate-100">frame</strong> — the current 64×64 grid — or a short
              sequence of frames when something animates between turns. It then submits exactly one
              action. Nothing moves on its own: the environment never changes state except in response
              to an action, which is what makes this a reasoning test rather than a reflex test.
            </p>
            <p>
              The action space is small on purpose. Each environment exposes a subset of{' '}
              <strong className="text-slate-100">five key actions plus Undo</strong> (revert to the
              previous state), and <strong className="text-slate-100">one action that selects a cell</strong>{' '}
              by coordinate — a click. Complexity is meant to live in the environment's logic, not in
              the controls.
            </p>
            <p>
              Only environment-affecting turns count as actions. Tool calls, reasoning steps, and
              internal retries are free — they cost you nothing on the scoreboard.
            </p>
          </div>

          <div className="mt-5">
            <RefTable
              label="Dataset composition — 135 environments total"
              headers={['Set', 'Purpose', '#']}
              rows={DATASETS}
              numericLastColumn
            />
          </div>

          <div className="mt-5">
            <Note>
              ARC-AGI-2 ran roughly 10:1 public to private. ARC-AGI-3 flips it. The public set is no
              longer a training resource — it is a demonstration interface, and it does not
              deliberately cover the mechanics found in the private sets.
            </Note>
          </div>
        </section>

        {/* How Environments Get Built — the synthetic-generation recipe */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">How the Games Get Made</h2>
          <p className="text-xs text-slate-500 mb-5">
            ARC Prize ran an in-house game studio to build these. The report spells out the pipeline,
            the rules, and the automated gates — which together read as a recipe for generating
            ARC-AGI-3-style environments at scale.
          </p>

          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
            <p>
              They tried Unity first and threw it out — too heavy, too slow to iterate on. The final
              engine is custom, written in Python, and targets{' '}
              <strong className="text-slate-100">1,000 frames per second</strong>. That number is not
              about gameplay. It exists because validation needs to run millions of random steps
              through every environment, and that only works if the engine is very fast.
            </p>
            <p>
              Coming up with ideas turned out to be harder than building them. Developers also worked
              on three or four environments at once at different stages, because ideation, coding,
              playtesting, and revision all move at different speeds — doing one at a time stalled
              everyone.
            </p>
          </div>

          <div className="mb-6">
            <RefTable
              label="The four-stage pipeline"
              headers={['Stage', 'What happens', 'What it has to pass']}
              rows={PIPELINE}
            />
          </div>

          <div className="mb-6">
            <RefTable
              label="Rules every candidate has to satisfy"
              headers={['Rule', 'In practice']}
              rows={DESIGN_RULES}
            />
          </div>

          <div className="mb-6">
            <RefTable
              label="Automated gates — no humans involved"
              headers={['Check', 'Budget', 'Pass condition']}
              rows={VALIDATION}
            />
          </div>

          <h3 className="text-base font-semibold text-slate-200 mb-2">The state-space graph</h3>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
            <p>
              The most interesting gate is the last one. Starting from a level's reset state, the
              validator builds a directed graph: every node is a distinct environment state, every
              edge is a legal action. Node identity is a hash, so two different routes that arrive at
              the same state merge into one node instead of staying separate rollouts. Invalid actions
              get recorded as edges that go nowhere. Terminal states — level complete, environment
              complete — are marked explicitly. It expands until it hits a step, time, node, or edge
              budget.
            </p>
            <p>
              Out of that you get cycle detection, maximum depth, merge density, whether the reachable
              space was fully explored, and — the payoff —{' '}
              <strong className="text-slate-100">mathematically grounded bounds on the odds that a
              random policy wins</strong>, even when the graph is too big to enumerate. The acceptance
              bar is 1 in 10,000. Tutorial levels are exempt: the first level of{' '}
              <span className="font-mono text-green-400">ls20</span> has a random-win probability of
              exactly 1 in 355, and that is fine by design.
            </p>
          </div>

          <h3 className="text-base font-semibold text-slate-200 mb-2">Then humans, three days a week</h3>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
            <p>
              Anything that clears the automated gates goes to a testing center in San Francisco,
              Monday, Wednesday, Friday. Participants are ordinary members of the public, given no
              instructions and 90-minute sessions, with a soft 20-minute limit per environment and a
              hard cutoff at 30. One attempt each, no revisiting completed levels, resets allowed.
            </p>
            <p>
              Ten people see each environment. It only ships if at least{' '}
              <strong className="text-slate-100">two of them independently finish every level</strong>.
              Miss that bar and it goes back to the developer, who gets per-level completion rates to
              find the drop-off point plus video replays to watch exactly where people got stuck.
            </p>
            <p>
              Across the whole effort: 486 participants, 414 candidate environments, 2,893 attempts,
              427.9 hours of play. Median attempt, 7.4 minutes. Of those 414 candidates,{' '}
              <strong className="text-slate-100">135 shipped</strong>.
            </p>
          </div>

          <h3 className="text-base font-semibold text-slate-200 mb-2">What this means for synthetic games</h3>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-5">
            <p>
              Everything above the human step is code. Generate a candidate, run the random regimes,
              build the graph, check the win probability, replay the recordings — no person has to be
              in the loop to throw out a broken or trivial environment. Even the novelty rule is
              mechanisable: solve two environments with one program, compare its length against two
              separate solutions, discard the pair if it comes in more than 50% shorter. That gives you
              generation, verification, and deduplication without a studio.
            </p>
            <p>
              The report also explains why anyone would bother. It argues ARC-AGI-1 and 2 were likely
              cracked by exactly this loop: have a model generate tasks, solve them, verify the
              solutions, train on the reasoning traces, repeat. Scale that to millions of tasks and you
              cover the domain densely enough that the model barely needs to adapt at test time. As
              evidence, they note that during ARC-AGI-2 verification a frontier model used the correct
              ARC integer-to-color mapping in its reasoning despite the prompt never mentioning ARC or
              that mapping at all. ARC-AGI-3 environments are verifiable too, the engine is open
              source, and the validators are now published. The same loop is buildable here.
            </p>
          </div>

          <Note>
            <strong className="text-slate-400">The catch, stated plainly.</strong> ARC Prize calls
            training on synthetically generated ARC-AGI-3 lookalikes{' '}
            <em>domain-specific overfitting</em>, and it is explicitly excluded from the official
            leaderboard — results go on the self-reported community board instead. Their evidence that
            this stuff does not generalise: in a variant of environment TR87, Opus 4.6 scores 0.0% with
            no harness and 97.1% with the Duke harness, yet on BP35 it scores 0.0% either way. The
            counterweight, in their own words, is that genuinely general harness ideas tend to migrate
            behind the model API — chain-of-thought started as a third-party wrapper around GPT-3 and
            ended up as o1. So this work can be valuable and still not count as AGI progress.
          </Note>
        </section>

        {/* Scoring */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">How Scoring Works — RHAE</h2>
          <p className="text-xs text-slate-500 mb-5">
            Relative Human Action Efficiency, pronounced “Ray.” Inspired by the robotics SPL metric,
            which rewards reaching the goal <em>and</em> the path taken to get there.
          </p>

          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
            <p>
              You are not scored on whether you win. You are scored on how many actions you needed
              compared to a human, level by level. The{' '}
              <strong className="text-slate-100">human baseline</strong> is the upper-median best
              first-run human action count — rank everyone who completed that level by action count and
              take the upper-median performer, e.g. 3rd place among 5. Robust against one outlier
              genius, still a demanding target.
            </p>
            <p>
              Scoring per level rather than per environment is deliberate. In vc33, level 6 takes about
              ten times the actions of level 1 — pooled scoring would let the long levels drown out
              everything else, and you would lose the ability to see <em>where</em> an agent falls
              apart.
            </p>
          </div>

          <div className="mb-6">
            <RefTable
              headers={['Term', 'Formula', 'What it does']}
              rows={SCORING}
            />
          </div>

          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-5">
            <p>
              Human data tracks three reference points: the{' '}
              <strong className="text-slate-100">optimal playthrough</strong> (fewest actions once you
              already know the environment), the{' '}
              <strong className="text-slate-100">best first-run playthrough</strong> (best per-level
              first attempt by anyone), and the <strong className="text-slate-100">human baseline</strong>{' '}
              used for scoring. The gap between the first two is the price of exploration — what it
              costs to learn the rules while playing.
            </p>
          </div>

          <Note>
            The report's design section requires at least six levels per environment, while its scoring
            examples work through a five-level case. The weighting rule is what matters: level{' '}
            <em>l</em> carries weight <em>l</em>, and the denominator is the sum of all level weights.
          </Note>
        </section>

        {/* Leaderboards */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Two Leaderboards</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6">
            <p>
              The <strong className="text-slate-100">official leaderboard</strong> exists to show how
              close frontier models are to human-level general intelligence, so it strips out anything
              that looks like targeting ARC-AGI-3 specifically. It{' '}
              <strong className="text-slate-100">uses no harness at all</strong>, gives models no tools,
              and runs every model under one shared system prompt — which does nothing more than tell
              the model it is playing a game, that its goal is to win, that the final action in its
              reply gets executed next turn, and that its whole reply carries forward. The reasoning:
              a real AGI system would not need task-specific handholding to approach something new.
            </p>
            <p>
              Public set scores are <strong className="text-slate-100">never</strong> reported
              officially. ARC Prize is releasing an open-source harness that scores 100% on the entire
              public set using human replay, to make the point that public numbers are meaningless as
              evidence of progress.
            </p>
            <p>
              The <strong className="text-slate-100">community leaderboard</strong> is where harness
              work goes. Public, open to anyone, self-reported, and unverified by default. ARC Prize
              considers harness research economically valuable but explicitly cautions against reading
              those scores as AGI progress.
            </p>
          </div>

          <RefTable
            label="Semi-private leaderboard at release"
            headers={['Provider', 'Model', 'Score']}
            rows={RELEASE_SCORES}
            numericLastColumn
          />

          <div className="mt-5">
            <Note>
              Every frontier model is under 1%. Humans clear these environments completely, cold, in a
              median of 7.4 minutes.
            </Note>
          </div>
        </section>

        {/* Duck Harness */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">The Duck Harness</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              In July 2026, Tufa Labs published the{' '}
              <ExtLink href="https://tufalabs.ai/research/duck-harness/">duck harness</ExtLink> — an
              open-source agent harness for the ARC-AGI-3 competition on Kaggle. Rather than a bespoke
              agent architecture, it is a minimal coding harness: the model works inside a Python REPL
              where every game observation is encoded as Python variables. It inspects state with tool
              calls, evaluates pre-built helper functions, and takes game actions from within that loop.
            </p>
            <p>
              The published system is built around <strong className="text-slate-100">Qwen 3.6 27B FP8</strong>,
              feeds the model both image and text representations of the grid, and keeps context short by
              automatically evicting the oldest messages. Across the 25 public games (20 attempts each)
              it reports a mean score of <strong className="text-slate-100">1.6002 ± 0.4475</strong>.
              Evaluated with GPT 5.4, it solves a similar set of games to the Executable World Models
              approach while being an order of magnitude cheaper per game.
            </p>
            <p>
              It sits in a lineage of context-management harnesses. Duke University's approach lets the
              model run arbitrary Python over its own action history to pull out what matters — 64×64
              frames blow through a context budget fast if you just keep a rolling window. Symbolica
              AI's Arcgentica uses an orchestrator that never touches the environment itself, delegating
              to subagents that hand back compressed summaries. Both solved all three public preview
              environments; Duke's did it with action counts comparable to humans.
            </p>
            <Note>
              Performance is uneven: some games are solved consistently for over 40% of their levels,
              while on others the harness never clears the first level. The authors note they are
              ultimately limited by the constraints of the Kaggle environment. Note also that harness
              results of any kind belong to the community leaderboard, not the official one.
            </Note>
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
          <Link href="/home" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to ARC Explainer
          </Link>
        </div>

      </div>
    </div>
  );
}
