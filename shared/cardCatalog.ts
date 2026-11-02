/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Supply catalog competition membership and selected-board standings without depending
 * on a fresh leaderboard or comparing ranks from different contests. Preserve subject identities.
 * SRP/DRY check: Pass — reuse canonical card entries and dated team history, never another standings store.
 */
import type { CollectionCard, NewsCollection } from './newsCollection';
import { collectionLeadEntry } from './newsCollection';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';

export const CATALOG_PAGE_SIZE = 24;
export function catalogSet(card: CollectionCard, sets: NewsCollection['sets'] = []) {
  if (card.setId) return sets.find(set => set.id === card.setId);
  // Legacy cards predate set IDs. Only infer when there is exactly one set for that season.
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
