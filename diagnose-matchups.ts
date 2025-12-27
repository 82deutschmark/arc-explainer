/**
 * Diagnostic script to check Worm Arena matchup data
 * Run with: npx ts-node diagnose-matchups.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/arc_explainer',
});

async function diagnose() {
  try {
    console.log('\\n=== WORM ARENA MATCHUP DIAGNOSTICS ===\\n');

    // 1. Check if games table has data
    const gamesCount = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM public.games
    `);
    const { total, completed } = gamesCount.rows[0];
    console.log(`Games in database: ${total}`);
    console.log(`Completed games: ${completed}\\n`);

    // 2. Check models
    const modelsCount = await pool.query(`
      SELECT COUNT(DISTINCT model_slug) as model_count
      FROM public.models
    `);
    console.log(`Distinct models: ${modelsCount.rows[0].model_count}\\n`);

    // 3. Check game_participants
    const participantsCount = await pool.query(`
      SELECT COUNT(*) as participant_count
      FROM public.game_participants
    `);
    console.log(`Game participants: ${participantsCount.rows[0].participant_count}\\n`);

    // 4. List unique model_slugs
    const models = await pool.query(`
      SELECT DISTINCT model_slug FROM public.models ORDER BY model_slug
    `);
    console.log('Models in database:');
    models.rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.model_slug}`);
    });

    // 5. Check pairing history query
    console.log('\\nRunning pairing history query...');
    const pairings = await pool.query(`
      SELECT
        LEAST(
          regexp_replace(m1.model_slug, ':free$', ''),
          regexp_replace(m2.model_slug, ':free$', '')
        ) AS slug_a,
        GREATEST(
          regexp_replace(m1.model_slug, ':free$', ''),
          regexp_replace(m2.model_slug, ':free$', '')
        ) AS slug_b,
        COUNT(DISTINCT gp1.game_id) AS matches_played,
        MAX(COALESCE(g.start_time, g.created_at)) AS last_played_at
      FROM public.game_participants gp1
      JOIN public.game_participants gp2
        ON gp1.game_id = gp2.game_id AND gp1.player_slot < gp2.player_slot
      JOIN public.models m1 ON gp1.model_id = m1.id
      JOIN public.models m2 ON gp2.model_id = m2.id
      JOIN public.games g ON gp1.game_id = g.id
      WHERE g.status = 'completed'
      GROUP BY slug_a, slug_b
      ORDER BY matches_played DESC
    `);

    console.log(`\\nPairings found: ${pairings.rows.length}`);
    if (pairings.rows.length > 0) {
      console.log('\\nTop 10 pairings:');
      pairings.rows.slice(0, 10).forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.slug_a} vs ${row.slug_b} - ${row.matches_played} matches`);
      });
    }

    // 6. Check if there are any non-completed games
    const nonCompleted = await pool.query(`
      SELECT status, COUNT(*) as count FROM public.games GROUP BY status
    `);
    console.log('\\nGame status breakdown:');
    nonCompleted.rows.forEach(r => {
      console.log(`  ${r.status}: ${r.count}`);
    });

    console.log('\\n=== END DIAGNOSTICS ===\\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

diagnose();
