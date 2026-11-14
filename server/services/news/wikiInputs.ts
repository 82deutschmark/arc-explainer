/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): card art whose alt text is a file name is rejected; a competitor's roster
 *          comes from whichever record observed the team last (mergeCompetitorRows), so a stale wiki row can
 *          no longer drop members the local ledger has since seen.
 * 14-Nov-2026 (Claude Opus 5.5, integration): the local roster only replaces the wiki's when the member lists differ. A
 *          later sighting of the same roster keeps the wiki's observation time, which person memberships join on exactly
 *          (newsCollection.ts); moving it had stripped every teammate from cards such as Mark Barney's.
 * PURPOSE: Read the generated public Goose wiki projection: durable identities,
 * issued cards, art choices and historical context, with no current standings.
 * Reuses card schemas; individual people/team validation stays in newsStore.
 * SRP/DRY check: Pass — one read boundary for the index and Card Cabinet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { cardRegistrySchema, careerSchema, finalCardResultSchema } from '../../../shared/newsCollection';
import { isFilenameAlt, type CompetitorRecord } from '../../../shared/news';

const schema = z.object({ version: z.literal(1), source: z.literal('Autoresearch-Arena/loose-goose'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), people: z.array(z.unknown()), competitors: z.array(z.unknown()),
  registry: cardRegistrySchema, careers: z.record(careerSchema), results: z.array(finalCardResultSchema), series: z.unknown(),
  assetDigests: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
}).strict().superRefine((value, context) => {
  if (value.registry.snapshots.length) context.addIssue({ code: 'custom', message: 'The wiki projection cannot contain current standings snapshots' });
  // Card art alt text reaches the card page and its share-image alt; a file name there describes nothing.
  for (const card of value.registry.cards) for (const art of [card.art, card.backArt]) {
    if (art && isFilenameAlt(art.alt)) context.addIssue({ code: 'custom', path: ['registry', 'cards', card.id, 'art', 'alt'], message: `Card art alt text is a file name: ${art.alt}` });
  }
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

/**
 * Competitors merge like any wiki row (the wiki owns name, briefing, facts and art), except the observed roster:
 * when the two records list different members, the members and the observation window come from whichever saw the
 * team last. The same roster seen again keeps the wiki row whole: person memberships are joined to a team record on
 * its exact lastObservedAt, so moving that time without a roster change would detach every member from the team.
 */
export function mergeCompetitorRows(archive: CompetitorRecord[], current: CompetitorRecord[]): CompetitorRecord[] {
  const local = new Map(archive.map(row => [row.id, row]));
  const sameMembers = (a: string[], b: string[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;
  return mergeWikiRows(archive, current).map(row => {
    const other = local.get(row.id);
    if (!other || other === row || sameMembers(other.members, row.members) || Date.parse(other.lastObservedAt) <= Date.parse(row.lastObservedAt)) return row;
    return { ...row, members: other.members, lastObservedAt: other.lastObservedAt,
      firstObservedAt: Date.parse(other.firstObservedAt) < Date.parse(row.firstObservedAt) ? other.firstObservedAt : row.firstObservedAt };
  });
}
