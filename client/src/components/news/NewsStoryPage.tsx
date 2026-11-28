/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. The Boss on the old story page: it "doesn't look anything like a newspaper,
 *          where space and real estate is a premium, and every tiny bit of space is filled with something useful".
 * PURPOSE: The three-column story page for every published story, a dispatch or an edition (with its reserved feature),
 *          laid out on the front page's grid: the contest wire on the left, the story in the middle and the story's own
 *          dated board, "In this story" cards and the editor's box on the right.
 *          - Middle: kicker, headline, dek, byline, the cover at the column's width with its caption, then the text in two
 *            newspaper columns with a large opening letter, run-in section heads, section pictures as one-column insets
 *            and the note numbers after each section; numbered notes in three columns close the story.
 *          - Right: the story's boards as real tables (storyBoards: box score, standings, typed tables read into rows),
 *            the subject's row marked and team names linked to their profiles, then the shared storyCast() cards,
 *            then the editor's box.
 *          - Left: storyWire(): the contest's other stories (pictures on the top two), "Elsewhere in the Goose", the ARC
 *            Prize 2026 archive link. The story API sends it ready-made; with a whole index it is read here the same way.
 *          The DOM order is story, right column, notes, wire, which is the phone's reading order; the laptop grid places
 *          them in three columns. The server HTML (storyPageHtml in server/services/news/newsPresentation.ts) prints the
 *          same parts in the same order.
 * SRP/DRY check: Pass. Reuses SportsText, StoryPeopleCards, NewsEditorCredit, EditionLabel and the shared readers in
 *          shared/storyPage.ts; the CSS reuses the front page's column rules, flags, briefs and box-score table styles.
 */
import { Fragment, useContext } from 'react';
import { Link } from 'wouter';
import {
  articleFigureStats, competitionName, dispatchLabel, newsDate, reportedPeople, writerCredit, NEWS_NAME,
  type CompetitorRecord, type NewsArticle, type NewsDispatch, type NewsIndex, type NewsSection, type NewsStat,
} from '@shared/news';
import { scoreDirectionText, sectionParagraphs, storyBoards, storyNotes, storyWire, type StoryBoard, type StoryWire } from '@shared/storyPage';
import { SportsText } from './SportsText';
import { StoryPeopleCards } from './NewsPeople';
import { NewsEditorCredit } from './NewsEditorCredit';
import { EditionLabel, NewsBrandContext } from './NewsDesk';

type Story = NewsArticle | NewsDispatch;
const isEdition = (story: Story): story is NewsArticle => 'edition' in story;

/** A picture inside the text: one newspaper column wide. */
function Inset({ image }: { image: { src: string; alt: string; caption: string } }) {
  return <figure className="news-inset"><a href={image.src}><img src={image.src} alt={image.alt} loading="lazy" decoding="async" /></a><figcaption>{image.caption}</figcaption></figure>;
}

/** Note numbers after a section, each linking to its note at the end. */
function NoteRefs({ numbers }: { numbers: number[] }) {
  return numbers.length ? <sup className="news-noterefs">{numbers.map((number, position) => <Fragment key={number}>{position ? ',' : ''}<a href={`#note-${number}`} aria-label={`Note ${number}`}>{number}</a></Fragment>)}</sup> : null;
}

/** One section: the run-in head starts its first paragraph; its note numbers close it. Its picture is placed by StoryText. */
function StorySection({ section, refs, stats, teamNames, after, opening = false }: { section: NewsSection; refs: number[]; stats: NewsStat[]; teamNames?: string[]; after?: React.ReactNode; opening?: boolean }) {
  const paragraphs = sectionParagraphs(section);
  // The story's opening section keeps its first letter for the large opening letter, so its head stands above it.
  const runIn = !!section.heading && !opening;
  return <section className="news-story-section">
    {opening && section.heading && <h3 className="news-runin news-opening-head">{section.heading}</h3>}
    {paragraphs.map((paragraph, index) => <p key={index} className="news-dispatch-text">
      {index === 0 && runIn && <><strong className="news-runin">{section.heading}</strong>{' '}</>}
      <SportsText text={paragraph} stats={stats} teamNames={teamNames} />
      {index === paragraphs.length - 1 && <NoteRefs numbers={refs} />}
    </p>)}
    {!paragraphs.length && section.heading && <p className="news-dispatch-text"><strong className="news-runin">{section.heading}</strong> <NoteRefs numbers={refs} /></p>}
    {after}
  </section>;
}

