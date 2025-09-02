/**
 * Configurable dataset import script for ARC puzzle collections
 * 
 * Supports importing datasets from any GitHub repository with configurable patterns.
 * Built on the foundation of importArcHeavy.js but generalized for reusability.
 * 
 * Usage: 
 *   node scripts/importDataset.js --config configs/arc-heavy.json
 *   node scripts/importDataset.js --config configs/arc-mini.json --dry-run
 * 
 * @author Cascade (Phase 2 implementation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration for backward compatibility
const DEFAULT_CONFIG = {
  name: 'ARC-Heavy',
  description: 'ARC-Heavy dataset from neoneye/arc-dataset-collection',
  source: {
    type: 'github',
    repo: 'neoneye/arc-dataset-collection',
    path: '/dataset/ARC-Heavy/data/b',
    branch: 'main'
  },
  files: {
    pattern: 'data_suggestfunction_100k_task{0-299}.json',
    count: 300,
    startIndex: 0,
    endIndex: 299
  },
  output: {
    directory: 'arc-heavy',
    namePattern: 'task_{index}.json',
    sourceType: 'ARC-Heavy'
  },
  validation: {
    validateARCFormat: true,
    requireTrainTest: true,
    minExamples: 1
  }
};

// Command line argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    configFile: null,
    dryRun: false,
    verbose: false,
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        options.configFile = args[i + 1];
        i++;
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        if (args[i].startsWith('--')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
ARC Dataset Import Tool

Usage: node scripts/importDataset.js [options]

Options:
  -c, --config <file>     Configuration file (JSON)
  -d, --dry-run           Show what would be imported without downloading
  -v, --verbose           Verbose output  
  -f, --force             Force overwrite existing files
  -h, --help              Show this help message

Configuration File Format:
{
  "name": "Dataset Name",
  "description": "Description of dataset",
  "source": {
    "type": "github",
    "repo": "username/repository", 
    "path": "/path/to/files",
    "branch": "main"
  },
  "files": {
    "pattern": "file_pattern_{0-299}.json",
    "count": 300,
    "startIndex": 0,
    "endIndex": 299
  },
  "output": {
    "directory": "output-directory",
    "namePattern": "task_{index}.json",
    "sourceType": "Dataset-Name"
  }
}

Examples:
  node scripts/importDataset.js --config configs/arc-heavy.json
  node scripts/importDataset.js --config configs/custom.json --dry-run
  node scripts/importDataset.js --config configs/arc-mini.json --verbose
`);
}

/**
 * Load and validate configuration
 */
function loadConfig(configFile) {
  let config;
  
  if (configFile) {
    const configPath = path.resolve(configFile);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${error.message}`);
    }
  } else {
    // Use default ARC-Heavy config for backward compatibility
    config = DEFAULT_CONFIG;
    console.log('No configuration file specified, using default ARC-Heavy configuration');
  }

  // Validate required fields
  const required = ['name', 'source', 'files', 'output'];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Configuration missing required field: ${field}`);
    }
  }

  return config;
}

/**
 * Generate URLs based on configuration
 */
function generateUrls(config) {
  const urls = [];
  const { source, files } = config;
  
  if (source.type !== 'github') {
    throw new Error('Only GitHub sources are currently supported');
  }

  const baseUrl = `https://raw.githubusercontent.com/${source.repo}/${source.branch || 'main'}${source.path}`;
  
  for (let i = files.startIndex; i <= files.endIndex; i++) {
    const sourceFilename = files.pattern.replace(/\{(\d+)-(\d+)\}/, i.toString());
    const url = `${baseUrl}/${sourceFilename}`;
    urls.push({ index: i, url, sourceFilename });
  }
  
  return urls;
}

/**
 * Generate output paths based on configuration
 */
function generateOutputPaths(config) {
  const outputDir = path.join(process.cwd(), 'data', config.output.directory);
  const paths = [];
  
  for (let i = config.files.startIndex; i <= config.files.endIndex; i++) {
    const filename = config.output.namePattern.replace('{index}', i.toString());
    const fullPath = path.join(outputDir, filename);
    paths.push({ index: i, path: fullPath, filename });
  }
  
  return { outputDir, paths };
}

/**
 * Validate ARC task format
 */
