/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 05-November-2026
 * 09-Nov-2026 (GPT-6 / Codex): document the competitor ledger footer rule.
 * PURPOSE: The LEDGER REVERSE for competitor cards (the Boss's rule, 5 November 2026). The back is a record sheet, not a second
 *          portrait: a solid sheet of green-grid ledger paper with a red margin, laid over the card's SECOND picture
 *          (backPicture: a team or action image) or, when there is no second picture, over a blank designed backdrop in the
 *          tier colours. It is never a repeat of the front.
 *          The career record takes as much of the card as it can. Rows grow with the room (up to a comfortable size), and a long
 *          career grows the sheet upward until only a strip of the picture shows. Trivia (vitals, bio, "did you know" facts,
 *          teammates) sits under the record on the same sheet. The card page carries its permanent share address.
 *          Row budget is arithmetic only: fixed blocks are summed, then the career rows get what is left.
 * SRP/DRY check: Pass. Layout only; data decisions are backModel.ts, vocabulary and fonts are kit.ts, the front is render.ts.
 *          Does not import back.ts (which delegates here), so there is no cycle.
 *
 * CHANGELOG
 * 05-Nov-2026 v3 (Claude Sonnet 5.5 Medium, Boss): much bigger type; no address or copyright footer; the margin column carries each row's medal coin (no MEDAL column); rows grow with the room.
 * 05-Nov-2026 v2 (Claude Sonnet 5.5 Medium): no card number and no tier medallion (Boss); the blank backdrop carries the initials.
 * 05-Nov-2026 v1 (Claude Sonnet 5.5 Medium): first version.
 */
import sharp from 'sharp';
import { FONT, ff, box, at, pic, svgPic, svgDoc, textWidth, frameSvg, medallionSvg, alpha, mix, MEDAL, fitNameLines, type Node, type Style } from './kit';
import { num, type VM } from './model';
import type { BackModel } from './backModel';
import { W, H } from './zones';

const INK = '#15161d';
const COL = 690, MARGIN = 30, BOTTOM = H - MARGIN;
const PAPER = '#f8f3dc', GRID = '#b9cdb2', RULE = '#5d82b4', MARGIN_RED = '#d2403f';
/** A medal coin for the margin (gold / silver / bronze). */
const coinSvg = (c: string) => svgDoc(40, 40, `<circle cx="20" cy="20" r="18" fill="${c}" stroke="#000" stroke-width="2.6"/><circle cx="20" cy="20" r="12.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.8"/><path d="M10 12 A13 13 0 0 1 22 6" stroke="#fff" stroke-opacity=".8" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
const coin = (c: string, d = 38): Node => box({ width: d, height: d, position: 'relative', flexShrink: 0 }, svgPic(coinSvg(c), 0, 0, d, d, { position: 'relative' }));
const HEADER_H = 112;
/** Tier colours darkened until they print on cream paper. */
const INK1: Record<string, string> = { Novice: '#1b7d38', Contributor: '#1d55bd', Expert: '#5a27bd', Master: '#b04800', Grandmaster: '#a8121b', none: '#4f596b', sponsor: '#16306e', team: '#0a766e' };
const MEDAL_WORD: Record<string, string> = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' };
const LEFT_PAD = 62;                         // the margin column: it carries each row's medal coin

const bebas = (text: string, size: number, color: string, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.bebas), fontSize: size, color, letterSpacing: size * 0.06, lineHeight: 1, ...style }, text);
const mono = (text: string, size: number, color = INK, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.mono), fontWeight: weight, fontSize: size, color, lineHeight: 1, letterSpacing: -0.3, ...style }, text);
const clip = (w: number): Style => ({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: w });
const dot = (c: string, d: number): Node => box({ width: d, height: d, borderRadius: d / 2, background: c, border: '2px solid #000' });
const jpegUri = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;

/** The tier border at half weight, as the rest of the backs draw it (even-odd so the middle stays open). */
export function borderSvg(vm: VM): string {
  return frameSvg(vm.T, W, H, 0.5).replace(/(<path d="M0 0H[^"]*")( fill="#f2ead4")/, (m, a, b) => (/fill-rule/.test(m) ? m : `${a} fill-rule="evenodd"${b}`));
}

/** Greedy line count for running text, measured with the real font (no guessing). */
async function lineCount(text: string, size: number, width: number, weight = 500): Promise<number> {
  let lines = 1, used = 0;
  const space = await textWidth(' ', FONT.cond, weight, size);
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = await textWidth(word, FONT.cond, weight, size);
    if (used > 0 && used + space + w > width) { lines++; used = w; } else used += (used ? space : 0) + w;
  }
  return lines;
}

/** Ledger paper: cream, a fine green grid, a red double margin line. One SVG per sheet height. */
function paperSvg(h: number): string {
  const defs = `<pattern id="g" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0H0V15" fill="none" stroke="${GRID}" stroke-width="1"/></pattern>`;
  return svgDoc(COL, h, `<rect width="${COL}" height="${h}" fill="${PAPER}"/><rect width="${COL}" height="${h}" fill="url(#g)" opacity=".75"/>`
    + `<rect x="${LEFT_PAD - 3}" y="0" width="2.4" height="${h}" fill="${MARGIN_RED}" opacity=".85"/><rect x="${LEFT_PAD + 1}" y="0" width="1.4" height="${h}" fill="${MARGIN_RED}" opacity=".85"/>`, defs);
}

/** The blank backdrop for a card with no second picture: tier-dark graph paper with a big faint medallion. Not a repeat of the front. */
export async function blankBackdrop(vm: VM): Promise<Buffer> {
  const T = vm.T, dark = mix(T.deep, '#05060b', 0.55);
  const defs = `<pattern id="s" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="${T.main}" stroke-opacity=".22" stroke-width="1"/></pattern>
    <pattern id="b" width="125" height="125" patternUnits="userSpaceOnUse"><path d="M125 0H0V125" fill="none" stroke="${T.main}" stroke-opacity=".38" stroke-width="1.6"/></pattern>
    <radialGradient id="v" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${T.main}" stop-opacity=".30"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>`;
  const svg = svgDoc(W, H, `<rect width="${W}" height="${H}" fill="${dark}"/><rect width="${W}" height="${H}" fill="url(#s)"/><rect width="${W}" height="${H}" fill="url(#b)"/><rect width="${W}" height="${H}" fill="url(#v)"/>`, defs);
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

export interface LedgerInput { vm: VM; bm: BackModel; /** the card's second picture, as file bytes (null: use the blank design) */ second: Buffer | null; blank: Buffer }

/** Headline strip: number box, name, type and tier chips, handle. Solid paper, clearly a label stuck on the picture. */
async function header(vm: VM, ink1: string): Promise<Node> {
  const nameW = COL - 40;
  const fit = await fitNameLines(vm.name.toUpperCase(), FONT.slab, 400, nameW, 58, { max: 40, min: 24, twoLineMax: 28, twoLineMin: 18 });
  const platform = vm.handlePlatform ? (vm.handlePlatform === 'x' ? 'X' : vm.handlePlatform[0].toUpperCase() + vm.handlePlatform.slice(1)) : '';
  return box({ width: COL, height: HEADER_H, background: PAPER, border: `3px solid ${INK}`, boxShadow: '6px 6px 0 rgba(0,0,0,0.5)', padding: '10px 18px', alignItems: 'center' },
    box({ flexGrow: 1, flexDirection: 'column', justifyContent: 'center', paddingLeft: 6, minWidth: 0 },
      ...fit.lines.map(l => box({ fontFamily: ff(FONT.slab), fontSize: fit.size, color: INK, lineHeight: 1.04, whiteSpace: 'nowrap' }, l)),
      box({ marginTop: 8, alignItems: 'center' },
        box({ background: ink1, padding: '3px 10px 2px 10px', border: `2px solid ${INK}` }, bebas(vm.typeLabel, 21, '#fff', { letterSpacing: 2.4 })),
        vm.tierLine ? bebas(vm.tierLine, 25, ink1, { marginLeft: 10, letterSpacing: 2.4 }) : null,
        vm.handle ? box({ marginLeft: 14, alignItems: 'baseline' }, mono(vm.handle, 20), platform ? mono(`on ${platform}`, 16, '#4a4a55', 500, { marginLeft: 7 }) : null) : null)));
}

const colHead = (t: string, w: number, ink1: string): Node => box({ width: w, justifyContent: 'flex-end', paddingRight: 8 }, bebas(t, 17, ink1, { letterSpacing: 1.6 }));
const numCell = (text: string | null, w: number, size: number, color: string, weight = 700): Node =>
  box({ width: w, justifyContent: 'flex-end', alignItems: 'center', paddingRight: 8 }, text ? mono(text, size, color, weight) : null);

export async function ledgerNode({ vm, bm, second, blank }: LedgerInput): Promise<Node> {
  const ink1 = INK1[vm.T.key] ?? INK1.none;
  const hasArt = !!second;
  const head = await header(vm, ink1);
  const career = bm.career;

  // ---- fixed blocks, in px. Type is big on purpose: a card is read at thumbnail size (baseball-card back rule). ----
  const TITLE_H = 42, COLHEAD_H = 32, TOTAL_H = 54, NOTE_H = 28, PAD_BOTTOM = 8;
  const innerW = COL - LEFT_PAD - 12 - 12;
  // trivia: vitals pairs, then bio, facts and teammates as short paragraphs
  const vitals = bm.vitals.filter(v => v.v);
  const VITAL_H = 54;
  // a long value (a club or place name) gets the whole width; short ones pair up. Rows are counted by greedy packing.
  const isWide = (v: { v: string }) => v.v.length > 19;
  let vitalRows = 0, used = 0;
  for (const v of vitals) { const u = isWide(v) ? 2 : 1; if (used + u > 2) { vitalRows++; used = 0; } used += u; if (used === 2) { vitalRows++; used = 0; } }
  if (used > 0) vitalRows++;
  const vitalsH = vitals.length ? vitalRows * VITAL_H + 12 : 0;
  const paras: string[] = [];
  if (bm.bio) paras.push(bm.bio);
  for (const f of bm.facts) paras.push(f);
  for (const g of bm.mates) paras.push(`WITH ${g.team || g.contest}: ${g.mates.map(m => m.name).join(', ')}`);
  const sheetMax = BOTTOM - (hasArt ? MARGIN + HEADER_H + 12 + 230 : MARGIN + HEADER_H + 12);
  const NOTE_SIZE = 19, NOTE_LH = 1.2;
  let notesLines = 0; const notes: { text: string; lines: number }[] = [];
  // A long career is the point of the card: it gets the room, the trivia shrinks to a couple of lines.
  const longCareer = (career?.rows.length ?? 0) > 8;
  const lineBudget = longCareer ? 2 : hasArt ? 4 : 10;
  for (const text of paras) {
    const lines = Math.min(3, await lineCount(text, NOTE_SIZE, innerW - 14));
    if (notesLines + lines > lineBudget) break;
    notes.push({ text, lines }); notesLines += lines;
  }
  const notesH = notes.length ? 36 + notesLines * Math.ceil(NOTE_SIZE * NOTE_LH) + notes.length * 8 : 0;
  const bareH = !career ? 110 : 0;
  // current-season standings (only real measured values), the live part of the record: compact rows above the career table
  const measured = bm.standings.filter(r => r.rank || r.score || r.subs).slice(0, 3);
  const STAND_ROW = 46, standH = measured.length ? TITLE_H + 28 + measured.length * STAND_ROW : 0;

  // ---- the career rows take what is left ----
  const fixed = TITLE_H + PAD_BOTTOM + vitalsH + notesH + standH + (career ? COLHEAD_H + TOTAL_H : bareH);
  let n = 0, rowH = 0, note: string | null = null;
  if (career) {
    const avail = sheetMax - fixed;
    const ROW_MIN = 44, ROW_MAX = hasArt ? 62 : 72;
    n = Math.min(career.rows.length, Math.max(1, Math.floor(avail / ROW_MIN)));
    if (n < career.completed) { n = Math.min(career.rows.length, Math.max(1, Math.floor((avail - NOTE_H) / ROW_MIN))); }
    if (n < career.completed) note = `${num(career.completed - n)} MORE CONTEST${career.completed - n === 1 ? '' : 'S'} ON THE KAGGLE PROFILE`;
    rowH = Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor((avail - (note ? NOTE_H : 0)) / n)));
  }
  const sheetH = fixed + (career ? n * rowH + (note ? NOTE_H : 0) : 0);
  const sheetTop = BOTTOM - sheetH;

  // ---- sheet pieces: no medal column; the margin carries each row's medal coin ----
  const cw = { place: 92, of: 100, top: 88 };
  const nameW = innerW - cw.place - cw.of - cw.top;
  const big = rowH >= 56;
  const rows: Node[] = career ? career.rows.slice(0, n).map(r => box({ height: rowH, flexShrink: 0, alignItems: 'center', paddingRight: 12, borderBottom: `1.5px solid ${alpha(RULE, 0.55)}` },
    box({ width: LEFT_PAD, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, r.medal ? coin(MEDAL[r.medal], big ? 42 : 38) : null),
    box({ width: nameW, paddingLeft: 10, paddingRight: 8, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: big ? 23 : 20, color: INK, lineHeight: 1.08, lineClamp: 2 }, r.name),
    numCell('#' + r.place, cw.place, big ? 28 : 24, '#2453a6'), numCell(r.of, cw.of, big ? 22 : 20, '#3d3d46', 500), numCell(r.top, cw.top, big ? 24 : 21, ink1))) : [];

  const sheet = box({ position: 'absolute', left: MARGIN, top: sheetTop, width: COL, height: sheetH, flexDirection: 'column', border: `3px solid ${INK}`, boxShadow: '7px 7px 0 rgba(0,0,0,0.5)', overflow: 'hidden', background: PAPER },
    svgPic(paperSvg(sheetH), 0, 0, COL, sheetH),
    measured.length ? box({ flexDirection: 'column', flexShrink: 0, height: standH },
      box({ height: TITLE_H, flexShrink: 0, background: ink1, alignItems: 'center', padding: '0 14px', borderBottom: `3px solid ${INK}` }, bebas(`${vm.season} SEASON · KAGGLE COMPETITIONS STANDINGS`, 25, '#fff', { letterSpacing: 2 })),
      box({ height: 28, flexShrink: 0, alignItems: 'center', paddingLeft: LEFT_PAD, paddingRight: 12, borderBottom: `2px solid ${INK}` },
        box({ flexGrow: 1 }, bebas('CONTEST · TEAM', 17, ink1, { letterSpacing: 1.8 })), colHead('RANK', 110, ink1), colHead('SCORE', 124, ink1)),
      ...measured.map(r => box({ height: STAND_ROW, flexShrink: 0, alignItems: 'center', paddingLeft: LEFT_PAD, paddingRight: 12, borderBottom: `1.5px solid ${alpha(RULE, 0.55)}` },
        box({ flexGrow: 1, flexDirection: 'column', minWidth: 0 }, bebas(r.title, 22, INK, { letterSpacing: 1, ...clip(innerW - 250) }),
          r.sub || r.note ? box({ marginTop: 3, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 15, color: ink1, ...clip(innerW - 250) }, [r.sub, r.note].filter(Boolean).join(' · ')) : null),
        numCell(r.rank, 110, 26, '#2453a6'), numCell(r.score, 124, 23, '#17703f', 600)))) : null,
    box({ height: TITLE_H, flexShrink: 0, background: ink1, alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `3px solid ${INK}` },
      bebas(career ? 'KAGGLE COMPETITIONS · CAREER' : 'KAGGLE COMPETITIONS · RECORD', 26, '#fff', { letterSpacing: 2 }), career ? bebas('BEST FINISHES FIRST', 17, '#fff', { opacity: 0.95, letterSpacing: 1.4 }) : null),
    career ? box({ height: COLHEAD_H, flexShrink: 0, alignItems: 'center', paddingRight: 12, borderBottom: `2px solid ${INK}` },
      box({ width: LEFT_PAD }), box({ width: nameW, paddingLeft: 10 }, bebas('COMPETITION', 17, ink1, { letterSpacing: 1.8 })), colHead('PLACE', cw.place, ink1), colHead('FIELD', cw.of, ink1), colHead('TOP %', cw.top, ink1)) : null,
    ...rows,
    note ? box({ height: NOTE_H, flexShrink: 0, alignItems: 'center', paddingLeft: LEFT_PAD, borderBottom: `1.5px solid ${alpha(RULE, 0.55)}` }, bebas(note, 17, ink1, { letterSpacing: 1.6 })) : null,
    career ? box({ height: TOTAL_H, flexShrink: 0, alignItems: 'center', justifyContent: 'space-between', paddingLeft: LEFT_PAD + 14, paddingRight: 14, background: INK },
      box({ alignItems: 'baseline' }, bebas('CAREER', 28, '#fff', { letterSpacing: 2.4 }), bebas(`${num(career.completed)} CONTEST${career.completed === 1 ? '' : 'S'}`, 19, '#c8cbd6', { marginLeft: 10, letterSpacing: 1.4 })),
      box({ alignItems: 'center' }, career.bestFinish ? bebas(`BEST ${career.bestFinish}`, 23, '#ffd24a', { letterSpacing: 1.2 }) : null,
        career.medals ? box({ alignItems: 'center', marginLeft: 14 }, ...(['gold', 'silver', 'bronze'] as const).map(k => box({ alignItems: 'center', marginLeft: 10 }, coin(MEDAL[k], 28), mono(String(career.medals![k]), 22, '#fff', 700, { marginLeft: 5 })))) : null)) : null,
    !career ? box({ height: bareH, flexShrink: 0, flexDirection: 'column', justifyContent: 'center', paddingLeft: LEFT_PAD }, bebas('STANDINGS AT KAGGLE', 46, ink1, { letterSpacing: 3 }), vm.handleLine ? mono(vm.handleLine, 20, INK, 700, { marginTop: 8 }) : null) : null,
    vitals.length ? box({ flexShrink: 0, flexWrap: 'wrap', paddingLeft: LEFT_PAD + 14, paddingRight: 8, paddingTop: 8, height: vitalsH, borderTop: `2px solid ${INK}` },
      ...vitals.map(v => box({ width: isWide(v) ? innerW - 8 : Math.floor((innerW - 8) / 2), height: VITAL_H, flexDirection: 'column', justifyContent: 'center', paddingRight: 10 },
        bebas(v.k, 17, ink1, { letterSpacing: 1.6 }), box({ marginTop: 4, fontFamily: ff(FONT.mono), fontWeight: 700, fontSize: 19, color: INK, lineHeight: 1.2, ...clip((isWide(v) ? innerW - 8 : Math.floor((innerW - 8) / 2)) - 10) }, v.v)))) : null,
    notes.length ? box({ flexShrink: 0, flexDirection: 'column', paddingLeft: LEFT_PAD + 14, paddingRight: 14, paddingTop: 8, height: notesH, borderTop: `2px solid ${INK}` },
      bebas('FROM THE FILE', 20, ink1, { letterSpacing: 3, marginBottom: 6 }),
      ...notes.map(p => box({ display: 'block', marginBottom: 8, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: NOTE_SIZE, lineHeight: NOTE_LH, color: INK, lineClamp: p.lines }, p.text))) : null);

  // ---- the backdrop: the second picture where it can be seen, else the blank design ----
  let backdrop: Buffer | null = null;
  if (second) {
    const meta = await sharp(second).metadata();
    const ratio = (meta.width ?? 1) / (meta.height ?? 1);
    if (ratio <= 0.9) {
      // a portrait picture stays whole on the card (the sheet and the name label sit over it); other shapes sit on a blurred copy
      if (Math.abs(ratio - W / H) < 0.005) backdrop = await sharp(second).resize(W, H, { fit: 'contain', background: '#c9c5b8' }).jpeg({ quality: 90 }).toBuffer();
      else {
        const fill = await sharp(second).rotate().resize(W, H, { fit: 'cover' }).blur(24).modulate({ brightness: 0.6 }).jpeg({ quality: 80 }).toBuffer();
        const whole = await sharp(second).rotate().resize(W, H, { fit: 'inside' }).toBuffer();
        backdrop = await sharp(fill).composite([{ input: whole, gravity: 'centre' }]).jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      // a wide picture (a scene of the team) fills the space above the sheet edge to edge, cropped toward its subjects, so it is SEEN
      const windowH = Math.max(200, sheetTop + 24);
      const fill = await sharp(second).rotate().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.45 }).jpeg({ quality: 80 }).toBuffer();
      const scene = await sharp(second).rotate().resize(W, windowH, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
      backdrop = await sharp(fill).composite([{ input: scene, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
    }
  }

  // No second picture: the blank design carries one big faint tier medallion in the free space, so it reads as a design, not a hole.
  const freeTop = MARGIN + HEADER_H + 12, freeH = sheetTop - 28 - freeTop;
  const medD = Math.min(380, freeH - 20), mx = Math.round((W - medD) / 2), my = Math.round(freeTop + (freeH - medD) / 2);
    const initials = vm.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => Array.from(w)[0]).join('').toUpperCase();
  const emblem = !hasArt && medD >= 160 && initials ? [
    at(0, my, W, medD, { alignItems: 'center', justifyContent: 'center', opacity: 0.3 },
      box({ fontFamily: ff(FONT.slab), fontSize: Math.round(medD * 0.5), color: vm.T.light, lineHeight: 1, letterSpacing: 4 }, initials)),
  ] : [];
  return box({ width: W, height: H, position: 'relative', background: '#000', overflow: 'hidden' },
    pic(jpegUri(hasArt ? backdrop! : blank), 0, 0, W, H),
    ...emblem,
    at(MARGIN, MARGIN, COL, HEADER_H, {}, head),
    sheet,
    svgPic(borderSvg(vm), 0, 0, W, H));
}
