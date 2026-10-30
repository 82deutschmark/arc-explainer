/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: The REVERSE of the TOPPS card, 750 x 1050: grey cardboard in two inks (the tier colour darkened to print
 *          on grey, and near-black), like a 1987 Topps back. Exports back(card, opts) -> image buffer (png, webp or
 *          jpeg) and backNode(card, opts) -> Satori node tree. What may be printed is decided in backModel.ts; this
 *          file only lays it out.
 *          Top to bottom: number box, name, handle and a miniature of the front; vitals strip; season standings with
 *          the stamp and the single as-of date; career table with the bold CAREER row; teammates in tier colours;
 *          rank ticker; "did you know" strip (only when it has something new); bio (only when it has something
 *          new); copyright line and the card's own URL. Sponsors get a big picture and bio, teams a roster table
 *          with a TEAM TOTAL row.
 *          ROW BUDGET (arithmetic only, no shrink loops): fixed blocks are summed, optional blocks are admitted in a
 *          fixed priority while they fit, and whatever height is still unspent goes, in order, to taller career or
 *          roster rows, a cover-crop picture strip of the card's own art, bigger standings rows, a bigger "did you
 *          know" strip and finally slightly wider gaps. A sparse card therefore gets a bigger picture or bigger
 *          numerals, never a half-empty plate. Text heights come from measuring, never from guessing.
 *          Performance: the cardboard is built once per process (a small tiled fibre texture, few colours); the
 *          miniature reuses a front buffer when the caller passes one (opts.frontBuffer) and only otherwise renders
 *          the front lazily; the PNG is palette-quantised so it stays far below 500 KB.
 * SRP/DRY check: Pass. Data decisions: backModel.ts; vocabulary and fonts: kit.ts; art: art.ts; the front: render.ts
 *          (imported lazily, so there is no import cycle).
 *
 * CHANGELOG
 * 30-Oct-2026 v4 (Claude Sonnet 5.5 Medium, review fixes): a card with no standings, medals or career gets a NO STANDINGS YET panel
 *          instead of a bare full-size silhouette; the roster total row reads KNOWN MEMBERS when only some members have a medal record.
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium): production port. Handle gets a gap and lines up with the series label;
 *          no fact or bio is printed twice; plain card language replaces renderer-talk; SOLO ENTRY and singular
 *          ACCOUNT; off-peak note only for LIVE contests; sparse cards fill with a picture strip or larger rows;
 *          cardboard is a tiled low-entropy texture built once; format option; unsupported scripts never throw;
 *          backNode(card, opts) replaces backNode(vm, art) (the old call shape is still accepted).
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): cartoon strip sized from its captions, rank ticker, sponsor showcase.
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first version (design sample).
 */
import satori from 'satori';
import sharp from 'sharp';
import { FONT, ff, box, at, pic, svgPic, svgDoc, loadFonts, frameSvg, starburst, halftone, alpha, textWidth, fitNameLines, MEDAL, TIERS, svgUri, type Node, type Style } from './kit';
import { viewModel, num, type VM, type CareerRowVM, type MedalsVM } from './model';
import { backModel, type BackModel, type StandingRow, type RosterRow, type MateGroup, type VitalCell } from './backModel';
import { artLayer, W, H, ZONE, type ArtResult } from './art';

export interface BackOpts {
  namesById?: Record<string, string>; tierOverride?: string | null;
  artOverride?: { file?: string; kind?: string; bakedText?: boolean | null };
  /** An already rendered front (750 x 1050) for the miniature. When absent it is rendered lazily from render.ts. */
  frontBuffer?: Buffer;
  /** Output encoding of back(): png (default, palette-quantised), webp or jpeg (share previews). */
  format?: 'png' | 'webp' | 'jpeg'; quality?: number;
}

const INK2 = '#15161d';
/** First ink: the tier colour, darkened until it prints legibly on grey cardboard. */
const INK1: Record<string, string> = { Novice: '#1b7d38', Contributor: '#1d55bd', Expert: '#5a27bd', Master: '#b04800', Grandmaster: '#a8121b', none: '#4f596b', sponsor: '#16306e', team: '#0a766e' };
const STOCK = '#c9c5b8';
const COL_W = 690, COL_H = H - 60, GAP = 8, FOOT = 26;
const MEDAL_WORD: Record<string, string> = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' };

// ---------------------------------------------------------------------------------------------
// Cardboard: built once per process. Base colour, a few soft mottles and a darker edge, then a small seamless tile of
// fibres and specks. Few colours and no turbulence filter, so it renders fast and compresses well.
// ---------------------------------------------------------------------------------------------
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function fibreTile(size = 256): Buffer {
  const rand = rng(7), px = Buffer.alloc(size * size * 4);   // RGBA, fully transparent
  const put = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    const i = (((Math.round(y) % size) + size) % size * size + ((Math.round(x) % size) + size) % size) * 4;
    if (a > px[i + 3]) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; }
  };
  for (let k = 0; k < 900; k++) {                           // paper fibres: short, nearly horizontal strokes, wrapped at the edges
    const x = rand() * size, y = rand() * size, len = 5 + rand() * 12, ang = (rand() - 0.5) * 0.7, dark = rand() < 0.62;
    for (let t = 0; t < len; t++) {
      const [r, g, b, a] = dark ? [74, 66, 52, rand() < 0.5 ? 16 : 28] : [255, 250, 238, 20];
      put(x + Math.cos(ang) * t, y + Math.sin(ang) * t, r, g, b, a);
    }
  }
  for (let k = 0; k < 70; k++) put(rand() * size, rand() * size, 60, 52, 40, 44);   // specks
  return px;
}

let boardCache: Promise<string> | undefined;
function cardboardUri(): Promise<string> {
  boardCache ??= (async () => {
    const rand = rng(11);
    let blots = '';
    for (let i = 0; i < 16; i++) {
      const light = i % 2 === 0;
      blots += `<ellipse cx="${Math.round(rand() * W)}" cy="${Math.round(rand() * H)}" rx="${120 + Math.round(rand() * 200)}" ry="${90 + Math.round(rand() * 160)}" fill="url(#${light ? 'bl' : 'bd'})"/>`;
    }
    const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
      <radialGradient id="bl"><stop offset="0" stop-color="#f4f0e2" stop-opacity=".30"/><stop offset="1" stop-color="#f4f0e2" stop-opacity="0"/></radialGradient>
      <radialGradient id="bd"><stop offset="0" stop-color="#6a604a" stop-opacity=".22"/><stop offset="1" stop-color="#6a604a" stop-opacity="0"/></radialGradient>
      <radialGradient id="edge" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#3a3326" stop-opacity="0"/><stop offset="1" stop-color="#3a3326" stop-opacity=".28"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="${STOCK}"/>${blots}<rect width="${W}" height="${H}" fill="url(#edge)"/></svg>`;
    const tile = await sharp(fibreTile(), { raw: { width: 256, height: 256, channels: 4 } }).png().toBuffer();
    const png = await sharp(Buffer.from(base)).composite([{ input: tile, tile: true }]).png({ palette: true, colours: 96, dither: 0.8, effort: 7 }).toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  })();
  return boardCache;
}

