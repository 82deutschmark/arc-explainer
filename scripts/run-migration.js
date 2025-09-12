/**
 * Migration Runner - Rename prediction_accuracy_score to trustworthiness_score
 * 
 * This script runs the database migration to fix the misleading field name.
 * Safe to run multiple times - includes data verification and rollback capability.
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
    console.log('🚀 Starting database migration: prediction_accuracy_score → trustworthiness_score');
    
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Step 1: Check if migration is already done
      const checkResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'explanations' 
        AND column_name IN ('prediction_accuracy_score', 'trustworthiness_score')
      `);
      
      const hasOldColumn = checkResult.rows.some(row => row.column_name === 'prediction_accuracy_score');
      const hasNewColumn = checkResult.rows.some(row => row.column_name === 'trustworthiness_score');
      
      if (hasNewColumn && !hasOldColumn) {
        console.log('✅ Migration already completed - trustworthiness_score column exists');
        await client.query('ROLLBACK');
        return;
      }
      
      if (!hasOldColumn) {
        console.log('⚠️  prediction_accuracy_score column not found - nothing to migrate');
        await client.query('ROLLBACK');
        return;
      }
      
      console.log('📊 Found prediction_accuracy_score column, proceeding with migration...');
      
      // Step 2: Add new column if it doesn't exist
      if (!hasNewColumn) {
        console.log('📝 Adding trustworthiness_score column...');
        await client.query(`
          ALTER TABLE explanations 
          ADD COLUMN trustworthiness_score FLOAT DEFAULT NULL
        `);
      }
      
      // Step 3: Copy data from old column to new column
      console.log('📋 Copying data from prediction_accuracy_score to trustworthiness_score...');
      const copyResult = await client.query(`
        UPDATE explanations 
        SET trustworthiness_score = prediction_accuracy_score 
        WHERE prediction_accuracy_score IS NOT NULL
        AND trustworthiness_score IS NULL
      `);
      
      console.log(`📦 Copied ${copyResult.rowCount} rows of data`);
      
      // Step 4: Verify data migration
      console.log('🔍 Verifying data migration...');
      const verifyResult = await client.query(`
        SELECT COUNT(*) as mismatch_count
        FROM explanations 
        WHERE (prediction_accuracy_score IS NULL AND trustworthiness_score IS NOT NULL)
           OR (prediction_accuracy_score IS NOT NULL AND trustworthiness_score IS NULL)
           OR (prediction_accuracy_score != trustworthiness_score)
      `);
      
      const mismatchCount = parseInt(verifyResult.rows[0].mismatch_count);
      
      if (mismatchCount > 0) {
        throw new Error(`Data migration failed: ${mismatchCount} rows have mismatched values`);
      }
      
      // Step 5: Get statistics
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(trustworthiness_score) as rows_with_trustworthiness
        FROM explanations
      `);
      
      const stats = statsResult.rows[0];
      console.log(`✅ Migration verification successful:`);
      console.log(`   Total explanations: ${stats.total_rows}`);
      console.log(`   Rows with trustworthiness_score: ${stats.rows_with_trustworthiness}`);
      
      // Step 6: Add comment to document the field purpose
      console.log('📝 Adding column comment...');
      await client.query(`
        COMMENT ON COLUMN explanations.trustworthiness_score IS 
        'AI confidence reliability score combining confidence claims with actual correctness. Higher scores indicate better correlation between AI confidence and actual performance. This is the primary research metric.'
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('⚠️  IMPORTANT: The old prediction_accuracy_score column still exists.');
      console.log('   After verifying the application works correctly, you can drop it with:');
      console.log('   ALTER TABLE explanations DROP COLUMN prediction_accuracy_score;');
      console.log('');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();