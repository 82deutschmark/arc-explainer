/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5 Medium; Claude Opus 5.5; Claude Opus 5.5 Medium
 * Date: 27-Nov-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): redrawn for density after the Boss marked Franzen's reverse down for spacing,
 *          centring and wasted room. The header's medal coins and counts are larger and spread evenly across their block;
 *          the tier prints as EXPERT / MASTER / GRANDMASTER (COMPETITOR below Expert), never "KAGGLE EXPERT"; the overall
 *          rank is labelled COMPETITIONS RANK; the profile date sits at a readable size on the handle line, with the
 *          organisation and town on a second line. Standings are side-by-side rank tiles under one STANDINGS bar: the
 *          contest still running leads, every tile names its team (a solo team too), and an open contest with no reading yet
 *          says ENTERED instead of vanishing. Medal rows are one compact line each (name, then place and top share at the
 *          right). The picture shows in the window left between the standings and the medal sheet, so it is smaller and the
 *          numbers get the room. Secondary text is no smaller than 19 px so it reads at the card page's 420 px width. A
 *          long team name in a narrow tile (a Japanese name) gets two fitted lines and, if needed, a smaller rank beside it.
 * 27-Nov-2026 (GPT-6.2 Sol / Codex): place the dated team strip next to the medal ledger below action art.
 * PURPOSE: Competitor card reverse. A solid paper header leads with the verified medal tally, tier and overall
 *          competitions rank; dated standings follow as rank-only tiles; a medal ledger sits at the foot. Between them the
 *          card's second picture shows through (or a tier-coloured blank backdrop). The row budget is worked out before
 *          anything is placed, so nothing overflows and the window keeps a minimum height when there is a picture.
 * SRP/DRY check: Pass — backModel.ts owns data selection and ordering, model.ts the wording, kit.ts fonts, medals and frames.
 */
import sharp from 'sharp';
import { FONT, ff, box, at, pic, svgPic, svgDoc, mix, MEDAL, fitNameLines, fitOneLine, textWidth, coinSvg, INK1, jpegUri, backBorderSvg, type Node, type Style } from './kit';
import { dayLabel, num, type VM } from './model';
import type { BackModel, MedalCareerRow, StandingRow } from './backModel';
import { W, H } from './zones';

const INK = '#15161d';
const COL = 690, MARGIN = 30, BOTTOM = H - MARGIN;
const PAPER = '#f8f3dc', PAPER_ALT = '#f1ead3', RULE = '#c7bfa7', MUTED = '#4f4a43';
const GAP = 12, INSET = 22, BORDER = 3;
const INNER = COL - 2 * BORDER;
/** Heights of the fixed bands, in card pixels (the card is shown at about 0.56 scale on its page). */
const BAR_H = 40, STATS_H = 128, TILE_H = 108, TILE_DATED_H = 132, NOTE_H = 40;
/** A medal row grows into spare room up to ROW_MAX; the picture window never shrinks below PIC_MIN. */
const ROW_MIN = 56, ROW_MAX = 78, PIC_MIN = 170;
const MEDAL_SLOT = 60, PLACE_W = 176;

const coin = (colour: string, diameter: number): Node =>
  box({ width: diameter, height: diameter, position: 'relative', flexShrink: 0 },
    svgPic(coinSvg(colour, diameter), 0, 0, diameter, diameter, { position: 'relative' }));
const bebas = (text: string, size: number, color: string, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.bebas), fontSize: size, color, letterSpacing: size * 0.05, lineHeight: 1, ...style }, text);
const mono = (text: string, size: number, color = INK, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.mono), fontWeight: weight, fontSize: size, color, lineHeight: 1, ...style }, text);
const cond = (text: string, size: number, color = INK, weight = 700, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.cond), fontWeight: weight, fontSize: size, color, lineHeight: 1.05, ...style }, text);
const panel = { background: PAPER, border: `${BORDER}px solid ${INK}`, flexDirection: 'column' } as const;
const clip = (width: number): Style => ({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width });
/** A coloured title bar ("STANDINGS", "CAREER MEDALS") with an optional right-hand note. */
const titleBar = (title: string, ink: string, right: string | null = null): Node =>
  box({ height: BAR_H, flexShrink: 0, background: ink, alignItems: 'center', justifyContent: 'space-between',
    padding: `0 ${INSET}px`, borderBottom: `2px solid ${INK}` },
    bebas(title, 27, '#fff'),
    right ? cond(right, 20, '#fff', 600) : null);
/** "Mainz, Rhineland-Palatinate, Germany" -> "Mainz, Germany": the town and the country are what a card needs. */
const shortPlace = (place: string | null) => {
  const parts = (place ?? '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ') || null;
};

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

