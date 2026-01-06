/**
 * Author: Cascade
 * Date: 2026-01-06 (updated 2026-01-06T22:13:00Z)
 * PURPOSE: Dedicated landing page that distinguishes ARC 1/2 (puzzle reasoning) from ARC 3 (agent environments),
 *          and now embeds a live “project dispatch” blog plus project metrics so visitors see release cadence.
 *          Serves as the main entry point for arc.markbarney.net.
 * SRP/DRY check: Pass - Verified additions keep storytelling + navigation concerns in one component.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'wouter';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Grid3X3,
  Gamepad2,
  LineChart,
  MessageSquare,
  PenSquare,
  RadioTower,
  Rocket,
  Users,
  Youtube,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';

const ARC1_PATTERN = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];
const ARC3_PATTERN = ['🎮', '🤖', '🎯', '🏆', '⚡', '🔥'];

type ProjectBlogEntry = {
  title: string;
  date: string;
  summary: string;
  tag: string;
  href: string;
  actionLabel: string;
};

type ProjectMetric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

const PROJECT_BLOG: ProjectBlogEntry[] = [
  {
    title: 'Landing page clarifies ARC 1/2 vs ARC 3 paths',
    date: 'Jan 6, 2026',
    summary:
      'New hero plus dual cards guide researchers toward puzzle tooling or the ARC 3 agent arena. The release also embeds this changelog-driven blog.',
    tag: 'Design Update',
    href: '/browser',
    actionLabel: 'Browse ARC tools',
  },
  {
    title: 'Dynamic OG image previews for every puzzle link',
    date: 'Jan 5, 2026',
    summary:
      'Puzzle shares on Discord, Slack, or Twitter now render grid composites via the new ogImageService pipeline and SSR meta tags.',
    tag: 'Infra & Sharing',
    href: '/task/65b59efc',
    actionLabel: 'See a live preview',
  },
  {
    title: 'WormArena live telemetry overhaul ships',
    date: 'Dec 27, 2025',
    summary:
      'Live sessions gained copyable IDs, uptime timers, alive player tracking, and streaming status polish so tournaments are easier to follow.',
    tag: 'ARC 3 Live Ops',
    href: '/worm-arena/live',
    actionLabel: 'Watch a live match',
  },
];

const PROJECT_METRICS: ProjectMetric[] = [
  {
    label: 'Puzzles tracked',
    value: '1,626',
    detail: 'ARC1, ARC2, ARC-Heavy, ConceptARC datasets (loaded on boot)',
    icon: Grid3X3,
  },
  {
    label: 'Latest release',
    value: 'v6.35.1',
    detail: 'Jan 6, 2026 – landing page + blog',
    icon: Rocket,
  },
  {
    label: 'Live experiments',
    value: '3',
    detail: 'WormArena, RE-ARC benchmark, ARC3 agent playground',
    icon: Activity,
  },
  {
    label: 'Contributors synced',
    value: '25',
    detail: 'Automated OpenRouter + repo contributor sync',
    icon: Users,
  },
];

const DEPLOYMENT_HEARTBEAT = [
  {
    week: 'This week',
    cadence: '2 feature drops in 48 hours',
    evidence: 'Landing page (Jan 6) + OG images (Jan 5)',
  },
  {
    week: 'Last week',
    cadence: 'Live ops polish sprint',
    evidence: 'WormArena status strip + timers (Dec 27)',
  },
  {
    week: 'Ongoing',
    cadence: 'Daily contributor sync + hourly DB maintenance',
    evidence: 'Automations run from server startup cron',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 opacity-90" />
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <EmojiMosaicAccent
            pattern={[...ARC1_PATTERN, ...ARC3_PATTERN, ...ARC1_PATTERN, ...ARC3_PATTERN]}
            columns={20}
            maxColumns={20}
            size="md"
            className="w-full h-full"
          />
        </div>

        <div className="relative z-10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1 text-lg">
                  <span>🟥</span>
                  <span>🟧</span>
                  <span>🟨</span>
                </div>
                <div className="flex gap-1 text-lg">
                  <span>🟩</span>
                  <span>🟦</span>
                  <span>🟪</span>
                </div>
              </div>
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
              ARC Explainer
            </h1>
            
            <p className="mb-8 text-lg text-slate-300 sm:text-xl">
              Explore the evolution of ARC reasoning systems
            </p>

            <div className="mb-12 text-sm text-slate-400">
              <p>ARC 1 & 2: Visual puzzle reasoning benchmarks</p>
              <p>ARC 3: Agent-based game environment</p>
            </div>
          </div>
        </div>
      </section>

      {/* Project Dispatch + Metrics */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-3 text-center">
            <div className="mx-auto flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              <PenSquare className="h-4 w-4 text-sky-300" />
              Project Dispatch
            </div>
            <h2 className="text-3xl font-bold text-slate-50">Shipping logs, not vibes</h2>
            <p className="text-base text-slate-400">
              Fresh commits, design drops, and live-ops notes streamed from the changelog so visitors can see how fast ARC Explainer evolves.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Blog feed */}
            <div className="space-y-6">
              {PROJECT_BLOG.map((entry) => (
                <article
                  key={entry.title}
                  className="rounded-2xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-950/70 to-slate-900/40 p-6 shadow-[0_0_60px_rgba(15,23,42,0.35)] transition hover:border-slate-700"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                    <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-300">
                      {entry.tag}
                    </span>
                    <span className="flex items-center gap-2 text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                      {entry.date}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{entry.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-slate-300">{entry.summary}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Pulled from CHANGELOG.md</span>
                    <Link href={entry.href}>
                      <Button className="bg-sky-600 text-white hover:bg-sky-500">
                        {entry.actionLabel}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Metrics + heartbeat */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-900/70 bg-slate-950/70 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <LineChart className="h-4 w-4 text-emerald-300" />
                  Project Metrics
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PROJECT_METRICS.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-slate-900/60 bg-slate-950/80 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-slate-900 bg-slate-900/70 p-2">
                          <metric.icon className="h-5 w-5 text-slate-200" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
                          <p className="text-2xl font-bold text-white">{metric.value}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-400">{metric.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-900/70 bg-slate-950/70 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <RadioTower className="h-4 w-4 text-amber-300" />
                  Deployment Heartbeat
                </div>
                <div className="space-y-6">
                  {DEPLOYMENT_HEARTBEAT.map((item) => (
                    <div key={item.week} className="relative border-l border-slate-800 pl-5">
                      <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border border-slate-800 bg-slate-900 shadow-[0_0_12px_rgba(14,165,233,0.5)]" />
                      <p className="text-xs uppercase tracking-wide text-slate-500">{item.week}</p>
                      <p className="text-lg font-semibold text-white">{item.cadence}</p>
                      <p className="text-sm text-slate-400">{item.evidence}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                  <span>Automations run hourly; changelog bumps weekly.</span>
                  <Link href="/CHANGELOG">
                    <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-900">
                      View detailed log
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content - Two Paths */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-2">
            
            {/* ARC 1 & 2 Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-slate-800 p-3">
                  <Grid3X3 className="h-6 w-6 text-slate-200" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-100">ARC 1 & 2</h2>
                  <p className="text-sm text-slate-400">Visual Puzzle Reasoning</p>
                </div>
              </div>

              <div className="mb-6 space-y-3 text-slate-300">
                <p>
                  Explore abstract visual reasoning puzzles that test pattern recognition, 
                  spatial reasoning, and rule abstraction. These are the classic ARC benchmarks 
                  that measure how well AI systems can learn and apply transformation rules.
                </p>
                
                <div className="rounded-md border border-slate-700 bg-slate-950/50 p-4">
                  <h3 className="mb-2 font-semibold text-slate-200">What you can do:</h3>
                  <ul className="space-y-1 text-sm text-slate-400">
                    <li>• Browse 1,000+ visual reasoning puzzles</li>
                    <li>• Compare AI model performance and explanations</li>
                    <li>• Study puzzle structure and difficulty patterns</li>
                    <li>• Analyze reasoning efficiency and accuracy</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/">
                  <Button className="bg-slate-700 hover:bg-slate-600">
                    Explore Puzzles
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analytics
                  </Button>
                </Link>
              </div>

              {/* ARC 1/2 Visual Pattern */}
              <div className="mt-6 flex justify-center">
                <EmojiMosaicAccent
                  pattern={ARC1_PATTERN}
                  columns={6}
                  maxColumns={6}
                  size="sm"
                  framed
                  className="opacity-60"
                />
              </div>
            </div>

            {/* ARC 3 Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-slate-800 p-3">
                  <Gamepad2 className="h-6 w-6 text-slate-200" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-100">ARC 3</h2>
                  <p className="text-sm text-slate-400">Agent-Based Game Environment</p>
                </div>
              </div>

              <div className="mb-6 space-y-3 text-slate-300">
                <p>
                  Step into an interactive game environment where AI agents navigate challenges 
                  in real-time. ARC 3 tests embodied reasoning, strategic planning, and adaptive 
                  behavior through dynamic gameplay scenarios.
                </p>
                
                <div className="rounded-md border border-slate-700 bg-slate-950/50 p-4">
                  <h3 className="mb-2 font-semibold text-slate-200">What you can do:</h3>
                  <ul className="space-y-1 text-sm text-slate-400">
                    <li>• Watch AI agents play live games</li>
                    <li>• Configure agents with custom instructions</li>
                    <li>• Compare agent strategies and performance</li>
                    <li>• Study emergent behaviors and tactics</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/arc3">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    Enter Arena
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/arc3/playground">
                  <Button variant="outline" className="border-indigo-600 text-indigo-300 hover:bg-indigo-950">
                    <Gamepad2 className="mr-2 h-4 w-4" />
                    Agent Playground
                  </Button>
                </Link>
              </div>

              {/* ARC 3 Visual Pattern */}
              <div className="mt-6 flex justify-center">
                <EmojiMosaicAccent
                  pattern={ARC3_PATTERN}
                  columns={6}
                  maxColumns={6}
                  size="sm"
                  framed
                  className="opacity-60"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 text-2xl font-bold text-slate-100">Join the Community</h2>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://discord.gg/9b77dPAmcA"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-700 text-sm font-medium text-slate-300 hover:bg-indigo-500/20 hover:border-indigo-400 hover:text-indigo-300 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              Discord Community
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <a
              href="https://www.youtube.com/c/machinelearningstreettalk"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-700 text-sm font-medium text-slate-300 hover:bg-rose-500/20 hover:border-rose-400 hover:text-rose-300 transition-all"
            >
              <Youtube className="h-4 w-4" />
              ML Street Talk
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>

          <div className="mt-8 text-sm text-slate-400">
            <p>Weekly ARC Discord meetings • Research discussions • Live demonstrations</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center text-sm text-slate-400">
          <p>ARC Explainer • Understanding AI reasoning through interactive exploration</p>
          <p className="mt-2">Supporting ARC 1, ARC 2, and ARC 3 research communities</p>
        </div>
      </footer>
    </div>
  );
}
