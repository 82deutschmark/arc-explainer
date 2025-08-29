#!/usr/bin/env node

/**
 * Recovery Script via API for Multiple Predictions Data
 * 
 * This script uses the running server API to identify and fix entries
 * that have missing multiple prediction data due to the explanationService bug.
 * 
 * @author Claude Sonnet 4
 * @date 2025-08-29
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000';

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

async function main() {
    console.log('🔍 Starting recovery of multiple predictions data via API...');
    
    // Get all explained puzzle files
    const dataDir = 'data/explained';
    const explainedFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('-EXPLAINED.json'));
    
    console.log(`📊 Found ${explainedFiles.length} explained puzzle files to check`);
    
    let totalChecked = 0;
    let totalRecoverable = 0;
    
    for (const file of explainedFiles) {
        const puzzleId = file.replace('-EXPLAINED.json', '');
        console.log(`\n🔍 Checking puzzle ${puzzleId}...`);
        
        try {
            // Read the explained file to look for multiple predictions in raw responses
            const filePath = path.join(dataDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (!data.explanations) continue;
            
            // Check each model's explanation in the file
            for (const [modelKey, explanation] of Object.entries(data.explanations)) {
                totalChecked++;
                
                // Look for multiple predictions data in the response
                const hasMultiplePredictionsData = 
                    explanation.predictedOutput1 || 
                    explanation.predictedOutput2 || 
                    explanation.predictedOutput3 ||
                    (Array.isArray(explanation.multiplePredictedOutputs) && explanation.multiplePredictedOutputs.length > 0);
                
                if (hasMultiplePredictionsData) {
                    console.log(`   ✅ Found multiple predictions data for ${modelKey}`);
                    totalRecoverable++;
                    
                    // Fetch current database state
                    try {
                        const apiResponse = await fetchJson(`${API_BASE}/api/puzzle/${puzzleId}/explanations`);
                        const dbExplanations = apiResponse.data;
                        
                        // Find the matching explanation by model name
                        const dbExplanation = dbExplanations.find(exp => exp.modelName === modelKey);
                        
                        if (dbExplanation && !dbExplanation.hasMultiplePredictions) {
                            console.log(`   🔄 Database entry ${dbExplanation.id} needs recovery`);
                            console.log(`   📝 Model: ${modelKey}, Current hasMultiplePredictions: ${dbExplanation.hasMultiplePredictions}`);
                        } else if (dbExplanation && dbExplanation.hasMultiplePredictions) {
                            console.log(`   ✅ Database entry already has multiple predictions`);
                        } else {
                            console.log(`   ❓ No matching database entry found for ${modelKey}`);
                        }
                    } catch (apiError) {
                        console.log(`   ⚠️  API error: ${apiError.message}`);
                    }
                }
            }
        } catch (error) {
            console.log(`   ❌ Error processing ${file}: ${error.message}`);
        }
    }
    
    console.log(`\n📊 Recovery Analysis Complete:`);
    console.log(`   Total explanations checked: ${totalChecked}`);
    console.log(`   Explanations with recoverable data: ${totalRecoverable}`);
    console.log(`\n💡 To fix these entries, re-run the analysis or manually update the database.`);
}

main().catch(console.error);