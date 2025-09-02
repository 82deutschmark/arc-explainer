/**
 * Import script for ARC-Heavy dataset from neoneye/arc-dataset-collection
 * 
 * Downloads 300 puzzle files from GitHub and saves them locally to data/arc-heavy/
 * Files are named task_0.json to task_299.json for consistency
 * 
 * Usage: node scripts/importArcHeavy.js
 * 
 * @author Cascade
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'https://raw.githubusercontent.com/neoneye/arc-dataset-collection/main/dataset/ARC-Heavy/data/b';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'arc-heavy');
const TOTAL_TASKS = 300;

// Progress tracking
let successCount = 0;
let errorCount = 0;
const errors = [];

/**
 * Create the output directory if it doesn't exist
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Creating directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  } else {
    console.log(`Directory exists: ${OUTPUT_DIR}`);
  }
}

/**
 * Validate that the downloaded JSON is a valid ARC task
 */
function validateARCTask(data, taskId) {
  if (!data.train || !Array.isArray(data.train)) {
    throw new Error(`Task ${taskId}: Missing or invalid train array`);
  }
  
  if (!data.test || !Array.isArray(data.test)) {
    throw new Error(`Task ${taskId}: Missing or invalid test array`);
  }
  
  // Check that each example has input and output
  [...data.train, ...data.test].forEach((example, index) => {
    if (!example.input || !Array.isArray(example.input)) {
      throw new Error(`Task ${taskId}: Example ${index} missing input array`);
    }
    if (!example.output || !Array.isArray(example.output)) {
      throw new Error(`Task ${taskId}: Example ${index} missing output array`);
    }
    
    // Validate that input/output are 2D arrays of numbers
    if (!example.input.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'number'))) {
      throw new Error(`Task ${taskId}: Example ${index} input must be 2D array of numbers`);
    }
    if (!example.output.every(row => Array.isArray(row) && row.every(cell => typeof cell === 'number'))) {
      throw new Error(`Task ${taskId}: Example ${index} output must be 2D array of numbers`);
    }
  });
  
  return true;
}

/**
 * Download a single task file
 */
async function downloadTask(taskIndex) {
  const sourceFilename = `data_suggestfunction_100k_task${taskIndex}.json`;
  const targetFilename = `task_${taskIndex}.json`;
  const url = `${BASE_URL}/${sourceFilename}`;
  const outputPath = path.join(OUTPUT_DIR, targetFilename);
  
  try {
    console.log(`Downloading task ${taskIndex}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`JSON parse error: ${parseError.message}`);
    }
    
    // Validate the ARC task format
    validateARCTask(data, taskIndex);
    
    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    successCount++;
    console.log(`✓ Task ${taskIndex} saved successfully`);
    
  } catch (error) {
    errorCount++;
    const errorMsg = `✗ Task ${taskIndex} failed: ${error.message}`;
    console.error(errorMsg);
    errors.push({ taskIndex, error: error.message });
  }
}

/**
 * Download all tasks with rate limiting
 */
async function downloadAllTasks() {
  console.log(`Starting download of ${TOTAL_TASKS} ARC-Heavy tasks...`);
  console.log(`Source: ${BASE_URL}`);
  console.log(`Target: ${OUTPUT_DIR}`);
  console.log('');
  
  const startTime = Date.now();
  
  // Process in batches to avoid overwhelming the server
  const BATCH_SIZE = 10;
  const DELAY_MS = 100; // Small delay between requests
  
  for (let i = 0; i < TOTAL_TASKS; i += BATCH_SIZE) {
    const batch = [];
    const endIndex = Math.min(i + BATCH_SIZE, TOTAL_TASKS);
    
    // Create batch of promises
    for (let j = i; j < endIndex; j++) {
      batch.push(downloadTask(j));
    }
    
    // Process batch
    await Promise.all(batch);
    
    // Progress update
    const completed = Math.min(endIndex, TOTAL_TASKS);
    const progress = ((completed / TOTAL_TASKS) * 100).toFixed(1);
    console.log(`Progress: ${completed}/${TOTAL_TASKS} (${progress}%)`);
    
    // Small delay between batches
    if (endIndex < TOTAL_TASKS) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log('');
  console.log('='.repeat(50));
  console.log('Import Summary');
  console.log('='.repeat(50));
  console.log(`Total tasks: ${TOTAL_TASKS}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    errors.forEach(({ taskIndex, error }) => {
      console.log(`  Task ${taskIndex}: ${error}`);
    });
  }
  
  if (successCount === TOTAL_TASKS) {
    console.log('');
    console.log('🎉 All tasks imported successfully!');
    console.log('ARC-Heavy puzzles are now available in the puzzle browser.');
  } else if (successCount > 0) {
    console.log('');
    console.log(`⚠️  Partial success: ${successCount} tasks imported.`);
    console.log('You may want to retry the failed tasks or check the error messages above.');
  } else {
    console.log('');
    console.log('❌ Import failed completely. Check your internet connection and try again.');
  }
}

/**
 * Main function
 */
async function main() {
  try {
    ensureOutputDir();
    await downloadAllTasks();
  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});