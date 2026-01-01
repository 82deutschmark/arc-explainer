/*
Author: Cascade (ChatGPT)
Date: 2025-12-31
PURPOSE: Landing page for ARC-AGI-3 Interactive Reasoning Benchmark with hero CTAs,
         roadmap context, previews, and curated resources including Claude Code SDK banner.
         ARC-AGI-3 remains isolated from ARC 1&2 puzzle flows.
SRP/DRY check: Pass — Verified existing functionality remains focused on ARC3 info display.
*/

import React from 'react';
import { Link } from 'wouter';
import {
  Gamepad2,
  Trophy,
  BarChart3,
  Play,
  ExternalLink,
  BookOpen,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Arc3References from '@/components/arc3/Arc3References';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getAllGames } from '../../../shared/arc3Games';

export default function ARC3Browser() {
  usePageMeta({
    title: 'ARC Explainer – ARC-AGI-3 Browser',
    description:
      'Learn how ARC-AGI-3 interactive reasoning benchmarks differ from ARC 1 & 2 and explore agents, games, and resources.',
    canonicalPath: '/arc3',
  });
  const arc3GameThumbs = getAllGames()
    .filter(game => game.thumbnailUrl)
    .slice(0, 6);
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Gamepad2 className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ARC-AGI-3
          </h1>
        </div>
        <p className="text-xl text-muted-foreground mb-2">
          Interactive Reasoning Benchmark for AI Agents
        </p>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          A new unique benchmark that tests AI systems through game-based environments,
          evaluating exploration, memory, planning, and goal acquisition—not static puzzle solving.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/arc3/games">Browse ARC-AGI-3 Games</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/arc3/playground">Launch ARC3 Playground</Link>
          </Button>
        </div>
      </div>

      {/* Claude Code SDK highlight */}
      <Card className="mb-10 border-amber-300/60 dark:border-amber-500/40 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-900/30 dark:via-slate-950 dark:to-sky-900/30 shadow-[0_8px_30px_-12px_rgba(17,24,39,0.45)]">
        <CardContent className="flex flex-col md:flex-row md:items-center gap-4 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200 p-3">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">
                Claude Code SDK
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                Build interactive ARC3 agents with Anthropic&apos;s official template
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Anthropic partnered with ARC Prize to ship a Claude Code SDK starter for ARC-AGI-3 runs.
                Leverage their Responses API blueprint, tool wiring, and streaming guidance to go from prompt to agent fast.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="md:ml-auto border-amber-500/50 text-amber-700 dark:text-amber-200 hover:bg-amber-50/50 dark:hover:bg-amber-400/10"
          >
            <a
              href="https://docs.arcprize.org/partner_templates/anthropic"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              Browse the partner template
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Explore ARC-AGI-3 on this site */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Games Browser highlight */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                ARC-AGI-3 Games Browser
              </CardTitle>
              <CardDescription>
                Spoiler-friendly index of the six revealed ARC-AGI-3 games with whatever mechanics, screenshots, and resources we’ve documented so far.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• 6 revealed games (3 preview + 3 evaluation)</p>
                <p>• Mechanics documentation and action mappings where available</p>
                <p>• Screenshots and external resources for selected games</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {arc3GameThumbs.map(game => (
                  <Link
                    key={game.gameId}
                    href={`/arc3/games/${game.gameId}`}
                    className="aspect-square rounded-md overflow-hidden border border-border/40 bg-muted flex items-center justify-center hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                  >
                    {game.thumbnailUrl ? (
                      <img
                        src={game.thumbnailUrl}
                        alt={game.informalName ? `${game.informalName} (${game.gameId})` : game.gameId}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground px-1 text-center">
                        {game.gameId}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              <Button asChild className="mt-4 w-full">
                <Link href="/arc3/games">
                  Browse Games
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* ARC-AGI-3 2026 roadmap & known facts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                ARC-AGI-3 2026 roadmap & known facts
              </CardTitle>
              <CardDescription>
                High-signal summary of what is publicly known about ARC-AGI-3 ("ARC3") and the 2026 ARC-AGI-2/3 competitions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                ARC-AGI-3 is still evolving. The points below reflect the most accurate public information we have as of late 2025.
                Details may change over time—always cross-check against the official ARC Prize announcements and documentation.
              </p>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Timeline &amp; competitions</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>ARC-AGI-3 is planned to launch as a full benchmark in early 2026 alongside ARC Prize 2026 (per the official results blog).</li>
                    <li>Exact competition dates, phases, and prize structure may evolve—always confirm against the latest ARC Prize announcements.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Game format</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      ARC-AGI-3 games are interactive grid environments (up to 64×64 cells) where agents act through an API over multiple steps.
                    </li>
                    <li>
                      The benchmark emphasizes exploration, closed-loop perception–planning–control, memory, and goal acquisition rather than single-shot pattern matching.
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Offline engine / Python library</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      Official ARC-AGI-3 materials mention that a local/offline engine is being explored, but there is no public offline simulator or finalized Python library yet.
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">What is still unknown</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Exact prize amounts and detailed reward breakdowns for the 2026 competitions.</li>
                    <li>The exact nature of "training" and "evaluation" games that will appear in the final evaluation sets.</li>
                    <li>Any additional variants beyond those currently previewed.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">How to use this page</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      Use the ARC-AGI-3 Games Browser on this site to study individual games with spoilers, mechanics, and
                      strategies once you are comfortable with seeing spoilers.
                    </li>
                    <li>
                      Follow the official links above for platform access, documentation, and competition announcements.
                    </li>
                    <li>
                      Treat this page as a concise, searchable reference for humans and language models that need accurate
                      high-level context about ARC-AGI-3.
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Difference Alert */}
      <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          ARC-AGI-3 is fundamentally different from ARC 1 & 2
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>ARC 1 & 2:</strong> Static visual reasoning puzzles with 2-3 examples.{' '}
          <strong>ARC-AGI-3:</strong> Interactive game-based environments where agents
          learn through exploration and action over thousands of steps.
        </AlertDescription>
      </Alert>

      {/* Preview Champion Highlight */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Preview Champion: StochasticGoose
          </CardTitle>
          <CardDescription>
            Learn how StochasticGoose captured 1st place in the ARC-AGI-3 agent preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Dries Smit&apos;s <strong>StochasticGoose</strong> agent won the preview competition.
            Dive into the full breakdown, implementation, and supporting resources below.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="outline" className="flex-1">
              <a
                href="https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2"
              >
                Competition recap
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a
                href="https://github.com/DriesSmit/ARC3-solution"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2"
              >
                GitHub repository
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a
                href="https://github.com/82deutschmark/ARC3-solution/blob/nov4/HOW_IT_WORKS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2"
              >
                Agent explanation
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* What is ARC-AGI-3 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            What is ARC-AGI-3?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            ARC-AGI-3 introduces <strong>Interactive Reasoning Benchmarks (IRBs)</strong>,
            a new paradigm for evaluating AI that goes beyond static tests. Instead of
            solving puzzles from fixed examples, agents interact with dynamic game
            environments to demonstrate:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Exploration:</strong> Can the agent efficiently gather information from the environment?</li>
            <li><strong>Memory:</strong> How does it store and utilize previous experiences?</li>
            <li><strong>Goal Acquisition:</strong> Can it set intermediate goals when the ultimate goal is unknown?</li>
            <li><strong>Planning:</strong> Can it strategize across multiple action sequences?</li>
          </ul>
          <p className="text-muted-foreground">
            Agents interact with 64×64 grid-based games, taking actions and receiving feedback
            from an API, learning through experience rather than pattern matching on examples.
          </p>
        </CardContent>
      </Card>

      {/* External Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Official Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View games, leaderboards, and scorecards on the official ARC-AGI-3 site.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href="https://three.arcprize.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                three.arcprize.org
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Technical documentation for building and testing ARC-AGI-3 agents.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href="https://docs.arcprize.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                docs.arcprize.org
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Competition Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Learn about ARC-AGI-3 competitions, prizes, and research.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href="https://arcprize.org/arc-agi/3/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                arcprize.org
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Preview Learnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Key takeaways from the first 30 days of the ARC-AGI-3 preview agent competition.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href="https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Read the preview blog
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Arc3References />
    </div>
  );
}
