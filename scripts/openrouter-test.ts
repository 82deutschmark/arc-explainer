/**
 * OpenRouter Test Script
 * 
 * Script to test all OpenRouter models with a specific ARC puzzle test case.
 * This script queries each OpenRouter model with the same test payload to
 * compare their responses.
 * 
 * @author Cascade
 * @date 2025-09-19
 */

import path from 'path';
import { config } from 'dotenv';
import { MODELS } from '../server/config/models/index.js';
import { openrouterService } from '../server/services/openrouter.js';
import type { ARCTask } from '../shared/types.js';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

// Load environment variables



// Test case provided by user
const testTask: ARCTask = {
  train: [
    {
      input: [[4,4,4],[2,3,2],[2,3,3]],
      output: [[5,5,5],[0,0,0],[0,0,0]]
    },
    {
      input: [[7,3,3],[6,6,6],[3,7,7]],
      output: [[0,0,0],[5,5,5],[0,0,0]]
    },
    {
      input: [[2,9,2],[4,4,4],[9,9,9]],
      output: [[0,0,0],[5,5,5],[5,5,5]]
    },
    {
      input: [[2,2,4],[2,2,4],[1,1,1]],
      output: [[0,0,0],[0,0,0],[5,5,5]]
    }
  ],
  test: [
    {
      input: [[4,4,4],[3,2,3],[8,8,8]],
      output: [] // Empty output as this is what we want the model to predict
    }
  ]
};

async function testAllOpenRouterModels() {
  console.log('Starting OpenRouter model testing...');
  
  // Filter for OpenRouter models only
  const openRouterModels = MODELS.filter(model => model.provider === 'OpenRouter');
  
  console.log(`Found ${openRouterModels.length} OpenRouter models to test`);
  
  // Test each model
  for (const model of openRouterModels) {
    try {
      console.log(`\nTesting model: ${model.name} (${model.key})`);
      
      // Use the OpenRouter service to analyze the puzzle
      // Pass undefined for temperature to avoid sending it to OpenRouter
      const result = await openrouterService.analyzePuzzleWithModel(
        testTask,
        model.key,
        'test-puzzle',
        undefined, // No temperature for OpenRouter
        'solver' // Use solver template for consistency
      );
      
      console.log(`✅ Success for ${model.name}`);
      
      // Output raw JSON response for debugging
      console.log(`   Raw JSON Response: ${JSON.stringify(result, null, 2)}`);
      
    } catch (error) {
      console.error(`❌ Error testing ${model.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log('\nOpenRouter model testing completed.');
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAllOpenRouterModels().catch(console.error);
}
