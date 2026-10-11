/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: The ARC Daily Digest staff page, identifying the human editor, commissioned
 *          editorial portrait, and every supported writer's newsroom role.
 * SRP/DRY check: Pass — copy comes from shared/newsStaff.ts and layout from NewsPaper.
 */
import { Link } from 'wouter';
import { SITE_ORIGIN } from '@shared/seo';
import { NEWS_HUMAN_EDITOR, NEWS_STAFF_PATH, NEWS_STAFF_TITLE, NEWS_STAFF_DESCRIPTION, NEWS_STAFF_WRITERS, NEWS_STAFF_TOOL_CREDIT } from '@shared/newsStaff';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper } from '@/components/news/NewsDesk';

export default function NewsStaff() {
  const editor = NEWS_HUMAN_EDITOR;
  usePageMeta({ title: NEWS_STAFF_TITLE, description: NEWS_STAFF_DESCRIPTION, canonicalPath: NEWS_STAFF_PATH,
    image: { image: `${SITE_ORIGIN}${editor.portrait.src}`, imageAlt: editor.portrait.alt, imageWidth: 1024, imageHeight: 1024 } });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link>
    <header className="news-directory-header"><div className="news-kicker">Behind the paper</div><h1>About the Staff</h1><p>A human editor sets the direction. AI writers report, draft and compile the coverage.</p></header>
    <div className="news-prose news-staff">
      <section className="news-staff-human"><figure><a href={editor.portrait.src}><img src={editor.portrait.src} alt={editor.portrait.alt} /></a><figcaption>{editor.portrait.caption}</figcaption></figure>
        <div><h2>{editor.name}</h2><p className="news-staff-role">{editor.role}</p><p>{editor.description}</p><p><Link href="/news/people/mark-barney">Kaggle competitor profile →</Link></p></div>
      </section>
      <section><h2>The writing desks</h2><dl>{NEWS_STAFF_WRITERS.map(writer => <div className="news-staff-writer" key={writer.id}><dt>{writer.name}<span>{writer.role}</span></dt><dd>{writer.description}</dd></div>)}</dl></section>
      <section><h2>The newsroom tools</h2><p>{NEWS_STAFF_TOOL_CREDIT}</p><p>Stories draw on saved standings and primary sources. Automated checks support the reporting, and each new story records its writer.</p><Link href="/news/how-this-is-made">How this is made →</Link></section>
    </div>
  </NewsPaper>;
}
