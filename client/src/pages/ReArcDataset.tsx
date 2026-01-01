/**
 * ReArcDataset.tsx
 *
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-01
 * PURPOSE: Client-side synthetic dataset viewer. Users upload their own RE-ARC JSON files
 *          and see each task rendered with PNG grid thumbnails matching the project aesthetic.
 *          No backend involvement; purely for visual inspection of generated puzzles.
 *          Desktop-only, full-width layout with bold typography and high contrast.
 * SRP/DRY check: Pass — reuses TinyGrid and PuzzleGridDisplay for grid rendering.
 */

import { useCallback, useMemo, useState } from 'react';
import { Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import { PuzzleGridDisplay } from '@/components/puzzle/PuzzleGridDisplay';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import { ARC_COLORS_TUPLES } from '@shared/config/colors';
import type { ARCTask } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Render a grid into a PNG data URL for crisp thumbnails.
 * Reuses the pattern from ExplanationGridRow.
 */
function buildGridThumbnail(
  grid: number[][],
  size: number,
  padding: number = 4
): string | null {
  if (typeof document === 'undefined' || !grid || !grid.length) return null;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const maxDim = Math.max(rows, cols);
  const available = Math.max(1, size - padding * 2);
  const cellSize = Math.max(1, Math.floor(available / maxDim));
  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;
  const offsetX = Math.floor((size - gridWidth) / 2);
  const offsetY = Math.floor((size - gridHeight) / 2);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const value = grid[y]?.[x] ?? 0;
      const colorTuple = ARC_COLORS_TUPLES[value] ?? ARC_COLORS_TUPLES[0];
      ctx.fillStyle = `rgb(${colorTuple[0]}, ${colorTuple[1]}, ${colorTuple[2]})`;
      ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
    }
  }

  return canvas.toDataURL('image/png');
}

type DatasetRecord = Record<string, ARCTask>;

interface DatasetStats {
  taskCount: number;
  multiTestCount: number; // tasks with test.length > 1
  trainDistribution: Record<number, number>; // trainCount -> howManyTasks
  testDistribution: Record<number, number>;  // testCount -> howManyTasks
}

interface ParsedDataset {
  tasks: DatasetRecord;
  fileName: string;
  stats: DatasetStats;
}

function computeStats(tasks: DatasetRecord): DatasetStats {
  const trainDistribution: Record<number, number> = {};
  const testDistribution: Record<number, number> = {};
  let multiTestCount = 0;

  for (const task of Object.values(tasks)) {
    const trainLen = task.train?.length ?? 0;
    const testLen = task.test?.length ?? 0;

    trainDistribution[trainLen] = (trainDistribution[trainLen] ?? 0) + 1;
    testDistribution[testLen] = (testDistribution[testLen] ?? 0) + 1;

    if (testLen > 1) multiTestCount++;
  }

  return {
    taskCount: Object.keys(tasks).length,
    multiTestCount,
    trainDistribution,
    testDistribution,
  };
}

function parseDatasetFile(text: string, fileName: string): ParsedDataset {
  const parsed = JSON.parse(text);

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

  return {
    tasks,
    fileName,
    stats: computeStats(tasks),
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

  // Format distribution as compact string: "3 train: 80, 4 train: 30"
  const formatDistribution = (dist: Record<number, number>, label: string) => {
    const sorted = Object.entries(dist)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    return sorted.map(([count, tasks]) => (
      <span key={count} className="inline-flex items-center gap-1">
        <strong className="text-black">{count}</strong> {label}: <strong className="text-black">{tasks}</strong>
      </span>
    ));
  };

  return (
    <div className="w-full px-6 py-8 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-black">Synthetic Dataset Viewer</h1>
        <p className="text-lg text-gray-700 mt-1">
          Upload a RE-ARC dataset JSON to visualize generated puzzles
        </p>
      </header>

      {/* Upload zone */}
      {!dataset && (
        <div
          className="border-2 border-dashed border-gray-400 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer max-w-2xl bg-gray-50"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('dataset-file-input')?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <p className="text-xl font-semibold text-black">
            Drop dataset JSON or click to browse
          </p>
          <p className="text-base text-gray-600 mt-2">
            Accepts RE-ARC format: {"{ taskId: { train: [...], test: [...] } }"}
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
        <Alert variant="destructive" className="max-w-2xl">
          <AlertDescription className="text-base">{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Dataset loaded */}
      {dataset && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-8 border-b-2 border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-black">{dataset.fileName}</span>
              <Button variant="outline" size="sm" onClick={clearDataset}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
            <div className="flex items-center gap-6 text-lg text-gray-800">
              <span><strong className="text-black">{dataset.stats.taskCount}</strong> tasks</span>
              {dataset.stats.multiTestCount > 0 && (
                <span><strong className="text-black">{dataset.stats.multiTestCount}</strong> with multiple test outputs</span>
              )}
            </div>
          </div>

          {/* Distribution row */}
          <div className="flex flex-wrap gap-x-12 gap-y-2 text-base text-gray-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-black">Train examples:</span>
              <div className="flex items-center gap-4">
                {formatDistribution(dataset.stats.trainDistribution, 'train')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-black">Test outputs:</span>
              <div className="flex items-center gap-4">
                {formatDistribution(dataset.stats.testDistribution, 'test')}
              </div>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Filter by task ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 h-10 text-base"
            />
            <Button variant="outline" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="outline" onClick={collapseAll}>
              Collapse all
            </Button>
            <span className="text-base text-gray-600 ml-auto">
              Showing <strong className="text-black">{filteredEntries.length}</strong> of <strong className="text-black">{sortedEntries.length}</strong> tasks
            </span>
          </div>

          {/* Task list with grid thumbnails */}
          <div className="space-y-3">
            {filteredEntries.map(([taskId, task]) => {
              const isExpanded = expandedTasks.has(taskId);
              const firstTrain = task.train[0];
              const firstTest = task.test[0];

              return (
                <div key={taskId} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center gap-6 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleTask(taskId)}
                  >
                    {/* Grid thumbnails */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {firstTrain && (
                        <>
                          <GridThumbnail grid={firstTrain.input} label="In" />
                          <span className="text-gray-400 text-xl">→</span>
                          <GridThumbnail grid={firstTrain.output} label="Out" />
                        </>
                      )}
                      {firstTest && (
                        <>
                          <span className="text-gray-300 mx-2">|</span>
                          <GridThumbnail grid={firstTest.input} label="Test" />
                        </>
                      )}
                    </div>

                    {/* Task info */}
                    <div className="flex items-center gap-6 flex-1">
                      <span className="font-mono text-base text-gray-500">{taskId}</span>
                      <span className="text-base text-black font-semibold">{task.train.length} train</span>
                      <span className="text-base text-black font-semibold">{task.test.length} test</span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-6 w-6 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-6 w-6 text-gray-600" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
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
            <p className="text-center text-lg text-gray-600 py-12">
              No tasks match "<strong className="text-black">{search}</strong>".
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Grid thumbnail component - renders a small PNG preview of a grid
 */
function GridThumbnail({ grid, label }: { grid: number[][]; label: string }) {
  const thumbnail = useMemo(() => buildGridThumbnail(grid, 56, 4), [grid]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded border border-gray-300 bg-black overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`${label} grid`}
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <TinyGrid grid={grid} className="w-full h-full" />
        )}
      </div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </div>
  );
}
