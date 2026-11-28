/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. One rule for every story's "In this story" cards, replacing the hand-typed
 *          card list (selectedStoryCards) that showed Franzen's old card and nobody else the story named.
 * PURPOSE: Choose, for any published story (dispatch or edition), the ordered cards its "In this story" block shows:
 *          1. the people the story lists, then anyone on its dated board or named in its words who holds a card for the
 *             story's contest (exact card name, verified Kaggle handle or recorded team name; teams with a team card too);
 *          2. for the subject every card they hold, best first (the newest special edition such as the Kaggleverse career
 *             card, else the newest card for the story's contest), the rest newest issued first, then their Hall of Fame
 *             cards (Franzen: Kaggleverse, then his ARC Prize card, then the ARChitects card); for everyone else their best card;
 *          3. the story's subject first, then the others in board order, then the rest in the order the text names them;
 *          4. hand-typed card faces only move a person forward or add a back face; they never limit the list;
 *          5. the first card is marked as the lead so the layout can show it large; past a dozen cards the rest of the
 *             cast is listed by name, each linking to their card, so a thirty-team edition is not a wall of cards.
 *          The browser component and the server HTML both call storyCast(), so they always show the same cards.
 * SRP/DRY check: Pass. Reuses the collection's cards, sets, entries and Hall of Fame records, catalogSet and
 *          catalogCardVisible from the catalog, and the shared card image version; it matches names exactly and never guesses.
 */
import { catalogCardVisible, catalogSet, catalogSetLabel } from './cardCatalog';
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import { competitionName, type NewsCompetition, type StoryCardFace } from './news';
import { collectionShareVersion, type CollectionCard, type NewsCollection } from './newsCollection';

/** What the rule reads from a story. A NewsArticle and a NewsDispatch both fit. */
export interface StoryCastSource {
  competition: NewsCompetition; competitions?: readonly NewsCompetition[];
  personIds?: readonly string[]; cardFaces?: readonly StoryCardFace[];
  headline?: string; dek?: string;
  sections: readonly { heading?: string; text: string; standings?: { rows: readonly { teamId: string; name: string }[] } }[];
  stats?: readonly { teamId: string; name: string }[];
}

/** One card in the block, ready for either renderer. */
export interface StoryCastTile {
  key: string;
  /** A card from the collection, or a Hall of Fame card kept from an earlier season. */
  kind: 'card' | 'hall-of-fame';
  cardId: string | null; personId: string | null; side: 'front' | 'back';
  /** The two short lines printed under the card: who, then which set or contest. */
  name: string; set: string;
  alt: string; href: string; src: string; width: number; height: number;
  /** The story's first card, shown large. */
  lead: boolean;
}

/** Someone in the story past the tile budget, printed as a name that links to their card. */
export interface StoryCastMore { key: string; name: string; href: string }
export interface StoryCast { tiles: StoryCastTile[]; more: StoryCastMore[] }
/** Cards drawn before the rest of the cast is listed by name: the lead and two rows beside and under it. */
export const STORY_CAST_TILE_LIMIT = 12;

/** One person or team in the story: an identity that owns cards. */
interface Member { key: string; personId: string | null; cards: CollectionCard[] }

const normalise = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const issued = (card: CollectionCard) => Date.parse(card.issuedAt ?? '') || 0;
const memberKey = (card: CollectionCard) => card.personId ? `person:${card.personId}` : `team:${normalise(card.name)}`;
const slugFor = (competition: string) => KAGGLE_COMPETITIONS[competition]?.slug ?? competition;
const keyForSlug = (slug: string) => Object.keys(KAGGLE_COMPETITIONS).find(key => KAGGLE_COMPETITIONS[key].slug === slug);

/** Board lines the desks type into a section: "#1  Daniel Franzen  ·  0.554  ·  6  ·  17:11". The team is the first field. */
const BOARD_LINE = /^\s*#\d[\d,]*\s+(.+?)\s+·/gmu;
function boardNames(story: StoryCastSource): { teamId: string | null; name: string }[] {
  const rows: { teamId: string | null; name: string }[] = [...(story.stats ?? [])];
  for (const section of story.sections) {
    rows.push(...(section.standings?.rows ?? []));
    for (const match of section.text.matchAll(BOARD_LINE)) rows.push({ teamId: null, name: match[1] });
  }
  return rows;
}

/**
 * Where a whole name first appears in the text (case and accents exact, not inside a longer word), or -1. A bare
 * capitalised first name ("Jack", "Jules") is too common to be evidence and is not looked for; handles such as
 * "matsu997" or "DECEM" are.
 */
function namedIn(text: string, name: string): number {
  if (name.length < 3 || /^\p{Lu}\p{Ll}+$/u.test(name)) return -1;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').exec(text)?.index ?? -1;
}

/** The short set or contest line under a card: "Kaggleverse 2026", "ARC-AGI-3", "Generalist Gaming Agent". */
export function storyCastSetLabel(card: CollectionCard, sets: NewsCollection['sets'] = []): string {
  if (card.kind === 'team' && card.entries.length === 1) return competitionName(card.entries[0].competition);
  const set = catalogSet(card, sets);
  const only = set?.competitionIds.length === 1 ? keyForSlug(set.competitionIds[0]) : undefined;
  return only ? competitionName(only) : catalogSetLabel(card, sets);
}

/**
 * The ordered cards for a story. Pass the feature and its edition together when a page shows both (feature first):
 * their cast, boards and words are read as one story about the first one's contest(s).
 */
export function storyCast(collection: NewsCollection, stories: readonly StoryCastSource[]): StoryCast {
  if (!stories.length) return { tiles: [], more: [] };
  const sets = collection.sets ?? [];
  const competitions = [...new Set(stories.flatMap(story => [story.competition, ...(story.competitions ?? [])]))];
  const slugs = new Set(competitions.map(slugFor));
  // Hidden bare faces stay out of the story row just as they stay out of the catalog.
  const cards = collection.cards.filter(card => catalogCardVisible(card));

  // Every identity that owns cards, its cards newest issued first.
  const members = new Map<string, Member>();
  for (const card of cards) {
    const key = memberKey(card);
    const member = members.get(key) ?? { key, personId: card.personId ?? null, cards: [] };
    member.cards.push(card);
    members.set(key, member);
  }
  for (const member of members.values()) member.cards.sort((a, b) => issued(b) - issued(a) || a.id.localeCompare(b.id));

  // A person or team joins beyond the listed cast only with a card for the story's contest: a set issued for it, or a
  // team card entered in it. The gate decides who joins; once in, every card they hold is shown.
  const covers = (card: CollectionCard) => card.kind === 'team'
    ? card.entries.some(entry => slugs.has(entry.competitionId))
    : !!catalogSet(card, sets)?.competitionIds.some(slug => slugs.has(slug));
  const forContest = (member: Member) => member.cards.some(covers);
  // A person's best card for this story: their newest special edition (the Kaggleverse career card, a set issued for no
  // single contest), else their newest card for the story's contest, else their newest card. Their others follow newest first.
  const special = (card: CollectionCard) => card.kind === 'person' && !!card.setId && catalogSet(card, sets)?.competitionIds.length === 0;
  const ranked = (member: Member) => {
    const best = member.cards.find(special) ?? member.cards.find(covers) ?? member.cards[0];
    return [best, ...member.cards.filter(card => card !== best)];
  };

  // Exact lookups: card name, verified Kaggle handle, and the team name or team id recorded on a card for this contest.
  // A team card wins a board row over the members it lists, so a team row shows the team.
  const byName = new Map<string, string[]>(), byTeam = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, text: string, key: string, first = false) => {
    const list = map.get(text) ?? [];
    if (!list.includes(key)) first ? list.unshift(key) : list.push(key);
    map.set(text, list);
  };
  for (const card of cards) {
    const key = memberKey(card);
    add(byName, normalise(card.name), key);
    for (const account of card.accounts) if (/kaggle\.com\//i.test(account.url)) add(byName, normalise(account.label), key);
    for (const entry of card.entries) if (slugs.has(entry.competitionId)) {
      add(byName, normalise(entry.teamName), key, card.kind === 'team');
      add(byTeam, entry.teamId, key, card.kind === 'team');
    }
  }
  const listed = stories.flatMap(story => story.personIds ?? []).map(id => `person:${id}`);
  // A board row is a team card when one exists, unless someone the story lists is on that team: then they already
  // stand for it and a second card for the same entry would repeat them.
  const resolve = (keys: string[] | undefined) => {
    const found = (keys ?? []).map(key => members.get(key)!).filter(member => member && forContest(member));
    const castOnTeam = found.filter(member => listed.includes(member.key));
    if (castOnTeam.length) return castOnTeam;
    const teams = found.filter(member => !member.personId);
    return teams.length ? teams : found;
  };

  const order: string[] = [];
  const push = (key: string | undefined) => { if (key && members.has(key) && !order.includes(key)) order.push(key); };
  // 3. The subject first.
  push(listed.find(key => members.has(key)));
  // 4. A hand-typed face may move its person forward (never in front of the subject, never into a story they are not in).
  const faces = stories.flatMap(story => story.cardFaces ?? []);
  const board = stories.flatMap(boardNames).flatMap(row => resolve(row.teamId && byTeam.has(row.teamId) ? byTeam.get(row.teamId) : byName.get(normalise(row.name))));
  const text = stories.flatMap(story => [story.headline ?? '', story.dek ?? '', ...story.sections.map(section => `${section.heading ?? ''}\n${section.text}`)]).join('\n');
  // A team the listed cast already stands for is not named again: a solo team card sharing its person's name
  // ("Yi-Chia Chen", "xz"), or a team card whose recorded roster includes someone the story lists ("Tufa Labs").
  const listedNames = new Set(listed.flatMap(key => members.get(key)?.cards.map(card => normalise(card.name)) ?? []));
  const castTeam = (member: Member) => !member.personId && (listedNames.has(normalise(member.cards[0].name))
    || member.cards.some(card => card.entries.some(entry => entry.members.some(person => person.personId && listed.includes(`person:${person.personId}`)))));
  const named = [...members.values()].filter(member => forContest(member) && !castTeam(member)).flatMap(member => {
    const positions = [...new Set(member.cards.map(card => card.name))].map(name => namedIn(text, name)).filter(index => index >= 0);
    return positions.length ? [{ member, at: Math.min(...positions) }] : [];
  }).sort((a, b) => a.at - b.at).map(item => item.member);
  const inStory = new Set([...listed, ...board.map(member => member.key), ...named.map(member => member.key)]);
  for (const face of faces) {
    const card = cards.find(item => item.id === face.cardId);
    if (card && inStory.has(memberKey(card))) push(memberKey(card));
  }
  // 1. The rest of the listed cast, then the board in its order, then anyone else the words name.
  for (const key of listed) push(key);
  for (const member of board) push(member.key);
  for (const member of named) push(member.key);

  // 2. The subject shows every card they hold, best first and the rest newest issued first, then their Hall of Fame
  // cards. Everyone else the cast, the board or the words bring in shows their best card: an edition can name thirty carded people,
  // and thirty runs of three cards would bury the story. Past the tile budget the rest are listed by name.
  const subject = order[0] && listed.includes(order[0]) ? order[0] : null;
  const tiles: StoryCastTile[] = [], more: StoryCastMore[] = [];
  const pictures = new Set<string>();
  for (const key of order) {
    const member = members.get(key)!;
    const own: StoryCastTile[] = [];
    for (const card of key === subject ? ranked(member) : ranked(member).slice(0, 1)) {
      const base = `/api/news/cards/${encodeURIComponent(card.id)}`, version = collectionShareVersion(card, collection);
      const set = storyCastSetLabel(card, sets);
      const tile = (side: 'front' | 'back'): StoryCastTile => ({
        key: `${card.id}:${side}`, kind: 'card', cardId: card.id, personId: card.personId ?? null, side,
        name: card.name, set: side === 'back' ? `${set} · back` : set,
        alt: `${card.name}, ${set} card${side === 'back' ? ', back' : ''}`,
        href: side === 'front' ? card.cardUrl : `${base}/image.png?side=back`,
        src: `${base}/thumb.webp?side=${side}&w=300&v=${version}`, width: 300, height: 420, lead: false,
      });
      own.push(tile('front'));
      // A hand-typed back face sits right after its front.
      if (faces.some(face => face.cardId === card.id && face.side === 'back')) own.push(tile('back'));
    }
    const past = key !== subject ? [] : member.cards.flatMap(card => card.pastCards)
      .filter(card => card.imageSrc && !pictures.has(card.imageSrc) && !!pictures.add(card.imageSrc));
    for (const card of past) own.push({
      key: `hall-of-fame:${card.hallOfFameUrl}:${card.imageSrc}`, kind: 'hall-of-fame', cardId: null, personId: member.personId, side: 'front',
      name: member.cards[0].name, set: `Hall of Fame ${card.season ?? ''}`.trim(), alt: card.imageAlt,
      href: card.hallOfFameUrl, src: card.imageSrc!, width: 848, height: 1264, lead: false,
    });
    if (tiles.length && tiles.length + own.length > STORY_CAST_TILE_LIMIT) more.push({ key, name: member.cards[0].name, href: ranked(member)[0].cardUrl });
    else tiles.push(...own);
  }
  if (tiles[0]) tiles[0].lead = true;
  return { tiles, more };
}
