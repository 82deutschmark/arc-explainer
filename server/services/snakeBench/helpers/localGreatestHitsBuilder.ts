/**
 * Author: Cascade
 * Date: 2026-01-19
 * PURPOSE: Build Worm Arena "Greatest Hits" lists from local replay JSONs when the DB is empty.
 *          Scans the configured completed-games directory, computes the same metrics as the
 *          Postgres query (rounds, cost, scores, duration), and emits curated entries with
 *          highlight reasons so the API can fall back to recent local matches.
 * SRP/DRY check: Pass — encapsulated local ranking logic, no coupling to controllers or UI.
 */

import fs from 'fs';
import path from 'path';
import type { WormArenaGreatestHitGame } from '../../../../shared/types.js';
import { logger } from '../../../utils/logger.ts';
import { getCompletedGamesAbsolutePath } from '../utils/constants.ts';

const MAX_TOTAL = 20;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

interface LocalReplayMetrics {
  gameId: string;
  startedAt: string;
  endedAt?: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxRounds: number;
  boardWidth: number;
  boardHeight: number;
  totalCost: number;
  maxFinalScore: number;
  sumFinalScores: number;
  scoreDelta: number;
  durationSeconds: number;
}

interface ReplayPlayer {
  name?: unknown;
  final_score?: unknown;
  totals?: {
    cost?: unknown;
  } | null;
}

type DimensionKey =
  | 'rounds'
  | 'cost'
  | 'score'
  | 'duration'
  | 'total_score'
  | 'close_match'
  | 'apples_25_plus';

interface DimensionConfig {
  key: DimensionKey;
  filter: (g: LocalReplayMetrics) => boolean;
  sort: (a: LocalReplayMetrics, b: LocalReplayMetrics) => number;
}

const dimensionConfigs: DimensionConfig[] = [
  {
    key: 'rounds',
    filter: (g) => g.roundsPlayed >= 20,
    sort: (a, b) => b.roundsPlayed - a.roundsPlayed || (b.startedAt > a.startedAt ? 1 : -1),
  },
  {
    key: 'cost',
    filter: (g) => g.roundsPlayed >= 5 && g.totalCost >= 0.01,
    sort: (a, b) => b.totalCost - a.totalCost || b.roundsPlayed - a.roundsPlayed,
  },
  {
    key: 'score',
    filter: (g) => g.roundsPlayed >= 5,
    sort: (a, b) => b.maxFinalScore - a.maxFinalScore || b.roundsPlayed - a.roundsPlayed,
  },
  {
    key: 'duration',
    filter: (g) => g.durationSeconds >= 60,
    sort: (a, b) => b.durationSeconds - a.durationSeconds,
  },
  {
    key: 'total_score',
    filter: (g) => g.roundsPlayed >= 5 && g.sumFinalScores >= 10,
    sort: (a, b) => b.sumFinalScores - a.sumFinalScores || b.roundsPlayed - a.roundsPlayed,
  },
  {
    key: 'close_match',
    filter: (g) => g.roundsPlayed >= 5 && g.scoreDelta <= 2 && g.maxFinalScore >= 5,
    sort: (a, b) => a.scoreDelta - b.scoreDelta || b.maxFinalScore - a.maxFinalScore,
  },
  {
    key: 'apples_25_plus',
    filter: (g) => g.roundsPlayed >= 5 && g.maxFinalScore >= 25,
    sort: (a, b) => b.maxFinalScore - a.maxFinalScore || b.roundsPlayed - a.roundsPlayed,
  },
];

