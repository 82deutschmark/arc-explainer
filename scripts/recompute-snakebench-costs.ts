/**
 * scripts/recompute-snakebench-costs.ts
 *
 * Author: Codex / GPT-5
 * Date: 2025-12-10
 * PURPOSE: Recalculate SnakeBench replay costs using real model pricing from MODELS.
 * SRP/DRY check: Pass — utility focuses on in-place replay repair without duplicating
 *                existing runner logic.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODELS } from '../server/config/models.ts';

interface Price {
  input: number;
  output: number;
}

function parsePrice(value: string | number | undefined | null): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  return Number.parseFloat(match[0]);
}

const priceMap = new Map<string, Price>();

for (const model of MODELS) {
  const price: Price = {
    input: parsePrice(model.cost?.input),
    output: parsePrice(model.cost?.output),
  };

  const aliases = new Set<string>();
  if (model.key) aliases.add(model.key);
  if (model.apiModelName) aliases.add(model.apiModelName);
  if (model.name) aliases.add(model.name);

  for (const alias of aliases) {
    const key = alias.trim().toLowerCase();
    if (!key) continue;
    priceMap.set(key, price);
  }
}

function getPriceForModel(modelName: string | undefined | null): Price | null {
  if (!modelName) return null;
  const lookup = modelName.trim().toLowerCase();
  if (!lookup) return null;
  return priceMap.get(lookup) ?? null;
}

function round(value: number, precision = 12): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

async function recomputeCosts(): Promise<void> {
  const cwd = path.dirname(fileURLToPath(import.meta.url));
  const completedDir = path.join(cwd, '..', 'external', 'SnakeBench', 'backend', 'completed_games');
  const entries = await fs.readdir(completedDir);

  let processed = 0;
  let updated = 0;
  const missingModels = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.startsWith('snake_game_') || !entry.endsWith('.json')) continue;
    processed += 1;
    const fullPath = path.join(completedDir, entry);

    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      console.warn(`⚠️  Skipping ${entry}: unable to read (${(err as Error).message})`);
      continue;
    }

    let data: any;
    try {
      data = JSON.parse(content);
    } catch (err) {
      console.warn(`⚠️  Skipping ${entry}: invalid JSON (${(err as Error).message})`);
      continue;
    }

    const players = data?.players;
    const frames = data?.frames;
    if (!players || !frames) {
      console.warn(`⚠️  Skipping ${entry}: missing players/frames`);
      continue;
    }

    const playerPricing: Record<string, Price> = {};
    let missingPrice = false;
    for (const [slot, info] of Object.entries<any>(players)) {
      const modelName = info?.name ?? data?.metadata?.models?.[slot];
      const price = getPriceForModel(modelName);
      if (!price) {
        missingPrice = true;
        const key = (modelName ?? 'unknown').toString();
        missingModels.set(key, (missingModels.get(key) ?? 0) + 1);
        console.warn(`⚠️  ${entry}: missing pricing for model "${modelName}" (slot ${slot})`);
        break;
      }
      playerPricing[slot] = price;
    }

    if (missingPrice) continue;

    const playerCostTotals: Record<string, number> = {};
    let fileChanged = false;

    for (const frame of frames as any[]) {
      if (!frame?.moves || typeof frame.moves !== 'object') continue;
      for (const [slot, move] of Object.entries<any>(frame.moves)) {
        const pricing = playerPricing[slot];
        if (!pricing) continue;
        const inputTokens = Number(move?.input_tokens ?? 0) || 0;
        const outputTokens = Number(move?.output_tokens ?? 0) || 0;
        const moveCost = round(((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1_000_000, 12);
        if (!Number.isFinite(moveCost)) continue;
        playerCostTotals[slot] = (playerCostTotals[slot] ?? 0) + moveCost;
        if (move?.cost !== moveCost) {
          if (move) move.cost = moveCost;
          fileChanged = true;
        }
      }
    }

    let totalCost = 0;
    for (const [slot, total] of Object.entries(playerCostTotals)) {
      const rounded = round(total, 8);
      totalCost += rounded;
      if (players[slot]?.totals) {
        if (players[slot].totals.cost !== rounded) {
          players[slot].totals.cost = rounded;
          fileChanged = true;
        }
      }
    }
    totalCost = round(totalCost, 8);

    if (data?.totals?.cost !== totalCost) {
      if (data?.totals) {
        data.totals.cost = totalCost;
        fileChanged = true;
      }
    }

    if (data?.metadata) {
      if (data.metadata.total_cost !== totalCost) {
        data.metadata.total_cost = totalCost;
        fileChanged = true;
      }
      if (data.metadata.player_costs) {
        for (const [slot] of Object.entries(playerPricing)) {
          const rounded = round(playerCostTotals[slot] ?? 0, 8);
          if (data.metadata.player_costs[slot] !== rounded) {
            data.metadata.player_costs[slot] = rounded;
            fileChanged = true;
          }
        }
      }
    }

    if (!fileChanged) continue;

    await fs.writeFile(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    updated += 1;
  }

  console.log(`Processed ${processed} files. Updated ${updated} file(s).`);
  if (missingModels.size) {
    console.log('Missing pricing for models:');
    for (const [name, count] of missingModels.entries()) {
      console.log(` - ${name}: ${count} file(s)`);
    }
  }
}

recomputeCosts().catch((err) => {
  console.error('SnakeBench cost recompute failed:', err);
  process.exitCode = 1;
});
