/*
Author: Claude Opus 5
Date: 2026-09-04
PURPOSE: Lock the promotion rule's behaviour, clause by clause. This is the file that
         decides which games reach the training side, it runs on a handful of play
         sessions, and a silent change to it would be invisible until a model trained on
         the wrong corpus. Each test names the clause it defends.
SRP/DRY check: Pass -- covers Arc3Promotion only. The repository and catalog it depends on
         are mocked, because what is under test is the rule, not the SQL or the file read.
*/

import { describe, it, expect, beforeEach, vi } from 'vitest';

const getVerdictsByBuild = vi.fn();
const getSource = vi.fn();

vi.mock('../../../server/repositories/Arc3FeedbackRepository.js', () => ({
  Arc3FeedbackRepository: { getVerdictsByBuild: (...a: unknown[]) => getVerdictsByBuild(...a) },
}));
vi.mock('../../../server/services/arc3Mirror/Arc3MirrorCatalog', () => ({
  Arc3MirrorCatalog: { getSource: (...a: unknown[]) => getSource(...a) },
}));
vi.mock('../../../server/utils/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

const { Arc3Promotion } = await import('../../../server/services/arc3Mirror/Arc3Promotion');

/** A verdict that clears every clause. Each test spoils exactly one thing. */
function passing(over: Record<string, unknown> = {}) {
  return {
    gameId: 'g012', sourceVersion: 'aaaaaaaaaaaa', responses: 1,
    solvedIt: 1, neverUnderstood: 0, inputsDidNothing: 0,
    feltBroken: 0, feltImpossible: 0, enjoyedIt: 1, notes: 1,
    maxReachedLevel: 3, lastSeen: '2026-09-04T00:00:00.000Z', ...over,
  };
}

beforeEach(() => {
  getVerdictsByBuild.mockReset();
  getSource.mockReset();
  getSource.mockResolvedValue({ sourceCode: 'x', className: 'G012', sourceVersion: 'aaaaaaaaaaaa' });
});

describe('Arc3Promotion.list', () => {
  it('promotes a cleared, unbroken verdict on the build being served now', async () => {
    getVerdictsByBuild.mockResolvedValue([passing()]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual(['g012']);
    expect(out.candidates[0].reasons).toEqual([]);
    expect(out.candidates[0].isCurrentBuild).toBe(true);
  });

  it('withholds a verdict on a superseded build, and says which build it was', async () => {
    getVerdictsByBuild.mockResolvedValue([passing({ sourceVersion: 'bbbbbbbbbbbb' })]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates[0].isCurrentBuild).toBe(false);
    expect(out.candidates[0].reasons.join(' ')).toContain('bbbbbbbbbbbb');
    // Reported, not dropped: "nobody played it" and "played before the rebuild" are
    // different facts and the consumer has to be able to tell them apart.
    expect(out.candidates).toHaveLength(1);
  });

  it('withholds a pre-stamp verdict rather than assuming it describes the current build', async () => {
    getVerdictsByBuild.mockResolvedValue([passing({ sourceVersion: null })]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates[0].reasons.join(' ')).toContain('predates the build stamp');
  });

  it('withholds a game nobody has cleared a level of', async () => {
    getVerdictsByBuild.mockResolvedValue([passing({ maxReachedLevel: 0 })]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates[0].reasons).toContain('no player has cleared a level');
  });

  it('withholds on a single broken or impossible report', async () => {
    getVerdictsByBuild.mockResolvedValue([
      passing({ gameId: 'g001', feltBroken: 1 }),
      passing({ gameId: 'g002', feltImpossible: 1 }),
    ]);
    getSource.mockResolvedValue({ sourceCode: 'x', className: 'G', sourceVersion: 'aaaaaaaaaaaa' });
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates.map((c) => c.reasons.join(' '))).toEqual([
      expect.stringContaining('called it broken'),
      expect.stringContaining('called it impossible'),
    ]);
  });

  it('does not promote on enjoyment alone — fun is not evidence a game is solvable', async () => {
    getVerdictsByBuild.mockResolvedValue([passing({ enjoyedIt: 9, maxReachedLevel: 0 })]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
  });

  it('reports a game that has left the catalog instead of throwing', async () => {
    getVerdictsByBuild.mockResolvedValue([passing()]);
    getSource.mockResolvedValue(null);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates[0].reasons).toContain('game is no longer in the catalog');
  });

  it('survives an unreadable game without hiding every other game', async () => {
    getVerdictsByBuild.mockResolvedValue([passing({ gameId: 'g001' }), passing({ gameId: 'g002' })]);
    getSource.mockImplementation(async (id: string) => {
      if (id === 'g001') throw new Error('disk gone');
      return { sourceCode: 'x', className: 'G002', sourceVersion: 'aaaaaaaaaaaa' };
    });
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual(['g002']);
    expect(out.candidates).toHaveLength(2);
  });

  it('answers with an empty promoted list rather than an error when nothing has been played', async () => {
    getVerdictsByBuild.mockResolvedValue([]);
    const out = await Arc3Promotion.list();
    expect(out.promoted).toEqual([]);
    expect(out.candidates).toEqual([]);
    expect(out.rule.minReachedLevel).toBe(1);
  });
});