// ---------------------------------------------------------------------------------------------------------------
// Header: name plate, handle and profile date, then the stats row (medal coins | tier word and labelled rank)
// ---------------------------------------------------------------------------------------------------------------
interface Header { node: Node; height: number }
async function header(vm: VM, ink: string): Promise<Header> {
  const width = INNER - 2 * INSET;
  const fit = await fitNameLines(vm.name.toUpperCase(), FONT.slab, 400, width, 104,
    { max: 52, min: 36, twoLineMax: 34, twoLineMin: 24 });
  const nameH = Math.ceil(fit.lines.length * fit.size * 1.04);
  const medals = vm.medals, overall = vm.overall;
  const stats = !!(medals || overall || vm.tierLine);
  // Below Expert (or with no tier at all) the card's title is plain COMPETITOR; with no stats row it leads the handle line.
  const title = vm.tierLine ?? 'COMPETITOR';
  const handle = vm.handlePlatform === 'kaggle' ? vm.handle : vm.handleLine;
  const line1 = [stats ? null : 'Competitor', handle, vm.joined ? `On Kaggle since ${vm.joined}` : null].filter(Boolean).join('  ·  ');
  const line2 = [vm.organisation, shortPlace(vm.location)].filter(Boolean).join('  ·  ');
  const recorded = vm.card.career?.asOf, day = dayLabel(recorded);
  const dated = day && (medals || overall) ? `Kaggle profile · ${day} ${recorded.slice(0, 4)}` : null;
  const datedW = dated ? Math.ceil(await textWidth(dated, FONT.cond, 600, 21)) + 4 : 0;
  const plateH = 14 + nameH + 8 + 24 + (line2 ? 28 : 0) + 12;

  const plate = box({ height: plateH, flexShrink: 0, padding: `14px ${INSET}px 12px`, flexDirection: 'column', borderBottom: stats ? `2px solid ${RULE}` : 'none' },
    ...fit.lines.map(line => box({ fontFamily: ff(FONT.slab), fontSize: fit.size, color: INK, lineHeight: 1.04, whiteSpace: 'nowrap' }, line)),
    box({ marginTop: 8, height: 24, alignItems: 'center', justifyContent: 'space-between' },
      cond(line1, 22, MUTED, 600, clip(width - datedW - 12)),
      dated ? cond(dated, 21, MUTED, 600, { flexShrink: 0 }) : null),
    line2 ? cond(line2, 22, MUTED, 600, { marginTop: 4, ...clip(width) }) : null);

  let statsRow: Node | null = null;
  if (stats) {
    // The tier block is a fixed column beside the coins; alone (no medals) it spans the row.
    const tierW = medals ? 300 : INNER;
    const tierInner = tierW - INSET - (medals ? 20 : INSET);
    const tierSize = await fitOneLine(title, FONT.bebas, 400, tierInner, 54, 32, 54 * 0.05);
    const label = overall?.best && overall.best !== overall.rank ? `COMPETITIONS RANK · BEST ${overall.best}` : 'COMPETITIONS RANK';
    const labelFits = (await textWidth(label, FONT.bebas, 400, 21, 21 * 0.05)) <= tierInner;
    const tierBlock = box({ width: tierW, flexShrink: 0, height: STATS_H, flexDirection: 'column', justifyContent: 'center',
      paddingLeft: medals ? 20 : INSET, paddingRight: INSET, ...(medals ? { borderLeft: `2px solid ${RULE}` } : {}) },
      bebas(title, tierSize, ink),
      overall ? bebas(labelFits ? label : 'COMPETITIONS RANK', 21, MUTED, { marginTop: 8 }) : null,
      overall ? box({ marginTop: 5, alignItems: 'baseline', gap: 8 },
        mono(overall.rank, 32),
        overall.outOf ? cond(`of ${overall.outOf}`, 22, MUTED, 600) : null) : null);
    // Coins and counts shrink together when a count runs to two or more digits, so the three groups never touch.
    const digits = medals ? Math.max(...(['gold', 'silver', 'bronze'] as const).map(colour => num(medals[colour]).length)) : 1;
    const [coinD, countSize] = digits >= 3 ? [44, 40] : digits === 2 ? [50, 50] : [60, 58];
    const coins = medals ? box({ flexGrow: 1, height: STATS_H, alignItems: 'center', justifyContent: 'space-evenly', padding: '0 8px' },
      ...(['gold', 'silver', 'bronze'] as const).map(colour =>
        box({ alignItems: 'center', gap: 7 }, coin(MEDAL[colour], coinD), mono(num(medals[colour]), countSize))))
      : null;
    statsRow = box({ height: STATS_H, flexShrink: 0, alignItems: 'center' }, coins, tierBlock);
  }
  const height = plateH + (stats ? STATS_H : 0) + 2 * BORDER;
  return { node: box({ ...panel, width: COL, height }, plate, statsRow), height };
}

