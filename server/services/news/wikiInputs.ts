/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Read the generated public Goose wiki projection: durable identities,
 * issued cards, art choices and historical context, with no current standings.
 * Reuses card schemas; individual people/team validation stays in newsStore.
 * SRP/DRY check: Pass — one read boundary for the index and Card Cabinet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { cardRegistrySchema, careerSchema, finalCardResultSchema } from '../../../shared/newsCollection';

const schema = z.object({ version: z.literal(1), source: z.literal('Autoresearch-Arena/loose-goose'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), people: z.array(z.unknown()), competitors: z.array(z.unknown()),
  registry: cardRegistrySchema, careers: z.record(careerSchema), results: z.array(finalCardResultSchema), series: z.unknown(),
  assetDigests: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
}).strict().superRefine((value, context) => {
  if (value.registry.snapshots.length) context.addIssue({ code: 'custom', message: 'The wiki projection cannot contain current standings snapshots' });
});
export type WikiInputs = z.infer<typeof schema>;
let memo: { file: string; stamp: string; value: WikiInputs } | undefined;

export function loadWikiInputs(directory: string): WikiInputs | null {
  const file = path.join(directory, 'goose-wiki.json');
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file), stamp = `${stat.mtimeMs}:${stat.size}`;
  if (memo?.file === file && memo.stamp === stamp) return memo.value;
  const value = schema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  memo = { file, stamp, value };
  return value;
}

/** Replace a stable identity by its wiki-owned briefing, preserving the archive. */
export function mergeWikiRows<T extends { id: string }>(archive: T[], current: T[]): T[] {
  return [...new Map([...archive, ...current].map(row => [row.id, row])).values()];
}
