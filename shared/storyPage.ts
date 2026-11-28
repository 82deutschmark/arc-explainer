/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. The story page became a three-column newspaper page (the Boss: it "doesn't
 *          look anything like a newspaper"); this module holds what both renderers need to lay it out the same way.
 * PURPOSE: The shared reading of a story (a dispatch or an edition) for the three-column story page, used by the browser
 *          page (client/src/components/news/NewsStoryPage.tsx) and the server HTML (server/services/news/newsPresentation.ts):
 *          - typedBoards(): the plain-text leaderboards the desks type into a section ("#1  Daniel Franzen  ·  0.554 …"),
 *            read into rows with their caption line and column names, and the section's words with the table taken out;
 *          - storyBoards(): the story's own dated boards for the right column, newest first: the edition's box score, the
 *            sections' structured standings, then the typed tables (the last one printed is the newest read); the
 *            story's subject's row is marked, team names link to their profiles, and movement reads "↑ 2" / "=";
 *          - storyNotes(): the cited sources as numbered notes, and the note numbers after each section;
 *          - storyWire(): the left column: the story's contest's other stories newest first, then "Elsewhere in the
 *            Goose" headlines from the other contests, then the ARC Prize 2026 archive link.
 * SRP/DRY check: Pass. Reuses citedSources, competitionStories, publishedStories and the labels in shared/news.ts;
 *          shared/storyCast.ts reads its board rows through typedBoards(), so the cards and the board table agree.
 */
import { KAGGLE_COMPETITIONS } from './kaggleCompetitions';
import {
  articleCompetitions, citedSources, competitionName, competitionStories, dispatchLabel, editionLabel, newsArticlePath, publishedStories,
  competitorPath, scoreChangeLabel,
  type CompetitorRecord, type NewsArticle, type NewsCompetition, type NewsDispatch, type NewsPerson, type NewsSection, type NewsSource,
} from './news';

/**
 * The ARC Prize 2026 archive page. The ARC-into-storage work (branch claude/goose-arc-archive, shared/newsSeasons.ts,
 * ARC_2026_ARCHIVE.path) owns this address; when both land, this constant should read from there.
 */
export const STORY_ARC_ARCHIVE = { path: '/news/archive/arc-prize-2026', text: 'ARC Prize 2026 archive' } as const;

// ── Typed boards ────────────────────────────────────────────────────────────────────────────────────────────────

/** One typed board line: "#1  Daniel Franzen  ·  0.554  ·  6  ·  17:11". Fields are split on a spaced middle dot. */
const BOARD_LINE = /^\s*#(\d[\d,]*)\s+(.+?)\s*$/u;
const FIELD_SPLIT = /\s+·\s+/u;
/** The column header line some desks print above a table: "Place · Team · Best public score · Entries · Last submission". */
const HEADER_LINE = /^\s*place\s*·/iu;

export interface TypedBoardRow { place: number; team: string; fields: string[] }
export interface TypedBoard { caption: string; columns: string[]; rows: TypedBoardRow[] }

/** Short column names for the narrow right column. */
function columnName(label: string): string {
  if (/score/i.test(label)) return 'Score';
  if (/last/i.test(label)) return 'Last entry';
  if (/entries/i.test(label)) return 'Entries';
  return label.trim();
}

/**
 * The typed tables in one section's text, in the order printed, and the text with each table, its header line and its
 * caption line taken out (the caption travels with the table). A table needs at least two rows: one "#1 …" line in a
 * sentence is reporting, not a board.
 */
export function typedBoards(text: string): { boards: TypedBoard[]; prose: string } {
  const lines = text.split('\n');
  const boards: TypedBoard[] = [];
  const drop = new Set<number>();
  let index = 0;
  while (index < lines.length) {
    const start = index;
    const rows: TypedBoardRow[] = [];
    while (index < lines.length) {
      const match = BOARD_LINE.exec(lines[index]);
      const fields = match?.[2].split(FIELD_SPLIT);
      if (!match || !fields || fields.length < 2) break;
      rows.push({ place: Number(match[1].replace(/,/g, '')), team: fields[0], fields: fields.slice(1) });
      index++;
    }
    if (rows.length < 2) { index = start + 1; continue; }
    for (let line = start; line < index; line++) drop.add(line);
    // Above the rows: an optional header line, then the caption (the nearest earlier line that is not blank or a header).
    let above = start - 1;
    while (above >= 0 && !lines[above].trim()) above--;
    let columns = ['Score', ...rows[0].fields.slice(1).map((_, position) => `Field ${position + 2}`)];
    if (above >= 0 && HEADER_LINE.test(lines[above]) && !drop.has(above)) {
      columns = lines[above].split(/\s*·\s*/u).slice(2).map(columnName);
      drop.add(above);
      above--;
      while (above >= 0 && !lines[above].trim()) above--;
    }
    let caption = '';
    if (above >= 0 && !drop.has(above) && !BOARD_LINE.test(lines[above])) { caption = lines[above].trim(); drop.add(above); }
    boards.push({ caption, columns, rows });
  }
  const prose = lines.filter((_, line) => !drop.has(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { boards, prose };
}

/** A section's words as the story column prints them: paragraphs, with any typed table moved to the board column. */
export const sectionParagraphs = (section: Pick<NewsSection, 'text'>): string[] =>
  typedBoards(section.text).prose.split(/\n\s*\n+/).map(paragraph => paragraph.trim()).filter(Boolean);

// ── The right column's boards ───────────────────────────────────────────────────────────────────────────────────

export interface StoryBoardRow { key: string; place: number; team: string; score: string; extra: string[]; subject: boolean;
  /** The team's profile page, when the paper keeps one for this contest. */
  href?: string }
export interface StoryBoard {
  key: string; kind: 'box-score' | 'standings' | 'typed';
  /** The dated line above the table: what board, when. */
  caption: string; observedAt?: string;
  /** Column names after Place, Team and Score. */
  extraColumns: string[];
  /** The house class for each extra column ('sd' marks a score difference). */
  extraClasses: string[];
  rows: StoryBoardRow[];
  competition: NewsCompetition; boardHref?: string;
}

const normalise = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** The names a board row can carry for the story's subject: their name, verified Kaggle handles and team names in the contest. */
function subjectNames(subject: NewsPerson | undefined, competitions: NewsCompetition[]): { names: Set<string>; teamIds: Set<string> } {
  if (!subject) return { names: new Set(), teamIds: new Set() };
  const memberships = subject.memberships.filter(member => competitions.includes(member.competition));
  return {
    names: new Set([subject.name, ...subject.accounts.filter(account => account.platform === 'kaggle').map(account => account.handle), ...memberships.map(member => member.teamName)].map(normalise)),
    teamIds: new Set(memberships.map(member => member.teamId)),
  };
}

/** Where the full board lives: the site's own board page for the ARC contests, else the Kaggle leaderboard. */
export const fullBoardHref = (competition: NewsCompetition) => KAGGLE_COMPETITIONS[competition]?.path;

/** A compact, labelled movement for the narrow board column: "↑ 2", "↓ 1", "=" (unchanged), "—" (no comparison). */
export const placeMove = (change: number | null) => change == null ? '—' : change === 0 ? '=' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}`;

type BoardStory = Pick<NewsDispatch, 'competition' | 'sections' | 'personIds'> & Partial<Pick<NewsArticle, 'stats' | 'dataAsOf' | 'competitions'>>;

/**
 * The story's own dated boards, newest first: the edition's box score, then structured standings, then typed tables
 * (each section's last printed table is its newest read; later sections are newer). The subject (the first listed
 * person) is marked on any row that carries their name, Kaggle handle or team.
 */
export function storyBoards(stories: readonly BoardStory[], people: readonly NewsPerson[] = [], competitors: readonly CompetitorRecord[] = []): StoryBoard[] {
  const boards: StoryBoard[] = [];
  for (const story of stories) {
    const competitions = articleCompetitions({ competition: story.competition, competitions: story.competitions });
    // A row links to the team's profile only where the paper keeps one for this contest: by team id, else by exact name.
    const profile = (team: string, teamId?: string) => {
      const record = competitors.find(item => competitions.includes(item.competition) && (teamId ? item.teamId === teamId : normalise(item.name) === normalise(team)));
      return record ? competitorPath(record.id) : undefined;
    };
    const subject = people.find(person => person.id === story.personIds?.[0]);
    const { names, teamIds } = subjectNames(subject, competitions);
    const isSubject = (team: string, teamId?: string) => names.has(normalise(team)) || (!!teamId && teamIds.has(teamId));
    const href = fullBoardHref(story.competition);
    const typed: StoryBoard[] = [];
    story.sections.forEach((section, sectionIndex) => {
      if (section.standings?.rows.length) typed.push({
        key: `standings-${sectionIndex}`, kind: 'standings', caption: section.standings.caption, observedAt: section.standings.observedAt,
        extraColumns: [], extraClasses: [], competition: story.competition, boardHref: href,
        rows: section.standings.rows.map(row => ({ key: row.teamId, place: row.rank, team: row.name, score: String(row.score), extra: [], subject: isSubject(row.name, row.teamId), href: profile(row.name, row.teamId) })),
      });
      typedBoards(section.text).boards.forEach((board, boardIndex) => typed.push({
        key: `typed-${sectionIndex}-${boardIndex}`, kind: 'typed', caption: board.caption,
        extraColumns: board.columns.slice(1), extraClasses: board.columns.slice(1).map(() => ''), competition: story.competition, boardHref: href,
        rows: board.rows.map((row, rowIndex) => ({ key: `${rowIndex}-${row.team}`, place: row.place, team: row.team, score: row.fields[0] ?? '', extra: row.fields.slice(1), subject: isSubject(row.team), href: profile(row.team) })),
      }));
    });
    if (story.stats?.length) boards.push({
      key: 'box-score', kind: 'box-score', caption: 'The box score', observedAt: story.dataAsOf,
      extraColumns: ['Places', 'Score ±'], extraClasses: ['', 'sd'], competition: story.competition, boardHref: href,
      rows: story.stats.map(stat => ({ key: stat.teamId, place: stat.rank, team: stat.name, score: String(stat.score), extra: [placeMove(stat.rankChange), scoreChangeLabel(stat.scoreChange, '—')], subject: isSubject(stat.name, stat.teamId), href: profile(stat.name, stat.teamId) })),
    });
    boards.push(...typed.reverse());
  }
  return boards;
}

/** "Higher scores are better" for the contest, when the directory records it. */
export const scoreDirectionText = (competition: NewsCompetition) => {
  const direction = KAGGLE_COMPETITIONS[competition]?.scoreDirection;
  return direction ? `${direction === 'higher' ? 'Higher' : 'Lower'} scores are better` : '';
};

// ── Numbered notes ──────────────────────────────────────────────────────────────────────────────────────────────

export interface StoryNotes {
  notes: { number: number; source: NewsSource }[];
  /** refs[story][section]: the note numbers printed after that section, in order. */
  refs: number[][][];
}

/** The cited sources of the stories a page prints (a feature, then its edition), numbered once each in first-citation order. */
export function storyNotes(stories: readonly { sections: Pick<NewsSection, 'sourceIds'>[]; sources: NewsSource[] }[]): StoryNotes {
  const byUrl = new Map<string, number>();
  const notes: StoryNotes['notes'] = [];
  for (const story of stories) for (const source of citedSources(story)) {
    if (byUrl.has(source.url)) continue;
    byUrl.set(source.url, notes.length + 1);
    notes.push({ number: notes.length + 1, source });
  }
  const refs = stories.map(story => story.sections.map(section => [...new Set(section.sourceIds
    .map(id => story.sources.find(source => source.id === id)?.url).flatMap(url => url && byUrl.has(url) ? [byUrl.get(url)!] : []))]));
  return { notes, refs };
}

// ── The left column ─────────────────────────────────────────────────────────────────────────────────────────────

export interface StoryWireItem {
  id: string; href: string; competition: string; label: string; publishedAt: string; headline: string; dek?: string;
  image?: { src: string; alt: string };
}
export interface StoryWire { contest: StoryWireItem[]; contestName: string; elsewhere: StoryWireItem[]; archive: { href: string; text: string } }

/** How many of the contest's other stories, and how many from elsewhere, the left column lists. */
export const STORY_WIRE_LIMITS = { contest: 6, pictures: 2, elsewhere: 10 } as const;

const wireItem = (story: NewsArticle | NewsDispatch): StoryWireItem => 'edition' in story
  ? { id: story.id, href: newsArticlePath(story.id), competition: competitionName(story.competition), label: editionLabel(story), publishedAt: story.publishedAt, headline: story.headline, dek: story.dek, image: story.image ? { src: story.image.src, alt: story.image.alt } : undefined }
  : { id: story.id, href: newsArticlePath(story.id), competition: competitionName(story.competition), label: dispatchLabel(story), publishedAt: story.publishedAt, headline: story.headline, dek: story.dek, image: story.image ? { src: story.image.src, alt: story.image.alt } : undefined };

/**
 * The left column for one story: its contest's other stories newest first (pictures on the top two), then the newest
 * headlines from the paper's other contests, then the ARC Prize 2026 archive link. An edition's reserved feature is
 * the same story and is left out.
 */
export function storyWire(story: NewsArticle | NewsDispatch, articles: readonly NewsArticle[], dispatches: readonly NewsDispatch[] = []): StoryWire {
  const own = new Set([story.id, ...('edition' in story && story.frontPageFeatureId ? [story.frontPageFeatureId] : []),
    ...articles.filter(article => article.frontPageFeatureId === story.id).map(article => article.id)]);
  const competitions = 'edition' in story ? articleCompetitions(story) : [story.competition];
  const contest = competitionStories([...articles], [...dispatches], story.competition)
    .filter(item => !own.has(item.id)).slice(0, STORY_WIRE_LIMITS.contest)
    .map((item, position) => {
      const entry = wireItem('article' in item ? item.article : item.dispatch);
      return position < STORY_WIRE_LIMITS.pictures ? entry : { ...entry, image: undefined };
    });
  const elsewhere = publishedStories([...articles], [...dispatches])
    .filter(item => !own.has(item.id) && !('edition' in item ? articleCompetitions(item) : [item.competition]).some(key => competitions.includes(key)))
    .slice(0, STORY_WIRE_LIMITS.elsewhere).map(item => ({ ...wireItem(item), image: undefined, dek: undefined }));
  return { contest, contestName: competitionName(story.competition), elsewhere, archive: { href: STORY_ARC_ARCHIVE.path, text: STORY_ARC_ARCHIVE.text } };
}