// ---------------------------------------------------------------------------------------------------------------
// Standings: rank tiles side by side under one bar; the open contest leads (backModel orders them)
// ---------------------------------------------------------------------------------------------------------------
/** What a tile prints in its rank slot: the rank, or ENTERED for an open contest with no reading yet. */
async function rankSlot(row: StandingRow, ink: string, size: number): Promise<{ node: Node; width: number }> {
  if (row.rank) return { node: mono(row.rank, size, ink), width: Math.ceil(await textWidth(row.rank, FONT.mono, 700, size)) };
  const entered = Math.round(size * 0.72);
  return { node: bebas('ENTERED', entered, ink), width: Math.ceil(await textWidth('ENTERED', FONT.bebas, 400, entered, entered * 0.05)) };
}
/** The contest's full title when it reads at 21 px or more in `inner`, else its short name ("ARC-AGI-3"). */
async function contestName(row: StandingRow, inner: number, max: number): Promise<{ name: string; size: number }> {
  const full = await fitOneLine(row.title, FONT.bebas, 400, inner, max, 21, max * 0.05);
  if ((await textWidth(row.title, FONT.bebas, 400, full, full * 0.05)) <= inner) return { name: row.title, size: full };
  return { name: row.short, size: await fitOneLine(row.short, FONT.bebas, 400, inner, max, 19, max * 0.05) };
}

/**
 * A team name in at most two lines of `width`: one line from 22 px down to 19, else two lines split at a space or dot, else
 * (an unbroken Japanese or Chinese name, which Satori would wrap to three lines) two halves split between characters.
 */
async function teamLines(team: string, width: number): Promise<{ size: number; lines: string[] }> {
  const fit = await fitNameLines(team, FONT.cond, 700, width, 50, { max: 22, min: 19, twoLineMax: 22, twoLineMin: 16 }, 1.08);
  // A name with spaces stays one string (it wraps at its spaces, and the name is still searchable as written).
  if (fit.lines.length === 2) return { size: fit.size, lines: [team] };
  if (fit.size >= 16) return fit;
  const chars = Array.from(team), half = Math.ceil(chars.length / 2);
  const lines = [chars.slice(0, half).join(''), chars.slice(half).join('')];
  const size = await fitOneLine(lines[0], FONT.cond, 700, width, 22, 14);
  return { size, lines };
}

/** One tile of several: contest on top, then the rank beside the team name, then (only when dates differ) the date. */
async function standingTile(row: StandingRow, width: number, ink: string, dated: boolean, last: boolean): Promise<Node> {
  const inner = width - 28;
  const { name, size } = await contestName(row, inner, 27);
  // A long team name (a Japanese name runs wide) gets room from a smaller rank before its own letters drop below 18 px.
  let rank = await rankSlot(row, ink, row.rank && row.rank.length > 5 ? 38 : 50);
  let teamW = Math.max(60, inner - rank.width - 12);
  let team = row.team ? await teamLines(row.team, teamW) : null;
  if (team && team.size < 18 && row.rank && row.rank.length <= 5) {
    rank = await rankSlot(row, ink, 38);
    teamW = Math.max(60, inner - rank.width - 12);
    team = await teamLines(row.team!, teamW);
  }
  return box({ width, height: '100%', flexShrink: 0, flexDirection: 'column', justifyContent: 'center', padding: '0 14px',
    background: PAPER, ...(last ? {} : { borderRight: `2px solid ${RULE}` }) },
    bebas(name, size, INK, clip(inner)),
    box({ marginTop: 8, alignItems: 'center', gap: 12 },
      rank.node,
      team ? box({ width: teamW, flexDirection: 'column' }, ...team.lines.map(line =>
        cond(line, team.size, INK, 700, { width: teamW, lineHeight: 1.08, overflow: 'hidden', ...(team.lines.length > 1 ? { whiteSpace: 'nowrap' } : {}) }))) : null),
    dated && row.rank && row.evidence ? cond(row.evidence, 19, MUTED, 600, { marginTop: 6, ...clip(inner) }) : null);
}

