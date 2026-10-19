/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Dense ruled table for one hard-set bucket (never / once / twice solved). One row per puzzle:
 *          id, nickname, test outputs, attempts, solves, models tried, who solved it and when, newest
 *          record. Clicking a row opens that puzzle's panel below it; only one panel is open at a time so
 *          the table stays a table. The nickname comes from the shared notes; the counts come from the
 *          endpoint and are never typed by hand.
 * SRP/DRY check: Pass — renders what useArc2HardSet returns; the panel is Arc2HardSetPuzzlePanel.
 * shadcn/ui: Pass — Table, Badge, ClickablePuzzleBadge.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { getArc2HardSetNote } from '@shared/arc2HardSet';
import type { Arc2HardSetPuzzle } from '@/hooks/useArc2HardSet';
import { Arc2HardSetPuzzlePanel } from './Arc2HardSetPuzzlePanel';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Harness records are stored one per attempt ("model-attempt1"); readers want the model name. */
function baseModelName(modelName: string): string {
  return modelName.replace(/-attempt[12]$/, '');
}

interface Arc2HardSetTableProps {
  title: string;
  puzzles: Arc2HardSetPuzzle[];
  openPuzzleId: string | null;
  onToggle: (puzzleId: string) => void;
}

export function Arc2HardSetTable({ title, puzzles, openPuzzleId, onToggle }: Arc2HardSetTableProps) {
  return (
    <section className="space-y-2">
      <h2 className="border-b-2 border-foreground pb-1 text-lg font-bold uppercase tracking-wide">
        {title} <span className="ml-2 text-sm font-normal normal-case text-muted-foreground">{puzzles.length} puzzle{puzzles.length === 1 ? '' : 's'}</span>
      </h2>
      {puzzles.length === 0 ? (
        <p className="text-sm text-muted-foreground">None in this bucket right now.</p>
      ) : (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Puzzle</TableHead>
              <TableHead>Nickname</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Solved</TableHead>
              <TableHead className="text-right">Models</TableHead>
              <TableHead>Solved by</TableHead>
              <TableHead>Newest record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puzzles.map((puzzle) => {
              const open = openPuzzleId === puzzle.puzzleId;
              const note = getArc2HardSetNote(puzzle.puzzleId);
              return (
                <React.Fragment key={puzzle.puzzleId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => onToggle(puzzle.puzzleId)}
                    aria-expanded={open}
                  >
                    <TableCell className="text-muted-foreground">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <ClickablePuzzleBadge puzzleId={puzzle.puzzleId} variant="neutral" showName={false} />
                    </TableCell>
                    <TableCell>{note?.nickname ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{puzzle.testCaseCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{puzzle.attempts}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{puzzle.solved}</TableCell>
                    <TableCell className="text-right tabular-nums">{puzzle.modelsAttempted}</TableCell>
                    <TableCell>
                      {puzzle.solvers.length === 0 ? (
                        <span className="text-muted-foreground">nobody</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {puzzle.solvers.map((solver) => (
                            <li key={solver.explanationId} className="whitespace-nowrap">
                              <span className="font-mono text-xs">{baseModelName(solver.modelName)}</span>
                              <span className="ml-1 text-xs text-muted-foreground">{formatDate(solver.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(puzzle.latestAttempt)}</TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="bg-muted/30 p-4">
                        <Arc2HardSetPuzzlePanel puzzleId={puzzle.puzzleId} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
