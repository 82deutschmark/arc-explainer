/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5; Claude Opus 5.5 Medium
 * Date: 27-November-2026 (Claude Opus 5.5 Medium); 16-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): catalogGroup files every card under one heading in a fixed order: the
 *          current contest's set (Generalist Gaming) first, the Kaggleverse career cards next, other contests' sets
 *          after, and the ARC Prize 2026 sets last under "2026 archive". The cards page and its server HTML share it.
 *          contestField lists a contest's carded competitors, highest tier first, for the front page's board column.
 * 16-Nov-2026 (GPT-6 / Codex): keep empty profile fallback faces out of the catalog.
 * 14-Nov-2026 (Claude Opus 5.5): catalogSetLabel names a card by its set without a repeated season; catalogFallbackLine keeps a
 *          contest-filtered tile caption to that contest instead of a standing from another one.
 * PURPOSE: Supply catalog competition membership and selected-board standings without depending
 * on a fresh leaderboard or comparing ranks from different contests. Preserve subject identities.
 * SRP/DRY check: Pass — reuse canonical card entries and dated team history, never another standings store.
 */
import { KAGGLE_TIERS, type CollectionCard, type NewsCollection } from './newsCollection';
import { collectionEarnedLine, collectionLeadEntry, collectionTeamCompetition } from './newsCollection';
import { competitionName } from './news';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import { ARC_2026_ARCHIVE, NEWS_CURRENT_COMPETITIONS } from './newsSeasons';

/** A bare profile has no sporting record to make a card; keep its permanent page, but omit its placeholder face from the catalog. */
export function catalogCardVisible(card: CollectionCard): boolean {
  if (card.catalogVisible !== undefined) return card.catalogVisible;
  if (card.kind !== 'person' || card.role !== 'competitor') return true;
  return !!(card.entries.length || card.career?.tier || card.career?.medals || card.career?.rank?.current
    || card.career?.rows.length || card.honors.length || card.pastCards.length);
}

export const CATALOG_PAGE_SIZE = 24;
export function catalogSet(card: CollectionCard, sets: NewsCollection['sets'] = []) {
  if (card.setId) return sets.find(set => set.id === card.setId);
  // Imported cards predate set IDs; their original collection uses the season as its ID.
  const legacy = sets.find(set => set.id === card.season && set.season === card.season);
  if (legacy) return legacy;
  // Other collections can infer a set only when there is one unambiguous candidate.
  const sameSeason = sets.filter(set => set.season === card.season);
  return sameSeason.length === 1 ? sameSeason[0] : undefined;
}
export function catalogCompetitions(card: CollectionCard, sets: NewsCollection['sets'] = []) {
  const references = [...card.entries, ...card.teamHistory.filter(team => team.season === card.season)];
  const result = new Map(references.map(row => [row.competitionId, { id: row.competitionId, key: row.competition }]));
  // An explicitly issued competition edition remains discoverable before it has a board reading.
  // Legacy combined sets are not evidence that every member entered every contest.
  if (card.setId) for (const slug of catalogSet(card, sets)?.competitionIds ?? []) {
    const match = Object.entries(KAGGLE_COMPETITIONS).find(([, competition]) => competition.slug === slug);
    if (match) result.set(slug, { id: slug, key: match[0] });
  }
  return [...result.values()];
}
export function catalogEntry(card: CollectionCard, competitionId = 'all') {
  return collectionLeadEntry({ entries: competitionId === 'all' ? card.entries : card.entries.filter(row => row.competitionId === competitionId) });
}
export const catalogSubjectLabel = (card: Pick<CollectionCard, 'kind' | 'role'>) =>
  card.kind === 'team' ? 'Team card' : card.role === 'sponsor' ? 'Sponsor card' : 'Individual card';