// ---------------------------------------------------------------------------------------------
// Small typographic pieces
// ---------------------------------------------------------------------------------------------
const bebas = (text: string, size: number, color: string, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.bebas), fontSize: size, color, letterSpacing: size * 0.06, lineHeight: 1, ...style }, text);
const mono = (text: string, size: number, color = INK2, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.mono), fontWeight: weight, fontSize: size, color, lineHeight: 1, letterSpacing: -0.3, ...style }, text);
const dot = (c: string, d = 15): Node => box({ width: d, height: d, borderRadius: d / 2, background: c, border: '2px solid #000' });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/**
 * Height of `text` wrapped at maxWidth. Measured in a flex-start container so the node reports its own height (kit's
 * wrappedHeight stretches to its parent and reports the parent's height instead), cached per call shape.
 */
const heightCache = new Map<string, number>();
async function textHeight(text: string, family: string, weight: number, size: number, lineHeight: number, maxWidth: number): Promise<number> {
  const key = `${family}|${weight}|${size}|${lineHeight}|${maxWidth}|${text}`;
  const hit = heightCache.get(key);
  if (hit !== undefined) return hit;
  let found = 0;
  const node = box({ width: maxWidth, height: 3000, alignItems: 'flex-start' },
    { type: 'div', props: { id: 'm', style: { display: 'flex', width: maxWidth, fontFamily: ff(family), fontWeight: weight, fontSize: size, lineHeight }, children: text } });
  await satori(node as any, { width: maxWidth, height: 3000, fonts: loadFonts(), onNodeDetected: (n: any) => { if (n.props?.id === 'm') found = n.height; } });
  if (heightCache.size > 2000) heightCache.clear();
  heightCache.set(key, found);
  return found;
}
const jpegUri = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString('base64')}`;
/** One-line cell text: never wraps, ends in an ellipsis when it cannot fit. */
const clip = (style: Style): Style => ({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style });

const titleBar = (ink1: string, left: string, right: Node | string | null): Node =>
  box({ background: ink1, height: 26, alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', border: `2px solid ${INK2}`, borderBottom: 'none' },
    bebas(left, 19, '#fff', { letterSpacing: 2 }), typeof right === 'string' ? bebas(right, 16, '#fff', { opacity: 0.95, letterSpacing: 1.4 }) : right);
const tableFrame = (...kids: (Node | null)[]): Node => box({ flexDirection: 'column', border: `2px solid ${INK2}`, background: 'rgba(255,255,255,0.28)' }, ...kids);
const colHead = (t: string, w: number, ink1: string): Node => box({ width: w, justifyContent: 'flex-end', paddingRight: 8 }, bebas(t, 14, ink1, { letterSpacing: 1.6 }));
const numCell = (text: string | null, w: number, size = 17, color = INK2, weight = 700): Node =>
  box({ width: w, justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8 }, text ? mono(text, size, color, weight) : null);
const coinRow = (m: MedalsVM, size = 18): Node => box({ alignItems: 'center' }, ...(['gold', 'silver', 'bronze'] as const).map(k =>
  box({ alignItems: 'center', marginLeft: 12 }, dot(MEDAL[k], 15), mono(String(m[k]), size, '#fff', 700, { marginLeft: 5 }))));

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------
const HEADER_H = 140, VITALS_H = 48, MINI = { w: 96, h: 134 };
const platformWord = (p: string | null) => (p === 'x' ? 'X' : p ? p[0].toUpperCase() + p.slice(1) : '');

function header(vm: VM, ink1: string, mini: Buffer, nameFit: { size: number; lines: string[] }): Node {
  const platform = platformWord(vm.handlePlatform);
  return box({ height: HEADER_H, alignItems: 'stretch', flexShrink: 0 },
    // left: Topps number box, then the series label pinned to the bottom edge of the header
    box({ width: 104, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' },
      box({ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 96, height: 76, background: '#fff', border: `4px solid ${INK2}`, boxShadow: `4px 4px 0 ${ink1}` },
        bebas('NO.', 15, ink1, { letterSpacing: 3 }), box({ fontFamily: ff(FONT.slab), fontSize: 27, color: INK2, lineHeight: 1, marginTop: 2 }, vm.number),
        vm.numberOf ? bebas(`OF ${num(vm.numberOf)}`, 14, '#3a3a44', { marginTop: 2 }) : null),
      box({ height: 40, alignItems: 'center' },
        box({ flexDirection: 'column' }, bebas(vm.wordmark.toUpperCase(), 17, INK2, { letterSpacing: 1.6 }), bebas(vm.season, 17, ink1, { letterSpacing: 2, marginTop: 2 })))),
    // middle: name, type chip, and the handle on the same line as the series label (equal row height, centred)
    box({ flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 8, minWidth: 0 },
      box({ flexDirection: 'column' },
        ...nameFit.lines.map(line => box({ fontFamily: ff(FONT.slab), fontSize: nameFit.size, color: INK2, lineHeight: 1.04, textTransform: 'uppercase', ...clip({ width: COL_W - 104 - 110 - 20 }) }, line)),
        box({ marginTop: 6, alignItems: 'center' },
          box({ background: ink1, padding: '3px 10px 2px 10px', border: `2px solid ${INK2}` }, bebas(vm.typeLabel, 20, '#fff', { letterSpacing: 2.4 })),
          vm.tierLine ? bebas(vm.tierLine, 22, ink1, { marginLeft: 10, letterSpacing: 2.4 }) : null,
          vm.family === 'sponsor' && vm.role ? bebas(vm.role.toUpperCase(), 22, ink1, { marginLeft: 10, letterSpacing: 2.2 }) : null)),
      box({ height: 40, alignItems: 'center' },
        vm.handle ? box({ alignItems: 'baseline' }, mono(vm.handle, 17, INK2, 700), platform ? mono(`on ${platform}`, 14, '#4a4a55', 500, { marginLeft: 8 }) : null) : null)),
    // right: miniature of the front
    box({ width: 110, justifyContent: 'flex-end', alignItems: 'flex-start' },
      box({ width: MINI.w + 6, height: MINI.h + 6, border: `3px solid ${INK2}`, boxShadow: `4px 4px 0 ${ink1}`, background: '#000', position: 'relative' }, pic(jpegUri(mini), 0, 0, MINI.w, MINI.h))));
}

function vitalsStrip(cells: VitalCell[], ink1: string): Node | null {
  if (!cells.length) return null;
  return box({ height: VITALS_H, flexShrink: 0, border: `2px solid ${INK2}`, background: 'rgba(255,255,255,0.34)' },
    ...cells.map((c, i) => box({ flexGrow: c.grow, width: 0, flexDirection: 'column', justifyContent: 'center', padding: '0 9px', borderLeft: i ? `1.5px solid ${INK2}` : 'none', minWidth: 0 },
      bebas(c.k, 13, ink1, { letterSpacing: 1.6 }),
      box({ marginTop: 4, fontFamily: ff(FONT.mono), fontWeight: 700, fontSize: 14, color: INK2, lineHeight: 1, ...clip({}) }, c.v))));
}

/** Season standings. rowH is elastic: numerals scale with it, so a card with one contest can have a big price-guide row. */
const standingsHeight = (n: number, rowH: number) => 26 + 22 + n * rowH + 4;
function standings(rows: StandingRow[], vm: VM, ink1: string, rowH: number): Node | null {
  if (!rows.length) return null;
  const peak = rows.some(c => c.peak), subs = rows.some(c => c.subs);
  // Column widths follow the numeral size; the numeral size steps down (arithmetically) until the columns fit.
  const widest = (pick: (r: StandingRow) => string | null) => Math.max(0, ...rows.map(r => (pick(r) ?? '').length));
  const want = clamp(Math.round(rowH * 0.55), 22, 48);
  let rankF = want, scoreF = clamp(Math.round(rowH * 0.42), 19, 38), auxF = clamp(Math.round(rowH * 0.34), 17, 30);
  const widths = () => ({
    rank: Math.max(92, Math.ceil(widest(r => r.rank) * rankF * 0.62) + 18), peak: peak ? Math.max(78, Math.ceil(widest(r => r.peak) * auxF * 0.62) + 18) : 0,
    score: Math.max(96, Math.ceil(widest(r => r.score) * scoreF * 0.62) + 18), subs: subs ? Math.max(70, Math.ceil(widest(r => r.subs) * auxF * 0.62) + 18) : 0,
  });
  let cw = widths();
  while (cw.rank + cw.peak + cw.score + cw.subs > 440 && rankF > 22) { rankF -= 2; scoreF = Math.max(19, scoreF - 2); auxF = Math.max(17, auxF - 2); cw = widths(); }
  const stampPill = vm.stamp ? box({ alignItems: 'center' },
    box({ background: vm.stamp.word === 'LIVE' ? '#e0262c' : '#14306e', border: '2px solid #000', padding: '2px 8px 1px 8px', marginRight: 8 }, box({ fontFamily: ff(FONT.comic), fontSize: 17, color: '#fff', lineHeight: 1, letterSpacing: 1 }, vm.stamp.word)),
    bebas(`AS OF ${vm.stamp.date}`, 17, '#fff', { letterSpacing: 1.6 })) : null;
  const titleW = 666 - cw.rank - cw.peak - cw.score - cw.subs - 12;   // what the numerals leave for the contest name
  const titleF = rowH >= 70 ? 24 : rowH >= 52 ? 21 : 19;
  return tableFrame(
    titleBar(ink1, `${vm.season} SEASON · KAGGLE COMPETITIONS STANDINGS`, stampPill),
    box({ height: 22, alignItems: 'center', padding: '0 10px', borderBottom: `1.5px solid ${INK2}` },
      box({ flexGrow: 1 }, bebas('CONTEST · TEAM', 14, ink1, { letterSpacing: 1.6 })), colHead('RANK', cw.rank, ink1), peak ? colHead('PEAK', cw.peak, ink1) : null, colHead('SCORE', cw.score, ink1), subs ? colHead('SUBS', cw.subs, ink1) : null),
    ...rows.map((c, i) => box({ height: rowH, alignItems: 'center', padding: '0 10px', background: i % 2 ? 'rgba(0,0,0,0.06)' : 'transparent', borderBottom: i < rows.length - 1 ? `1px solid ${alpha(INK2, 0.5)}` : 'none' },
      box({ flexGrow: 1, flexDirection: 'column', minWidth: 0, justifyContent: 'center' },
        bebas(c.title, titleF, INK2, { letterSpacing: 1, ...clip({ width: titleW }) }),
        // tall rows let the sub line wrap to two lines; compact rows keep it on one line with an ellipsis
        c.sub || c.note ? box({ fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: rowH >= 52 ? 16 : 14, color: ink1, marginTop: rowH >= 52 ? 5 : 2, lineHeight: 1.15, width: titleW, ...(rowH >= 70 ? {} : clip({})) }, [c.sub, c.note].filter(Boolean).join(' · ')) : null),
      numCell(c.rank, cw.rank, rankF), peak ? numCell(c.peak, cw.peak, auxF, ink1) : null, numCell(c.score, cw.score, scoreF), subs ? numCell(c.subs, cw.subs, auxF, ink1) : null)));
}

/** Career table: header, the n best rows, a plain note when more contests exist than are listed, then the bold CAREER row. */
const CAREER_CHROME = 26 + 22 + 32 + 4, NOTE_H = 20;
function careerTable(cb: NonNullable<BackModel['career']>, ink1: string, n: number, rowH: number, note: string | null): Node {
  const rows: CareerRowVM[] = cb.rows.slice(0, n);
  const cw = { place: 72, of: 72, top: 70, medal: 92 };
  const fs = rowH >= 30 ? 18 : rowH >= 24 ? 16 : 14.5;
  const body = rows.map((r, i) => box({ height: rowH, alignItems: 'center', padding: '0 10px', background: i % 2 ? 'rgba(0,0,0,0.065)' : 'transparent' },
    box({ flexGrow: 1, minWidth: 0, fontFamily: ff(FONT.cond), fontWeight: r.medal ? 700 : 500, fontSize: fs, color: INK2, ...clip({ width: 360 }) }, r.name),
    numCell(r.place, cw.place, fs - 1), numCell(r.of, cw.of, fs - 1, '#4a4a55', 500), numCell(r.top, cw.top, fs - 1, ink1),
    box({ width: cw.medal, justifyContent: 'flex-start', alignItems: 'center', paddingLeft: 10 }, r.medal ? box({ alignItems: 'center' }, dot(MEDAL[r.medal], rowH >= 26 ? 16 : 13), bebas(MEDAL_WORD[r.medal], rowH >= 26 ? 17 : 14, INK2, { marginLeft: 5, letterSpacing: 1 })) : null)));
  const careerRow = box({ height: 32, alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', background: INK2, borderTop: `3px double ${STOCK}` },
    box({ alignItems: 'baseline' }, bebas('CAREER', 22, '#fff', { letterSpacing: 2.4 }), bebas(`${num(cb.completed)} CONTEST${cb.completed === 1 ? "" : "S"}`, 15, '#c8cbd6', { marginLeft: 10, letterSpacing: 1.4 })),
    box({ alignItems: 'center' }, cb.bestFinish ? bebas(`BEST FINISH ${cb.bestFinish}`, 17, '#ffd24a', { letterSpacing: 1.2 }) : null, cb.medals ? coinRow(cb.medals) : null));
  return tableFrame(
    titleBar(ink1, 'KAGGLE COMPETITIONS · CAREER RECORD', 'BEST FINISHES FIRST'),
    box({ height: 22, alignItems: 'center', padding: '0 10px', borderBottom: `1.5px solid ${INK2}` },
      box({ flexGrow: 1 }, bebas('COMPETITION', 14, ink1, { letterSpacing: 1.6 })), colHead('PLACE', cw.place, ink1), colHead('FIELD', cw.of, ink1), colHead('TOP %', cw.top, ink1), box({ width: cw.medal, paddingLeft: 10 }, bebas('MEDAL', 14, ink1, { letterSpacing: 1.6 }))),
    ...body,
    note ? box({ height: NOTE_H, alignItems: 'center', padding: '0 10px', borderTop: `1.5px solid ${INK2}` }, bebas(note, 14, ink1, { letterSpacing: 1.6 })) : null,
    careerRow);
}

// ---- teammates: measured, so the block height is exact ----
const CHIP_PAD = 4 + 10 + 4 + 6 + 3 + 7;                       // dot box + margins + padding + borders + gap, per chip
const CHIP_ROW_H = 24;
async function mateLines(g: MateGroup): Promise<number> {
  let lines = 1, used = 0;
  for (const m of g.mates) {
    const w = (await textWidth(m.name, FONT.cond, 500, 13.5)) + CHIP_PAD;
    if (used + w > 666 && used > 0) { lines++; used = 0; }
    used += w;
  }
  return lines;
}
const mateGroupHeight = (lines: number) => 6 + 17 + 4 + lines * CHIP_ROW_H + 4;
async function teammatesHeight(gs: MateGroup[]): Promise<number> {
  let h = 26 + 4;
  for (const g of gs) h += mateGroupHeight(await mateLines(g));
  return h;
}
async function teammates(gs: MateGroup[], ink1: string): Promise<Node> {
  const heights = await Promise.all(gs.map(async g => mateGroupHeight(await mateLines(g))));
  return tableFrame(titleBar(ink1, 'TEAMMATES THIS SEASON', null),
    ...gs.map((g, i) => box({ height: heights[i], padding: '6px 10px 4px 10px', flexDirection: 'column', background: i % 2 ? 'rgba(0,0,0,0.06)' : 'transparent' },
      box({ alignItems: 'baseline' }, bebas(g.contest, 17, ink1, { letterSpacing: 1.4 }), g.team ? box({ marginLeft: 8, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 15, color: INK2 }, g.team) : null),
      box({ flexWrap: 'wrap', marginTop: 4 }, ...g.mates.map(m => {
        const t = m.tier ? TIERS[m.tier] : null;
        return box({ alignItems: 'center', marginRight: 7, height: 21, marginBottom: 3, padding: '0 6px 0 4px', border: `1.5px solid ${INK2}`, background: '#fff' },
          box({ width: 10, height: 10, borderRadius: 5, background: t ? t.main : '#8a909c', border: '1.5px solid #000', marginRight: 4 }),
          box({ fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: 13.5, color: INK2, lineHeight: 1.1 }, m.name));
      })))));
}

// ---- team roster ----
const ROSTER_CHROME = 26 + 22 + 4, TOTAL_H = 32;
function rosterTable(rows: RosterRow[], total: MedalsVM | null, ink1: string, rowH: number, note: string | null, known: { n: number; of: number }): Node {
  const medalCell = (m: MedalsVM | null, k: 'gold' | 'silver' | 'bronze') => box({ width: 56, justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8 }, m ? box({ alignItems: 'center' }, dot(MEDAL[k], 12), mono(String(m[k]), 16, INK2, 700, { marginLeft: 4 })) : null);
  const body = rows.map((r, i) => {
    const t = r.tier ? TIERS[r.tier] : null;
    return box({ height: rowH, alignItems: 'center', padding: '0 10px', background: i % 2 ? 'rgba(0,0,0,0.065)' : 'transparent' },
      box({ width: 22, height: 22, borderRadius: 11, background: t ? t.main : '#8a909c', border: '2px solid #000', marginRight: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        box({ fontFamily: ff(FONT.slab), fontSize: 11, color: t ? t.ink : '#fff', lineHeight: 1 }, (Array.from(r.name)[0] ?? '?').toUpperCase())),
      box({ flexGrow: 1, minWidth: 0, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: rowH >= 30 ? 18 : 17, color: INK2, ...clip({ width: 270 }) }, r.name),
      box({ width: 112, justifyContent: 'flex-end', paddingRight: 8 }, t ? box({ background: t.main, border: '1.5px solid #000', padding: '2px 6px 1px 6px' }, bebas(t.label.toUpperCase(), 14, t.ink, { letterSpacing: 1.4 })) : null),
      medalCell(r.medals, 'gold'), medalCell(r.medals, 'silver'), medalCell(r.medals, 'bronze'),
      box({ width: 92, justifyContent: 'flex-end' }, r.hasCard ? box({ border: `1.5px solid ${INK2}`, padding: '2px 5px 1px 5px', background: '#fff' }, bebas('HAS A CARD', 12, INK2, { letterSpacing: 1.2 })) : null));
  });
  return tableFrame(titleBar(ink1, 'TEAM ROSTER', `${rows.length} ACCOUNT${rows.length === 1 ? '' : 'S'}`),
    box({ height: 22, alignItems: 'center', padding: '0 10px', borderBottom: `1.5px solid ${INK2}` },
      box({ flexGrow: 1, paddingLeft: 31 }, bebas('MEMBER', 14, ink1, { letterSpacing: 1.6 })), colHead('KAGGLE TIER', 112, ink1), colHead('GOLD', 56, ink1), colHead('SILVER', 56, ink1), colHead('BRONZE', 56, ink1), box({ width: 92 })),
    ...body,
    note ? box({ height: NOTE_H, alignItems: 'center', padding: '0 10px', borderTop: `1.5px solid ${INK2}` }, bebas(note, 14, ink1, { letterSpacing: 1.6 })) : null,
    total ? box({ height: TOTAL_H, alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', background: INK2, borderTop: `3px double ${STOCK}` }, bebas(known.n === known.of ? 'TEAM TOTAL' : `KNOWN MEMBERS · ${known.n} OF ${known.of}`, known.n === known.of ? 21 : 18, '#fff', { letterSpacing: 2.4 }), coinRow(total)) : null);
}

/** Kaggle rank ticker: a log-scale track from #1 to the size of the field with NOW and BEST markers. */
const LADDER_H = 26 + 58 + 4;
function ladder(vm: VM, ink1: string): Node | null {
  const r = vm.card.rank;
  if (!r?.current || !r?.outOf) return null;
  const L = Math.log10(r.outOf), pos = (n: number) => Math.min(1, Math.max(0, Math.log10(n) / L));
  const TW = 580, X0 = 22, trackY = 18, trackH = 18;
  const nowX = X0 + pos(r.current) * TW, bestX = r.best ? X0 + pos(r.best) * TW : null;
  const top = (r.current / r.outOf) * 100;
  const topText = top < 1 ? top.toFixed(2) : top.toFixed(1);
  const tri = (x: number, down: boolean, c: string) => down
    ? `<polygon points="${x - 8},${trackY - 14} ${x + 8},${trackY - 14} ${x},${trackY - 1}" fill="${c}" stroke="#000" stroke-width="2" stroke-linejoin="round"/>`
    : `<polygon points="${x - 8},${trackY + trackH + 12} ${x + 8},${trackY + trackH + 12} ${x},${trackY + trackH + 1}" fill="${c}" stroke="#000" stroke-width="2" stroke-linejoin="round"/>`;
  let svg = `<rect x="${X0}" y="${trackY}" width="${TW}" height="${trackH}" fill="#fff" fill-opacity=".55" stroke="${INK2}" stroke-width="2"/>`;
  const ticks = [10, 100, 1000, 10000, 100000].filter(t => t < r.outOf);
  for (const t of ticks) svg += `<line x1="${X0 + pos(t) * TW}" y1="${trackY}" x2="${X0 + pos(t) * TW}" y2="${trackY + trackH}" stroke="${INK2}" stroke-width="1.2" stroke-opacity=".6"/>`;
  svg += tri(nowX, true, ink1) + (bestX != null && Math.abs(bestX - nowX) > 14 ? tri(bestX, false, '#fff') : '');
  // labels sit beside their marker (right-aligned to its left, or left-aligned to its right near the left edge)
  const lab = (t: string, x: number, left: boolean, y: number, col: string) => at(left ? x + 13 : x - 213, y, 200, 16, { justifyContent: left ? 'flex-start' : 'flex-end' }, bebas(t, 15, col, { letterSpacing: 1.2, whiteSpace: 'nowrap' }));
  const near = bestX != null && Math.abs(bestX - nowX) < 150;
  const nowLabel = near && r.best ? `BEST ${vm.overall?.best} · NOW ${vm.overall?.rank}` : `NOW ${vm.overall?.rank}`;
  const nowLeft = nowX < X0 + 150;
  return tableFrame(
    titleBar(ink1, 'KAGGLE COMPETITIONS RANK TICKER', `TOP ${topText}% OF ${vm.overall?.outOf}`),
    box({ height: 58, position: 'relative' },
      svgPic(svgDoc(690, 58, svg), 0, 0, 690, 58),
      ...ticks.map(t => at(X0 + pos(t) * TW + 3, trackY + 3, 60, 14, {}, mono(t >= 1000 ? `#${t / 1000}K` : `#${t}`, 10, '#3d3d46', 500))),
      at(X0 + 4, trackY + 3, 30, 14, {}, mono('#1', 11, '#3d3d46', 500)),
      lab(nowLabel, nowX, nowLeft, 3, ink1),
      r.best && !near ? lab(`BEST ${vm.overall?.best}`, bestX!, bestX! < X0 + 150, 40, INK2) : null,
      at(X0 + TW + 8, trackY + 2, 100, 16, {}, mono(`#${vm.overall?.outOf}`, 12, '#3d3d46', 700))));
}