/**
 * A story's sections in two newspaper columns. The section pictures follow the words as one-column insets: a picture
 * cannot break across columns, and set at the end of the run the balanced columns come out level (set mid-run, a tall
 * picture pushed a whole column down and left a hole beside it). Each caption says what the picture shows.
 */
function StoryText({ story, refs, stats, teamNames, extraPicture }: { story: Story; refs: number[][]; stats: NewsStat[]; teamNames?: string[]; extraPicture?: NewsSection['image'] }) {
  const pictures = [...(extraPicture ? [extraPicture] : []), ...story.sections.flatMap(section => section.image ? [section.image] : [])];
  return <div className="news-columns">
    {story.sections.map((section, index) => <StorySection key={index} opening={index === 0} section={section} refs={refs[index] ?? []} stats={stats} teamNames={teamNames}
      after={!isEdition(story) && story.id === 'on-the-private' && index === 0 ? <p className="news-dispatch-text"><a href="/news-scene-books/on-the-private/index.html">Explore the scene book and production stills ↗</a></p> : undefined} />)}
    {!isEdition(story) && story.interpretation && <p className="news-dispatch-take"><strong>{NEWS_NAME}’s take</strong> {story.interpretation}</p>}
    {pictures.map(picture => <Inset key={picture.src} image={picture} />)}
  </div>;
}

