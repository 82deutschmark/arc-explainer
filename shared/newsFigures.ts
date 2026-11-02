/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Classify verified team names and sporting figures for the shared story renderers. Explicit
 * spans, labelled places/score units and source-bound score values get semantic
 * type; dates, money, counts, model versions and quoted wording stay untouched.
 * SRP/DRY check: Pass — browser and initial HTML consume the same runs.
 */
export type FigureKind = 'place' | 'score' | 'difference' | 'team';
export const figureClass = (kind: FigureKind) => ({ place: 'pl', score: 'sc', difference: 'sd', team: 'news-team-name' })[kind];
export interface FigureSpan { start: number; end: number; kind: FigureKind }
export interface FigureRun { text: string; kind?: FigureKind; value?: string }
const numeric = /#?\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th)?/g;
const month = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*$/i;

export const statScores = (stats: { score: number; scoreChange: number | null }[]) => stats.flatMap(stat => [stat.score, ...(stat.scoreChange == null ? [] : [Number((stat.score - stat.scoreChange).toPrecision(14))])]);
/** Match only names verified in this story's dated box score, never a global cast list. */
export const statTeamNames = (stats: { name: string }[]) => [...new Set(stats.map(stat => stat.name))];

const grammarWords = new Set('a an and are as at be been being but by for from had has have he her here him his i in is it its me my no not of on or our she so than that the their them then there these they this those to us was we were what when where which who why will with you your team teams'.split(' '));
const wordCharacter = /[\p{L}\p{N}\p{M}_]/u;
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function teamSpans(text: string, names: string[]): FigureSpan[] {
  const candidates = [...new Set(names.map(name => name.normalize('NFC').trim()).filter(name =>
    (name.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2 && /\p{L}/u.test(name) && !grammarWords.has(name.toLowerCase())))];
  // Longest names win when one verified team name contains another. Escaping keeps
  // punctuation in actual handles literal, and Unicode edges support Japanese names.
  candidates.sort((a, b) => b.length - a.length);
  if (!candidates.length) return [];
  const pattern = new RegExp(candidates.map(name => name.split(/\s+/).map(escapePattern).join('\\s+')).join('|'), 'giu');
  return [...text.matchAll(pattern)].flatMap(match => {
    const start = match.index!, end = start + match[0].length;
    if (wordCharacter.test(text[start - 1] ?? '') || wordCharacter.test(text[end] ?? '')
      || /[@/]/.test(text[start - 1] ?? '') || /^\.[\p{L}\p{N}]/u.test(text.slice(end))) return [];
    const original = candidates.find(name => name.toLowerCase().replace(/\s+/g, ' ') === match[0].toLowerCase().replace(/\s+/g, ' '))!;
    // A capitalized one-word team such as Progress must not mark an ordinary
    // lowercase use of that word. Lowercase handles still accept sentence capitals.
    if (!/\s/.test(original) && original !== original.toLowerCase() && match[0] === match[0].toLowerCase()) return [];
    return [{ start, end, kind: 'team' as const }];
  });
}

export function figureRuns(text: string, scores: number[] = [], explicit: FigureSpan[] = [], teamNames: string[] = []): FigureRun[] {
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
  const teams = teamSpans(text, teamNames);
  const selected: (FigureSpan & { value?: string })[] = [...teams];
  for (const match of text.matchAll(numeric)) {
    const start = match.index!, raw = match[0], end = start + raw.length;
    // Digits that belong to a team handle remain part of its identity, not a score.
    if (teams.some(team => start < team.end && end > team.start)) continue;
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
    selected.push({ start, end, kind, value: raw });
  }
  const result: FigureRun[] = [];
  let through = 0;
  for (const span of selected.sort((a, b) => a.start - b.start)) {
    if (span.start > through) result.push({ text: text.slice(through, span.start) });
    const raw = text.slice(span.start, span.end);
    result.push({ text: span.kind === 'place' ? '#' + raw.replace(/^#/, '').replace(/(?:st|nd|rd|th)$/, '') : raw, kind: span.kind, ...(span.value ? { value: span.value } : {}) });
    through = span.end;
  }
  if (through < text.length) result.push({ text: text.slice(through) });
  return result.length ? result : [{ text }];
}

export function figuresHtml(text: string, escape: (text: string) => string, scores: number[] = [], explicit: FigureSpan[] = [], teamNames: string[] = []): string {
  return figureRuns(text, scores, explicit, teamNames).map(run => run.kind === 'team'
    ? `<strong class="news-team-name">${escape(run.text)}</strong>`
    : run.kind ? `<span class="${figureClass(run.kind)}">${escape(run.text)}</span>` : escape(run.text)).join('');
}
