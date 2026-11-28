/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 Medium
 * Date: 27-Nov-2026 (Claude Opus 5.5 Medium); 2026-10-11
 * 27-Nov-2026 (Claude Opus 5.5 Medium): a proper editor's box for the story page's right column and the front-page
 *          feature: portrait, name, the two titles (Editor-in-Chief · Head Meat Proxy), one line on what he does, the
 *          story's editor note when it has one, and a link to About the Paper. "Commissioned by" only on a story he
 *          commissioned. The server HTML (editorCreditHtml) prints the same box.
 * PURPOSE: The human editor's box, using the shared staff record (shared/newsStaff.ts) so the box and About the Paper
 *          always agree. The editorial portrait is separate from his Kaggle competitor picture.
 * SRP/DRY check: Pass — reuses the shared staff record and newspaper styles.
 */
import { Link } from 'wouter';
import { NEWS_HUMAN_EDITOR, NEWS_STAFF_PATH } from '@shared/newsStaff';

export function NewsEditorCredit({ note, commissioned = true }: { note?: string; commissioned?: boolean }) {
  const editor = NEWS_HUMAN_EDITOR;
  return <aside className="news-editor-credit" aria-label="The editor">
    <h2 className="news-editor-label">{commissioned ? 'Commissioned by the editor' : 'The editor'}</h2>
    <div className="news-editor-body">
      <a href={editor.portrait.src} aria-label={`Open ${editor.name}’s editorial portrait`}><img src={editor.portrait.src} alt={editor.portrait.alt} width={96} height={96} loading="lazy" /></a>
      <div><strong><Link href={NEWS_STAFF_PATH}>{editor.name}</Link></strong><span className="news-editor-titles">{editor.role}</span>
        <p className="news-editor-line">{editor.line}</p></div>
    </div>
    {note && <p className="news-editor-note">{note}</p>}
    <Link className="news-read" href={NEWS_STAFF_PATH}>About the Paper →</Link>
  </aside>;
}
