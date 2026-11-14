/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex; GPT-6.1 Sol / Codex; Claude Sonnet 5.5; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5, archive-collection): getNewsCollection checks its memo (watched files, board generation,
 *          TTL) before reading the news index; each artwork is hashed once per path, modified time and size; a person
 *          card with no verified person, or a card whose artwork is missing or fails its digest, is left out and
 *          recorded instead of failing the whole Cabinet; goose-wiki.json read failures are caught; a failed rebuild
 *          serves the last good collection; tryNewsCollection and newsCollectionHealth serve pages and /api/news/health.
 * 14-Nov-2026 (Claude Opus 5.5): highlights no longer repeat Hall of Fame honours or completed-competition rows; team
 *          cards carry no account list (their rosters are listed with names).
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
 * 09-Nov-2026 (GPT-6 / Codex): contest card evidence and regression checks.
 * PURPOSE: Resolve the permanent Card Cabinet from curated card/art bindings, existing verified
 * people, dated board snapshots, linked player/team histories and explicitly official final
 * results. Never exposes desk drafts or infers a player's departure from roster absence.
 * Individual card entry preferences choose the lead contest without granting membership.
 * SRP/DRY check: Pass — newsStore owns identities; this projection owns collectible presentation.
 *
 * CHANGELOG
 * 02-Nov-2026: Preserve an unlinked roster member's handle rather than referencing an out-of-scope variable.
 * 30-Oct-2026 (Claude Sonnet 5.5 Medium, review fixes): getNewsCollection() is memoised for a few seconds and on the card files' modified
 *          times (an image request no longer re-reads and re-validates every file); every card carries setKey, the fingerprint of
 *          the set-level inputs a picture depends on, so an immutable image address cannot outlive a change to the set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { boardHistorySchema, cardRegistrySchema, careersFileSchema, hallOfFameSchema, type BoardHistory, type HallOfFameFile, type CollectionArchive, collectionCardPath, type CollectionCareer, finalCardResultSchema, type CardRegistry, type CollectionArt, type CollectionCard, type CollectionPastCard, type CollectionStory, type CollectionTeamHistory, type FinalCardResult, type NewsCollection } from '../../../shared/newsCollection';
import { competitionName, personPath, competitorPath, newsArticlePath, wirePath, reportedPeople, type NewsIndex, type NewsPerson } from '../../../shared/news';
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import { describeProblem, getNewsIndex, NEWS_DIRECTORY, type NewsSkip } from './newsStore';
import { loadSeriesFile } from './cardFace/sets';
import { loadWikiInputs } from './wikiInputs';
import { cardBoardCache, cardBoardStatus, freshCardRows } from './cardBoards';

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

