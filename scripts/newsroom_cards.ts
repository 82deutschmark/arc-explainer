/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-29
 * PURPOSE: Maintain stable collectible numbers and dated board snapshots; import explicitly
 * official results idempotently without changing clean art, identities or earlier result revisions.
 * SRP/DRY check: Pass — uses the existing news ledgers, curated art registry and shared schemas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { KAGGLE_COMPETITIONS } from '../shared/kaggleCompetitions';
import { cardRegistrySchema, finalCardResultSchema, type CardDefinition, type CardRegistry, type CardSnapshot, type FinalCardResult } from '../shared/newsCollection';
import { activeCardResults, getNewsCollection } from '../server/services/news/newsCollection';
import { getNewsIndex, NEWS_DIRECTORY } from '../server/services/news/newsStore';
import type { NewsCompetition } from '../shared/news';
import type { KaggleBoardPayload } from '../shared/types';

const read = (name: string) => JSON.parse(fs.readFileSync(path.join(NEWS_DIRECTORY, name), 'utf8'));
const save = (name: string, value: unknown) => fs.writeFileSync(path.join(NEWS_DIRECTORY, name), JSON.stringify(value, null, 2) + '\n');
const command = process.argv[2] ?? 'check';
const now = new Date().toISOString();
if (command === 'import-results') {
  const input = process.argv[3];
  if (!input) throw Error('Usage: node --import tsx scripts/newsroom_cards.ts import-results <official-results.json>');
  const incoming = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(incoming)) throw Error('Results input must be an array');
  const results = read('card-results.json') as FinalCardResult[];
  for (const raw of incoming) {
    const result = finalCardResultSchema.parse(raw);
    if (Date.parse(result.confirmedAt) > Date.now()) throw Error('Cannot confirm a future result');
    const existing = results.find(item => item.id === result.id);
    if (existing && JSON.stringify(finalCardResultSchema.parse(existing)) !== JSON.stringify(result)) throw Error('Use a new ID and supersedesId for a correction');
    if (!existing) results.push(result);
  }
  activeCardResults(results);
  const registry = cardRegistrySchema.parse(read('cards.json'));
  if (results.some(result => result.season !== registry.season)) throw Error('Results do not belong to this card season');
  save('card-results.json', results);
  console.log(`Saved ${results.length} official result revisions; no artwork changed.`);
} else if (command === 'refresh') {
  const index = getNewsIndex();
  const registry: CardRegistry = fs.existsSync(path.join(NEWS_DIRECTORY, 'cards.json')) ? cardRegistrySchema.parse(read('cards.json'))
    : { version: 1, season: '2026', commissionedBy: 'Mark Barney', commissionedAt: now, updatedAt: now, cards: [], snapshots: [] };
  const visuals = read('visual-identities.json');
  const nextNumber = (kind: 'person' | 'team') => `${kind === 'person' ? 'P' : 'T'}${String(1 + Math.max(0, ...registry.cards.filter(card => card.kind === kind).map(card => Number(card.number.slice(1))))).padStart(3, '0')}`;
  const add = (card: Omit<CardDefinition, 'number' | 'issuedAt' | 'season'>) => {
    if (!registry.cards.some(old => old.id === card.id)) registry.cards.push({ ...card, number: nextNumber(card.kind), issuedAt: now, season: registry.season });
  };
  for (const person of index.people ?? []) add({ id: `person-${person.id}-2026`, kind: 'person', name: person.name, personId: person.id, entries: [], artNotes: [] });
  for (const subject of visuals.subjects.filter((item: any) => item.status === 'ready' && item.teamIds)) {
    const entries = Object.entries(subject.teamIds as Record<NewsCompetition, string[]>).flatMap(([competition, ids]) => ids.map(teamId => ({ competition: competition as NewsCompetition, competitionId: KAGGLE_COMPETITIONS[competition as NewsCompetition].slug, teamId })));
    if (!entries.length) continue;
    const reference = subject.references[0];
    add({ id: `team-${subject.id}-2026`, kind: 'team', name: subject.names[0], entries,
      art: { src: reference.src, alt: subject.description, credit: 'Commissioned ARC Daily character artwork', ...(reference.generationRecord ? { artworkId: reference.generationRecord } : {}), commissionedAt: reference.archivedAt ?? registry.commissionedAt },
      artNotes: subject.identityNotes ?? [], description: subject.description });
  }
  const extras = [
    { subject: 'turducken', name: 'Team Turducken', competition: 'arc-3' as const, teamId: '15605182', artworkId: '2026-10-18-turducken-whole-crew-flight-v1-base', note: 'Seven approved competitor characters and exactly two Yorkies; retain the established fictional bot/mascot roles.' },
    { subject: 'architects', name: 'The ARChitects', competition: 'arc-3' as const, teamId: '16032816', artworkId: '2026-10-26-architects-dream-team-base', note: 'David fox, Jan cat, Daniel duck and Sebastian mouse. Clean artwork; no old scoreboard.' },
    { subject: 'arc-mutants', name: 'ARC Mutants', competition: 'arc-2' as const, teamId: '17023174', artworkId: '2026-10-19-arc-mutants-academy-v1', note: 'Jack Cole, Mark Barney, Son Pham and a fictional opaque-helmet Ronen character; keep separate from ARC3 Turducken.' },
  ];
  for (const item of extras) {
    const recordPath = path.join(NEWS_DIRECTORY, 'artwork', `${item.artworkId}.json`);
    if (!fs.existsSync(recordPath)) continue;
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    add({ id: `team-${item.subject}-2026`, kind: 'team', name: item.name, entries: [{ competition: item.competition, competitionId: KAGGLE_COMPETITIONS[item.competition].slug, teamId: item.teamId }],
      art: { src: record.rawSrc, alt: item.name + ' commissioned team illustration', credit: 'Commissioned ARC Daily team artwork', artworkId: item.artworkId, commissionedAt: record.generatedAt ?? registry.commissionedAt }, artNotes: [item.note] });
  }
  // Explicit single-account mascots may illustrate an individual card without cropping a group.
  for (const [personId, subjectId] of [['yktori', 'yktori-team'], ['michaeltgao', 'mtg-team'], ['michal-gromadzki', 'majkel1337-team'], ['aquaursa-research', 'aquaursa-team']]) {
    const individual = registry.cards.find(card => card.personId === personId);
    const team = registry.cards.find(card => card.id === `team-${subjectId}-2026`);
    if (individual && team?.art && !individual.art) {
      individual.art = { ...team.art, credit: 'Newspaper-commissioned fictional account mascot' };
      individual.artNotes = ['Original newspaper mascot for this account; not an owner-selected avatar or a human likeness.'];
    }
  }
  for (const competition of ['arc-2', 'arc-3'] as const) {
    const url = `https://arc.markbarney.net/api/kaggle/${KAGGLE_COMPETITIONS[competition].slug}/board`;
    const response = await fetch(url);
    if (!response.ok) throw Error(`Board unavailable: ${competition}, HTTP ${response.status}`);
    const board = await response.json() as KaggleBoardPayload;
    const wanted = new Set([...registry.cards.flatMap(card => card.entries.filter(ref => ref.competition === competition).map(ref => ref.teamId)), ...(index.people ?? []).flatMap(person => person.memberships.filter(member => member.competition === competition).map(member => member.teamId))]);
    const snapshots: CardSnapshot[] = board.latest.rows.filter(row => wanted.has(row[1])).map(row => ({ competition, competitionId: KAGGLE_COMPETITIONS[competition].slug, teamId: row[1], observedAt: board.latest.fetched,
      teamName: row[2], rank: row[0], score: row[4], submissions: row[5], members: row[6].split(',').filter(Boolean), sourceUrl: url }));
    registry.snapshots = [...registry.snapshots.filter(row => row.competition !== competition), ...snapshots];
  }
  registry.updatedAt = now;
  cardRegistrySchema.parse(registry);
  save('cards.json', registry);
  if (!fs.existsSync(path.join(NEWS_DIRECTORY, 'card-results.json'))) save('card-results.json', []);
  console.log(`Card Cabinet: ${registry.cards.length} numbered cards; ${registry.snapshots.length} dated team snapshots.`);
} else if (command !== 'check') throw Error('Commands: refresh, import-results <file>, check');
const collection = getNewsCollection();
console.log(`Validated ${collection.cards.filter(card => card.kind === 'person').length} individuals and ${collection.cards.filter(card => card.kind === 'team').length} team cards.`);
