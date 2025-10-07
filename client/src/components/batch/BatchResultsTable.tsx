/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Display batch analysis results in a table with correct/incorrect indicators
 *
 * SRP and DRY check: Pass - Single responsibility: batch results display
 * shadcn/ui: Pass - Uses shadcn/ui Table components
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, PlayCircle, MinusCircle } from 'lucide-react';

interface BatchPuzzleResult {
  puzzleId: string;
  status: 'pending' | 'analyzing' | 'success' | 'failed' | 'skipped';
  correct?: boolean;
  error?: string;
  processingTimeMs?: number;
  analysisId?: number;
}

interface BatchResultsTableProps {
  results: BatchPuzzleResult[];
}

export function BatchResultsTable({ results }: BatchResultsTableProps) {
  if (!results || results.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No results to display
      </div>
    );
  }

  const getStatusIcon = (result: BatchPuzzleResult) => {
    switch (result.status) {
      case 'success':
        return result.correct ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        );
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'analyzing':
        return <PlayCircle className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'skipped':
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (result: BatchPuzzleResult) => {
    if (result.status === 'success') {
      if (result.correct) {
        return <Badge variant="default" className="bg-green-600">✓ Correct</Badge>;
      } else {
        return <Badge variant="destructive">✗ Incorrect</Badge>;
      }
    }

    switch (result.status) {
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'analyzing':
        return <Badge variant="secondary" className="animate-pulse">Analyzing...</Badge>;
      case 'skipped':
        return <Badge variant="outline">Skipped</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption>
          Batch Analysis Results - {results.filter(r => r.status === 'success').length} completed
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Puzzle ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.puzzleId}>
              <TableCell>{getStatusIcon(result)}</TableCell>
              <TableCell className="font-mono">{result.puzzleId}</TableCell>
              <TableCell>{getStatusBadge(result)}</TableCell>
              <TableCell className="text-sm text-gray-600">
                {formatTime(result.processingTimeMs)}
              </TableCell>
              <TableCell className="text-sm">
                {result.error && (
                  <span className="text-red-600 truncate max-w-xs block">
                    {result.error}
                  </span>
                )}
                {result.analysisId && (
                  <span className="text-gray-500">ID: {result.analysisId}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
