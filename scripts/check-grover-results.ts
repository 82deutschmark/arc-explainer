/**
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-09T18:59:00-04:00
 * PURPOSE: Monitor Grover E2E test results in database
 * Check if predictions were generated and validated correctly
 */

import { repositoryService } from '../server/repositories/RepositoryService.js';

const PUZZLE_ID = '3de23699';

async function checkGroverResults() {
  console.log(`\n🔍 Checking Grover results for puzzle ${PUZZLE_ID}...\n`);
  
  try {
    const explanations = await repositoryService.explanations.getExplanationsForPuzzle(PUZZLE_ID);
    
    if (!explanations || explanations.length === 0) {
      console.log('❌ No explanations found yet');
      return;
    }
    
    // Find most recent Grover entry
    const groverEntries = explanations.filter((e: any) => e.modelName?.includes('grover'));
    
    if (groverEntries.length === 0) {
      console.log('❌ No Grover entries found');
      console.log(`   Found ${explanations.length} total explanations but none from Grover`);
      return;
    }
    
    const latest = groverEntries[groverEntries.length - 1];
    
    console.log('✅ Found Grover entry!\n');
    console.log('📊 Basic Info:');
    console.log(`   ID: ${latest.id}`);
    console.log(`   Model: ${latest.modelName}`);
    console.log(`   Created: ${latest.createdAt}`);
    console.log(`   Iteration Count: ${latest.iterationCount || 'NULL'}`);
    
    console.log('\n🎯 Prediction Fields (THE CRITICAL TEST):');
    console.log(`   predicted_output_grid: ${latest.predictedOutputGrid ? 'POPULATED ✓' : 'NULL ✗'}`);
    console.log(`   is_prediction_correct: ${latest.isPredictionCorrect !== null ? latest.isPredictionCorrect : 'NULL ✗'}`);
    console.log(`   prediction_accuracy_score: ${latest.predictionAccuracyScore !== null ? latest.predictionAccuracyScore : 'NULL ✗'}`);
    
    console.log('\n📝 Multi-Test Fields:');
    console.log(`   has_multiple_predictions: ${latest.hasMultiplePredictions}`);
    console.log(`   multi_test_prediction_grids: ${latest.multiTestPredictionGrids ? 'POPULATED ✓' : 'NULL ✗'}`);
    console.log(`   multi_test_all_correct: ${latest.multiTestAllCorrect !== null ? latest.multiTestAllCorrect : 'NULL ✗'}`);
    console.log(`   multi_test_average_accuracy: ${latest.multiTestAverageAccuracy !== null ? latest.multiTestAverageAccuracy : 'NULL ✗'}`);
    
    console.log('\n🔧 Grover-Specific Fields:');
    console.log(`   grover_iterations: ${latest.groverIterations ? 'POPULATED ✓' : 'NULL ✗'}`);
    console.log(`   grover_best_program: ${latest.groverBestProgram ? `POPULATED (${latest.groverBestProgram.length} chars) ✓` : 'NULL ✗'}`);
    
    console.log('\n💰 Metadata:');
    console.log(`   input_tokens: ${latest.inputTokens || 'NULL'}`);
    console.log(`   output_tokens: ${latest.outputTokens || 'NULL'}`);
    console.log(`   estimated_cost: ${latest.estimatedCost || 'NULL'}`);
    console.log(`   api_processing_time_ms: ${latest.apiProcessingTimeMs || 'NULL'}`);
    
    // Detailed analysis
    console.log('\n🔬 DETAILED ANALYSIS:\n');
    
    if (latest.predictedOutputGrid) {
      if (Array.isArray(latest.predictedOutputGrid)) {
        console.log(`   ✅ Prediction grid is array with ${latest.predictedOutputGrid.length} rows`);
      } else {
        console.log(`   ⚠️  Prediction grid is not array: ${typeof latest.predictedOutputGrid}`);
      }
    } else {
      console.log('   ❌ CRITICAL: Prediction grid is NULL - fix did not work!');
    }
    
    if (latest.groverIterations) {
      const iterations = JSON.parse(latest.groverIterations as string);
      console.log(`   ✅ Grover iterations: ${iterations.length} iterations recorded`);
    }
    
    // VERDICT
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 E2E TEST VERDICT:\n');
    
    const hasPredictions = !!latest.predictedOutputGrid;
    const hasValidation = latest.isPredictionCorrect !== null;
    const hasGroverData = !!latest.groverIterations && !!latest.groverBestProgram;
    
    if (hasPredictions && hasValidation && hasGroverData) {
      console.log('   ✅ SUCCESS: All fields populated correctly!');
      console.log('   ✅ Test execution worked');
      console.log('   ✅ Validation ran');
      console.log('   ✅ Grover data saved');
      console.log('\n   🎉 Fix is WORKING as intended!');
    } else {
      console.log('   ❌ FAILURE: Some fields still NULL');
      if (!hasPredictions) console.log('   ❌ Predictions not generated');
      if (!hasValidation) console.log('   ❌ Validation did not run');
      if (!hasGroverData) console.log('   ❌ Grover data not saved');
      console.log('\n   🔧 Fix needs more work');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error checking results:', error);
  }
  
  process.exit(0);
}

checkGroverResults();
