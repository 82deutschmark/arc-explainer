/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-09
 * PURPOSE: Dedicated public explanation of ARC Daily Digest generation, provenance and sponsorship.
 * SRP/DRY check: Pass — copy comes from shared/newsMethod.ts and layout from NewsPaper.
 */
import { Link } from 'wouter';
import { NEWS_METHOD } from '@shared/newsMethod';
import { NEWS_NAME } from '@shared/news';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper, useNewsCardImage } from '@/components/news/NewsDesk';

export default function NewsMethod() {
  usePageMeta({ title: `How this is made | ${NEWS_NAME}`, description: 'How the ARC Daily Digest gathers sources, follows people and teams, and publishes its AI-written competition coverage.', canonicalPath: '/news/how-this-is-made', image: useNewsCardImage() });
  return <NewsPaper><Link href="/news" className="news-back">← Front page</Link><header className="news-directory-header"><div className="news-kicker">Behind the sports desk</div><h1>How this is made</h1></header><div className="news-prose news-method">{NEWS_METHOD.map(section => <section key={section.heading}><h2>{section.heading}</h2><p>{section.text}</p></section>)}<p><Link href="/feedback">Send feedback or a correction →</Link></p><p><a href="https://github.com/82deutschmark/arc-explainer/blob/main/docs/newsroom/REPORTER.md">Read the reporter workflow ↗</a></p></div></NewsPaper>;
}
