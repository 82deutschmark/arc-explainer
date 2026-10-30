/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Resolve the permanent Card Cabinet from curated card/art bindings, existing verified
 * people, dated board snapshots, linked player/team histories and explicitly official final
 * results. Never exposes desk drafts or infers a player's departure from roster absence.
 * SRP/DRY check: Pass — newsStore owns identities; this projection owns collectible presentation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cardRegistrySchema, collectionCardPath, finalCardResultSchema, type CardRegistry, type CollectionCard, type CollectionTeamHistory, type FinalCardResult, type NewsCollection } from '../../../shared/newsCollection';
import { competitionName, displayPortrait, personPath, competitorPath, type NewsIndex, type NewsPerson } from '../../../shared/news';
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import { getNewsIndex, NEWS_DIRECTORY } from './newsStore';

export function activeCardResults(results: FinalCardResult[]): FinalCardResult[] {
  const ids = new Set<string>();
  for (const row of results) {
    finalCardResultSchema.parse(row);
    if (ids.has(row.id)) throw Error('Duplicate final result ID');
    if (row.supersedesId && !results.some(old => old.id === row.supersedesId && old.competitionId === row.competitionId && old.teamId === row.teamId && old.season === row.season && Date.parse(old.confirmedAt) < Date.parse(row.confirmedAt)))
      throw Error('Invalid result correction');
    ids.add(row.id);
  }
  const replaced = new Set(results.map(row => row.supersedesId).filter(Boolean));
  const active = results.filter(row => !replaced.has(row.id));
  if (new Set(active.map(row => `${row.season}:${row.competitionId}:${row.teamId}`)).size !== active.length)
    throw Error('Conflicting final results');
  return active;
}

const teamKey = (row: { competitionId: string; teamId: string }) => `${row.competitionId}:${row.teamId}`;
const contestKey = (row: { competitionId: string; season: string }) => `${row.season}:${row.competitionId}`;

function playerTeamHistory(person: NewsPerson, registry: CardRegistry, teamCards: Map<string, string>, notebooks: Map<string, string>): CollectionTeamHistory[] {
  const handles = new Set(person.accounts.filter(account => account.platform === 'kaggle').map(account => account.handle));
  const observed = new Map<string, NewsPerson['memberships'][number]>();
  const add = (row: NewsPerson['memberships'][number]) => {
    if (!handles.has(row.memberHandle)) return;
    const key = `${row.season}:${teamKey(row)}`;
    const prior = observed.get(key);
    if (!prior) observed.set(key, { ...row });
    else {
      const latest = Date.parse(row.lastObservedAt) > Date.parse(prior.lastObservedAt) ? row : prior;
      observed.set(key, { ...latest, firstObservedAt: Date.parse(prior.firstObservedAt) < Date.parse(row.firstObservedAt) ? prior.firstObservedAt : row.firstObservedAt });
    }
  };
  person.memberships.forEach(add);
  // Snapshot membership is another positive observation, never a reason to erase an old team.
  for (const row of registry.snapshots) for (const handle of row.members) if (handles.has(handle)) add({
    competition: row.competition, competitionId: row.competitionId, season: registry.season,
    teamId: row.teamId, teamName: row.teamName, memberHandle: handle,
    firstObservedAt: row.observedAt, lastObservedAt: row.observedAt,
    sourceUrl: row.sourceUrl, sourceTitle: `${competitionName(row.competition)} public roster observation`,
  });
  const latestMembership = new Map<string, number>();
  const latestBoard = new Map<string, number>();
  for (const row of observed.values()) latestMembership.set(contestKey(row), Math.max(latestMembership.get(contestKey(row)) ?? 0, Date.parse(row.lastObservedAt)));
  for (const row of registry.snapshots) {
    const key = contestKey({ ...row, season: registry.season });
    latestBoard.set(key, Math.max(latestBoard.get(key) ?? 0, Date.parse(row.observedAt)));
  }
  return [...observed.values()].map(row => {
    const seen = Date.parse(row.lastObservedAt);
    // Only a later positive membership in this contest proves a previous team. A newer board
    // without this player leaves the latest team uncertain, rather than inventing a transfer.
    const status: CollectionTeamHistory['status'] = seen < latestMembership.get(contestKey(row))! ? 'previous'
      : seen < (latestBoard.get(contestKey(row)) ?? seen) || row.season !== registry.season ? 'last-observed' : 'current';
    const cardUrl = teamCards.get(teamKey(row));
    return { ...row, status, ...(cardUrl ? { cardUrl } : {}), profileUrl: notebooks.get(teamKey(row)) ?? row.sourceUrl };
  }).sort((a, b) => Date.parse(b.lastObservedAt) - Date.parse(a.lastObservedAt) || a.competitionId.localeCompare(b.competitionId) || a.teamId.localeCompare(b.teamId));
}

