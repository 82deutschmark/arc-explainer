/**
 * Author: Cascade
 * Date: 2025-12-30
 * PURPOSE: Specialized service for generating Worm Arena model insights reports.
 *          Handles LLM orchestration (OpenAI Responses API), Markdown formatting, 
 *          and Tweet generation.
 * 
 * SRP/DRY check: Pass - focused on reporting and LLM summary orchestration.
 * 
 * 2025-12-30: Updated tweet format - #SnakeBench, @arcprize, #arcagi3, model page link.
 */

import { openAIClient } from '../openai/client.js';
import { handleStreamEvent, createStreamAggregates } from '../openai/streaming.js';
import { logger } from '../../utils/logger.ts';
import type { ResponseStreamEvent } from 'openai/resources/responses/responses';
import type {
  WormArenaModelInsightsReport,
  WormArenaModelInsightsSummary,
  WormArenaModelInsightsFailureMode,
  WormArenaModelInsightsOpponent,
  WormArenaStreamStatus,
} from '../../../shared/types.js';
import {
  buildInsightsSummaryPrompt,
} from '../prompts/wormArenaInsights.ts';
import {
  formatPercent,
  formatUsd,
  formatOptionalNumber,
  formatReasonLabel,
} from '../../../shared/utils/formatters.ts';

export const INSIGHTS_SUMMARY_MODEL = 'gpt-5-mini-2025-08-07';

/**
 * Error Handling Strategy for WormArenaReportService:
 *
 * - Non-streaming methods (requestInsightsSummary, buildReportObject):
 *   Return null on failure. These are used in contexts where graceful degradation
 *   is acceptable (e.g., showing stats without LLM summary).
 *
 * - Streaming methods (streamModelInsightsReport):
 *   Throw errors. Streaming is interactive and the caller needs to know immediately
 *   if something fails so they can show an error to the user.
 *
 * - Pure formatting methods (buildInsightsMarkdown, buildInsightsTweet):
 *   Never fail - return best-effort output with fallbacks.
 */
export class WormArenaReportService {
  /**
   * Build the markdown version of the model insights report.
   */
  buildInsightsMarkdown(
    modelSlug: string,
    generatedAt: string,
    summary: WormArenaModelInsightsSummary,
    failureModes: WormArenaModelInsightsFailureMode[],
    lossOpponents: WormArenaModelInsightsOpponent[],
    llmSummary: string | null,
  ): string {
    const lines: string[] = [];
    const knownLosses = Math.max(summary.losses - summary.unknownLosses, 0);

    lines.push('# Worm Arena Model Insights');
    lines.push(`Model: ${modelSlug}`);
    lines.push(`Generated: ${generatedAt}`);
    lines.push('');
    lines.push('## LLM Summary');
    let displaySummary = 'Summary unavailable.';
    if (llmSummary) {
      try {
        const parsed = JSON.parse(llmSummary);
        displaySummary = parsed.summary || llmSummary;
      } catch {
        // If JSON parsing fails, use the raw string as-is
        displaySummary = llmSummary;
      }
    }
    lines.push(displaySummary);
    lines.push('');
    lines.push('## Performance Metrics');
    lines.push(`- Games played: ${summary.gamesPlayed} (${summary.wins}W / ${summary.losses}L / ${summary.ties}T)`);
    lines.push(`- Win rate (decided): ${formatPercent(summary.winRate)}`);
    if (summary.leaderboardRank != null) {
      lines.push(`- Leaderboard Rank: #${summary.leaderboardRank} of ${summary.totalModelsRanked}`);
    }
    lines.push(`- Total cost: ${formatUsd(summary.totalCost)}`);
    lines.push(`- Cost per game: ${formatUsd(summary.costPerGame)}`);
    lines.push(`- Cost per win: ${formatUsd(summary.costPerWin)}`);
    lines.push(`- Cost per loss: ${formatUsd(summary.costPerLoss)}`);
    lines.push(`- Average rounds: ${formatOptionalNumber(summary.averageRounds, 1)}`);
    lines.push(`- Average score: ${formatOptionalNumber(summary.averageScore, 2)}`);
    lines.push(`- Score distribution: Min ${formatOptionalNumber(summary.minScore, 1)} / 25th %ile ${formatOptionalNumber(summary.p25Score, 1)} / Median ${formatOptionalNumber(summary.medianScore, 1)} / 75th %ile ${formatOptionalNumber(summary.p75Score, 1)} / Max ${formatOptionalNumber(summary.maxScore, 1)}`);
    lines.push(`- Average loss round: ${formatOptionalNumber(summary.averageDeathRoundLoss, 1)}`);
    lines.push(`- Early losses (round <= 5): ${summary.earlyLosses} (${formatPercent(summary.earlyLossRate)})`);
    lines.push('');
    lines.push('## Failure Modes (Losses)');
    if (failureModes.length === 0) {
      lines.push('- No losses recorded.');
    } else {
      failureModes.forEach((mode) => {
        const reasonLabel = formatReasonLabel(mode.reason);
        const avgRound = formatOptionalNumber(mode.averageDeathRound, 1);
        lines.push(
          `- ${reasonLabel}: ${mode.losses} (${formatPercent(mode.percentOfLosses)}), avg round ${avgRound}`,
        );
      });
    }
    lines.push('');
    lines.push('## Tough Opponents (By Losses)');
    if (lossOpponents.length === 0) {
      lines.push('- No opponents recorded.');
    } else {
      lossOpponents.forEach((opponent) => {
        const lastPlayed = opponent.lastPlayedAt ?? '-';
        lines.push(
          `- ${opponent.opponentSlug}: ${opponent.losses} losses out of ${opponent.gamesPlayed} games, last played ${lastPlayed}`,
        );
      });
    }
    lines.push('');
    lines.push('## Data Quality');
    lines.push(
      `- Losses with death reason: ${formatPercent(summary.lossDeathReasonCoverage)} (${knownLosses} of ${summary.losses})`,
    );
    lines.push(`- Losses without death reason: ${summary.unknownLosses}`);
    lines.push(`- Average death round (losses): ${formatOptionalNumber(summary.averageDeathRoundLoss, 1)}`);
    lines.push(`- Early loss rate: ${formatPercent(summary.earlyLossRate)}`);

    return lines.join('\n');
  }

