/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: ARC-AGI-3 playground page letting users configure an OpenAI agent and run it against the local Color Hunt simulator.
SRP/DRY check: Pass — UI logic focused on configuring runs, showing summaries, and visualizing simulator frames.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2, Cpu, Target, ActivitySquare, Flag, Map, Binary, Layers, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useArc3AgentRun } from '@/hooks/useArc3AgentRun';
import type { Arc3AgentRunData, Arc3FrameSnapshot, Arc3GameState, Arc3RunTimelineEntry } from '@/types/arc3';

const DEFAULT_INSTRUCTIONS = `Gather a snapshot with inspect_board, then apply scanners conservatively until the energized node's row, column, and local neighborhood are clear. Avoid repeated scanners. Confirm coordinates before firing ACTION6 and provide a concise post-run summary with the final score.`;

const DEFAULT_MODEL = 'o4-mini';
const COLOR_CLASSES: Record<number, string> = {
  0: 'bg-slate-900',
  1: 'bg-slate-700',
  2: 'bg-sky-600',
  3: 'bg-orange-500',
  4: 'bg-amber-400',
  5: 'bg-amber-500',
  6: 'bg-teal-500',
  7: 'bg-purple-500',
  8: 'bg-emerald-400',
  9: 'bg-rose-500',
};

const STATE_BADGE_VARIANT: Record<Arc3GameState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NOT_STARTED: 'outline',
  IN_PROGRESS: 'secondary',
  WIN: 'default',
  GAME_OVER: 'destructive',
};

function formatTimelineLabel(entry: Arc3RunTimelineEntry) {
  switch (entry.type) {
    case 'assistant_message':
      return 'Agent Message';
    case 'tool_call':
      return 'Tool Call';
    case 'tool_result':
      return 'Tool Result';
    case 'reasoning':
      return 'Reasoning';
    default:
      return 'Event';
  }
}