export async function buildLocalGreatestHits(
  limitPerDimension: number,
  repoRoot: string = process.cwd()
): Promise<WormArenaGreatestHitGame[]> {
  const safeLimit = clampLocalLimit(limitPerDimension);
  const completedDir = getCompletedGamesAbsolutePath(repoRoot);

  if (!fs.existsSync(completedDir)) {
    logger.warn(
      `buildLocalGreatestHits: completed games directory missing (${completedDir})`,
      'snakebench-service'
    );
    return [];
  }

  const files = await listReplayFiles(completedDir);
  if (files.length === 0) {
    return [];
  }

  const metrics = await parseReplayMetrics(files);
  if (metrics.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const ordered: WormArenaGreatestHitGame[] = [];

  outer: for (const dimension of dimensionConfigs) {
    const dimensionMatches = metrics
      .filter(dimension.filter)
      .sort(dimension.sort)
      .slice(0, safeLimit);

    for (const match of dimensionMatches) {
      if (ordered.length >= MAX_TOTAL) {
        break outer;
      }
      if (seen.has(match.gameId)) {
        continue;
      }
      const entry = toGreatestHit(match, dimension.key);
      if (!entry) {
        continue;
      }
      ordered.push(entry);
      seen.add(entry.gameId);
    }
  }

  return ordered;
}

function clampLocalLimit(limit: number): number {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

async function listReplayFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir);
    return entries
      .filter((name) => name.startsWith('snake_game_') && name.endsWith('.json'))
      .map((name) => path.join(dir, name));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`buildLocalGreatestHits: failed to read directory ${dir}: ${message}`, 'snakebench-service');
    return [];
  }
}

async function parseReplayMetrics(files: string[]): Promise<LocalReplayMetrics[]> {
  const metrics: LocalReplayMetrics[] = [];

  for (const file of files) {
    try {
      const raw = await fs.promises.readFile(file, 'utf8');
      const data = JSON.parse(raw);
      const metric = extractMetrics(file, data);
      if (metric) {
        metrics.push(metric);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`buildLocalGreatestHits: failed to parse ${path.basename(file)}: ${message}`, 'snakebench-service');
    }
  }

  return metrics;
}

function extractMetrics(filePath: string, payload: any): LocalReplayMetrics | null {
  const game = payload?.game ?? {};
  const players = (payload?.players ?? {}) as Record<string, ReplayPlayer>;
  const totals = payload?.totals ?? {};

  const gameId: string = toStringOrEmpty(game.id) || deriveGameIdFromFilename(filePath);
  if (!gameId) {
    return null;
  }

  const playerEntries = Object.entries(players).sort((a, b) => Number(a[0]) - Number(b[0]));
  const playerA = playerEntries[0]?.[1] ?? {};
  const playerB = playerEntries[1]?.[1] ?? {};
  const modelA = toStringOrEmpty(playerA.name);
  const modelB = toStringOrEmpty(playerB.name);
  if (!modelA || !modelB) {
    return null;
  }

  const roundsPlayed = resolveRoundsPlayed(game, payload);
  const maxRounds = Number.isFinite(game?.max_rounds)
    ? Number(game.max_rounds)
    : roundsPlayed;

  const boardWidth = Number(game?.board?.width ?? 0);
  const boardHeight = Number(game?.board?.height ?? 0);

  const totalCost = resolveTotalCost(totals, playerEntries as Array<[string, ReplayPlayer]>);
  const scores = playerEntries.map(([, player]) => Number((player as ReplayPlayer)?.final_score ?? 0));
  const maxFinalScore = Math.max(0, ...scores);
  const sumFinalScores = scores.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
  const scoreDelta = scores.length >= 2 ? Math.abs(scores[0] - scores[1]) : maxFinalScore;

  const startedAt = toStringOrEmpty(game?.started_at);
  const endedAt = toStringOrEmpty(game?.ended_at);
  const durationSeconds = computeDurationSeconds(startedAt, endedAt);

  return {
    gameId,
    startedAt,
    endedAt: endedAt || undefined,
    modelA,
    modelB,
    roundsPlayed,
    maxRounds,
    boardWidth,
    boardHeight,
    totalCost,
    maxFinalScore,
    sumFinalScores,
    scoreDelta,
    durationSeconds,
  };
}

function deriveGameIdFromFilename(filePath: string): string {
  const base = path.basename(filePath, '.json');
  return base.replace(/^snake_game_/, '');
}

