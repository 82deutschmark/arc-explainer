/**
 * ReArcDataset.tsx
 *
 * Author: Cascade (ChatGPT)
 * Date: 2025-12-31
 * PURPOSE: Visual browser for the RE-ARC dataset shipped with the repo.
 *          Provides hero guidance, dataset summary stats, search, and task cards that link to PuzzleExaminer.
 * SRP/DRY check: Pass — single responsibility page consuming useReArcDataset hook + card components.
 */

import { useMemo, useState } from 'react';
import { useReArcDataset } from '@/hooks/useReArcDataset';
import { ReArcTaskCard } from '@/components/rearc/ReArcTaskCard';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function ReArcDataset() {
  const { entries, summary, isLoading, isError, error, refetch } = useReArcDataset();
  const [search, setSearch] = useState('');
  const [showTests, setShowTests] = useState(false);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!search.trim()) return entries;
    const needle = search.trim().toLowerCase();
    return entries.filter(({ taskId }) => taskId.toLowerCase().includes(needle));
  }, [entries, search]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary font-semibold">RE-ARC Bench</p>
            <h1 className="text-4xl font-semibold">Dataset Viewer</h1>
            <p className="text-base text-muted-foreground mt-2 max-w-3xl">
              Inspect every puzzle included in <code className="font-mono">REARC2026.json</code>. Train pairs stay visible
              so you can sanity-check generator variety; test inputs remain hidden by default to avoid spoilers.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href="/REARC2026.json" download>
                Download JSON
              </a>
            </Button>
            <Button variant="secondary" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>
        <Alert className="bg-amber-50 text-amber-900 border-amber-200">
          <AlertDescription>
            Dataset generation timestamp is encoded inside each task ID. Sharing both this viewer output and your solver
            submission lets others reproduce your evaluation without trusting you.
          </AlertDescription>
        </Alert>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Dataset summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
          <SummaryMetric label="Tasks" value={summary?.totalTasks ?? '—'} />
          <SummaryMetric label="Train pairs" value={summary?.totalTrainPairs ?? '—'} />
          <SummaryMetric label="Test inputs" value={summary?.totalTestInputs ?? '—'} />
          <SummaryMetric
            label="Max train/test examples"
            value={
              summary
                ? `${summary.maxTrainExamples} train / ${summary.maxTestExamples} test`
                : '—'
            }
          />
          <div className="md:col-span-2 lg:col-span-4">
            <p className="text-muted-foreground">
              File source:{' '}
              <code className="font-mono">{summary?.datasetPath ?? 'REARC2026.json'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="rearc-search" className="text-sm font-medium">
            Search by Task ID
          </Label>
          <Input
            id="rearc-search"
            placeholder="e.g. 5b6f2612"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-tests"
            checked={showTests}
            onCheckedChange={(checked) => setShowTests(checked)}
          />
          <Label htmlFor="toggle-tests" className="text-sm">
            Show first test input preview (spoiler)
          </Label>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dataset: {error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-52 rounded border bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEntries.length} of {entries.length} tasks
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map(({ taskId, task }) => (
              <ReArcTaskCard key={taskId} taskId={taskId} task={task} showTests={showTests} />
            ))}
          </div>
          {filteredEntries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-16">
              No tasks match “{search}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
