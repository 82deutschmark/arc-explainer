/**
 * Migration Runner - Fix ingestion_runs.completed_at to allow NULL
 * 
 * Author: Cascade using GPT-5-Pro
 * Date: 2025-10-09
 * Purpose: Remove NOT NULL constraint from completed_at and duration_ms columns
 *          in ingestion_runs table. These fields should be NULL when ingestion starts
 *          and only populated when ingestion completes.
 * SRP/DRY check: Pass - Single migration for fixing ingestion_runs schema
 * 
 * Safe to run multiple times - includes checks to prevent duplicate execution.
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('🚀 Starting database migration: Fix ingestion_runs completed_at constraint');
    
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Step 1: Check current NOT NULL constraints
      const checkResult = await client.query(`
        SELECT 
          column_name,
          is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'ingestion_runs' 
        AND column_name IN ('completed_at', 'duration_ms')
        ORDER BY column_name
      `);
      
      console.log('📊 Current column constraints:');
      checkResult.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.is_nullable === 'YES' ? 'NULL allowed' : 'NOT NULL'}`);
      });
      
      const completedAtNullable = checkResult.rows.find(r => r.column_name === 'completed_at')?.is_nullable === 'YES';
      const durationMsNullable = checkResult.rows.find(r => r.column_name === 'duration_ms')?.is_nullable === 'YES';
      
      if (completedAtNullable && durationMsNullable) {
        console.log('✅ Migration already completed - both columns allow NULL');
        await client.query('ROLLBACK');
        return;
      }
      
      // Step 2: Remove NOT NULL constraint from completed_at
      if (!completedAtNullable) {
        console.log('📝 Removing NOT NULL constraint from completed_at...');
        await client.query(`
          ALTER TABLE ingestion_runs 
          ALTER COLUMN completed_at DROP NOT NULL
        `);
        console.log('✅ completed_at now allows NULL');
      }
      
      // Step 3: Remove NOT NULL constraint from duration_ms
      if (!durationMsNullable) {
        console.log('📝 Removing NOT NULL constraint from duration_ms...');
        await client.query(`
          ALTER TABLE ingestion_runs 
          ALTER COLUMN duration_ms DROP NOT NULL
        `);
        console.log('✅ duration_ms now allows NULL');
      }
      
      // Step 4: Add comments to document the field purpose
      console.log('📝 Adding column comments...');
      await client.query(`
        COMMENT ON COLUMN ingestion_runs.completed_at IS 
        'Timestamp when the ingestion run completed. NULL during active ingestion, populated on completion.';
        
        COMMENT ON COLUMN ingestion_runs.duration_ms IS 
        'Total duration of the ingestion run in milliseconds. NULL during active ingestion, calculated on completion.';
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('✅ The ingestion_runs table can now properly track in-progress runs:');
      console.log('   • Records created with completed_at = NULL when ingestion starts');
      console.log('   • Records updated with completed_at = NOW() when ingestion finishes');
      console.log('');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