export function buildNewsCollection(registry: CardRegistry, index: NewsIndex, results: FinalCardResult[] = []): NewsCollection {
  cardRegistrySchema.parse(registry);
  const final = activeCardResults(results);
  const people = index.people ?? [];
  const byHandle = new Map(people.flatMap(person => person.accounts.filter(account => account.platform === 'kaggle').map(account => [account.handle, person] as const)));
  const teamCards = new Map(registry.cards.filter(card => card.kind === 'team').flatMap(card => card.entries.map(row => [teamKey(row), collectionCardPath(card.id)] as const)));
  const personCards = new Map(registry.cards.filter(card => card.kind === 'person').map(card => [`${card.season}:${card.personId}`, collectionCardPath(card.id)] as const));
  const notebooks = new Map<string, string>(index.competitors.map(team => [`${KAGGLE_COMPETITIONS[team.competition].slug}:${team.teamId}`, competitorPath(team.id)] as const));
  const cards: CollectionCard[] = registry.cards.map(definition => {
    const person = people.find(item => item.id === definition.personId);
    if (definition.kind === 'person' && !person) throw Error('Card has no verified person: ' + definition.id);
    const handles = new Set(person?.accounts.filter(account => account.platform === 'kaggle').map(account => account.handle));
    const entryRefs = definition.kind === 'team' ? definition.entries : registry.snapshots.filter(row => row.members.some(handle => handles.has(handle)));
    // An official credited roster can reconnect a former member without using today's roster.
    if (person) for (const row of final.filter(row => row.season === definition.season && row.creditedHandles.some(handle => handles.has(handle)))) {
      if (!entryRefs.some(ref => ref.competitionId === row.competitionId && ref.teamId === row.teamId)) entryRefs.push(row);
    }
    const honors: CollectionCard['honors'] = [];
    const entries = entryRefs.map(ref => {
      const snapshot = registry.snapshots.find(row => row.competitionId === ref.competitionId && row.teamId === ref.teamId);
      const result = final.find(row => row.season === definition.season && row.competitionId === ref.competitionId && row.teamId === ref.teamId
        && (!person || row.creditedHandles.some(handle => handles.has(handle))));
      if (result) {
        const credit = { competition: ref.competition, season: result.season, sourceUrl: result.sourceUrl, sourceTitle: result.sourceTitle, scope: 'team' as const };
        if (result.medal) honors.push({ ...credit, label: `${result.medal[0].toUpperCase()}${result.medal.slice(1)} medal`, kind: 'kaggle-medal' });
        honors.push(...result.awards.map(award => ({ ...credit, label: award.label, kind: award.kind })));
      }
      const roster = result?.creditedHandles ?? snapshot?.members ?? [];
      return { competition: ref.competition, competitionId: ref.competitionId, teamId: ref.teamId,
        teamName: snapshot?.teamName ?? index.competitors.find(team => team.teamId === ref.teamId && team.competition === ref.competition)?.name ?? definition.name,
        observedAt: result?.confirmedAt ?? snapshot?.observedAt ?? null, rank: result?.rank ?? snapshot?.rank ?? null,
        score: result ? result.score : snapshot?.score ?? null, submissions: snapshot?.submissions ?? null,
        sourceUrl: result?.sourceUrl ?? snapshot?.sourceUrl,
        ...(teamCards.has(teamKey(ref)) ? { cardUrl: teamCards.get(teamKey(ref)) } : {}),
        profileUrl: notebooks.get(teamKey(ref)) ?? result?.sourceUrl ?? snapshot?.sourceUrl
          ?? `https://www.kaggle.com/competitions/${encodeURIComponent(ref.competitionId)}/leaderboard`,
        status: result ? 'final' as const : snapshot ? 'public' as const : 'unavailable' as const,
        members: roster.map(handle => {
          const owner = byHandle.get(handle);
          const cardUrl = owner && personCards.get(`${definition.season}:${owner.id}`);
          return { handle, name: owner?.name ?? handle, ...(owner ? { personId: owner.id } : {}), ...(cardUrl ? { cardUrl } : {}) };
        }),
      };
    });
    const portrait = person && displayPortrait(person);
    const art = definition.art ?? (portrait ? { src: portrait.src, alt: portrait.alt, credit: portrait.sourceTitle, ...('artworkId' in portrait ? { artworkId: portrait.artworkId } : {}) } : null);
    const facts = person?.facts ?? index.competitors.filter(team => definition.entries.some(ref => ref.teamId === team.teamId && ref.competition === team.competition)).flatMap(team => team.facts);
    const careerHonors = person?.hallOfFame.map(honor => ({ text: honor.label, sourceUrl: honor.sourceUrl, sourceTitle: honor.sourceTitle, checkedAt: honor.checkedAt })) ?? [];
    return { id: definition.id, number: definition.number, kind: definition.kind, name: person?.name ?? definition.name,
      season: definition.season, cardUrl: collectionCardPath(definition.id), ...(person ? { personId: person.id } : {}), art,
      description: definition.description ?? facts[0]?.text ?? (person ? 'A competitor in the ARC Daily collection.' : 'A commissioned team card from the ARC Daily collection.'),
      profileUrl: person ? personPath(person.id) : entries[0].profileUrl,
      highlights: [...careerHonors, ...facts], accounts: person ? person.accounts.map(account => ({ label: account.handle, url: account.url }))
        : [...new Set(entries.flatMap(ref => ref.members.map(member => member.handle)))].map(handle => ({ label: handle, url: `https://www.kaggle.com/${encodeURIComponent(handle)}` })),
      entries, honors, artNotes: definition.artNotes, teamHistory: person ? playerTeamHistory(person, registry, teamCards, notebooks) : [],
    };
  });
  return { season: registry.season, commissionedBy: registry.commissionedBy, commissionedAt: registry.commissionedAt, updatedAt: registry.updatedAt, cards };
}

export function getNewsCollection(directory = NEWS_DIRECTORY): NewsCollection {
  const registry = cardRegistrySchema.parse(JSON.parse(fs.readFileSync(path.join(directory, 'cards.json'), 'utf8')));
  const resultFile = path.join(directory, 'card-results.json');
  const results = resultFile && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) as FinalCardResult[] : [];
  const collection = buildNewsCollection(registry, getNewsIndex(directory), results);
  for (const card of collection.cards) if (card.art) {
    const image = path.join(process.cwd(), 'client/public', card.art.src);
    if (!fs.existsSync(image)) throw Error('Missing collectible artwork: ' + card.art.src);
    if (card.art.artworkId) {
      const record = JSON.parse(fs.readFileSync(path.join(directory, 'artwork', `${card.art.artworkId}.json`), 'utf8'));
      if (record.rawSrc !== card.art.src) throw Error('Wrong collectible artwork binding: ' + card.id);
    }
  }
  return collection;
}
