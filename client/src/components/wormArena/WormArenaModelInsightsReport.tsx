/**
 * Author: Cascade
 * Date: 2025-12-30
 * PURPOSE: Inline actionable insights report for the Worm Arena Models page.
 *          Generates a per-model report on demand, displays an LLM summary,
 *          and provides copy, save, and Twitter/X share actions.
 *          Integrated full performance metrics including quartiles and ranking.
 * SRP/DRY check: Pass - focused on report display and actions.
 * 
 * 2025-12-30: UI polish - smaller title, larger summary text, compact buttons,
 *             improved Share on X button styling.
 */

import React from 'react';

import {
  formatPercent,
  formatUsd,
  formatOptionalNumber,
  formatReasonLabel,
} from '@shared/utils/formatters';
import { useWormArenaModelInsightsStream } from '@/hooks/useWormArenaModelInsightsStream';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface WormArenaModelInsightsReportProps {
  modelSlug: string;
}

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
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-2xl font-bold" style={{ color: '#000' }}>
            Actionable Insights Report
          </CardTitle>
          {report && isComplete && (
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReport}
                className="text-sm font-medium"
              >
                {copyHint ? copyHint : 'Copy'}
              </Button>
              {downloadUrl && (
                <Button variant="outline" size="sm" asChild className="text-sm font-medium">
                  <a href={downloadUrl} download={`worm-arena-${modelSlug}-insights.md`}>
                    Save .md
                  </a>
                </Button>
              )}
              {tweetUrl && (
                <Button variant="outline" size="sm" asChild className="text-sm font-medium bg-black text-white hover:bg-gray-800">
                  <a href={tweetUrl} target="_blank" rel="noreferrer">
                    Share on X
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="text-sm font-medium mt-2" style={{ color: 'var(--worm-muted)' }}>
          Full history report focused on loss reasons, cost, and opponent pain points.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base" style={{ color: 'var(--worm-ink)' }}>
        {error && !isStreaming && (
          <div className="py-3 text-base text-red-700">{error.message}</div>
        )}

        {!report && !isStreaming && (
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleGenerateReport} style={{ backgroundColor: 'var(--worm-green)', color: 'var(--worm-green-ink)' }} className="hover:opacity-90 text-lg font-bold px-6 py-3" size="lg">
              Generate Report
            </Button>
            <span className="text-xl font-semibold" style={{ color: '#000' }}>
              Report generation uses all completed games for this model.
            </span>
          </div>
        )}

        {isStreaming && (
          <div className="space-y-4">
            {/* Loading indicator - show during entire streaming duration until content arrives */}
            {!reasoningText && !parsedInsights && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin">
                    <svg className="w-8 h-8" style={{ color: 'var(--worm-green)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--worm-muted)' }}>
                    Analyzing model performance...
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
              <div className="rounded-lg border p-6 bg-amber-50/30" style={{ borderColor: 'var(--worm-border)' }}>
                <h4 className="text-3xl font-black mb-4" style={{ color: '#000' }}>
                  Reasoning (live)
                </h4>
                <div className="text-xl font-medium whitespace-pre-wrap break-words overflow-hidden max-h-96 overflow-y-auto" style={{ color: '#000', lineHeight: '1.6' }}>
                  {reasoningText}
                </div>
              </div>
            )}

            {/* Partial insights (if parseable) */}
            {parsedInsights && (
              <div className="rounded-lg border p-6 bg-blue-50/30" style={{ borderColor: 'var(--worm-border)' }}>
                <h4 className="text-3xl font-black mb-4" style={{ color: '#000' }}>
                  Insights (streaming...)
                </h4>
                <pre className="text-lg font-mono overflow-auto max-h-96 overflow-y-auto" style={{ color: '#000' }}>
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
                            <div className="text-base leading-relaxed font-medium" style={{ color: 'var(--worm-ink)' }}>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Games</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-games)' }}>{report.summary.gamesPlayed}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Record (W/L/T)</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-winrate)' }}>
                  {report.summary.wins}/{report.summary.losses}/{report.summary.ties}
                </div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Win Rate</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-winrate)' }}>{formatPercent(report.summary.winRate)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Rank</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-cost)' }}>
                  {report.summary.leaderboardRank ? `#${report.summary.leaderboardRank}` : 'unrated'}
                  {report.summary.totalModelsRanked && (
                    <span className="text-xs font-normal ml-1" style={{ color: 'var(--worm-muted)' }}>
                      of {report.summary.totalModelsRanked}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Total Cost</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-cost)' }}>{formatUsd(report.summary.totalCost)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: 'var(--worm-border)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--worm-muted)' }}>Cost/Win</div>
                <div className="text-lg font-bold" style={{ color: 'var(--worm-metric-cost)' }}>{formatUsd(report.summary.costPerWin)}</div>
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
                      Total Cost: {formatUsd(report.summary.totalCost)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Game: {formatUsd(report.summary.costPerGame)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Win: {formatUsd(report.summary.costPerWin)}
                    </Badge>
                    <Badge variant="outline">
                      Cost per Loss: {formatUsd(report.summary.costPerLoss)}
                    </Badge>
                    <Badge variant="outline">
                      Score: {formatOptionalNumber(report.summary.averageScore, 2)} avg / {formatOptionalNumber(report.summary.p25Score, 1)} p25 / {formatOptionalNumber(report.summary.medianScore, 1)} p50 / {formatOptionalNumber(report.summary.p75Score, 1)} p75
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
