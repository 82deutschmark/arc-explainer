/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Archived ARC3 agent playground page. Wraps the existing ARC3AgentPlayground
 *          component with archive banner and modified API endpoints.
 * SRP/DRY check: Pass — wrapper page for archived playground functionality.
 */

import { Archive, Bot, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Arc3ArchiveBanner } from '@/components/arc3/Arc3ArchiveBanner';

export default function Arc3ArchivePlayground() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Archive className="h-8 w-8 text-amber-600" />
        <div>
          <h1 className="text-3xl font-bold">Archived Agent Playground</h1>
          <p className="text-muted-foreground">
            Original ARC3 agent playground from the preview period
          </p>
        </div>
      </div>

      {/* Archive Banner */}
      <Arc3ArchiveBanner 
        message="This playground uses the archived ARC3 API endpoints. Game sessions may behave differently than during the original preview period."
      />

      {/* Maintenance Notice */}
      <Alert variant="default" className="border-blue-500/50 bg-blue-500/10">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-700 dark:text-blue-400">
          Limited Functionality
        </AlertTitle>
        <AlertDescription className="text-blue-600/90 dark:text-blue-300/90">
          <p>
            The archived playground preserves the original OpenAI Agents SDK integration
            for historical reference. Some features may not function as they did during
            the active preview period due to API changes.
          </p>
        </AlertDescription>
      </Alert>

      {/* Playground Selection */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              OpenAI Agents SDK
            </CardTitle>
            <CardDescription>
              Original streaming playground with Responses API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The main agent playground using OpenAI's Agents SDK with streaming,
              conversation chaining, and scorecard tracking.
            </p>
            <Link href="/arc3/playground">
              <Button className="w-full" variant="outline">
                Open Original Playground
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              OpenRouter Playground
            </CardTitle>
            <CardDescription>
              LangGraph-based agent with vision support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Alternative playground using OpenRouter models with LangGraph
              for agent orchestration and vision capabilities.
            </p>
            <Link href="/arc3/openrouter-playground">
              <Button className="w-full" variant="outline">
                Open OpenRouter Playground
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              Codex Playground
            </CardTitle>
            <CardDescription>
              GPT-5.1 Codex Mini specialized playground
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Specialized playground for the GPT-5.1 Codex Mini model
              with ARC3 grid solving capabilities.
            </p>
            <Link href="/arc3/codex-playground">
              <Button className="w-full" variant="outline">
                Open Codex Playground
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              Haiku Playground
            </CardTitle>
            <CardDescription>
              Claude Haiku 4.5 vision-first playground
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Vision-first playground using Claude Haiku 4.5 with
              child-like learning approach to ARC3 games.
            </p>
            <Link href="/arc3/haiku-playground">
              <Button className="w-full" variant="outline">
                Open Haiku Playground
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Back Link */}
      <div className="pt-4">
        <Link href="/arc3/archive">
          <Button variant="outline">
            Back to Archive
          </Button>
        </Link>
      </div>
    </div>
  );
}
