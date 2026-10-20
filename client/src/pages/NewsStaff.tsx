/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 / Codex
 * Date: 2026-10-20 (complete seven-character Team Turducken picture)
 * PURPOSE: Unified ARC Daily Digest masthead, production cycle and editorial standards.
 *          Uses institutional copy shared with crawler HTML and the existing newspaper shell,
 *          and the approved complete ARC3 team picture shared with the About page.
 * SRP/DRY check: Pass — copy and artwork reuse shared/newsStaff.ts, newsMethod.ts and arc3TeamArtwork.ts.
 */
import { Link } from 'wouter';
import { SITE_ORIGIN } from '@shared/seo';
import { ARC3_TEAM_ARTWORK } from '@shared/arc3TeamArtwork';
import { NEWS_HUMAN_EDITOR, NEWS_STAFF_PATH, NEWS_STAFF_HEADING, NEWS_STAFF_TITLE, NEWS_STAFF_DESCRIPTION, NEWS_STAFF_INTRO, NEWS_STAFF_WRITERS, NEWS_STAFF_ARCHIVE_WRITERS, NEWS_STAFF_TOOL_CREDIT } from '@shared/newsStaff';
import { NEWS_PRODUCTION, NEWS_METHOD } from '@shared/newsMethod';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, ARC_DAILY_X_URL, ARC_DISCORD_URL } from '@/components/news/NewsDesk';

export default function NewsStaff() {
  const editor = NEWS_HUMAN_EDITOR;
  usePageMeta({ title: NEWS_STAFF_TITLE, description: NEWS_STAFF_DESCRIPTION, canonicalPath: NEWS_STAFF_PATH,
    image: { image: `${SITE_ORIGIN}${editor.portrait.src}`, imageAlt: editor.portrait.alt, imageWidth: 1024, imageHeight: 1024 } });
  return <NewsPaper>
    <Link href="/news" className="news-back">← Front page</Link>
    <header className="news-directory-header"><div className="news-kicker">Masthead &amp; editorial standards</div><h1>{NEWS_STAFF_HEADING}</h1><p>{NEWS_STAFF_INTRO}</p></header>
    <div className="news-prose news-staff news-method">
      <section id="staff"><h2>The masthead</h2>
        <div className="news-staff-human">
          <figure><a href={editor.portrait.src}><img src={editor.portrait.src} alt={editor.portrait.alt} width={1024} height={1024} /></a><figcaption>{editor.portrait.caption}</figcaption></figure>
          <div><h3>{editor.name}</h3><p className="news-staff-role">{editor.role}</p><p>{editor.description}</p><p><Link href="/news/people/mark-barney">Kaggle competitor profile →</Link></p></div>
        </div>
        <figure className="news-staff-team"><a href={ARC3_TEAM_ARTWORK.src}><img src={ARC3_TEAM_ARTWORK.src} alt={ARC3_TEAM_ARTWORK.alt} width={ARC3_TEAM_ARTWORK.width} height={ARC3_TEAM_ARTWORK.height} loading="lazy" /></a><figcaption>{ARC3_TEAM_ARTWORK.caption}</figcaption></figure>
        <h3>The reporting desks</h3><dl>{NEWS_STAFF_WRITERS.map(writer => <div className="news-staff-writer" key={writer.id}><dt>{writer.name}<span>{writer.role}</span></dt><dd>{writer.description}</dd></div>)}</dl>
        <h3>Earlier bylines &amp; contributors</h3>{NEWS_STAFF_ARCHIVE_WRITERS.map(writer => <p key={writer.id}><strong>{writer.name}.</strong> {writer.description}</p>)}<p>{NEWS_STAFF_TOOL_CREDIT}</p>
      </section>
      <section id="news-cycle"><h2>From the boards to the edition</h2><ol className="news-production">{NEWS_PRODUCTION.map(step => <li key={step.heading}><h3>{step.heading}</h3><p>{step.text}</p></li>)}</ol></section>
      <section id="standards"><h2>Our reporting standards</h2>{NEWS_METHOD.map(section => <div key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p></div>)}</section>
      <section id="contact"><h2>Reach the editor</h2><p>Send a story tip, correction, retraction request or complaint to Mark on <a href={ARC_DAILY_X_URL} target="_blank" rel="noopener noreferrer">X</a> or in the <a href={ARC_DISCORD_URL} target="_blank" rel="noopener noreferrer">ARC Discord</a>. Please include the story link and any supporting source.</p><p><Link href="/feedback">ARC Explainer feedback →</Link></p></section>
    </div>
  </NewsPaper>;
}
