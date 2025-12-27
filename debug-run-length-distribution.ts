/**
 * Debug script for run-length-distribution query
 *
 * Author: Claude Haiku
 * Date: 2025-12-27
 * PURPOSE: Test SQL queries incrementally to identify why getRunLengthDistribution
 *          returns zero rows. Tests each layer of the query separately.
 */

import { pool } from './server/db.ts';

async function debugRunLengthDistribution() {
  try {
    console.log('\n=== Debugging Run Length Distribution Query ===\n');

    // Test 1: Check if games table has any data
    console.log('Test 1: Count of games in database');
    const gamesCount = await pool.query('SELECT COUNT(*) as count FROM public.games');
    console.log(`Total games: ${gamesCount.rows[0].count}`);

    // Test 2: Check games by status
    console.log('\nTest 2: Games grouped by status');
    const gamesByStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM public.games
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log(gamesByStatus.rows);

    // Test 3: Check games with rounds populated
    console.log('\nTest 3: Games with rounds IS NOT NULL');
    const gamesWithRounds = await pool.query(`
      SELECT COUNT(*) as count
      FROM public.games
      WHERE rounds IS NOT NULL
    `);
    console.log(`Games with rounds: ${gamesWithRounds.rows[0].count}`);

    // Test 4: Check games with completed status AND rounds not null
    console.log('\nTest 4: Games with status=completed AND rounds IS NOT NULL');
    const completedWithRounds = await pool.query(`
      SELECT COUNT(*) as count
      FROM public.games
      WHERE status = 'completed' AND rounds IS NOT NULL
    `);
    console.log(`Games matching WHERE clause: ${completedWithRounds.rows[0].count}`);

    // Test 5: Check game_participants count
    console.log('\nTest 5: Count of game participants');
    const participantsCount = await pool.query('SELECT COUNT(*) as count FROM public.game_participants');
    console.log(`Total participants: ${participantsCount.rows[0].count}`);

    // Test 6: Check models count
    console.log('\nTest 6: Count of models');
    const modelsCount = await pool.query('SELECT COUNT(*) as count FROM public.models');
    console.log(`Total models: ${modelsCount.rows[0].count}`);

    // Test 7: Test simple JOIN - games to participants
    console.log('\nTest 7: Games joined with participants (first 5)');
    const simpleJoin = await pool.query(`
      SELECT g.id, g.status, g.rounds, gp.model_id, gp.result
      FROM public.games g
      JOIN public.game_participants gp ON gp.game_id = g.id
      LIMIT 5
    `);
    console.log(`Rows: ${simpleJoin.rows.length}`);
    if (simpleJoin.rows.length > 0) {
      console.log(simpleJoin.rows);
    }

    // Test 8: Test full JOIN with models
    console.log('\nTest 8: Games -> Participants -> Models (first 5)');
    const fullJoin = await pool.query(`
      SELECT g.id, g.status, g.rounds, m.model_slug, gp.result
      FROM public.games g
      JOIN public.game_participants gp ON gp.game_id = g.id
      JOIN public.models m ON m.id = gp.model_id
      LIMIT 5
    `);
    console.log(`Rows: ${fullJoin.rows.length}`);
    if (fullJoin.rows.length > 0) {
      console.log(fullJoin.rows);
    }

    // Test 9: Test the actual getTrueSkillLeaderboard query (should have data)
    console.log('\nTest 9: getTrueSkillLeaderboard query (should have data)');
    const trueskill = await pool.query(`
      SELECT
        regexp_replace(m.model_slug, ':free$', '') AS normalized_slug,
        COUNT(gp.game_id) AS games_played
      FROM public.models m
      JOIN public.game_participants gp ON m.id = gp.model_id
      GROUP BY regexp_replace(m.model_slug, ':free$', '')
      LIMIT 3
    `);
    console.log(`Models with games: ${trueskill.rows.length}`);
    if (trueskill.rows.length > 0) {
      console.log(trueskill.rows);
    }

    // Test 10: Test the broken query WITHOUT status/rounds filters
    console.log('\nTest 10: Run-length query WITHOUT status/rounds filters');
    const runLengthNoFilters = await pool.query(`
      SELECT
        regexp_replace(m.model_slug, ':free$', '') AS model_slug,
        g.rounds,
        gp.result,
        COUNT(*) as frequency
      FROM public.models m
      JOIN public.game_participants gp ON m.id = gp.model_id
      JOIN public.games g ON gp.game_id = g.id
      GROUP BY regexp_replace(m.model_slug, ':free$', ''), g.rounds, gp.result
      LIMIT 10
    `);
    console.log(`Rows: ${runLengthNoFilters.rows.length}`);
    if (runLengthNoFilters.rows.length > 0) {
      console.log(runLengthNoFilters.rows.slice(0, 5));
    }

    // Test 11: Test the broken query WITH status/rounds filters
    console.log('\nTest 11: Run-length query WITH status=completed AND rounds IS NOT NULL');
    const runLengthWithFilters = await pool.query(`
      SELECT
        regexp_replace(m.model_slug, ':free$', '') AS model_slug,
        g.rounds,
        gp.result,
        COUNT(*) as frequency
      FROM public.models m
      JOIN public.game_participants gp ON m.id = gp.model_id
      JOIN public.games g ON gp.game_id = g.id
      WHERE g.status = 'completed' AND g.rounds IS NOT NULL
      GROUP BY regexp_replace(m.model_slug, ':free$', ''), g.rounds, gp.result
      LIMIT 10
    `);
    console.log(`Rows: ${runLengthWithFilters.rows.length}`);
    if (runLengthWithFilters.rows.length > 0) {
      console.log(runLengthWithFilters.rows);
    }

    console.log('\n=== Debug Complete ===\n');
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await pool.end();
  }
}

debugRunLengthDistribution();
