/**
 * server/services/snakeBenchGitHubPublisher.ts
 *
 * Author: Cascade
 * Date: 2025-12-15
 * PURPOSE: Publish completed SnakeBench replay JSON files to GitHub so
 *          replay assets are available to Railway and other stateless deployments.
 * SRP/DRY check: Pass — dedicated to GitHub publishing only.
 */

import fs from 'fs';
import https from 'https';

import { logger } from '../utils/logger.ts';

type GitHubReplayPublishConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  replayDir: string;
};

type GitHubContentsGetResponse = {
  sha?: string;
};

type GitHubRefResponse = {
  object?: {
    sha?: string;
    type?: string;
  };
};

type GitHubCommitResponse = {
  sha?: string;
  tree?: {
    sha?: string;
  };
};

type GitHubBlobCreateResponse = {
  sha?: string;
};

type GitHubTreeCreateResponse = {
  sha?: string;
};

type GitHubApiError = {
  message?: string;
};

function isNonFastForwardError(payload: unknown): boolean {
  const msg = typeof (payload as any)?.message === 'string' ? String((payload as any).message) : '';
  return /fast[- ]forward/i.test(msg);
}

function getPublishConfig(): GitHubReplayPublishConfig | null {
  const token = (process.env.SNAKEBENCH_GITHUB_TOKEN || '').trim();
  if (!token) return null;

  const owner = (process.env.SNAKEBENCH_GITHUB_OWNER || 'VoynichLabs').trim();
  const repo = (process.env.SNAKEBENCH_GITHUB_REPO || 'SnakeBench').trim();
  const branch = (process.env.SNAKEBENCH_GITHUB_BRANCH || 'main').trim();
  const replayDir = (process.env.SNAKEBENCH_GITHUB_REPLAY_DIR || 'backend/completed_games').trim().replace(/^\/+/, '').replace(/\/+$/, '');

  return {
    token,
    owner,
    repo,
    branch,
    replayDir,
  };
}