/** A single contest gets the whole width: contest and team on the left, the rank large on the right. */
async function standingWide(row: StandingRow, ink: string, dated: boolean): Promise<Node> {
  const rank = await rankSlot(row, ink, 60);
  const inner = INNER - 2 * INSET - rank.width - 20;
  const { name, size } = await contestName(row, inner, 30);
  return box({ width: INNER, height: '100%', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${INSET}px`, background: PAPER },
    box({ width: inner, flexDirection: 'column', justifyContent: 'center' },
      bebas(name, size, INK, clip(inner)),
      row.team ? cond(row.team, 24, INK, 700, { marginTop: 8, ...clip(inner) }) : null,
      dated && row.rank && row.evidence ? cond(row.evidence, 19, MUTED, 600, { marginTop: 6, ...clip(inner) }) : null),
    rank.node);
}

async function standingsPanel(rows: StandingRow[], ink: string): Promise<Header | null> {
  if (!rows.length) return null;
  // One date in the bar when every ranked reading shares it; otherwise each ranked tile carries its own. An ENTERED tile
  // has no reading to date. With no ranked reading at all the bar says where the standings are (Kaggle's board).
  const ranked = rows.filter(row => row.rank);
  const shared = !ranked.length ? rows[0].evidence : ranked.every(row => row.evidence === ranked[0].evidence) ? ranked[0].evidence : null;
  const dated = !shared && ranked.length > 0;
  const tileW = Math.floor(INNER / rows.length);
  const tiles = rows.length === 1 ? [await standingWide(rows[0], ink, dated)] : await Promise.all(rows.map((row, index) =>
    standingTile(row, index === rows.length - 1 ? INNER - tileW * (rows.length - 1) : tileW, ink, dated, index === rows.length - 1)));
  const tileH = rows.length === 1 ? (dated ? TILE_H + 8 : TILE_H - 8) : dated ? TILE_DATED_H : TILE_H;
  const height = BAR_H + tileH + 2 * BORDER;
  return { height, node: box({ ...panel, width: COL, height, overflow: 'hidden' },
    titleBar('STANDINGS', ink, shared),
    box({ height: tileH, flexShrink: 0 }, ...tiles)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Career medals: one compact row per medal finish, gold first (backModel orders them)
// ---------------------------------------------------------------------------------------------------------------
/** Kaggle titles use " - " as a separator: a second line never starts with the dash ("Olympiad -" / "Progress Prize 2"). */
const keepDashUp = (lines: string[]) => lines.length === 2 && /^[-\u2013\u2014]\s/.test(lines[1])
  ? [`${lines[0]} ${lines[1][0]}`, lines[1].slice(2)] : lines;

async function medalRow(row: MedalCareerRow, rowH: number, index: number): Promise<Node> {
  const width = INNER - MEDAL_SLOT - PLACE_W - INSET;
  const big = rowH >= 66;
  const fit = await fitNameLines(row.name, FONT.cond, 700, width, rowH - 8,
    // One line only a little below the row's size (so the sheet's names stay one size), else two lines.
    { max: big ? 29 : 25, min: big ? 25 : 22, twoLineMax: big ? 25 : 22, twoLineMin: 18 }, 1.06);
  return box({ height: rowH, flexShrink: 0, alignItems: 'center', paddingRight: INSET,
    borderBottom: `1px solid ${RULE}`, background: index % 2 ? PAPER_ALT : PAPER },
    box({ width: MEDAL_SLOT, flexShrink: 0, justifyContent: 'center' }, coin(MEDAL[row.medal], big ? 42 : 34)),
    box({ width, flexShrink: 0, flexDirection: 'column', justifyContent: 'center' },
      ...keepDashUp(fit.lines).map(line => cond(line, fit.size, INK, 700, { lineHeight: 1.06, whiteSpace: 'nowrap', overflow: 'hidden' }))),
    row.place ? box({ width: PLACE_W, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' },
      box({ alignItems: 'baseline', gap: 6 },
        mono(`#${row.place}`, big ? 28 : 24),
        row.of ? cond(`of ${row.of}`, 20, MUTED, 600) : null),
      row.top ? cond(`top ${row.top}`, 19, MUTED, 600, { marginTop: 4 }) : null) : null);
}

