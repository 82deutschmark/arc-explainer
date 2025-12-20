/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-20
 * PURPOSE: Inline actionable insights report for the Worm Arena Models page.
 *          Generates a per-model report on demand and provides copy, save, and Twitter share actions.
 * SRP/DRY check: Pass - focused on report display and actions.
 */

import React from 'react';

import { useWormArenaModelInsights } from '@/hooks/useWormArenaModels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

interface WormArenaModelInsightsReportProps {
  modelSlug: string;
}

// Format a ratio as a percent string for display.
const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

// Format a cost value for display with a fallback.
const formatCost = (value: number | null): string =>
  value == null || Number.isNaN(value) ? '-' : `$${value.toFixed(4)}`;

// Format an optional number with a fixed precision.
const formatOptionalNumber = (value: number | null, digits: number): string =>
  value == null || Number.isNaN(value) ? '-' : value.toFixed(digits);

// Convert snake death reason values into human-readable labels.
const formatReasonLabel = (reason: string): string => reason.replace(/_/g, ' ').trim();

// Format ISO timestamps for display with a short locale string.
const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(',', '');
  } catch {
    return '-';
  }
};

export default function WormArenaModelInsightsReport({ modelSlug }: WormArenaModelInsightsReportProps) {
  const { report, isLoading, error, fetchReport, clearReport } = useWormArenaModelInsights();
  const [copyHint, setCopyHint] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);

  // Reset report state when the selected model changes.
  React.useEffect(() => {
    clearReport();
    setCopyHint(null);
    setDownloadUrl(null);
  }, [modelSlug, clearReport]);

  // Build a downloadable markdown URL for the save action.
  React.useEffect(() => {
    if (!report?.markdownReport) {
      setDownloadUrl(null);
      return;
    }

    const blob = new Blob([report.markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [report?.markdownReport]);

  // Clear copy hint after a short delay.
  React.useEffect(() => {
    if (!copyHint) return;
    const timeoutId = window.setTimeout(() => setCopyHint(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copyHint]);

  // Trigger report generation on demand.
  const handleGenerateReport = React.useCallback(() => {
    setCopyHint(null);
    void fetchReport(modelSlug);
  }, [fetchReport, modelSlug]);

  // Copy report markdown to the clipboard with a fallback for older browsers.
  const handleCopyReport = React.useCallback(async () => {
    if (!report?.markdownReport) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report.markdownReport);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = report.markdownReport;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyHint('Copied report.');
    } catch (err) {
      console.error('[WormArenaModelInsightsReport] Copy failed:', err);
      setCopyHint('Copy failed. Please copy manually.');
    }
  }, [report?.markdownReport]);

  // Build the Twitter share URL from the report payload.
  const tweetUrl = React.useMemo(() => {
    if (!report?.tweetText) return '';
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(report.tweetText)}`;
  }, [report?.tweetText]);

  // Top failure mode used in the summary tile.
  const topFailure = report?.failureModes?.[0] ?? null;
  const topFailureLabel = topFailure ? formatReasonLabel(topFailure.reason) : 'none';
  const topFailureRate = topFailure ? formatPercent(topFailure.percentOfLosses) : '-';

  return (
    <Card className="worm-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-xl font-bold text-worm-ink">
            Actionable Insights Report
          </CardTitle>
          {report && !isLoading && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReport}
              >
                {copyHint ? copyHint : 'Copy Report'}
              </Button>
              {downloadUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={downloadUrl} download={`worm-arena-${modelSlug}-insights.md`}>
                    Save Markdown
                  </a>
                </Button>
              )}
              {tweetUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={tweetUrl} target="_blank" rel="noreferrer">
                    Share on Twitter
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="text-sm worm-muted">
          Full history report focused on loss reasons, cost, and opponent pain points.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-worm-ink">
        {error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}

        {!report && !isLoading && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleGenerateReport} className="bg-worm-green hover:bg-worm-green-hover text-worm-green-ink">
              Generate Report
            </Button>
            <span className="text-sm worm-muted">
              Report generation uses all completed games for this model.
            </span>
          </div>
        )}

        {isLoading && (
          <div className="py-6 text-base worm-muted">
            Generating report. Controls are hidden until the report is ready.
          </div>
        )}

        {report && !isLoading && (
          <div className="space-y-4">
            {/* Report metadata for user context */}
            <div className="text-xs worm-muted">
              Generated: {formatDateTime(report.generatedAt)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Games</div>
                <div className="text-base font-semibold">{report.summary.gamesPlayed}</div>
              </div>
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Win Rate</div>
                <div className="text-base font-semibold">{formatPercent(report.summary.winRate)}</div>
              </div>
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Total Cost</div>
                <div className="text-base font-semibold">{formatCost(report.summary.totalCost)}</div>
              </div>
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Cost per Loss</div>
                <div className="text-base font-semibold">{formatCost(report.summary.costPerLoss)}</div>
              </div>
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Avg Rounds</div>
                <div className="text-base font-semibold">
                  {formatOptionalNumber(report.summary.averageRounds, 1)}
                </div>
              </div>
              <div className="rounded-md border px-3 py-2 bg-white/70">
                <div className="text-xs worm-muted">Top Loss Reason</div>
                <div className="text-base font-semibold">
                  {topFailureLabel}
                  {topFailure && (
                    <span className="ml-1 text-xs worm-muted">({topFailureRate})</span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="failure-modes">
                <AccordionTrigger>Failure Modes</AccordionTrigger>
                <AccordionContent>
                  {report.failureModes.length === 0 && (
                    <div className="text-sm worm-muted">No losses recorded.</div>
                  )}
                  {report.failureModes.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reason</TableHead>
                          <TableHead>Losses</TableHead>
                          <TableHead>Share</TableHead>
                          <TableHead>Avg Round</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.failureModes.map((mode) => (
                          <TableRow key={mode.reason}>
                            <TableCell className="font-medium">
                              {formatReasonLabel(mode.reason)}
                            </TableCell>
                            <TableCell>{mode.losses}</TableCell>
                            <TableCell>{formatPercent(mode.percentOfLosses)}</TableCell>
                            <TableCell>{formatOptionalNumber(mode.averageDeathRound, 1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cost-efficiency">
                <AccordionTrigger>Cost and Efficiency</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Total Cost: {formatCost(report.summary.totalCost)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Game: {formatCost(report.summary.costPerGame)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Win: {formatCost(report.summary.costPerWin)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Loss: {formatCost(report.summary.costPerLoss)}
                    </Badge>
                    <Badge variant="outline">
                      Avg Score: {formatOptionalNumber(report.summary.averageScore, 2)}
                    </Badge>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="opponents">
                <AccordionTrigger>Opponent Pain Points</AccordionTrigger>
                <AccordionContent>
                  {report.lossOpponents.length === 0 && (
                    <div className="text-sm worm-muted">No opponents recorded.</div>
                  )}
                  {report.lossOpponents.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Opponent</TableHead>
                          <TableHead>Games</TableHead>
                          <TableHead>Losses</TableHead>
                          <TableHead>Loss Rate</TableHead>
                          <TableHead>Last Played</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.lossOpponents.map((opponent) => (
                          <TableRow key={opponent.opponentSlug}>
                            <TableCell className="font-medium">
                              {opponent.opponentSlug}
                            </TableCell>
                            <TableCell>{opponent.gamesPlayed}</TableCell>
                            <TableCell>{opponent.losses}</TableCell>
                            <TableCell>{formatPercent(opponent.lossRate)}</TableCell>
                            <TableCell className="text-xs worm-muted">
                              {formatDateTime(opponent.lastPlayedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-quality">
                <AccordionTrigger>Data Quality</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Loss reason coverage: {formatPercent(report.summary.lossDeathReasonCoverage)}
                    </Badge>
                    <Badge variant="outline">
                      Losses without reason: {report.summary.unknownLosses}
                    </Badge>
                    <Badge variant="outline">
                      Early losses (round <= 5): {report.summary.earlyLosses} ({formatPercent(report.summary.earlyLossRate)})
                    </Badge>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