// ---- the cartoon strip: exactly as tall as its captions ----
async function slabSize(facts: string[], big: boolean): Promise<{ h: number; capHs: number[] }> {
  const sc = big ? 1.35 : facts.length > 1 ? 1 : 0.8;
  const burstW = Math.round(150 * sc), burstH = Math.round(108 * sc);
  const textW = COL_W - 8 - 24 - burstW - 6 - 14 - 26;
  const size = big ? 21 : 16;
  const capHs = await Promise.all(facts.map(async t => (await textHeight(t, FONT.cond, 700, size, 1.16, textW)) + 16));
  const gap = big ? 12 : 7;
  const content = capHs.reduce((a, b) => a + b, 0) + gap * Math.max(0, capHs.length - 1);
  return { h: Math.max(burstH, content) + 20 + 8, capHs };
}
function slab(facts: string[], ink1: string, big: boolean, h: number): Node {
  const sc = big ? 1.35 : facts.length > 1 ? 1 : 0.8, bw = Math.round(150 * sc), bh = Math.round(108 * sc);
  const burst = svgDoc(bw, bh, `<polygon points="${starburst(79, 56, 14, 72, 52)}" fill="#000" opacity=".5"/><polygon points="${starburst(75, 52, 14, 72, 52)}" fill="#e0262c" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/>`, '', [150, 108]);
  const size = big ? 21 : 16;
  return box({ height: h, flexShrink: 0, border: `4px solid ${INK2}`, background: '#ffd93b', boxShadow: `5px 5px 0 ${INK2}`, position: 'relative', alignItems: 'center', padding: '10px 12px' },
    svgPic(svgDoc(690, 400, `<rect width="690" height="400" fill="url(#h)"/>`, halftone('h', '#d9552b', 0.34, 9, 2.4)), 0, 0, 690, 400, { opacity: 0.8 }),
    box({ width: bw, height: bh, position: 'relative', alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0 },
      svgPic(burst, 0, 0, bw, bh), at(0, 0, bw, bh, { alignItems: 'center', justifyContent: 'center', flexDirection: 'column', transform: 'rotate(-6deg)' },
        box({ fontFamily: ff(FONT.comic), fontSize: Math.round(30 * sc), color: '#fff', lineHeight: 0.95, textShadow: '2px 2px 0 #000', textAlign: 'center', letterSpacing: 1 }, 'DID YOU'),
        box({ fontFamily: ff(FONT.comic), fontSize: Math.round(38 * sc), color: '#ffe35a', lineHeight: 0.95, textShadow: '2px 2px 0 #000', letterSpacing: 1 }, 'KNOW?'))),
    box({ flexGrow: 1, flexDirection: 'column', justifyContent: 'center', gap: big ? 12 : 7 },
      ...facts.map((t, i) => box({ background: '#fff', border: `3px solid ${INK2}`, padding: '5px 10px 5px 10px', alignItems: 'center', boxShadow: `3px 3px 0 ${INK2}`, marginLeft: i % 2 ? 14 : 0, marginRight: i % 2 ? 0 : 14 },
        box({ fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: size, color: INK2, lineHeight: 1.16 }, t)))));
}

