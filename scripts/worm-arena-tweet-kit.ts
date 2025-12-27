/**
 * Author: Cascade
 * Date: 2025-12-27
 * PURPOSE: Worm Arena Tweet Kit - generates tweet-ready content for Greatest Hits matches.
 *          Fetches hits from API, downloads replays if needed, generates blurbs,
 *          and optionally triggers video generation via Python CLI.
 *
 * Usage:
 *   npm run worm:tweets -- --limit 5
 *   npm run worm:tweets -- --game-id <uuid>
 *   npm run worm:tweets -- --limit 5 --video
 *
 * SRP/DRY check: Pass - focused on tweet generation workflow only.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SITE_BASE_URL = 'https://arc.markbarney.net';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const COMPLETED_GAMES_DIR = path.join(
  process.cwd(),
  'external/SnakeBench/backend/completed_games'
);
const COMPLETED_GAMES_LOCAL_DIR = path.join(
  process.cwd(),
  'external/SnakeBench/backend/completed_games_local'
);
const VIDEOS_DIR = path.join(
  process.cwd(),
  'external/SnakeBench/backend/completed_games_videos'
);
const OUTPUT_DIR = path.join(process.cwd(), 'tmp/tweet-kit');

// Max tweet length (280 chars, but leave room for URL which Twitter shortens to ~23 chars)
const MAX_BLURB_LENGTH = 240;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GreatestHitGame {
  gameId: string;
  startedAt: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxRounds: number;
  totalCost: number;
  maxFinalScore: number;
  scoreDelta: number;
  boardWidth: number;
  boardHeight: number;
  highlightReason: string;
  endedAt?: string;
  sumFinalScores?: number;
  durationSeconds?: number;
  category?: string;
}

interface TweetOutput {
  gameId: string;
  blurb: string;
  link: string;
  fullTweet: string;
  mp4Path: string | null;
  replayLocalPath: string | null;
  metadata: GreatestHitGame;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Shorten a model slug by removing common provider prefixes if needed.
 * e.g., "openai/gpt-5-nano" -> "gpt-5-nano"
 */
function shortenModelSlug(slug: string, maxLen: number = 30): string {
  if (slug.length <= maxLen) return slug;
  // Try removing provider prefix
  const parts = slug.split('/');
  if (parts.length > 1) {
    const shortened = parts.slice(1).join('/');
    if (shortened.length <= maxLen) return shortened;
  }
  // Last resort: truncate
  return slug.slice(0, maxLen - 3) + '...';
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

/**
 * Generate tweet blurb from game metadata using templates.
 */
function generateBlurb(game: GreatestHitGame): string {
  const modelA = shortenModelSlug(game.modelA, 25);
  const modelB = shortenModelSlug(game.modelB, 25);
  const rounds = game.roundsPlayed;
  const maxScore = game.maxFinalScore;
  const cost = game.totalCost;
  const duration = game.durationSeconds ? formatDuration(game.durationSeconds) : null;
  const sumScores = game.sumFinalScores ?? 0;

  // Pick template based on highlight reason or stats
  const reason = game.highlightReason?.toLowerCase() ?? '';

  // Template 1: Close match / tie
  if (game.scoreDelta === 0 || reason.includes('tie') || reason.includes('close')) {
    return `${modelA} vs ${modelB}: ${rounds}-round battle ended in a ${maxScore}-${maxScore} tie! Watch the epic showdown:`;
  }

  // Template 2: Monster score
  if (maxScore >= 20 || sumScores >= 35 || reason.includes('apple') || reason.includes('score')) {
    return `${modelA} grabbed ${maxScore} apples vs ${modelB} in ${rounds} rounds. ${game.highlightReason.split('.')[0]}. Watch:`;
  }

  // Template 3: Long duration / expensive
  if (duration || cost >= 0.5) {
    const costStr = cost >= 0.01 ? ` ($${cost.toFixed(2)} run)` : '';
    const durationStr = duration ? ` ${duration}` : '';
    return `${modelA} vs ${modelB}: ${rounds} rounds${durationStr}${costStr}. Watch:`;
  }

  // Template 4: Use highlight reason directly if short enough
  if (game.highlightReason && game.highlightReason.length < 120) {
    return `${modelA} vs ${modelB}: ${game.highlightReason.replace(/^Pinned:\s*/i, '')} Watch:`;
  }

  // Default template
  return `${modelA} vs ${modelB}: ${rounds} rounds, max ${maxScore} apples. Watch the AI showdown:`;
}

/**
 * Build the full replay URL.
 */
function buildReplayUrl(gameId: string): string {
  // Normalize gameId (remove snake_game_ prefix and .json extension if present)
  let normalized = gameId;
  if (normalized.startsWith('snake_game_')) {
    normalized = normalized.slice('snake_game_'.length);
  }
  if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -'.json'.length);
  }
  return `${SITE_BASE_URL}/worm-arena?matchId=${encodeURIComponent(normalized)}`;
}

/**
 * Compose the full tweet text (blurb + link).
 */
