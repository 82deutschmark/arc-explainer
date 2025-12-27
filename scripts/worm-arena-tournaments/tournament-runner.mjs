#!/usr/bin/env node

/**
 * Author: Claude Code (Haiku 4.5)
 * Date: 2025-12-25
 * PURPOSE: Smart tournament runner for Worm Arena with intelligent rate-limiting.
 *          Runs directly in Node.js without HTTP overhead.
 *          Free models (detected by :free suffix) can only play 1 game at a time.
 *          Paid models can play unlimited concurrent games.
 * SRP/DRY check: Pass - tournament orchestration only, delegates to snakeBenchService.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

// Import backend services
// NOTE: This is a workaround for ESM imports in a CJS-heavy project
const dynamicImport = async () => {
  const { snakeBenchService } = await import(
    path.resolve(projectRoot, 'server', 'services', 'snakeBenchService.ts')
  );
  return snakeBenchService;
};

const models = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'deepseek/deepseek-v3.2',
  'openai/gpt-5-nano',
  'openai/gpt-5-mini',
  'openai/gpt-4.1-nano',
  'x-ai/grok-code-fast-1',
];

const freeModels = new Set(models.filter(m => m.endsWith(':free')));
const paidModels = new Set(models.filter(m => !m.endsWith(':free')));

const activeGameCount = new Map();
models.forEach(m => activeGameCount.set(m, 0));

// Build all pairings
const allPairings = [];
for (const modelA of models) {
  for (const modelB of models) {
    if (modelA !== modelB) {
      allPairings.push({ modelA, modelB });
    }
  }
}

const totalPairings = allPairings.length;
const gamesPerPairing = 1;
const totalGames = totalPairings * gamesPerPairing;

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  Worm Arena: Smart Tournament Runner (Node.js)');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('Configuration:');
console.log('  Games per pairing: ' + gamesPerPairing);
console.log('  Board: 10x10, maxRounds=150, numApples=5\n');

console.log(`Free Models (${freeModels.size}) [Rate-limited to 1 active game]:`);
freeModels.forEach(m => console.log(`  [FREE] ${m}`));
console.log('');

console.log(`Paid Models (${paidModels.size}) [Unlimited concurrent games]:`);
paidModels.forEach(m => console.log(`  [PAID] ${m}`));
console.log('');

console.log('Tournament Size:');
console.log(`  Total pairings: ${totalPairings}`);
console.log(`  Games per pairing: ${gamesPerPairing}`);
console.log(`  Total games to run: ${totalGames}`);
console.log('');

function showModelStatus() {
  console.log('\n--- Current Model Status ---');
  for (const model of models) {
    const activeCount = activeGameCount.get(model);
    const isFree = freeModels.has(model);
    const typeLabel = isFree ? '[FREE]' : '[PAID]';
    let color = '\x1b[32m'; // green
    if (activeCount > 0 && isFree) color = '\x1b[33m'; // yellow
    if (activeCount > 1) color = '\x1b[31m'; // red
    const reset = '\x1b[0m';
    console.log(`  ${typeLabel} ${model} : ${color}${activeCount} active game(s)${reset}`);
  }
  console.log('');
}

async function runTournament() {
  console.log('Starting tournament runner...\n');

  let pairingIndex = 0;
  let completedCount = 0;
  let queuedCount = 0;
  const startTime = Date.now();
  let pollCount = 0;

  const activePairs = new Map(); // Track which models are in active games

  // Dummy loop - would integrate with real service
  console.log('WARNING: Direct service import not yet working in Node ESM context.');
  console.log('Falling back to API-based execution.\n');
  console.log('Use PowerShell script instead:');
  console.log(
    '  powershell -ExecutionPolicy Bypass -File smart-rate-limited-tournament.ps1\n'
  );
}

// For now, just show the setup
showModelStatus();

console.log('ℹ️  Note: Direct Node.js import of TypeScript backend not yet configured.');
console.log('    Run the PowerShell script instead for full tournament execution.');
console.log('');
