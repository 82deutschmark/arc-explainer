/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: The ARC-AGI-2 hard set at /arc2/hard-set: every public-eval puzzle that no logged attempt has
 *          solved, or that only one or two attempts have solved, grouped never / once / twice. Each row
 *          opens into the puzzle's grids, Dr. Fable 5.1's plain-language solve note, and a browser over
 *          every recorded attempt so the Boss can read why the models broke down. Membership comes from
 *          the database (our runs plus the Hugging Face ingests of the official harness), never from a
 *          hand-kept list. Built for the synthetic-data work in
 *          docs/2026-10-19-arc2-hard-set-synthetic-data-plan.md.
 * SRP/DRY check: Pass — data via useArc2HardSet, tables via Arc2HardSetTable, panel pieces reuse
 *                CompactPuzzleDisplay and AnalysisResultListCard; this page only lays them out.
 * shadcn/ui: Pass — Alert, Badge.
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useArc2HardSet, ARC2_HARD_SET_BUCKET_ORDER } from '@/hooks/useArc2HardSet';
import { ARC2_HARD_SET_BUCKET_LABELS } from '@shared/arc2HardSet';
import { Arc2HardSetTable } from '@/components/arc2HardSet/Arc2HardSetTable';

export default function Arc2HardSet() {
  usePageMeta({
    title: 'ARC-AGI-2 Hard Set — puzzles no model has cracked',
    description:
      'The ARC-AGI-2 public-eval puzzles that no logged model attempt has solved, or only one or two have, with every recorded attempt and a plain-language note on each.',
    canonicalPath: '/arc2/hard-set',
  });

  const { byBucket, puzzles, generatedAt, isLoading, error } = useArc2HardSet();
  const [openPuzzleId, setOpenPuzzleId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:py-10">
      <header className="max-w-4xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">The ARC-AGI-2 hard set</h1>
        <p className="text-lg text-muted-foreground">
          Public-eval puzzles that no logged attempt has solved, or that only one or two attempts have.
        </p>
        <p className="leading-relaxed">
          Every scored record in the ARC Explainer database counts as an attempt: our own runs and the
          Hugging Face ingests of the ARC Prize team's official harness, which cover every model folder
          the team has published for the 2026 public evaluation set, Claude Opus 4.8, GPT-5.4 Pro and
          Gemini 3 Deep Think included. A multi-test record counts as solved only when every test output
          is right. The list is computed from the database on each visit, so it moves when new results
          are ingested.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Official check, 19 October 2026: the ARC Prize team's public-eval dataset on Hugging Face was
          last updated on 4 June 2026 and our ingest of it ran on 17 June. The leaderboard site itself
          publishes no per-puzzle results beyond that dataset, so as of today no newer model has cracked
          any puzzle on this page.
        </p>
        <p className="text-sm">
          <Link href="/arc2/hard-set/findings" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Dr. Fable 5.1's findings: why these are hard and what the synthetic set needs <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Counting every attempt on the evaluation set…
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Could not load the hard set: {error.message}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && puzzles.length === 0 && (
        <Alert>
          <AlertDescription>
            No puzzles came back. The database is either not connected or has no scored ARC2-Eval records.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && puzzles.length > 0 && (
        <div className="space-y-10">
          {ARC2_HARD_SET_BUCKET_ORDER.map((bucket) => (
            <Arc2HardSetTable
              key={bucket}
              title={ARC2_HARD_SET_BUCKET_LABELS[bucket]}
              puzzles={byBucket[bucket]}
              openPuzzleId={openPuzzleId}
              onToggle={(puzzleId) => setOpenPuzzleId((current) => (current === puzzleId ? null : puzzleId))}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            Click a row to open the puzzle, the plain-language note and every recorded attempt. Attempt counts are
            scored records; the two harness attempts per model are counted separately.
            {generatedAt ? ` Computed ${new Date(generatedAt).toLocaleString()}.` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
