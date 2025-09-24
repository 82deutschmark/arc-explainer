/**
 * Author: Cascade (using Gemini 2.5 Pro)
 * Date: 2025-09-24
 * PURPOSE: This script is the entry point for the data recovery process. It parses command-line arguments
 * and calls the recoveryService to perform the actual recovery, acting as a simple orchestrator.
 * SRP and DRY check: Pass - This file has a single responsibility: to start the recovery process based on command-line inputs.
 */

/**
 * Parses a raw filename into its components
 * @param filename The raw filename to parse (e.g., '12345678-raw.json')
 * @returns An object containing the parsed components or null if parsing fails
 */
export function parseRawFilename(filename: string): { puzzleId: string; timestamp: string; } | null {
  // Example format: 12345678-raw.json or 12345678-20230101-raw.json
  const match = filename.match(/^(\d+)(?:-(\d+))?-raw\.json$/);
  
  if (!match) {
    return null;
  }
  
  return {
    puzzleId: match[1],
    timestamp: match[2] || ''
  };
}

import 'dotenv/config';
import { recoveryService } from './services/recoveryService.js';

// This function can be local as it's only for display here.
function printStats(stats: any): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RECOVERY STATISTICS');
  console.log('='.repeat(50));
  console.log(`Total files found: ${stats.totalFiles}`);
  console.log(`Skipped duplicates: ${stats.skippedDuplicates}`);
  console.log(`Recovered records: ${stats.recoveredRecords}`);
  console.log(`Failed records: ${stats.failedRecords}`);
  console.log(`Successfully processed: ${stats.processedFiles.length}`);
  
  if (stats.failedFiles && stats.failedFiles.length > 0) {
    console.log(`\n❌ Failed files:`);
    stats.failedFiles.forEach((filename: string) => console.log(`  - ${filename}`));
  }
  
  console.log('='.repeat(50));
}

const isNonInteractive = process.argv.includes('--non-interactive');

recoveryService.processRecovery(isNonInteractive)
  .then(stats => {
    if (stats) {
      printStats(stats);
    }
    console.log('✅ Recovery process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Recovery process failed:', error);
    process.exit(1);
  });