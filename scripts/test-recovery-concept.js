/**
 * Simple test script to validate the recovery concept
 * Tests file matching and data extraction without database dependencies
 * 
 * @author Claude Code
 * @date 2025-01-09
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data', 'explained');

// Simple utility functions (matching CommonUtilities.ts)
function safeJsonStringify(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn(`Failed to stringify JSON: ${error.message}`);
    return null;
  }
}

function normalizeConfidence(confidence) {
  if (confidence === null || confidence === undefined) return 50;
  if (typeof confidence === 'number') {
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence);
    return isNaN(parsed) ? 50 : Math.max(0, Math.min(100, Math.round(parsed)));
  }
  return 50;
}

async function testRecoveryConcept() {
  console.log('🧪 Testing OpenRouter Recovery Concept');
  console.log('');
  
  try {
    // Get all files
    const allFiles = await readdir(DATA_DIR);
    const rawFiles = allFiles.filter(filename => filename.endsWith('-raw.json'));
    
    console.log(`Found ${rawFiles.length} raw response files`);
    
    // Look for parse error indicators and OpenRouter models
    let truncatedFound = 0;
    let recoverableFound = 0;
    
    const parseErrorFiles = rawFiles.filter(filename => 
      filename.includes('qwen') || 
      filename.includes('llama') || 
      filename.includes('cohere') ||
      filename.includes('mistral') ||
      filename.includes('ernie') ||
      filename.includes('x-ai') ||
      filename.includes('moonshot')
    );
    
    console.log(`Found ${parseErrorFiles.length} OpenRouter-model files`);
    console.log('');
    
    // Test a few files
    for (let i = 0; i < Math.min(5, parseErrorFiles.length); i++) {
      const filename = parseErrorFiles[i];
      console.log(`Testing file: ${filename}`);
      
      try {
        const rawFilePath = join(DATA_DIR, filename);
        const rawContent = await readFile(rawFilePath, 'utf8');
        const rawResponse = JSON.parse(rawContent);
        
        // Check if this looks like a truncated response
        const hasParseError = rawResponse.parseError || 
          (rawResponse.patternDescription && rawResponse.patternDescription.includes('PARSE ERROR')) ||
          (rawResponse.solvingStrategy && rawResponse.solvingStrategy.includes('PARSE ERROR'));
        
        const outputTokens = rawResponse.outputTokens || 0;
        const hasContent = rawResponse.patternDescription && rawResponse.solvingStrategy;
        const contentLength = (rawResponse.patternDescription || '').length + (rawResponse.solvingStrategy || '').length;
        
        console.log(`  Parse Error: ${hasParseError ? '❌' : '✅'}`);
        console.log(`  Output Tokens: ${outputTokens}`);
        console.log(`  Content Length: ${contentLength} chars`);
        console.log(`  Has Prediction: ${!!rawResponse.predictedOutput ? '✅' : '❌'}`);
        console.log(`  Has Reasoning: ${(rawResponse.reasoningItems && rawResponse.reasoningItems.length > 0) ? '✅' : '❌'}`);
        
        if (hasParseError) {
          truncatedFound++;
          console.log(`  🔍 TRUNCATED - This file shows parse errors`);
          
          // Show the error details
          if (rawResponse.solvingStrategy && rawResponse.solvingStrategy.includes('PARSE ERROR')) {
            const errorMatch = rawResponse.solvingStrategy.match(/Raw response preview: "(.*?)"/);
            if (errorMatch) {
              console.log(`  📄 Response preview: ${errorMatch[1].substring(0, 200)}...`);
            }
          }
        } else if (hasContent && contentLength > 500) {
          recoverableFound++;
          console.log(`  ✅ RECOVERABLE - This file has complete data`);
          
          // Test data extraction
          const recoveryData = {
            pattern_description: rawResponse.patternDescription,
            solving_strategy: rawResponse.solvingStrategy,
            hints: Array.isArray(rawResponse.hints) ? rawResponse.hints : [],
            confidence: normalizeConfidence(rawResponse.confidence),
            output_tokens: rawResponse.outputTokens,
            predicted_output_grid: safeJsonStringify(rawResponse.predictedOutput),
            reasoning_items: safeJsonStringify(rawResponse.reasoningItems)
          };
          
          console.log(`  📊 Recovery data fields: ${Object.keys(recoveryData).length}`);
          console.log(`  📝 Pattern desc: ${recoveryData.pattern_description?.substring(0, 100)}...`);
        }
        
        console.log('');
        
      } catch (error) {
        console.error(`  ❌ Error reading ${filename}: ${error.message}`);
      }
    }
    
    console.log('📊 Test Summary:');
    console.log(`  Total raw files: ${rawFiles.length}`);
    console.log(`  OpenRouter files tested: ${Math.min(5, parseErrorFiles.length)}`);
    console.log(`  Truncated responses found: ${truncatedFound}`);
    console.log(`  Recoverable responses found: ${recoverableFound}`);
    
    if (truncatedFound > 0 && recoverableFound > 0) {
      console.log('');
      console.log('✅ RECOVERY CONCEPT VALIDATED!');
      console.log('   Both truncated and complete responses found.');
      console.log('   The full recovery script should work properly.');
    } else if (recoverableFound > 0) {
      console.log('');
      console.log('⚠️  Only complete responses found - no truncation detected in sample.');
    } else {
      console.log('');
      console.log('❌ No clear truncation pattern found in sample.');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testRecoveryConcept();