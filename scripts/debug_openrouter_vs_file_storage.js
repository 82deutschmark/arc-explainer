/**
 * Debug script to compare OpenRouter database storage vs file system storage
 * Investigates discrepancies between what's stored in DB vs explained/*.json files
 * 
 * Author: Cascade claude-3-5-sonnet-20241022
 */

const fs = require('fs');
const path = require('path');
const { drizzle } = require('drizzle-orm/postgres-js');
const { eq, like } = require('drizzle-orm');
const postgres = require('postgres');
const { explanations } = require('../server/database/schema');

const EXPLAINED_DIR = path.join(__dirname, '../data/explained');
const PUZZLE_ID = 'e9afcf9a';

async function debugOpenRouterStorage() {
  console.log('🔍 Debugging OpenRouter vs File Storage Discrepancy\n');
  
  // Initialize database connection
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }
  
  const sql = postgres(connectionString, { ssl: 'require' });
  const db = drizzle(sql);
  
  try {
    // 1. Check file system data
    console.log('📁 FILE SYSTEM DATA:');
    const filePath = path.join(EXPLAINED_DIR, `${PUZZLE_ID}-EXPLAINED.json`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return;
    }
    
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`- Task ID: ${fileData.taskId}`);
    console.log(`- Models in file: ${fileData.models?.join(', ') || 'none'}`);
    console.log(`- Exported at: ${fileData.exportedAt}`);
    
    if (fileData.explanations) {
      for (const [modelKey, explanation] of Object.entries(fileData.explanations)) {
        console.log(`\n  📊 Model: ${modelKey}`);
        console.log(`    - Status: ${explanation.status}`);
        console.log(`    - Solving Strategy: ${explanation.solvingStrategy ? 'YES (' + explanation.solvingStrategy.length + ' chars)' : 'NO'}`);
        console.log(`    - Pattern Description: ${explanation.patternDescription ? 'YES (' + explanation.patternDescription.length + ' chars)' : 'NO'}`);
        console.log(`    - Hints: ${explanation.hints ? explanation.hints.length + ' items' : 'NO'}`);
        console.log(`    - Confidence: ${explanation.confidence || 'NO'}`);
        console.log(`    - Input Tokens: ${explanation.inputTokens || 'NO'}`);
        console.log(`    - Output Tokens: ${explanation.outputTokens || 'NO'}`);
        console.log(`    - Total Tokens: ${explanation.totalTokens || 'NO'}`);
        console.log(`    - Estimated Cost: ${explanation.estimatedCost || 'NO'}`);
        console.log(`    - Temperature: ${explanation.temperature || 'NO'}`);
        console.log(`    - Processing Time: ${explanation.apiProcessingTimeMs || 'NO'}`);
        console.log(`    - Predicted Output: ${explanation.predictedOutput ? 'YES' : 'NO'}`);
        console.log(`    - Prediction Correct: ${explanation.isPredictionCorrect}`);
        console.log(`    - Prediction Accuracy: ${explanation.predictionAccuracyScore}`);
      }
    }
    
    // 2. Check database data
    console.log('\n\n💾 DATABASE DATA:');
    console.log(`Querying explanations for puzzle: ${PUZZLE_ID}`);
    
    const dbRecords = await db
      .select()
      .from(explanations)
      .where(eq(explanations.puzzleId, PUZZLE_ID))
      .orderBy(explanations.createdAt);
    
    console.log(`Found ${dbRecords.length} records in database:`);
    
    for (const record of dbRecords) {
      console.log(`\n  📊 Model: ${record.modelName} (ID: ${record.id})`);
      console.log(`    - Created: ${record.createdAt}`);
      console.log(`    - Solving Strategy: ${record.solvingStrategy ? 'YES (' + record.solvingStrategy.length + ' chars)' : 'NO'}`);
      console.log(`    - Pattern Description: ${record.patternDescription ? 'YES (' + record.patternDescription.length + ' chars)' : 'NO'}`);
      console.log(`    - Hints: ${record.hints ? JSON.parse(record.hints).length + ' items' : 'NO'}`);
      console.log(`    - Confidence: ${record.confidence || 'NO'}`);
      console.log(`    - Input Tokens: ${record.inputTokens || 'NO'}`);
      console.log(`    - Output Tokens: ${record.outputTokens || 'NO'}`);
      console.log(`    - Total Tokens: ${record.totalTokens || 'NO'}`);
      console.log(`    - Estimated Cost: ${record.estimatedCost || 'NO'}`);
      console.log(`    - Temperature: ${record.temperature || 'NO'}`);
      console.log(`    - Processing Time: ${record.apiProcessingTimeMs || 'NO'}`);
      console.log(`    - Predicted Grid: ${record.predictedOutputGrid ? 'YES' : 'NO'}`);
      console.log(`    - Prediction Correct: ${record.isPredictionCorrect}`);
      console.log(`    - Prediction Accuracy: ${record.predictionAccuracyScore}`);
      console.log(`    - Reasoning Log: ${record.reasoningLog ? 'YES (' + record.reasoningLog.length + ' chars)' : 'NO'}`);
      console.log(`    - Has Reasoning Log: ${record.hasReasoningLog}`);
    }
    
    // 3. Check for OpenRouter models specifically
    console.log('\n\n🌐 OPENROUTER MODELS ANALYSIS:');
    console.log('Checking all OpenRouter models in database...');
    
    const openRouterRecords = await db
      .select()
      .from(explanations)
      .where(like(explanations.modelName, '%/%'))
      .orderBy(explanations.createdAt);
    
    console.log(`Found ${openRouterRecords.length} OpenRouter records total:`);
    
    const modelStats = {};
    for (const record of openRouterRecords) {
      const modelName = record.modelName;
      if (!modelStats[modelName]) {
        modelStats[modelName] = {
          count: 0,
          hasStrategy: 0,
          hasPattern: 0,
          hasTokens: 0,
          hasCost: 0,
          hasGrid: 0,
          avgProcessingTime: 0,
          totalProcessingTime: 0
        };
      }
      
      const stats = modelStats[modelName];
      stats.count++;
      if (record.solvingStrategy) stats.hasStrategy++;
      if (record.patternDescription) stats.hasPattern++;
      if (record.totalTokens) stats.hasTokens++;
      if (record.estimatedCost) stats.hasCost++;
      if (record.predictedOutputGrid) stats.hasGrid++;
      if (record.apiProcessingTimeMs) {
        stats.totalProcessingTime += record.apiProcessingTimeMs;
      }
    }
    
    // Calculate averages
    for (const stats of Object.values(modelStats)) {
      stats.avgProcessingTime = stats.count > 0 ? Math.round(stats.totalProcessingTime / stats.count) : 0;
    }
    
    // Display stats
    console.log('\n📈 Model Statistics:');
    for (const [modelName, stats] of Object.entries(modelStats)) {
      console.log(`\n  ${modelName}:`);
      console.log(`    - Total records: ${stats.count}`);
      console.log(`    - Has solving strategy: ${stats.hasStrategy}/${stats.count} (${Math.round(100*stats.hasStrategy/stats.count)}%)`);
      console.log(`    - Has pattern description: ${stats.hasPattern}/${stats.count} (${Math.round(100*stats.hasPattern/stats.count)}%)`);
      console.log(`    - Has token counts: ${stats.hasTokens}/${stats.count} (${Math.round(100*stats.hasTokens/stats.count)}%)`);
      console.log(`    - Has cost data: ${stats.hasCost}/${stats.count} (${Math.round(100*stats.hasCost/stats.count)}%)`);
      console.log(`    - Has predicted grid: ${stats.hasGrid}/${stats.count} (${Math.round(100*stats.hasGrid/stats.count)}%)`);
      console.log(`    - Avg processing time: ${stats.avgProcessingTime}ms`);
    }
    
    // 4. Summary and recommendations
    console.log('\n\n📋 ANALYSIS SUMMARY:');
    console.log('='.repeat(50));
    
    const fileModels = Object.keys(fileData.explanations || {});
    const dbModels = [...new Set(dbRecords.map(r => r.modelName))];
    
    console.log(`File contains: ${fileModels.join(', ')}`);
    console.log(`DB contains: ${dbModels.join(', ')}`);
    
    if (fileModels.length > 0 && dbModels.length > 0) {
      const overlap = fileModels.filter(m => dbModels.includes(m));
      console.log(`Overlap: ${overlap.join(', ') || 'NONE'}`);
      
      if (overlap.length === 0) {
        console.log('\n❌ CRITICAL ISSUE: File and database contain DIFFERENT models!');
        console.log('   This suggests a severe data consistency problem.');
      }
    }
    
    console.log('\n🔍 KEY FINDINGS:');
    if (openRouterRecords.length > 0) {
      const emptyCount = openRouterRecords.filter(r => 
        !r.solvingStrategy && !r.patternDescription && (!r.hints || r.hints === '[]')
      ).length;
      
      console.log(`- ${emptyCount}/${openRouterRecords.length} OpenRouter records are essentially empty`);
      console.log(`- This represents ${Math.round(100*emptyCount/openRouterRecords.length)}% data loss`);
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await sql.end();
  }
}

// Run the analysis
debugOpenRouterStorage().catch(console.error);
