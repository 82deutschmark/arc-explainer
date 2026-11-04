/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 03-November-2026
 * PURPOSE: Find sourced cast records without an issued card for the browser and initial HTML.
 * SRP/DRY check: Pass — use the existing index, verified memberships and issued collection.
 */
import type { NewsIndex } from './news';
import type { CollectionCard } from './newsCollection';

export function uncardedCast(index: Pick<NewsIndex, 'people' | 'competitors'>, cards: CollectionCard[]) {
  const people = index.people ?? [];
  const cardedPeople = new Set(cards.flatMap(card => card.personId ? [card.personId] : []));
  const cardedTeams = new Set(cards.filter(card => card.kind === 'team').flatMap(card => card.entries.map(entry => `${entry.competition}:${entry.teamId}`)));
  return {
    people: people.filter(person => !cardedPeople.has(person.id)),
    teams: index.competitors.filter(team => {
      if (cardedTeams.has(`${team.competition}:${team.teamId}`)) return false;
      // A solo entry already appears under its person only when both roster and verified account agree.
      const handle = team.members.length === 1 ? team.members[0].toLocaleLowerCase() : null;
      const person = handle && people.find(item => item.accounts.some(account => account.platform === 'kaggle' && account.handle.toLocaleLowerCase() === handle)
        && item.memberships.some(member => member.competition === team.competition && member.teamId === team.teamId && member.memberHandle.toLocaleLowerCase() === handle));
      return !person;
    }),
  };
}
