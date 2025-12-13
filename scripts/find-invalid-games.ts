/**
 * Find invalid SnakeBench games (zero cost or zero tokens)
 *
 * Author: Claude Code
 * Date: 2025-12-13
 * PURPOSE: Query the database to find matches with cost=0 or zero token counts,
 *          which indicate failed or erroneous game executions
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findInvalidGames() {
  try {
    // Query for games where any participant has cost = 0
    const result = await pool.query(`
      SELECT
        g.id as game_id,
        g.status,
        g.created_at,
        g.total_cost,
        gp.model_id,
        m.name as model_name,
        gp.cost as participant_cost,
        gp.score,
        gp.death_round,
        gp.death_reason
      FROM public.games g
      JOIN public.game_participants gp ON g.id = gp.game_id
      JOIN public.models m ON gp.model_id = m.id
      WHERE g.total_cost = 0.0 OR gp.cost = 0.0
      ORDER BY g.created_at DESC
      LIMIT 100
    `);

    console.log(`\n🔴 Found ${result.rows.length} invalid game records:\n`);

    if (result.rows.length === 0) {
      console.log('✅ No invalid games found!');
      return;
    }

    // Group by game_id for display
    const gameMap = new Map();
    result.rows.forEach(row => {
      if (!gameMap.has(row.game_id)) {
        gameMap.set(row.game_id, {
          game_id: row.game_id,
          status: row.status,
          created_at: row.created_at,
          total_cost: row.total_cost,
          participants: []
        });
      }
      gameMap.get(row.game_id).participants.push({
        model_name: row.model_name,
        cost: row.participant_cost,
        score: row.score,
        death_round: row.death_round,
        death_reason: row.death_reason
      });
    });

    // Display results
    let gameNum = 1;
    gameMap.forEach((game, gameId) => {
      console.log(`${gameNum}. Game: ${gameId}`);
      console.log(`   Status: ${game.status} | Total Cost: $${game.total_cost} | Created: ${game.created_at}`);
      game.participants.forEach((p, idx) => {
        console.log(`   Player ${idx + 1}: ${p.model_name}`);
        console.log(`     Cost: $${p.cost} | Score: ${p.score} | Death: Round ${p.death_round} (${p.death_reason})`);
      });
      console.log('');
      gameNum++;
    });

    console.log(`\n📊 Summary: ${gameMap.size} games with invalid participants`);
    console.log(`   Total invalid participant records: ${result.rows.length}`);

  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

findInvalidGames();
