/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5 Medium; Claude Opus 5.5
 * Date: 27-Nov-2026
 * 27-Nov-2026 (GPT-6.2 Sol / Codex): place the dated team strip next to the medal ledger below action art.
 * PURPOSE: Competitor card reverse. A solid paper header leads with the verified medal tally,
 *          tier and Kaggle rank. Dated standings use a rank-only strip. A medal ledger sits
 *          over the selected second picture or a tier-coloured backdrop. The row budget
 *          reserves enough height for wrapped names and the link note before placing rows.
 * SRP/DRY check: Pass — backModel.ts owns data selection and kit.ts owns fonts, medals and frames.
 */
import sharp from 'sharp';
import { FONT, ff, box, at, pic, svgPic, svgDoc, mix, MEDAL, fitNameLines, coinSvg, INK1, jpegUri, backBorderSvg, type Node, type Style } from './kit';
import { dayLabel, num, type VM } from './model';
import type { BackModel, MedalCareerRow } from './backModel';
import { W, H } from './zones';

const INK = '#15161d';
const COL = 690, MARGIN = 30, BOTTOM = H - MARGIN;
const PAPER = '#f8f3dc', PAPER_ALT = '#f1ead3', RULE = '#c7bfa7', MUTED = '#4f4a43';
const GAP = 10, INSET = 20;
const MEDAL_SLOT = 62;
const coin = (colour: string, diameter: number): Node =>
  box({ width: diameter, height: diameter, position: 'relative', flexShrink: 0 },
    svgPic(coinSvg(colour, diameter), 0, 0, diameter, diameter, { position: 'relative' }));
const bebas = (text: string, size: number, color: string, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.bebas), fontSize: size, color, letterSpacing: size * 0.06, lineHeight: 1, ...style }, text);
const mono = (text: string, size: number, color = INK, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.mono), fontWeight: weight, fontSize: size, color, lineHeight: 1, ...style }, text);
const cond = (text: string, size: number, color = INK, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.cond), fontWeight: weight, fontSize: size, color, lineHeight: 1, ...style }, text);
const panel = { background: PAPER, border: `3px solid ${INK}`, flexDirection: 'column' } as const;
const clip = (width: number): Style => ({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width });

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

/** Two blocks under the name plate: profile medals on the left, Kaggle tier and rank on the right. */
async function header(vm: VM, ink: string, height: number): Promise<Node> {
  const nameWidth = COL - 2 * INSET - 6;
  const fit = await fitNameLines(vm.name.toUpperCase(), FONT.slab, 400, nameWidth, 62,
    { max: 47, min: 32, twoLineMax: 28, twoLineMin: 20 });
  const handle = vm.handlePlatform === 'kaggle' ? vm.handle : vm.handleLine;
  const details = [handle, vm.joined ? `On Kaggle since ${vm.joined}` : null].filter(Boolean).join('  ·  ');
  const medals = vm.medals;
  const tier = vm.tierLine ?? (vm.overall ? 'KAGGLE RANK' : null);
  const recorded = vm.card.career?.asOf;
  const day = dayLabel(recorded);
  return box({ ...panel, width: COL, height },
    box({ height: 100, padding: `8px ${INSET}px`, justifyContent: 'center', flexDirection: 'column', borderBottom: `2px solid ${RULE}` },
      ...fit.lines.map(line => box({ fontFamily: ff(FONT.slab), fontSize: fit.size, color: INK, lineHeight: 1.04, whiteSpace: 'nowrap' }, line)),
      details ? cond(details, 21, MUTED, 500, { marginTop: 5, ...clip(nameWidth) }) : null),
    box({ flexGrow: 1, padding: `0 ${INSET}px`, alignItems: 'center' },
      medals ? box({ flexGrow: 1, alignItems: 'center', gap: 13 },
        ...(['gold', 'silver', 'bronze'] as const).map(colour => {
          const count = num(medals[colour]);
          return box({ alignItems: 'center', gap: 6 },
            coin(MEDAL[colour], 44), mono(count, count.length > 3 ? 32 : 47));
        })) : null,
      tier ? box({ flexDirection: 'column', justifyContent: 'center',
        ...(medals ? { minWidth: 205, paddingLeft: 16, borderLeft: `2px solid ${RULE}` } : {}) },
        bebas(tier, 31, ink),
        vm.overall ? box({ marginTop: 7, alignItems: 'baseline', gap: 8 },
          mono(vm.overall.rank, 24),
          vm.overall.outOf ? cond(`of ${vm.overall.outOf}`, 19, MUTED, 500) : null) : null) : null),
    day && (medals || vm.overall) ? cond(`Kaggle profile · ${day} ${recorded.slice(0, 4)}`, 16, MUTED, 500,
      { paddingLeft: INSET, paddingBottom: 7 }) : null);
}

