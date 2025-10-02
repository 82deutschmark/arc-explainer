/**
 * HuggingFace Import Cleanup Script
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-01
 * PURPOSE: Removes corrupted/incorrect HuggingFace dataset imports from the explanations table.
 *          This script identifies and deletes entries that were created by the ingestion script
 *          based on model name patterns and other identifying characteristics.
 * 
 * SRP/DRY check: Pass - Single responsibility (cleanup), reuses repository services
 * 
 * SAFETY: Includes dry-run mode and confirmation prompts to prevent accidental deletion
 */

import dotenv from 'dotenv';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { getPool } from '../repositories/base/BaseRepository.ts';
import readline from 'readline';

// Load environment variables
dotenv.config();

interface CleanupConfig {
  dryRun: boolean;
  verbose: boolean;
  modelPattern?: string;
  promptTemplateId?: string;
  skipConfirmation: boolean;
}

interface CleanupProgress {
  totalFound: number;
  deleted: number;
  failed: number;
  deletedIds: number[];
}

/**
 * Create readline interface for user confirmation
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask user for confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Find all HuggingFace import entries
 */
async function findHuggingFaceEntries(config: CleanupConfig): Promise<any[]> {
  console.log('🔍 Searching for HuggingFace import entries...\n');
  
  const pool = getPool();
  if (!pool) {
    throw new Error('Database pool not available');
  }
  
  // Query to find all entries that match HuggingFace import patterns
  const query = `
    SELECT 
      id,
      puzzle_id,
      model_name,
      prompt_template_id,
      created_at,
      is_prediction_correct,
      multi_test_all_correct,
      has_multiple_predictions
    FROM explanations
    WHERE 
      prompt_template_id IN ('external-huggingface','externalHuggingFace')
      ${config.modelPattern ? `AND model_name LIKE $1` : ''}
    ORDER BY created_at DESC
  `;
  
  const params = config.modelPattern ? [`%${config.modelPattern}%`] : [];
  
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error: any) {
    console.error('❌ Error querying database:', error.message);
    throw error;
  }
}

/**
 * Delete a single explanation entry
 */
async function deleteEntry(id: number, config: CleanupConfig): Promise<boolean> {
  if (config.dryRun) {
    return true; // Simulate success in dry-run mode
  }
  
  const pool = getPool();
  if (!pool) {
    console.error('   ❌ Database pool not available');
    return false;
  }
  
  try {
    const query = `DELETE FROM explanations WHERE id = $1`;
    await pool.query(query, [id]);
    return true;
  } catch (error: any) {
    console.error(`   ❌ Failed to delete entry ${id}: ${error.message}`);
    return false;
  }
}

/**
 * Main cleanup function
 */
