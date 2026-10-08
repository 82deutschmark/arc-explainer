/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Verify real leaderboard rendering preserves percentage units and explains tiny samples.
 * SRP/DRY check: Pass — renders the production components without network calls.
 */
import { test, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrustworthinessLeaderboard } from '../client/src/components/overview/leaderboards/TrustworthinessLeaderboard';
import { LeaderboardInsights } from '../client/src/components/overview/leaderboards/LeaderboardInsights';

test('confidence uses 0–100 percent while trustworthiness uses 0–1', () => {
  const html = renderToStaticMarkup(React.createElement(TrustworthinessLeaderboard, {
    performanceStats: {
      trustworthinessLeaders: [74.1, 0.5, 101].map((avgConfidence, index) => ({
        modelName: `model-${index}`, avgConfidence, avgTrustworthiness: 0.71,
        avgProcessingTime: 1000, avgCost: 0.00227, totalCost: 0.093,
      })),
      speedLeaders: [], efficiencyLeaders: [], overallTrustworthiness: 0.71,
    },
  }));
  expect(html).toContain('title="Average reported confidence">74.1%');
  expect(html).toContain('title="Average reported confidence">0.5%');
  expect(html).toContain('title="Average reported confidence">—');
  expect(html).toContain('title="Trustworthiness score">71.0%');
  expect(html).toContain('$0.00227');
  expect(html).not.toContain('7410.0%');
  expect(html).not.toContain('$2.27m');
});

test('one observation is described without declaring a champion', () => {
  const html = renderToStaticMarkup(React.createElement(LeaderboardInsights, {
    accuracyStats: { modelAccuracyRankings: [{
      modelName: 'one-run', totalAttempts: 1, correctPredictions: 1,
      accuracyPercentage: 100, singleTestAccuracy: 100, multiTestAccuracy: 0,
    }] },
  }));
  expect(html).toContain('Highest observed accuracy');
  expect(html).toContain('1 recorded attempt.');
  expect(html).toContain('not a benchmark ranking');
  expect(html).not.toContain('Accuracy champion');
});
