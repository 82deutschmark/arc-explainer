/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-20
 * PURPOSE: Inline actionable insights report for the Worm Arena Models page.
 *          Generates a per-model report on demand, displays an LLM summary,
 *          and provides copy, save, and Twitter share actions.
 * SRP/DRY check: Pass - focused on report display and actions.
 */

import React from 'react';

import { useWormArenaModelInsightsStream } from '@/hooks/useWormArenaModelInsightsStream';
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
  const {
    status,
    report,
    error,
    reasoningText,
    parsedInsights,
    isStreaming,
    isComplete,
    startStream,
    closeStream,
  } = useWormArenaModelInsightsStream();
  const [copyHint, setCopyHint] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);

  // Reset report state when the selected model changes.
  React.useEffect(() => {
    closeStream();
    setCopyHint(null);
    setDownloadUrl(null);
  }, [modelSlug, closeStream]);

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
    startStream(modelSlug);
  }, [startStream, modelSlug]);

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
          <CardTitle className="text-xl font-bold" style={{ color: 'var(--worm-ink)' }}>
            Actionable Insights Report
          </CardTitle>
          {report && isComplete && (
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
        <p className="text-sm" style={{ color: 'var(--worm-muted)' }}>
          Full history report focused on loss reasons, cost, and opponent pain points.
          <br />
          <em style={{ fontSize: '0.85em', opacity: 0.8 }}>Very meta: LLMs playing Snake analyzed by another LLM on a page coded by another LLM. Pretty cool, right?</em>
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base" style={{ color: 'var(--worm-ink)' }}>
        {error && !isStreaming && (
          <div className="py-3 text-base text-red-700">{error.message}</div>
        )}

        {!report && !isStreaming && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleGenerateReport} style={{ backgroundColor: 'var(--worm-green)', color: 'var(--worm-green-ink)' }} className="hover:opacity-90">
              Generate Report
            </Button>
            <span className="text-sm" style={{ color: 'var(--worm-muted)' }}>
              Report generation uses all completed games for this model.
            </span>
          </div>
        )}

        {isStreaming && (
          <div className="space-y-4">
            {/* Loading indicator for initial waiting state */}
            {status.state === 'requested' && !reasoningText && !parsedInsights && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin">
                    <svg className="w-8 h-8" style={{ color: 'var(--worm-green)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--worm-muted)' }}>
                    Preparing analysis...
                  </p>
                </div>
              </div>
            )}

            {/* Status message */}
            {status.message && (
              <div className="text-sm text-[var(--worm-muted)] italic">
                {status.message}
              </div>
            )}

            {/* Live reasoning (if present) */}
            {reasoningText && (
              <div className="rounded-lg border p-4 bg-amber-50/30" style={{ borderColor: 'var(--worm-border)' }}>
                <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--worm-ink)' }}>
                  Reasoning (live)
                </h4>
                <div className="text-sm font-mono whitespace-pre-wrap break-words overflow-hidden max-h-64 overflow-y-auto" style={{ color: 'var(--worm-muted)' }}>
                  {reasoningText}
                </div>
              </div>
            )}

            {/* Partial insights (if parseable) */}
            {parsedInsights && (
              <div className="rounded-lg border p-4 bg-blue-50/30" style={{ borderColor: 'var(--worm-border)' }}>
                <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--worm-ink)' }}>
                  Insights (streaming...)
                </h4>
                <pre className="text-xs overflow-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(parsedInsights, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {report && isComplete && (
          <div className="space-y-4">
            {/* Report metadata for user context */}
            <div className="text-xs" style={{ color: 'var(--worm-muted)' }}>
              Generated: {formatDateTime(report.generatedAt)}
            </div>
            {/* Structured insights from LLM */}
            {report.llmSummary && (
              <div className="space-y-4">
                {/* Parse and display structured insights */}
                {(() => {
                  try {
                    const insights = JSON.parse(report.llmSummary);
                    return (
                      <div className="space-y-4">
                        {/* Overview */}
                        {insights.summary && (
                          <div className="rounded-lg border p-4" style={{ backgroundColor: 'rgba(228, 242, 233, 0.5)', borderColor: 'var(--worm-border)' }}>
                            <div className="text-sm leading-relaxed font-semibold" style={{ color: 'var(--worm-ink)' }}>
                              {insights.summary}
                            </div>
                          </div>
                        )}

                        {/* Death Analysis */}
                        {insights.deathAnalysis && insights.deathAnalysis.length > 0 && (
                          <div>
                            <h4 className="text-base font-bold mb-3" style={{ color: 'var(--worm-ink)' }}>Why It Dies</h4>
                            <div className="space-y-2">
                              {insights.deathAnalysis.map((death: any, idx: number) => (
                                <div key={idx} className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 250, 240, 0.8)', borderColor: 'var(--worm-border)' }}>
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-bold text-red-700 mt-0.5">⚠</span>
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold" style={{ color: 'var(--worm-metric-losses)' }}>
                                        {death.cause}
                                      </div>
                                      <div className="text-xs mt-1" style={{ color: 'var(--worm-ink)' }}>
                                        {death.frequency}
                                      </div>
                                      <div className="text-xs mt-1" style={{ color: 'var(--worm-muted)' }}>
                                        {death.pattern}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tough Opponents */}
                        {insights.toughOpponents && insights.toughOpponents.length > 0 && (
                          <div>
                            <h4 className="text-base font-bold mb-3" style={{ color: 'var(--worm-ink)' }}>Tough Matchups</h4>
                            <div className="space-y-2">
                              {insights.toughOpponents.map((opp: any, idx: number) => (
                                <div key={idx} className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 240, 240, 0.8)', borderColor: 'var(--worm-border)' }}>
                                  <div className="text-sm font-semibold" style={{ color: 'var(--worm-metric-losses)' }}>
                                    {opp.opponent}
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--worm-ink)' }}>
                                    Record: <span className="font-bold">{opp.record}</span>
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--worm-muted)' }}>
                                    {opp.issue}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {insights.recommendations && insights.recommendations.length > 0 && (
                          <div>
                            <h4 className="text-base font-bold mb-3" style={{ color: 'var(--worm-ink)' }}>What to Fix</h4>
                            <div className="space-y-2">
                              {insights.recommendations.map((rec: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 rounded-lg border p-3" style={{ backgroundColor: 'rgba(240, 250, 240, 0.8)', borderColor: 'var(--worm-border)' }}>
                                  <span className="text-xs font-bold" style={{ color: 'var(--worm-green)' }}>✓</span>
                                  <div className="text-sm flex-1" style={{ color: 'var(--worm-ink)' }}>
                                    {rec}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  } catch {
                    // Fallback if JSON parsing fails
                    return (
                      <div className="rounded-lg border p-4" style={{ backgroundColor: 'rgba(228, 242, 233, 0.5)', borderColor: 'var(--worm-border)' }}>
                        <div className="text-sm leading-relaxed" style={{ color: 'var(--worm-ink)' }}>
                          {report.llmSummary}
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
            {!report.llmSummary && (
              <div className="rounded-lg border p-4" style={{ backgroundColor: 'rgba(228, 242, 233, 0.5)', borderColor: 'var(--worm-border)' }}>
                <div className="text-sm" style={{ color: 'var(--worm-muted)' }}>
                  Insights unavailable. The stats below are still accurate.
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Games</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-games)' }}>{report.summary.gamesPlayed}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Win Rate</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-winrate)' }}>{formatPercent(report.summary.winRate)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Total Cost</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-cost)' }}>{formatCost(report.summary.totalCost)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Cost/Loss</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-cost)' }}>{formatCost(report.summary.costPerLoss)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Avg Rounds</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-games)' }}>
                  {formatOptionalNumber(report.summary.averageRounds, 1)}
                </div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Top Loss</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-losses)' }}>
                  {topFailureLabel}
                  {topFailure && (
                    <div className="text-xs font-normal mt-1" style={{ color: 'var(--worm-muted)' }}>({topFailureRate})</div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <Accordion type="multiple" defaultValue={["failure-modes", "cost-efficiency", "opponents", "data-quality"]} className="w-full">
              <AccordionItem value="failure-modes">
                <AccordionTrigger className="text-base font-bold">Failure Modes</AccordionTrigger>
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
                <AccordionTrigger className="text-base font-bold">Cost and Efficiency</AccordionTrigger>
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
                <AccordionTrigger className="text-base font-bold">Opponent Pain Points</AccordionTrigger>
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
                <AccordionTrigger className="text-base font-bold">Data Quality</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-1">
                    <div className="px-3 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#2E7D32', border: '1px solid rgba(76, 175, 80, 0.4)' }}>
                      Loss coverage: {formatPercent(report.summary.lossDeathReasonCoverage)}
                    </div>
                    <div className="px-3 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#C62828', border: '1px solid rgba(244, 67, 54, 0.4)' }}>
                      Unknown: {report.summary.unknownLosses}
                    </div>
                    <div className="px-3 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: 'rgba(255, 152, 0, 0.2)', color: '#E65100', border: '1px solid rgba(255, 152, 0, 0.4)' }}>
                      Early losses: {report.summary.earlyLosses} ({formatPercent(report.summary.earlyLossRate)})
                    </div>
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
