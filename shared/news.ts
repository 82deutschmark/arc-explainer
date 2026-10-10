/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-09
 * PURPOSE: Shared public contract for sourced ARC Daily articles, people, roster history and public social records,
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
 * SRP/DRY check: Pass — server, browser and newsroom tooling share one documented shape;
 *          competition labels still come from shared/kaggleCompetitions.ts.
 */
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';

export type NewsCompetition = 'arc-3' | 'arc-2';
export type NewsEdition = 'morning' | 'evening';
export interface NewsSource { id: string; title: string; url: string; accessedAt: string }
export interface NewsSection { heading?: string; text: string; sourceIds: string[] }
export interface NewsStat { teamId: string; name: string; rank: number; score: number; rankChange: number | null; scoreChange: number | null }
export interface NewsArticle {
  id: string; date: string; edition: NewsEdition; competition: NewsCompetition;
  headline: string; dek: string; sections: NewsSection[]; teamIds: string[];
  sources: NewsSource[]; publishedAt: string; dataAsOf: string;
  baselineAt: string | null; generatedBy: 'gpt-6-sol' | 'claude-haiku-5-5'; stats: NewsStat[];
  coverageNote: string; discord: string;
}
export interface CompetitorFact { text: string; sourceUrl: string; sourceTitle: string; checkedAt: string }
export interface CompetitorRecord {
  id: string; competition: NewsCompetition; teamId: string; name: string;
  aliases: string[]; members: string[]; firstObservedAt: string; lastObservedAt: string;
  facts: CompetitorFact[];
}
export interface NewsDispatch {
  id: string; competition: NewsCompetition; publishedAt: string; headline: string;
  sections: NewsSection[]; sources: NewsSource[]; interpretation?: string;
  image?: { src: string; alt: string; caption: string };
}
/**
 * A person's face on the newspaper. 'hall-of-fame' is a square crop of their own ARC Explainer
 * Hall of Fame card (sourceUrl is that card's anchor); 'kaggle' is a saved copy of the profile
 * picture on their verified Kaggle account (sourceUrl is that account). Files live in
 * client/public/news-images/people/. docs/newsroom/VISUALS.md maps every picture we have.
 */
export interface NewsPortrait { src: string; alt: string; kind: 'hall-of-fame' | 'kaggle'; sourceUrl: string; sourceTitle: string; checkedAt: string }
/** People persist across seasons; membership observations belong to a specific contest. */
export interface NewsPerson {
  id: string; name: string;
  accounts: ({ platform: 'kaggle' | 'x'; handle: string; url: string } & Omit<CompetitorFact, 'text'>)[];
  facts: CompetitorFact[];
  memberships: { competition: NewsCompetition; competitionId: string; season: string; teamId: string; teamName: string;
    memberHandle: string; firstObservedAt: string; lastObservedAt: string; sourceUrl: string; sourceTitle: string }[];
  /** Past results and roles, each linked to its Hall of Fame card; labels read like honors ("ARC Prize 2025 champion · NVARC"). */
  hallOfFame: ({ path: string; label: string; image?: { src: string; alt: string } } & Omit<CompetitorFact, 'text'>)[];
  portrait?: NewsPortrait;
}
export interface NewsSocialPost {
  id: string; author: string; authorName: string; url: string; postedAt: string | null; checkedAt: string;
  visibility: 'public'; summary: string; whyItMatters: string; competitions: NewsCompetition[]; personIds: string[];
  category: 'standings' | 'research' | 'community' | 'banter'; importance: number;
  threadId: string | null; storyUrl: string | null; identitySourceUrl: string;
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
  /** Claude Haiku 5.5 when the Claude Code backup filed it (docs/newsroom/FALLBACK.md). */
  generatedBy: 'gpt-6-luna' | 'claude-haiku-5-5';
}
export interface NewsIndex { articles: NewsArticle[]; competitors: CompetitorRecord[]; dispatches?: NewsDispatch[]; people?: NewsPerson[]; social?: NewsSocialPost[]; wire?: NewsWireStory[] }
export const NEWS_NAME = 'The ARC Daily Digest';
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
/**
 * The one person a story features: the person named in its headline, else in its dek, else the
 * first person its sections cite. Nobody named or cited, nobody featured.
 */
export function featuredPerson(story: { headline: string; dek?: string; sections: NewsSection[] }, people: NewsPerson[]): NewsPerson | undefined {
  const named = (text?: string) => text ? people.find(person => text.includes(shortPersonName(person.name))) : undefined;
  return named(story.headline) ?? named(story.dek) ?? citedPeople(story.sections, people)[0];
}
/** Faces for an edition: people the prose cites first, then verified people on the teams it covers. */
export function storyPeople(article: NewsArticle, people: NewsPerson[], competitors: CompetitorRecord[]): NewsPerson[] {
  const onTeams = article.teamIds.flatMap(teamId => {
    const team = competitors.find(record => record.competition === article.competition && record.teamId === teamId);
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
/** The byline credit for a story's writer; the Claude Code backup is named as such. */
export const writerCredit = (generatedBy: NewsArticle['generatedBy'] | NewsWireStory['generatedBy']) =>
  generatedBy === 'claude-haiku-5-5' ? 'Claude Haiku 5.5, backup desk' : generatedBy === 'gpt-6-luna' ? 'GPT-6 Luna' : 'GPT-6 Sol';
/** Wire stories live on one page, each at its own anchor. */
export const wirePath = (id?: string) => id ? `/news/wire#${id}` : '/news/wire';
export const competitorPath = (id: string) => `/news/competitors/${id}`;
export const competitionName = (key: NewsCompetition) => KAGGLE_COMPETITIONS[key].label;
/** The 6 am issue is the early edition and the 6 pm issue the late edition; the data keeps morning/evening. */
export const editionName = (edition: NewsEdition) => edition === 'morning' ? 'Early' : 'Late';
/** Edition kicker as printed on the page and the card; launch previews say so. */
export const editionLabel = (article: NewsArticle) => article.id.endsWith('-preview') ? 'Launch preview' : `${editionName(article.edition)} edition`;

/** Newspaper dates are Eastern. Date-only edition labels must not roll back a day. */
export function newsDate(value: string, withTime = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const : {}),
  }).format(date);
}

