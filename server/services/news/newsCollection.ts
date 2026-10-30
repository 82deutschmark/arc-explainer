/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5
 * Date: 2026-10-30 (2026-10-29 earlier)
 * PURPOSE: Resolve the permanent Card Cabinet from curated card/art bindings, existing verified
 * people, dated board snapshots, linked player/team histories and explicitly official final
 * results. Never exposes desk drafts or infers a player's departure from roster absence.
 * Individual card entry preferences choose the lead contest without granting membership.
 * SRP/DRY check: Pass — newsStore owns identities; this projection owns collectible presentation.
 *
 * CHANGELOG
 * 30-Oct-2026 (Claude Sonnet 5.5 Medium, review fixes): getNewsCollection() is memoised for a few seconds and on the card files' modified
 *          times (an image request no longer re-reads and re-validates every file); every card carries setKey, the fingerprint of
 *          the set-level inputs a picture depends on, so an immutable image address cannot outlive a change to the set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { boardHistorySchema, cardRegistrySchema, careersFileSchema, hallOfFameSchema, type BoardHistory, type HallOfFameFile, type CollectionArchive, collectionCardPath, type CollectionCareer, finalCardResultSchema, type CardRegistry, type CollectionArt, type CollectionCard, type CollectionPastCard, type CollectionStory, type CollectionTeamHistory, type FinalCardResult, type NewsCollection } from '../../../shared/newsCollection';
import { competitionName, personPath, competitorPath, newsArticlePath, wirePath, reportedPeople, type NewsIndex, type NewsPerson } from '../../../shared/news';
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

const yearIn = (text: string): string | null => /\b(20\d\d)\b/u.exec(text)?.[1] ?? null;

/** Every earlier card we already hold for a person, newest season first. Nothing we made stays unlinked. */
function pastCardsFor(person: NewsPerson | undefined): CollectionPastCard[] {
  if (!person) return [];
  const seen = new Set<string>();
  return person.hallOfFame.map(card => ({
    season: yearIn(card.label), label: card.label, imageSrc: card.image?.src ?? null,
    imageAlt: card.image?.alt ?? `${person.name}, ${card.label}`, hallOfFameUrl: card.path, sourceUrl: card.sourceUrl, sourceTitle: card.sourceTitle,
  })).filter(card => !seen.has(`${card.hallOfFameUrl}|${card.imageSrc}`) && !!seen.add(`${card.hallOfFameUrl}|${card.imageSrc}`))
    .sort((a, b) => (b.season ?? '').localeCompare(a.season ?? ''));
}

/** Last year's card is the art for this year's card until a new rendering is registered (Boss, 30-Oct-2026). */
function lastYearArt(person: NewsPerson | undefined): CollectionArt | null {
  const latest = pastCardsFor(person).find(card => card.imageSrc);
  return person && latest?.imageSrc ? { src: latest.imageSrc, alt: latest.imageAlt, credit: `ARC Hall of Fame card, ${latest.label}` } : null;
}

/** The newest Digest stories (editions and wire) that cover a person or a team. */
function storiesFor(index: NewsIndex, articlePeople: Map<string, Set<string>>, person: NewsPerson | undefined, teams: { competition: string; teamId: string }[]): CollectionStory[] {
  const onTeam = (competition: string, ids: string[]) => teams.some(team => team.competition === competition && ids.includes(team.teamId));
  const editions: CollectionStory[] = index.articles.filter(article => person
    ? articlePeople.get(article.id)?.has(person.id) : onTeam(article.competition, article.teamIds))
    .map(article => ({ id: article.id, kind: 'edition' as const, headline: article.headline, url: newsArticlePath(article.id), publishedAt: article.publishedAt, competition: article.competition }));
  const wire: CollectionStory[] = (index.wire ?? []).filter(story => person ? story.personIds.includes(person.id) : onTeam(story.competition, story.teamIds))
    .map(story => ({ id: story.id, kind: 'wire' as const, headline: story.headline, url: wirePath(story.id), publishedAt: story.publishedAt, competition: story.competition }));
  return [...editions, ...wire].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8);
}

