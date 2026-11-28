/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. ARC Prize 2026 goes into storage until next year.
 * PURPOSE: The ARC Prize 2026 archive page (/news/archive/arc-prize-2026). The season closed on 2 November 2026; this
 *          page keeps it in one place, out of the front page's way: a header with both contests' close, an index of
 *          the final boards, the medal race, the game guides and the season's other resources (the links that used to
 *          sit in the front page's Inside box), then every ARC story, newest first, by month. Every old address still
 *          works; this page only gathers them. The server renders the same page for crawlers
 *          (server/services/news/newsPresentation.ts arcArchiveMeta) from the same lists in shared/newsSeasons.ts.
 * SRP/DRY check: Pass — links and story selection come from shared/newsSeasons.ts, month groups from shared/news.ts,
 *          the shell and query from NewsDesk; this page only lays them out.
 */
import { useMemo } from 'react';
import { Link } from 'wouter';
import { NEWS_ARCHIVE, NEWS_NAME, archiveMonths, articleCompetitionLabel, competitionName, newsArticlePath, newsDate } from '@shared/news';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { ARC_2026_ARCHIVE, ARC_2026_LINKS, arc2026Stories, type NewsShelfLink } from '@shared/newsSeasons';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, NewsStatus, useNews, useNewsCardImage } from '@/components/news/NewsDesk';

/** Internal app pages use the router; board pages, static pages and other sites load normally. */
function ShelfLink({ link }: { link: NewsShelfLink }) {
  const body = <><strong>{link.title}</strong> <span>{link.text}</span></>;
  if (!link.external) return <Link href={link.href}>{body}</Link>;
  return <a href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}{link.href.startsWith('http') ? ' ↗' : ''}</a>;
}

/** "2 November 2026, 23:59 UTC", the close as the dateline prints it. */
const closeText = (iso: string | null) => iso
  ? `${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))}, ${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))} UTC`
  : 'not published';

export default function NewsSeasonArchive() {
  const query = useNews();
  const stories = useMemo(() => arc2026Stories(query.data?.articles ?? [], query.data?.dispatches), [query.data]);
  usePageMeta({ title: `${ARC_2026_ARCHIVE.heading} | ${NEWS_NAME}`, description: ARC_2026_ARCHIVE.description, canonicalPath: ARC_2026_ARCHIVE.path, image: useNewsCardImage() });
  return <NewsPaper>
    <main className="news-season-archive">
      <Link href="/news" className="news-back">← Front page</Link>
      <header className="news-season-head">
        <p className="news-season-kicker">In storage until next year</p>
        <h1>{ARC_2026_ARCHIVE.heading}</h1>
        <p className="news-dek">{ARC_2026_ARCHIVE.description}</p>
        <dl className="news-season-facts">
          {ARC_2026_ARCHIVE.competitions.map(key => <div key={key}><dt>{competitionName(key)}</dt><dd>Closed {closeText(KAGGLE_COMPETITIONS[key]?.closeAt ?? null)}</dd></div>)}
          {query.data && <div><dt>In the paper</dt><dd>{stories.length} stories</dd></div>}
        </dl>
      </header>
      <nav className="news-season-index" aria-label="ARC Prize 2026 boards and resources">
        {ARC_2026_LINKS.map(group => <section key={group.heading}>
          <h2 className="news-flag"><span>{group.heading}</span></h2>
          <ul>{group.links.map(link => <li key={link.href}><ShelfLink link={link} /></li>)}</ul>
        </section>)}
      </nav>
      <NewsStatus loading={query.isLoading} error={query.isError && !query.data} retry={() => void query.refetch()} />
      {query.data && <section className="news-season-stories" aria-label="Every ARC Prize 2026 story">
        <h2 className="news-section-title">Every ARC Prize 2026 story <span>{stories.length} stories · newest first</span></h2>
        {stories.length ? archiveMonths(stories).map(([month, entries]) => <section key={month} className="news-season-month">
          <h3>{month}</h3>
          <ol>{entries.map(story => <li key={story.id}>
            <div className="news-season-meta"><time dateTime={story.publishedAt}>{newsDate(story.publishedAt)}</time> · {'edition' in story ? articleCompetitionLabel(story) : competitionName(story.competition)}</div>
            <Link href={newsArticlePath(story.id)}>{story.headline}</Link>
            {story.dek && <p>{story.dek}</p>}
          </li>)}</ol>
        </section>) : <p className="news-muted">No ARC Prize 2026 stories were published.</p>}
      </section>}
      <p className="news-season-foot"><Link href={NEWS_ARCHIVE.path}>{NEWS_ARCHIVE.heading}: every story the paper has run →</Link></p>
    </main>
  </NewsPaper>;
}
