/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Landing page for archived ARC3 preview content. Provides navigation to archived
 *          playgrounds, games browser, and spoiler pages from the original ARC3 preview period.
 * SRP/DRY check: Pass — single-purpose landing page for archive navigation.
 */

import { Archive, Gamepad2, Bot, BookOpen, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Arc3ArchiveBanner } from '@/components/arc3/Arc3ArchiveBanner';

export default function Arc3ArchiveLanding() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Archive className="h-10 w-10 text-amber-600" />
          <h1 className="text-4xl font-bold">ARC3 Preview Archive</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Historical content from the ARC-AGI 3 preview period. Browse archived games, 
          playgrounds, and agent runs from when the competition was first revealed.
        </p>
      </div>

      {/* Archive Banner */}
      <Arc3ArchiveBanner 
        message="You are viewing archived content from the ARC3 preview period (2025). This data is preserved for historical reference but is no longer actively updated."
      />

      {/* Navigation Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {/* Archived Games Browser */}
        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-amber-600" />
              Archived Games
            </CardTitle>
            <CardDescription>
              Browse the 6 official preview games with spoilers and level screenshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              ls20 (Locksmith), as66, ft09, lp85, sp80, and vc33 — the original preview games 
              with detailed mechanics documentation.
            </p>
            <Link href="/arc3/archive/games">
              <Button className="w-full" variant="outline">
                View Archived Games
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Archived Agent Playground */}
        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              Agent Playground
            </CardTitle>
            <CardDescription>
              Original OpenAI Agents SDK playground for ARC3
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Run AI agents against the archived ARC3 games using the OpenAI Agents SDK 
              with streaming and conversation chaining.
            </p>
            <Link href="/arc3/archive/playground">
              <Button className="w-full" variant="outline">
                Open Playground
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-600" />
              Historical Analysis
            </CardTitle>
            <CardDescription>
              Research and analysis from the preview period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Agent run data, game mechanics analysis, and performance metrics from 
              the original ARC3 preview exploration.
            </p>
            <a 
              href="https://github.com/82deutschmark/arc-explainer/tree/main/arc3" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="w-full" variant="outline">
                View on GitHub
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="mt-8 border-amber-500/20">
        <CardHeader>
          <CardTitle>Archive Statistics</CardTitle>
          <CardDescription>Historical data preserved from the preview period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg bg-amber-500/10">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">6</div>
              <div className="text-sm text-muted-foreground">Official Games</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">3</div>
              <div className="text-sm text-muted-foreground">Agent Playgrounds</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">60+</div>
              <div className="text-sm text-muted-foreground">MB of Run Data</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10">
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">2025</div>
              <div className="text-sm text-muted-foreground">Preview Year</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
