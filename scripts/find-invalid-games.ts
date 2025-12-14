/**
 * Find invalid SnakeBench games (zero cost or zero tokens)
 *
 * Author: Claude Code
 * Date: 2025-12-13
 * PURPOSE: Query the database to find matches with cost=0 or zero token counts,
 *          which indicate failed or erroneous game executions
 */

import { Pool } from 'pg';
import { readFile } from 'fs/promises';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findInvalidGames() {
  try {
    // Query for recent completed games; token usage is stored in the replay JSON, not in DB columns.
    const result = await pool.query(`
      SELECT
        g.id as game_id,
        g.status,
        g.created_at,
        g.replay_path
      FROM public.games g
      WHERE g.status = 'completed'
      ORDER BY g.created_at DESC
      LIMIT 200
    `);

    console.log(`\nFound ${result.rows.length} recently completed games to inspect for zero-token replays.\n`);

    if (result.rows.length === 0) {
      console.log('No games found.');
      return;
    }

    type CandidateGameRow = {
      game_id: string;
      status: string;
      created_at: string;
      replay_path: string | null;
    };

    type ReplayPlayerTotals = {
      input_tokens?: number;
      output_tokens?: number;
    };

    type ReplayPlayer = {
      name?: string;
      totals?: ReplayPlayerTotals;
    };

    type ReplayMove = {
      input_tokens?: number;
      output_tokens?: number;
    };

    type ReplayFrame = {
      moves?: Record<string, ReplayMove>;
    };

    type ReplayJson = {
      players?: Record<string, ReplayPlayer>;
      frames?: ReplayFrame[];
    };

    type InvalidParticipant = {
      model_name: string;
      input_tokens: number;
      output_tokens: number;
    };

    type InvalidGameGroup = {
      game_id: string;
      status: string;
      created_at: string;
      replay_path: string | null;
      participants: InvalidParticipant[];
    };

    const resolveReplayPath = (gameId: string, replayPath: string | null): string | null => {
      const fallback = path.resolve(
        process.cwd(),
        'external',
        'SnakeBench',
        'backend',
        'completed_games',
        `snake_game_${gameId}.json`
      );

      if (!replayPath) return fallback;

      if (/^https?:\/\//i.test(replayPath)) return null;

      if (path.isAbsolute(replayPath)) return replayPath;

      return path.resolve(process.cwd(), replayPath);
    };

    const sumTokensFromFrames = (replay: ReplayJson, playerSlot: string) => {
      let inputTokens = 0;
      let outputTokens = 0;

      for (const frame of replay.frames ?? []) {
        const move = frame.moves?.[playerSlot];
        if (!move) continue;
        inputTokens += move.input_tokens ?? 0;
        outputTokens += move.output_tokens ?? 0;
      }

      return { inputTokens, outputTokens };
    };

    const extractPlayerTotals = (replay: ReplayJson, playerSlot: string) => {
      const totals = replay.players?.[playerSlot]?.totals;
      const directInput = totals?.input_tokens ?? 0;
      const directOutput = totals?.output_tokens ?? 0;

      if (directInput > 0 || directOutput > 0) {
        return { inputTokens: directInput, outputTokens: directOutput };
      }

      return sumTokensFromFrames(replay, playerSlot);
    };

    const invalidGames = new Map<string, InvalidGameGroup>();

    for (const row of result.rows as CandidateGameRow[]) {
      const resolvedReplayPath = resolveReplayPath(row.game_id, row.replay_path);
      if (!resolvedReplayPath) continue;

      let replay: ReplayJson;
      try {
        const contents = await readFile(resolvedReplayPath, 'utf8');
        replay = JSON.parse(contents) as ReplayJson;
      } catch {
        continue;
      }

      const playerSlots = Object.keys(replay.players ?? {});
      if (playerSlots.length === 0) continue;

      for (const slot of playerSlots) {
        const { inputTokens, outputTokens } = extractPlayerTotals(replay, slot);
        const modelName = replay.players?.[slot]?.name ?? `slot_${slot}`;

        if (inputTokens === 0 && outputTokens === 0) {
          if (!invalidGames.has(row.game_id)) {
            invalidGames.set(row.game_id, {
              game_id: row.game_id,
              status: row.status,
              created_at: row.created_at,
              replay_path: row.replay_path,
              participants: [],
            });
          }
          invalidGames.get(row.game_id)?.participants.push({
            model_name: modelName,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          });
        }
      }
    }

    // Display results
    if (invalidGames.size === 0) {
      console.log('No zero-token games found.');
      return;
    }

    console.log(`Found ${invalidGames.size} games with at least one zero-token participant.\n`);

    let gameNum = 1;
    invalidGames.forEach((game: InvalidGameGroup, gameId: string) => {
      console.log(`${gameNum}. Game: ${gameId}`);
      console.log(`   Status: ${game.status} | Created: ${game.created_at}`);
      console.log(`   Replay: ${game.replay_path ?? '(null)'}`);
      game.participants.forEach((p: InvalidParticipant, idx: number) => {
        console.log(`   Player ${idx + 1}: ${p.model_name}`);
        console.log(`     Tokens: input=${p.input_tokens} output=${p.output_tokens}`);
      });
      console.log('');
      gameNum++;
    });

    const totalInvalidParticipants = Array.from(invalidGames.values()).reduce(
      (sum, g) => sum + g.participants.length,
      0
    );
    console.log(`Summary: ${invalidGames.size} games, ${totalInvalidParticipants} zero-token participant records`);

  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

findInvalidGames();
