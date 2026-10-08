/**
 * Author: Codex
 * Date: 2026-10-08
 * PURPOSE: Execute the difficult-puzzle aggregation against disposable PostgreSQL tables.
 * SRP/DRY check: Pass — exercises the real repository query, including feedback and filters.
 * Run with ARC_TEST_POSTGRES_URL pointing at a disposable local PostgreSQL instance.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { puzzleLoader } from '../../server/services/puzzleLoader';
import modelDatasetRepo from '../../server/repositories/ModelDatasetRepository';
import { MetricsRepository } from '../../server/repositories/MetricsRepository';

const url = process.env.ARC_TEST_POSTGRES_URL;
const client = new Client({ connectionString: url });
class TestMetrics extends MetricsRepository {
  isConnected() { return true; }
  protected async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }
}
const metrics = new TestMetrics();
describe.skipIf(!url)('difficult puzzles: real PostgreSQL aggregation', () => {
  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(url!).hostname)) throw new Error('Use a disposable local test database');
    await client.connect();
    // Temporary tables shadow public tables only in this connection; no shared data is changed.
    await client.query(`CREATE TEMP TABLE explanations (
      id int, puzzle_id text, has_multiple_predictions boolean, is_prediction_correct boolean,
      multi_test_all_correct boolean, trustworthiness_score numeric, multi_test_average_accuracy numeric,
      confidence numeric, created_at timestamp, estimated_cost numeric, api_processing_time_ms int,
      reasoning_tokens int, input_tokens int, output_tokens int, total_tokens int,
      model_name text, reasoning_effort text
    ); CREATE TEMP TABLE feedback (id int, explanation_id int, feedback_type text);
    INSERT INTO explanations (id,puzzle_id,has_multiple_predictions,is_prediction_correct,multi_test_all_correct,
      trustworthiness_score,confidence,estimated_cost,api_processing_time_ms) VALUES
      (1,'a',false,true,null,0,50,1,100),
      (2,'a',false,false,null,1,50,3,300),
      (3,'b',true,true,false,1,20,10,1000),
      (4,'c',true,false,true,0,70,2,200),
      (5,'unknown',false,null,null,0,50,1,100);
    INSERT INTO feedback VALUES (1,1,'not_helpful'),(2,1,'not_helpful'),(3,1,'helpful');`);
  });
  afterAll(async () => { await client.end(); });
  it('uses scored outcomes, excludes unknowns and does not weight attempts by feedback count', async () => {
    const rows = await metrics.getWorstPerformingPuzzles(20, 'accuracy', { minAccuracy: 0, maxAccuracy: 1, includeRichMetrics: true });
    expect(rows.map(r => r.puzzleId)).toEqual(['b','a','c']);
    expect(rows[1]).toMatchObject({ avgAccuracy: 0.5, totalExplanations: 2, wrongCount: 1, totalFeedback: 3, negativeFeedback: 2, avgCost: 2 });
    expect(rows[0].avgAccuracy).toBe(0);
    expect(rows[2].avgAccuracy).toBe(1);
  });
  it('filters task IDs before the result limit, including an empty catalog', async () => {
    expect((await metrics.getWorstPerformingPuzzles(1, 'accuracy', { puzzleIds: ['c'], minAccuracy: 0, maxAccuracy: 1 })).map(r => r.puzzleId)).toEqual(['c']);
    expect(await metrics.getWorstPerformingPuzzles(20, 'accuracy', { puzzleIds: [] })).toEqual([]);
  });
  it('uses the same correctness measure for zero and range filters', async () => {
    expect((await metrics.getWorstPerformingPuzzles(20, 'accuracy', { zeroAccuracyOnly: true })).map(r => r.puzzleId)).toEqual(['b']);
    expect((await metrics.getWorstPerformingPuzzles(20, 'accuracy', { minAccuracy: 0.4, maxAccuracy: 0.6 })).map(r => r.puzzleId)).toEqual(['a']);
  });
  it('sorts cost and processing time without requiring the rich-metrics display flag', async () => {
    for (const sort of ['cost', 'processing_time']) {
      expect((await metrics.getWorstPerformingPuzzles(20, sort, { minAccuracy: 0, maxAccuracy: 1 }))[0].puzzleId).toBe('b');
    }
  });
});

describe('difficult-puzzle dataset membership', () => {
  it('keeps shared puzzles in ARC2 and filters by the task test count', () => {
    const catalog = puzzleLoader.getPuzzleList({ source: 'ARC2-Eval', includeSharedPuzzles: true });
    expect(catalog.map(p => p.id).sort()).toEqual(modelDatasetRepo.getPuzzleIdsFromDataset('evaluation2'));
    const multi = puzzleLoader.getPuzzleList({ source: 'ARC2-Eval', multiTestFilter: 'multi', includeSharedPuzzles: true });
    expect(multi.length).toBeGreaterThan(0);
    expect(multi.every(p => p.testCaseCount > 1 && p.maxGridSize > 0)).toBe(true);
  });
});