type TeamCardLookup = (row: { competitionId: string; teamId: string }, season: string, setId?: string) => string | undefined;
function playerTeamHistory(person: NewsPerson, registry: CardRegistry, teamCard: TeamCardLookup, notebooks: Map<string, string>, final: FinalCardResult[], competitors: NewsIndex['competitors'], setId?: string): CollectionTeamHistory[] {
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
  // Team notebooks can document members even when no current board is available.
  for (const team of competitors) {
    const competition = KAGGLE_COMPETITIONS[team.competition];
    if (!competition?.season) continue;
    for (const handle of team.members) if (handles.has(handle)) add({
      competition: team.competition, competitionId: competition.slug, season: competition.season,
      teamId: team.teamId, teamName: team.name, memberHandle: handle,
      firstObservedAt: team.firstObservedAt, lastObservedAt: team.lastObservedAt,
      sourceUrl: `https://www.kaggle.com/competitions/${encodeURIComponent(competition.slug)}/leaderboard?teamId=${encodeURIComponent(team.teamId)}`,
      sourceTitle: `${competitionName(team.competition)} recorded team roster`,
    });
  }
  // Official credited rosters are also positive membership evidence for the reverse link.
  for (const result of final) for (const handle of result.creditedHandles) if (handles.has(handle)) add({
    competition: result.competition, competitionId: result.competitionId, season: result.season,
    teamId: result.teamId, teamName: registry.cards.find(card => card.kind === 'team' && card.season === result.season && card.entries.some(entry => teamKey(entry) === teamKey(result)))?.name ?? observed.get(`${result.season}:${teamKey(result)}`)?.teamName ?? `Team ${result.teamId}`,
    memberHandle: handle, firstObservedAt: result.confirmedAt, lastObservedAt: result.confirmedAt,
    sourceUrl: result.sourceUrl, sourceTitle: result.sourceTitle,
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
      : !latestBoard.has(contestKey(row)) || seen < latestBoard.get(contestKey(row))! || row.season !== registry.season ? 'last-observed' : 'current';
    const cardUrl = teamCard(row, row.season, setId);
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

/** Where buildNewsCollection records a card it leaves out, and the registry file to name in that record. */
export interface CollectionReport { skipped: NewsSkip[]; file: string }

export function buildNewsCollection(source: CardRegistry, index: NewsIndex, results: FinalCardResult[] = [], careers: Record<string, CollectionCareer> = {}, board: BoardHistory | null = null, hallOfFame: HallOfFameFile | null = null, sets: NewsCollection['sets'] = [], report?: CollectionReport): NewsCollection {
  cardRegistrySchema.parse(source);
  const final = activeCardResults(results);
  const people = index.people ?? [];
  // newsStore leaves out an invalid or conflicting person on its own. That person's card is left out and recorded
  // here, before any lookup is built, so no other card links to it and the rest of the Cabinet still renders.
  const registry: CardRegistry = { ...source, cards: source.cards.filter(card => {
    if (card.kind !== 'person' || people.some(person => person.id === card.personId)) return true;
    report?.skipped.push({ file: report.file, record: card.id, reason: `card has no verified person (${card.personId ?? 'none named'})` });
    return false;
  }) };
  // Match each edition's verified cast once for the card cabinet's story links.
  const articlePeople = new Map(index.articles.map(article => [article.id, new Set(reportedPeople([article], people).map(item => item.id))] as const));
  const byHandle = new Map(people.flatMap(person => person.accounts.filter(account => account.platform === 'kaggle').map(account => [account.handle.toLowerCase(), person] as const)));
  const teamEditions = new Map<string, CardRegistry['cards']>();
  const personEditions = new Map<string, CardRegistry['cards']>();
  for (const card of registry.cards) {
    if (card.kind === 'person') {
      const key = `${card.season}:${card.personId}`;
      personEditions.set(key, [...(personEditions.get(key) ?? []), card]);
    } else for (const row of card.entries) {
      const key = `${card.season}:${teamKey(row)}`;
      teamEditions.set(key, [...(teamEditions.get(key) ?? []), card]);
    }
  }
  const choose = (matches: CardRegistry['cards'], setId?: string, preferSet = true) => (preferSet ? matches.find(card => card.setId === setId) : undefined)
    ?? [...matches].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt) || a.id.localeCompare(b.id))[0];
  const teamCard: TeamCardLookup = (row, season, setId) => {
    const selected = choose(teamEditions.get(`${season}:${teamKey(row)}`) ?? [], setId);
    return selected ? collectionCardPath(selected.id) : undefined;
  };
  const personCard = (season: string, personId: string, setId?: string, preferSet = true) => {
    const selected = choose(personEditions.get(`${season}:${personId}`) ?? registry.cards.filter(card => card.kind === 'person' && card.personId === personId), setId, preferSet);
    return selected ? collectionCardPath(selected.id) : undefined;
  };
  const notebooks = new Map<string, string>(index.competitors.map(team => [`${KAGGLE_COMPETITIONS[team.competition].slug}:${team.teamId}`, competitorPath(team.id)] as const));
  const cards: CollectionCard[] = registry.cards.map(definition => {
    const person = people.find(item => item.id === definition.personId);
    const handles = new Set(person?.accounts.filter(account => account.platform === 'kaggle').map(account => account.handle));
    const set = definition.setId ? sets.find(row => row.id === definition.setId) : undefined;
    // A general set has no contest restriction. An unknown set must not acquire unrelated results.
    const scopedIds = set ? (set.competitionIds.length ? set.competitionIds : undefined)
      : definition.setId ? definition.entries.map(row => row.competitionId) : undefined;
    const inSet = (row: { competitionId: string }) => !scopedIds || scopedIds.includes(row.competitionId);
    const entryRefs = definition.kind === 'team' ? [...definition.entries]
      : definition.season === registry.season ? registry.snapshots.filter(row => inSet(row) && row.members.some(handle => handles.has(handle))) : [];
    // When the board cache is absent, retain only the latest positively observed team
    // in each contest. This is a dated roster reference, not a standing or a transfer.
    const membershipRefs = new Map<string, NewsPerson['memberships'][number]>();
    if (person) {
      for (const row of person.memberships) {
        if (row.season !== definition.season || !handles.has(row.memberHandle) || !inSet(row)) continue;
        const prior = membershipRefs.get(contestKey(row));
        if (!prior || Date.parse(row.lastObservedAt) > Date.parse(prior.lastObservedAt)) membershipRefs.set(contestKey(row), row);
      }
      for (const row of membershipRefs.values()) {
        if (definition.season === registry.season && registry.snapshots.some(snapshot => snapshot.competitionId === row.competitionId && snapshot.members.some(handle => handles.has(handle))
          && Date.parse(snapshot.observedAt) > Date.parse(row.lastObservedAt))) continue;
        // A snapshot or final result for this team has its own authoritative roster.
        if ((definition.season === registry.season && registry.snapshots.some(snapshot => teamKey(snapshot) === teamKey(row))) || final.some(result => result.season === row.season && teamKey(result) === teamKey(row))) continue;
        if (!entryRefs.some(ref => teamKey(ref) === teamKey(row))) entryRefs.push(row);
      }
    }
    // An official credited roster can reconnect a former member without using today's roster.
    if (person) for (const row of final.filter(row => row.season === definition.season && inSet(row) && row.creditedHandles.some(handle => handles.has(handle)))) {
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
      const snapshot = definition.season === registry.season ? registry.snapshots.find(row => row.competitionId === ref.competitionId && row.teamId === ref.teamId) : undefined;
      const membership = person ? membershipRefs.get(contestKey({ ...ref, season: definition.season })) : undefined;
      const rosterObservation = membership && teamKey(membership) === teamKey(ref) ? membership : undefined;
      const notebook = index.competitors.find(team => team.competition === ref.competition && team.teamId === ref.teamId
        && (!person || (rosterObservation && Date.parse(team.lastObservedAt) === Date.parse(rosterObservation.lastObservedAt) && team.members.includes(rosterObservation.memberHandle))));
      const result = final.find(row => row.season === definition.season && row.competitionId === ref.competitionId && row.teamId === ref.teamId
        && (!person || row.creditedHandles.some(handle => handles.has(handle))));
      if (result) {
        const credit = { competition: ref.competition, season: result.season, sourceUrl: result.sourceUrl, sourceTitle: result.sourceTitle, scope: 'team' as const };
        if (result.medal) honors.push({ ...credit, label: `${result.medal[0].toUpperCase()}${result.medal.slice(1)} medal`, kind: 'kaggle-medal' });
        honors.push(...result.awards.map(award => ({ ...credit, label: award.label, kind: award.kind })));
      }
      // An empty board roster supplies no membership evidence. Keep the recorded roster
      // for this exact entry when the board only provides standings.
      const roster = result?.creditedHandles ?? (snapshot?.members.length ? snapshot.members : notebook?.members ?? []);
      const cardUrl = teamCard(ref, definition.season, definition.setId);
      return { competition: ref.competition, competitionId: ref.competitionId, teamId: ref.teamId,
        teamName: snapshot?.teamName ?? rosterObservation?.teamName ?? index.competitors.find(team => team.teamId === ref.teamId && team.competition === ref.competition)?.name ?? definition.name,
        observedAt: result?.confirmedAt ?? snapshot?.observedAt ?? rosterObservation?.lastObservedAt ?? notebook?.lastObservedAt ?? null, rank: result?.rank ?? snapshot?.rank ?? null,
        score: result ? result.score : snapshot?.score ?? null, submissions: result ? null : snapshot?.submissions ?? null,
        fieldSize: result ? null : boardNear(board, ref.competition, snapshot?.observedAt ?? null)?.teams ?? null,
        peakRank: (() => { const peak = board?.peaks[`${ref.competition}:${ref.teamId}`]?.rank; const now = result?.rank ?? snapshot?.rank; return peak != null && now != null && peak < now ? peak : null; })(),
        zone: result ? null : zoneOf(snapshot?.score ?? null, boardNear(board, ref.competition, snapshot?.observedAt ?? null)),
        sourceUrl: result?.sourceUrl ?? snapshot?.sourceUrl ?? rosterObservation?.sourceUrl ?? `https://www.kaggle.com/competitions/${encodeURIComponent(ref.competitionId)}/leaderboard?teamId=${encodeURIComponent(ref.teamId)}`,
        ...(cardUrl ? { cardUrl } : {}),
        profileUrl: notebooks.get(teamKey(ref)) ?? result?.sourceUrl ?? snapshot?.sourceUrl ?? rosterObservation?.sourceUrl
          ?? `https://www.kaggle.com/competitions/${encodeURIComponent(ref.competitionId)}/leaderboard`,
        status: result ? 'final' as const : snapshot ? 'public' as const : 'unavailable' as const,
        members: roster.map(handle => {
          const owner = byHandle.get(handle.toLowerCase());
          const cardUrl = owner && personCard(definition.season, owner.id, definition.setId);
          return { handle, name: owner?.name ?? handle, ...(owner ? { personId: owner.id } : {}), ...(cardUrl ? { cardUrl } : {}) };
        }),
      };
    });
    // Order of art: a registered commission, then last year's Hall of Fame card, then the person's editorial
    // rendering, unless the editor has disabled fallback for that card. A reference photo is an
    // artist input, never a finished individual card.
    const editorial = person?.editorialPortrait;
    const art = definition.art ?? (definition.artFallback === 'none' ? null : lastYearArt(person)
      ?? (editorial ? { src: editorial.src, alt: editorial.alt, credit: editorial.sourceTitle, artworkId: editorial.artworkId } : null));
    const facts = person?.facts ?? index.competitors.filter(team => definition.entries.some(ref => ref.teamId === team.teamId && ref.competition === team.competition)).flatMap(team => team.facts);
    const career = person ? careers[person.id] ?? null : null;
    // Hall of Fame honours already show as earlier cards and the earned line, so they are not restated as facts; a fact
    // that only repeats a completed-competition row (same contest, same "of N" field) is already in the career table.
    const restatesCareerRow = (text: string) => !!career?.rows.some(row => text.includes(row.competition) && text.includes(`of ${row.fieldSize.toLocaleString('en-US')}`));
    const highlights = facts.filter(fact => !restatesCareerRow(fact.text));
    return { id: definition.id, kind: definition.kind, setId: definition.setId, ...(definition.previousTeamCardId ? { previousTeamCardId: definition.previousTeamCardId } : {}), role: person ? person.role ?? 'competitor' as const : 'team' as const, name: person?.name ?? definition.name,
      season: definition.season, cardUrl: collectionCardPath(definition.id), ...(person ? { personId: person.id } : {}), art, backArt: definition.backArt,
      description: definition.description ?? person?.briefing ?? facts[0]?.text ?? (person ? 'A Kaggle competitor. Follow the linked sources for current standings.' : 'A commissioned Kaggle team card. Follow the linked source for current standings.'),
      biography: definition.biography,
      profileUrl: person ? personPath(person.id) : entries[0].profileUrl,
      // A team card's roster is already listed (with names and cards) under its recorded rosters; it has no accounts of its own.
      highlights, accounts: person ? person.accounts.map(account => ({ label: account.handle, url: account.url })) : [],
      entries, honors, artNotes: definition.artNotes, teamHistory: person ? playerTeamHistory(person, registry, teamCard, notebooks, final, index.competitors, definition.setId) : [],
      pastCards: pastCardsFor(person), stories: storiesFor(index, articlePeople, person, entries),
      career,
    };
  });
  const archive: CollectionArchive | null = hallOfFame ? {
    series: hallOfFame.series,
    cards: hallOfFame.cards.map(card => ({ ...card, cardUrls: people.filter(person => person.hallOfFame.some(honor => honor.path === card.path))
      .flatMap(person => { const url = personCard(registry.season, person.id, undefined, false); return url ? [{ name: person.name, url }] : []; }) })),
  } : null;
  return { season: registry.season, commissionedBy: registry.commissionedBy, commissionedAt: registry.commissionedAt, updatedAt: registry.updatedAt, cards, archive };
}

