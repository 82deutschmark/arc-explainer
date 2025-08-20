/**
 * Debug script to analyze puzzle loading issues
 * Run this to see exactly what's happening during puzzle loading
 */

import fs from 'fs';
import path from 'path';

const dataSources = [
  {
    name: 'ARC2-Eval',
    directory: path.join(process.cwd(), 'data', 'evaluation2'),
    source: 'ARC2-Eval',
    priority: 1
  },
  {
    name: 'ARC2', 
    directory: path.join(process.cwd(), 'data', 'training2'),
    source: 'ARC2',
    priority: 2
  },
  {
    name: 'ARC1-Eval',
    directory: path.join(process.cwd(), 'data', 'evaluation'),
    source: 'ARC1-Eval', 
    priority: 3
  },
  {
    name: 'ARC1',
    directory: path.join(process.cwd(), 'data', 'training'),
    source: 'ARC1',
    priority: 4
  }
];

const puzzleMetadata = new Map();
const loadingResults = {};

console.log('🔍 Debugging Puzzle Loading Process\n');

// Process directories in priority order
for (const dataSource of dataSources.sort((a, b) => a.priority - b.priority)) {
  console.log(`📁 Processing ${dataSource.name} (priority ${dataSource.priority})`);
  console.log(`   Directory: ${dataSource.directory}`);
  
  if (!fs.existsSync(dataSource.directory)) {
    console.log(`   ❌ Directory not found!`);
    loadingResults[dataSource.name] = { files: 0, loaded: 0, skipped: 0, errors: 0 };
    continue;
  }

  const files = fs.readdirSync(dataSource.directory).filter(file => file.endsWith('.json'));
  console.log(`   Found ${files.length} JSON files`);
  
  let loaded = 0;
  let skipped = 0; 
  let errors = 0;
  const skippedFiles = [];
  const errorFiles = [];

  for (const file of files) {
    try {
      const taskId = file.replace('.json', '');
      
      // Check if already loaded (same logic as puzzle loader)
      if (puzzleMetadata.has(taskId)) {
        skipped++;
        skippedFiles.push(taskId);
        continue;
      }
      
      // Try to parse JSON (same as puzzle loader)
      const filePath = path.join(dataSource.directory, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Validate structure
      if (!data.train || !data.test) {
        errors++;
        errorFiles.push(`${taskId} - Missing train/test`);
        continue;
      }
      
      // Add to metadata (simplified)
      puzzleMetadata.set(taskId, {
        id: taskId,
        source: dataSource.source,
        directory: dataSource.name
      });
      
      loaded++;
    } catch (error) {
      errors++;
      errorFiles.push(`${file} - ${error.message}`);
    }
  }
  
  loadingResults[dataSource.name] = { 
    files: files.length, 
    loaded, 
    skipped, 
    errors,
    skippedFiles: skippedFiles.slice(0, 10), // Show first 10
    errorFiles: errorFiles.slice(0, 5) // Show first 5
  };
  
  console.log(`   ✅ Loaded: ${loaded}`);
  console.log(`   ⏭️  Skipped: ${skipped} (already exists)`);
  console.log(`   ❌ Errors: ${errors}`);
  
  if (skipped > 0) {
    console.log(`   🔍 First few skipped: ${skippedFiles.slice(0, 5).join(', ')}`);
  }
  
  if (errors > 0) {
    console.log(`   🚨 First few errors: ${errorFiles.slice(0, 3).join('; ')}`);
  }
  
  console.log('');
}

console.log('📊 FINAL SUMMARY');
console.log('================');
console.log(`Total puzzles loaded: ${puzzleMetadata.size}`);
console.log('');

for (const [name, results] of Object.entries(loadingResults)) {
  console.log(`${name}:`);
  console.log(`  Files found: ${results.files}`);
  console.log(`  Successfully loaded: ${results.loaded}`);
  console.log(`  Skipped (duplicates): ${results.skipped}`);
  console.log(`  Errors: ${results.errors}`);
  console.log('');
}

// Check for actual file overlaps
console.log('🔍 CHECKING FOR ACTUAL FILE OVERLAPS');
console.log('=====================================');

const filesBySource = {};
for (const dataSource of dataSources) {
  if (fs.existsSync(dataSource.directory)) {
    filesBySource[dataSource.name] = fs.readdirSync(dataSource.directory)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }
}

// Check overlaps between datasets
const pairs = [
  ['ARC2-Eval', 'ARC2'],
  ['ARC2-Eval', 'ARC1-Eval'], 
  ['ARC2-Eval', 'ARC1'],
  ['ARC2', 'ARC1-Eval'],
  ['ARC2', 'ARC1'],
  ['ARC1-Eval', 'ARC1']
];

for (const [source1, source2] of pairs) {
  if (filesBySource[source1] && filesBySource[source2]) {
    const overlap = filesBySource[source1].filter(id => filesBySource[source2].includes(id));
    if (overlap.length > 0) {
      console.log(`❗ ${source1} vs ${source2}: ${overlap.length} overlapping IDs`);
      console.log(`   Examples: ${overlap.slice(0, 5).join(', ')}`);
    } else {
      console.log(`✅ ${source1} vs ${source2}: No overlaps`);
    }
  }
}