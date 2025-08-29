#!/usr/bin/env node

/**
 * Recovery Script for Multiple Predictions Data
 * 
 * This script finds database entries that have missing multiple prediction data
 * due to the explanationService bug (where predictedOutput1/2/3 fields were ignored)
 * and updates them with the correct multiple_predicted_outputs data.
 * 
 * @author Claude Sonnet 4
 * @date 2025-08-29
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Use same connection method as the server
const databaseUrl = process.env.DATABASE_URL;
let pool = null;

if (databaseUrl) {
    console.log('📊 Using DATABASE_URL connection');
    pool = new Pool({ connectionString: databaseUrl });
} else {
    console.log('⚠️  No DATABASE_URL found - this recovery requires database access');
    process.exit(1);
}

async function main() {
    console.log('🔍 Starting recovery of multiple predictions data...');
    
    try {
        // Find entries with null hasMultiplePredictions but have provider_raw_response data
        const query = `
            SELECT id, puzzle_id, model_name, provider_raw_response
            FROM explanations 
            WHERE has_multiple_predictions IS NULL 
              AND provider_raw_response IS NOT NULL
            ORDER BY id DESC
            LIMIT 100
        `;
        
        const result = await pool.query(query);
        console.log(`📊 Found ${result.rows.length} entries to check`);
        
        let recoveredCount = 0;
        let processedCount = 0;
        
        for (const row of result.rows) {
            processedCount++;
            const { id, puzzle_id, model_name, provider_raw_response } = row;
            
            console.log(`\n🔍 [${processedCount}/${result.rows.length}] Checking ID ${id} (${model_name})`);
            
            // Parse raw response to look for multiple predictions
            let parsedResponse;
            try {
                if (typeof provider_raw_response === 'string') {
                    parsedResponse = JSON.parse(provider_raw_response);
                } else {
                    parsedResponse = provider_raw_response;
                }
            } catch (e) {
                console.log(`   ⚠️  Failed to parse raw response: ${e.message}`);
                continue;
            }
            
            // Check if it has multiple predictions data
            const collectedGrids = [];
            let hasMultiplePredictions = false;
            
            // Look for predictedOutput1, predictedOutput2, predictedOutput3
            let i = 1;
            while (parsedResponse[`predictedOutput${i}`]) {
                const grid = parsedResponse[`predictedOutput${i}`];
                if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
                    collectedGrids.push(grid);
                    hasMultiplePredictions = true;
                }
                i++;
            }
            
            // Also check multiplePredictedOutputs array format
            if (Array.isArray(parsedResponse.multiplePredictedOutputs)) {
                for (const item of parsedResponse.multiplePredictedOutputs) {
                    if (Array.isArray(item) && item.length > 0) {
                        collectedGrids.push(item);
                        hasMultiplePredictions = true;
                    }
                }
            }
            
            if (hasMultiplePredictions && collectedGrids.length > 0) {
                console.log(`   ✅ Found ${collectedGrids.length} prediction grids! Updating database...`);
                
                // Update the database entry
                const updateQuery = `
                    UPDATE explanations 
                    SET has_multiple_predictions = true,
                        multiple_predicted_outputs = $1
                    WHERE id = $2
                `;
                
                await pool.query(updateQuery, [JSON.stringify(collectedGrids), id]);
                recoveredCount++;
                console.log(`   💾 Updated entry ${id}`);
            } else {
                console.log(`   ❌ No multiple predictions found`);
            }
        }
        
        console.log(`\n🎉 Recovery complete!`);
        console.log(`📊 Processed: ${processedCount} entries`);
        console.log(`🔄 Recovered: ${recoveredCount} entries with multiple predictions`);
        
    } catch (error) {
        console.error('❌ Recovery failed:', error);
    } finally {
        await pool.end();
    }
}

// Check if we have database access
if (!process.env.DATABASE_URL && !process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set, using default localhost connection');
}

main().catch(console.error);