/** Files the collection is built from, besides the news index; a change to any of them rebuilds the memo at once. */
const WATCHED = ['goose-wiki.json', 'cards.json', 'card-results.json', 'careers.json', 'board-history.json', 'hall-of-fame.json', 'series.json'];
const MEMO_TTL_MS = 15_000;                   // the news index (stories on cards) is not watched file by file: it is re-read this often
const MEMO_LIMIT = 4;                         // the live directory plus a few test or script directories
type Memo = { stamp: string; generation: number | null; at: number; collection: NewsCollection; skipped: NewsSkip[] };
/** The last good build per directory, and the last failed one (so a broken input is not rebuilt on every request). */
const memos = new Map<string, Memo>();
const failures = new Map<string, { stamp: string; generation: number | null; at: number; error: string }>();
const statStamp = (file: string) => { try { const s = fs.statSync(file); return `${s.mtimeMs}:${s.size}`; } catch { return '-'; } };
const fresh = (at: number, now: number) => now >= at && now - at < MEMO_TTL_MS;
const remember = <T,>(map: Map<string, T>, directory: string, value: T) => {
  map.delete(directory);
  map.set(directory, value);
  while (map.size > MEMO_LIMIT) map.delete(map.keys().next().value!);
};

/** Fingerprint of everything outside a card that its picture prints: the set's size, tier counts, series rows and career extras. */
function setKeyOf(directory: string, cards: CollectionCard[], wiki: ReturnType<typeof loadWikiInputs>): string {
  const tiers: Record<string, number> = {};
  for (const card of cards) if (card.career?.tier) tiers[card.career.tier] = (tiers[card.career.tier] ?? 0) + 1;
  const kinds: Record<string, number> = {};
  for (const card of cards) kinds[card.kind] = (kinds[card.kind] ?? 0) + 1;
  const extrasDir = path.join(directory, 'evidence', 'kaggle-careers');
  const extras = fs.existsSync(extrasDir) ? fs.readdirSync(extrasDir).sort().map(f => `${f}:${statStamp(path.join(extrasDir, f))}`) : [];
  const series = wiki?.series ?? (fs.existsSync(path.join(directory, 'series.json')) ? fs.readFileSync(path.join(directory, 'series.json'), 'utf8') : '');
  const text = JSON.stringify([cards.length, tiers, kinds, extras, series, wiki?.fingerprint]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/**
 * The Card Cabinet, memoised per directory. The memo is checked before anything is read: it holds while the watched
 * files and the board generation are unchanged and it is younger than MEMO_TTL_MS. A failed rebuild is recorded for
 * /api/news/health and the last good collection is served; with no good build yet, the error is thrown.
 */
export function getNewsCollection(directory = NEWS_DIRECTORY): NewsCollection {
  const stamp = WATCHED.map(f => statStamp(path.join(directory, f))).join('|');
  const now = Date.now();
  const memo = memos.get(directory);
  const generation = cardBoardStatus(directory).generation;
  if (memo && memo.stamp === stamp && memo.generation === generation && fresh(memo.at, now)) return memo.collection;
  const failed = failures.get(directory);
  if (failed && failed.stamp === stamp && failed.generation === generation && fresh(failed.at, now)) {
    if (memo) return memo.collection;
    throw Error(failed.error);
  }
  try {
    const skipped: NewsSkip[] = [];
    const wiki = wikiInputsOrThrow(directory);
    const collection = buildCollectionFromFiles(directory, wiki, skipped);
    const setKey = setKeyOf(directory, collection.cards, wiki);
    for (const card of collection.cards) card.setKey = setKey;
    // Read the generation after the build: the build is what creates the board cache for a new directory.
    remember(memos, directory, { stamp, generation: cardBoardStatus(directory).generation, at: now, collection, skipped });
    failures.delete(directory);
    return collection;
  } catch (error) {
    const reason = `The Card Cabinet could not be built: ${describeProblem(error)}`;
    if (failed?.error !== reason) console.warn(`[news] ${reason}`);
    remember(failures, directory, { stamp, generation: cardBoardStatus(directory).generation, at: now, error: reason });
    if (memo) return memo.collection;
    throw Error(reason);
  }
}

/** The collection, or null when it cannot be built. For pages that can render without cards (stories, profiles, sitemap). */
export function tryNewsCollection(directory = NEWS_DIRECTORY): NewsCollection | null {
  try { return getNewsCollection(directory); } catch { return null; }
}

/** What /api/news/health reports about the Cabinet: cards left out, a failed build and a failed board read. */
export function newsCollectionHealth(directory = NEWS_DIRECTORY): { skipped: NewsSkip[]; error?: string; boards?: string } {
  tryNewsCollection(directory);
  const failed = failures.get(directory);
  const boards = cardBoardStatus(directory).error;
  return { skipped: memos.get(directory)?.skipped ?? [], ...(failed ? { error: failed.error } : {}), ...(boards ? { boards } : {}) };
}

/** goose-wiki.json, named in the error when it cannot be read; newsStore reports the same file for the index. */
function wikiInputsOrThrow(directory: string): ReturnType<typeof loadWikiInputs> {
  try { return loadWikiInputs(directory); }
  catch (error) { throw Error(`goose-wiki.json: ${describeProblem(error)}`); }
}

/** SHA-256 of an artwork file, computed once per path, modified time and size (cards often share one file). */
const artworkDigests = new Map<string, { stamp: string; digest: string }>();
const warnedCards = new Set<string>();       // each left-out card is logged once, not on every rebuild
function artworkDigest(image: string): string | null {
  let stamp: string;
  try { const stat = fs.statSync(image); stamp = `${stat.mtimeMs}:${stat.size}`; } catch { return null; }
  const known = artworkDigests.get(image);
  if (known?.stamp === stamp) return known.digest;
  const digest = createHash('sha256').update(fs.readFileSync(image)).digest('hex');
  artworkDigests.set(image, { stamp, digest });
  return digest;
}

/** Why a card's artwork cannot be shown, or null when it checks out. */
function artworkProblem(card: CollectionCard, wiki: ReturnType<typeof loadWikiInputs>, directory: string): string | null {
  if (!card.art) return null;
  const image = path.join(process.cwd(), 'client/public', card.art.src);
  const actual = artworkDigest(image);
  if (actual === null) return `missing collectible artwork ${card.art.src}`;
  if (wiki) return wiki.assetDigests[card.art.src] === actual ? null : `artwork digest mismatch for ${card.art.src}`;
  if (!card.art.artworkId) return null;
  try {
    const record = JSON.parse(fs.readFileSync(path.join(directory, 'artwork', `${card.art.artworkId}.json`), 'utf8'));
    return record.rawSrc === card.art.src ? null : `wrong collectible artwork binding for ${card.art.src}`;
  } catch (error) {
    return `artwork record ${card.art.artworkId} unreadable: ${describeProblem(error)}`;
  }
}

function buildCollectionFromFiles(directory: string, wiki: ReturnType<typeof loadWikiInputs>, skipped: NewsSkip[]): NewsCollection {
  const index = getNewsIndex(directory);
  const registryFile = wiki ? 'goose-wiki.json' : 'cards.json';
  const registry = wiki ? { ...wiki.registry, snapshots: freshCardRows(cardBoardCache(directory, wiki.registry, index)) }
    : cardRegistrySchema.parse(JSON.parse(fs.readFileSync(path.join(directory, 'cards.json'), 'utf8')));
  const resultFile = path.join(directory, 'card-results.json');
  const results = wiki?.results ?? (resultFile && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) as FinalCardResult[] : []);
  const careerFile = path.join(directory, 'careers.json');
  const careers = wiki?.careers ?? (fs.existsSync(careerFile) ? careersFileSchema.parse(JSON.parse(fs.readFileSync(careerFile, 'utf8'))).careers : {});
  const boardFile = path.join(directory, 'board-history.json');
  const board = !wiki && fs.existsSync(boardFile) ? boardHistorySchema.parse(JSON.parse(fs.readFileSync(boardFile, 'utf8'))) : null;
  const hofFile = path.join(directory, 'hall-of-fame.json');
  const hallOfFame = fs.existsSync(hofFile) ? hallOfFameSchema.parse(JSON.parse(fs.readFileSync(hofFile, 'utf8'))) : null;
  const sets = loadSeriesFile(directory).sets.map(set => ({ id: set.id, name: set.setName, season: set.season, competitionIds: set.competitionIds ?? [] }));
  const build = (source: CardRegistry, report: NewsSkip[]) => buildNewsCollection(source, index, results, careers, board, hallOfFame, sets, { skipped: report, file: registryFile });
  let report: NewsSkip[] = [];
  let collection = build(registry, report);
  // A card whose artwork is missing or is not the approved file is left out. The rebuild without it keeps every
  // other card's links (teammates, team history) from pointing at a card that is not there.
  const bad = new Map(collection.cards.flatMap(card => { const problem = artworkProblem(card, wiki, directory); return problem ? [[card.id, problem] as const] : []; }));
  if (bad.size) {
    report = [];
    collection = build({ ...registry, cards: registry.cards.filter(card => !bad.has(card.id)) }, report);
    for (const [id, reason] of bad) report.push({ file: registryFile, record: id, reason });
  }
  skipped.push(...report);
  for (const entry of report) {
    const key = `${entry.record}|${entry.reason}`;
    if (!warnedCards.has(key)) { warnedCards.add(key); console.warn(`[news] left out card ${entry.record}: ${entry.reason}`); }
  }
  collection.sets = sets;
  return collection;
}