/**
 * Search results show roughly 60–65 characters of a title. Committed headlines are not
 * rewritten to fit; the masthead suffix is dropped instead when it would push past that.
 */
export const TITLE_BUDGET = 65;
export const newsTitle = (name: string) => `${name} | ${NEWS_NAME}`.length <= TITLE_BUDGET ? `${name} | ${NEWS_NAME}` : name;
export const articleTitle = (article: NewsArticle) => newsTitle(article.headline);
/** Dated lead-in when it fits a snippet (~160 characters), so each edition reads distinctly. */
export function articleDescription(article: NewsArticle): string {
  const dated = `${competitionName(article.competition)} ${editionName(article.edition).toLowerCase()} edition, ${newsDate(article.date)}: ${article.dek}`;
  return dated.length <= 160 ? dated : article.dek;
}
export const competitorTitle = (record: CompetitorRecord) => newsTitle(`${record.name} — ${competitionName(record.competition)} competitor`);
export const competitorDescription = (record: CompetitorRecord) =>
  `The ${competitionName(record.competition)} competitor notebook for ${record.name}: sourced background, observed team names and ARC Daily coverage.`;

/** Share cards: 1200x630, the size every major unfurler renders as a large image. */
export const NEWS_CARD_WIDTH = 1200;
export const NEWS_CARD_HEIGHT = 630;
/** Bump when the card layout changes, so cached article cards are fetched again. 3: Early/Late edition labels. */
export const NEWS_CARD_DESIGN = 3;
/**
 * Front page and notebook card. The bare path is only the route; pages advertise sectionCardPath(),
 * whose version changes with the day and with the editions shown, because link-preview services
 * keep a picture for as long as its address stays the same.
 */
export const NEWS_SECTION_CARD_PATH = '/api/news/og-image.png';
export const NEWS_SECTION_CARD_ALT = `${NEWS_NAME}: daily reporting on the ARC Prize 2026 leaderboards for ARC-AGI-3 and ARC-AGI-2, with an ARC puzzle of the day`;
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
  return shortHash(JSON.stringify([NEWS_CARD_DESIGN, article.headline, article.competition, article.edition, article.date,
    cardStandings(article).map(stat => [stat.rank, stat.name, stat.score, stat.rankChange])]));
}
/**
 * The front-page card prints headlines only while a contest's newest edition is this recent (one
 * missed edition still fits). Past it, the card says what the paper is rather than passing
 * yesterday's news off as today's.
 */
export const NEWS_CARD_FRESH_MS = 36 * 3_600_000;
/** Bump when the front-page card layout changes, so cached front-page cards are fetched again. */
export const NEWS_SECTION_CARD_DESIGN = 1;
/** Eastern calendar day as "2026-10-10"; the front-page card's puzzle changes with it. */
export const easternDay = (now: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
/** The newest still-fresh edition of each contest, ARC-AGI-3 first. Empty means the card shows the evergreen panel. */
export function sectionCardArticles(articles: NewsArticle[], now = Date.now()): NewsArticle[] {
  return (['arc-3', 'arc-2'] as const).flatMap(competition => {
    const newest = articles.filter(article => article.competition === competition)
      .reduce<NewsArticle | undefined>((best, article) => !best || article.publishedAt > best.publishedAt ? article : best, undefined);
    return newest && now - Date.parse(newest.publishedAt) <= NEWS_CARD_FRESH_MS ? [newest] : [];
  });
}
/** Changes with the day and with anything the front-page card prints, so every new edition gets a new address. */
export const sectionCardVersion = (articles: NewsArticle[], now = Date.now()): string =>
  shortHash(JSON.stringify([NEWS_SECTION_CARD_DESIGN, easternDay(now), sectionCardArticles(articles, now).map(article => [article.id, article.headline, article.dek])]));
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
  return `${NEWS_NAME} front page for the ${competitionName(article.competition)} ${editionName(article.edition).toLowerCase()} edition of ${newsDate(article.date)}: “${article.headline}”${standings.length ? `, with the top ${standings.length} of the box score` : ''}.`;
}

/** Same article schema for initial HTML and in-app navigation. */
export function articleStructuredData(article: NewsArticle, origin: string): Record<string, unknown> {
  const url = `${origin}${newsArticlePath(article.id)}`;
  const publisher = { '@type': 'Organization', '@id': `${origin}/news#publisher`, name: NEWS_NAME, url: `${origin}/news`,
    logo: { '@type': 'ImageObject', url: `${origin}/android-chrome-512x512.png`, width: 512, height: 512 } };
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'NewsArticle', '@id': `${url}#article`, url, headline: article.headline, description: article.dek,
    datePublished: article.publishedAt, dateModified: article.publishedAt, inLanguage: 'en', isAccessibleForFree: true,
    image: [{ '@type': 'ImageObject', url: `${origin}${articleCardPath(article)}`, width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, caption: articleCardAlt(article) }],
    articleSection: competitionName(article.competition),
    author: { '@type': 'Organization', name: 'ARC Daily sports desk', url: `${origin}/news` },
    publisher, mainEntityOfPage: url, citation: [...new Set(article.sources.map(source => source.url))],
    isPartOf: { '@type': 'WebSite', name: 'ARC Explainer', url: `${origin}/` },
  }] };
}
