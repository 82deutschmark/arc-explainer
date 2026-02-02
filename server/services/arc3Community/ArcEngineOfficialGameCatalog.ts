/*
 * Author: GPT-5.2
 * Date: 2026-02-01
 * PURPOSE: Centralized discovery + metadata for "official" ARCEngine games living in the
 *          `external/ARCEngine` git submodule (external/ARCEngine/games/official/*.py).
 *
 *          This removes hardcoded server-side whitelists so newly-added official games
 *          (e.g., ws02/ws03) become visible and playable automatically.
 *
 *          Implementation notes:
 *          - Discovery + runtime metadata comes from a small Python helper script
 *            (`server/python/arcengine_official_game_catalog.py`) that imports each game
 *            by file path and extracts (game_id, level_count, win_score).
 *          - Presentation metadata (displayName/description/difficulty) supports optional
 *            curated overrides for known games, with sensible fallbacks for new ones.
 * SRP/DRY check: Pass - single responsibility: official game catalog shared by routes + runner.
 */

import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import type { CommunityGame, GameDifficulty } from '../../repositories/CommunityGameRepository';

const CATALOG_SCRIPT_PATH = path.join(process.cwd(), 'server', 'python', 'arcengine_official_game_catalog.py');
const OFFICIAL_GAMES_DIR = path.join(process.cwd(), 'external', 'ARCEngine', 'games', 'official');

const CACHE_TTL_MS = 5 * 60_000;

type PythonCatalogRow =
  | {
      ok: true;
      file_stem: string;
      python_file_path: string;
      game_id: string;
      level_count: number;
      win_score: number;
      max_actions: number | null;
    }
  | {
      ok: false;
      file_stem: string;
      python_file_path: string;
      error: string;
      traceback?: string;
    };

interface PythonCatalogResponse {
  ok: boolean;
  source?: string;
  games?: PythonCatalogRow[];
  error?: string;
  message?: string;
}

export interface OfficialGameCatalogItem {
  game: CommunityGame;
  pythonFilePath: string;
}

type OfficialGameOverride = Partial<{
  displayName: string;
  description: string;
  authorName: string;
  difficulty: GameDifficulty;
  tags: string[];
}>;

const OFFICIAL_GAME_OVERRIDES: Record<string, OfficialGameOverride> = {
  ws01: {
    displayName: 'World Shifter',
    description:
      'The world moves, not you. A puzzle game where player input moves the entire world in the opposite direction. Navigate mazes by shifting walls, obstacles, and the exit toward your fixed position.',
    authorName: 'Arc Explainer Team',
    difficulty: 'medium',
    tags: ['featured', 'puzzle', 'maze', 'official'],
  },
  gw01: {
    displayName: 'Gravity Well',
    description:
      'Control gravity to collect orbs into wells. Yellow and Orange orbs fuse to Green. Wells cycle colors. Green phases through platforms.',
    authorName: 'Arc Explainer Team',
    difficulty: 'medium',
    tags: ['featured', 'puzzle', 'gravity', 'official'],
  },
  ls20: {
    displayName: 'Light Switch',
    description:
      'Toggle lights in a grid to match a target pattern. Each switch affects adjacent cells. A classic puzzle mechanic with ARC-style visual encoding.',
    authorName: 'ARC Prize Team',
    difficulty: 'medium',
    tags: ['featured', 'puzzle', 'logic', 'official'],
  },
  ft09: {
    displayName: 'Fill The Grid',
    description:
      'Fill an empty grid to match a target pattern using strategic placement. Plan your moves carefully to achieve the goal configuration.',
    authorName: 'ARC Prize Team',
    difficulty: 'medium',
    tags: ['featured', 'puzzle', 'spatial', 'official'],
  },
  vc33: {
    displayName: 'Vector Chase',
    description:
      'Navigate a path through a grid following vector rules. Each move must follow the pattern established by the puzzle. Test your spatial reasoning.',
    authorName: 'ARC Prize Team',
    difficulty: 'hard',
    tags: ['featured', 'puzzle', 'vectors', 'official'],
  },
};

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function stableNegativeId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash) || 1;
  return -positive;
}

function defaultDisplayNameForGameId(gameId: string): string {
  const prefix = (gameId.match(/^[a-z]+/)?.[0] || '').toLowerCase();
  const prefixToBaseName: Record<string, string> = {
    ws: 'World Shifter',
    gw: 'Gravity Well',
    ls: 'Light Switch',
    ft: 'Fill The Grid',
    vc: 'Vector Chase',
  };

  const base = prefixToBaseName[prefix];
  if (!base) return gameId.toUpperCase();

  // Keep canonical IDs clean; include ID suffix for variants so the UI can distinguish them.
  const canonicalIds = new Set(['ws01', 'gw01', 'ls20', 'ft09', 'vc33']);
  return canonicalIds.has(gameId) ? base : `${base} (${gameId})`;
}

