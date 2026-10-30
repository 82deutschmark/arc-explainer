/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Permanent ARC Daily collectible identities, dated public statistics and separately
 * sourced official results. Clean artwork is independent of every programmatically drawn label.
 * SRP/DRY check: Pass — reuses news identities and competition slugs; no medal inference.
 */
import { z } from 'zod';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import type { CompetitorFact, NewsCompetition } from './news';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const stamp = z.string().datetime({ offset: true });
const competition = z.enum(['arc-2', 'arc-3']);
const entry = z.object({ competition, competitionId: z.string(), teamId: z.string().regex(/^\d+$/) }).strict()
  .refine(value => value.competitionId === KAGGLE_COMPETITIONS[value.competition].slug, 'Competition identity mismatch');
export const collectionArtSchema = z.object({
  src: z.string().regex(/^\/news-images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg)$/),
  alt: z.string().min(1), credit: z.string().min(1), artworkId: id.optional(), commissionedAt: stamp.optional(),
}).strict();
export const cardDefinitionSchema = z.object({
  id, number: z.string().regex(/^[PT]\d{3}$/), kind: z.enum(['person', 'team']), name: z.string().min(1),
  season: z.string().regex(/^\d{4}$/), issuedAt: stamp, personId: id.optional(),
  entries: z.array(entry), art: collectionArtSchema.optional(), artNotes: z.array(z.string()),
  description: z.string().optional(),
}).strict().refine(card => card.kind === 'person' ? !!card.personId : !card.personId && card.entries.length > 0, 'Card subject is incomplete');
export const cardSnapshotSchema = z.object({
  competition, competitionId: z.string(), teamId: z.string().regex(/^\d+$/),
  observedAt: stamp, teamName: z.string(), rank: z.number().int().positive(), score: z.number().finite(),
  submissions: z.number().int().nonnegative(), members: z.array(z.string()), sourceUrl: z.string().url(),
}).strict().refine(value => value.competitionId === KAGGLE_COMPETITIONS[value.competition].slug, 'Snapshot competition identity mismatch');
export const cardRegistrySchema = z.object({
  version: z.literal(1), season: z.string().regex(/^\d{4}$/), commissionedBy: z.literal('Mark Barney'),
  commissionedAt: stamp, updatedAt: stamp, cards: z.array(cardDefinitionSchema), snapshots: z.array(cardSnapshotSchema),
}).strict().superRefine((registry, context) => {
  for (const field of ['id', 'number'] as const) if (new Set(registry.cards.map(card => card[field])).size !== registry.cards.length)
    context.addIssue({ code: 'custom', message: `Duplicate card ${field}` });
  if (registry.cards.some(card => card.season !== registry.season)) context.addIssue({ code: 'custom', message: 'Mixed card seasons' });
  if (registry.snapshots.some(row => !row.competitionId.startsWith(`arc-prize-${registry.season}-`))
    || registry.cards.some(card => card.entries.some(row => !row.competitionId.startsWith(`arc-prize-${card.season}-`))))
    context.addIssue({ code: 'custom', message: 'Card season does not match competition' });
  const keys = registry.snapshots.map(row => `${row.competitionId}:${row.teamId}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Duplicate statistics snapshot' });
});
/** A public position, deadline or medal band can never satisfy this explicit final-result contract. */
export const finalCardResultSchema = z.object({
  id, season: z.string().regex(/^\d{4}$/), competition, competitionId: z.string(), teamId: z.string().regex(/^\d+$/),
  status: z.literal('official-final'), rank: z.number().int().positive(), score: z.number().finite().nullable(),
  medal: z.enum(['gold', 'silver', 'bronze']).nullable(),
  awards: z.array(z.object({ label: z.string().min(1), kind: z.literal('arc-prize') }).strict()),
  creditedHandles: z.array(z.string()).min(1), confirmedAt: stamp, sourceUrl: z.string().url(), sourceTitle: z.string().min(1),
  supersedesId: id.optional(),
}).strict().superRefine((result, context) => {
  const url = new URL(result.sourceUrl);
  if (url.protocol !== 'https:' || !['kaggle.com', 'www.kaggle.com', 'arcprize.org', 'www.arcprize.org'].includes(url.hostname))
    context.addIssue({ code: 'custom', message: 'Final result needs an official Kaggle or ARC Prize source' });
  if (result.competitionId !== KAGGLE_COMPETITIONS[result.competition].slug)
    context.addIssue({ code: 'custom', message: 'Final competition identity mismatch' });
  if (!result.competitionId.startsWith(`arc-prize-${result.season}-`))
    context.addIssue({ code: 'custom', message: 'Final season does not match competition' });
  if (Date.parse(result.confirmedAt) > Date.now()) context.addIssue({ code: 'custom', message: 'Cannot confirm a future result' });
  if (new Set(result.creditedHandles).size !== result.creditedHandles.length)
    context.addIssue({ code: 'custom', message: 'Duplicate credited recipient' });
});
export type CardDefinition = z.infer<typeof cardDefinitionSchema>;
export type CardRegistry = z.infer<typeof cardRegistrySchema>;
export type CardSnapshot = z.infer<typeof cardSnapshotSchema>;
export type FinalCardResult = z.infer<typeof finalCardResultSchema>;
export type CollectionArt = z.infer<typeof collectionArtSchema>;
export interface CollectionHonor {
  label: string; kind: 'arc-prize' | 'kaggle-medal'; competition: NewsCompetition; season: string;
  sourceUrl: string; sourceTitle: string; scope: 'team' | 'individual';
}
export interface CollectionEntry {
  competition: NewsCompetition; competitionId: string; teamId: string; teamName: string;
  observedAt: string | null; rank: number | null; score: number | null; submissions: number | null;
  sourceUrl?: string;
  members: { handle: string; name: string; personId?: string }[]; status: 'public' | 'final' | 'unavailable';
}
export interface CollectionCard {
  id: string; number: string; kind: 'person' | 'team'; name: string; season: string; profileUrl: string;
  personId?: string; art: CollectionArt | null; description: string; highlights: CompetitorFact[];
  accounts: { label: string; url: string }[]; entries: CollectionEntry[]; honors: CollectionHonor[]; artNotes: string[];
}
export interface NewsCollection {
  season: string; commissionedBy: string; commissionedAt: string; updatedAt: string; cards: CollectionCard[];
}
export const CARD_CABINET_PATH = '/news/cards';