  /**
   * Build a concise tweet for sharing the report.
   */
  buildInsightsTweet(
    modelSlug: string,
    summary: WormArenaModelInsightsSummary,
    failureModes: WormArenaModelInsightsFailureMode[],
  ): string {
    const topFailure = failureModes[0];
    const topReason = topFailure ? formatReasonLabel(topFailure.reason) : 'none';
    const topReasonPct = topFailure ? formatPercent(topFailure.percentOfLosses) : '0.0%';
    const avgRounds = summary.averageRounds != null ? summary.averageRounds.toFixed(0) : 'n/a';
    const costPerLoss = formatUsd(summary.costPerLoss);
    
    // Build model page URL
    const modelUrl = `https://arc.markbarney.net/worm-arena/models?model=${encodeURIComponent(modelSlug)}`;

    const tweet = `${modelSlug} #SnakeBench report: ${formatPercent(summary.winRate)} win rate, top death ${topReason} (${topReasonPct}), avg ${avgRounds} rounds, ${costPerLoss}/loss\n\n${modelUrl}\n\n@arcprize #arcagi3`;

    return tweet.length > 280 ? `${tweet.slice(0, 277)}...` : tweet;
  }

  /**
   * Build the OpenAI Responses API request payload for model insights.
   * FIX (Responses API): Narrative instructions and structure are strictly separated from data.
   */
  buildInsightsRequest(
    modelSlug: string,
    summary: WormArenaModelInsightsSummary,
    failureModes: WormArenaModelInsightsFailureMode[],
    lossOpponents: WormArenaModelInsightsOpponent[],
  ) {
    const prompt = buildInsightsSummaryPrompt(modelSlug, summary, failureModes, lossOpponents);

    return {
      model: INSIGHTS_SUMMARY_MODEL,
      input: [
        {
          id: `msg_${Date.now()}_summary_${Math.random().toString(16).slice(2)}`,
          role: 'user' as const,
          type: 'message' as const,
          content: [
            {
              type: 'input_text' as const,
              text: prompt,
            },
          ],
        },
      ],
      instructions:
        'You are an eSports commentator covering how this LLM plays Snake. Using the provided statistics, give a brisk, hype-y breakdown of how it wins and loses. Spotlight the key failure patterns and what goes wrong in those matches. Skip any ML training or technical talk. Focus on match moments, risky habits, and the opponents that punish it. Your response MUST follow the provided JSON schema exactly.',
      reasoning: {
        effort: 'high' as const,
        summary: 'detailed' as const,
      },
      text: {
        verbosity: 'high' as const,
        format: {
          type: 'json_schema' as const,
          name: 'model_insights',
          strict: false as const,
          schema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'A punchy, single-paragraph Twitch streamer style takeaway about the model performance.'
              },
              deathAnalysis: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    cause: { type: 'string' },
                    frequency: { type: 'string' },
                    pattern: { type: 'string' }
                  }
                },
                description: 'How it got eliminated, how often, and the situational pattern.'
              },
              toughOpponents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    opponent: { type: 'string' },
                    record: { type: 'string' },
                    issue: { type: 'string' }
                  }
                },
                description: 'Opponents who consistently hand it losses.'
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Where this LLM shines, where it struggles, and what to lean into or avoid.'
              }
            },
            required: ['summary', 'deathAnalysis', 'toughOpponents', 'recommendations'],
            additionalProperties: false
          }
        }
      },
      max_output_tokens: 16000,
    };
  }

  /**
   * Request the LLM summary for the report.
   */
  async requestInsightsSummary(
    modelSlug: string,
    summary: WormArenaModelInsightsSummary,
    failureModes: WormArenaModelInsightsFailureMode[],
    lossOpponents: WormArenaModelInsightsOpponent[],
  ): Promise<string | null> {
    const requestBody = this.buildInsightsRequest(modelSlug, summary, failureModes, lossOpponents);

    try {
      // Type assertion needed because we're using custom Responses API structure
      const response = await openAIClient.responses.create(requestBody as any);

      // Prefer parsed output if available (Responses API includes this in the response)
      const responseAny = response as any;
      if (responseAny.output_parsed) {
        return JSON.stringify(responseAny.output_parsed);
      }

      // Otherwise use text output (should already be JSON from our schema)
      if (responseAny.output_text) {
        return responseAny.output_text.trim();
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`WormArenaReportService.requestInsightsSummary failed: ${message}`, 'worm-arena-reporting');
      return null;
    }
  }

  /**
   * Stream model insights report generation.
   */
  async streamModelInsightsReport(
    modelSlug: string,
    data: {
      summary: WormArenaModelInsightsSummary;
      failureModes: WormArenaModelInsightsFailureMode[];
      lossOpponents: WormArenaModelInsightsOpponent[];
    },
    handlers: {
      onStatus: (status: WormArenaStreamStatus) => void;
      onChunk: (chunk: { type: string; delta?: string; content?: string; timestamp: number }) => void;
    },
    abortSignal: AbortSignal
  ): Promise<WormArenaModelInsightsReport> {
    const requestBody = this.buildInsightsRequest(
      modelSlug,
      data.summary,
      data.failureModes,
      data.lossOpponents
    );

    const streamingRequest = {
      ...requestBody,
      stream: true,
    };

    // Type assertion needed because we're using custom Responses API structure
    const stream = openAIClient.responses.stream(streamingRequest as any);
    const aggregates = createStreamAggregates(true);

    for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
      if (abortSignal.aborted) {
        stream.controller.abort();
        throw new Error('Stream aborted by client');
      }

      handleStreamEvent(event, aggregates, {
        emitChunk: (chunk) => {
          handlers.onChunk({
            type: chunk.type,
            delta: chunk.delta,
            content: chunk.content,
            timestamp: Date.now(),
          });
        },
        emitEvent: (eventName, payload) => {
          if (eventName === 'stream.status') {
            handlers.onStatus(payload as unknown as WormArenaStreamStatus);
          } else if (eventName === 'stream.chunk') {
            handlers.onChunk({
              type: (payload as any)?.type || 'unknown',
              delta: (payload as any)?.delta,
              content: (payload as any)?.content,
              timestamp: Date.now(),
            });
          }
        },
      });
    }

    const finalResponse = await stream.finalResponse();

    let llmSummary = '';
    if (aggregates.parsed) {
      llmSummary = aggregates.parsed;
    } else {
      llmSummary = finalResponse.output_text || '';
    }

    return this.buildReportObject(modelSlug, data, llmSummary);
  }

  /**
   * Internal helper to build the final report object.
   */
  buildReportObject(
    modelSlug: string,
    data: {
      summary: WormArenaModelInsightsSummary;
      failureModes: WormArenaModelInsightsFailureMode[];
      lossOpponents: WormArenaModelInsightsOpponent[];
    },
    llmSummary: string | null,
    generatedAt: string = new Date().toISOString()
  ): WormArenaModelInsightsReport {
    const markdownReport = this.buildInsightsMarkdown(
      modelSlug,
      generatedAt,
      data.summary,
      data.failureModes,
      data.lossOpponents,
      llmSummary,
    );
    const tweetText = this.buildInsightsTweet(modelSlug, data.summary, data.failureModes);

    return {
      modelSlug,
      generatedAt,
      summary: data.summary,
      failureModes: data.failureModes,
      lossOpponents: data.lossOpponents,
      llmSummary,
      llmModel: llmSummary ? INSIGHTS_SUMMARY_MODEL : null,
      markdownReport,
      tweetText,
    };
  }
}

export const wormArenaReportService = new WormArenaReportService();
