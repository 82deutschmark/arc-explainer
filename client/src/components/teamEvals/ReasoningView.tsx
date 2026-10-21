/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: One output's full reasoning on the eval trace screen: a scrollable monospace panel
 *          with a find box (case-insensitive; Enter / Shift+Enter or the arrows step through
 *          matches, the current one scrolled into view), the character count with a rough token
 *          estimate beside the real completion-token count, and a wrap toggle.
 *          Reasoning runs to a few hundred thousand characters, so it is ONE plain text node
 *          until something is searched; then only the matches become elements (the text is
 *          split on them, at most MAX_MATCHES), never a span per token or line. The query is
 *          deferred so typing stays responsive on a long trace.
 * SRP/DRY check: Pass - reasoning display only; match finding in evalStats.ts, palette and the
 *          bracket toggle from teamRuns/terminal.tsx.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Bracket, T } from '@/components/teamRuns/terminal';
import { MAX_MATCHES, approxTokens, count, findMatches } from './evalStats';

const MARK = { background: '#e3b34140', color: 'inherit', borderRadius: 0 } as const;
const CURRENT = { background: T.amber, color: T.bg, borderRadius: 0 } as const;

export function ReasoningView({ text, completionTokens }: { text: string; completionTokens?: number | null }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [current, setCurrent] = useState(0);
  const [wrap, setWrap] = useState(true);
  const box = useRef<HTMLPreElement>(null);

  const matches = useMemo(() => findMatches(text, deferred), [text, deferred]);
  useEffect(() => setCurrent(0), [matches]);
  // A different output starts at the top (the search, if any, then moves to its first match).
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [text]);

  // Keep the current match a third of the way down the panel (the page itself doesn't move).
  useEffect(() => {
    const panel = box.current;
    const mark = panel?.querySelector<HTMLElement>(`mark[data-i="${current}"]`);
    if (panel && mark) panel.scrollTop = Math.max(0, mark.offsetTop - panel.clientHeight / 3);
  }, [current, matches]);

  const body = useMemo<ReactNode>(() => {
    if (!matches.length) return text;
    const length = deferred.length;
    const parts: ReactNode[] = [];
    let at = 0;
    matches.forEach((start, i) => {
      if (start > at) parts.push(text.slice(at, start));
      parts.push(<mark key={i} data-i={i} style={i === current ? CURRENT : MARK}>{text.slice(start, start + length)}</mark>);
      at = start + length;
    });
    parts.push(text.slice(at));
    return parts;
  }, [text, matches, deferred, current]);

  const step = (by: number) => {
    if (matches.length) setCurrent((c) => (c + by + matches.length) % matches.length);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') setQuery('');
  };
  const capped = matches.length >= MAX_MATCHES;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1" style={{ borderBottom: `1px solid ${T.rule}` }}>
        <span style={{ color: T.amber }}>FIND</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} aria-label="Find in reasoning"
               placeholder="text  (Enter next, Shift+Enter previous)" spellCheck={false}
               className="w-[260px] bg-transparent outline-none placeholder:opacity-60"
               style={{ color: T.text, borderBottom: `1px solid ${T.rule}` }} />
        <button type="button" onClick={() => step(-1)} disabled={!matches.length} className="hover:underline disabled:opacity-40" style={{ color: T.link }}>[◂]</button>
        <button type="button" onClick={() => step(1)} disabled={!matches.length} className="hover:underline disabled:opacity-40" style={{ color: T.link }}>[▸]</button>
        <span className="tabular-nums" style={{ color: deferred && !matches.length ? T.down : T.dim }}>
          {deferred ? (matches.length ? `${current + 1}/${matches.length}${capped ? '+' : ''}` : 'NO MATCH') : ''}
        </span>
        <Bracket on={wrap} onClick={() => setWrap((w) => !w)} title="Wrap long lines">WRAP</Bracket>
        <span className="ml-auto tabular-nums" style={{ color: T.dim }}>
          {count(text.length)} chars · ~{count(approxTokens(text.length))} tok est.
          {completionTokens != null && <> · {count(completionTokens)} completion tok</>}
        </span>
      </div>
      {capped && <div className="px-2 py-[2px]" style={{ color: T.dim }}>Highlighting the first {count(MAX_MATCHES)} matches; type more to narrow it.</div>}
      <pre ref={box} className={`relative max-h-[70vh] overflow-auto px-2 py-1 text-[11.5px] leading-[1.45] ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}
           style={{ color: T.text }}>
        {text ? body : <span style={{ color: T.dim }}>(no reasoning in this trace)</span>}
      </pre>
    </div>
  );
}
