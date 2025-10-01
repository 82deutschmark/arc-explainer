/**
 * IMMEDIATE DELETE - No dry run, just delete all HuggingFace imports NOW
 */

import dotenv from 'dotenv';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { getPool } from '../repositories/base/BaseRepository.ts';

dotenv.config();

async function deleteNow() {
  console.log('🔌 Connecting to database...');
  await repositoryService.initialize();
  
  const pool = getPool();
  if (!pool) {
    console.error('❌ No database pool');
    process.exit(1);
  }
  
  console.log('🗑️  DELETING ALL HUGGINGFACE IMPORTS NOW...\n');
  
  const result = await pool.query(`
    DELETE FROM explanations 
    WHERE prompt_template_id = 'external-huggingface'
    RETURNING id
  `);
  
  console.log(`✅ DELETED ${result.rowCount} entries\n`);
  process.exit(0);
}

deleteNow().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
