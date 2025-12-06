/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-05
PURPOSE: Landing page for ARC-AGI-3 Interactive Reasoning Benchmark.
         ARC-AGI-3 is fundamentally different from ARC 1&2 - it's an agent-based,
         interactive game benchmark, not static puzzle solving. This page provides
         information about ARC-AGI-3 and placeholders for future features like
         games list, leaderboard, scorecard viewer, and replay viewer.
         This component is COMPLETELY ISOLATED from ARC 1&2 puzzle code.
SRP/DRY check: Pass - Single responsibility (ARC-AGI-3 information display).
               No duplication with puzzle components (intentionally separate).
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
  Layers
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ARC3Browser() {
  usePageMeta({
    title: 'ARC Explainer – ARC-AGI-3 Browser',
    description:
      'Learn how ARC-AGI-3 interactive reasoning benchmarks differ from ARC 1 & 2 and explore agents, games, and resources.',
    canonicalPath: '/arc3',
  });
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center mb-12">
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
          A groundbreaking benchmark that tests AI systems through game-based environments,
          evaluating exploration, memory, planning, and goal acquisition—not static puzzle solving.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/arc3/playground">Launch ARC3 Playground</Link>
          </Button>
        </div>
      </div>

      {/* Key Difference Alert */}
      <Alert className="mb-8 border-blue-500 bg-blue-50 dark:bg-blue-950">
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
            Dries Smit&apos;s <strong>StochasticGoose</strong> agent led the preview leaderboard through
            disciplined exploration, curriculum-driven practice runs, and clever memory tooling.
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
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
      </div>

      {/* Future Features - Coming Soon */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center mb-6">
          Coming Soon to This Platform
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Games List - Now Active! */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                Games Browser
              </CardTitle>
              <CardDescription>
                Browse all ARC-AGI-3 games with spoilers, hints, and strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• 6 revealed games (3 preview + 3 evaluation)</p>
                <p>• Mechanics documentation and action mappings</p>
                <p>• Community hints and strategies</p>
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
                    <li>ARC-AGI-2 and ARC-AGI-3 will both run as official ARC Prize competitions in 2026.</li>
                    <li>Exact dates, phases, and prize structure have not been finalized or publicly announced yet.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Game format</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      ARC-AGI-3 games are interactive 64×64 grid environments where agents act through an API over thousands of
                      steps.
                    </li>
                    <li>
                      The benchmark measures exploration, memory, goal acquisition, and long-horizon planning rather than
                      single-shot pattern matching.
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Python library plans</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>
                      The ARC Prize team has indicated that ARC-AGI-3 games are expected to be released as a Python library so
                      agents can be run locally.
                    </li>
                    <li>
                      Until that library ships, the canonical interface is the hosted platform at three.arcprize.org together
                      with the official ARC-AGI-3 agent SDKs.
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">What is still unknown</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Exact prize amounts and detailed reward breakdowns for the 2026 competitions.</li>
                    <li>The full list of public, preview, and hidden games that will appear in the final evaluation sets.</li>
                    <li>Any additional benchmark variants beyond the currently previewed interactive reasoning games.</li>
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
      </div>

      {/* Reference Materials */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Reference Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
            <div>
              <a
                href="https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                ARC-AGI-3 Preview: 30-Day Learnings
              </a>
              <p className="text-sm text-muted-foreground">
                Insights from the first 30 days of the preview competition
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
            <div>
              <a
                href="https://github.com/arcprize/ARC-AGI-3-Agents"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                ARC-AGI-3-Agents GitHub Repository
              </a>
              <p className="text-sm text-muted-foreground">
                Official agent framework and examples for building ARC-AGI-3 agents
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
            <div>
              <a
                href="https://arcprize.org/arc-agi/3/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                ARC-AGI-3 Official Announcement
              </a>
              <p className="text-sm text-muted-foreground">
                Introduction to Interactive Reasoning Benchmarks
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