export async function ledgerNode({ vm, bm, second, blank }: LedgerInput): Promise<Node> {
  const ink = INK1[vm.T.key] ?? INK1.none;
  const head = await header(vm, ink);
  // Rank-only strips: a ranked reading, or an entry in a contest still open (it reads ENTERED until the board has it).
  const shown = bm.standings.filter(row => row.rank || (row.open && row.team)).slice(0, 3);
  const stand = await standingsPanel(shown, ink);

  // ---- the row budget: everything below the standings, less the picture window's minimum when there is a picture ----
  const top = MARGIN + head.height + GAP + (stand ? stand.height + GAP : 0);
  const career = bm.career, rows = career?.rows ?? [];
  const room = BOTTOM - top - (second ? PIC_MIN + GAP : 0) - (rows.length ? BAR_H : 0) - 2 * BORDER;
  const medalTotal = career?.medalTotal ?? 0;
  const fitAll = Math.min(rows.length, Math.floor(room / ROW_MIN));
  // Reserve the note's height before counting rows when the dated medal finishes cannot all be printed.
  const visible = fitAll < medalTotal ? Math.max(0, Math.min(rows.length, Math.floor((room - NOTE_H) / ROW_MIN))) : fitAll;
  const note = medalTotal > visible;
  const rowH = visible ? Math.min(ROW_MAX, Math.floor((room - (note ? NOTE_H : 0)) / visible)) : 0;
  const sheetH = career ? (rows.length ? BAR_H : 0) + visible * rowH + (note ? NOTE_H : 0) + 2 * BORDER : 0;
  // The sheet sits at the foot; the window between it and the standings shows the picture (or the blank design).
  const sheetTop = BOTTOM - sheetH;
  const lines = await Promise.all(rows.slice(0, visible).map((row, index) => medalRow(row, rowH, index)));
  const sheet = career && sheetH > 2 * BORDER ? at(MARGIN, sheetTop, COL, sheetH, { ...panel, overflow: 'hidden' },
    rows.length ? titleBar('CAREER MEDALS', ink) : null,
    ...lines,
    note ? box({ height: NOTE_H, flexShrink: 0, alignItems: 'center', paddingLeft: INSET, background: PAPER, borderTop: lines.length ? 'none' : `1px solid ${RULE}` },
      cond('More medal finishes on Kaggle', 21, INK, 700)) : null) : null;

  // ---- the backdrop: the second picture where it can be seen, else the blank design ----
  const windowTop = top - GAP, windowBottom = career && sheetH > 2 * BORDER ? sheetTop : BOTTOM;
  let backdrop: Buffer | null = null;
  if (second) {
    const meta = await sharp(second).metadata();
    const ratio = (meta.width ?? 1) / (meta.height ?? 1);
    if (ratio <= 0.9) {
      // a portrait picture stays whole on the card (the panels sit over it); other shapes sit on a blurred copy
      if (Math.abs(ratio - W / H) < 0.005) backdrop = await sharp(second).resize(W, H, { fit: 'contain', background: '#c9c5b8' }).jpeg({ quality: 90 }).toBuffer();
      else {
        const fill = await sharp(second).rotate().resize(W, H, { fit: 'cover' }).blur(24).modulate({ brightness: 0.6 }).jpeg({ quality: 80 }).toBuffer();
        const whole = await sharp(second).rotate().resize(W, H, { fit: 'inside' }).toBuffer();
        backdrop = await sharp(fill).composite([{ input: whole, gravity: 'centre' }]).jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      // a wide picture (a scene of the team) fills the window edge to edge, cropped toward its subjects, so it is SEEN
      const sceneTop = Math.max(0, windowTop - 24), sceneH = Math.max(200, Math.min(H - sceneTop, windowBottom - sceneTop + 24));
      const fill = await sharp(second).rotate().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.45 }).jpeg({ quality: 80 }).toBuffer();
      const scene = await sharp(second).rotate().resize(W, sceneH, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
      backdrop = await sharp(fill).composite([{ input: scene, left: 0, top: sceneTop }]).jpeg({ quality: 90 }).toBuffer();
    }
  }

  // With no second picture, a tall window carries the card's imprint (set and publisher) in the tier colour, like the
  // maker's line on a printed card back, so the blank design reads as a designed panel rather than a hole.
  const windowH = windowBottom - windowTop - GAP;
  const imprint = !second && windowH >= 150 ? at(MARGIN, windowTop + GAP, COL, windowH,
    { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    bebas(vm.seriesLabel.toUpperCase(), 64, mix(vm.T.main, vm.T.light, 0.4), { opacity: 0.85, textAlign: 'center' }),
    vm.publisher ? bebas(vm.publisher.toUpperCase(), 30, '#ffffff', { opacity: 0.7, marginTop: 14 }) : null) : null;

  return box({ width: W, height: H, position: 'relative', background: '#000', overflow: 'hidden' },
    pic(jpegUri(backdrop ?? blank), 0, 0, W, H),
    imprint,
    at(MARGIN, MARGIN, COL, head.height, {}, head.node),
    stand ? at(MARGIN, MARGIN + head.height + GAP, COL, stand.height, {}, stand.node) : null,
    sheet,
    svgPic(backBorderSvg(vm.T), 0, 0, W, H));
}
