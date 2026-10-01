/*
 * Author: GPT-6 (Codex)
 * Date: 2026-09-30
 * PURPOSE: Validate complete reconstructions against real registry evidence and executed
 *          replay reports, including coverage, chronology, provenance, staleness and splits.
 * SRP/DRY check: Pass — actual game records and committed replay evidence; corruption tests
 *          mutate those inputs to ensure validation fails instead of silently claiming success.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildArc3GameDatasetBundle } from '../../server/services/arc3/arc3GameDataset';
import { buildHumanReasoningDataset, renderTraceCollection, TRACE_FIELDS, type ReasoningTrace, type ReplayVerification } from '../../scripts/arc3/human_reasoning_dataset';

const traces = JSON.parse(readFileSync(new URL('../../data/arc3-human-reasoning/annotations.json', import.meta.url), 'utf8')).traces as ReasoningTrace[];
const replay = JSON.parse(readFileSync(new URL('../../data/arc3-human-reasoning/release/evidence/replay-verification.json', import.meta.url), 'utf8')) as ReplayVerification;
const bundle = buildArc3GameDatasetBundle();
const dataset = buildHumanReasoningDataset(bundle, traces, replay);

describe('complete human reasoning reconstructions', () => {
  it('reconstructs all 66 source accounts across every public game', () => {
    expect(dataset.sources).toHaveLength(66);
    expect(dataset.episodes).toHaveLength(66);
    expect(dataset.decisions).toHaveLength(132);
    expect(new Set(dataset.episodes.map((row) => row.gameId)).size).toBe(25);
    for (const episode of dataset.episodes) {
      for (const field of TRACE_FIELDS) expect(episode.trace[field].trim().length).toBeGreaterThan(10);
    }
  });

  it('fills missing expectations while preserving the incomplete original account', () => {
    const source = dataset.sources.find((row) => row.gameId === 'tu93' && row.level === 2)!;
    expect(source.evidence.expected).toBeNull();
    const episode = dataset.episodes.find((row) => row.id === source.id)!;
    expect(episode.trace.expected).toContain('approach direction');
    expect(episode.provenance.expectationOrigin).toBe('inferred_from_game_evidence');
    expect(episode.provenance.exactHumanActionAlignment).toBe(false);
  });

  it('places the result after the first decision and before the revision', () => {
    for (const episode of dataset.episodes) {
      expect(episode.messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant']);
      expect(episode.messages[2].content).toContain(episode.trace.expected);
      expect(episode.messages[3].content).toContain(episode.trace.outcome);
      const first = dataset.decisions.find((row) => row.episodeId === episode.id && row.stage === 'before_outcome')!;
      expect(first.prompt).toHaveLength(2);
      expect(JSON.stringify(first.prompt)).not.toContain(episode.trace.outcome);
      expect(first.response).toBe(episode.messages[2].content);
      const update = dataset.decisions.find((row) => row.episodeId === episode.id && row.stage === 'after_outcome')!;
      expect(update.prompt).toHaveLength(4);
    }
  });

  it('keeps sparse game-wide notes and their chosen scenario levels distinct', () => {
    const episode = dataset.episodes.find((row) => row.gameId === 'tn36')!;
    expect(episode.sourceLevel).toBeNull();
    expect(episode.scenarioLevel).toBe(1);
    expect(episode.provenance.scenarioLevelAssignment).toBe('selected_worked_example_for_game_wide_note');
  });

  it('keeps all decisions, source variants and demonstrations grouped by game', () => {
    const train = new Set(dataset.episodes.filter((row) => row.split === 'train').map((row) => row.gameId));
    const validation = new Set(dataset.episodes.filter((row) => row.split === 'validation').map((row) => row.gameId));
    expect([...train].filter((game) => validation.has(game))).toEqual([]);
    expect(dataset.episodes.filter((row) => row.split === 'train')).toHaveLength(44);
    expect(dataset.episodes.filter((row) => row.split === 'validation')).toHaveLength(22);
    for (const decision of dataset.decisions) expect(decision.split).toBe(dataset.episodes.find((row) => row.id === decision.episodeId)!.split);
  });

  it('rejects stale, missing and duplicate reconstructions', () => {
    const changed = structuredClone(bundle);
    changed.games.find((row) => row.gameId === 'cn04')!.levels[4].observations[0].happened += ' Correction.';
    expect(() => buildHumanReasoningDataset(changed, traces, replay)).toThrow(/Source changed|Unresolved source/);
    expect(() => buildHumanReasoningDataset(bundle, traces.slice(1), replay)).toThrow('Every source observation');
    expect(() => buildHumanReasoningDataset(bundle, [...traces, traces[0]], replay)).toThrow('Duplicate trace');
    expect(() => buildHumanReasoningDataset(bundle, [{ ...traces[0], expected: '' }, ...traces.slice(1)], replay)).toThrow('Incomplete trace');
  });

  it('rejects a failed or wrong-build demonstration and excluded agent text', () => {
    const wrongBuild = structuredClone(replay);
    wrongBuild.games[0].build = 'wrong-build';
    expect(() => buildHumanReasoningDataset(bundle, traces, wrongBuild)).toThrow('Missing verified');
    const failed = structuredClone(replay);
    failed.games[0].finalState = 'GAME_OVER';
    expect(() => buildHumanReasoningDataset(bundle, traces, failed)).toThrow('Missing verified');
    expect(() => buildHumanReasoningDataset(bundle, traces, { ...replay, agentTextIncluded: true })).toThrow('without agent text');
  });

  it('excludes as66 even if accidentally added to the canonical bundle', () => {
    const changed = structuredClone(bundle);
    changed.games[0].gameId = 'as66';
    expect(() => buildHumanReasoningDataset(changed, traces, replay)).toThrow('as66');
  });

  it('has exact current-build demonstration references for every narrative', () => {
    for (const episode of dataset.episodes) {
      expect(episode.evidence.verifiedDemonstration.levelCleared).toBe(true);
      expect(episode.evidence.verifiedDemonstration.actions).toBeGreaterThan(0);
      expect(episode.evidence.images.length).toBeGreaterThan(0);
    }
    expect(replay.games).toHaveLength(25);
    expect(replay.games.reduce((sum, game) => sum + game.levels.length, 0)).toBe(183);
    expect(replay.games.reduce((sum, game) => sum + game.levels.reduce((n, level) => n + level.actions, 0), 0)).toBe(6732);
  });

  it('renders every complete trace deterministically', () => {
    const text = renderTraceCollection(dataset);
    for (const episode of dataset.episodes) {
      expect(text).toContain(episode.id);
      expect(text).toContain(episode.trace.expected);
      expect(text).toContain(episode.trace.revision);
    }
    const repeated = buildHumanReasoningDataset(bundle, traces, replay);
    expect(repeated.episodes).toEqual(dataset.episodes);
    expect(renderTraceCollection(repeated)).toBe(text);
  });
});