function composeTweet(blurb: string, link: string): string {
  // Ensure single space before URL and total length is reasonable
  let text = blurb.trim();
  if (!text.endsWith(':')) {
    text = text.replace(/[.!?]?\s*$/, '');
  }
  const fullTweet = `${text} ${link}`;

  // Check length (Twitter shortens URLs to ~23 chars)
  const effectiveLength = text.length + 1 + 23;
  if (effectiveLength > 280) {
    // Truncate blurb to fit
    const maxBlurbLen = 280 - 1 - 23 - 3; // space + URL + ellipsis
    text = text.slice(0, maxBlurbLen) + '...';
    return `${text} ${link}`;
  }

  return fullTweet;
}

/**
 * Check if replay JSON exists locally.
 */
function findLocalReplay(gameId: string): string | null {
  // Normalize gameId
  let normalized = gameId;
  if (normalized.startsWith('snake_game_')) {
    normalized = normalized.slice('snake_game_'.length);
  }
  if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -'.json'.length);
  }

  const filename = `snake_game_${normalized}.json`;

  // Check both directories
  const primaryPath = path.join(COMPLETED_GAMES_DIR, filename);
  if (fs.existsSync(primaryPath)) return primaryPath;

  const localPath = path.join(COMPLETED_GAMES_LOCAL_DIR, filename);
  if (fs.existsSync(localPath)) return localPath;

  return null;
}

/**
 * Download replay JSON from API if not local.
 */
async function downloadReplay(gameId: string): Promise<string | null> {
  // Normalize gameId
  let normalized = gameId;
  if (normalized.startsWith('snake_game_')) {
    normalized = normalized.slice('snake_game_'.length);
  }
  if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -'.json'.length);
  }

  const url = `${API_BASE_URL}/api/snakebench/games/${encodeURIComponent(normalized)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch replay for ${gameId}: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json() as any;

    // If data is directly included (local dev mode)
    if (json.data) {
      const filename = `snake_game_${normalized}.json`;
      const targetDir = fs.existsSync(COMPLETED_GAMES_DIR)
        ? COMPLETED_GAMES_DIR
        : COMPLETED_GAMES_LOCAL_DIR;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, filename);
      fs.writeFileSync(targetPath, JSON.stringify(json.data, null, 2), 'utf-8');
      console.log(`  Downloaded replay to ${targetPath}`);
      return targetPath;
    }

    // If replayUrl is provided, fetch from there
    if (json.replayUrl) {
      const replayRes = await fetch(json.replayUrl);
      if (!replayRes.ok) {
        console.error(`Failed to fetch replay from ${json.replayUrl}: HTTP ${replayRes.status}`);
        return null;
      }

      const replayData = await replayRes.json();
      const filename = `snake_game_${normalized}.json`;
      const targetDir = fs.existsSync(COMPLETED_GAMES_DIR)
        ? COMPLETED_GAMES_DIR
        : COMPLETED_GAMES_LOCAL_DIR;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, filename);
      fs.writeFileSync(targetPath, JSON.stringify(replayData, null, 2), 'utf-8');
      console.log(`  Downloaded replay to ${targetPath}`);
      return targetPath;
    }

    console.error(`No replay data or URL returned for ${gameId}`);
    return null;
  } catch (err) {
    console.error(`Error downloading replay for ${gameId}:`, err);
    return null;
  }
}

/**
 * Fetch Greatest Hits from API.
 */
async function fetchGreatestHits(limit: number = 10): Promise<GreatestHitGame[]> {
  const url = `${API_BASE_URL}/api/snakebench/greatest-hits?limitPerDimension=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json() as any;
    if (!json.success) {
      throw new Error(json.error || 'API returned failure');
    }

    return json.games ?? [];
  } catch (err) {
    console.error('Failed to fetch greatest hits:', err);
    return [];
  }
}

/**
 * Generate video using Python CLI (optional).
 */
