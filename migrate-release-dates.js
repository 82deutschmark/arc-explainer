#!/usr/bin/env node

/**
 * Migration script to add release dates from modelConfigs.json to models.ts
 * 
 * This script:
 * 1. Parses modelConfigs.json to extract release dates
 * 2. Finds matching models in models.ts by key field
 * 3. Inserts releaseDate property in the appropriate location
 * 4. Maintains exact formatting and indentation
 */

import fs from 'fs';
import path from 'path';

const CONFIG_DIR = './server/config';
const JSON_FILE = path.join(CONFIG_DIR, 'modelConfigs.json');
const TS_FILE = path.join(CONFIG_DIR, 'models.ts');
const BACKUP_FILE = path.join(CONFIG_DIR, 'models.ts.backup');

function createBackup() {
  console.log('📁 Creating backup...');
  fs.copyFileSync(TS_FILE, BACKUP_FILE);
  console.log(`✅ Backup created: ${BACKUP_FILE}`);
}

function extractReleaseDates() {
  console.log('📊 Extracting release dates from JSON...');
  const jsonContent = fs.readFileSync(JSON_FILE, 'utf8');
  const config = JSON.parse(jsonContent);
  
  const releaseDates = new Map();
  let modelsWithDates = 0;
  
  config.models.forEach(model => {
    if (model.releaseDate) {
      releaseDates.set(model.key, model.releaseDate);
      modelsWithDates++;
    }
  });
  
  console.log(`✅ Found ${modelsWithDates} models with release dates`);
  return releaseDates;
}

