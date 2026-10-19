/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Browse every recorded attempt on one hard-set puzzle so a reader can see why the models
 *          broke down. Lists the explanation records (our runs plus the Hugging Face ingests of the
 *          official harness) newest first, with filters for correctness, model name and "has written
 *          reasoning", and renders each one through the existing AnalysisResultListCard so expanding a
 *          row shows the full reasoning text and predicted grids. Nothing is summarised here; the
 *          records speak for themselves.
 * SRP/DRY check: Pass — data via useExplanations/useModels, correctness via determineCorrectness,
 *                rendering via AnalysisResultListCard; this file only filters and lists.
 * shadcn/ui: Pass — Input, Button, Badge.
 */

import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnalysisResultListCard } from '@/components/puzzle/AnalysisResultListCard';
import { useExplanations } from '@/hooks/useExplanation';
import { useModels } from '@/hooks/useModels';
import { determineCorrectness } from '@shared/utils/correctness';
import type { ARCExample } from '@shared/types';
import type { ExplanationData } from '@/types/puzzle';

type CorrectnessFilter = 'all' | 'correct' | 'incorrect';

const PAGE_SIZE = 25;

/** Ingested harness records carry their reasoning in patternDescription; our runs may carry a log. */
function hasWrittenReasoning(record: ExplanationData): boolean {
  if (record.hasReasoningLog || (record.reasoningLog && record.reasoningLog.length > 0)) return true;
  return (record.patternDescription?.length ?? 0) > 200;
}

interface Arc2HardSetReasoningBrowserProps {
  puzzleId: string;
  testCases: ARCExample[];
}

export function Arc2HardSetReasoningBrowser({ puzzleId, testCases }: Arc2HardSetReasoningBrowserProps) {
  const { data: explanations, isLoading, error } = useExplanations(puzzleId);
  const { data: models } = useModels();
  const [correctness, setCorrectness] = useState<CorrectnessFilter>('all');
  const [modelQuery, setModelQuery] = useState('');
  const [reasoningOnly, setReasoningOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    return (explanations ?? [])
      .filter((record) => {
        if (correctness !== 'all') {
          const status = determineCorrectness(record).status;
          if (status !== correctness) return false;
        }
        if (query && !record.modelName.toLowerCase().includes(query)) return false;
        if (reasoningOnly && !hasWrittenReasoning(record)) return false;
        return true;
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [explanations, correctness, modelQuery, reasoningOnly]);

  const total = explanations?.length ?? 0;
  const correctCount = useMemo(
    () => (explanations ?? []).filter((record) => determineCorrectness(record).isCorrect).length,
    [explanations],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading every recorded attempt…
      </div>
    );
  }
  if (error) {
    return <p className="py-4 text-sm text-destructive">Could not load the attempts: {error.message}</p>;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm">
        <span className="font-semibold">Recorded attempts</span>
        <Badge variant="outline">{total} records</Badge>
        <Badge variant="outline">{correctCount} correct</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {(['all', 'correct', 'incorrect'] as CorrectnessFilter[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={correctness === option ? 'default' : 'outline'}
              onClick={() => { setCorrectness(option); setVisible(PAGE_SIZE); }}
            >
              {option}
            </Button>
          ))}
          <Button
            size="sm"
            variant={reasoningOnly ? 'default' : 'outline'}
            onClick={() => { setReasoningOnly((value) => !value); setVisible(PAGE_SIZE); }}
            title="Only records that wrote their reasoning down"
          >
            written reasoning
          </Button>
          <Input
            value={modelQuery}
            onChange={(event) => { setModelQuery(event.target.value); setVisible(PAGE_SIZE); }}
            placeholder="filter by model name"
            className="h-8 w-48"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records match these filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, visible).map((record) => (
            <AnalysisResultListCard
              key={record.id}
              result={record}
              modelKey={record.modelName}
              model={models?.find((model) => model.key === record.modelName)}
              testCases={testCases}
              showDebateButton={false}
              compact
              enableExpansion
            />
          ))}
          {filtered.length > visible && (
            <Button variant="outline" size="sm" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, filtered.length - visible)} more of {filtered.length}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