/** A card's set as readers see it: "ARC Prize 2026 — ARC-AGI-3 2026" prints as "ARC Prize 2026 — ARC-AGI-3"; the season when there is no set. */
export function catalogSetLabel(card: CollectionCard, sets: NewsCollection['sets'] = []): string {
  const name = catalogSet(card, sets)?.name;
  if (!name) return card.season;
  const trailing = /\s+(\d{4})$/.exec(name);
  return trailing && name.slice(0, trailing.index).includes(trailing[1]) ? name.slice(0, trailing.index) : name;
}
/**
 * A tile's caption when it has no ranked entry to show. With a contest filter on, it only names something from that
 * contest (the team card's own contest, an honour won there) and otherwise says plainly there is no standing in it.
 */
export function catalogFallbackLine(card: CollectionCard, competitionId = 'all'): string {
  if (competitionId === 'all') return collectionTeamCompetition(card) ?? collectionEarnedLine(card) ?? '';
  const key = Object.keys(KAGGLE_COMPETITIONS).find(name => KAGGLE_COMPETITIONS[name].slug === competitionId);
  if (card.kind === 'team' && card.entries.length === 1 && card.entries[0].competitionId === competitionId) return collectionTeamCompetition(card) ?? '';
  const honor = card.honors.find(item => item.competition === key);
  return honor ? `${honor.season} ${honor.label}` : `No standing in ${key ? competitionName(key) : competitionId}`;
}

/** A heading on the cards page: its anchor, its title and its place in the page order. */
export interface CatalogGroup { id: string; order: number; heading: string; note?: string }
const KAGGLEVERSE_SET = 'kaggleverse-2026';
const currentSlugs = () => NEWS_CURRENT_COMPETITIONS.map(key => KAGGLE_COMPETITIONS[key]?.slug).filter(Boolean);

/**
 * Which heading a card sits under. The current contest's set leads, then the Kaggleverse career cards, then other
 * contests' sets, and the ARC Prize 2026 sets (the original combined set and both board sets) go last, under
 * "2026 archive". A card with no set of its own and no inferable set stays with the other contests.
 */
export function catalogGroup(card: CollectionCard, sets: NewsCollection['sets'] = []): CatalogGroup {
  const set = catalogSet(card, sets);
  if (set && (ARC_2026_ARCHIVE.cardSetIds as readonly string[]).includes(set.id))
    return { id: 'archive', order: 3, heading: ARC_2026_ARCHIVE.cardHeading, note: 'ARC Prize 2026, closed 2 November 2026' };
  if (set && set.competitionIds.some(slug => currentSlugs().includes(slug)))
    return { id: set.id, order: 0, heading: catalogSetLabel(card, sets).replace(/\s+\d{4}$/, ''), note: 'the contest the paper follows now' };
  if (set?.id === KAGGLEVERSE_SET) return { id: set.id, order: 1, heading: 'Kaggleverse career cards', note: 'careers across Kaggle' };
  return { id: 'other', order: 2, heading: 'Other contests' };
}

/** Tier as a reader sees it: Expert, Master, Grandmaster; below Expert a person is just a competitor (null). */
export const fieldTier = (card: CollectionCard): string | null =>
  card.career?.tier && KAGGLE_TIERS.indexOf(card.career.tier) >= KAGGLE_TIERS.indexOf('Expert') ? card.career.tier : null;

/** The people with a card in a contest's own set, highest tier first, then by name: the front page's "The field". */
export function contestField(collection: Pick<NewsCollection, 'cards' | 'sets'>, competition: string): CollectionCard[] {
  const slug = KAGGLE_COMPETITIONS[competition]?.slug;
  if (!slug) return [];
  const tier = (card: CollectionCard) => card.career?.tier ? KAGGLE_TIERS.indexOf(card.career.tier) : -1;
  return collection.cards.filter(card => card.kind === 'person' && card.role === 'competitor' && catalogCardVisible(card)
    // Only cards issued in the contest's own set (a legacy combined set is no evidence of entry).
    && !!card.setId && !!catalogSet(card, collection.sets)?.competitionIds.includes(slug))
    .sort((a, b) => tier(b) - tier(a) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
