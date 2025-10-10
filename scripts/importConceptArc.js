/**
 * 
 * Author: Codex using GPT-5
 * Date: 2025-10-09 19:34:41
 * PURPOSE: Fetch ConceptARC puzzles from neoneye/arc-dataset-collection, validate ARC schema, and persist flattened JSON tasks into data/concept-arc with deterministic filenames and import logging.
 * SRP/DRY check: Pass - Dedicated to ConceptARC ingestion, reusing shared validation patterns without duplicating loader logic.
 * shadcn/ui: Pass - Script operates on backend data only; no UI components involved.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATASET_ROOT = 'dataset/ConceptARC/data';
const CONTENTS_API_BASE = 'https://api.github.com/repos/neoneye/arc-dataset-collection/contents';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/neoneye/arc-dataset-collection/main';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'concept-arc');
const USER_AGENT = 'arc-explainer-conceptarc-import';

// Networking
const baseHeaders = {
  'User-Agent': USER_AGENT,
  Accept: 'application/vnd.github.v3+json'
};

if (process.env.GITHUB_TOKEN) {
  baseHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

/**
 * Ensure output directory exists prior to writing files.
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
 * Validate ARC puzzle structure before persisting.
 */
function validateArcTask(data, taskId) {
  if (!data?.train || !Array.isArray(data.train)) {
    throw new Error(`Task ${taskId}: Missing or invalid train array`);
  }
  if (!data?.test || !Array.isArray(data.test)) {
    throw new Error(`Task ${taskId}: Missing or invalid test array`);
  }

  const examples = [...data.train, ...data.test];
  if (examples.length === 0) {
    throw new Error(`Task ${taskId}: Contains no examples`);
  }

  examples.forEach((example, index) => {
    if (!Array.isArray(example.input) || !Array.isArray(example.output)) {
      throw new Error(`Task ${taskId}: Example ${index} missing input/output arrays`);
    }
    const inputValid = example.input.every(row => Array.isArray(row) && row.every(cell => Number.isInteger(cell)));
    const outputValid = example.output.every(row => Array.isArray(row) && row.every(cell => Number.isInteger(cell)));

    if (!inputValid) {
      throw new Error(`Task ${taskId}: Example ${index} input must be a 2D array of numbers`);
    }
    if (!outputValid) {
      throw new Error(`Task ${taskId}: Example ${index} output must be a 2D array of numbers`);
    }
  });
}

/**
 * Generic helper to call GitHub API with consistent headers and error handling.
 */
async function fetchJson(url) {
  const response = await fetch(url, { headers: baseHeaders });
  if (!response.ok) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    const message = await response.text();
    throw new Error(
      `Request failed for ${url} - ${response.status} ${response.statusText}. Remaining: ${rateLimitRemaining}. Reset: ${rateLimitReset}. Body: ${message}`
    );
  }
  return response.json();
}

/**
 * Recursively walk ConceptARC directories collecting JSON puzzle files.
 */
async function collectConceptArcFiles(relativePath = DATASET_ROOT) {
  const url = `${CONTENTS_API_BASE}/${relativePath}?ref=main`;
  const entries = await fetchJson(url);
  const files = [];

  for (const entry of entries) {
    if (entry.type === 'file' && entry.name.endsWith('.json')) {
      const concept = entry.path.split('/')[3] ?? 'unknown';
      files.push({
        path: entry.path,
        name: entry.name,
        downloadUrl: entry.download_url ?? `${RAW_BASE_URL}/${entry.path}`,
        concept,
        size: entry.size ?? 0
      });
    } else if (entry.type === 'dir') {
      const nested = await collectConceptArcFiles(entry.path);
      files.push(...nested);
    }
  }

  return files;
}

/**
 * Write JSON puzzle to disk if new or changed.
 */