function validateARCTask(data, taskId, config) {
  if (!config.validation?.validateARCFormat) {
    return true;
  }

  if (!data.train || !Array.isArray(data.train)) {
    throw new Error(`Task ${taskId}: Missing or invalid train array`);
  }
  
  if (!data.test || !Array.isArray(data.test)) {
    throw new Error(`Task ${taskId}: Missing or invalid test array`);
  }

  const minExamples = config.validation?.minExamples || 1;
  if (data.train.length < minExamples) {
    throw new Error(`Task ${taskId}: Insufficient training examples (${data.train.length} < ${minExamples})`);
  }

  if (config.validation?.requireTrainTest && data.test.length === 0) {
    throw new Error(`Task ${taskId}: No test examples provided`);
  }
  
  // Validate that each example has input and output arrays
  [...data.train, ...data.test].forEach((example, index) => {
    if (!example.input || !Array.isArray(example.input)) {
      throw new Error(`Task ${taskId}: Example ${index} missing input array`);
    }
    if (!example.output || !Array.isArray(example.output)) {
      throw new Error(`Task ${taskId}: Example ${index} missing output array`);
    }
    
    // Validate 2D arrays of numbers
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
 * Download a single file
 */
async function downloadFile(urlInfo, outputInfo, config, options) {
  const { index, url, sourceFilename } = urlInfo;
  const { path: outputPath, filename } = outputInfo;
  
  try {
    if (options.verbose) {
      console.log(`Downloading task ${index}: ${sourceFilename}`);
    }
    
    if (options.dryRun) {
      console.log(`[DRY RUN] Would download: ${url} -> ${outputPath}`);
      return { success: true, skipped: true };
    }

    // Check if file exists and not forcing overwrite
    if (fs.existsSync(outputPath) && !options.force) {
      if (options.verbose) {
        console.log(`✓ Task ${index} already exists, skipping`);
      }
      return { success: true, skipped: true };
    }
    
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
    
    // Validate the puzzle format
    validateARCTask(data, index, config);
    
    // Add import metadata if configured
    if (config.output.addMetadata) {
      data._import = {
        source: config.name,
        imported: new Date().toISOString(),
        originalUrl: url,
        originalFilename: sourceFilename
      };
    }
    
    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    if (options.verbose) {
      console.log(`✓ Task ${index} saved successfully`);
    }
    
    return { success: true };
    
  } catch (error) {
    const errorMsg = `✗ Task ${index} failed: ${error.message}`;
    console.error(errorMsg);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importDataset(config, options) {
  console.log(`Starting import of ${config.name}`);
  console.log(`Description: ${config.description || 'No description'}`);
  console.log(`Source: ${config.source.repo}${config.source.path}`);
  
  if (options.dryRun) {
    console.log('\n🧪 DRY RUN MODE - No files will be downloaded');
  }
  
  console.log('');
  
  const urls = generateUrls(config);
  const { outputDir, paths } = generateOutputPaths(config);
  
  // Create output directory
  if (!options.dryRun) {
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  
  const startTime = Date.now();
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Process in batches to avoid overwhelming the server
  const BATCH_SIZE = 10;
  const DELAY_MS = 100;
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = [];
    const endIndex = Math.min(i + BATCH_SIZE, urls.length);
    
    // Create batch of promises
    for (let j = i; j < endIndex; j++) {
      batch.push(downloadFile(urls[j], paths[j], config, options));
    }
    
    // Process batch
    const results = await Promise.all(batch);
    
    // Count results
    results.forEach((result, index) => {
      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
        errors.push({ index: i + index, error: result.error });
      }
    });
    
    // Progress update
    const completed = Math.min(endIndex, urls.length);
    const progress = ((completed / urls.length) * 100).toFixed(1);
    console.log(`Progress: ${completed}/${urls.length} (${progress}%)`);
    
    // Small delay between batches
    if (endIndex < urls.length && !options.dryRun) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log('');
  console.log('='.repeat(50));
  console.log('Import Summary');
  console.log('='.repeat(50));
  console.log(`Dataset: ${config.name}`);
  console.log(`Total files: ${urls.length}`);
  console.log(`Downloaded: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Duration: ${duration}s`);
  
  if (!options.dryRun) {
    console.log(`Output directory: ${outputDir}`);
  }
  
  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    errors.forEach(({ index, error }) => {
      console.log(`  Task ${index}: ${error}`);
    });
  }
  
  if (options.dryRun) {
    console.log('');
    console.log('🧪 Dry run completed successfully!');
    console.log('Run without --dry-run to perform actual import.');
  } else if (successCount === urls.length) {
    console.log('');
    console.log('🎉 All files imported successfully!');
    console.log(`${config.name} puzzles are now available in the puzzle browser.`);
  } else if (successCount > 0) {
    console.log('');
    console.log(`⚠️  Partial success: ${successCount} files imported.`);
  } else {
    console.log('');
    console.log('❌ Import failed completely.');
  }
  
  return {
    success: errorCount === 0,
    total: urls.length,
    downloaded: successCount,
    skipped: skipCount,
    failed: errorCount,
    errors
  };
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArguments();
    const config = loadConfig(options.configFile);
    
    await importDataset(config, options);
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});