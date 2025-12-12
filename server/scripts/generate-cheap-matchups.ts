/*
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-11
 * PURPOSE: Generate GPT-5.2 vs cheap models matchups for Worm Arena.
 *          Filters models by output token cost (≤ $5.00) and generates
 *          matchup file compatible with SnakeBench format.
 * SRP/DRY check: Pass - focused utility for matchup generation.
 */

import { MODELS } from '../config/models';
import * as fs from 'fs';
import * as path from 'path';

interface ParsedCost {
  inputPerM: number;
  outputPerM: number;
}

/**
 * Parse cost string like "$0.25" into a number (per million tokens)
 */
function parseCostString(cost: string): number {
  if (!cost || typeof cost !== 'string') return 0;
  const match = cost.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Filter models by output token cost threshold
 */
function getCheapModels(maxOutputCost: number) {
  return MODELS.filter(model => {
    if (!model.cost || typeof model.cost !== 'object') return false;

    const outputCost = model.cost.output;
    if (!outputCost) return false;

    // Handle range format like "$2.00 - $4.00" - take max
    let cost = outputCost;
    if (outputCost.includes('-')) {
      const parts = outputCost.split('-').map(s => parseCostString(s.trim()));
      cost = Math.max(...parts).toFixed(2);
    }

    const outputValue = parseCostString(cost);
    return outputValue <= maxOutputCost;
  });
}

/**
 * Generate matchups in SnakeBench format
 */
function generateMatchups(
  referenceModel: string,
  opponents: string[],
  rounds: number = 1
): string[] {
  const matchups: string[] = [];

  for (const opponent of opponents) {
    // Skip if opponent is the reference model
    if (opponent === referenceModel) {
      continue;
    }

    for (let i = 0; i < rounds; i++) {
      matchups.push(`${referenceModel} ${opponent}`);
    }
  }

  return matchups;
}

/**
 * Main script
 */
async function main() {
  const args = process.argv.slice(2);
  const referenceModel = args[0] || 'openai/gpt-5.2';
  const maxCost = args[1] ? parseFloat(args[1]) : 5.0;
  const rounds = args[2] ? parseInt(args[2]) : 1;
  const outputFile = args[3] || 'gpt52_vs_cheap_matchups.txt';

  console.log(`\n🎮 Generating GPT-5.2 vs Cheap Models Matchups`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Find reference model
  const refModel = MODELS.find(m => m.key === referenceModel);
  if (!refModel) {
    console.error(`❌ Reference model not found: ${referenceModel}`);
    process.exit(1);
  }

  console.log(`\n📊 Configuration:`);
  console.log(`   Reference model: ${refModel.name} (${refModel.key})`);
  if (refModel.cost && typeof refModel.cost === 'object') {
    console.log(`   Reference cost: ${refModel.cost.input} input / ${refModel.cost.output} output`);
  }
  console.log(`   Max opponent output cost: $${maxCost.toFixed(2)}/M tokens`);
  console.log(`   Rounds per matchup: ${rounds}`);

  // Get cheap models
  const cheapModels = getCheapModels(maxCost);
  const cheapModelKeys = cheapModels.map(m => m.key);

  console.log(`\n💰 Found ${cheapModels.length} models with output cost ≤ $${maxCost.toFixed(2)}/M:`);
  cheapModels.forEach(model => {
    const cost = model.cost && typeof model.cost === 'object'
      ? model.cost.output
      : 'unknown';
    console.log(`   • ${model.name} (${model.key})`);
    console.log(`     Output: ${cost}`);
  });

  // Generate matchups
  const matchups = generateMatchups(referenceModel, cheapModelKeys, rounds);

  console.log(`\n🎯 Generated ${matchups.length} matchups`);

  // Write to file
  const outputPath = path.resolve(outputFile);
  fs.writeFileSync(outputPath, matchups.join('\n') + '\n');
  console.log(`✅ Matchups written to: ${outputPath}`);

  console.log(`\n📋 First 10 matchups:`);
  matchups.slice(0, 10).forEach((m, i) => {
    console.log(`   ${i + 1}. ${m}`);
  });

  if (matchups.length > 10) {
    console.log(`   ... and ${matchups.length - 10} more`);
  }

  console.log(`\n✨ Ready to use with SnakeBench!\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
