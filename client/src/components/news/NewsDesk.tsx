/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Terra / Codex (reasoning effort not exposed); GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 / Codex; GPT-6 Sol / Codex; Claude Sonnet 5.5; GPT-6 Astra Extra high; Claude Opus 5.5
 * Date: 14-Nov-2026 (Claude Opus 5.5); 09-November-2026
 * 14-Nov-2026 (Claude Opus 5.5): the masthead prints the edition label it is given (editionTitle) instead of
 *          rebuilding it from morning/evening; a story preview shows its own art, else same-day companion art,
 *          never a picture already printed by its feature; the archive labels each issue with editionLabel.
 * PURPOSE: Shared ARC Daily newspaper layout, query, date labels and source-aware story
 *          previews. All views read the same modest /api/news archive and typed contract.
 *          08-Oct-2026: newsDate/competitionName now live in shared/news.ts; visual shell
 *          and sourced profile previews align with the ARC Explainer landing page.
 *          The masthead names both contests; compact links branch into people, community
 *          and the unified About the Paper page. Reader contacts reuse the shared masthead.
 *          The permanent Card Cabinet is linked in every newspaper masthead.
 *          Each story credits its recorded writer. The shared shell
 *          discloses VoynichLabs sponsorship in a compact content-first masthead.
 *          09-Oct-2026 (Claude Opus 5.5): story previews show the faces of the people each
 *          edition cites or covers; profile cards show the verified people on the team.
 *          Later the same day, per the Boss ("think like a newspaper editor"): a broadsheet
 *          masthead with ears (edition, date and countdown; the sponsor), an Early/Late edition
 *          line, a section nav that includes the wire, and lead stories printed in full.
 *          10-Oct-2026 (Claude Sonnet 5.5): useNewsCardImage, so pages that share the front-page
 *          share card write the same versioned address in the browser that the server rendered.
 *          10-Oct-2026 (Claude Sonnet 5.5): AboutThisPaper, the front-page info box on where the data
 *          comes from and how to reach Boss with corrections, retractions or complaints.
 *          NewsWelcome, a one-time pop-up for first-time visitors, renders in the shared shell.
 *          16-Oct-2026 (Claude Opus 5.5 Medium): the masthead countdown reads the shared close helpers.
 *          02-Nov-2026 (Claude Opus 5.5 High): story previews lead with art and the opening section;
 *          the compact cast cards follow it instead of sitting under the byline.
 * SRP/DRY check: Pass — presentation helpers reuse shared news and competition identities.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { NEWS_CARD_HEIGHT, NEWS_CARD_WIDTH, NEWS_NAME, NEWS_ARCHIVE, articleCompetitionLabel, articleFigureStats, sectionCardAlt, sectionCardPath, newsArticlePath, competitorPath, newsDate, competitionName, editionLabel, reportedPeople, wirePath, writerCredit, type NewsArticle, type NewsDispatch, type NewsIndex, type CompetitorRecord, type NewsPerson } from '@shared/news';
import { KAGGLE_COMPETITIONS, closeMs, daysToClose } from '@shared/kaggleCompetitions';
import { SITE_ORIGIN } from '@shared/seo';
import { NEWS_STAFF_PATH, NEWS_EDITOR_CONTACT } from '@shared/newsStaff';
import { MastheadAd } from './SponsorPlacement';
import { StoryPeopleCards, TeamFaces } from './NewsPeople';
import { NewsWelcome } from './NewsWelcome';
import './news.css';
import { NEWS_BRAND } from '@shared/newsBrand';
import { SportsText, NumberKey } from './SportsText';
import { NewsArticleSectionExtras } from './NewsArticleSectionExtras';
import { DispatchPreview } from './NewsDispatch';

/** The public ARC Prize Discord invite already used by ARC Explainer's other pages. */
export const ARC_DISCORD_URL = NEWS_EDITOR_CONTACT.discordUrl;

/** The X account the editions are posted from; also where readers reach Boss. */
export const ARC_DAILY_X_URL = NEWS_EDITOR_CONTACT.xUrl;

export function useNews() {
  return useQuery<NewsIndex>({ queryKey: ['/api/news'], staleTime: 60_000, refetchInterval: 60_000 });
}