async function readPurposeLineFromPythonFile(pythonFilePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(pythonFilePath, 'utf8');
    const lines = content.split(/\r?\n/).slice(0, 80);
    for (const line of lines) {
      const match = line.match(/PURPOSE:\s*(.+)\s*$/);
      if (match?.[1]) return match[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function sha256FileHex(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runPythonCatalog(): Promise<PythonCatalogResponse> {
  const pythonBin = resolvePythonBin();

  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    const child = spawn(pythonBin, [CATALOG_SCRIPT_PATH], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Official game catalog script failed (exit ${code}). stderr: ${stderr.trim()}`));
      }
      try {
        const parsed = JSON.parse(stdout) as PythonCatalogResponse;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse catalog JSON. stderr: ${stderr.trim()} stdout: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

function normalizeTags(overrideTags?: string[]): string[] {
  const base = overrideTags && overrideTags.length > 0 ? overrideTags : ['featured', 'official'];
  const unique = new Set(base.map(t => t.trim()).filter(Boolean));
  unique.add('featured');
  unique.add('official');
  return [...unique];
}

function toCommunityGame(params: {
  gameId: string;
  pythonFilePath: string;
  sourceHash: string;
  fileMtime: Date;
  displayName: string;
  description: string | null;
  authorName: string;
  difficulty: GameDifficulty;
  levelCount: number;
  winScore: number;
  maxActions: number | null;
  tags: string[];
}): CommunityGame {
  return {
    id: stableNegativeId(params.gameId),
    gameId: params.gameId,
    displayName: params.displayName,
    description: params.description,
    authorName: params.authorName,
    authorEmail: null,
    version: '1.0.0',
    difficulty: params.difficulty,
    levelCount: params.levelCount,
    winScore: params.winScore,
    maxActions: params.maxActions,
    tags: params.tags,
    sourceFilePath: params.pythonFilePath,
    sourceHash: params.sourceHash,
    thumbnailPath: null,
    status: 'approved',
    isFeatured: true,
    isPlayable: true,
    validatedAt: params.fileMtime,
    validationErrors: null,
    playCount: 0,
    totalWins: 0,
    totalLosses: 0,
    averageScore: null,
    uploadedAt: params.fileMtime,
    updatedAt: params.fileMtime,
  };
}

let cache: { expiresAtMs: number; items: OfficialGameCatalogItem[] } | null = null;
let inFlight: Promise<OfficialGameCatalogItem[]> | null = null;

async function refreshCatalog(): Promise<OfficialGameCatalogItem[]> {
  // Quick sanity checks to keep error messages readable.
  try {
    await fs.access(CATALOG_SCRIPT_PATH);
  } catch {
    throw new Error(`Missing catalog script at ${CATALOG_SCRIPT_PATH}`);
  }

  try {
    await fs.access(OFFICIAL_GAMES_DIR);
  } catch {
    throw new Error(`Missing ARCEngine official games dir at ${OFFICIAL_GAMES_DIR}`);
  }

  const response = await runPythonCatalog();
  if (!response.ok || !response.games) {
    throw new Error(`Official game catalog returned error: ${response.error || response.message || 'unknown error'}`);
  }

  const items: OfficialGameCatalogItem[] = [];

  for (const row of response.games) {
    if (!row.ok) {
      logger.warn(
        `[ArcEngineOfficialGameCatalog] Failed to load official game from ${row.python_file_path}: ${row.error}`,
        'community-games',
      );
      continue;
    }

    const pythonFilePath = row.python_file_path;
    const fileMtime = (await fs.stat(pythonFilePath)).mtime;
    const sourceHash = await sha256FileHex(pythonFilePath);

    const gameId = row.game_id;
    const override = OFFICIAL_GAME_OVERRIDES[gameId];

    const description =
      override?.description ??
      (await readPurposeLineFromPythonFile(pythonFilePath)) ??
      null;

    const displayName = override?.displayName ?? defaultDisplayNameForGameId(gameId);
    const authorName = override?.authorName ?? 'ARC Prize Team';
    const difficulty: GameDifficulty = override?.difficulty ?? 'unknown';
    const tags = normalizeTags(override?.tags);

    items.push({
      pythonFilePath,
      game: toCommunityGame({
        gameId,
        pythonFilePath,
        sourceHash,
        fileMtime,
        displayName,
        description,
        authorName,
        difficulty,
        levelCount: row.level_count,
        winScore: row.win_score,
        maxActions: row.max_actions,
        tags,
      }),
    });
  }

  // Put newly-added official games first (submodule updates should surface immediately),
  // with a stable tie-breaker for identical mtimes.
  items.sort((a, b) => {
    const delta = b.game.uploadedAt.getTime() - a.game.uploadedAt.getTime();
    return delta !== 0 ? delta : a.game.gameId.localeCompare(b.game.gameId);
  });
  return items;
}

export class ArcEngineOfficialGameCatalog {
  static async listOfficialGames(): Promise<OfficialGameCatalogItem[]> {
    if (cache && Date.now() < cache.expiresAtMs) return cache.items;

    if (!inFlight) {
      const fallback = cache?.items ?? [];
      inFlight = refreshCatalog()
        .then((items) => {
          cache = { expiresAtMs: Date.now() + CACHE_TTL_MS, items };
          return items;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`[ArcEngineOfficialGameCatalog] Failed to refresh official games: ${message}`, 'community-games');

          // Keep the API usable for DB-backed community games even if the ARCEngine
          // submodule or Python environment is temporarily unavailable.
          cache = { expiresAtMs: Date.now() + 10_000, items: fallback };
          return fallback;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  }

  static async getOfficialGame(gameId: string): Promise<OfficialGameCatalogItem | null> {
    const items = await this.listOfficialGames();
    return items.find((item) => item.game.gameId === gameId) ?? null;
  }

  static async isOfficialGameId(gameId: string): Promise<boolean> {
    return (await this.getOfficialGame(gameId)) !== null;
  }
}
