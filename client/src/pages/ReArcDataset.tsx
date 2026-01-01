/**
 * ReArcDataset.tsx
 *
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-01
 * PURPOSE: Client-side synthetic dataset viewer. Users upload their own RE-ARC JSON files
 *          and see each task rendered exactly like PuzzleExaminer—train pairs + test cases.
 *          No backend involvement; purely for visual inspection of generated puzzles.
 * SRP/DRY check: Pass — reuses PuzzleGridDisplay for grid rendering.
 */

import { useCallback, useMemo, useState } from 'react';
import { Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { ARCTask } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type DatasetRecord = Record<string, ARCTask>;

interface ParsedDataset {
  tasks: DatasetRecord;
  fileName: string;
  taskCount: number;
  trainPairs: number;
  testInputs: number;
}

function parseDatasetFile(text: string, fileName: string): ParsedDataset {
  const parsed = JSON.parse(text);

  // Handle both { taskId: ARCTask } and array-of-tasks formats
  let tasks: DatasetRecord;
  if (Array.isArray(parsed)) {
    tasks = {};
    parsed.forEach((task, idx) => {
      const id = task.id ?? task.taskId ?? `task_${idx}`;
      tasks[id] = { train: task.train ?? [], test: task.test ?? [] };
    });
  } else {
    tasks = parsed as DatasetRecord;
  }

  let trainPairs = 0;
  let testInputs = 0;
  for (const task of Object.values(tasks)) {
    trainPairs += task.train?.length ?? 0;
    testInputs += task.test?.length ?? 0;
  }

  return {
    tasks,
    fileName,
    taskCount: Object.keys(tasks).length,
    trainPairs,
    testInputs,
  };
}

export default function ReArcDataset() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseDatasetFile(reader.result as string, file.name);
        setDataset(parsed);
        setParseError(null);
        // Expand first task by default
        const firstId = Object.keys(parsed.tasks)[0];
        if (firstId) setExpandedTasks(new Set([firstId]));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse JSON');
        setDataset(null);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file');
      setDataset(null);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseDatasetFile(reader.result as string, file.name);
        setDataset(parsed);
        setParseError(null);
        const firstId = Object.keys(parsed.tasks)[0];
        if (firstId) setExpandedTasks(new Set([firstId]));
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse JSON');
        setDataset(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const clearDataset = useCallback(() => {
    setDataset(null);
    setParseError(null);
    setSearch('');
    setExpandedTasks(new Set());
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!dataset) return;
    setExpandedTasks(new Set(Object.keys(dataset.tasks)));
  }, [dataset]);

  const collapseAll = useCallback(() => {
    setExpandedTasks(new Set());
  }, []);

  const sortedEntries = useMemo(() => {
    if (!dataset) return [];
    return Object.entries(dataset.tasks).sort(([a], [b]) => a.localeCompare(b));
  }, [dataset]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return sortedEntries;
    const needle = search.trim().toLowerCase();
    return sortedEntries.filter(([taskId]) => taskId.toLowerCase().includes(needle));
  }, [sortedEntries, search]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* Header */}
      <header>
        <p className="text-sm uppercase tracking-wide text-primary font-semibold">RE-ARC Bench</p>
        <h1 className="text-3xl font-semibold">Synthetic Dataset Viewer</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Upload a RE-ARC dataset JSON to visualize every task. Grids render exactly like Puzzle Examiner.
        </p>
      </header>

      {/* Upload zone */}
      {!dataset && (
        <div
          className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('dataset-file-input')?.click()}
        >
          <Upload className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-700">
            Drop your dataset JSON here or click to browse
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Accepts <code className="font-mono">{'{ taskId: ARCTask }'}</code> or array format
          </p>
          <input
            id="dataset-file-input"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {parseError && (
        <Alert variant="destructive">
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Dataset loaded */}
      {dataset && (
        <>
          {/* Summary card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {dataset.fileName}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearDataset}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <Stat label="Tasks" value={dataset.taskCount} />
              <Stat label="Train pairs" value={dataset.trainPairs} />
              <Stat label="Test inputs" value={dataset.testInputs} />
            </CardContent>
          </Card>

          {/* Search + expand controls */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="task-search" className="text-sm font-medium">
                Search by Task ID
              </Label>
              <Input
                id="task-search"
                placeholder="e.g. 5b6f2612"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          </div>

          {/* Task list */}
          <p className="text-sm text-muted-foreground">
            Showing {filteredEntries.length} of {sortedEntries.length} tasks
          </p>

          <div className="space-y-4">
            {filteredEntries.map(([taskId, task]) => {
              const isExpanded = expandedTasks.has(taskId);
              return (
                <div key={taskId} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    onClick={() => toggleTask(taskId)}
                  >
                    <span className="font-mono text-sm font-medium">{taskId}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{task.train.length} train</span>
                      <span>{task.test.length} test</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-4">
                      <PuzzleGridDisplay
                        task={task}
                        showEmojis={false}
                        showColorOnly={false}
                        emojiSet={DEFAULT_EMOJI_SET}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredEntries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              No tasks match "{search}".
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
