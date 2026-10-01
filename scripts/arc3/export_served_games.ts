/*
Author: GPT-6 / Codex
Date: 2026-09-30
PURPOSE: Export the production mirror's executable game payloads as JSON for CPython and
Pyodide verification. Explicit IDs select games; no IDs exports all three local catalogs.
Uses the same source resolution, support bundling and version hashing as the public API.
SRP/DRY check: Pass -- exports only; Arc3MirrorCatalog owns all source preparation.
*/
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Arc3MirrorCatalog, AUTHORED_DIR, RESEARCH_DIR, HOLDOUT_DIR } from '../../server/services/arc3Mirror/Arc3MirrorCatalog';

const requestedIds = process.argv.slice(2);
const ids: string[] = requestedIds.length ? requestedIds : (await Promise.all(
  [AUTHORED_DIR, RESEARCH_DIR, HOLDOUT_DIR].map(async (directory) => {
    const entries: { id: string }[] = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    return entries.map((entry) => entry.id);
  }),
)).flat();

const games = [];
for (const id of ids) {
  const game = await Arc3MirrorCatalog.getSource(id);
  if (!game) throw new Error(`Mirror could not resolve ${id}`);
  games.push(game);
}
// Call with LOG_LEVEL=error so catalog diagnostics cannot contaminate the JSON stream.
process.stdout.write(JSON.stringify(games));
