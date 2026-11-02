/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5; GPT-6 Astra Extra high
 * Date: 02-November-2026
 * PURPOSE: The ARC Daily Digest's front page above the fold, laid out like a broadsheet: the
 *          terminal ticker of both boards, a prominent public X strip, then three columns: What's News (the wire), the lead
 *          stories (the newest contest report printed in full, the other contest under it)
 *          and the board in agate type. Dated social dispatches and immutable editions still
 *          compete for each lead by publication time, and every story features at most one person.
 *          09-Oct-2026 (Claude Opus 5.5): rebuilt per the Boss ("information-dense, like a
 *          financial terminal, like a sports page"); without the market digest the columns
 *          close up and the reporting still leads.
 *          Selected Kaggle threads sit below the wire; the leading X strip links to the full collected archive.
 * SRP/DRY check: Pass — reuses story previews, dispatch rendering, the market tables and the wire.
 */
import { Link } from 'wouter';
import type { NewsIndex, NewsDispatch, NewsArticle, NewsCompetition, NewsPerson } from '@shared/news';
import { competitorPath, newsDate, newsArticlePath, editionFeature, editionLabel, personForXHandle, personPath, frontPageSocialPosts, publishedCompetitionOrder, competitionStories } from '@shared/news';
import type { MarketsPayload } from '@shared/newsMarkets';
import { StoryPreview, sortedArticles } from './NewsDesk';
import { BoardTable, MarketTicker, marketBoards } from './NewsMarkets';
import { PersonPortrait } from './NewsPeople';
import { WhatsNews } from './NewsWire';
import { DispatchArt, DispatchPreview } from './NewsDispatch';
import { FromKaggleBoards } from './NewsSources';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';

/** The newest story for one contest (edition or dispatch), then its earlier headlines. */
function CompetitionDesk({ articles, dispatches, competition, lead = false, people }: { articles: NewsArticle[]; dispatches: NewsDispatch[]; competition: NewsCompetition; lead?: boolean; people: NewsPerson[] }) {
  const stories = competitionStories(articles, dispatches, competition);
  const first = stories[0];
  if (!first) return <p className="news-muted">No published coverage yet. <a href={KAGGLE_COMPETITIONS[competition]?.path}>Open the official source →</a></p>;
  // Same-day artwork keeps its dated caption when an edition succeeds a dispatch.
  const companionArt = 'article' in first ? dispatches.find(dispatch => dispatch.competition === competition && dispatch.image && newsDate(dispatch.publishedAt) === newsDate(first.publishedAt)) : undefined;
  const reservedFeature = 'article' in first ? editionFeature(first.article, dispatches) : undefined;
  return <div className={`news-desk${lead ? ' is-lead' : ''}`}>
    {'article' in first
      ? <StoryPreview article={first.article} feature={reservedFeature} lead={lead} people={people} sections={lead ? first.article.sections.length : 2} art={lead && companionArt ? <DispatchArt dispatch={companionArt} lead /> : undefined} />
      : <DispatchPreview dispatch={first.dispatch} lead={lead} people={people} />}
    {stories.length > 1 && <ul className="news-latest-list">{stories.slice(1).filter(story => story.id !== reservedFeature?.id).slice(0, 3).map(story => <li key={story.id}>
      <span>{'article' in story ? editionLabel(story.article) : 'From the contenders'} · {newsDate(story.publishedAt)}</span>
      {'article' in story ? <Link href={newsArticlePath(story.id)}>{story.article.headline}</Link> : <Link href={newsArticlePath(story.id)}>{story.dispatch.headline}</Link>}
    </li>)}</ul>}
    {/* Older dispatches keep their permanent front-page anchors after a new edition leads. */}
    {stories.slice(1).filter(story => 'dispatch' in story && story.id !== reservedFeature?.id).map(story => 'dispatch' in story && <details className="news-older-dispatch" key={story.id}><summary>{story.dispatch.headline}</summary><DispatchPreview dispatch={story.dispatch} people={people} /></details>)}
  </div>;
}

export function NewsFrontPage({ index, markets }: { index: NewsIndex; markets?: MarketsPayload }) {
  const articles = sortedArticles(index.articles);
  const dispatches = index.dispatches ?? [];
  const competitions = publishedCompetitionOrder(articles, dispatches);
  const people = index.people ?? [];
  const boards = marketBoards(markets);
  const links = { competitors: index.competitors, people };
  return <>
    <MarketTicker markets={markets} />
    <AroundTheContests index={index} />
    <div className={`news-front${boards.length ? '' : ' no-board'}`}>
      <section className="news-col-wire" aria-label="What's news"><WhatsNews index={index} /><FromKaggleBoards threads={index.discussions ?? []} compact /></section>
      <section className="news-col-lead" aria-label="Lead stories">
        {competitions.map((competition, position) => <CompetitionDesk key={competition} articles={articles} dispatches={dispatches} competition={competition} lead={position === 0} people={people} />)}
      </section>
      {!!boards.length && <aside className="news-col-board" aria-label="The board">
        <h2 className="news-flag"><span>The board</span><em>Day = change since a day earlier</em></h2>
        {boards.map(board => <BoardTable key={board.competition} board={board} links={links} limit={board.competition === 'arc-3' ? 25 : 20} />)}
      </aside>}
    </div>
  </>;
}

const clip = (text: string, length: number) => text.length <= length ? text : `${text.slice(0, text.lastIndexOf(' ', length - 1) > length * 0.6 ? text.lastIndexOf(' ', length - 1) : length - 1)}…`;

/** Useful public posts lead the page, with the author's face when the account is verified. */
export function AroundTheContests({ index }: { index: NewsIndex }) {
  const people = index.people ?? [];
  const posts = frontPageSocialPosts(index.social ?? []);
  if (!posts.length) return null;
  return <section className="news-around" aria-label="From X">
    <h2 className="news-flag"><span>From X</span><em>Research and reactions around the contests</em></h2>
    <ul>{posts.map(post => {
      const author = personForXHandle(people, post.author);
      return <li key={post.id}>
        {author ? <Link href={personPath(author.id)} tabIndex={-1} aria-hidden="true"><PersonPortrait person={author} size="chip" decorative /></Link> : <span className="news-around-mark" aria-hidden="true">@</span>}
        <div>
          <a href={post.url}><strong>{post.authorName}</strong> <span>@{post.author}{post.postedAt ? ` · ${newsDate(post.postedAt)}` : ''} ↗</span></a>
          <p>{clip(post.summary, 210)}</p>
        </div>
      </li>;
    })}</ul>
    <Link href="/news/community#tweet-archive" className="news-read">Browse the collected tweet archive →</Link>
  </section>;
}

/** The notebook as a newspaper column: dossiers ranked by where their teams stand today. */
export function NotebookColumns({ index, markets }: { index: NewsIndex; markets?: MarketsPayload }) {
  const boards = marketBoards(markets);
  const placed = index.competitors.map(record => {
    const board = boards.find(item => item.competition === record.competition);
    return { record, board, row: board?.watch.find(item => item.teamId === record.teamId) ?? board?.standings.find(item => item.teamId === record.teamId) };
  }).filter(entry => entry.row || entry.record.facts.length)
    .sort((a, b) => (a.row?.rank ?? Infinity) - (b.row?.rank ?? Infinity) || b.record.facts.length - a.record.facts.length || a.record.name.localeCompare(b.record.name))
    .slice(0, 12);
  if (!placed.length) return null;
  return <section className="news-notebook" aria-label="Competitor profiles">
    <h2 className="news-flag"><span>Competitor profiles</span><em>Meet the teams, in today’s board order</em></h2>
    <div className="news-notebook-list">{placed.map(({ record, board, row }) => <article key={record.id} className="news-notebook-line">
      <h3><Link href={competitorPath(record.id)}>{record.name}</Link>{row && board && <span className="num">{board.label} · <b className="pl">#{row.rank.toLocaleString('en-US')}</b> · <b className="sc">{String(row.score)}</b></span>}</h3>
      {record.facts[0]
        ? <p>{clip(record.facts[0].text, 190)} <a href={record.facts[0].sourceUrl} className="news-card-source">Source ↗</a></p>
        : <p className="news-muted">{record.members.length} listed {record.members.length === 1 ? 'member' : 'members'}; no sourced background yet.</p>}
    </article>)}</div>
    <Link href="/news/competitors" className="news-read">Every dossier →</Link>
  </section>;
}