const HOUR_MS = 3_600_000;
/** The saved board nearest a standing, only if it was saved within the hour (team counts and cut scores move slowly). */
function boardNear(board: BoardHistory | null, competition: string, observedAt: string | null) {
  if (!board || !observedAt) return null;
  const at = Date.parse(observedAt);
  const nearest = (board.boards[competition] ?? []).map(row => ({ row, gap: Math.abs(Date.parse(row.t) - at) })).sort((a, b) => a.gap - b.gap)[0];
  return nearest && nearest.gap <= HOUR_MS ? nearest.row : null;
}
function zoneOf(score: number | null, saved: ReturnType<typeof boardNear>): 'gold' | 'silver' | 'bronze' | null {
  if (score == null || !saved) return null;
  return saved.gold != null && score >= saved.gold ? 'gold' : saved.silver != null && score >= saved.silver ? 'silver' : saved.bronze != null && score >= saved.bronze ? 'bronze' : null;
}

export function buildNewsCollection(registry: CardRegistry, index: NewsIndex, results: FinalCardResult[] = [], careers: Record<string, CollectionCareer> = {}, board: BoardHistory | null = null, hallOfFame: HallOfFameFile | null = null): NewsCollection {
  cardRegistrySchema.parse(registry);
  const final = activeCardResults(results);
  const people = index.people ?? [];
  // Who each edition names is worked out once per build: it is a name search over every section.
  const articlePeople = new Map(index.articles.map(article => [article.id, new Set(reportedPeople([article], people).map(item => item.id))] as const));
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
    // An ARC3 character card can lead with its ARC3 team while retaining other verified entries.
    if (person && definition.entries.length) {
      const priority = (ref: { competitionId: string; teamId: string }) => {
        const position = definition.entries.findIndex(entry => entry.competitionId === ref.competitionId && entry.teamId === ref.teamId);
        return position < 0 ? definition.entries.length : position;
      };
      entryRefs.sort((a, b) => priority(a) - priority(b));
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
        fieldSize: boardNear(board, ref.competition, snapshot?.observedAt ?? null)?.teams ?? null,
        peakRank: (() => { const peak = board?.peaks[`${ref.competition}:${ref.teamId}`]?.rank; const now = result?.rank ?? snapshot?.rank; return peak != null && now != null && peak < now ? peak : null; })(),
        zone: result ? null : zoneOf(snapshot?.score ?? null, boardNear(board, ref.competition, snapshot?.observedAt ?? null)),
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
    // Order of art: a registered commission, then last year's Hall of Fame card, then the person's editorial
    // rendering. A reference photo (Kaggle picture, web photo) is an input for the artists, never the card.
    const editorial = person?.editorialPortrait;
    const art = definition.art ?? lastYearArt(person)
      ?? (editorial ? { src: editorial.src, alt: editorial.alt, credit: editorial.sourceTitle, artworkId: editorial.artworkId } : null);
    const facts = person?.facts ?? index.competitors.filter(team => definition.entries.some(ref => ref.teamId === team.teamId && ref.competition === team.competition)).flatMap(team => team.facts);
    const careerHonors = person?.hallOfFame.map(honor => ({ text: honor.label, sourceUrl: honor.sourceUrl, sourceTitle: honor.sourceTitle, checkedAt: honor.checkedAt })) ?? [];
    return { id: definition.id, number: definition.number, kind: definition.kind, role: person ? person.role ?? 'competitor' as const : 'team' as const, name: person?.name ?? definition.name,
      season: definition.season, cardUrl: collectionCardPath(definition.id), ...(person ? { personId: person.id } : {}), art,
      description: definition.description ?? facts[0]?.text ?? (person ? 'A competitor in the ARC Daily collection.' : 'A commissioned team card from the ARC Daily collection.'),
      profileUrl: person ? personPath(person.id) : entries[0].profileUrl,
      highlights: [...careerHonors, ...facts], accounts: person ? person.accounts.map(account => ({ label: account.handle, url: account.url }))
        : [...new Set(entries.flatMap(ref => ref.members.map(member => member.handle)))].map(handle => ({ label: handle, url: `https://www.kaggle.com/${encodeURIComponent(handle)}` })),
      entries, honors, artNotes: definition.artNotes, teamHistory: person ? playerTeamHistory(person, registry, teamCards, notebooks) : [],
      pastCards: pastCardsFor(person), stories: storiesFor(index, articlePeople, person, entries),
      career: person ? careers[person.id] ?? null : null,
    };
  });
  const archive: CollectionArchive | null = hallOfFame ? {
    series: hallOfFame.series,
    cards: hallOfFame.cards.map(card => ({ ...card, cardUrls: people.filter(person => person.hallOfFame.some(honor => honor.path === card.path))
      .flatMap(person => personCards.has(`${registry.season}:${person.id}`) ? [{ name: person.name, url: personCards.get(`${registry.season}:${person.id}`)! }] : []) })),
  } : null;
  return { season: registry.season, commissionedBy: registry.commissionedBy, commissionedAt: registry.commissionedAt, updatedAt: registry.updatedAt, cards, archive };
}

