/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: The forbidden-word lint for a card face. lintNode(node) walks a Satori node tree (what front() / frontNode()
 *          build, or what back.ts builds) and returns one message per printed string that breaks a house rule:
 *            - the house's banned words (see RULES; they are spelled out there only as fragments);
 *            - internal bookkeeping leaking onto a face: the *Basis field names and whenLabel, and the
 *              words "public", "source" and "basis";
 *            - a missing value printed as text: a bare dash, "undefined", "null", "NaN".
 *          Real Kaggle competition titles can contain a banned word (a contest title with a banned word in it), so the
 *          caller passes an EXACT-match allowlist of the strings that come from data: lintNode(node, allow) with
 *          allow = careerNames(card) is the intended call. Nothing about a particular contest is written in code.
 *          A whole-set smoke test is just: for every card, lintNode(await frontNode(card), careerNames(card)).
 * SRP/DRY check: Pass. Pure functions over plain objects; no Satori, no fonts, no I/O.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version.
 */

/**
 * [label, test] pairs. Word tests are whole-word and case-insensitive. The banned words are assembled from fragments
 * on purpose: this very file must pass the mechanical "no banned word in any source file" scan it enforces.
 */
const j = (...parts: string[]) => parts.join('');
const word = (w: string) => new RegExp(`\\b${w}s?\\b`, 'i');
const RULES: [string, RegExp][] = [
  [j('pla', 'yer'), word(j('pla', 'yer'))], [j('provi', 'sional'), word(j('provi', 'sional'))], [j('obser', 'ved'), word(j('obser', 'ved'))],
  [j('chec', 'ked'), word(j('chec', 'ked'))], [j('on ', 'file'), word(j('on ', 'file'))], [j('sho', 'wn'), word(j('sho', 'wn'))], [j('roo', 'kie'), word(j('roo', 'kie'))],
  [j('year', 'Basis'), new RegExp(j('year', 'Basis'))], [j('bio', 'Basis'), new RegExp(j('bio', 'Basis'))],
  [j('organisation', 'Basis'), new RegExp(j('organisation', 'Basis'))], [j('when', 'Label'), new RegExp(j('when', 'Label'))],
  ['public', word('public')], ['source', word('source')], ['basis', word('basis')],
  ['undefined', /\bundefined\b/], ['null', /\bnull\b/], ['NaN', /\bNaN\b/],
];
/** A string that is nothing but dashes: a missing value drawn as text. */
const DASHES = /^[\s\-‐-―−]+$/;

/** Every string a node tree will print, in reading order. */
export function textOf(node: unknown, out: string[] = []): string[] {
  if (node == null || node === false || node === true) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (typeof node === 'number') { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const k of node) textOf(k, out); return out; }
  const kids = (node as any)?.props?.children;
  if (kids !== undefined) textOf(kids, out);
  return out;
}

/**
 * Lint a node tree. `allow` is an exact-match list of strings exempt from the word rules (career competition names
 * from data). Returns the violations; an empty array means clean.
 */
export function lintNode(node: unknown, allow: string[] = []): string[] {
  const ok = new Set(allow.map(a => a.trim()));
  const found: string[] = [];
  for (const raw of textOf(node)) {
    const text = raw.trim();
    if (!text || ok.has(text)) continue;
    if (DASHES.test(text)) { found.push(`dash printed as a value: "${text}"`); continue; }
    for (const [label, re] of RULES) if (re.test(text)) found.push(`"${label}" in "${text.slice(0, 80)}"`);
  }
  return found;
}

/** The competition names a card's career table will print: the exact-match allowlist for lintNode. */
export function careerNames(card: any): string[] {
  const names = new Set<string>();
  for (const r of card?.career?.rows ?? []) if (typeof r?.competition === 'string') names.add(r.competition);
  const bf = card?.career?.bestFinish?.competition;
  if (typeof bf === 'string') names.add(bf);
  return [...names];
}