async function cleanupHuggingFaceImports(config: CleanupConfig): Promise<void> {
  console.log('\n🧹 HuggingFace Import Cleanup Script\n');
  console.log(`Mode: ${config.dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE (will delete entries)'}`);
  console.log(`Model Pattern: ${config.modelPattern || 'All HuggingFace imports'}`);
  console.log(`Verbose: ${config.verbose ? 'Yes' : 'No'}\n`);
  
  // Initialize database connection
  console.log('🔌 Connecting to database...');
  const dbConnected = await repositoryService.initialize();
  
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Check your DATABASE_URL environment variable.');
    process.exit(1);
  }
  
  console.log('✅ Database connected\n');
  
  // Find all matching entries
  const entries = await findHuggingFaceEntries(config);
  
  if (entries.length === 0) {
    console.log('✅ No HuggingFace import entries found. Database is clean!\n');
    return;
  }
  
  console.log(`Found ${entries.length} HuggingFace import entries:\n`);
  
  // Group by model name for summary
  const byModel = new Map<string, number>();
  entries.forEach(entry => {
    const count = byModel.get(entry.model_name) || 0;
    byModel.set(entry.model_name, count + 1);
  });
  
  console.log('📊 Breakdown by model:');
  for (const [modelName, count] of byModel.entries()) {
    console.log(`   - ${modelName}: ${count} entries`);
  }
  console.log('');
  
  // Show sample entries if verbose
  if (config.verbose && entries.length > 0) {
    console.log('📝 Sample entries (first 5):');
    entries.slice(0, 5).forEach(entry => {
      console.log(`   ID: ${entry.id} | Puzzle: ${entry.puzzle_id} | Model: ${entry.model_name} | Created: ${entry.created_at}`);
    });
    console.log('');
  }
  
  // Confirmation prompt (unless skipped)
  if (!config.dryRun && !config.skipConfirmation) {
    console.log('⚠️  WARNING: This will permanently delete these entries from the database!');
    const confirmed = await confirm(`\nAre you sure you want to delete ${entries.length} entries? (y/N): `);
    
    if (!confirmed) {
      console.log('\n❌ Cleanup cancelled by user.\n');
      return;
    }
    console.log('');
  }
  
  // Delete entries
  const progress: CleanupProgress = {
    totalFound: entries.length,
    deleted: 0,
    failed: 0,
    deletedIds: []
  };
  
  console.log(`${config.dryRun ? '🔍 Simulating' : '🗑️  Deleting'} ${entries.length} entries...\n`);
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (config.verbose) {
      console.log(`[${i + 1}/${entries.length}] ${config.dryRun ? 'Would delete' : 'Deleting'} ID ${entry.id} (${entry.puzzle_id} - ${entry.model_name})`);
    }
    
    const success = await deleteEntry(entry.id, config);
    
    if (success) {
      progress.deleted++;
      progress.deletedIds.push(entry.id);
    } else {
      progress.failed++;
    }
    
    // Progress update every 50 entries
    if ((i + 1) % 50 === 0) {
      console.log(`   Progress: ${i + 1}/${entries.length} processed (${progress.deleted} deleted, ${progress.failed} failed)`);
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total entries found: ${progress.totalFound}`);
  console.log(`${config.dryRun ? 'Would delete' : 'Successfully deleted'}: ${progress.deleted}`);
  console.log(`Failed: ${progress.failed}`);
  
  if (config.dryRun) {
    console.log('\n💡 This was a DRY RUN. No changes were made to the database.');
    console.log('   Run without --dry-run to actually delete these entries.');
  } else {
    console.log('\n✅ Cleanup complete!');
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Parse command line arguments
 */
function parseArgs(): CleanupConfig {
  const args = process.argv.slice(2);
  
  const config: CleanupConfig = {
    dryRun: true, // Default to dry-run for safety
    verbose: false,
    modelPattern: undefined,
    promptTemplateId: 'externalHuggingFace',
    skipConfirmation: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '--model-pattern' && i + 1 < args.length) {
      config.modelPattern = args[++i];
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--live') {
      config.dryRun = false;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--yes' || arg === '-y') {
      config.skipConfirmation = true;
      config.dryRun = false; // --yes implies --live
    }
  }
  
  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
🧹 HuggingFace Import Cleanup Script

USAGE:
  npm run cleanup-hf -- [options]

OPTIONS:
  --dry-run                Preview what would be deleted (DEFAULT - safe mode)
  --live                   Actually delete entries (requires confirmation)
  --model-pattern <text>   Only delete entries where model_name contains this text
                           Example: --model-pattern "attempt" or --model-pattern "claude-sonnet"
  --verbose                Show detailed information about each entry
  --yes, -y                Skip confirmation prompt (use with caution!)
  --help                   Show this help message

EXAMPLES:
  # Safe preview - see what would be deleted
  npm run cleanup-hf -- --dry-run --verbose

  # Delete all HuggingFace imports (with confirmation)
  npm run cleanup-hf -- --live

  # Delete only entries matching a specific model pattern
  npm run cleanup-hf -- --live --model-pattern "claude-sonnet-4-5"

  # Delete all without confirmation (DANGEROUS!)
  npm run cleanup-hf -- --live --yes

SAFETY:
  - Script defaults to DRY RUN mode (--dry-run)
  - Requires explicit --live flag to actually delete
  - Shows confirmation prompt before deletion (unless --yes is used)
  - Only targets entries with prompt_template_id IN ('external-huggingface','externalHuggingFace')

WHAT IT DELETES:
  - All explanations entries created by the HuggingFace ingestion script
  - Identified by prompt_template_id IN ('external-huggingface','externalHuggingFace')
  - Optionally filtered by model name pattern
  `);
}

// Run the script
const config = parseArgs();
cleanupHuggingFaceImports(config).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