async function medalRow(row: MedalCareerRow, rowH: number, index: number): Promise<Node> {
  const width = COL - 6 - INSET - MEDAL_SLOT;
  const fit = await fitNameLines(row.name, FONT.cond, 700, width, 50,
    { max: 29, min: 25, twoLineMax: 24, twoLineMin: 18 });
  const supporting = [row.of ? `of ${row.of}` : null, row.top ? `top ${row.top}` : null].filter(Boolean).join('  ·  ');
  return box({ height: rowH, flexShrink: 0, alignItems: 'center', paddingRight: INSET,
    borderBottom: `1px solid ${RULE}`, background: index % 2 ? PAPER_ALT : PAPER },
    box({ width: MEDAL_SLOT, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, coin(MEDAL[row.medal], 36)),
    box({ width, flexDirection: 'column', justifyContent: 'center' },
      cond(row.name, fit.size, INK, 700, { width, lineHeight: 1.04, lineClamp: 2 }),
      row.place ? box({ marginTop: 5, alignItems: 'baseline', gap: 8 },
        box({ width: 89, flexShrink: 0, justifyContent: 'flex-end' }, mono(`#${row.place}`, 18, MUTED, 500)),
        supporting ? cond(supporting, 19, MUTED, 500) : null) : null));
}

export async function ledgerNode({ vm, bm, second, blank }: LedgerInput): Promise<Node> {
  const ink = INK1[vm.T.key] ?? INK1.none;
  const hasArt = !!second;
  const headH = vm.medals || vm.overall ? 204 : vm.tierLine ? 152 : 104;
  const head = await header(vm, ink, headH);
  const standings = bm.standings.filter(row => row.rank).slice(0, 3);
  const STAND_H = 58, TITLE_H = 44, NOTE_H = 48, ROW_MIN = 73, ROW_MAX = 83;
  const standH = standings.length ? standings.length * STAND_H + 6 : 0;
  const headerEnd = MARGIN + headH + GAP;
  const recordTop = headerEnd + (standH ? standH + GAP : 0);

  const career = bm.career;
  // Reserve the footer before counting rows if the dated career evidence can't all fit.
  const rows = career?.rows ?? [];
  const titleH = rows.length ? TITLE_H : 0;
  const room = BOTTOM - recordTop - (hasArt ? 158 : 0) - titleH - 6;
  const medalTotal = career?.medalTotal ?? 0;
  const withoutNote = Math.min(rows.length, Math.floor(room / ROW_MIN));
  const visible = withoutNote < medalTotal ? Math.min(rows.length, Math.floor((room - NOTE_H) / ROW_MIN)) : withoutNote;
  const note = medalTotal > visible;
  const rowH = visible ? Math.min(ROW_MAX, Math.floor((room - (note ? NOTE_H : 0)) / visible)) : 0;
  const sheetH = career ? titleH + visible * rowH + (note ? NOTE_H : 0) + 6 : 0;
  const sheetTop = hasArt || !career ? BOTTOM - sheetH : recordTop;
  const lines = await Promise.all(rows.slice(0, visible).map((row, index) => medalRow(row, rowH, index)));

  const standTop = hasArt ? sheetTop - standH - GAP : headerEnd;
  const stand = standH ? at(MARGIN, standTop, COL, standH, panel,
    ...standings.map(row => {
      const team = row.sub?.split(' · ')[0];
      const detail = [team, row.evidence].filter(Boolean).join(' · ');
      return box({ height: STAND_H, flexShrink: 0, alignItems: 'center', background: PAPER_ALT,
        padding: `0 ${INSET}px`, borderBottom: `1px solid ${RULE}`, gap: 12 },
        box({ flexDirection: 'column', flexGrow: 1, minWidth: 0 },
          cond(row.title, 24, INK, 700, clip(COL - 175)),
          detail ? cond(detail, 17, MUTED, 500, { marginTop: 4, ...clip(COL - 145) }) : null),
        mono(row.rank!, 27, ink, 700, { marginLeft: 'auto' }));
    })) : null;

  const sheet = career ? at(MARGIN, sheetTop, COL, sheetH, { ...panel, overflow: 'hidden' },
    rows.length ? box({ height: TITLE_H, flexShrink: 0, background: ink, alignItems: 'center',
      paddingLeft: INSET, borderBottom: `2px solid ${INK}` },
      bebas('CAREER MEDALS', 27, '#fff')) : null,
    ...lines,
    note ? box({ height: NOTE_H, flexShrink: 0, alignItems: 'center', paddingLeft: INSET, background: PAPER },
      cond('More medal finishes on Kaggle', 22, INK)) : null) : null;

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
      const windowH = Math.max(200, (standH ? standTop : sheetTop) + 24);
      const fill = await sharp(second).rotate().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.45 }).jpeg({ quality: 80 }).toBuffer();
      const scene = await sharp(second).rotate().resize(W, windowH, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
      backdrop = await sharp(fill).composite([{ input: scene, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
    }
  }

  return box({ width: W, height: H, position: 'relative', background: '#000', overflow: 'hidden' },
    pic(jpegUri(backdrop ?? blank), 0, 0, W, H),
    at(MARGIN, MARGIN, COL, headH, {}, head),
    stand,
    sheet,
    svgPic(backBorderSvg(vm.T), 0, 0, W, H));
}