function encodeGitHubPath(repoPath: string): string {
  return repoPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

async function githubRequestJson<T>(
  cfg: GitHubReplayPublishConfig,
  opts: { method: 'GET' | 'PUT' | 'POST' | 'PATCH'; path: string; body?: any },
): Promise<{ statusCode: number; data: T | GitHubApiError | null }> {
  const { method, path, body } = opts;

  const headers: Record<string, string> = {
    'User-Agent': 'arc-explainer',
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cfg.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const payload = body != null ? JSON.stringify(body) : null;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload).toString();
  }

  return await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        host: 'api.github.com',
        path,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const statusCode = res.statusCode ?? 0;
          if (!chunks.length) {
            resolve({ statusCode, data: null });
            return;
          }

          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(raw) as T | GitHubApiError;
            resolve({ statusCode, data: parsed });
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(15_000, () => {
      req.destroy(new Error('timeout'));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

export function buildSnakeBenchReplayRawUrl(cfg: GitHubReplayPublishConfig, gameId: string): string {
  const filename = `snake_game_${gameId}.json`;
  const repoPath = `${cfg.replayDir}/${filename}`.replace(/\/+/, '/');
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${repoPath}`;
}

export async function publishSnakeBenchReplayToGitHub(params: {
  gameId: string;
  completedGamePath: string;
}): Promise<{ rawUrl: string } | null> {
  const cfg = getPublishConfig();
  if (!cfg) return null;

  const { gameId, completedGamePath } = params;
  if (!gameId || !completedGamePath) return null;

  let rawFile: string;
  try {
    rawFile = await fs.promises.readFile(completedGamePath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`SnakeBench GitHub publish: failed to read replay file for ${gameId}: ${msg}`, 'snakebench-publish');
    return null;
  }

  const filename = `snake_game_${gameId}.json`;
  const repoPath = `${cfg.replayDir}/${filename}`.replace(/\/+/, '/');
  const encodedRepoPath = encodeGitHubPath(repoPath);

  const getPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodedRepoPath}?ref=${encodeURIComponent(cfg.branch)}`;

  try {
    const existing = await githubRequestJson<GitHubContentsGetResponse>(cfg, { method: 'GET', path: getPath });
    if (existing.statusCode >= 200 && existing.statusCode < 300) {
      return { rawUrl: buildSnakeBenchReplayRawUrl(cfg, gameId) };
    }

    if (existing.statusCode !== 404) {
      const ghMsg = typeof (existing.data as any)?.message === 'string' ? String((existing.data as any).message) : '';
      logger.warn(
        `SnakeBench GitHub publish: GET contents unexpected status ${existing.statusCode} for ${gameId} (${repoPath}) ${ghMsg}`,
        'snakebench-publish',
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`SnakeBench GitHub publish: GET contents failed for ${gameId}: ${msg}`, 'snakebench-publish');
  }

  const contentBase64 = Buffer.from(rawFile, 'utf8').toString('base64');

  // Git Data API flow (avoids Contents API size limits)
  const blobPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/blobs`;
  const blobRes = await githubRequestJson<GitHubBlobCreateResponse>(cfg, {
    method: 'POST',
    path: blobPath,
    body: { content: contentBase64, encoding: 'base64' },
  });
  const blobSha = (blobRes.data as GitHubBlobCreateResponse | null)?.sha;
  if (!blobSha) {
    const ghMsg = typeof (blobRes.data as any)?.message === 'string' ? String((blobRes.data as any).message) : '';
    logger.warn(
      `SnakeBench GitHub publish: failed to create blob for ${gameId} (${blobRes.statusCode}) ${ghMsg}`,
      'snakebench-publish',
    );
    return null;
  }

  const refPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/ref/heads/${encodeGitHubPath(cfg.branch)}`;
  const treePath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/trees`;
  const createCommitPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/commits`;
  const updateRefPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/refs/heads/${encodeGitHubPath(cfg.branch)}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const refRes = await githubRequestJson<GitHubRefResponse>(cfg, { method: 'GET', path: refPath });
    const parentCommitSha = (refRes.data as GitHubRefResponse | null)?.object?.sha;
    if (!parentCommitSha) {
      const ghMsg = typeof (refRes.data as any)?.message === 'string' ? String((refRes.data as any).message) : '';
      logger.warn(
        `SnakeBench GitHub publish: failed to resolve branch ref ${cfg.branch} (${refRes.statusCode}) ${ghMsg}`,
        'snakebench-publish',
      );
      return null;
    }

    const commitPath = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/git/commits/${encodeURIComponent(parentCommitSha)}`;
    const commitRes = await githubRequestJson<GitHubCommitResponse>(cfg, { method: 'GET', path: commitPath });
    const baseTreeSha = (commitRes.data as GitHubCommitResponse | null)?.tree?.sha;
    if (!baseTreeSha) {
      const ghMsg = typeof (commitRes.data as any)?.message === 'string' ? String((commitRes.data as any).message) : '';
      logger.warn(
        `SnakeBench GitHub publish: failed to resolve base tree for ${cfg.branch} (${commitRes.statusCode}) ${ghMsg}`,
        'snakebench-publish',
      );
      return null;
    }

    const treeRes = await githubRequestJson<GitHubTreeCreateResponse>(cfg, {
      method: 'POST',
      path: treePath,
      body: {
        base_tree: baseTreeSha,
        tree: [
          {
            path: repoPath,
            mode: '100644',
            type: 'blob',
            sha: blobSha,
          },
        ],
      },
    });
    const newTreeSha = (treeRes.data as GitHubTreeCreateResponse | null)?.sha;
    if (!newTreeSha) {
      const ghMsg = typeof (treeRes.data as any)?.message === 'string' ? String((treeRes.data as any).message) : '';
      logger.warn(
        `SnakeBench GitHub publish: failed to create tree for ${gameId} (${treeRes.statusCode}) ${ghMsg}`,
        'snakebench-publish',
      );
      return null;
    }

    const newCommitRes = await githubRequestJson<GitHubCommitResponse>(cfg, {
      method: 'POST',
      path: createCommitPath,
      body: {
        message: `Add SnakeBench replay ${gameId}`,
        tree: newTreeSha,
        parents: [parentCommitSha],
      },
    });

    const newCommitSha = (newCommitRes.data as GitHubCommitResponse | null)?.sha;
    if (!newCommitSha) {
      const ghMsg = typeof (newCommitRes.data as any)?.message === 'string' ? String((newCommitRes.data as any).message) : '';
      logger.warn(
        `SnakeBench GitHub publish: failed to create commit for ${gameId} (${newCommitRes.statusCode}) ${ghMsg}`,
        'snakebench-publish',
      );
      return null;
    }

    const updateRefRes = await githubRequestJson<any>(cfg, {
      method: 'PATCH',
      path: updateRefPath,
      body: {
        sha: newCommitSha,
        force: false,
      },
    });

    if (updateRefRes.statusCode >= 200 && updateRefRes.statusCode < 300) {
      return { rawUrl: buildSnakeBenchReplayRawUrl(cfg, gameId) };
    }

    if (isNonFastForwardError(updateRefRes.data) && attempt < 3) {
      continue;
    }

    const ghMsg = typeof (updateRefRes.data as any)?.message === 'string' ? String((updateRefRes.data as any).message) : '';
    logger.warn(
      `SnakeBench GitHub publish: failed to update ref for ${gameId} (${updateRefRes.statusCode}) ${ghMsg}`,
      'snakebench-publish',
    );
    return null;
  }

  return null;
}
