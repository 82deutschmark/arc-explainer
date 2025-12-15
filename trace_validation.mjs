import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Get one puzzle with its submission
  const puzzleId = '0934a4d8';
  const submissionPath = `beetreeARC/logs/submissions/${puzzleId}.json`;
  
  if (fs.existsSync(submissionPath)) {
    const submission = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));
    console.log(`\nPuzzle: ${puzzleId}`);
    console.log(`Submission has ${submission.length} test pairs`);
    
    // Check pair 0
    const pair0 = submission[0];
    console.log(`\nPair 0 attempt_1:`);
    console.log(`  Answer grid size: ${pair0.attempt_1.answer.length}x${pair0.attempt_1.answer[0]?.length}`);
    console.log(`  JSON says correct: ${pair0.attempt_1.correct}`);
    console.log(`  Stored in DB as: `);
    
    const dbResult = await pool.query(
      'SELECT is_prediction_correct, puzzle_id FROM explanations WHERE puzzle_id = $1 AND model_name = $2',
      [puzzleId, 'Johan_Land_Solver_V6-attempt1']
    );
    
    if (dbResult.rows.length > 0) {
      console.log(`    Correct: ${dbResult.rows[0].is_prediction_correct}`);
    }
  } else {
    console.log(`File not found: ${submissionPath}`);
  }
  
  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
