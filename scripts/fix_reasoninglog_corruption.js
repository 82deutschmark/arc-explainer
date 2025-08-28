#!/usr/bin/env node
/**
 * Fix ReasoningLog Corruption Script
 * 
 * Fixes existing database entries where reasoning_log contains "[object Object]"
 * or similar corrupted values by setting them to null.
 * 
 * This script:
 * 1. Identifies corrupted reasoning log entries
 * 2. Creates backup of corrupted data
 * 3. Updates corrupted entries to null
 * 4. Reports on the cleanup results
 * 
 * Usage: node scripts/fix_reasoninglog_corruption.js
 * 
 * @author Claude Code Assistant
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

/**
 * Patterns that indicate corrupted reasoning logs
 */
const CORRUPTION_PATTERNS = [
  '[object Object]',
  '[object Array]',
  '[object Undefined]',
  '[object Null]',
  'undefined',
  'null',
  '{}',
  '[]',
  ',,,',
  '","",""'
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Identify corrupted entries
    console.log('\n📊 Analyzing reasoning log corruption...');
    
    const corrupted = await client.query(`
      SELECT id, puzzle_id, model_name, reasoning_log, created_at
      FROM explanations 
      WHERE reasoning_log IS NOT NULL 
        AND (
          reasoning_log LIKE '%[object Object]%' 
          OR reasoning_log LIKE '%[object Array]%'
          OR reasoning_log LIKE '%[object Undefined]%'
          OR reasoning_log = 'undefined'
          OR reasoning_log = 'null'
          OR reasoning_log = '{}'
          OR reasoning_log = '[]'
          OR reasoning_log LIKE '%,,,%'
          OR reasoning_log LIKE '%"","",""%%'
          OR LENGTH(TRIM(reasoning_log)) = 0
        )
      ORDER BY created_at DESC
    `);

    console.log(`🔍 Found ${corrupted.rows.length} corrupted reasoning log entries`);

    if (corrupted.rows.length === 0) {
      console.log('🎉 No corruption found! Database is clean.');
      return;
    }

    // Step 2: Show sample of corruption
    console.log('\n📋 Sample of corrupted entries:');
    corrupted.rows.slice(0, 5).forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id}, Model: ${row.model_name}, Corruption: "${row.reasoning_log.slice(0, 50)}..."`);
    });

    // Step 3: Create backup table
    console.log('\n💾 Creating backup of corrupted data...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS reasoning_log_corruption_backup_${Date.now()} AS 
      SELECT id, puzzle_id, model_name, reasoning_log, created_at, NOW() as backup_created_at
      FROM explanations 
      WHERE reasoning_log IS NOT NULL 
        AND (
          reasoning_log LIKE '%[object Object]%' 
          OR reasoning_log LIKE '%[object Array]%'
          OR reasoning_log LIKE '%[object Undefined]%'
          OR reasoning_log = 'undefined'
          OR reasoning_log = 'null'
          OR reasoning_log = '{}'
          OR reasoning_log = '[]'
          OR reasoning_log LIKE '%,,,%'
          OR reasoning_log LIKE '%"","",""%%'
          OR LENGTH(TRIM(reasoning_log)) = 0
        )
    `);

    console.log('✅ Backup table created successfully');

    // Step 4: Fix corrupted entries
    console.log('\n🔧 Fixing corrupted reasoning log entries...');
    
    const updateResult = await client.query(`
      UPDATE explanations 
      SET 
        reasoning_log = NULL,
        has_reasoning_log = FALSE
      WHERE reasoning_log IS NOT NULL 
        AND (
          reasoning_log LIKE '%[object Object]%' 
          OR reasoning_log LIKE '%[object Array]%'
          OR reasoning_log LIKE '%[object Undefined]%'
          OR reasoning_log = 'undefined'
          OR reasoning_log = 'null'
          OR reasoning_log = '{}'
          OR reasoning_log = '[]'
          OR reasoning_log LIKE '%,,,%'
          OR reasoning_log LIKE '%"","",""%%'
          OR LENGTH(TRIM(reasoning_log)) = 0
        )
    `);

    console.log(`✅ Updated ${updateResult.rowCount} corrupted entries`);

    // Step 5: Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    
    const remainingCorrupted = await client.query(`
      SELECT COUNT(*) as count
      FROM explanations 
      WHERE reasoning_log IS NOT NULL 
        AND (
          reasoning_log LIKE '%[object Object]%' 
          OR reasoning_log LIKE '%[object Array]%'
          OR reasoning_log LIKE '%[object Undefined]%'
          OR reasoning_log = 'undefined'
          OR reasoning_log = 'null'
          OR reasoning_log = '{}'
          OR reasoning_log = '[]'
          OR reasoning_log LIKE '%,,,%'
          OR reasoning_log LIKE '%"","",""%%'
          OR LENGTH(TRIM(reasoning_log)) = 0
        )
    `);

    const stillCorrupted = remainingCorrupted.rows[0].count;

    if (stillCorrupted === 0) {
      console.log('🎉 All corruption successfully cleaned!');
    } else {
      console.log(`⚠️  ${stillCorrupted} entries still appear corrupted - manual review may be needed`);
    }

    // Step 6: Summary statistics
    const totalReasoningLogs = await client.query(`
      SELECT COUNT(*) as count FROM explanations WHERE reasoning_log IS NOT NULL
    `);
    
    const validReasoningLogs = totalReasoningLogs.rows[0].count;

    console.log('\n📈 Final Statistics:');
    console.log(`• Corrupted entries fixed: ${updateResult.rowCount}`);
    console.log(`• Valid reasoning logs remaining: ${validReasoningLogs}`);
    console.log(`• Remaining corrupted entries: ${stillCorrupted}`);
    
    if (updateResult.rowCount > 0) {
      console.log('\n💡 Note: The fixed entries will now have reasoning_log = NULL and has_reasoning_log = FALSE');
      console.log('   New analyses will use the improved reasoning log handling.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Execute the script
main().catch(console.error);