function writePuzzleFile(fileInfo, payload) {
  const outputPath = path.join(OUTPUT_DIR, fileInfo.name);
  const serialized = JSON.stringify(payload, null, 2);

  if (fs.existsSync(outputPath)) {
    const existing = fs.readFileSync(outputPath, 'utf-8');
    if (existing === serialized) {
      return { written: false, outputPath };
    }
  }

  fs.writeFileSync(outputPath, serialized);
  return { written: true, outputPath };
}

/**
 * Download and persist a single ConceptARC puzzle.
 */
async function downloadPuzzle(fileInfo, timestamp) {
  const response = await fetch(fileInfo.downloadUrl, { headers: baseHeaders });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileInfo.downloadUrl}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON parse error for ${fileInfo.name}: ${error.message}`);
  }

  const taskId = fileInfo.name.replace('.json', '');
  validateArcTask(data, taskId);

  // Enrich with import metadata without mutating core puzzle structure
  const enriched = {
    ...data,
    _import: {
      source: 'ConceptARC',
      repository: 'neoneye/arc-dataset-collection',
      concept: fileInfo.concept,
      originalPath: fileInfo.path,
      imported: timestamp
    }
  };

  return writePuzzleFile(fileInfo, enriched, timestamp);
}

/**
 * Remove stale local files not present in the upstream dataset.
 */
function pruneStaleFiles(remoteNames) {
  const localFiles = fs.readdirSync(OUTPUT_DIR).filter(file => file.endsWith('.json'));
  const staleFiles = [];

  for (const file of localFiles) {
    if (!remoteNames.has(file)) {
      staleFiles.push(file);
    }
  }

  if (staleFiles.length === 0) {
    return;
  }

  console.log(`Found ${staleFiles.length} stale files locally. They will remain untouched for manual review:`);
  staleFiles.forEach(file => console.log(`  - ${file}`));
}

/**
 * Main execution flow.
 */
async function main() {
  try {
    ensureOutputDir();
    console.log('Collecting ConceptARC manifest from GitHub...');
    const files = await collectConceptArcFiles();
    console.log(`Discovered ${files.length} ConceptARC puzzle files`);

    if (files.length === 0) {
      console.warn('No ConceptARC puzzles discovered. Aborting.');
      return;
    }

    const seenNames = new Set();
    const duplicateNames = []; 

    files.forEach(file => {
      if (seenNames.has(file.name)) {
        duplicateNames.push(file.name);
      }
      seenNames.add(file.name);
    });

    if (duplicateNames.length > 0) {
      console.warn('Duplicate filenames detected. Verify dataset uniqueness before continuing:');
      duplicateNames.forEach(name => console.warn(`  - ${name}`));
    }

    const timestamp = new Date().toISOString();
    let written = 0;
    let skipped = 0;
    const failures = [];

    for (const fileInfo of files) {
      try {
        const result = await downloadPuzzle(fileInfo, timestamp);
        if (result.written) {
          written++;
          console.log(`Saved ${fileInfo.name} (${fileInfo.concept})`);
        } else {
          skipped++;
        }
      } catch (error) {
        failures.push({ file: fileInfo.name, error: error.message });
        console.error(`Failed ${fileInfo.name}: ${error.message}`);
      }
    }

    pruneStaleFiles(seenNames);

    console.log('');
    console.log('='.repeat(60));
    console.log('ConceptARC Import Summary');
    console.log('='.repeat(60));
    console.log(`Total discovered: ${files.length}`);
    console.log(`Written (new/updated): ${written}`);
    console.log(`Skipped (unchanged): ${skipped}`);
    console.log(`Failures: ${failures.length}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    if (failures.length > 0) {
      console.log('');
      console.log('Failure details:');
      failures.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
      process.exitCode = 1;
    } else {
      console.log('');
      console.log('ConceptARC puzzles are ready for ingestion.');
    }
  } catch (error) {
    console.error('Fatal ConceptARC import error:', error);
    process.exit(1);
  }
}

main();
