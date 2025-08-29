#!/usr/bin/env node

/**
 * Simple Recovery Script for Multiple Predictions Data
 * 
 * Directly recovers missing multiple predictions data from database entries
 * that had the explanationService bug. Uses the same database connection
 * and repository classes as the server.
 * 
 * @author Claude Sonnet 4
 * @date 2025-08-29
 */

import { repositoryService } from '../server/repositories/RepositoryService.ts';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
    console.log('🔍 Starting simple recovery of multiple predictions data...\n');
    
    // Initialize using the same repository service as the server
    console.log('🔌 Initializing repository service...');
    const initialized = await repositoryService.initialize();
    if (!initialized) {
        console.error('❌ Failed to initialize repository service');
        return;
    }
    console.log('✅ Repository service initialized\n');
    
    // Use the same repository service as the server
    const explanationRepo = repositoryService.explanations;
    
    try {
        // Get statistics before recovery
        console.log('📊 Getting current statistics...');
        console.log('   Repository connected:', repositoryService.isConnected());
        
        // Debug: try a simple query first
        const hasExplanationTest = await explanationRepo.hasExplanation('ff28f65a');
        console.log('   Test query for ff28f65a:', hasExplanationTest);
        
        // Debug: Direct SQL query to see what's in the database
        const directQuery = `
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN has_multiple_predictions = true THEN 1 END) as has_true,
                COUNT(CASE WHEN has_multiple_predictions IS NULL THEN 1 END) as has_null,
                COUNT(CASE WHEN provider_raw_response IS NOT NULL THEN 1 END) as has_raw_response
            FROM explanations
        `;
        
        // Access the pool directly for debugging
        const pool = (explanationRepo as any).pool;
        if (pool) {
            console.log('   Direct database query...');
            const directResult = await pool.query(directQuery);
            console.log('   Direct query result:', directResult.rows[0]);
        } else {
            console.log('   No pool available');
        }
        
        const statsBefore = await explanationRepo.getMultiplePredictionsStats();
        console.log('   Before recovery:');
        console.log(`   - Total explanations: ${statsBefore.totalExplanations}`);
        console.log(`   - With multiple predictions: ${statsBefore.withMultiplePredictions}`);
        console.log(`   - Missing multiple predictions: ${statsBefore.missingMultiplePredictions}`);
        console.log(`   - Potentially recoverable: ${statsBefore.potentialRecoverable}`);
        console.log('');
        
        if (statsBefore.potentialRecoverable === 0) {
            console.log('✅ No entries need recovery. All done!');
            return;
        }
        
        // Find entries that need recovery
        console.log('🔍 Finding entries that need recovery...');
        const entries = await explanationRepo.findMissingMultiplePredictions(50); // Limit to 50 for safety
        console.log(`   Found ${entries.length} entries to check\n`);
        
        let recoveredCount = 0;
        let processedCount = 0;
        
        // Process each entry
        for (const entry of entries) {
            processedCount++;
            const { id, puzzleId, modelName, providerRawResponse } = entry;
            
            console.log(`🔄 [${processedCount}/${entries.length}] Processing ID ${id} (${modelName}, puzzle: ${puzzleId})`);
            
            // Parse raw response to look for multiple predictions
            let parsedResponse;
            try {
                parsedResponse = typeof providerRawResponse === 'string' 
                    ? JSON.parse(providerRawResponse) 
                    : providerRawResponse;
            } catch (e) {
                console.log(`   ⚠️  Failed to parse raw response: ${e.message}`);
                continue;
            }
            
            // Check if it has multiple predictions data
            const collectedGrids = [];
            
            // Look for predictedOutput1, predictedOutput2, predictedOutput3
            let i = 1;
            while (parsedResponse[`predictedOutput${i}`]) {
                const grid = parsedResponse[`predictedOutput${i}`];
                if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
                    collectedGrids.push(grid);
                }
                i++;
            }
            
            // Also check multiplePredictedOutputs array format
            if (Array.isArray(parsedResponse.multiplePredictedOutputs)) {
                for (const item of parsedResponse.multiplePredictedOutputs) {
                    if (Array.isArray(item) && item.length > 0) {
                        collectedGrids.push(item);
                    }
                }
            }
            
            if (collectedGrids.length > 0) {
                console.log(`   ✅ Found ${collectedGrids.length} prediction grids! Updating database...`);
                
                // Update the database entry
                await explanationRepo.updateMultiplePredictions(id, collectedGrids);
                recoveredCount++;
                console.log(`   💾 Updated entry ${id} with ${collectedGrids.length} grids`);
            } else {
                console.log(`   ❌ No multiple predictions found`);
            }
            
            console.log(''); // Empty line for readability
        }
        
        // Get statistics after recovery
        console.log('📊 Getting final statistics...');
        const statsAfter = await explanationRepo.getMultiplePredictionsStats();
        console.log('   After recovery:');
        console.log(`   - Total explanations: ${statsAfter.totalExplanations}`);
        console.log(`   - With multiple predictions: ${statsAfter.withMultiplePredictions} (was ${statsBefore.withMultiplePredictions})`);
        console.log(`   - Missing multiple predictions: ${statsAfter.missingMultiplePredictions} (was ${statsBefore.missingMultiplePredictions})`);
        console.log(`   - Potentially recoverable: ${statsAfter.potentialRecoverable} (was ${statsBefore.potentialRecoverable})`);
        console.log('');
        
        console.log(`🎉 Recovery complete!`);
        console.log(`📊 Summary:`);
        console.log(`   - Processed: ${processedCount} entries`);
        console.log(`   - Recovered: ${recoveredCount} entries with multiple predictions`);
        console.log(`   - Improvement: +${statsAfter.withMultiplePredictions - statsBefore.withMultiplePredictions} entries now have multiple predictions`);
        
    } catch (error) {
        console.error('❌ Recovery failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

main().catch(console.error);