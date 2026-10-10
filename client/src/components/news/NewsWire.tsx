/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: The wire desk on the page. GPT-6 Luna files short sourced stories several times a day
 *          (scripts/newsroom_wire.py, docs/newsroom/WIRE_DESK.md); the front page's What's News
 *          column runs the newest ones as briefs, topped up with the editions' summaries while
 *          the desk has filed few, and /news/wire carries every story in full with its sources.
 *          A story shows the picture it chose from its brief, else the face of the first person
 *          it is about; nobody else's face is pulled in.
 * SRP/DRY check: Pass — reads NewsIndex only; faces through PersonPortrait, Eastern times through
 *          clockEt, edition summaries through the shared edition helpers.
 */
import { Link } from 'wouter';
import { competitionName, competitorPath, editionLabel, newsArticlePath, newsDate, personPath, wirePath, writerCredit,
  type NewsArticle, type NewsIndex, type NewsPerson, type NewsWireStory } from '@shared/news';
import { sortedArticles } from './NewsDesk';
import { clockEt } from './NewsMarkets';
import { PersonLinks, PersonPortrait } from './NewsPeople';

export const sortedWire = (stories: NewsWireStory[]) => [...stories].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

/** "9:05 pm ET" today, "Oct 8, 9:05 pm ET" before. */
function filedAt(iso: string): string {
  const day = (value: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(value);
  return day(new Date(iso)) === day(new Date()) ? clockEt(iso) : `${day(new Date(iso))}, ${clockEt(iso)}`;
}

function StoryPicture({ story, people }: { story: NewsWireStory; people: NewsPerson[] }) {
  if (story.visual) return <Link href={story.visual.href} className="news-brief-art"><img src={story.visual.src} alt={story.visual.alt} loading="lazy" decoding="async" /></Link>;
  const person = people.find(item => item.id === story.personIds[0]);
  return person ? <Link href={personPath(person.id)} className="news-brief-art" tabIndex={-1} aria-hidden="true"><PersonPortrait person={person} size="face" decorative /></Link> : null;
}

function WireBrief({ story, people }: { story: NewsWireStory; people: NewsPerson[] }) {
  return <article className="news-brief">
    <StoryPicture story={story} people={people} />
    <div className="news-brief-meta"><b>{competitionName(story.competition)}</b> · {filedAt(story.publishedAt)}</div>
    <h3><Link href={wirePath(story.id)}>{story.headline}</Link></h3>
    <p>{story.sections[0].text}</p>
  </article>;
}

function EditionBrief({ article }: { article: NewsArticle }) {
  return <article className="news-brief">
    <div className="news-brief-meta"><b>{competitionName(article.competition)}</b> · {editionLabel(article)}</div>
    <h3><Link href={newsArticlePath(article.id)}>{article.headline}</Link></h3>
    <p>{article.dek}</p>
  </article>;
}

/** The front page's left column: the newest wire stories, then the editions' summaries while the wire is thin. */
export function WhatsNews({ index }: { index: NewsIndex }) {
  const people = index.people ?? [];
  const wire = sortedWire(index.wire ?? []).slice(0, 7);
  const editions = (['arc-3', 'arc-2'] as const).map(competition => sortedArticles(index.articles).find(article => article.competition === competition))
    .filter((article): article is NewsArticle => !!article);
  return <>
    <h2 className="news-flag"><span>What’s news</span><em>The wire</em></h2>
    {wire.map(story => <WireBrief key={story.id} story={story} people={people} />)}
    {wire.length < 4 && editions.map(article => <EditionBrief key={article.id} article={article} />)}
    {!wire.length && <p className="news-muted">The wire desk files short stories on the boards several times a day.</p>}
    <Link href={wirePath()} className="news-read">The full wire →</Link>
  </>;
}

/** One wire story in full, with its picture, sources and the teams and people it names. */
export function WireStory({ story, index }: { story: NewsWireStory; index: NewsIndex }) {
  const people = (index.people ?? []).filter(person => story.personIds.includes(person.id));
  const teams = index.competitors.filter(record => record.competition === story.competition && story.teamIds.includes(record.teamId));
  return <article id={story.id} className="news-story news-wire-story">
    <StoryPicture story={story} people={index.people ?? []} />
    <div className="news-kicker"><span>{competitionName(story.competition)}</span><span>The wire · {filedAt(story.publishedAt)}</span></div>
    <h2><a href={`#${story.id}`}>{story.headline}</a></h2>
    {story.sections.map((section, number) => <section key={number}>
      {section.heading && <h3>{section.heading}</h3>}
      <p className="news-dispatch-text">{section.text}</p>
      <div className="news-section-sources">{section.sourceIds.map(id => {
        const source = story.sources.find(item => item.id === id);
        return source ? <a key={id} href={source.url}>{source.title} ↗</a> : null;
      })}</div>
    </section>)}
    {(!!people.length || !!teams.length) && <div className="news-section-sources">
      {people.map(person => <PersonLinks key={person.id} person={person} honors={0} />)}
      {teams.map(team => <Link key={team.id} href={competitorPath(team.id)}>{team.name} notebook →</Link>)}
    </div>}
    <p className="news-byline">The wire desk · {writerCredit(story.generatedBy)} · board saved {newsDate(story.dataAsOf, true)}{story.since ? <> · compared with {newsDate(story.since, true)}</> : null} · <a href={`/api/news/wire/${story.id}/evidence`}>evidence</a></p>
  </article>;
}
