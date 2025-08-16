/**
 * Database migration script to add reasoning log columns
 * Adds support for storing AI reasoning logs from models that provide step-by-step reasoning
 * Author: Cascade
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('🔄 Starting reasoning logs migration...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Add reasoning_log column
      console.log('📝 Adding reasoning_log column...');
      await client.query(`
        ALTER TABLE explanations 
        ADD COLUMN IF NOT EXISTS reasoning_log TEXT
      `);
      
      // Add has_reasoning_log column
      console.log('📝 Adding has_reasoning_log column...');
      await client.query(`
        ALTER TABLE explanations 
        ADD COLUMN IF NOT EXISTS has_reasoning_log BOOLEAN DEFAULT FALSE
      `);
      
      // Add saturn_log column
      console.log('📝 Adding saturn_log column...');
      await client.query(`
        ALTER TABLE explanations 
        ADD COLUMN IF NOT EXISTS saturn_log TEXT
      `);
      
      // Update existing records
      console.log('🔄 Updating existing records...');
      const updateResult = await client.query(`
        UPDATE explanations 
        SET has_reasoning_log = FALSE 
        WHERE has_reasoning_log IS NULL
      `);
      console.log(`✅ Updated ${updateResult.rowCount} existing records`);
      
      // Create index for performance
      console.log('📊 Creating index...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_explanations_has_reasoning_log 
        ON explanations(has_reasoning_log)
      `);
      
      // Verify the migration
      console.log('🔍 Verifying migration...');
      const verifyResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'explanations' 
        AND column_name IN ('reasoning_log', 'has_reasoning_log', 'saturn_log')
        ORDER BY column_name
      `);
      
      console.log('📋 New columns added:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
      });
      
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!');
      
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
