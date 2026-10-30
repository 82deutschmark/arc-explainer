/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Resolve the permanent Card Cabinet from curated card/art bindings, existing verified
 * people, dated board snapshots and explicitly official final results. Never exposes desk drafts.
 * SRP/DRY check: Pass — newsStore owns identities; this projection owns collectible presentation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cardRegistrySchema, finalCardResultSchema, type CardRegistry, type CollectionCard, type FinalCardResult, type NewsCollection } from '../../../shared/newsCollection';
import { displayPortrait, personPath, competitorPath, type NewsIndex } from '../../../shared/news';
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

export function buildNewsCollection(registry: CardRegistry, index: NewsIndex, results: FinalCardResult[] = []): NewsCollection {
  cardRegistrySchema.parse(registry);
  const final = activeCardResults(results);
  const people = index.people ?? [];
  const byHandle = new Map(people.flatMap(person => person.accounts.filter(account => account.platform === 'kaggle').map(account => [account.handle, person] as const)));
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
        status: result ? 'final' as const : snapshot ? 'public' as const : 'unavailable' as const,
        members: roster.map(handle => { const owner = byHandle.get(handle); return { handle, name: owner?.name ?? handle, ...(owner ? { personId: owner.id } : {}) }; }),
      };
    });
    const portrait = person && displayPortrait(person);
    const art = definition.art ?? (portrait ? { src: portrait.src, alt: portrait.alt, credit: portrait.sourceTitle, ...('artworkId' in portrait ? { artworkId: portrait.artworkId } : {}) } : null);
    const facts = person?.facts ?? index.competitors.filter(team => definition.entries.some(ref => ref.teamId === team.teamId && ref.competition === team.competition)).flatMap(team => team.facts);
    const careerHonors = person?.hallOfFame.map(honor => ({ text: honor.label, sourceUrl: honor.sourceUrl, sourceTitle: honor.sourceTitle, checkedAt: honor.checkedAt })) ?? [];
    return { id: definition.id, number: definition.number, kind: definition.kind, name: person?.name ?? definition.name,
      season: definition.season, ...(person ? { personId: person.id } : {}), art,
      description: definition.description ?? facts[0]?.text ?? (person ? 'A competitor in the ARC Daily collection.' : 'A commissioned team card from the ARC Daily collection.'),
      profileUrl: person ? personPath(person.id) : competitorPath(`${definition.entries[0].competition}-${definition.entries[0].teamId}`),
      highlights: [...careerHonors, ...facts].slice(0, 4), accounts: person ? person.accounts.map(account => ({ label: account.handle, url: account.url }))
        : [...new Set(entries.flatMap(ref => ref.members.map(member => member.handle)))].map(handle => ({ label: handle, url: `https://www.kaggle.com/${encodeURIComponent(handle)}` })),
      entries, honors, artNotes: definition.artNotes,
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
