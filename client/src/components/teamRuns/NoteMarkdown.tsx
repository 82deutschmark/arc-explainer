/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Renders Claude's note on a run. The note always has the same small shape (the
 *          watcher's fixed prompt asks for four "## " headings, "- " bullets, plain
 *          paragraphs and occasional **bold**), so this handles exactly that and shows any
 *          other line as plain text. Everything is rendered as React text, never as HTML,
 *          because the note's wording comes from a model reading run logs.
 * SRP/DRY check: Pass - the site has no markdown library and this is its only markdown;
 *          a dependency for four headings and bullets would be more than the job needs.
 */

import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export function NoteMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length} className="mb-3 leading-relaxed">{inline(para.join(' '))}</p>);
      para = [];
    }
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="mb-3 list-disc pl-5 space-y-1.5 leading-relaxed">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      blocks.push(<h3 key={blocks.length} className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide">{line.slice(3)}</h3>);
    } else if (/^\s*[-*] /.test(line)) {
      if (para.length) flush();
      bullets.push(line.replace(/^\s*[-*] /, ''));
    } else if (!line.trim()) {
      flush();
    } else if (bullets.length && /^\s+/.test(raw)) {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    } else {
      if (bullets.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return <div className="text-[14px]">{blocks}</div>;
}