function migrateTSFile(releaseDates, dryRun = false) {
  console.log(`🔄 ${dryRun ? 'Previewing' : 'Applying'} changes to TypeScript file...`);
  
  let tsContent = fs.readFileSync(TS_FILE, 'utf8');
  let modificationsCount = 0;
  const changes = [];
  
  // Split content by model objects using the opening brace pattern
  const models = tsContent.split(/(?=\s*{\s*\n?\s*key:)/);
  
  for (const [modelKey, releaseDate] of releaseDates) {
    // Find the model section that contains this key
    let modelIndex = -1;
    let modelSection = '';
    
    for (let i = 0; i < models.length; i++) {
      if (models[i].includes(`key: '${modelKey}'`) || models[i].includes(`key: "${modelKey}"`)) {
        modelIndex = i;
        modelSection = models[i];
        break;
      }
    }
    
    if (modelIndex === -1) {
      console.log(`⚠️  Could not find model ${modelKey} in TypeScript file`);
      continue;
    }
    
    // Check if releaseDate already exists
    if (modelSection.includes('releaseDate:')) {
      console.log(`⚠️  Model ${modelKey} already has releaseDate, skipping`);
      continue;
    }
    
    // Find the closing brace of this model object
    let braceCount = 0;
    let inObject = false;
    let closingBraceIndex = -1;
    
    for (let i = 0; i < modelSection.length; i++) {
      const char = modelSection[i];
      if (char === '{') {
        braceCount++;
        inObject = true;
      } else if (char === '}') {
        braceCount--;
        if (inObject && braceCount === 0) {
          closingBraceIndex = i;
          break;
        }
      }
    }
    
    if (closingBraceIndex === -1) {
      console.log(`⚠️  Could not find closing brace for ${modelKey}`);
      continue;
    }
    
    // Get the content before the closing brace
    const beforeBrace = modelSection.substring(0, closingBraceIndex);
    const afterBrace = modelSection.substring(closingBraceIndex);
    
    // Find the last property line to determine indentation
    const lines = beforeBrace.split('\n');
    let insertAfterLine = -1;
    let baseIndent = '    ';
    
    // Look for contextWindow, maxOutputTokens, or the last property
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.includes('contextWindow:') || line.includes('maxOutputTokens:')) {
        insertAfterLine = i;
        const indentMatch = lines[i].match(/^(\s*)/);
        baseIndent = indentMatch ? indentMatch[1] : '    ';
        break;
      }
      if (line.includes(':') && !line.includes('//') && (line.endsWith(',') || line.endsWith(': {}'))) {
        insertAfterLine = i;
        const indentMatch = lines[i].match(/^(\s*)/);
        baseIndent = indentMatch ? indentMatch[1] : '    ';
      }
    }
    
    if (insertAfterLine !== -1) {
      // Add comma to the previous line if it doesn't have one
      if (!lines[insertAfterLine].trim().endsWith(',')) {
        lines[insertAfterLine] += ',';
      }
      
      // Insert the release date
      lines.splice(insertAfterLine + 1, 0, `${baseIndent}releaseDate: "${releaseDate}"`);
      
      const newModelContent = lines.join('\n') + afterBrace;
      models[modelIndex] = newModelContent;
      
      modificationsCount++;
      changes.push({
        model: modelKey,
        releaseDate: releaseDate,
        action: 'added'
      });
    } else {
      console.log(`⚠️  Could not find insertion point for ${modelKey}`);
    }
  }
  
  // Reconstruct the file
  if (modificationsCount > 0) {
    tsContent = models.join('');
  }
  
  console.log(`\n📋 Summary:`);
  console.log(`   Models processed: ${releaseDates.size}`);
  console.log(`   Modifications made: ${modificationsCount}`);
  
  if (changes.length > 0) {
    console.log(`\n🔍 Changes preview:`);
    changes.forEach(change => {
      console.log(`   ✓ ${change.model} -> releaseDate: "${change.releaseDate}"`);
    });
  }
  
  if (!dryRun && modificationsCount > 0) {
    fs.writeFileSync(TS_FILE, tsContent);
    console.log(`\n✅ TypeScript file updated successfully!`);
    console.log(`📁 Backup available at: ${BACKUP_FILE}`);
  }
  
  return { modificationsCount, changes, content: tsContent };
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateMigration(releaseDates) {
  console.log('\n🔍 Validating migration...');
  const tsContent = fs.readFileSync(TS_FILE, 'utf8');
  
  let validatedCount = 0;
  const missing = [];
  
  for (const [modelKey, releaseDate] of releaseDates) {
    const modelPattern = new RegExp(`key:\\s*['"]${escapeRegex(modelKey)}['"][^}]*?releaseDate:\\s*["']${escapeRegex(releaseDate)}["']`, 's');
    if (modelPattern.test(tsContent)) {
      validatedCount++;
    } else {
      missing.push(modelKey);
    }
  }
  
  console.log(`✅ Validated ${validatedCount}/${releaseDates.size} release dates`);
  
  if (missing.length > 0) {
    console.log(`❌ Missing release dates for: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting release date migration...\n');
    
    // Check if files exist
    if (!fs.existsSync(JSON_FILE)) {
      throw new Error(`JSON file not found: ${JSON_FILE}`);
    }
    if (!fs.existsSync(TS_FILE)) {
      throw new Error(`TypeScript file not found: ${TS_FILE}`);
    }
    
    // Extract release dates from JSON
    const releaseDates = extractReleaseDates();
    
    if (releaseDates.size === 0) {
      console.log('ℹ️  No release dates found in JSON file. Nothing to migrate.');
      return;
    }
    
    // Create backup
    createBackup();
    
    // Dry run first
    console.log('\n🔍 Running dry-run preview...\n');
    const dryRunResult = migrateTSFile(releaseDates, true);
    
    if (dryRunResult.modificationsCount === 0) {
      console.log('ℹ️  No modifications needed. All release dates may already be present.');
      return;
    }
    
    // Confirm with user (in a real scenario, you'd want interactive confirmation)
    console.log('\n❓ Ready to apply changes? The above preview shows what will be modified.');
    console.log('   Proceeding with migration...\n');
    
    // Apply changes
    migrateTSFile(releaseDates, false);
    
    // Validate the migration
    const isValid = validateMigration(releaseDates);
    
    if (isValid) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   All release dates have been added to the TypeScript file.');
    } else {
      console.log('\n⚠️  Migration completed with warnings. Please review the output above.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Stack trace:', error.stack);
    
    // Restore backup if it exists
    if (fs.existsSync(BACKUP_FILE)) {
      console.log('🔄 Restoring from backup...');
      fs.copyFileSync(BACKUP_FILE, TS_FILE);
      console.log('✅ Backup restored.');
    }
    
    process.exit(1);
  }
}

// Run the script
main();