/**
 * check-provider-response-ids.js
 * 
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Verify that provider_response_id is being saved correctly to database
 * after the critical fix in openai.ts and grok.ts
 * SRP/DRY check: Pass - Single script for verification testing
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkProviderResponseIds() {
  try {
    console.log('🔍 Checking provider_response_id in recent database records...\n');
    
    // Check all recent records (last 7 days)
    const allRecent = await pool.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        provider_response_id,
        created_at,
        EXTRACT(DAY FROM NOW() - created_at)::INTEGER as days_old
      FROM explanations
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    console.log(`📊 Found ${allRecent.rows.length} records from last 7 days\n`);
    
    // Statistics
    const withResponseId = allRecent.rows.filter(r => r.provider_response_id !== null);
    const withoutResponseId = allRecent.rows.filter(r => r.provider_response_id === null);
    
    console.log(`✅ Records WITH provider_response_id: ${withResponseId.length}`);
    console.log(`❌ Records WITHOUT provider_response_id: ${withoutResponseId.length}\n`);
    
    if (withResponseId.length > 0) {
      console.log('✅ RECENT RECORDS WITH RESPONSE IDs:');
      withResponseId.slice(0, 10).forEach(row => {
        console.log(`  - ID ${row.id}: ${row.model_name} | Puzzle: ${row.puzzle_id} | Response ID: ${row.provider_response_id?.substring(0, 20)}... | ${row.days_old}d old`);
      });
    }
    
    if (withoutResponseId.length > 0) {
      console.log('\n❌ RECENT RECORDS WITHOUT RESPONSE IDs:');
      withoutResponseId.slice(0, 10).forEach(row => {
        console.log(`  - ID ${row.id}: ${row.model_name} | Puzzle: ${row.puzzle_id} | ${row.days_old}d old`);
      });
    }
    
    // Check OpenAI/Grok models specifically (they should ALWAYS have response IDs)
    console.log('\n🎯 CHECKING OPENAI/GROK MODELS (should have response IDs):');
    const reasoningModels = await pool.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        provider_response_id,
        created_at
      FROM explanations
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND (
          model_name ILIKE '%gpt-5%' 
          OR model_name ILIKE '%o3-%' 
          OR model_name ILIKE '%o4-%'
          OR model_name ILIKE '%grok-4%'
        )
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${reasoningModels.rows.length} OpenAI/Grok records`);
    
    if (reasoningModels.rows.length > 0) {
      const hasIds = reasoningModels.rows.filter(r => r.provider_response_id !== null).length;
      const missingIds = reasoningModels.rows.filter(r => r.provider_response_id === null).length;
      
      console.log(`  ✅ With response IDs: ${hasIds}`);
      console.log(`  ❌ Missing response IDs: ${missingIds}`);
      
      if (hasIds > 0) {
        console.log('\n✅ SAMPLE RESPONSE IDs FROM REASONING MODELS:');
        reasoningModels.rows
          .filter(r => r.provider_response_id !== null)
          .slice(0, 5)
          .forEach(row => {
            console.log(`  - ${row.model_name}: ${row.provider_response_id}`);
          });
      }
      
      if (missingIds > 0) {
        console.log('\n🚨 REASONING MODELS WITHOUT RESPONSE IDs (BUG!):');
        reasoningModels.rows
          .filter(r => r.provider_response_id === null)
          .forEach(row => {
            console.log(`  - ID ${row.id}: ${row.model_name} | ${row.puzzle_id} | ${row.created_at}`);
          });
      }
    }
    
    // Check eligibility for PuzzleDiscussion page
    console.log('\n🎯 CHECKING ELIGIBILITY FOR PUZZLE DISCUSSION PAGE:');
    const eligible = await pool.query(`
      SELECT COUNT(*) as count
      FROM explanations
      WHERE 
        created_at >= NOW() - INTERVAL '30 days'
        AND provider_response_id IS NOT NULL
    `);
    
    console.log(`📊 Records eligible for discussion: ${eligible.rows[0].count}`);
    
    if (parseInt(eligible.rows[0].count) === 0) {
      console.log('\n🚨 PROBLEM: No records eligible for PuzzleDiscussion page!');
      console.log('   This means either:');
      console.log('   1. No analyses have been run in the last 30 days with reasoning models');
      console.log('   2. The fix has not been applied or is not working correctly');
      console.log('\n   💡 Run a test analysis with a GPT-5 or Grok-4 model to verify the fix.');
    } else {
      console.log('✅ Discussion page should show records!');
    }
    
    // Check by puzzle for discussion page
    console.log('\n📋 PUZZLES WITH ELIGIBLE DISCUSSIONS:');
    const puzzlesWithDiscussions = await pool.query(`
      SELECT 
        puzzle_id,
        COUNT(*) as eligible_count,
        array_agg(DISTINCT model_name) as models
      FROM explanations
      WHERE 
        created_at >= NOW() - INTERVAL '30 days'
        AND provider_response_id IS NOT NULL
      GROUP BY puzzle_id
      ORDER BY eligible_count DESC
      LIMIT 10
    `);
    
    if (puzzlesWithDiscussions.rows.length > 0) {
      puzzlesWithDiscussions.rows.forEach(row => {
        console.log(`  - ${row.puzzle_id}: ${row.eligible_count} eligible analyses`);
        console.log(`    Models: ${row.models.join(', ')}`);
      });
    } else {
      console.log('  ❌ No puzzles with eligible discussions found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await pool.end();
  }
}

checkProviderResponseIds();
