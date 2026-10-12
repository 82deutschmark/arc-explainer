/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: Commissioning credit for the human editor, using the staff portrait and role
 *          with a link to the unified masthead and separate Kaggle competitor pictures.
 * SRP/DRY check: Pass — reuses the shared staff record and newspaper styles.
 */
import { Link } from 'wouter';
import { NEWS_HUMAN_EDITOR, NEWS_STAFF_PATH } from '@shared/newsStaff';

export function NewsEditorCredit({ note }: { note?: string }) {
  const editor = NEWS_HUMAN_EDITOR;
  return <aside className="news-editor-credit" aria-label="Commissioning editor">
    <a href={editor.portrait.src} aria-label="Open Mark Barney’s editorial portrait"><img src={editor.portrait.src} alt={editor.portrait.alt} loading="lazy" /></a>
    <div><strong>Commissioned by <Link href={NEWS_STAFF_PATH}>{editor.name}</Link></strong><span>{editor.role}</span>
      {note && <p>{note}</p>}<small>Editorial portrait · <Link href={NEWS_STAFF_PATH}>About the Paper →</Link></small>
    </div>
  </aside>;
}
