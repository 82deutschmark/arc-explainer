/**
 * One-time script to find all entries with confidence = 0 in the database
 * Run with: node scripts/find-zero-confidence-entries.js
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { explanations } from '../server/db/schema.js';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function findZeroConfidenceEntries() {
  console.log('🔍 Searching for entries with confidence = 0...\n');
  
  try {
    // Find all explanations with confidence = 0
    const zeroConfidenceEntries = await db
      .select({
        id: explanations.id,
        puzzleId: explanations.puzzleId,
        confidence: explanations.confidence,
        modelName: explanations.modelName,
        isPredictionCorrect: explanations.isPredictionCorrect,
        predictionAccuracyScore: explanations.predictionAccuracyScore,
        createdAt: explanations.createdAt
      })
      .from(explanations)
      .where(eq(explanations.confidence, 0));

    console.log(`Found ${zeroConfidenceEntries.length} entries with confidence = 0\n`);

    if (zeroConfidenceEntries.length > 0) {
      console.log('📊 Summary by Model:');
      const modelCounts = {};
      const accuracyImpacts = [];

      zeroConfidenceEntries.forEach(entry => {
        // Count by model
        if (!modelCounts[entry.modelName]) {
          modelCounts[entry.modelName] = 0;
        }
        modelCounts[entry.modelName]++;

        // Track accuracy score impacts
        accuracyImpacts.push({
          id: entry.id,
          puzzleId: entry.puzzleId,
          isCorrect: entry.isPredictionCorrect,
          currentScore: entry.predictionAccuracyScore,
          // Calculate what score should be with confidence = 50
          shouldBeScore: entry.isPredictionCorrect ? 
            Math.max(0.5, 0.5 + (0.5 * 0.5)) : // correct: Math.max(0.5, 0.5 + (50/100 * 0.5)) = 0.75
            1.0 - 0.5 // incorrect: 1.0 - 50/100 = 0.5
        });
      });

      // Display model counts
      Object.entries(modelCounts).forEach(([model, count]) => {
        console.log(`  ${model}: ${count} entries`);
      });

      console.log('\n🎯 Accuracy Score Impact Analysis:');
      const incorrectPredictions = accuracyImpacts.filter(entry => !entry.isCorrect);
      const correctPredictions = accuracyImpacts.filter(entry => entry.isCorrect);

      console.log(`\nIncorrect Predictions with confidence=0 (${incorrectPredictions.length} entries):`);
      console.log('  Current scores (should be much lower):');
      incorrectPredictions.forEach(entry => {
        console.log(`    ID ${entry.id}: current=${entry.currentScore}, should=${entry.shouldBeScore} (puzzle: ${entry.puzzleId})`);
      });

      console.log(`\nCorrect Predictions with confidence=0 (${correctPredictions.length} entries):`);
      console.log('  Current scores (should be higher):');
      correctPredictions.slice(0, 5).forEach(entry => {
        console.log(`    ID ${entry.id}: current=${entry.currentScore}, should=${entry.shouldBeScore} (puzzle: ${entry.puzzleId})`);
      });
      if (correctPredictions.length > 5) {
        console.log(`    ... and ${correctPredictions.length - 5} more`);
      }

      console.log('\n⚠️  CRITICAL FINDINGS:');
      const problematicEntries = incorrectPredictions.filter(entry => entry.currentScore > 0.6);
      if (problematicEntries.length > 0) {
        console.log(`  ${problematicEntries.length} incorrect predictions have suspiciously HIGH accuracy scores due to confidence=0`);
        console.log('  These entries are giving wrong answers maximum trustworthiness scores!');
      }

      console.log('\n🔧 Next Steps:');
      console.log('  1. The code fixes have been applied to prevent future confidence=0 issues');
      console.log('  2. Consider running a database migration to fix existing entries');
      console.log('  3. Recalculate predictionAccuracyScore for these entries with confidence=50');

    } else {
      console.log('✅ No entries found with confidence = 0. Database is clean!');
    }

  } catch (error) {
    console.error('❌ Error querying database:', error);
  } finally {
    await sql.end();
  }
}

// Run the analysis
findZeroConfidenceEntries();