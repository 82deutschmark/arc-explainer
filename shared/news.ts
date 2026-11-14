/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Terra / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Opus 5.5 Max; Claude Opus 5.5 Low; Claude Sonnet 5.5; GPT-6 Astra Extra high; Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): wire stories get their own permalink (wirePath, wireTitle,
 *          wireDescription, wireDeskPausedSince, NewsIndex.wireLatest); dispatches get dispatchTitle,
 *          dispatchDescription and dispatchLabel; snippet() is the one 160-character trim; editionLabel
 *          reads editionDisplay first and no longer carries the dead preview branch.
 * 14-Nov-2026 (Claude Opus 5.5, profiles-articles): citedSources, displayAliases, rank/score change
 *          labels, personDescription, personTeams, rosterSourceHref, joinNames, isFilenameAlt, optional
 *          article competitions[] and revisions/updatedAt (dateModified); socialArchive and
 *          chronologicalSocialPosts removed.
 * 14-Nov-2026 (Claude Opus 5.5, card faces): articleCardVersion also hashes the dek, the printed competition label and the
 *          edition label, so editing any of them gives the link preview a fresh address.
 * 09-Nov-2026: Tufa cast and card correction by GPT-6.1 Sol / Codex (effort inherited).
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
 * Updated by GPT-6.1 Terra / Codex (reasoning effort not exposed).
 * PURPOSE: Shared public contract for sourced ARC Daily articles and edition-bound art, people, roster history and public social records,
 *          plus the one copy of their search/share wording: titles, descriptions, Eastern
 *          dates, share-card URLs and alt text, and NewsArticle structured data. Server HTML
 *          (newsPresentation.ts), the share-card renderer (newsCardImage.ts) and the React
 *          pages all read these, so a crawler, a link unfurl and in-app navigation agree.
 *          08-Oct-2026: added the share-card helpers and moved newsDate/competitionName here
 *          from client/src/components/news/NewsDesk.tsx (which re-exports them).
 *          Dated social dispatches share the archive without replacing immutable editions.
 *          09-Oct-2026 (Claude Opus 5.5): person portraits (Hall of Fame crop or saved Kaggle
 *          picture) and the helpers that decide whose faces a story shows: people its sections
 *          cite, then verified people on the teams it covers. Later the same day: wire-desk stories
 *          (NewsWireStory) and Early/Late edition names in print, with morning/evening kept as data.
 *          10-Oct-2026 (Claude Sonnet 5.5): the front-page share card's address is versioned by
 *          day and edition (sectionCardPath), and its headlines show only while fresh
 *          (sectionCardArticles), so a preview service can never keep serving a stale card.
 *          Public source contracts also include selected Kaggle discussions and the chronological tweet archive.
 * SRP/DRY check: Pass — server, browser and newsroom tooling share one documented shape;
 *          competition labels still come from shared/kaggleCompetitions.ts.
 */
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import NEWS_WRITER_IDS from './newsWriters.json';
import { NEWS_NAME, NEWS_BRAND } from './newsBrand';
export { NEWS_NAME, NEWS_BRAND } from './newsBrand';

export type NewsCompetition = string;
export type NewsEdition = 'morning' | 'evening';
/** Writer IDs remain stable in archived stories; scheduled editions use GPT-6.1 Sol, the wire GPT-6 Luna and
 *  the Claude Code backup desk Claude Sonnet 5.5. The one list lives in shared/newsWriters.json, which
 *  scripts/newsroom.py and scripts/newsroom_wire.py read too, so the writer tools and the site can never disagree. */
/** Copy for a confirmed missing story, shared by the browser and server page. */
export const NEWS_STORY_MISSING = {
  heading: 'This story isn’t here yet',
  description: 'We may have gotten ahead of ourselves. The story may not be published yet—check back in a few minutes, or check the address.',
} as const;

