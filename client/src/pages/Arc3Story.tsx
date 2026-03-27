/*
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2026-03-27
 * PURPOSE: ARC-AGI-3 story and explainer page. Timeline-focused editorial page that tells
 *          the history of ARC-AGI-3 from the preview competition through the full release.
 *          Explains what ARC3 is, how it differs from ARC 1&2, and directs users to
 *          arc3.sonpham.net for playing games and running agents.
 *          This replaces the old CommunityLanding game-launcher page at /arc3.
 * SRP/DRY check: Pass — single-purpose story/explainer page, reuses Arc3Timeline and shared game data.
 */

import React from 'react';
import { Link } from 'wouter';
import { ExternalLink, BookOpen, Gamepad2, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Arc3Timeline, type TimelineEntry } from '@/components/arc3/Arc3Timeline';
import { getAllGames } from '../../../shared/arc3Games';

/* ------------------------------------------------------------------ */
/*  Timeline data                                                      */
/* ------------------------------------------------------------------ */

const TIMELINE_ENTRIES: TimelineEntry[] = [
  {
    date: 'July 2025',
    title: 'The Preview Competition Launches',
    emphasis: 'past',
    description: (
      <>
        <p className="mb-2">
          ARC Prize announced ARC-AGI-3 with a preview agent competition and released six games
          to the public: <strong>ls20</strong> (Locksmith), <strong>as66</strong>, <strong>ft09</strong>,{' '}
          <strong>lp85</strong>, <strong>sp80</strong>, and <strong>vc33</strong>.
        </p>
        <p>
          These were the first interactive reasoning benchmarks anyone had seen. No instructions,
          no tutorials — just a 64×64 pixel grid, a handful of actions, and a game you had to
          figure out by experimenting. The community started reverse-engineering the rules immediately.
        </p>
      </>
    ),
  },
  {
    date: 'August – December 2025',
    title: 'The Community Digs In',
    emphasis: 'past',
    description: (
      <>
        <p className="mb-2">
          Researchers and hobbyists built agents, documented game mechanics, and shared strategies.
          This site published detailed breakdowns of each preview game — action mappings, level
          screenshots, and mechanic explanations written in plain language.
        </p>
        <p className="mb-2">
          Dries Smit's <strong>StochasticGoose</strong> agent won the preview competition,
          demonstrating that systematic exploration combined with reasoning could crack games
          that stumped most AI systems.
        </p>
        <p>
          During this period, the public game set was adjusted — some games were updated or
          rotated as the ARC Prize team iterated on the benchmark design.
        </p>
      </>
    ),
  },
  {
    date: 'March 2026',
    title: 'ARCEngine Goes Public — 40+ Games',
    emphasis: 'highlight',
    description: (
      <>
        <p className="mb-2">
          The full ARC Prize game engine (<strong>ARCEngine</strong>) was released as open source.
          The game catalog expanded from 6 to over 40 titles, all playable in the browser via
          Pyodide (Python running in WebAssembly).
        </p>
        <p className="mb-2">
          Son Pham built{' '}
          <a
            href="https://arc3.sonpham.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-foreground"
          >
            arc3.sonpham.net
          </a>
          {' '}— the reference harness for playing ARC-AGI-3 games and running AI agents against
          them, with multi-provider LLM support, a Python sandbox, and replay sharing.
        </p>
        <p>
          The benchmark was now wide open. The question shifted from "can AI solve these six games?"
          to "can AI generalize across dozens of novel, diverse games it has never seen before?"
        </p>
      </>
    ),
  },
  {
    date: 'Now',
    title: 'Where Things Stand',
    emphasis: 'current',
    description: (
      <>
        <p className="mb-2">
          ARC-AGI-3 is an active benchmark with an expanding game catalog. The ARC Prize 2026
          competition is underway, and the community is building increasingly sophisticated agents.
        </p>
        <p>
          AI performance varies widely across games — some games are nearly solved, others remain
          beyond the reach of current systems. The gap between human and AI performance on novel
          games remains the central question ARC Prize is trying to measure.
        </p>
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Preview game data (the 6 original games)                           */
/* ------------------------------------------------------------------ */

const PREVIEW_GAME_SUMMARIES: Array<{
  gameId: string;
  name: string;
  oneLiner: string;
}> = [
  { gameId: 'ls20', name: 'Locksmith', oneLiner: 'Navigate a maze, transform a key to match the door\'s lock, and escape.' },
  { gameId: 'ft09', name: 'FT09', oneLiner: 'Fog-of-war puzzle with hidden mechanics and multi-step reasoning.' },
  { gameId: 'as66', name: 'AS66', oneLiner: 'Pattern recognition under ambiguity — early community favorite.' },
  { gameId: 'lp85', name: 'LP85', oneLiner: 'Spatial reasoning challenge with layered puzzle mechanics.' },
  { gameId: 'sp80', name: 'SP80', oneLiner: 'Complex multi-level game that proved difficult for early agents.' },
  { gameId: 'vc33', name: 'VC33', oneLiner: 'Visual correspondence game testing object tracking and memory.' },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function Arc3Story() {
  usePageMeta({
    title: 'ARC Explainer – What is ARC-AGI-3?',
    description:
      'The story of ARC-AGI-3: interactive reasoning benchmarks that test whether AI can figure out a game with no instructions. Timeline, scoring, and community resources.',
    canonicalPath: '/arc3',
  });

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="mb-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4">
          ARC-AGI-3
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
          A new kind of AI benchmark. No pattern-matching on grids. No examples to study.
          Just a game you've never seen before, and the question:{' '}
          <em>can you figure it out?</em>
        </p>
      </header>

      {/* ── What is ARC-AGI-3? ───────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">What is this?</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            ARC-AGI-1 and ARC-AGI-2 tested AI with static visual puzzles — here are some examples,
            figure out the pattern, produce the output. ARC-AGI-3 is something entirely different.
          </p>
          <p>
            It's a collection of <strong className="text-foreground">interactive games</strong>.
            Each one runs on a 64×64 pixel grid using a 16-color palette. There are no instructions,
            no tutorials, no hints. You get a grid, a handful of actions (up to 7), and you have to
            figure out what the game is, what the controls do, and how to win — just by trying things
            and observing what happens.
          </p>
          <p>
            That's the test. Not "can AI solve this puzzle?" but{' '}
            <strong className="text-foreground">
              "can AI learn a completely new game the way a person would?"
            </strong>{' '}
            By exploring, noticing patterns, forming hypotheses, and adapting when those hypotheses
            are wrong.
          </p>
          <p>
            The ARC Prize Foundation calls these <em>Interactive Reasoning Benchmarks</em> (IRBs).
            They're measuring something no previous benchmark measured: the ability to acquire new
            skills from scratch, in real time, with no prior training on the task.
          </p>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">The Timeline</h2>
        <Arc3Timeline entries={TIMELINE_ENTRIES} />
      </section>

      {/* ── The Preview Games ────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">The Six Preview Games</h2>
        <p className="text-sm text-muted-foreground mb-6">
          These are the games released during the preview competition in mid-2025. We documented
          their mechanics extensively at the time. The games have since been updated — screenshots
          and details from this period may not match current versions.
        </p>
        <div className="grid gap-3">
          {PREVIEW_GAME_SUMMARIES.map((game) => (
            <Link
              key={game.gameId}
              href={`/arc3/games/${game.gameId}`}
              className="group flex items-start gap-4 p-4 -mx-4 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <code className="text-sm font-mono font-bold text-foreground bg-muted px-2 py-1 rounded shrink-0 mt-0.5">
                {game.gameId}
              </code>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:underline">
                  {game.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {game.oneLiner}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-1.5 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── How Scoring Works ────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">How Scoring Works</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            Each ARC-AGI-3 game has multiple levels. An agent's goal is to complete as many levels
            as possible within the allowed number of steps. Games track a <strong className="text-foreground">win score</strong> —
            the number of levels successfully completed.
          </p>
          <p>
            Agents interact through a simple API: they observe the current grid state, choose an
            action (numbered 1–7, plus a reset action), and receive the updated grid. There's no
            text, no reward signal beyond the grid changing — the agent must infer everything from
            visual feedback alone.
          </p>
          <p className="text-sm italic border-l-2 border-muted-foreground/20 pl-4">
            We're still filling in the precise details of the 2026 competition scoring — prize
            structure, aggregate scoring across games, and the exact evaluation protocol. We'll
            update this section as official details are confirmed.
          </p>
        </div>
      </section>

      {/* ── Play & Explore ───────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">Play the Games</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground mb-6">
          <p>
            Want to try ARC-AGI-3 yourself? Son Pham built an excellent open-source harness that
            lets you play every game in your browser or run AI agents against them.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg">
            <a
              href="https://arc3.sonpham.net"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <Gamepad2 className="h-5 w-5" />
              Play on arc3.sonpham.net
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href="https://three.arcprize.org"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              Official ARC-AGI-3 Platform
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* ── Resources ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Resources</h2>
        <div className="space-y-3">
          {[
            {
              title: 'ARC Prize — ARC-AGI-3 Overview',
              url: 'https://arcprize.org/arc-agi/3/',
              description: 'Official overview of the benchmark and competition.',
            },
            {
              title: 'ARC-AGI-3 Technical Documentation',
              url: 'https://docs.arcprize.org',
              description: 'API docs, game format spec, and agent building guide.',
            },
            {
              title: 'ARC-AGI-3 Preview: 30-Day Learnings',
              url: 'https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings',
              description: 'Key takeaways from the preview competition period.',
            },
            {
              title: 'StochasticGoose — 1st Place Preview Agent',
              url: 'https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db',
              description: 'Dries Smit\'s writeup on winning the preview competition.',
              icon: Trophy,
            },
            {
              title: 'Son Pham\'s ARC-AGI-3 Harness',
              url: 'https://arc3.sonpham.net',
              description: 'Open-source platform for playing games and running agents in-browser.',
              icon: Gamepad2,
            },
            {
              title: 'ARCEngine on GitHub',
              url: 'https://github.com/arcprize/ARCEngine',
              description: 'The official open-source game engine powering ARC-AGI-3.',
            },
          ].map((resource) => {
            const Icon = resource.icon || BookOpen;
            return (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:underline">
                    {resource.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resource.description}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
              </a>
            );
          })}
        </div>
      </section>

    </article>
  );
}
