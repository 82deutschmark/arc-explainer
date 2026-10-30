/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Permanent ARC Daily collectible identities, dated public statistics and separately
 * sourced official results, linked player/team cards, dated membership history and shared
 * search/social-preview wording and artwork-aware image versions. Clean
 * artwork is independent of every programmatically drawn label.
 * SRP/DRY check: Pass — reuses news identities and competition slugs; no medal inference.
 */
import { z } from 'zod';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import { competitionName, NEWS_NAME, type CompetitorFact, type NewsCompetition } from './news';

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
  sourceUrl?: string; cardUrl?: string; profileUrl: string;
  members: { handle: string; name: string; personId?: string; cardUrl?: string }[]; status: 'public' | 'final' | 'unavailable';
}
/** Positive roster observations, with an explicit uncertain state for stale membership. */
export interface CollectionTeamHistory {
  competition: NewsCompetition; competitionId: string; season: string; teamId: string; teamName: string;
  memberHandle: string; firstObservedAt: string; lastObservedAt: string; sourceUrl: string; sourceTitle: string;
  status: 'current' | 'previous' | 'last-observed'; cardUrl?: string; profileUrl: string;
}
export interface CollectionCard {
  id: string; number: string; kind: 'person' | 'team'; name: string; season: string; profileUrl: string; cardUrl: string;
  personId?: string; art: CollectionArt | null; description: string; highlights: CompetitorFact[];
  accounts: { label: string; url: string }[]; entries: CollectionEntry[]; honors: CollectionHonor[]; artNotes: string[];
  teamHistory: CollectionTeamHistory[];
}
export interface NewsCollection {
  season: string; commissionedBy: string; commissionedAt: string; updatedAt: string; cards: CollectionCard[];
}
export const CARD_CABINET_PATH = '/news/cards';
export const collectionCardPath = (cardId: string) => `${CARD_CABINET_PATH}/${encodeURIComponent(cardId)}`;

export const COLLECTION_SHARE_WIDTH = 1200;
export const COLLECTION_SHARE_HEIGHT = 630;
/** Bump when the landscape share-preview layout changes. Original art paths are immutable. */
const COLLECTION_SHARE_DESIGN = 1;
export const collectionCardTitle = (card: CollectionCard) => `${card.name} — ${card.kind === 'person' ? 'Player' : 'Team'} card | ${NEWS_NAME}`;
export function collectionCardDescription(card: CollectionCard): string {
  const contests = [...new Set(card.entries.map(entry => competitionName(entry.competition)))].join(' and ');
  const career = (card.highlights[0]?.text ?? card.description).replace(/\s+/g, ' ').trim();
  return card.kind === 'team'
    ? `${card.name}’s ${card.season} team card${contests ? ` for ${contests}` : ''}: meet the players, see the team artwork and explore its sourced competition record.`
    : career ? `${card.name}’s ${card.season} player card. ${career}`
      : `${card.name}’s ${card.season} player card: current and past teams, Kaggle career highlights and dated ARC Prize competition records.`;
}
export const collectionShareAlt = (card: CollectionCard) => `${card.name} — ${card.kind === 'person' ? 'player' : 'team'} card ${card.number}, ${card.season}. ${card.art?.alt ?? 'The ARC Daily Digest Card Cabinet.'}`;
/** Public-content fingerprint: a corrected identity, roster or immutable artwork gets a fresh image URL. */
export function collectionShareVersion(card: CollectionCard): string {
  const text = JSON.stringify([COLLECTION_SHARE_DESIGN, card]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
export const collectionSharePath = (card: CollectionCard) => `/api/news/cards/${encodeURIComponent(card.id)}/share.png?v=${collectionShareVersion(card)}`;
