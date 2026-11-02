/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Classify sporting figures for the shared story renderers. Explicit
 * spans, labelled places/score units and source-bound score values get semantic
 * type; dates, money, counts, model versions and quoted wording stay untouched.
 * SRP/DRY check: Pass — browser and initial HTML consume the same runs.
 */
export type FigureKind = 'place' | 'score' | 'difference';
export const figureClass = (kind: FigureKind) => ({ place: 'pl', score: 'sc', difference: 'sd' })[kind];
export interface FigureSpan { start: number; end: number; kind: FigureKind }
export interface FigureRun { text: string; kind?: FigureKind; value?: string }
const numeric = /#?\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th)?/g;
const month = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*$/i;

export const statScores = (stats: { score: number; scoreChange: number | null }[]) => stats.flatMap(stat => [stat.score, ...(stat.scoreChange == null ? [] : [Number((stat.score - stat.scoreChange).toPrecision(14))])]);

export function figureRuns(text: string, scores: number[] = [], explicit: FigureSpan[] = []): FigureRun[] {
  const sourceScores = new Set(scores.map(value => String(value)));
  const quotes: [number, number][] = [];
  let quote: { start: number; close: string } | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const apostrophe = /['’]/.test(ch) && /\p{L}/u.test(text[i - 1] ?? '') && /\p{L}/u.test(text[i + 1] ?? '');
    if (apostrophe) continue;
    if (quote && ch === quote.close) { quotes.push([quote.start, i + 1]); quote = undefined; }
    else if (!quote && ['“', '‘', '"', "'"].includes(ch)) quote = { start: i, close: ch === '“' ? '”' : ch === '‘' ? '’' : ch };
  }
  if (quote) quotes.push([quote.start, text.length]);
  const spans = new Map(explicit.map(span => [span.start, span]));
  const result: FigureRun[] = [];
  let through = 0;
  for (const match of text.matchAll(numeric)) {
    const start = match.index!, raw = match[0], end = start + raw.length;
    const before = text.slice(Math.max(0, start - 75), start), after = text.slice(end, end + 35);
    // Model IDs, versions, dates, amounts and measured quantities must not
    // accidentally inherit the colour of an equal-valued competition score.
    const wordEdge = /[\p{L}\d_.@]/u.test(text[start - 1] ?? '') || /[\p{L}\d_]/u.test(text[end] ?? '') || /^\.\d/.test(after);
    const rangeQuantity = /^\s+(?:to|[–-])\s*\d[\d,]*(?:\.\d+)?\s*(?:%|percent|hours?\b|days?\b|seconds?\b|GB\b|tokens?\b)/i.test(after);
    const quantity = rangeQuantity || /[$€£¥]/.test(text[start - 1] ?? '') || /^\s*(?:%|percent|teams?\b|accounts?\b|submissions?\b|days?\b|hours?\b|minutes?\b|seconds?\b|years?\b|GB\b|tokens?\b|parameters?\b|century\b)/i.test(after);
    const date = month.test(before) || /^\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(after) || /\d[-/:]$/.test(before) || /^[-/:]\d/.test(after);
    const technical = /\b(?:version|model|release)\b[^.;]*$/i.test(before.replace(/\d\.(?=\d)/g, '0'));
    const quoted = quotes.some(([from, to]) => start >= from && end <= to);
    let kind = spans.get(start)?.end === end ? spans.get(start)!.kind : undefined;
    if (!kind && !wordEdge && !quantity && !date && !quoted) {
      if (/^#\d/.test(raw) || /(?:st|nd|rd|th)$/.test(raw) || /\b(?:rank(?:ed)?|place|position)\s*#?\s*$/i.test(before)) kind = 'place';
      else if (/\b(?:score(?:s)?(?: of| is| was)?|scored|scoring)\s*[:=]?\s*$/i.test(before)) kind = 'score';
      else if (/^[- ](?:score[- ]?)?points?\b|^\s+(?:ahead|behind)\b/i.test(after)
        || /\b(?:gain(?:ed|s)?|lead|margin|gap|difference|improv(?:ed|ement)|add(?:ed|s|ing)?|up|down)(?: of| by)?\s*[:+−-]?\s*$/i.test(before)) kind = 'difference';
      else if (scores.length && raw.includes('.') && /\b(?:on|at|from|to)\s*$/i.test(before) && !technical) kind = 'score';
      else if (!technical && sourceScores.has(String(Number(raw.replaceAll(',', '')))) && /\b(?:on|at|from|to|reach(?:es|ed)?|with|adds?|adding|share(?:s|d)?)\s*$/i.test(before)) kind = 'score';
    }
    if (!kind) continue;
    if (start > through) result.push({ text: text.slice(through, start) });
    result.push({ text: kind === 'place' ? '#' + raw.replace(/^#/, '').replace(/(?:st|nd|rd|th)$/, '') : raw, kind, value: raw });
    through = end;
  }
  if (through < text.length) result.push({ text: text.slice(through) });
  return result.length ? result : [{ text }];
}

export function figuresHtml(text: string, escape: (text: string) => string, scores: number[] = [], explicit: FigureSpan[] = []): string {
  return figureRuns(text, scores, explicit).map(run => run.kind ? `<span class="${figureClass(run.kind)}">${escape(run.text)}</span>` : escape(run.text)).join('');
}