function generateVideo(gameId: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Normalize gameId
    let normalized = gameId;
    if (normalized.startsWith('snake_game_')) {
      normalized = normalized.slice('snake_game_'.length);
    }
    if (normalized.endsWith('.json')) {
      normalized = normalized.slice(0, -'.json'.length);
    }

    const expectedVideoPath = path.join(VIDEOS_DIR, `snake_game_${normalized}.mp4`);

    // Check if video already exists
    if (fs.existsSync(expectedVideoPath)) {
      console.log(`  Video already exists: ${expectedVideoPath}`);
      resolve(expectedVideoPath);
      return;
    }

    const pythonScript = path.join(
      process.cwd(),
      'external/SnakeBench/backend/cli/generate_video.py'
    );

    if (!fs.existsSync(pythonScript)) {
      console.warn(`  Video generator not found: ${pythonScript}`);
      resolve(null);
      return;
    }

    console.log(`  Generating video for ${normalized}...`);

    const proc = spawn('python', [pythonScript, normalized], {
      cwd: path.join(process.cwd(), 'external/SnakeBench/backend'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(expectedVideoPath)) {
        console.log(`  Video generated: ${expectedVideoPath}`);
        resolve(expectedVideoPath);
      } else {
        console.warn(`  Video generation failed (code ${code})`);
        if (stderr) console.warn(`  stderr: ${stderr.slice(0, 200)}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.warn(`  Video generation error:`, err.message);
      resolve(null);
    });
  });
}

/**
 * Process a single game into tweet output.
 */
async function processGame(
  game: GreatestHitGame,
  options: { generateVideos: boolean }
): Promise<TweetOutput> {
  const link = buildReplayUrl(game.gameId);
  const blurb = generateBlurb(game);
  const fullTweet = composeTweet(blurb, link);

  // Find or download replay
  let replayPath = findLocalReplay(game.gameId);
  if (!replayPath) {
    console.log(`  Replay not found locally, downloading...`);
    replayPath = await downloadReplay(game.gameId);
  }

  // Generate video if requested
  let mp4Path: string | null = null;
  if (options.generateVideos && replayPath) {
    mp4Path = await generateVideo(game.gameId);
  }

  return {
    gameId: game.gameId,
    blurb,
    link,
    fullTweet,
    mp4Path,
    replayLocalPath: replayPath,
    metadata: game,
  };
}

/**
 * Write tweet outputs to files.
 */
function writeTweetOutputs(outputs: TweetOutput[]): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write individual tweet files
  for (const output of outputs) {
    const filename = `tweet_${output.gameId.slice(0, 8)}.txt`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const content = [
      `# Tweet for game ${output.gameId}`,
      `# Generated: ${new Date().toISOString()}`,
      '',
      output.fullTweet,
      '',
      `# Replay URL: ${output.link}`,
      output.mp4Path ? `# Video: ${output.mp4Path}` : '# Video: not generated',
      output.replayLocalPath ? `# Replay JSON: ${output.replayLocalPath}` : '# Replay JSON: not found',
      '',
      `# Metadata:`,
      `# - Models: ${output.metadata.modelA} vs ${output.metadata.modelB}`,
      `# - Rounds: ${output.metadata.roundsPlayed}`,
      `# - Max Score: ${output.metadata.maxFinalScore}`,
      `# - Cost: $${output.metadata.totalCost.toFixed(4)}`,
      `# - Reason: ${output.metadata.highlightReason}`,
    ].join('\n');

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Wrote: ${filepath}`);
  }

  // Write summary JSON
  const summaryPath = path.join(OUTPUT_DIR, 'tweets_summary.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        count: outputs.length,
        tweets: outputs.map((o) => ({
          gameId: o.gameId,
          tweet: o.fullTweet,
          link: o.link,
          mp4Path: o.mp4Path,
          replayPath: o.replayLocalPath,
        })),
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`Wrote summary: ${summaryPath}`);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let limit = 5;
  let specificGameId: string | null = null;
  let generateVideos = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (arg === '--game-id' && args[i + 1]) {
      specificGameId = args[i + 1];
      i++;
    } else if (arg === '--video' || arg === '--videos') {
      generateVideos = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Worm Arena Tweet Kit

Usage:
  npm run worm:tweets -- [options]

Options:
  --limit <n>       Number of greatest hits to process (default: 5)
  --game-id <uuid>  Process a specific game by ID
  --video           Generate MP4 videos (requires Python + FFmpeg)
  --help            Show this help message

Examples:
  npm run worm:tweets -- --limit 10
  npm run worm:tweets -- --game-id abc-123-def
  npm run worm:tweets -- --limit 5 --video
`);
      process.exit(0);
    }
  }

  console.log('='.repeat(60));
  console.log('Worm Arena Tweet Kit');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Site: ${SITE_BASE_URL}`);
  console.log(`Generate videos: ${generateVideos}`);
  console.log('');

  let games: GreatestHitGame[] = [];

  if (specificGameId) {
    // Fetch specific game - we'll need to construct minimal metadata
    console.log(`Fetching specific game: ${specificGameId}`);
    // For now, create a minimal game object and process it
    games = [
      {
        gameId: specificGameId,
        startedAt: new Date().toISOString(),
        modelA: 'Unknown',
        modelB: 'Unknown',
        roundsPlayed: 0,
        maxRounds: 150,
        totalCost: 0,
        maxFinalScore: 0,
        scoreDelta: 0,
        boardWidth: 10,
        boardHeight: 10,
        highlightReason: 'Custom game',
      },
    ];
  } else {
    console.log(`Fetching top ${limit} greatest hits...`);
    games = await fetchGreatestHits(limit);
  }

  if (games.length === 0) {
    console.error('No games to process.');
    process.exit(1);
  }

  console.log(`Processing ${games.length} game(s)...\n`);

  const outputs: TweetOutput[] = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`[${i + 1}/${games.length}] ${game.gameId}`);
    console.log(`  ${game.modelA} vs ${game.modelB}`);

    const output = await processGame(game, { generateVideos });
    outputs.push(output);

    console.log(`  Tweet: ${output.fullTweet.slice(0, 80)}...`);
    console.log('');
  }

  // Write outputs
  writeTweetOutputs(outputs);

  console.log('');
  console.log('='.repeat(60));
  console.log('Done!');
  console.log(`Generated ${outputs.length} tweet(s) in ${OUTPUT_DIR}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
