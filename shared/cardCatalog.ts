/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): catalogSetLabel names a card by its set without a repeated season; catalogFallbackLine keeps a
 *          contest-filtered tile caption to that contest instead of a standing from another one.
 * PURPOSE: Supply catalog competition membership and selected-board standings without depending
 * on a fresh leaderboard or comparing ranks from different contests. Preserve subject identities.
 * SRP/DRY check: Pass — reuse canonical card entries and dated team history, never another standings store.
 */
import type { CollectionCard, NewsCollection } from './newsCollection';
import { collectionEarnedLine, collectionLeadEntry, collectionTeamCompetition } from './newsCollection';
import { competitionName } from './news';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';

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