// ---- bio (only when it carries something new) ----
async function bioSize(text: string, size: number, width: number): Promise<number> {
  return Math.ceil(await textHeight(text, FONT.cond, 500, size, 1.22, width));
}
async function bioBlock(text: string, ink1: string): Promise<{ node: Node; h: number }> {
  const labelW = Math.ceil(await textWidth('THE BIO', FONT.bebas, 400, 17, 3)) + 10, w = COL_W - 4 - labelW;
  const th = await bioSize(text, 15.5, w), h = Math.max(th, 17) + 18;
  return { h, node: box({ height: h, flexShrink: 0, flexDirection: 'column', borderTop: `3px solid ${INK2}`, borderBottom: `1.5px solid ${INK2}`, padding: '6px 2px 7px 2px' },
    box({ alignItems: 'flex-start' }, bebas('THE BIO', 17, ink1, { letterSpacing: 3, marginRight: 10, whiteSpace: 'nowrap', flexShrink: 0 }),
      box({ width: w, fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: 15.5, lineHeight: 1.22, color: INK2 }, text))) };
}

function footer(vm: VM): Node {
  const left = `© ${vm.season} ${vm.publisher ?? ''} · ${vm.wordmark}`.replace(/\s+/g, ' ').replace(/^© (?=·)/, '').trim().toUpperCase();
  return at(30, 30 + COL_H - FOOT, COL_W, FOOT, { alignItems: 'center', justifyContent: 'space-between' },
    box({ fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: 12, color: '#3d3d46', letterSpacing: 0.6 }, left),
    mono(String(vm.card.urlAbsolute ?? '').replace(/^https?:\/\//, ''), 11.5, '#3d3d46', 500));
}

// ---------------------------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------------------------
/** The card's real picture (never the designed placeholder) cropped to w x h around the point of interest; null when there is none. */
async function pictureCrop(art: ArtResult, w: number, h: number): Promise<Buffer | null> {
  const r = art.plate ?? (art.kind === 'contract' ? ZONE : null);
  if (!r) return null;
  return sharp(art.png).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).resize(w, h, { fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 86 }).toBuffer();
}
const framed = (ink1: string, w: number, h: number, jpg: Buffer): Node =>
  box({ width: w, height: h, flexShrink: 0, position: 'relative', border: `4px solid ${INK2}`, boxShadow: `5px 5px 0 ${ink1}`, background: '#000' }, pic(jpegUri(jpg), 0, 0, w - 8, h - 8));

/** Miniature of the front: the caller's buffer, else a lazily rendered front, else a crop of the art. */
async function miniature(card: any, opts: BackOpts, art: ArtResult): Promise<Buffer> {
  let front = opts.frontBuffer;
  if (!front) {
    try { const r: any = await import('./render'); front = await (r.frontBuffer ?? r.front)(card, opts); } catch { front = undefined; }   // the memoised front when render.ts offers one
  }
  const src = front ?? art.png;
  return sharp(src).resize(MINI.w, MINI.h, { fit: 'cover', position: 'north' }).jpeg({ quality: 88 }).toBuffer();
}

// ---------------------------------------------------------------------------------------------
// Assembly with the row budget
// ---------------------------------------------------------------------------------------------
interface Placed { node: Node; h: number }

async function sponsorColumn(vm: VM, bm: BackModel, art: ArtResult, ink1: string, head: Placed[]): Promise<Placed[]> {
  const out: Placed[] = [...head];
  const slabInfo = bm.facts.length ? await slabSize(bm.facts, false) : null;
  const gapsFor = (blocks: number) => GAP * blocks;                     // gaps between the blocks above the pinned footer, footer reserve included
  const fixed = head.reduce((a, b) => a + b.h, 0) + (slabInfo?.h ?? 0);
  const count = head.length + (slabInfo ? 1 : 0) + 2;                    // + picture + bio
  const room = COL_H - FOOT - fixed - gapsFor(count);
  const plate = art.plate;
  const bio = vm.bio ?? '';
  const havePic = !!(plate || art.kind === 'contract');
  const wide = !!plate && plate.w / plate.h > 1.2;
  if (havePic && wide) {
    // Full-width picture on top, bio below: the largest bio size that still leaves the picture its natural height (within reason).
    const natural = Math.round((COL_W - 8) * plate!.h / plate!.w) + 8;
    let chosen = { size: 18, h: 0 };
    for (const size of [26, 24, 22, 20, 18]) {
      const h = (await bioSize(bio, size, COL_W)) + 34;
      chosen = { size, h };
      if (room - h >= natural * 0.9) break;
    }
    const picH = Math.min(room - chosen.h, Math.round(natural * 1.12));
    const jpg = (await pictureCrop(art, COL_W - 8, picH - 8))!;
    out.push({ node: framed(ink1, COL_W, picH, jpg), h: picH });
    out.push({ node: sponsorBio(bio, ink1, chosen.size, chosen.h), h: chosen.h });
  } else if (havePic) {
    // Portrait picture beside the bio, both as tall as the room: the bio size is the largest that fits that height.
    const picW = 308, textW = COL_W - picW - 20;
    let size = 18;
    for (const s of [28, 26, 24, 22, 20, 18]) { size = s; if ((await bioSize(bio, s, textW)) + 40 <= room) break; }
    const jpg = (await pictureCrop(art, picW - 8, room - 8))!;
    out.push({ node: box({ height: room, flexShrink: 0, alignItems: 'stretch' }, framed(ink1, picW, room, jpg),
      box({ flexGrow: 1, flexDirection: 'column', paddingLeft: 18, justifyContent: 'center' }, sponsorBio(bio, ink1, size, null))), h: room });
  } else {
    out.push({ node: box({ height: room, flexShrink: 0, flexDirection: 'column', justifyContent: 'center' }, sponsorBio(bio, ink1, 28, null)), h: room });
  }
  if (slabInfo) out.push({ node: slab(bm.facts, ink1, false, slabInfo.h), h: slabInfo.h });
  return out;
}
function sponsorBio(text: string, ink1: string, size: number, h: number | null): Node {
  return box({ flexDirection: 'column', ...(h ? { height: h, flexShrink: 0, paddingTop: 8 } : {}) }, bebas('THE BIO', 22, ink1, { letterSpacing: 4 }),
    box({ display: 'block', marginTop: 6, fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: size, lineHeight: 1.22, color: INK2 }, text));
}

/**
 * The name, fitted by kit.fitNameLines: one line from 38 px down, else the best two-line split at a space, a middle dot
 * or a slash (never mid-word), else one shrunk line for a long unbroken name. Each returned line is drawn nowrap.
 */
async function fitNameSafe(name: string): Promise<{ size: number; lines: string[] }> {
  return fitNameLines(name.toUpperCase(), FONT.slab, 400, COL_W - 104 - 110 - 20, 56, { max: 38, min: 24, twoLineMax: 26, twoLineMin: 18 });
}

export async function backNode(cardOrVm: any, optsOrArt: any = {}): Promise<Node> {
  // Old call shape (vm, art) is still accepted; the new one is (card, opts).
  const legacy = cardOrVm && 'family' in cardOrVm && 'T' in cardOrVm;
  const opts: BackOpts = legacy ? {} : optsOrArt;
  const vm: VM = legacy ? cardOrVm : viewModel(cardOrVm, opts);
  const card = vm.card;
  const art: ArtResult = legacy ? optsOrArt : await artLayer(card, vm.T, opts.artOverride);
  const ink1 = INK1[vm.T.key] ?? INK1.none;
  const bm = backModel(vm);

  const [mini, nameFit, boardSrc] = await Promise.all([miniature(card, opts, art), fitNameSafe(vm.name), cardboardUri()]);
  const head: Placed[] = [{ node: header(vm, ink1, mini, nameFit), h: HEADER_H }];
  const vit = vitalsStrip(bm.vitals, ink1);
  if (vit) head.push({ node: vit, h: VITALS_H });

  let blocks: Placed[];
  let gap = GAP;
  if (vm.family === 'sponsor') {
    blocks = await sponsorColumn(vm, bm, art, ink1, head);
  } else {
    blocks = [...head];
    const slabInfo = bm.facts.length ? await slabSize(bm.facts, false) : null;
    const bio = bm.bio ? await bioBlock(bm.bio, ink1) : null;
    let sRow = 40;                                                     // standings row height; grows with leftover room
    const nS = bm.standings.length;
    // `left` is the height still unspent: the column minus the pinned footer, every placed block and the gaps between them.
    let count = blocks.length + (nS ? 1 : 0) + (slabInfo ? 1 : 0) + (bio ? 1 : 0);
    let left = COL_H - FOOT - GAP - [...blocks.map(b => b.h), nS ? standingsHeight(nS, sRow) : 0, slabInfo?.h ?? 0, bio?.h ?? 0].reduce((a, b) => a + b, 0) - GAP * (count - 1);
    const spend = (h: number) => { left -= h + GAP; count++; };

    let table: Placed | null = null;        // career table or roster table
    let mates: Placed | null = null, tick: Placed | null = null;
    let tableRowH = 21;
    if (vm.family === 'competitor' && bm.career) {
      const cb = bm.career, k0 = Math.min(cb.rows.length, 14);
      const reserve = CAREER_CHROME + NOTE_H + k0 * 21 + GAP;
      const mH = bm.mates.length ? await teammatesHeight(bm.mates) : 0;
      if (mH && left - reserve >= mH + GAP) { mates = { node: await teammates(bm.mates, ink1), h: mH }; spend(mH); }
      const lad = ladder(vm, ink1);
      if (lad && left - reserve >= LADDER_H + GAP) { tick = { node: lad, h: LADDER_H }; spend(LADDER_H); }
      const avail = left - GAP - CAREER_CHROME;
      let n = Math.min(cb.rows.length, Math.max(1, Math.floor(avail / 21)));
      let note: string | null = null;
      if (n < cb.completed) { n = Math.min(cb.rows.length, Math.max(1, Math.floor((avail - NOTE_H) / 21))); }
      if (n < cb.completed) note = `${num(cb.completed - n)} MORE CONTEST${cb.completed - n === 1 ? '' : 'S'} NOT LISTED`;
      tableRowH = clamp(Math.floor((avail - (note ? NOTE_H : 0)) / n), 21, 30);
      const th = CAREER_CHROME + (note ? NOTE_H : 0) + n * tableRowH;
      table = { node: careerTable(cb, ink1, n, tableRowH, note), h: th };
      spend(th);
    } else if (vm.family === 'team' && bm.roster.length) {
      const total = bm.roster.length > 1 ? bm.rosterTotal : null;
      const chrome = ROSTER_CHROME + (total ? TOTAL_H : 0);
      const avail = left - GAP - chrome;
      let n = Math.min(bm.roster.length, Math.max(1, Math.floor(avail / 20)));
      let note: string | null = null;
      if (n < bm.roster.length) { n = Math.min(bm.roster.length, Math.max(1, Math.floor((avail - NOTE_H) / 20))); note = `${bm.roster.length - n} MORE ACCOUNT${bm.roster.length - n === 1 ? '' : 'S'} NOT LISTED`; }
      tableRowH = clamp(Math.floor((avail - (note ? NOTE_H : 0)) / n), 20, 40);
      const th = chrome + (note ? NOTE_H : 0) + n * tableRowH;
      table = { node: rosterTable(bm.roster.slice(0, n), total, ink1, tableRowH, note, { n: bm.rosterKnown, of: bm.roster.length }), h: th };
      spend(th);
    }

    // A competitor with no standings, medals or career gets a real panel saying so, ahead of the picture.
    let none: Placed | null = null;
    if (vm.bare) {
      const nsH = 118;
      none = { h: nsH, node: tableFrame(titleBar(ink1, 'KAGGLE COMPETITIONS · STANDINGS', null),
        box({ height: nsH - 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
          bebas('NO STANDINGS YET', 46, ink1, { letterSpacing: 3 }),
          vm.handleLine ? mono(vm.handleLine, 15, INK2, 700, { marginTop: 8 }) : null)) };
      spend(nsH);
    }

    // Leftover height, spent in a fixed order. A strip of the card's own picture first (cover crop, the picture grows),
    const realArt = !!(art.plate || art.kind === 'contract');
    let stripH = 0, stripPlate = false;
    if (realArt && left >= 130 + GAP) { stripH = Math.min(left - GAP, 340); spend(stripH); }
    // then bigger standings rows (numerals scale with the row),
    if (nS && left > 0) {
      const extra = Math.min(Math.floor(left / nS), 96 - sRow);
      if (extra > 0) { sRow += extra; left -= extra * nS; }
    }
    // then the bigger cartoon strip,
    let bigSlab = false, slabH = slabInfo?.h ?? 0;
    if (slabInfo && left > 0) {
      const big = await slabSize(bm.facts, true);
      if (big.h - slabInfo.h <= left) { bigSlab = true; left -= big.h - slabInfo.h; slabH = big.h; }
    }
    // then, only when the card has no picture of its own and nothing else to grow, the designed plate,
    if (!stripH && left >= 260) { stripH = Math.min(left - GAP, 340); stripPlate = true; spend(stripH); }
    // then whatever picture there is takes the rest (up to a tall portrait crop),
    if (stripH && left > 0) { const grow = Math.min(left, 640 - stripH); stripH += grow; left -= grow; }
    // and last, slightly wider gaps so the footer is never stranded.
    gap = GAP + clamp(Math.floor(left / Math.max(1, count - 1)), 0, 14);
    let strip: Placed | null = null;
    if (stripH) {
      let jpg: Buffer | null;
      if (stripPlate) {
        // the designed placeholder: full width, centred on its head and shoulders
        const ph = Math.min(H, Math.round(W * (stripH - 8) / (COL_W - 8))), top = clamp(Math.round(330 - ph / 2), 0, H - ph);
        jpg = await sharp(art.png).extract({ left: 0, top, width: W, height: ph }).resize(COL_W - 8, stripH - 8, { fit: 'fill' }).jpeg({ quality: 86 }).toBuffer();
      } else jpg = await pictureCrop(art, COL_W - 8, stripH - 8);
      if (jpg) strip = { node: framed(ink1, COL_W, stripH, jpg), h: stripH };
    }

    // ---- build in reading order ----
    if (nS) blocks.push({ node: standings(bm.standings, vm, ink1, sRow)!, h: standingsHeight(nS, sRow) });
    if (none) blocks.push(none);
    if (strip) blocks.push(strip);
    if (table) blocks.push(table);
    if (mates) blocks.push(mates);
    if (tick) blocks.push(tick);
    if (slabInfo) blocks.push({ node: slab(bm.facts, ink1, bigSlab, slabH), h: slabH });
    if (bio) blocks.push({ node: bio.node, h: bio.h });
  }

  for (const b of blocks) b.node.props.style.flexShrink = 0;          // a block is never squeezed into its neighbour
  const content = box({ position: 'absolute', left: 30, top: 30, width: COL_W, height: COL_H - FOOT, flexDirection: 'column', gap }, ...blocks.map(b => b.node));
  return box({ width: W, height: H, position: 'relative', background: STOCK, overflow: 'hidden' },
    pic(boardSrc, 0, 0, W, H), content, footer(vm), svgPic(borderSvg(vm), 0, 0, W, H));
}

/**
 * The tier border at half weight (the back's margin is slim). The card-stock path in frameSvg is a full rectangle with
 * a rounded hole; it needs the even-odd rule to stay a frame. If kit's frameSvg already says so this is a no-op.
 */
function borderSvg(vm: VM): string {
  return frameSvg(vm.T, W, H, 0.5).replace(/(<path d="M0 0H[^"]*")( fill="#f2ead4")/, (m, a, b) => (/fill-rule/.test(m) ? m : `${a} fill-rule="evenodd"${b}`));
}

// ---------------------------------------------------------------------------------------------
// Rendering. Unsupported scripts never throw: if Satori rejects a string, the tree is rebuilt with every
// character the bundled fonts cannot carry removed, and rendered again.
// ---------------------------------------------------------------------------------------------
const CARRIED = /[\u0000-ɏḀ-ỿ -⃏←-⇿　-ヿ㐀-䶿一-鿿＀-￯]/;
function scrub(n: any): any {
  if (typeof n === 'string') return Array.from(n).filter(ch => CARRIED.test(ch)).join('');
  if (Array.isArray(n)) return n.map(scrub);
  if (n && typeof n === 'object') {
    const props = { ...n.props };
    if (props.children !== undefined) props.children = scrub(props.children);
    return { ...n, props };
  }
  return n;
}
async function toSvg(root: Node): Promise<string> {
  try { return await satori(root as any, { width: W, height: H, fonts: loadFonts() }); }
  catch { return satori(scrub(root), { width: W, height: H, fonts: loadFonts() }); }
}

export async function back(card: any, opts: BackOpts = {}): Promise<Buffer> {
  const svg = await toSvg(await backNode(card, opts));
  const img = sharp(Buffer.from(svg), { density: 144 }).resize(W, H, { kernel: 'lanczos3' });
  const q = opts.quality ?? 82;
  switch (opts.format ?? 'png') {
    case 'webp': return img.webp({ quality: q, effort: 4 }).toBuffer();
    case 'jpeg': return img.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    // Palette PNG: the back is flat inks on grey cardboard, so 256 colours lose nothing visible and the file stays small.
    default: return img.png({ palette: true, colours: 256, quality: 90, dither: 0.6, effort: 7, compressionLevel: 9 }).toBuffer();
  }
}