export const NEWS_EDITION_WRITERS = NEWS_WRITER_IDS.edition as [string, ...string[]];
export const NEWS_WIRE_WRITERS = NEWS_WRITER_IDS.wire as [string, ...string[]];
export type NewsWriter = string;
export interface NewsSource { id: string; title: string; url: string; accessedAt: string }
export interface NewsSection {
  heading?: string; text: string; sourceIds: string[];
  image?: { src: string; alt: string; caption: string; layout?: "inset" };
  standings?: { caption: string; observedAt: string; rows: { teamId: string; name: string; rank: number; score: number }[] };
}
export interface NewsStat { teamId: string; name: string; rank: number; score: number; rankChange: number | null; scoreChange: number | null }
/** One wording for a box-score movement, shared by the article page, its server HTML and the share card. */
export const rankChangeLabel = (change: number | null, missing = 'Not available') =>
  change == null ? missing : change === 0 ? 'Unchanged' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}`;
export const scoreChangeLabel = (change: number | null, missing = 'Not available') =>
  change == null ? missing : `${change > 0 ? '+' : ''}${change}`;
/**
 * The sources a reader is shown: only those some section cites, in first-citation order, one per URL.
 * Older editions carried their whole brief catalogue (hundreds of uncited, repeated links).
 */
export function citedSources(story: { sections: Pick<NewsSection, 'sourceIds'>[]; sources: NewsSource[] }): NewsSource[] {
  const byId = new Map(story.sources.map(source => [source.id, source]));
  const seen = new Set<string>();
  return story.sections.flatMap(section => section.sourceIds).flatMap(id => {
    const source = byId.get(id);
    if (!source || seen.has(source.url)) return [];
    seen.add(source.url);
    return [source];
  });
}
/** A dated revision of a published story, read from content/news/corrections and the revision evidence. */
export interface NewsRevision { at: string; reason?: string }
/** Use the story's own dated tables for semantic team and score typography. */
export function articleFigureStats(article: Pick<NewsArticle, 'sections' | 'stats'>): NewsStat[] {
  return [...article.stats, ...article.sections.flatMap(section => (section.standings?.rows ?? []).map(row => ({ ...row, rankChange: null, scoreChange: null })))];
}
/** Native editorial art with an immutable, edition-bound composition record. */
export interface NewsIllustration { src: string; alt: string; caption: string; artworkId: string }
export interface NewsArticle {
  /** Ordered, verified people selected for the card row. */
  personIds?: string[];
  id: string; date: string; edition: NewsEdition; competition: NewsCompetition;
  competitionDisplay?: string; editionDisplay?: string;
  headline: string; dek: string; sections: NewsSection[]; teamIds: string[];
  /** Other source-verified team names, including later aliases, mentioned in this story. */
  verifiedTeamNames?: string[];
  image?: NewsIllustration;
  sources: NewsSource[]; publishedAt: string; dataAsOf: string;
  baselineAt: string | null; generatedBy: typeof NEWS_EDITION_WRITERS[number]; stats: NewsStat[];
  coverageNote: string; discord: string;
  /** A commissioned feature reserved for this issue's front page. */
  frontPageFeatureId?: string;
  /** Further contests a joint report covers (the closing bell covers both); `competition` stays the primary one. */
  competitions?: NewsCompetition[];
  /** Set by the store from the revision records, oldest first; updatedAt is the latest revision. */
  revisions?: NewsRevision[]; updatedAt?: string;
}
/** Every contest an edition covers, primary first. */
export const articleCompetitions = (article: Pick<NewsArticle, 'competition' | 'competitions'>): NewsCompetition[] =>
  [...new Set([article.competition, ...(article.competitions ?? [])])];
/** Whether an edition names this competition team. */
export const articleCoversTeam = (article: NewsArticle, team: Pick<CompetitorRecord, 'competition' | 'teamId'>) =>
  articleCompetitions(article).includes(team.competition) && article.teamIds.includes(team.teamId);
export interface CompetitorFact { text: string; sourceUrl: string; sourceTitle: string; checkedAt: string }
export interface CompetitorRecord {
  id: string; competition: NewsCompetition; teamId: string; name: string;
  aliases: string[]; members: string[]; firstObservedAt: string; lastObservedAt: string;
  facts: CompetitorFact[];
  briefing?: string;
  /** An approved team picture shown on the profile page (set from the wiki entry's featureArt). */
  art?: { src: string; alt: string; caption: string };
}
/** Names a team was observed under, without its internal profile id or its current name, each once. */
export function displayAliases(record: Pick<CompetitorRecord, 'id' | 'name' | 'aliases'>): string[] {
  const hidden = new Set([record.id.toLowerCase(), record.name.trim().toLowerCase()]);
  return record.aliases.filter(alias => {
    const key = alias.trim().toLowerCase();
    if (!key || hidden.has(key)) return false;
    hidden.add(key);
    return true;
  });
}
/** "A", "A and B", "A, B and C": reader-facing name lists. */
const NAME_LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
export const joinNames = (names: string[]) => NAME_LIST.format(names);
/**
 * Alt text that is really a file name or an asset slug ("keith-tyser.webp", "2026-10-29-nt-avatar-v2")
 * describes nothing. Real alt text is words: it has a space.
 */
export const isFilenameAlt = (alt: string) => !/\s/.test(alt.trim()) && /[-_.]/.test(alt);
export interface NewsDispatch {
  id: string; competition: NewsCompetition; publishedAt: string; headline: string;
  dek?: string;
  sections: NewsSection[]; sources: NewsSource[]; interpretation?: string;
  /** Ordered, verified story cast. An empty list deliberately shows no cards. */
  personIds?: string[];
  /** Historical dispatches lack a writer ID; new features record their actual writer. */
  generatedBy?: typeof NEWS_EDITION_WRITERS[number];
  commissionedBy?: 'mark-barney';
  editorNote?: string;
  image?: { src: string; alt: string; caption: string };
  /** Set by the store from the revision records, oldest first; updatedAt is the latest revision. */
  revisions?: NewsRevision[]; updatedAt?: string;
}
/** Resolve the same immutable feature for the front page, permalink and initial HTML. */
export function editionFeature(article: NewsArticle, dispatches: NewsDispatch[] = []): NewsDispatch | undefined {
  return article.frontPageFeatureId
    ? dispatches.find(dispatch => dispatch.id === article.frontPageFeatureId && dispatch.competition === article.competition)
    : undefined;
}
/**
 * A person's face on the newspaper. 'hall-of-fame' is a square crop of their own ARC Explainer
 * Hall of Fame card (sourceUrl is that card's anchor); 'kaggle' is a saved copy of the profile
 * picture on their verified Kaggle account (sourceUrl is that account). Files live in
 * client/public/news-images/people/. docs/newsroom/VISUALS.md maps every picture we have.
 */
export interface NewsPortrait { src: string; alt: string; kind: 'hall-of-fame' | 'kaggle' | 'web'; sourceUrl: string; sourceTitle: string; checkedAt: string }
/** Commissioned avatar art, kept separate from the original account picture and its provenance. */
export interface NewsEditorialPortrait extends Omit<NewsPortrait, 'kind'> { artworkId: string }
/** People persist across seasons; membership observations belong to a specific contest. */
export interface NewsPerson {
  id: string; name: string;
  briefing?: string;
  /** Absent means a Kaggle competitor. A sponsor runs or funds the competition (the ARC Prize co-founders) and has no Kaggle tier. */
  role?: 'competitor' | 'sponsor';
  accounts: ({ platform: 'kaggle' | 'x'; handle: string; url: string } & Omit<CompetitorFact, 'text'>)[];
  facts: CompetitorFact[];
  memberships: { competition: NewsCompetition; competitionId: string; season: string; teamId: string; teamName: string;
    memberHandle: string; firstObservedAt: string; lastObservedAt: string; sourceUrl: string; sourceTitle: string }[];
  /** Past results and roles, each linked to its Hall of Fame card; labels read like honors ("ARC Prize 2025 champion · NVARC"). */
  hallOfFame: ({ path: string; label: string; image?: { src: string; alt: string } } & Omit<CompetitorFact, 'text'>)[];
  portrait?: NewsPortrait;
  editorialPortrait?: NewsEditorialPortrait;
}
export const displayPortrait = (person: NewsPerson) => person.editorialPortrait ?? person.portrait;
/** A profile's own search snippet: the briefing, else the first sourced fact, else a plain line naming them. */
export const personDescription = (person: NewsPerson) =>
  snippet(person.briefing ?? person.facts[0]?.text ?? `${person.name}: verified public accounts, observed competition teams and Hall of Fame history in ${NEWS_NAME}.`);
export type NewsMembership = NewsPerson['memberships'][number];
/**
 * Every competition team a person was observed on: their own ledger memberships, plus any competitor
 * record whose saved roster lists one of their verified Kaggle handles (the reverse of peopleForTeam),
 * so a profile and the team page it links to never disagree. Newest observation first.
 */
export function personTeams(person: NewsPerson, competitors: CompetitorRecord[]): NewsMembership[] {
  const handles = new Set(person.accounts.filter(account => account.platform === 'kaggle').map(account => account.handle));
  const rows = new Map(person.memberships.map(member => [`${member.competition}:${member.teamId}`, member]));
  for (const team of competitors) {
    const key = `${team.competition}:${team.teamId}`, handle = team.members.find(member => handles.has(member));
    if (!handle || rows.has(key)) continue;
    const competition = KAGGLE_COMPETITIONS[team.competition];
    rows.set(key, { competition: team.competition, competitionId: competition?.slug ?? team.competition, season: competition?.season ?? team.firstObservedAt.slice(0, 4),
      teamId: team.teamId, teamName: team.name, memberHandle: handle, firstObservedAt: team.firstObservedAt, lastObservedAt: team.lastObservedAt,
      sourceUrl: competitorPath(team.id), sourceTitle: `${team.name} team profile` });
  }
  return [...rows.values()].sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt) || a.teamName.localeCompare(b.teamName));
}
/** Our saved-board JSON API (…/api/kaggle/<slug>/board) is a data feed, not a page; readers get the leaderboard page. */
const BOARD_API = /^https:\/\/arc\.markbarney\.net\/api\/kaggle\/[^/]+\/board$/;
export const rosterSourceHref = (member: Pick<NewsMembership, 'competition' | 'sourceUrl'>) =>
  BOARD_API.test(member.sourceUrl) ? KAGGLE_COMPETITIONS[member.competition]?.path ?? '/news' : member.sourceUrl;
export interface NewsSocialPost {
  id: string; author: string; authorName: string; url: string; postedAt: string | null; checkedAt: string;
  visibility: 'public'; summary: string; whyItMatters: string; competitions: NewsCompetition[]; personIds: string[];
  category: 'standings' | 'research' | 'community' | 'banter'; importance: number;
  threadId: string | null; storyUrl: string | null; identitySourceUrl: string;
}
/** Read, dated public discussion leads; participant claims remain attributed in their summaries. */
export interface NewsDiscussion {
  id: string; competition: NewsCompetition; url: string; title: string; author: string; authorName: string;
  postedAt: string | null; latestActivityAt: string | null; commentCount: number; checkedAt: string;
  visibility: 'public'; bodyRead: true; summary: string; decision: 'paper-lead'; reason: string; personIds: string[];
}
export const recentDiscussions = (threads: NewsDiscussion[]) => [...threads].sort((a, b) =>
  (b.latestActivityAt ?? b.postedAt ?? b.checkedAt).localeCompare(a.latestActivityAt ?? a.postedAt ?? a.checkedAt)
  || b.id.localeCompare(a.id));
/** Useful reporting precedes minor color; within each tier, newest posts lead. */
export function frontPageSocialPosts(posts: NewsSocialPost[]): NewsSocialPost[] {
  const seen = new Set<string>();
  return [...posts].sort((a, b) => Number(b.importance >= 2) - Number(a.importance >= 2)
    || (b.postedAt ?? b.checkedAt).localeCompare(a.postedAt ?? a.checkedAt) || b.id.localeCompare(a.id))
    .filter(post => {
      // Related replies and reactions share one front-page slot; the source ledger keeps all posts.
      const story = post.storyUrl ?? post.threadId ?? post.id;
      if (seen.has(story)) return false;
      seen.add(story);
      return true;
    }).slice(0, 4);
}
/**
 * A short sourced story from the wire desk: GPT-6 Luna, writing several times a day from a
 * prepared market brief (scripts/newsroom_wire.py, docs/newsroom/WIRE_DESK.md). Every figure in
 * the prose was checked against that brief; `visual` is a picture the brief offered (a face or a
 * Hall of Fame card already on the site). Evidence: /api/news/wire/<id>/evidence.
 */
export interface NewsWireStory {
  id: string; competition: NewsCompetition; publishedAt: string;
  /** The board save the story reports, and the save a day earlier it compares with (null when none). */
  dataAsOf: string; since: string | null;
  headline: string; sections: NewsSection[]; sources: NewsSource[];
  teamIds: string[];
  /** Verified people the story is about; the first is the one pictured. */
  personIds: string[];
  visual?: { src: string; alt: string; href: string };
  /** Claude Haiku 5.5 (or Sonnet 5.5 before 21 Oct 2026) when the Claude Code backup filed it (docs/newsroom/FALLBACK.md). */
  generatedBy: typeof NEWS_WIRE_WRITERS[number];
}
export interface NewsIndex { articles: NewsArticle[]; competitors: CompetitorRecord[]; dispatches?: NewsDispatch[]; people?: NewsPerson[]; social?: NewsSocialPost[]; discussions?: NewsDiscussion[]; wire?: NewsWireStory[];
  /** Only when `wire` (the past week) is empty: the desk's newest filings, whatever their age, so the
   *  wire page can say when the desk paused instead of claiming it never filed. */
  wireLatest?: NewsWireStory[] }
/** The index carries one week of wire; older stories keep their permalinks. */
export const WIRE_WINDOW_MS = 7 * 24 * 3_600_000;
/** How many of the newest filings the index carries while the desk is paused. */
export const WIRE_PAUSED_LIMIT = 7;
/** The newest filing's time when the desk has filed nothing inside the week, else null. */
export function wireDeskPausedSince(index: Pick<NewsIndex, 'wire' | 'wireLatest'>): string | null {
  if (index.wire?.length) return null;
  return [...(index.wireLatest ?? [])].map(story => story.publishedAt).sort().at(-1) ?? null;
}
/** The permanent archive is fed by the same published editions and features as RSS. */
export const NEWS_ARCHIVE = {
  path: '/news/community',
  heading: 'Story archive',
  description: 'Browse published features and editions, from the latest stories to earlier coverage.',
} as const;

export function publishedStories(articles: NewsArticle[], dispatches: NewsDispatch[] = []) {
  // Different UTC offsets can represent the same instant, so order by time rather than spelling.
  return [...articles, ...dispatches].sort((a, b) =>
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
}

const archiveMonthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export function archiveMonths(stories: ReturnType<typeof publishedStories>) {
  const months = new Map<string, typeof stories>();
  for (const story of stories) {
    const month = archiveMonthFormat.format(new Date(story.publishedAt));
    const entries = months.get(month);
    if (entries) entries.push(story);
    else months.set(month, [story]);
  }
  return [...months];
}

/** One publication order for browser and initial HTML; no fixed competition slate. */
export function competitionStories(articles: NewsArticle[], dispatches: NewsDispatch[], competition: NewsCompetition) {
  return [
    ...articles.filter(article => articleCompetitions(article).includes(competition)).map(article => ({ publishedAt: article.publishedAt, id: article.id, article })),
    ...dispatches.filter(dispatch => dispatch.competition === competition).map(dispatch => ({ publishedAt: dispatch.publishedAt, id: dispatch.id, dispatch })),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
}

export function publishedCompetitionOrder(articles: NewsArticle[], dispatches: NewsDispatch[] = []): NewsCompetition[] {
  return [...new Set([...articles, ...dispatches].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id)).map(story => story.competition))];
}
export const personPath = (id: string) => `/news/people/${id}`;
/** Current roster cards use exact verified account handles, never fuzzy name matches. */
export const peopleForTeam = (people: NewsPerson[], team: CompetitorRecord) => people.filter(person =>
  person.accounts.some(account => account.platform === 'kaggle' && team.members.includes(account.handle)));
/** Brief source IDs for a person: person-<personId>-<identity|fact|archive|roster>-<n> (scripts/newsroom_people.py). */
const PERSON_SOURCE_ID = /^person-([a-z0-9-]+)-(?:identity|fact|archive|roster)-\d+$/;
/** People a story actually cites, in the order the sections first cite them. Uncited brief sources do not count. */
export function citedPeople(sections: NewsSection[], people: NewsPerson[]): NewsPerson[] {
  const ids = sections.flatMap(section => section.sourceIds).map(id => PERSON_SOURCE_ID.exec(id)?.[1]).filter((id): id is string => !!id);
  return [...new Set(ids)].map(id => people.find(person => person.id === id)).filter((person): person is NewsPerson => !!person);
}
/** The browser and server use the same ordered editorial cast. */
export function reportedPeople(stories: { personIds?: readonly string[] }[], people: NewsPerson[]): NewsPerson[] {
  const byId = new Map(people.map(person => [person.id, person]));
  const ids = new Set(stories.flatMap(story => story.personIds ?? []));
  return [...ids].map(id => byId.get(id)).filter((person): person is NewsPerson => !!person);
}
/** Faces for an edition: people the prose cites first, then verified people on the teams it covers. */
export function storyPeople(article: NewsArticle, people: NewsPerson[], competitors: CompetitorRecord[]): NewsPerson[] {
  const onTeams = article.teamIds.flatMap(teamId => {
    const team = competitors.find(record => articleCompetitions(article).includes(record.competition) && record.teamId === teamId);
    return team ? peopleForTeam(people, team) : [];
  });
  return [...new Map([...citedPeople(article.sections, people), ...onTeams].map(person => [person.id, person])).values()];
}
/** The ledger person behind an X account, matched only on an exact verified handle. */
export const personForXHandle = (people: NewsPerson[], handle: string) => people.find(person =>
  person.accounts.some(account => account.platform === 'x' && account.handle.toLowerCase() === handle.toLowerCase()));
/** Name without a parenthetical nickname, for captions under small faces. */
export const shortPersonName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');
/** First and last initials ("Mithil A Vakde" → "MV") for a person without a picture. */
export function personInitials(name: string): string {
  const parts = shortPersonName(name).split(/\s+/).filter(Boolean).map(part => Array.from(part)[0]);
  return (parts.length > 1 ? parts[0] + parts[parts.length - 1] : parts[0] ?? '').toUpperCase();
}
export const newsArticlePath = (id: string) => `/news/${id}`;
/** The byline credit for a story's writer; the Claude Code backup is named as such. Every ID in
 *  shared/newsWriters.json has a credit here (tests/integration/news.test.ts checks it). */
export const WRITER_CREDITS: Record<string, string> = {
  'gpt-6-codex': 'GPT-6 / Codex',
  'gpt-6-sol': 'GPT-6 Sol',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6.1-terra': 'GPT-6.1 Terra / Codex',
  'gpt-6.1-terra-extra-high': 'GPT-6.1 Terra Extra High',
  'gpt-6-astra-extra-high': 'GPT-6 Astra Extra high',
  'gpt-6-luna': 'GPT-6 Luna',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5, backup wire desk',
  'claude-opus-5-5': 'Claude Opus 5.5',
};
export const writerCredit = (generatedBy: NewsWriter) =>
  WRITER_CREDITS[generatedBy] ?? generatedBy;
/** The wire index, or one story's permanent page (it outlives the index's one-week window). */
export const wirePath = (id?: string) => id ? `/news/wire/${id}` : '/news/wire';
export const competitorPath = (id: string) => `/news/competitors/${id}`;
export const competitionName = (key: NewsCompetition) => KAGGLE_COMPETITIONS[key]?.label ?? key;
export const articleCompetitionLabel = (article: NewsArticle) => article.competitionDisplay ?? competitionName(article.competition);
/** The 6 am issue is the early edition and the 6 pm issue the late edition; the data keeps morning/evening. */
export const editionName = (edition: NewsEdition) => edition === 'morning' ? 'Early' : 'Late';
/** A special's own label is recorded as editionDisplay; routine issues print Early or Late edition. */
export const editionLabel = (article: NewsArticle) => article.editionDisplay ?? `${editionName(article.edition)} edition`;
/** A dispatch's kicker: an editor-commissioned analysis, or reporting from the contenders. */
export const dispatchLabel = (dispatch: Pick<NewsDispatch, 'commissionedBy'>) => dispatch.commissionedBy ? 'Commissioned analysis' : 'From the contenders';

/** Newspaper dates and clocks are UTC. Date-only edition labels must not roll back a day. */
export function newsDate(value: string, withTime = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' } as const : {}),
  }).format(date);
}

/**
 * Search results show roughly 60–65 characters of a title. Committed headlines are not
 * rewritten to fit; the masthead suffix is dropped instead when it would push past that.
 */
export const TITLE_BUDGET = 65;
export const newsTitle = (name: string) => `${name} | ${NEWS_NAME}`.length <= TITLE_BUDGET ? `${name} | ${NEWS_NAME}` : name;
export const articleTitle = (article: NewsArticle) => newsTitle(article.headline);
/** Search snippets show about 160 characters; longer text is cut at a word and marked. */
export const snippet = (text: string) => text.length <= 160 ? text : text.slice(0, 157).replace(/\s+\S*$/, '') + '…';
/** Dated lead-in when it fits a snippet (~160 characters), so each edition reads distinctly. */
export function articleDescription(article: NewsArticle): string {
  const dated = `${articleCompetitionLabel(article)} ${editionLabel(article).toLowerCase()}, ${newsDate(article.date)}: ${article.dek}`;
  return dated.length <= 160 ? dated : snippet(article.dek);
}
export const dispatchTitle = (dispatch: NewsDispatch) => newsTitle(dispatch.headline);
export const dispatchDescription = (dispatch: NewsDispatch) => snippet(dispatch.dek ?? dispatch.sections[0]?.text ?? dispatch.headline);
export const wireTitle = (story: NewsWireStory) => newsTitle(story.headline);
export const wireDescription = (story: NewsWireStory) => snippet(story.sections[0]?.text ?? story.headline);
export const competitorTitle = (record: CompetitorRecord) => newsTitle(`${record.name} — ${competitionName(record.competition)} competitor`);
export const competitorDescription = (record: CompetitorRecord) =>
  `Explore ${record.name} in ${competitionName(record.competition)}: team background, observed members and source-linked competition coverage.`;

/** Share cards: 1200x630, the size every major unfurler renders as a large image. */
export const NEWS_CARD_WIDTH = 1200;
export const NEWS_CARD_HEIGHT = 630;
/** Bump when the card layout changes, so cached article cards are fetched again. 3: Early/Late edition labels. */
export const NEWS_CARD_DESIGN = 3;
/**
 * Front page and profile card. The bare path is only the route; pages advertise sectionCardPath(),
 * whose version changes with the day and with the editions shown, because link-preview services
 * keep a picture for as long as its address stays the same.
 */
export const NEWS_SECTION_CARD_PATH = '/api/news/og-image.png';
export const NEWS_SECTION_CARD_ALT = NEWS_BRAND.goose ? `${NEWS_NAME}: the sports tabloid of the Kaggleverse, reporting on major competitions and their contenders` : `${NEWS_NAME}: daily reporting on the ARC Prize 2026 leaderboards for ARC-AGI-3 and ARC-AGI-2, with an ARC puzzle of the day`;
/** The three leading rows of the article's own box score, the only standings a card shows. */
export const cardStandings = (article: NewsArticle) => [...article.stats].sort((a, b) => a.rank - b.rank).slice(0, 3);

/** FNV-1a: tiny, dependency-free and identical in Node and the browser. Not security. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
/** Changes whenever anything drawn on the article's card changes, so the URL can be immutable. */
export function articleCardVersion(article: NewsArticle): string {
  // The masthead is drawn into the image; a rebrand must receive a new immutable URL. The kicker prints the competition label
  // and the edition label (either can be an editor's display override) and the card prints the dek, so all three are hashed.
  return shortHash(JSON.stringify([NEWS_CARD_DESIGN, NEWS_NAME, NEWS_BRAND.goose, article.headline, article.dek, articleCompetitionLabel(article), editionLabel(article),
    article.competition, article.edition, article.date, cardStandings(article).map(stat => [stat.rank, stat.name, stat.score, stat.rankChange])]));
}
/**
 * The front-page card prints headlines only while a contest's newest edition is this recent (one
 * missed edition still fits). Past it, the card says what the paper is rather than passing
 * yesterday's news off as today's.
 */
export const NEWS_CARD_FRESH_MS = 36 * 3_600_000;
/** Bump when the front-page card layout changes, so cached front-page cards are fetched again. */
export const NEWS_SECTION_CARD_DESIGN = 1;
/** UTC calendar day as "2026-10-10"; the front-page card's puzzle changes with it. */
export const easternDay = (now: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
/** The newest still-fresh edition of each contest, ARC-AGI-3 first. Empty means the card shows the evergreen panel. */
export function sectionCardArticles(articles: NewsArticle[], now = Date.now()): NewsArticle[] {
  return [...new Set(articles.map(article => article.competition))].sort().flatMap(competition => {
    const newest = articles.filter(article => article.competition === competition)
      .reduce<NewsArticle | undefined>((best, article) => !best || article.publishedAt > best.publishedAt ? article : best, undefined);
    return newest && now - Date.parse(newest.publishedAt) <= NEWS_CARD_FRESH_MS ? [newest] : [];
  });
}
/** Changes with the day and with anything the front-page card prints, so every new edition gets a new address. */
export const sectionCardVersion = (articles: NewsArticle[], now = Date.now()): string =>
  shortHash(JSON.stringify([NEWS_SECTION_CARD_DESIGN, NEWS_NAME, easternDay(now), sectionCardArticles(articles, now).map(article => [article.id, article.headline, article.dek])]));
export const sectionCardPath = (articles: NewsArticle[], now = Date.now()): string =>
  `${NEWS_SECTION_CARD_PATH}?v=${sectionCardVersion(articles, now)}`;
export function sectionCardAlt(articles: NewsArticle[], now = Date.now()): string {
  const shown = sectionCardArticles(articles, now);
  return shown.length
    ? `${NEWS_NAME} front page with the latest ${shown.map(article => competitionName(article.competition)).join(' and ')} headline${shown.length > 1 ? 's' : ''} and an ARC puzzle of the day.`
    : NEWS_SECTION_CARD_ALT;
}
export const articleCardPath = (article: NewsArticle) => `/api/news/og-image/${article.id}.png?v=${articleCardVersion(article)}`;
export function articleCardAlt(article: NewsArticle): string {
  const standings = cardStandings(article);
  return `${NEWS_NAME} front page for the ${articleCompetitionLabel(article)} ${editionLabel(article).toLowerCase()} of ${newsDate(article.date)}: “${article.headline}”${standings.length ? `, with the top ${standings.length} of the box score` : ''}.`;
}

/** The real masthead and standards page, shared by every newspaper story. */
export function newsPublisher(origin: string): Record<string, unknown> {
  return { '@type': 'NewsMediaOrganization', '@id': `${origin}/news#publisher`, name: NEWS_NAME, url: `${origin}/news`,
    masthead: `${origin}/news/staff`, ethicsPolicy: `${origin}/news/staff#standards`,
    correctionsPolicy: `${origin}/news/staff#contact`, actionableFeedbackPolicy: `${origin}/news/tips`,
    logo: { '@type': 'ImageObject', url: `${origin}${NEWS_BRAND.logo ?? '/android-chrome-512x512.png'}` } };
}
/** Same article schema for initial HTML and in-app navigation. */
export function articleStructuredData(article: NewsArticle, origin: string): Record<string, unknown> {
  const url = `${origin}${newsArticlePath(article.id)}`;
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'NewsArticle', '@id': `${url}#article`, url, headline: article.headline, description: article.dek,
    datePublished: article.publishedAt, dateModified: article.updatedAt ?? article.publishedAt, inLanguage: 'en', isAccessibleForFree: true,
    image: [{ '@type': 'ImageObject', url: `${origin}${articleCardPath(article)}`, width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, caption: articleCardAlt(article) },
      ...(article.image ? [{ '@type': 'ImageObject', url: `${origin}${article.image.src}`, caption: article.image.caption }] : [])],
    articleSection: articleCompetitionLabel(article),
    author: { '@type': 'Organization', name: `${NEWS_NAME} sports desk`, url: `${origin}/news` },
    publisher: newsPublisher(origin), mainEntityOfPage: url, citation: citedSources(article).map(source => source.url),
    isPartOf: { '@type': 'WebSite', name: 'ARC Explainer', url: `${origin}/` },
  }] };
}

/** Portable wiki stories receive the same dated, source-linked schema as editions. */
export function dispatchStructuredData(dispatch: NewsDispatch, origin: string): Record<string, unknown> {
  const url = `${origin}${newsArticlePath(dispatch.id)}`;
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'NewsArticle', '@id': `${url}#article`, url, headline: dispatch.headline,
    description: dispatch.dek ?? dispatch.sections[0]?.text ?? dispatch.headline,
    datePublished: dispatch.publishedAt, dateModified: dispatch.updatedAt ?? dispatch.publishedAt, inLanguage: 'en', isAccessibleForFree: true,
    ...(dispatch.image ? { image: [{ '@type': 'ImageObject', url: `${origin}${dispatch.image.src}`, caption: dispatch.image.caption }] } : {}),
    articleSection: competitionName(dispatch.competition), author: { '@type': 'Organization', name: `${NEWS_NAME} sports desk`, url: `${origin}/news/staff` },
    publisher: newsPublisher(origin), mainEntityOfPage: url, citation: citedSources(dispatch).map(source => source.url),
    isPartOf: { '@type': 'WebSite', name: 'ARC Explainer', url: `${origin}/` },
  }] };
}