/** One of the story's dated boards as a table; the first also carries the number key and the full-board link. */
export function StoryBoardTable({ board, first }: { board: StoryBoard; first: boolean }) {
  const example = board.rows[0];
  const direction = scoreDirectionText(board.competition);
  return <div className="news-storyboard">
    <p className="news-storyboard-caption">{board.caption}{board.observedAt && <> · <time dateTime={board.observedAt}>{newsDate(board.observedAt, true)}</time></>}</p>
    <div className="news-storyboard-wrap" tabIndex={0} role="region" aria-label={`${board.caption}, scrollable table`}>
      <table className="news-boxscore news-storyboard-table">
        <thead><tr><th scope="col">Place</th><th scope="col">Team</th><th scope="col">Score</th>{board.extraColumns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{board.rows.map(row => <tr key={row.key} className={row.subject ? 'is-subject' : undefined}>
          <td className="pl">#{row.place.toLocaleString('en-US')}</td><td>{row.href ? <Link href={row.href} className="news-team-name">{row.team}</Link> : <strong className="news-team-name">{row.team}</strong>}</td><td className="sc">{row.score}</td>
          {row.extra.map((cell, index) => <td key={index} className={board.extraClasses[index] || undefined}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {first && example && <p className="news-storyboard-key"><span>Place <b className="pl">#{example.place}</b></span><span>Score <b className="sc">{example.score}</b></span>{direction && <span>{direction}</span>}
      {board.boardHref && <a className="news-read" href={board.boardHref}>The full board →</a>}</p>}
  </div>;
}

/** The left column: the contest's other stories, then elsewhere in the paper, then the archive link. */
export function StoryWireColumn({ wire }: { wire: StoryWire }) {
  const brand = useContext(NewsBrandContext);
  return <nav className="news-storypage-wire" aria-label={`More from ${brand.name}`}>
    <h2 className="news-flag"><span>{wire.contestName}</span><em>More from this contest</em></h2>
    {wire.contest.map(item => <article key={item.id} className={`news-brief${item.image ? ' has-art' : ''}`}>
      {item.image && <Link href={item.href} className="news-wire-art" tabIndex={-1} aria-hidden="true"><img src={item.image.src} alt="" decoding="async" /></Link>}
      <div className="news-brief-meta"><b>{item.label}</b> · {newsDate(item.publishedAt, true)}</div>
      <h3><Link href={item.href}>{item.headline}</Link></h3>
      {item.dek && <p className="news-wire-dek">{item.dek}</p>}
    </article>)}
    {!wire.contest.length && <p className="news-muted">No other stories from this contest yet.</p>}
    {!!wire.elsewhere.length && <>
      <h2 className="news-flag news-wire-elsewhere"><span>Elsewhere in {brand.goose ? 'the Goose' : 'the paper'}</span></h2>
      <ul className="news-latest-list">{wire.elsewhere.map(item => <li key={item.id}><span>{item.competition} · {newsDate(item.publishedAt)}</span><Link href={item.href}>{item.headline}</Link></li>)}</ul>
    </>}
    <Link className="news-read news-wire-archive" href={wire.archive.href}>{wire.archive.text} →</Link>
  </nav>;
}

/** The three-column page for one story. `feature` is an edition's reserved feature, printed first. */
export function NewsStoryPage({ story, feature, index, competitors = [] }: { story: Story; feature?: NewsDispatch; index: NewsIndex; competitors?: CompetitorRecord[] }) {
  const people = index.people ?? [];
  const printed: Story[] = feature ? [feature, story] : [story];
  const wire = index.storyWire ?? storyWire(story, index.articles, index.dispatches ?? []);
  const boards = storyBoards(printed, people, competitors);
  const { notes, refs } = storyNotes(printed);
  const edition = isEdition(story) ? story : undefined;
  const stats = edition ? articleFigureStats(edition) : [];
  const cover = feature?.image ?? story.image;
  const commissioned = printed.find(item => !isEdition(item) && item.commissionedBy) as NewsDispatch | undefined;
  return <div className="news-storypage">
    <article id={story.id} className="news-storypage-story">
      <header className="news-storypage-header">
        <div className="news-storypage-meta">
          {edition ? <EditionLabel article={edition} /> : <div className="news-kicker"><span>{competitionName(story.competition)}</span><span>{dispatchLabel(story as NewsDispatch)}</span></div>}
          <p className="news-byline">{edition ? <>{NEWS_NAME} sports desk <span>· {writerCredit(edition.generatedBy)} · <time dateTime={edition.publishedAt}>{newsDate(edition.date)}</time></span></>
            : <><time dateTime={story.publishedAt}>{newsDate(story.publishedAt, true)}</time>{story.generatedBy && <span> · {writerCredit(story.generatedBy)}</span>}</>}</p>
        </div>
        <h1 className="news-article-title"><SportsText text={story.headline} stats={stats} teamNames={edition?.verifiedTeamNames} /></h1>
        {story.dek && <p className="news-dek"><SportsText text={story.dek} stats={stats} teamNames={edition?.verifiedTeamNames} /></p>}
        {/* Readers get the date of the latest update only; the reason is the newsroom's correction record and never prints. */}
        {!!story.revisions?.length && <div className="news-revisions"><p className="news-muted">Updated <time dateTime={story.revisions[story.revisions.length - 1].at}>{newsDate(story.revisions[story.revisions.length - 1].at)}</time></p></div>}
      </header>
      {cover && <figure className="news-storypage-cover"><a href={cover.src} aria-label="Open the full editorial illustration"><img src={cover.src} alt={cover.alt} loading="eager" /></a>
        <figcaption><SportsText text={cover.caption} stats={stats} /></figcaption></figure>}
      {feature && <>
        <div id={feature.id}><h2 className="news-storypage-feature">{feature.headline}</h2>
          <StoryText story={feature} refs={refs[0]} stats={stats} /></div>
        {edition && <h2 className="news-storypage-feature">{edition.headline}</h2>}
      </>}
      <StoryText story={story} refs={refs[feature ? 1 : 0]} stats={stats} teamNames={edition?.verifiedTeamNames}
        extraPicture={edition?.image && edition.image.src !== cover?.src ? edition.image : undefined} />
    </article>
    <aside className="news-storypage-rail" aria-label="The board and the people in this story">
      {!!boards.length && <section className="news-storypage-boards" aria-label="The board">
        <h2 className="news-flag"><span>The board</span><em>Public board, provisional</em></h2>
        {boards.map((board, position) => <StoryBoardTable key={board.key} board={board} first={position === 0} />)}
      </section>}
      {edition && <div className="news-storypage-checked">
        <p><strong>Board date</strong> <time dateTime={edition.dataAsOf}>{newsDate(edition.dataAsOf, true)}</time></p>
        <p><strong>Compared with</strong> {edition.baselineAt ? <time dateTime={edition.baselineAt}>{newsDate(edition.baselineAt, true)}</time> : 'no comparable earlier save'}</p>
        <p>{edition.coverageNote}</p>
        <a className="news-read" href={`/api/news/${edition.id}/evidence`}>Exact observations and reporting data →</a>
      </div>}
      <StoryPeopleCards stories={printed} people={reportedPeople(printed, people)} />
      <NewsEditorCredit note={commissioned?.editorNote} commissioned={!!commissioned} />
    </aside>
    {!!notes.length && <section className="news-storypage-notes" aria-label="Notes">
      <h2 className="news-notes-label">Notes</h2>
      <ol className="news-notes">{notes.map(note => <li key={note.number} id={`note-${note.number}`}><b className="news-note-number">{note.number}</b> <a href={note.source.url} target="_blank" rel="noopener noreferrer">{note.source.title} ↗</a></li>)}</ol>
    </section>}
    <StoryWireColumn wire={wire} />
  </div>;
}