function resolveRoundsPlayed(game: any, payload: any): number {
  const declared = Number(game?.rounds_played ?? 0);
  if (declared > 0) {
    return declared;
  }
  if (Array.isArray(payload?.frames)) {
    return payload.frames.length;
  }
  if (Array.isArray(payload?.rounds)) {
    return payload.rounds.length;
  }
  return 0;
}

function resolveTotalCost(
  totals: Record<string, unknown>,
  players: Array<[string, ReplayPlayer]>
): number {
  const aggregate = Number(totals?.cost ?? 0);
  if (aggregate > 0) {
    return aggregate;
  }
  return players.reduce((acc, [, player]) => {
    const playerCost = Number(player?.totals?.cost ?? 0);
    return acc + (Number.isFinite(playerCost) ? playerCost : 0);
  }, 0);
}

function computeDurationSeconds(startedAt: string, endedAt: string): number {
  if (!startedAt || !endedAt) {
    return 0;
  }
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(0, (end - start) / 1000);
}

function toGreatestHit(match: LocalReplayMetrics, dimension: DimensionKey): WormArenaGreatestHitGame | null {
  const highlight = buildHighlight(match, dimension);
  const category = resolveCategory(dimension);
  if (!highlight || !category) {
    return null;
  }

  return {
    gameId: match.gameId,
    startedAt: match.startedAt || '',
    endedAt: match.endedAt,
    modelA: match.modelA,
    modelB: match.modelB,
    roundsPlayed: match.roundsPlayed,
    maxRounds: match.maxRounds,
    totalCost: match.totalCost,
    maxFinalScore: match.maxFinalScore,
    scoreDelta: match.scoreDelta,
    boardWidth: match.boardWidth,
    boardHeight: match.boardHeight,
    highlightReason: highlight,
    category,
    sumFinalScores: match.sumFinalScores > 0 ? match.sumFinalScores : undefined,
    durationSeconds: match.durationSeconds > 0 ? match.durationSeconds : undefined,
  };
}

function resolveCategory(dimension: DimensionKey): string {
  switch (dimension) {
    case 'rounds':
      return 'longest_rounds';
    case 'cost':
      return 'highest_cost';
    case 'score':
      return 'highest_score';
    case 'duration':
      return 'longest_duration';
    case 'total_score':
      return 'highest_total_score';
    case 'close_match':
      return 'close_match';
    case 'apples_25_plus':
      return 'apples_25_plus';
    default:
      return '';
  }
}

function buildHighlight(match: LocalReplayMetrics, dimension: DimensionKey): string {
  switch (dimension) {
    case 'rounds':
      if (match.roundsPlayed >= 50) return 'Epic long game (50+ rounds)';
      if (match.roundsPlayed >= 40) return 'Very long game (40+ rounds)';
      return 'Long game (20+ rounds)';
    case 'cost':
      if (match.totalCost >= 1) return 'Extremely expensive match (>$1)';
      if (match.totalCost >= 0.25) return 'High-cost match (>$0.25)';
      return 'Expensive match (>$0.01)';
    case 'score':
      if (match.maxFinalScore >= 15) return 'Highest-scoring match (15+ apples)';
      if (match.maxFinalScore >= 10) return 'Big scoring match (10+ apples)';
      return 'Notable scoring match';
    case 'duration':
      return formatDurationHighlight(match.durationSeconds);
    case 'total_score':
      return `Combined score (${match.sumFinalScores} apples)`;
    case 'close_match':
      if (match.scoreDelta === 0) return 'Perfect tie';
      if (match.scoreDelta === 1) return 'Photo finish';
      return 'Neck-and-neck';
    case 'apples_25_plus':
      if (match.maxFinalScore >= 30) {
        return `Huge apple haul (${match.maxFinalScore})`;
      }
      return '25+ apples haul';
    default:
      return '';
  }
}

function formatDurationHighlight(durationSeconds: number): string {
  if (durationSeconds <= 0) {
    return 'Duration (unknown)';
  }
  const minutes = Math.floor(durationSeconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) {
    return `Duration (${hours}h ${minutes % 60}m)`;
  }
  return `Duration (${minutes}m)`;
}

function toStringOrEmpty(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}