/** The front-page share card under today's address (the server writes the same one), once the archive has loaded. */
export function useNewsCardImage() {
  const { data } = useNews();
  return useMemo(() => data ? { image: `${SITE_ORIGIN}${sectionCardPath(data.articles)}`, imageAlt: sectionCardAlt(data.articles), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT } : undefined, [data]);
}

// Date labels and competition names moved to shared/news.ts on 08-Oct-2026 so server HTML,
// share cards and these views print them identically.
export { newsDate, competitionName };

export const sortedArticles = (articles: NewsArticle[]) => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));

/** Weekday and date in UTC, as a dateline prints it: "Friday, October 9, 2026". */
export function datelineDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date) + ' · UTC'
    : 'Date unavailable';
}

/** Days until both boards close (they share a deadline) and the close date in UTC; null once past or unknown. */
export function theClose(now = Date.now()): { days: number; date: string } | null {
  const close = closeMs(KAGGLE_COMPETITIONS['arc-3']);
  const days = daysToClose(KAGGLE_COMPETITIONS['arc-3'], now);
  return close != null && days ? { days, date: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', day: 'numeric' }).format(new Date(close)) } : null;
}

/** The paper's section links; the slim Cabinet bar and the broadsheet masthead print the same list. */
export function NewsNav({ className = 'news-nav', brand = NEWS_BRAND }: { className?: string; brand?: typeof NEWS_BRAND }) {
  return <nav className={className} aria-label={`${brand.name} sections`}>
    <Link href="/news">Front page</Link>
    <Link href={wirePath()}>The wire</Link>
    <Link href="/news/cards">{brand.goose ? 'Cards' : 'ARC Prize Cards'}</Link>
    <Link href={NEWS_ARCHIVE.path}>{NEWS_ARCHIVE.heading}</Link>
    <Link href={NEWS_STAFF_PATH}>About the paper</Link>
    {brand.goose ? <a href="https://www.kaggle.com/competitions" target="_blank" rel="noopener noreferrer">Kaggle contests ↗</a> : <>
    <a href="/kaggle-leaderboard">ARC-AGI-3 board ↗</a>
    <a href="/kaggle-leaderboard/arc-2">ARC-AGI-2 board ↗</a>
    <a href="/human-records.html">Records ↗</a>
    <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord ↗</a>
    </>}
  </nav>;
}

export const NewsBrandContext = createContext(NEWS_BRAND);
/** `date` is the dateline (a date or an instant); `editionTitle` is the leading story's edition label, when it is an edition. */
export function NewsPaper({ children, frontPage = false, date, editionTitle, issue, brand: explicitBrand }: { children: ReactNode; frontPage?: boolean; date?: string; editionTitle?: string; issue?: number; brand?: typeof NEWS_BRAND }) {
  const inheritedBrand = useContext(NewsBrandContext);
  const brand = explicitBrand ?? inheritedBrand;
  const close = theClose();
  const name = brand.name;
  return <NewsBrandContext.Provider value={brand}><div className={`arc-daily${brand.goose ? ' is-goose' : ''}`}>
    <div className="news-paper">
      <header className={`news-masthead${frontPage ? ' is-front' : ''}`}>
        <div className="news-topline"><span>{brand.goose ? <a href="https://github.com/Autoresearch-Arena">Autoresearch Arena</a> : <Link href="/home">ARC Explainer</Link>} · The competition desk</span><span>{issue ? `Vol. I · No. ${issue} · ` : ''}Free</span></div>
        {brand.goose ? <div className={`news-goose-banner${brand.banner ? " has-world" : ""}`}>
          {brand.banner && <img className="news-banner-world" src={brand.banner} alt="" width={2172} height={724} />}
          <div className="news-brand-lockup">
          
          <div className="news-brand-type"><p className="news-brand-overline">The sports tabloid of the Kaggleverse</p>
            {frontPage ? <h1 className="news-name">{name}</h1> : <Link href="/news" className="news-name">{name}</Link>}
            <div className="news-brand-dateline">{editionTitle && <strong>{editionTitle} · </strong>}{date && datelineDate(date)}</div>
          </div></div>
        </div> : <div className="news-brand-row"><div className="news-ear"><strong>{editionTitle ?? 'Competition desk'}</strong>{date && <span>{datelineDate(date)}</span>}{close && <span>{close.days} {close.days === 1 ? 'day' : 'days'} to the {close.date} close</span>}</div>
          {frontPage ? <h1 className="news-name">{name}</h1> : <Link href="/news" className="news-name">{name}</Link>}<MastheadAd /></div>}
        <div className="news-edition-line"><span>{brand.goose ? 'Competition reporting · Contenders, methods & movement' : 'ARC Prize 2026 · ARC-AGI-3 & ARC-AGI-2 on Kaggle'}</span>{brand.goose ? <Link className="news-tip-link" href="/news/tips">Talk to me, Goose. ↗</Link> : <span>Competition news · All times UTC</span>}</div>
        <NewsNav brand={brand} />
        {brand.goose && <div className="news-sponsor-rail"><MastheadAd /></div>}
      </header>
      {children}<NewsWelcome />
      <footer className="news-footer"><strong>{brand.name}</strong><span>Competition reporting · writer credited on each story</span><p>AI-written competition reporting from dated leaderboard observations and linked sources. Public standings are provisional; final results use the private leaderboard. Sponsored by VoynichLabs.</p>
        {brand.goose ? <Link className="news-tip-link" href="/news/tips">Talk to me, Goose. Send us a tip →</Link> : <p><a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">Can't get enough ARC gossip? Come join us in the ARC Discord.</a></p>}
        <Link href={NEWS_STAFF_PATH}>About the Paper →</Link> · {brand.goose ? <a href="https://github.com/Autoresearch-Arena/loose-goose">An Autoresearch Arena publication →</a> : <Link href="/home">An ARC Explainer publication →</Link>}
      </footer>
    </div>
  </div></NewsBrandContext.Provider>;
}

/** Front-page info box: what the paper is, where its data comes from, and who to tell when it is wrong. */
export function AboutThisPaper() {
  return (
    <aside className="news-about" aria-label="About this paper">
      <h2>About this paper</h2>
      <ul>
        {NEWS_BRAND.goose ? <>
          <li><strong>Written by AI.</strong> Competition reporting with linked public sources, reviewed identities and dated evidence.</li>
          <li><strong>The numbers.</strong> Kaggle links provide current standings. Cards show a dated reading only when a fresh source is available.</li>
          <li><strong>The beat.</strong> Substantial cash and medal competitions, with extra attention near their close and to published methods and results afterward.</li>
        </> : <>
        <li><strong>Written by AI.</strong> Reporting desks draft stories from saved standings and linked sources. Newsroom helpers check citations, format and box-score figures before publication.</li>
        <li><strong>The numbers.</strong> Standings come from the public Kaggle leaderboards, saved every half hour. Movers compare with the save about a day earlier, and anything the saved history cannot support is left blank.</li>
        <li><strong>The people.</strong> Stories also draw on public X posts, Kaggle discussions and profiles, and linked primary sources. A contestant's claim is kept apart from an established result.</li>
        <li><strong>The schedule.</strong> Reports carry their actual publication and observation dates in UTC. Follow the RSS feed for new stories; public standings remain provisional until official results.</li>
        </>}
        <li><strong>Provisional.</strong> Public standings are not final; the private leaderboard decides the results.</li>
      </ul>
      <p className="news-about-contact"><strong>Corrections, retractions or complaints?</strong> Contact Boss on <a href={ARC_DAILY_X_URL} target="_blank" rel="noopener noreferrer">X</a> or in the <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">ARC Discord</a>.</p>
      <p><Link href={NEWS_STAFF_PATH}>The masthead and how we work →</Link></p>
    </aside>
  );
}

export function NewsStatus({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="news-status" role="status">Opening the newspaper…</div>;
  if (error) return <div className="news-status" role="alert"><h2>The desk is temporarily unavailable</h2><p>We could not load the editions. Please try again.</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
  return null;
}

export function EditionLabel({ article }: { article: NewsArticle }) {
  return <div className="news-kicker"><span>{articleCompetitionLabel(article)}</span><span>{editionLabel(article)}</span></div>;
}

/** Use the edition's verified asset and caption on both its preview and permanent page. */
export function EditionArtwork({ article, lead = false }: { article: NewsArticle; lead?: boolean }) {
  return article.image ? <figure className="news-edition-art">
    <a href={article.image.src} aria-label="Open the full editorial illustration"><img src={article.image.src} alt={article.image.alt} loading={lead ? 'eager' : 'lazy'} /></a>
    <figcaption><SportsText text={article.image.caption} stats={article.stats} /></figcaption>
  </figure> : null;
}

/**
 * A newspaper preview prints opening sections; the article page keeps sources and box score.
 * An edition-bound illustration takes precedence over a same-day companion dispatch's art.
 */
export function StoryPreview({ article, feature, lead = false, people = [], sections = 0, art }: { article: NewsArticle; feature?: NewsDispatch; lead?: boolean; people?: NewsPerson[]; sections?: number; art?: ReactNode }) {
  const publication = useContext(NewsBrandContext);
  const shown = article.sections.slice(0, sections);
  const more = article.sections.length > shown.length;
  const figureStats = articleFigureStats(article);
  return <article className={lead ? 'news-story news-lead' : 'news-story'}>
    <EditionLabel article={article} />
    <h2><Link href={newsArticlePath(article.id)}><SportsText text={article.headline} stats={figureStats} teamNames={article.verifiedTeamNames} /></Link></h2>
    <p className="news-dek"><SportsText text={article.dek} stats={figureStats} teamNames={article.verifiedTeamNames} /></p>
    <div className="news-byline">By {publication.name} sports desk <span>· {writerCredit(article.generatedBy)} · {newsDate(article.date)}</span></div>
    {feature && <DispatchPreview dispatch={feature} stats={figureStats} lead={lead} people={people} subjects={reportedPeople([feature, article], people)} />}
    {/* The edition's own picture unless its feature already printed it; else the same-day companion art. */}
    {article.image ? article.image.src !== feature?.image?.src && <EditionArtwork article={article} lead={lead} /> : art}
    {!!shown.length && <div className="news-story-body"><StoryBodySection section={shown[0]} stats={figureStats} teamNames={article.verifiedTeamNames} /></div>}
    {!feature && <StoryPeopleCards people={reportedPeople([article], people)} competition={article.competition} />}
    {shown.length > 1 && <div className="news-story-body">{shown.slice(1).map((section, index) => <StoryBodySection key={index} section={section} stats={figureStats} teamNames={article.verifiedTeamNames} />)}</div>}
    <Link href={newsArticlePath(article.id)} className="news-read">{more ? 'Continue reading, with sources and the box score →' : 'Sources and the box score →'}</Link>
  </article>;
}

function StoryBodySection({ section, stats, teamNames }: { section: NewsArticle['sections'][number]; stats: NewsArticle['stats']; teamNames?: string[] }) {
  return <section>
    {section.heading && <h3>{section.heading}</h3>}
    <p><SportsText text={section.text} stats={stats} teamNames={teamNames} /></p>
    <NewsArticleSectionExtras section={section} />
  </section>;
}

export function NotebookEntry({ competitor, people = [] }: { competitor: CompetitorRecord; people?: NewsPerson[] }) {
  return <article className="news-notebook-entry">
    <div className="news-kicker">{competitionName(competitor.competition)} <span>Team {competitor.teamId}</span></div>
    <h3><Link href={competitorPath(competitor.id)}>{competitor.name}</Link></h3>
    {!!competitor.members.length && <p className="news-card-members">Observed members: {competitor.members.slice(0, 3).join(', ')}{competitor.members.length > 3 ? ` +${competitor.members.length - 3} more` : ''}</p>}
    <TeamFaces team={competitor} people={people} />
    {competitor.facts.length ? <ul className="news-card-facts">{competitor.facts.slice(0, 2).map((fact, index) => <li key={`${fact.sourceUrl}-${index}`}><p>{fact.text}</p><a className="news-card-source" href={fact.sourceUrl}>Source: {fact.sourceTitle} ↗</a></li>)}</ul> : <p>Observed team identity and competition coverage.</p>}
    <Link href={competitorPath(competitor.id)} className="news-read">Read the profile →</Link>
  </article>;
}

export function ArticleArchive({ articles, heading = 'From the archive' }: { articles: NewsArticle[]; heading?: string }) {
  return <section className="news-archive" aria-label={heading}>
    <h2 className="news-section-title">{heading}</h2>
    {articles.length ? <ol>{articles.map(article => <li key={article.id}>
      <div className="news-archive-date"><time dateTime={article.publishedAt}>{newsDate(article.date)}</time><span>{editionLabel(article)} · {articleCompetitionLabel(article)}</span></div>
      <Link href={newsArticlePath(article.id)}><SportsText text={article.headline} stats={article.stats} /></Link>
    </li>)}</ol> : <p className="news-muted">No earlier editions have been published.</p>}
  </section>;
}
