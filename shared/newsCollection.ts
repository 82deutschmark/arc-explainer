/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5
 * Date: 2026-10-30 (2026-10-29 earlier)
 * PURPOSE: Permanent ARC Daily collectible identities, dated public statistics and separately
 * sourced official results, linked player/team cards, dated membership history and shared
 * search/social-preview wording and artwork-aware image versions. Clean
 * artwork is independent of every programmatically drawn label.
 * CHANGELOG 30-Oct-2026 (Claude Sonnet 5.5 Medium, review fixes): every card carries setKey, a fingerprint of what its picture depends on
 *   beyond the card itself (set size, tier counts, series rows, career extras), so a card's image address changes when the set does.
 * CHANGELOG 30-Oct-2026 (Claude Sonnet 5.5 Low): RENDER_VERSION (was a private share-design number) is exported and mixed into every card image address.
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
/** Saved board context (content/news/board-history.json, built from the edition evidence): team counts, medal-band cut scores, best ranks. */
export const boardHistorySchema = z.object({
  version: z.literal(1),
  boards: z.record(z.array(z.object({ t: stamp, teams: z.number().int().positive(), gold: z.number().optional(), silver: z.number().optional(), bronze: z.number().optional(), top: z.number().optional() }).strict())),
  peaks: z.record(z.object({ rank: z.number().int().positive(), at: stamp }).strict()),
}).strict();
export type BoardHistory = z.infer<typeof boardHistorySchema>;
export interface CollectionEntry {
  competition: NewsCompetition; competitionId: string; teamId: string; teamName: string;
  observedAt: string | null; rank: number | null; score: number | null; submissions: number | null;
  /** Teams on the board within the hour of the saved standing, so a rank can read "#8 of 4,983". Null when no board was saved near it. */
  fieldSize: number | null;
  /** The team's best rank so far when it was better than today's. */
  peakRank: number | null;
  /** The medal band today's score sits in on the saved board: provisional until the private results. */
  zone: 'gold' | 'silver' | 'bronze' | null;
  sourceUrl?: string; cardUrl?: string; profileUrl: string;
  members: { handle: string; name: string; personId?: string; cardUrl?: string }[]; status: 'public' | 'final' | 'unavailable';
}
/** Positive roster observations, with an explicit uncertain state for stale membership. */
export interface CollectionTeamHistory {
  competition: NewsCompetition; competitionId: string; season: string; teamId: string; teamName: string;
  memberHandle: string; firstObservedAt: string; lastObservedAt: string; sourceUrl: string; sourceTitle: string;
  status: 'current' | 'previous' | 'last-observed'; cardUrl?: string; profileUrl: string;
}
/** Kaggle's own Competitions ladder, lowest first. A competitor's tier earns the card's border and badge. */
export const KAGGLE_TIERS = ['Novice', 'Contributor', 'Expert', 'Master', 'Grandmaster'] as const;
export type KaggleTier = typeof KAGGLE_TIERS[number];
const medalSchema = z.enum(['gold', 'silver', 'bronze']);
/** One person's Kaggle career as the card back prints it (content/news/careers.json, built from verified evidence). */
export const careerSchema = z.object({
  checkedAt: stamp, profileUrl: z.string().url(), tier: z.enum(KAGGLE_TIERS).nullable(),
  medals: z.object({ gold: z.number().int().nonnegative(), silver: z.number().int().nonnegative(), bronze: z.number().int().nonnegative() }).strict().nullable(),
  rank: z.object({ current: z.number().int().positive().nullable(), outOf: z.number().int().positive().nullable(), best: z.number().int().positive().nullable() }).strict().nullable(),
  joinedYear: z.number().int().nullable(), organisation: z.string().nullable(), location: z.string().nullable(),
  rows: z.array(z.object({ year: z.number().int().nullable(), competition: z.string().min(1), competitionUrl: z.string().url(), team: z.string().nullable(),
    rank: z.number().int().positive(), fieldSize: z.number().int().positive(), medal: medalSchema.nullable() }).strict()),
}).strict();
export const careersFileSchema = z.object({ version: z.literal(1), careers: z.record(careerSchema) }).strict();
export type CollectionCareer = z.infer<typeof careerSchema>;
/** An earlier card or award card we already hold for this subject (a Hall of Fame card), kept as it was issued. */
export interface CollectionPastCard {
  season: string | null; label: string; imageSrc: string | null; imageAlt: string;
  /** The card's permanent place on the Hall of Fame page, with its #contributor anchor. */
  hallOfFameUrl: string; sourceUrl: string; sourceTitle: string;
}
/** A Digest story that names or covers this subject. */
export interface CollectionStory {
  id: string; kind: 'edition' | 'wire'; headline: string; url: string; publishedAt: string; competition: NewsCompetition;
}
export interface CollectionCard {
  id: string; number: string; kind: 'person' | 'team'; name: string; season: string; profileUrl: string; cardUrl: string;
  /** What the card is: a Kaggle competitor, a competition sponsor, or a team. Nobody is a "player". */
  role: 'competitor' | 'sponsor' | 'team';
  personId?: string; art: CollectionArt | null; description: string; highlights: CompetitorFact[];
  accounts: { label: string; url: string }[]; entries: CollectionEntry[]; honors: CollectionHonor[]; artNotes: string[];
  teamHistory: CollectionTeamHistory[];
  /** Every earlier card we already have for them, so nothing we made stays unlinked. */
  pastCards: CollectionPastCard[];
  /** The newest Digest stories about them. */
  stories: CollectionStory[];
  /** Verified Kaggle career: tier, medals, rank and completed competitions. Null for teams, sponsors and people without evidence. */
  career: CollectionCareer | null;
  /** Fingerprint of the set-level inputs the card's picture uses (card count, tier counts, series rows, career extras). Part of the image address. */
  setKey?: string;
}
/** A set kept from an earlier season: last year's ARC Hall of Fame cards, every one preserved as it was issued. */
export const hallOfFameSchema = z.object({
  version: z.literal(1),
  series: z.object({ id: id, name: z.string().min(1), title: z.string().min(1), season: z.string().regex(/^\d{4}$/), page: z.string().url(), fetchedAt: stamp }).strict(),
  cards: z.array(z.object({
    id: z.number().int(), path: z.string().regex(/^\/hall-of-fame#contributor-\d+$/), name: z.string().min(1), handle: z.string().nullable(), year: z.number().int().nullable(),
    category: z.string().min(1), achievement: z.string().nullable(), score: z.string().nullable(), rank: z.number().int().nullable(), team: z.string().nullable(),
    affiliation: z.string().nullable(), images: z.array(z.string()),
  }).strict()),
}).strict();
export type HallOfFameFile = z.infer<typeof hallOfFameSchema>;
export type CollectionArchiveCard = HallOfFameFile['cards'][number] & {
  /** This year's Cabinet cards of the same people, so an old card links forward to the new one. */
  cardUrls: { name: string; url: string }[];
};
export interface CollectionArchive { series: HallOfFameFile['series']; cards: CollectionArchiveCard[] }
export interface NewsCollection {
  season: string; commissionedBy: string; commissionedAt: string; updatedAt: string; cards: CollectionCard[];
  /** Earlier sets we keep and show (the 2025 Hall of Fame), or null when none is on file. */
  archive: CollectionArchive | null;
}
export const CARD_CABINET_PATH = '/news/cards';
export const collectionCardPath = (cardId: string) => `${CARD_CABINET_PATH}/${encodeURIComponent(cardId)}`;

export const COLLECTION_SHARE_WIDTH = 1200;
export const COLLECTION_SHARE_HEIGHT = 630;
/**
 * Bump when ANY card image changes look (front, back, thumbnail or the landscape share preview). It is mixed into
 * collectionShareVersion, so every image address changes with it and browsers and link-preview crawlers refetch.
 * Original art paths are immutable. 2 = the Topps-style 2026 set (30-Oct-2026).
 */
export const RENDER_VERSION = 2;
/** Who a card is, in Kaggle's own words: "Kaggle Grandmaster", "Competition sponsor", "Team". Never "player". */
export function collectionRoleLabel(card: Pick<CollectionCard, 'role' | 'career'>): string {
  if (card.role === 'team') return 'Team';
  if (card.role === 'sponsor') return 'Competition sponsor';
  return card.career?.tier ? `Kaggle ${card.career.tier}` : 'Kaggle competitor';
}
/** The entry to lead with: an official final result, else the best public rank. */
export function collectionLeadEntry(card: Pick<CollectionCard, 'entries'>): CollectionEntry | undefined {
  const ranked = card.entries.filter(entry => entry.status !== 'unavailable' && entry.rank != null);
  return ranked.find(entry => entry.status === 'final') ?? [...ranked].sort((a, b) => a.rank! - b.rank!)[0] ?? card.entries[0];
}
/** The one date a card's standings carry: the newest observation, as a short Eastern day ("Oct 29"). */
export function collectionAsOfLabel(card: Pick<CollectionCard, 'entries'>): string | null {
  const stamps = card.entries.filter(entry => entry.status !== 'unavailable' && entry.observedAt).map(entry => Date.parse(entry.observedAt!)).filter(Number.isFinite);
  return stamps.length ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(Math.max(...stamps))) : null;
}
/** LIVE while any contest on the card is still being decided, FINAL once all are official results. */
export const collectionStatus = (card: Pick<CollectionCard, 'entries'>): 'live' | 'final' | null => {
  const known = card.entries.filter(entry => entry.status !== 'unavailable');
  return !known.length ? null : known.every(entry => entry.status === 'final') ? 'final' : 'live';
};
const ordinalWord = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n.toLocaleString('en-US')}${suffix}`;
};
/**
 * Why this person or team has a card at all: a card is earned by achieving something in a competition, so the card says what.
 * An honor first, then a Hall of Fame card, then where they stand now.
 */
export function collectionEarnedLine(card: CollectionCard): string | null {
  const honor = card.honors[0];
  if (honor) return `${honor.season} ${honor.label}`;
  if (card.pastCards[0]) return card.pastCards[0].label;
  const lead = collectionLeadEntry(card);
  return lead && lead.status !== 'unavailable' && lead.rank != null ? `${ordinalWord(lead.rank)} in ${competitionName(lead.competition)}${card.kind === 'person' ? ` with ${lead.teamName}` : ''}` : null;
}
export const collectionTitle = (card: CollectionCard) => `${card.name} — ${collectionRoleLabel(card)} card | ${NEWS_NAME}`;
export { collectionTitle as collectionCardTitle };
export function collectionCardDescription(card: CollectionCard): string {
  const lead = collectionLeadEntry(card);
  const contests = [...new Set(card.entries.map(entry => competitionName(entry.competition)))].join(' and ');
  if (card.kind === 'team') {
    return `${card.name}, a ${card.season} Kaggle team card: ${lead?.rank != null ? `ranked ${ordinalWord(lead.rank)} in ${competitionName(lead.competition)}` : `entered in ${contests || 'the competition'}`}, with its roster, results and the Digest stories about it.`;
  }
  const medals = card.career?.medals;
  const parts = [
    `${collectionRoleLabel(card)}${card.career?.organisation ? ` at ${card.career.organisation}` : ''}`,
    medals && medals.gold + medals.silver + medals.bronze ? `${medals.gold} gold, ${medals.silver} silver and ${medals.bronze} bronze Kaggle competition medals` : null,
    lead?.rank != null ? `${lead.teamName} is ${ordinalWord(lead.rank)} in ${competitionName(lead.competition)}` : null,
  ].filter(Boolean);
  const career = (card.highlights[0]?.text ?? card.description).replace(/\s+/g, ' ').trim();
  return `${card.name}’s ${card.season} card. ${parts.length > 1 ? `${parts.join('; ')}.` : career}`;
}
export const collectionShareAlt = (card: CollectionCard) => `${card.name} — ${collectionRoleLabel(card).toLowerCase()} card ${card.number}, ${card.season}. ${card.art?.alt ?? 'The ARC Daily Digest ARC Prize cards.'}`;
/** Public-content fingerprint: a corrected identity, roster or immutable artwork gets a fresh image URL. */
export function collectionShareVersion(card: CollectionCard): string {
  const text = JSON.stringify([RENDER_VERSION, card]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
export const collectionSharePath = (card: CollectionCard) => `/api/news/cards/${encodeURIComponent(card.id)}/share.png?v=${collectionShareVersion(card)}`;