/** Files the collection is built from, besides the news index; a change to any of them rebuilds the memo at once. */
const WATCHED = ['cards.json', 'card-results.json', 'careers.json', 'board-history.json', 'hall-of-fame.json', 'series.json'];
const MEMO_TTL_MS = 15_000;                   // the news index (stories on cards) is not watched file by file: it is re-read this often
let memo: { directory: string; stamp: string; at: number; collection: NewsCollection } | null = null;
const statStamp = (file: string) => { try { const s = fs.statSync(file); return `${s.mtimeMs}:${s.size}`; } catch { return '-'; } };

/** Fingerprint of everything outside a card that its picture prints: the set's size, tier counts, series rows and career extras. */
function setKeyOf(directory: string, cards: CollectionCard[]): string {
  const tiers: Record<string, number> = {};
  for (const card of cards) if (card.career?.tier) tiers[card.career.tier] = (tiers[card.career.tier] ?? 0) + 1;
  const kinds: Record<string, number> = {};
  for (const card of cards) kinds[card.number[0]] = (kinds[card.number[0]] ?? 0) + 1;
  const extrasDir = path.join(directory, 'evidence', 'kaggle-careers');
  const extras = fs.existsSync(extrasDir) ? fs.readdirSync(extrasDir).sort().map(f => `${f}:${statStamp(path.join(extrasDir, f))}`) : [];
  const series = fs.existsSync(path.join(directory, 'series.json')) ? fs.readFileSync(path.join(directory, 'series.json'), 'utf8') : '';
  const text = JSON.stringify([cards.length, tiers, kinds, extras, series]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export function getNewsCollection(directory = NEWS_DIRECTORY): NewsCollection {
  const stamp = WATCHED.map(f => statStamp(path.join(directory, f))).join('|');
  if (memo && memo.directory === directory && memo.stamp === stamp && Date.now() - memo.at < MEMO_TTL_MS) return memo.collection;
  const collection = buildCollectionFromFiles(directory);
  const setKey = setKeyOf(directory, collection.cards);
  for (const card of collection.cards) card.setKey = setKey;
  memo = { directory, stamp, at: Date.now(), collection };
  return collection;
}

function buildCollectionFromFiles(directory: string): NewsCollection {
  const registry = cardRegistrySchema.parse(JSON.parse(fs.readFileSync(path.join(directory, 'cards.json'), 'utf8')));
  const resultFile = path.join(directory, 'card-results.json');
  const results = resultFile && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) as FinalCardResult[] : [];
  const careerFile = path.join(directory, 'careers.json');
  const careers = fs.existsSync(careerFile) ? careersFileSchema.parse(JSON.parse(fs.readFileSync(careerFile, 'utf8'))).careers : {};
  const boardFile = path.join(directory, 'board-history.json');
  const board = fs.existsSync(boardFile) ? boardHistorySchema.parse(JSON.parse(fs.readFileSync(boardFile, 'utf8'))) : null;
  const hofFile = path.join(directory, 'hall-of-fame.json');
  const hallOfFame = fs.existsSync(hofFile) ? hallOfFameSchema.parse(JSON.parse(fs.readFileSync(hofFile, 'utf8'))) : null;
  const collection = buildNewsCollection(registry, getNewsIndex(directory), results, careers, board, hallOfFame);
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
