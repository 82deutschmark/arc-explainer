import { config } from 'dotenv';
import { Pool } from 'pg';

config();

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('Missing DATABASE_URL env var');
  process.exit(1);
}

const pool = new Pool({
  connectionString: conn,
  ssl: conn.includes('localhost') ? false : { rejectUnauthorized: false },
});

const PATTERN = ':(free|paid)$';
const LIKE = 'nvidia/nemotron-3-nano-30b-a3b%';

async function main() {
  try {
    const modelRows = await pool.query(
      `SELECT id, model_slug, trueskill_mu, trueskill_sigma, trueskill_exposed, wins, losses, ties, games_played
       FROM public.models
       WHERE model_slug ILIKE $1
       ORDER BY model_slug`,
      [LIKE],
    );
    console.log('\nModels table rows:');
    console.log(modelRows.rows);

    const rollupRows = await pool.query(
      `SELECT regexp_replace(model_slug, $2, '', 'i') AS normalized_slug,
              COUNT(*) AS slug_variants,
              SUM(games_played) AS total_games,
              SUM(wins) AS total_wins,
              SUM(losses) AS total_losses,
              SUM(ties) AS total_ties,
              SUM(CASE WHEN trueskill_mu IS NOT NULL THEN 1 ELSE 0 END) AS rating_rows
       FROM public.models
       WHERE model_slug ILIKE $1
       GROUP BY normalized_slug`,
      [LIKE, PATTERN],
    );
    console.log('\nModel rollup (per normalized slug):');
    console.log(rollupRows.rows);

    const gpRows = await pool.query(
      `SELECT regexp_replace(m.model_slug, $2, '', 'i') AS normalized_slug,
              COUNT(gp.game_id) AS games_played,
              COUNT(CASE WHEN gp.result = 'won' THEN 1 END) AS wins,
              COUNT(CASE WHEN gp.result = 'lost' THEN 1 END) AS losses,
              COUNT(CASE WHEN gp.result = 'tied' THEN 1 END) AS ties
       FROM public.models m
       JOIN public.game_participants gp ON gp.model_id = m.id
       JOIN public.games g ON gp.game_id = g.id
       WHERE m.model_slug ILIKE $1 AND COALESCE(g.is_culled, false) = false
       GROUP BY normalized_slug`,
      [LIKE, PATTERN],
    );
    console.log('\nAggregated participant stats (culled filtered):');
    console.log(gpRows.rows);
  } catch (error) {
    console.error('Query error', error);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error', err);
  process.exit(1);
});