function BoardView({ frame }: { frame: Arc3FrameSnapshot }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>Step {frame.step}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">Score {frame.score}</Badge>
          <Badge variant="outline">Remaining {frame.remainingSteps}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-[2px] rounded-md border border-border bg-muted/60 p-2">
        {frame.board.flat().map((value, index) => (
          <div
            key={`${frame.step}-${index}`}
            className={cn(
              'flex aspect-square items-center justify-center rounded-sm text-[10px] font-semibold text-white/90',
              COLOR_CLASSES[value] ?? 'bg-neutral-500',
            )}
          >
            {value}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{frame.narrative}</p>
    </div>
  );
}

interface PlaygroundFormState {
  agentName: string;
  instructions: string;
  model: string;
  maxTurns: number;
}

export default function ARC3AgentPlayground() {
  const [formState, setFormState] = useState<PlaygroundFormState>({
    agentName: 'Color Hunt Scout',
    instructions: DEFAULT_INSTRUCTIONS,
    model: DEFAULT_MODEL,
    maxTurns: 12,
  });
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);

  const mutation = useArc3AgentRun();
  const runResult = mutation.data;

  useEffect(() => {
    if (runResult && runResult.frames.length > 0) {
      setSelectedFrameIndex(runResult.frames.length - 1);
    }
  }, [runResult]);

  const selectedFrame = useMemo(() => {
    if (!runResult || runResult.frames.length === 0) {
      return undefined;
    }
    return runResult.frames[Math.min(selectedFrameIndex, runResult.frames.length - 1)];
  }, [runResult, selectedFrameIndex]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.instructions.trim()) {
      return;
    }
    mutation.mutate({
      agentName: formState.agentName.trim() || undefined,
      instructions: formState.instructions,
      model: formState.model.trim() || undefined,
      maxTurns: formState.maxTurns,
    });
  };

  const isRunning = mutation.isPending;
  const errorMessage = mutation.error instanceof Error ? mutation.error.message : undefined;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Cpu className="h-7 w-7 text-primary" /> ARC-AGI-3 Agent Playground
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Configure a lightweight OpenAI agent with the new Agents SDK, run it against the local "Color Hunt" simulator, and
              inspect every decision the agent makes. Coordinates are zero-indexed — call <code>inspect_board</code> before
              firing probes.
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-2 text-sm py-2 px-3">
            <Binary className="h-4 w-4" /> Powered by @openai/agents
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Agent configuration</CardTitle>
            <CardDescription>Provide guidance, choose a model, and launch a run. OpenAI API key must be configured server-side.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="agentName">Agent name</Label>
                <Input
                  id="agentName"
                  value={formState.agentName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, agentName: event.target.value }))}
                  placeholder="Color Hunt Scout"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Custom instructions</Label>
                <Textarea
                  id="instructions"
                  className="min-h-[160px]"
                  value={formState.instructions}
                  onChange={(event) => setFormState((prev) => ({ ...prev, instructions: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formState.model}
                    onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))}
                    placeholder="o4-mini"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTurns">Max turns</Label>
                  <Input
                    id="maxTurns"
                    type="number"
                    min={2}
                    max={24}
                    value={formState.maxTurns}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, maxTurns: Number(event.target.value) || prev.maxTurns }))
                    }
                  />
                </div>
              </div>

              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running
                  </>
                ) : (
                  'Run agent'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run summary</CardTitle>
              <CardDescription>Outcome, score, and usage details from the latest run.</CardDescription>
            </CardHeader>
            <CardContent>
              {runResult ? (
                <RunSummary result={runResult} />
              ) : (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" /> Launch a run to populate the summary.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simulation playback</CardTitle>
              <CardDescription>Review each simulator snapshot, including scanner effects and coordinate probes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {runResult && runResult.frames.length > 0 && selectedFrame ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(selectedFrameIndex)}
                        onValueChange={(value) => setSelectedFrameIndex(Number(value))}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select step" />
                        </SelectTrigger>
                        <SelectContent>
                          {runResult.frames.map((frame) => (
                            <SelectItem key={frame.step} value={String(frame.step)}>
                              Step {frame.step} — {frame.actionLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant={STATE_BADGE_VARIANT[selectedFrame.state]}>State: {selectedFrame.state}</Badge>
                  </div>
                  <BoardView frame={selectedFrame} />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Map className="h-4 w-4" /> Run the agent to view frame-by-frame playback.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reasoning & tool log</CardTitle>
              <CardDescription>Complete transcript of model messages, tool calls, and simulator outputs.</CardDescription>
            </CardHeader>
            <CardContent>
              {runResult ? (
                <Tabs defaultValue="timeline">
                  <TabsList>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="final">Final summary</TabsTrigger>
                  </TabsList>
                  <TabsContent value="timeline" className="mt-4">
                    <ScrollArea className="h-[280px] pr-3">
                      <div className="space-y-3">
                        {runResult.timeline.map((entry) => (
                          <div key={entry.index} className="rounded-lg border border-border bg-muted/40 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline">{formatTimelineLabel(entry)}</Badge>
                              <span className="text-xs text-muted-foreground">#{entry.index}</span>
                            </div>
                            <Separator className="my-2" />
                            <pre className="whitespace-pre-wrap text-xs text-foreground/90">
                              {entry.content || '∅'}
                            </pre>
                            <p className="mt-2 text-xs text-muted-foreground">{entry.label}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="final" className="mt-4">
                    {runResult.finalOutput ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                        {runResult.finalOutput}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <List className="h-4 w-4" /> No final message returned.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <ActivitySquare className="h-4 w-4" /> Run the agent to populate the log.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RunSummary({ result }: { result: Arc3AgentRunData }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATE_BADGE_VARIANT[result.summary.state]}>State: {result.summary.state}</Badge>
        <Badge variant="secondary">Score {result.summary.score}</Badge>
        <Badge variant="outline">Steps {result.summary.stepsTaken}</Badge>
        <Badge variant="outline">Coordinate guesses {result.summary.coordinateGuesses}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4" /> Scenario
          </div>
          <p className="text-muted-foreground">
            {result.summary.scenarioName} <span className="text-xs">({result.summary.scenarioId})</span>
          </p>
          <div className="font-semibold flex items-center gap-2 mt-3">
            <Target className="h-4 w-4" /> Simple actions used
          </div>
          <p className="text-muted-foreground">
            {result.summary.simpleActionsUsed.length > 0
              ? result.summary.simpleActionsUsed.join(', ')
              : 'None'}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Binary className="h-4 w-4" /> Usage
          </div>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <span>Requests</span>
            <span className="text-right">{result.usage.requests}</span>
            <span>Input tokens</span>
            <span className="text-right">{result.usage.inputTokens}</span>
            <span>Output tokens</span>
            <span className="text-right">{result.usage.outputTokens}</span>
            <span>Total tokens</span>
            <span className="text-right">{result.usage.totalTokens}</span>
          </div>
        </div>
      </div>
      {result.finalOutput ? (
        <div className="rounded-md border border-border bg-muted/50 p-4 text-sm whitespace-pre-wrap">
          {result.finalOutput}
        </div>
      ) : null}
    </div>
  );
}
