/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Give “Talk to me, Goose” a working tip-line page with the existing
 * public editor contact. Community and newsroom publication routes stay distinct.
 * SRP/DRY check: Pass — reuse the newspaper shell and wiki contact projection.
 */
import { Link } from 'wouter';
import { NEWS_NAME } from '@shared/news';
import { NEWS_CONTACT, NEWS_TIPS_PATH } from '@shared/newsContact';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NewsPaper } from '@/components/news/NewsDesk';
export default function NewsTips() {
  usePageMeta({ title: `Talk to me, Goose | ${NEWS_NAME}`, description: 'A hot tip, a surprise alliance or a move we should see? Send the newsroom the original source and tell us what changed.', canonicalPath: NEWS_TIPS_PATH });
  return <NewsPaper><main className="news-tips"><div className="news-kicker">The tip line</div><h1 className="news-article-title">Talk to me, Goose.</h1>
    <p className="news-dek">An upset brewing? A surprise alliance? A bit of public code that changes the race?</p>
    <p>Send us the original link, tell us what changed and when, and point us toward the people who know the story.</p>
    <p><a className="news-tip-action" href={NEWS_CONTACT.tipUrl} target="_blank" rel="noopener noreferrer">{NEWS_CONTACT.tipLabel} ↗</a></p>
    <p>Corrections are welcome too. Include the story address and the detail we should check.</p>
    <p className="news-muted">Around the contests: <a href={NEWS_CONTACT.communityUrl} target="_blank" rel="noopener noreferrer">{NEWS_CONTACT.communityLabel} ↗</a></p>
    <Link href="/news" className="news-read">Back to the paper →</Link>
  </main></NewsPaper>;
}
