/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 26-October-2026
 * PURPOSE: Focused visual inspection of Lattice's 22 always-capped panel_v60 test outputs,
 *          grouped into 20 ARC-2 tasks. Reuses the puzzle API for actual examples and solutions,
 *          GridDisplay for grids/dimensions, and existing task pages for recorded explanations.
 * SRP/DRY check: Pass — cohort presentation only; no dataset copy, solver or grid-rendering logic.
 */
import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePageMeta } from '@/hooks/usePageMeta';
import { GridDisplay } from '@/components/puzzle/grids/GridDisplay';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ARCExample } from '@shared/types';

// Source: Lattice's 26-Oct-2026 channel report. Indices are zero-based test indices,
// never attempt numbers or explanation IDs. Keep both selected tests for the two repeated tasks.
export const CAPPED_COHORT = [
  { id: '13e47133', tests: [1] }, { id: '20a9e565', tests: [1] },
  { id: '2d0172a1', tests: [0] }, { id: '3a25b0d8', tests: [1] },
  { id: '446ef5d2', tests: [0] }, { id: '4c7dc4dd', tests: [0] },
  { id: '4e34c42c', tests: [0] }, { id: '581f7754', tests: [0] },
  { id: '71e489b6', tests: [1] }, { id: '88bcf3b4', tests: [0, 1] },
  { id: '89565ca0', tests: [0] }, { id: '8b7bacbf', tests: [0] },
  { id: 'a25697e4', tests: [1] }, { id: 'a32d8b75', tests: [0] },
  { id: 'abc82100', tests: [0] }, { id: 'b9e38dc0', tests: [0] },
  { id: 'da515329', tests: [0] }, { id: 'de809cff', tests: [0] },
  { id: 'e12f9a14', tests: [0, 1] }, { id: 'f560132c', tests: [0] },
];

function ExamplePair({ example }: { example: ARCExample }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
      <GridDisplay grid={example.input} label="Input" sizeClass="w-full max-w-[300px]" className="min-w-0 w-full" />
      {example.output?.length ? (
        <GridDisplay grid={example.output} label="Known correct output" sizeClass="w-full max-w-[300px]" className="min-w-0 w-full" />
      ) : <p className="text-sm text-muted-foreground">Known output unavailable.</p>}
    </div>
  );
}

function TaskCard({ id, tests }: { id: string; tests: number[] }) {
  const { task, isLoadingTask, taskError } = usePuzzle(id);
  const [showExamples, setShowExamples] = useState(false);
  return (
    <Card id={`task-${id}`} className="scroll-mt-24 overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="font-mono text-xl">{id}</CardTitle>
          <Link href={`/task/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Open task & explanations <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {tests.map(index => <Badge key={index} variant="outline">Capped test index {index} · test {index + 1}</Badge>)}
          {task && <span className="text-sm text-muted-foreground">{task.train.length} training examples · {task.test.length} test outputs</span>}
        </div>
        {id === '13e47133' && <Link href="/task/13e47133?highlight=88511" className="text-sm text-primary hover:underline">Open the explanation linked in the discussion</Link>}
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {isLoadingTask && <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading task grids…</p>}
        {(taskError || (!isLoadingTask && !task)) && <Alert variant="destructive"><AlertDescription>Could not load this task. Use the task link above to inspect it.</AlertDescription></Alert>}
        {task && <>
          {tests.map(index => {
            const example = task.test[index];
            if (!example) return <Alert key={index} variant="destructive"><AlertDescription>Test index {index} is unavailable in this task.</AlertDescription></Alert>;
            const cells = example.output?.reduce((total, row) => total + row.length, 0) ?? 0;
            return <section key={index} id={`${id}-${index}`} className="space-y-3 scroll-mt-24">
              <h3 className="font-semibold">Test {index + 1} <span className="font-normal text-muted-foreground">(index {index}) · {cells} output cells</span></h3>
              <ExamplePair example={example} />
            </section>;
          })}
          <Button variant="outline" aria-expanded={showExamples} aria-controls={`examples-${id}`} onClick={() => setShowExamples(open => !open)}>
            {showExamples ? 'Hide' : 'Show'} training examples & other tests
          </Button>
          {showExamples && <div id={`examples-${id}`} className="space-y-6 border-t pt-5">
            {task.train.map((example, index) => <section key={`train-${index}`} className="space-y-3">
              <h3 className="font-semibold">Training example {index + 1}</h3><ExamplePair example={example} />
            </section>)}
            {task.test.map((example, index) => tests.includes(index) ? null : <section key={`test-${index}`} className="space-y-3">
              <h3 className="font-semibold">Other test {index + 1} (index {index}) <span className="font-normal text-muted-foreground">— not in the reported always-capped list</span></h3>
              <ExamplePair example={example} />
            </section>)}
          </div>}
        </>}
      </CardContent>
    </Card>
  );
}

export default function Arc2Capped() {
  usePageMeta({ title: 'ARC-2: the always-capped test outputs', description: 'Inspect the 22 test outputs across 20 ARC-2 tasks reported to hit the token cap in every FN panel run, with inputs, known solutions and task links.', canonicalPath: '/arc2/capped' });
  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">ARC-2 · failure-mode inspection</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">The answers that never arrived</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">22 test outputs. 20 tasks. A closer look at the puzzles behind the token-cap failures.</p>
        <p className="max-w-3xl leading-relaxed">Lattice reported that these test outputs reached the 64k token cap in all eight FN first-pass runs on panel_v60. This is that specific reported cohort—not every no-grid failure, and not a claim that these tasks cannot be solved.</p>
        <p className="max-w-3xl text-sm text-muted-foreground">Reported 26 October 2026. Each request answers one test output. The suffix in the discussion is a zero-based test index: index 0 means the first test, index 1 the second. Colored grids below are dataset inputs and known correct outputs, not model answers. Expand a task for its training examples and remaining tests.</p>
        <nav aria-label="Jump to a task" className="flex flex-wrap gap-x-4 gap-y-2 border-y py-4">
          {CAPPED_COHORT.map(({ id }) => <a key={id} href={`#task-${id}`} className="font-mono text-sm text-primary underline-offset-4 hover:underline">{id}</a>)}
        </nav>
      </header>
      {CAPPED_COHORT.map(entry => <TaskCard key={entry.id} {...entry} />)}
      <p className="text-sm text-muted-foreground"><Link href="/arc2/hard-set" className="text-primary hover:underline">Browse the broader ARC-2 hard set</Link> · Cohort membership is a snapshot of Lattice's report; task grids come from ARC Explainer's dataset.</p>
    </main>
  );
}
