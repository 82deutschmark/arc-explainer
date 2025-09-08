console.log('🔍 Starting simple data recovery test...');

import * as fs from 'fs/promises';
import * as path from 'path';

async function testBasics() {
  try {
    // Test 1: Check if we can read the explained directory
    const explainedDir = path.join('data', 'explained');
    const files = await fs.readdir(explainedDir);
    const rawFiles = files.filter(f => f.endsWith('-raw.json'));
    
    console.log(`✅ Found ${rawFiles.length} raw JSON files`);
    console.log(`📂 First 5 files:`, rawFiles.slice(0, 5));
    
    // Test 2: Try to import the recovery module  
    const { parseRawFilename } = await import('./server/dataRecovery.js');
    console.log('✅ Successfully imported recovery functions');
    
    // Test 3: Test filename parsing
    const testFilename = rawFiles[0];
    if (testFilename) {
      const parsed = parseRawFilename(testFilename);
      console.log(`✅ Parsed "${testFilename}":`, parsed);
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

testBasics();