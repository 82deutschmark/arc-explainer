/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: FRONT LAYOUT of the Card Cabinet card (the 1986-88 Topps baseball card look): cream card stock, tier-colour
 *          band, ribbon name bar, round season logo and pennant, number box, starburst LIVE / FINAL stamp, round tier
 *          medallion, price-guide stats table, medal coins. Exports:
 *            front(card, opts)        -> 750 x 1050 PNG Buffer
 *            frontNode(card, opts)    -> the Satori node tree (lint it without rendering)
 *            frontBuffer(card, opts)  -> memoised front(), keyed by card id, as-of date, art mtime (+ a content digest),
 *                                        so the reverse's miniature never re-renders the front
 *            back(card, opts)         -> the reverse (layout is back.ts; this only renders its node)
 *            finishCard(png, flatten) -> rounded outer corners, flattened onto the page paper colour (or kept transparent)
 *          LAYOUT lives here (coordinates, what sits where); DATA decisions in model.ts; VISUAL vocabulary in kit.ts,
 *          tiers.ts, svgFrame.ts, svgBadges.ts; PICTURES in art.ts; zone numbers in zones.ts.
 *          Geometry follows the art contract: art full bleed, tier border over the outer 26 px, the top 100 px carries only
 *          badges (logo, pennant, stamp, number), the subject zone y 100..725 is left clear, name ribbon / stats / footer
 *          live on the plate from y 724. Nothing here names a contest, a series, a season or a tier: all of it is data
 *          (the card's series block, its contests, the tier table).
 * SRP/DRY check: Pass. Reuses box()/at()/pic() and the fonts from kit.ts, fit and measure helpers from kit.ts.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): front first version.
 * 30-Oct-2026 v2 (Claude Sonnet 5.5 Medium): four review rounds on the design pass.
 * 30-Oct-2026 v3 (Claude Sonnet 5.5 Medium): production, judges' fixes: stamp moved into the badge band beside the number box and
 *          it carries the single as-of date; legacy art edge to edge (plate, white keyline and comic captions removed); team
 *          roster printed by name and tier word in the free band (no initial circles); Grandmaster / Master announce themselves
 *          with bigger corner pieces and a heavier medallion, and every tier prints its full word large in the sub strip; contest
 *          tag carries the full contest name from data; solo entries say SOLO ENTRY; sponsor panel is dense; names break at spaces
 *          and middle dots, never inside a CJK word; no phrasing about what the renderer has or has not found; front buffer memo;
 *          rounded corners flattened onto a parameter colour; fonts and art read relative to process.cwd(); any failure falls back
 *          to a sanitised card rather than throwing.
 * 30-Oct-2026 v5 (Claude Sonnet 5.5 Medium, review fixes): no words printed on a placeholder picture; table and strip headers raised to a
 *          readable size; one team size from the roster; a competitor with no standings prints NO STANDINGS YET; the member-medal
 *          label says how many members it covers; the front memo holds a whole set.
 * 30-Oct-2026 v4 (Claude Sonnet 5.5 Low, wiring): finishCard() takes a palette flag so the flat-ink reverse stays small after the
 *          corners are rounded.
 */
import crypto from 'node:crypto';
import satori from 'satori';
import sharp from 'sharp';
import { FONT, ff, box, at, pic, svgPic, svgDoc, loadFonts, fitName, fitNameLines, textWidth, wrappedHeight, frameSvg, medallionSvg, stampSvg, starburst, halftone, mix, alpha, rr, MEDAL, TIERS, type Node, type Style } from './kit';
import { artLayer, artMtime, type ArtResult, type ArtOverride } from './art';
import { viewModel, num, type VM, type ContestVM } from './model';
import { backNode } from './back';
import { W, H, BORDER, BAND_BOTTOM } from './zones';
import { TIER_LADDER } from './tiers';

export { W, H } from './zones';
export interface RenderOpts {
  namesById?: Record<string, string>;
  tierOverride?: string | null;
  artOverride?: ArtOverride;
  /** Colour the transparent rounded corners are flattened onto. Default: the page paper. Pass null to keep them transparent. */
  flatten?: string | null;
}
/** The newspaper's page paper (matches newsCollectionImage.ts). */
export const PAPER = '#f7f0df';
const CORNER_RADIUS = 24;

/** Japanese / Chinese kana, kanji and full-width forms (the scripts the fallback face covers). */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;
const INK = '#07080d';
const WHITE = '#ffffff';

// ----------------------------------------------------------------------------------------------
// FRONT LAYOUT CONSTANTS (750 x 1050). Everything on the front is positioned from these.
// ----------------------------------------------------------------------------------------------
export const FL = {
  T: BORDER,                                // border thickness
  logo: { cx: 102, cy: 64, r: 33 },         // round set logo, top-left (inside the badge band)
  pennant: { x: 134, y: 40, w: 226, h: 48 },
  stamp: { x: 466, y: 28, s: 88 },          // LIVE / FINAL burst, in the band beside the number box
  numBox: { x: 572, y: 34, w: 100, h: 64 },
  ribbon: { y: 726, h: 64, x0: 26, x1: 724 },
  sub: { y: 790, h: 36 },
  panel: { y: 826, b: 1024 },
  strip: { y: 934, h: 44 },
  foot: { y: 986, h: 30 },
  medal: { cx: 98, cy: 762, r: 62 },        // base radius; a recipe's scale grows it
};

/** Coin for the medal strip (gold / silver / bronze), 36 px. */
const coinSvg = (c: string) => svgDoc(36, 36, `<circle cx="18" cy="18" r="16.5" fill="${c}" stroke="#000" stroke-width="2.4"/><circle cx="18" cy="18" r="11.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/><path d="M9 11 A12 12 0 0 1 20 6" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);

/** Everything drawn under the text: scrims, badge-band header, top badges, ribbon, sub strip and panel. One transparent SVG. */
function furnitureSvg(vm: VM, art: ArtResult): string {
  const T = vm.T, r = FL.ribbon, p = FL.panel;
  const defs = `${halftone('ht', T.main, 0.16, 7, 1.5)}${halftone('hd', '#000', 0.30, 5, 1.25)}
    <linearGradient id="scrimT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="scrimB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
    <linearGradient id="rib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(T.main, '#fff', 0.28)}"/><stop offset=".5" stop-color="${T.main}"/><stop offset="1" stop-color="${mix(T.main, T.deep, 0.42)}"/></linearGradient>
    <linearGradient id="pan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(T.deep, '#07080d', 0.5)}"/><stop offset="1" stop-color="#05060a"/></linearGradient>`;
  let s = '';
  const inner = W - 2 * FL.T;
  if (art.kind === 'legacy') {
    // legacy picture: the badge band is a printed header strip (dimmed blur, halftone) with a hard rule where the picture starts
    s += `<rect x="${FL.T}" y="${FL.T}" width="${inner}" height="${BAND_BOTTOM - FL.T}" fill="#000" opacity=".38"/><rect x="${FL.T}" y="${FL.T}" width="${inner}" height="${BAND_BOTTOM - FL.T}" fill="url(#hd)"/>`;
    s += `<rect x="${FL.T}" y="${BAND_BOTTOM - 3}" width="${inner}" height="3" fill="#000"/><rect x="${FL.T}" y="${BAND_BOTTOM - 6}" width="${inner}" height="3" fill="${T.main}"/>`;
    if (art.mode === 'contain' && art.plate) { // a contained picture gets a thin black printed edge (no white mat)
      const q = art.plate;
      s += `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="#000" stroke-width="3"/>`;
    }
  } else {
    s += `<rect x="${FL.T}" y="${FL.T}" width="${inner}" height="110" fill="url(#scrimT)"/>`;
  }
  s += `<rect x="${FL.T}" y="${r.y - 110}" width="${inner}" height="110" fill="url(#scrimB)"/>`;
  // set logo (round) and pennant
  const L = FL.logo, P = FL.pennant;
  const pen = `M${P.x} ${P.y}H${P.x + P.w}L${P.x + P.w - 20} ${P.y + P.h / 2}L${P.x + P.w} ${P.y + P.h}H${P.x}Z`;
  s += `<path d="${pen}" transform="translate(4 5)" fill="#000" opacity=".55"/><path d="${pen}" fill="${T.deep}" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="${pen}" fill="url(#hd)"/><path d="${rr(P.x + 5, P.y + 5, P.w - 34, P.h - 10, 2)}" fill="none" stroke="${T.main}" stroke-width="1.8"/>`;
  s += `<circle cx="${L.cx + 3}" cy="${L.cy + 4}" r="${L.r}" fill="#000" opacity=".55"/><circle cx="${L.cx}" cy="${L.cy}" r="${L.r}" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="${L.cx}" cy="${L.cy}" r="${L.r - 5}" fill="${T.main}" stroke="#000" stroke-width="2"/><circle cx="${L.cx}" cy="${L.cy}" r="${L.r - 9}" fill="none" stroke="${T.ink}" stroke-opacity=".7" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  // number box
  const N = FL.numBox;
  s += `<rect x="${N.x + 4}" y="${N.y + 5}" width="${N.w}" height="${N.h}" fill="#000" opacity=".55"/><rect x="${N.x}" y="${N.y}" width="${N.w}" height="${N.h}" fill="#fff" stroke="#000" stroke-width="3.2"/><rect x="${N.x}" y="${N.y}" width="${N.w}" height="16" fill="${T.main}" stroke="#000" stroke-width="3.2"/>`;
  // the name ribbon: pennant shape pointing right, hard shadow, outline and inner white keyline
  const rb = `M${r.x0} ${r.y}H${r.x1 - 24}L${r.x1} ${r.y + r.h / 2}L${r.x1 - 24} ${r.y + r.h}H${r.x0}Z`;
  s += `<path d="${rb}" transform="translate(5 6)" fill="#000" opacity=".6"/><path d="${rb}" fill="url(#rib)" stroke="#000" stroke-width="4" stroke-linejoin="round"/><path d="${rr(r.x0 + 6, r.y + 5, r.x1 - r.x0 - 40, r.h - 10, 3)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"/>`;
  // sub strip and the stats panel
  const sb = FL.sub;
  s += `<rect x="${FL.T}" y="${sb.y}" width="${inner}" height="${sb.h}" fill="#07080d"/><rect x="${FL.T}" y="${sb.y + sb.h - 3}" width="${inner}" height="3" fill="${T.main}"/>`;
  s += `<rect x="${FL.T}" y="${p.y}" width="${inner}" height="${p.b - p.y}" fill="url(#pan)" opacity=".97"/><rect x="${FL.T}" y="${p.y}" width="${inner}" height="${p.b - p.y}" fill="url(#ht)"/>`;
  return svgDoc(W, H, s, defs);
}

// ----------------------------------------------------------------------------------------------
// Front text helpers
// ----------------------------------------------------------------------------------------------
const label = (text: string, size: number, color: string, style: Style = {}): Node =>
  box({ fontFamily: ff(FONT.bebas), fontSize: size, color, letterSpacing: size * 0.06, lineHeight: 1, whiteSpace: 'nowrap', ...style }, text);
const nowrap = (style: Style, text: string): Node => box({ whiteSpace: 'nowrap', ...style }, text);

/** A contest row's columns. PEAK only on LIVE cards with at least one peak; SUBS only when any row has them. */
function columns(vm: VM) {
  const cs = vm.contests, peak = vm.showPeak && cs.some(c => c.peak), subs = cs.some(c => c.subs);
  return { peak, subs, rankW: 140, peakW: peak ? 78 : 0, scoreW: 108, subsW: subs ? 74 : 0 };
}

/** The contest table of the front panel (price-guide header plus one row per contest). RANK is the biggest figure. */
async function contestTable(vm: VM, y: number, h: number): Promise<Node[]> {
  const T = vm.T, cs = vm.contests, col = columns(vm);
  const x0 = FL.T + 12, x1 = W - FL.T - 12;
  const labelW = x1 - x0 - col.rankW - col.peakW - col.scoreW - col.subsW;
  const headH = 16, rowH = Math.min(100, Math.floor((h - headH) / cs.length));
  const tall = rowH > 80;
  const big = Math.min(62, Math.max(36, rowH - 7)), mid = Math.max(21, Math.round(big * 0.42));
  const tagSize = tall ? 24 : 15;
  const head = (t: string, w: number) => box({ width: w, justifyContent: 'flex-end' }, label(t, 17, T.light, { opacity: 0.9 }));
  const nodes: Node[] = [
    at(x0, y, x1 - x0, headH, { alignItems: 'center', borderBottom: `1.5px solid ${alpha(T.main, 0.7)}` },
      box({ width: labelW }, label('CONTEST', 17, T.light, { opacity: 0.9 })),
      head('RANK', col.rankW), col.peak ? head('PEAK', col.peakW) : null, head('SCORE', col.scoreW), col.subs ? head('SUBS', col.subsW) : null),
  ];
  for (let i = 0; i < cs.length; i++) {
    const c: ContestVM = cs[i];
    // the full contest name (series and season come from data); the short name when the long one would not fit
    const longTag = c.tag.toUpperCase();
    const tag = (await textWidth(longTag, FONT.bebas, 400, tagSize, tagSize * 0.06)) + 22 <= labelW - 8 ? longTag : c.short.toUpperCase();
    const cell = (v: string | null, w: number, size: number, fam: string, wt: number, color: string) =>
      box({ width: w, justifyContent: 'flex-end', alignItems: 'center', height: rowH }, v ? box({ fontFamily: ff(fam), fontWeight: wt, fontSize: size, color, letterSpacing: fam === FONT.slab ? 0 : -0.5, lineHeight: 1 }, v) : null);
    const entry = c.entryLine == null ? null
      : c.solo ? label(c.entryLine, tall ? 19 : 14, T.light, { marginTop: tall ? 6 : 2, letterSpacing: 1.8 })
      : nowrap({ marginTop: tall ? 5 : 2, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: tall ? 20 : 15, color: WHITE, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', width: labelW - 10 }, c.entryLine);
    nodes.push(at(x0, y + headH + i * rowH, x1 - x0, rowH, { alignItems: 'center', background: i % 2 ? 'rgba(255,255,255,0.05)' : 'transparent', borderBottom: i === cs.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.14)' },
      box({ width: labelW, flexDirection: 'column', justifyContent: 'center', paddingRight: 8 },
        nowrap({ alignSelf: 'flex-start', background: T.main, color: T.ink, fontFamily: ff(FONT.bebas), fontSize: tagSize, lineHeight: 1, letterSpacing: tagSize * 0.06, padding: tall ? '3px 10px 2px 10px' : '2px 7px 1px 7px', border: '2px solid #000', boxShadow: '2px 2px 0 #000' }, tag),
        entry),
      cell(c.rank, col.rankW, big, FONT.slab, 400, WHITE),
      col.peak ? cell(c.peak, col.peakW, mid, FONT.mono, 700, T.light) : null,
      cell(c.score, col.scoreW, mid, FONT.mono, 700, WHITE),
      col.subs ? cell(c.subs, col.subsW, mid, FONT.mono, 700, T.light) : null));
  }
  return nodes;
}

const medalCell = (c: string, n: number, size = 28): Node =>
  box({ alignItems: 'center', marginRight: 12 }, { type: 'img', props: { src: `data:image/svg+xml;base64,${Buffer.from(coinSvg(c)).toString('base64')}`, width: 36, height: 36 } } as Node,
    box({ fontFamily: ff(FONT.slab), fontSize: size, color: WHITE, marginLeft: 6, lineHeight: 1 }, num(n)));

/** The roster of a team card, by name with the tier word in the tier's colour, two columns, on a dark plate in the blurred band. */
function rosterBand(vm: VM, band: { x: number; y: number; w: number; h: number }, clearY: number): Node {
  const T = vm.T;
  band = { ...band, h: Math.min(band.h, clearY - band.y) }; // stop above the medallion, which rises into the band
  const order = [...vm.roster].sort((a, b) => TIER_LADDER.indexOf(b.tier ?? '') - TIER_LADDER.indexOf(a.tier ?? ''));
  const cap = Math.max(1, Math.floor((band.h - 16) / 26));
  const perCol = Math.min(cap, Math.ceil(order.length / 2));
  const rowH = Math.min(34, Math.floor((band.h - 16) / perCol)), fs = rowH >= 32 ? 21 : 18;
  const listed = order.slice(0, perCol * 2);
  const more = order.length - listed.length;
  const entry = (r: VM['roster'][number]) => box({ alignItems: 'center', height: rowH, width: 316 },
    nowrap({ fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: fs, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: r.tier ? 196 : 300 }, r.name),
    r.tier ? label(r.tier.toUpperCase(), fs - 3, TIERS[r.tier].main, { marginLeft: 10, letterSpacing: 1.4 }) : null);
  const colOf = (i: number) => listed.slice(i * perCol, (i + 1) * perCol).map(entry);
  return at(FL.T + 8, band.y + 6, W - 2 * FL.T - 16, band.h - 12, { background: 'rgba(5,6,10,0.72)', border: `2px solid ${alpha(T.main, 0.9)}`, padding: '5px 12px', alignItems: 'flex-start', justifyContent: 'space-between' },
    box({ flexDirection: 'column' }, ...colOf(0)),
    box({ flexDirection: 'column' }, ...colOf(1), more > 0 ? label(`+${more} MORE`, 15, T.light, { height: rowH, alignItems: 'center' }) : null));
}

// ----------------------------------------------------------------------------------------------
// FRONT NODE
// ----------------------------------------------------------------------------------------------
async function buildFront(card: any, opts: RenderOpts): Promise<{ root: Node; art: ArtResult }> {
  const vm = viewModel(card, opts);
  const T = vm.T;
  // a team's wide picture is trimmed less so the blurred band under it can carry the roster; everyone else's grows
  const art = await artLayer(card, T, { ...opts.artOverride, wideMax: opts.artOverride?.wideMax ?? (vm.family === 'team' ? 1.7 : 1.3) });
  const M = { ...FL.medal }, mScale = T.medal.scale, mR = Math.round(M.r * mScale);
  M.cy -= Math.round((mScale - 1) * 30); // a grown medallion rises so its foot stays clear of the stats table
  const nameX = vm.hasBadge ? M.cx + mR + 10 : 50;
  const nameW = 696 - nameX;
  const nameText = vm.name.toUpperCase();
  const fit = await fitNameLines(nameText, FONT.slab, 400, nameW, FL.ribbon.h - 10, { max: 46, min: 30, twoLineMax: 29, twoLineMin: 18 });

  const kids: Node[] = [];
  kids.push(pic(`data:${art.mime};base64,${art.png.toString('base64')}`, 0, 0, W, H));
  kids.push(svgPic(furnitureSvg(vm, art), 0, 0, W, H));
  kids.push(svgPic(frameSvg(T, W, H, 1), 0, 0, W, H));

  // ---- top badges: season logo, series pennant, stamp, number ----
  const season = vm.season;
  if (season) kids.push(at(FL.logo.cx - 30, FL.logo.cy - 30, 60, 60, { alignItems: 'center', justifyContent: 'center' },
    box({ fontFamily: ff(FONT.slab), fontSize: season.length > 4 ? 15 : 20, color: T.ink, lineHeight: 1, textShadow: T.ink === '#ffffff' ? '1.5px 1.5px 0 #000' : 'none' }, season)));
  const wm = vm.wordmark.toUpperCase();
  const wmSize = (await textWidth(wm, FONT.bebas, 400, 28, 1.6)) <= 160 ? 28 : 22;
  kids.push(at(FL.pennant.x + 12, FL.pennant.y, FL.pennant.w - 40, FL.pennant.h, { alignItems: 'center', flexDirection: 'column', justifyContent: 'center' },
    nowrap({ fontFamily: ff(FONT.bebas), fontSize: wmSize, color: WHITE, letterSpacing: 1.6, lineHeight: 1, textShadow: '1.5px 1.5px 0 #000' }, wm),
    vm.publisher ? nowrap({ fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 10.5, color: T.light, letterSpacing: 0.8, marginTop: 2 }, vm.publisher.toUpperCase()) : null));
  const N = FL.numBox;
  kids.push(at(N.x, N.y, N.w, 16, { alignItems: 'center', justifyContent: 'center' }, box({ fontFamily: ff(FONT.bebas), fontSize: 14, color: T.ink, letterSpacing: 2, lineHeight: 1 }, 'NO.')));
  kids.push(at(N.x, N.y + 17, N.w, N.h - 17, { alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
    box({ fontFamily: ff(FONT.slab), fontSize: 27, color: INK, lineHeight: 1 }, vm.number),
    vm.numberOf ? box({ fontFamily: ff(FONT.bebas), fontSize: 14, color: '#3a3a44', letterSpacing: 1.4, lineHeight: 1, marginTop: 1 }, `OF ${num(vm.numberOf)}`) : null));
  if (vm.stamp) {
    // the one as-of date on the face: inside the burst, in the badge band, clear of the subject zone
    const S = FL.stamp, live = vm.stamp.word === 'LIVE';
    kids.push(box({ position: 'absolute', left: S.x, top: S.y, width: S.s, height: S.s, transform: 'rotate(-9deg)' },
      svgPic(stampSvg(vm.stamp.word, S.s), 0, 0, S.s, S.s),
      at(0, 0, S.s, S.s, { alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
        box({ fontFamily: ff(FONT.comic), fontSize: live ? 27 : 22, color: live ? WHITE : '#f2c230', lineHeight: 1, letterSpacing: 1, textShadow: '1.5px 1.5px 0 #000' }, vm.stamp.word),
        box({ fontFamily: ff(FONT.bebas), fontSize: 10, color: WHITE, letterSpacing: 1.2, lineHeight: 1, marginTop: 1 }, 'AS OF'),
        box({ fontFamily: ff(FONT.bebas), fontSize: 15, color: live ? '#ffe9a8' : WHITE, letterSpacing: 0.8, lineHeight: 1 }, vm.stamp.date))));
  }

  // (no words on a placeholder picture: the silhouette stands alone)
  // ---- the team roster in the blurred band under a contained wide picture ----
  if (art.freeBand && vm.family === 'team' && vm.roster.length) kids.push(rosterBand(vm, art.freeBand, M.cy - mR - 6));

  // ---- ribbon: the name, one line or two, each line unbroken ----
  kids.push(at(nameX, FL.ribbon.y, nameW, FL.ribbon.h, { alignItems: 'center' },
    box({ flexDirection: 'column', fontFamily: ff(FONT.slab), fontSize: fit.size, color: T.ink, lineHeight: fit.lines.length === 2 ? 1.04 : 1, letterSpacing: 0.4,
      ...(T.ink === '#ffffff' ? { textShadow: `2px 2px 0 ${T.deep}` } : { textShadow: `1px 1px 0 ${alpha('#ffffff', 0.35)}` }),
      // the CJK fallback face is a regular weight and washes out on a coloured ribbon: thicken it with a same-colour stroke
      ...(CJK.test(nameText) ? { WebkitTextStroke: `1.3px ${T.ink}` } : {}) },
      ...fit.lines.map(l => nowrap({}, l)))));

  // ---- sub strip: what this is, the full tier word big enough for a thumbnail, and the overall rank ----
  const subLeft = vm.hasBadge ? nameX - 6 : 40;
  const tierColour = mix(T.main, T.light, 0.35);
  const bestTier = vm.family === 'team' ? vm.roster.map(r => r.tier).filter(Boolean).sort((a, b) => TIER_LADDER.indexOf(b!) - TIER_LADDER.indexOf(a!))[0] : null;
  const dot = () => label('·', 22, T.main, { margin: '0 9px' });
  kids.push(at(subLeft, FL.sub.y, 724 - subLeft - 14, FL.sub.h - 3, { alignItems: 'center', justifyContent: 'space-between' },
    box({ alignItems: 'center' },
      label(vm.typeLabel, 19, WHITE, { letterSpacing: 2 }),
      vm.tierWord ? dot() : null,
      vm.tierWord ? label(vm.tierWord, 31, tierColour, { letterSpacing: 2.2, textShadow: '2px 2px 0 #000' }) : null,
      vm.family === 'team' && vm.sizeLabel ? dot() : null,
      vm.family === 'team' && vm.sizeLabel ? label(vm.sizeLabel, 19, T.light, { letterSpacing: 2 }) : null,
      vm.family === 'sponsor' && vm.role ? dot() : null,
      vm.family === 'sponsor' && vm.role ? label(vm.role.toUpperCase(), 19, T.light, { letterSpacing: 2 }) : null),
    vm.overall ? box({ alignItems: 'baseline' }, label('KAGGLE RANK', 16, T.light, { opacity: 0.85, marginRight: 6 }), box({ fontFamily: ff(FONT.mono), fontWeight: 700, fontSize: 17, color: WHITE }, vm.overall.rank), vm.overall.outOf ? box({ fontFamily: ff(FONT.mono), fontWeight: 500, fontSize: 12.5, color: T.light, marginLeft: 6 }, `OF ${vm.overall.outOf}`) : null)
      : bestTier ? box({ alignItems: 'baseline' }, label('BEST TIER', 16, T.light, { opacity: 0.85, marginRight: 8 }), label(bestTier.toUpperCase(), 24, mix(TIERS[bestTier].main, TIERS[bestTier].light, 0.35), { letterSpacing: 1.6 })) : null));

  // ---- tier / team / sponsor medallion (grows with the recipe; the ladder meter is part of the drawing) ----
  if (vm.hasBadge) {
    const d = mR * 2, left = M.cx - mR, top = M.cy - mR;
    kids.push(svgPic(medallionSvg(T, d), left, top, d, d));
    const abbr = vm.family === 'competitor' ? T.abbr : '';
    // letters sit a little above centre when the ladder meter takes the bottom of the disc
    const lift = T.medal.meter ? -8 : -2;
    if (abbr) kids.push(at(left, top + lift, d, d, { alignItems: 'center', justifyContent: 'center' },
      box({ fontFamily: ff(FONT.slab), fontSize: Math.round((abbr.length > 1 ? 40 : 54) * mScale), color: T.ink, lineHeight: 1, textShadow: T.ink === '#ffffff' ? '2px 2px 0 rgba(0,0,0,0.65)' : '1px 1px 0 rgba(255,255,255,0.5)', letterSpacing: abbr.length > 1 ? -1 : 0 }, abbr)));
    if (vm.family === 'team') kids.push(at(left, top, d, d, { alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
      label('TEAM', 15, T.accent, { marginBottom: 2 }), box({ fontFamily: ff(FONT.slab), fontSize: 44, color: WHITE, lineHeight: 1 }, String(vm.teamSize ?? vm.contests[0]?.size ?? vm.roster.length))));
    if (vm.family === 'sponsor') kids.push(at(left, top, d, d, { alignItems: 'center', justifyContent: 'center' },
      svgPic(svgDoc(60, 60, `<polygon points="${starburst(30, 31, 5, 28, 11.5)}" fill="#fff" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/>`), 0, 0, 60, 60, { position: 'relative' })));
  }

  // ---- stats panel ----
  const panelTop = FL.panel.y + 2, tableH = FL.strip.y - panelTop - 2;
  if (vm.contests.length) {
    kids.push(...await contestTable(vm, panelTop, tableH));
  } else {
    // no standings (a sponsor): the panel is one dense block, organisation in slab type and the bio sized to fill it
    const textW = W - 2 * FL.T - 28;
    const text = vm.bare ? null : vm.bio ?? vm.facts.slice(0, 2).join(' ');   // a bare card's bio only repeats the footer handle
    let avail = tableH - 6, org: Node | null = null;
    const heading = vm.organisation ?? (vm.bare ? 'NO STANDINGS YET' : null);
    if (heading) { org = box({ fontFamily: ff(FONT.slab), fontSize: vm.bare ? 50 : 27, color: WHITE, lineHeight: 1.05, textTransform: 'uppercase', whiteSpace: 'nowrap', marginBottom: 5 }, heading); avail -= vm.bare ? 56 : 33; }
    let bioSize = 16;
    if (text) for (const s of [23, 21, 19, 17, 16]) { bioSize = s; if ((await wrappedHeight(text, FONT.cond, 500, s, 1.22, textW)) <= avail) break; }
    kids.push(at(FL.T + 14, panelTop + 4, textW, tableH - 4, { flexDirection: 'column' }, org,
      text ? box({ display: 'block', fontFamily: ff(FONT.cond), fontWeight: 500, fontSize: bioSize, lineHeight: 1.22, color: '#eceff6', lineClamp: Math.max(1, Math.floor(avail / (bioSize * 1.22))) }, text) : null));
  }

  // ---- strip: medals (people and teams), the team's names when no roster band, the note ----
  const stripKids: (Node | null)[] = [];
  if (vm.medals) stripKids.push(box({ alignItems: 'center' }, medalCell(MEDAL.gold, vm.medals.gold), medalCell(MEDAL.silver, vm.medals.silver), medalCell(MEDAL.bronze, vm.medals.bronze)));
  if (vm.family === 'team') {
    if (vm.rosterMedals) stripKids.push(box({ alignItems: 'center' },
      medalCell(MEDAL.gold, vm.rosterMedals.totals.gold, 26), medalCell(MEDAL.silver, vm.rosterMedals.totals.silver, 26), medalCell(MEDAL.bronze, vm.rosterMedals.totals.bronze, 26),
      label(vm.rosterMedals.known === vm.rosterMedals.of ? 'MEMBER MEDALS' : `${vm.rosterMedals.known} OF ${vm.rosterMedals.of} MEMBERS`, 16, T.light, { opacity: 0.9, marginLeft: 2 })));
    else stripKids.push(null);
    if (!art.freeBand && vm.roster.length) {
      // no blurred band to hold the roster: print the names (tier word in colour) in the strip's free width
      const names = vm.roster.slice(0, 6);
      stripKids.push(box({ flexGrow: 1, flexWrap: 'wrap', justifyContent: 'flex-end', maxHeight: FL.strip.h - 4, overflow: 'hidden' },
        ...names.map(r => box({ alignItems: 'baseline', marginLeft: 12 }, nowrap({ fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 15, color: WHITE }, r.name), r.tier ? label(r.tier.toUpperCase(), 12, TIERS[r.tier].main, { marginLeft: 5 }) : null))));
    }
  }
  // the note: an honour first (a champion stamp), else the best finish, else who a shared picture shows
  const bf = vm.bestFinishParts;
  const note: { l1: string; l2: string | null; gold: boolean } | null =
    vm.honour ? { l1: vm.honour.toUpperCase(), l2: bf ? `BEST FINISH ${bf.place}` : null, gold: true }
    : vm.family === 'sponsor' && vm.sharedWith.length ? { l1: `PICTURED WITH ${vm.sharedWith.join(' · ').toUpperCase()}`, l2: null, gold: false }
    : vm.family === 'competitor' && bf ? { l1: `BEST FINISH ${bf.place}`, l2: bf.competition, gold: false } : null;
  if (note && vm.family !== 'team') {
    const used = vm.medals ? 240 : 0;
    const nw = W - 2 * FL.T - 28 - used;
    const nf = await fitName(note.l1, FONT.bebas, 400, nw - 48, note.l2 ? 26 : 40, { max: note.l2 ? 24 : 27, min: 16, twoLineMax: 20, twoLineMin: 15 });
    stripKids.push(box({ alignItems: 'center', width: nw, justifyContent: vm.medals ? 'flex-end' : 'flex-start' },
      svgPic(svgDoc(34, 34, `<polygon points="${starburst(17, 17, 8, 15.5, 11)}" fill="#f2c230" stroke="#000" stroke-width="2" stroke-linejoin="round"/><polygon points="${starburst(17, 17.5, 5, 7.5, 3.2)}" fill="#7a1018"/>`), 0, 0, 34, 34, { position: 'relative', marginRight: 8, flexShrink: 0 }),
      box({ width: nw - 48, flexDirection: 'column' },
        box({ fontFamily: ff(FONT.bebas), fontSize: nf.size, color: note.gold ? '#ffd24a' : WHITE, letterSpacing: 1, lineHeight: 1.04 }, note.l1),
        note.l2 ? nowrap({ marginTop: 2, fontFamily: ff(FONT.cond), fontWeight: 700, fontSize: 14, color: T.light, overflow: 'hidden', textOverflow: 'ellipsis', width: nw - 52 }, note.l2) : null)));
  }
  kids.push(at(FL.T + 14, FL.strip.y, W - 2 * FL.T - 28, FL.strip.h, { alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${alpha(T.main, 0.8)}` }, ...stripKids));

  // ---- footer: handle on its platform, publisher. Clear of the corner pieces. ----
  kids.push(at(92, FL.foot.y, W - 184, FL.foot.h, { alignItems: 'center', justifyContent: 'space-between' },
    vm.handleLine ? nowrap({ fontFamily: ff(FONT.mono), fontWeight: 700, fontSize: 14, color: T.light }, vm.handleLine) : box({}),
    vm.publisher ? label(vm.publisher.toUpperCase(), 15, WHITE, { opacity: 0.8, letterSpacing: 2 }) : null));

  return { root: box({ width: W, height: H, position: 'relative', background: '#000', overflow: 'hidden' }, ...kids), art };
}

/** The Satori node tree of a front (so a test can lint it without rasterising). */
export async function frontNode(card: any, opts: RenderOpts = {}): Promise<Node> {
  return (await buildFront(card, opts)).root;
}

// ----------------------------------------------------------------------------------------------
// Rasterising and finishing
// ----------------------------------------------------------------------------------------------
async function rasterise(root: Node): Promise<Buffer> {
  const svg = await satori(root as any, { width: W, height: H, fonts: loadFonts() });
  return sharp(Buffer.from(svg), { density: 144 }).resize(W, H, { kernel: 'lanczos3' }).png({ compressionLevel: 6, adaptiveFiltering: false }).toBuffer();
}

/** Rounded outer corners, then flattened onto `flatten` (the page paper by default); null keeps the corners transparent. */
export async function finishCard(png: Buffer, flatten: string | null = PAPER, palette = false): Promise<Buffer> {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="#fff"/></svg>`);
  let p = sharp(png).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
  if (flatten) p = p.flatten({ background: flatten });
  // `palette` is for the flat-ink reverse (index.ts): 256 colours lose nothing visible there and keep the file small.
  return (palette ? p.png({ palette: true, colours: 256, quality: 90, dither: 0.6, effort: 7, compressionLevel: 9 }) : p.png({ compressionLevel: 6, adaptiveFiltering: false })).toBuffer();
}

/** A card that cannot break the renderer: names reduced to scripts the fonts cover, free text dropped. Used only after a failure. */
function sanitised(card: any): any {
  const plain = (t: unknown) => String(t ?? '').replace(/[^\x20-\x7eÀ-ɏ]/g, '').trim() || 'CARD';
  return { ...card, name: plain(card?.name), handle: null, bio: null, facts: [], honors: [], career: null, roster: [], pastTeams: [], contests: (card?.contests ?? []).map((c: any) => ({ ...c, team: null })), art: { ...(card?.art ?? {}), file: null, kind: 'none' } };
}

/** The front as a 750 x 1050 PNG. Never throws for odd input: a failed render is retried on a sanitised copy of the card. */
export async function front(card: any, opts: RenderOpts = {}): Promise<Buffer> {
  const flatten = opts.flatten === undefined ? PAPER : opts.flatten;
  try { return await finishCard(await rasterise((await buildFront(card, opts)).root), flatten); }
  catch (e) {
    console.warn(`[cardFace] front render failed for ${card?.id ?? '?'}: ${(e as Error)?.message}; retrying on a sanitised card`);
    return finishCard(await rasterise((await buildFront(sanitised(card), { ...opts, artOverride: undefined })).root), flatten);
  }
}

// Memo: the reverse shows a miniature of the front art and must not re-render the front. Keyed by card id, as-of date and the
// art file's mtime, plus a digest of the card's own data so a same-day data change is never served stale.
const memo = new Map<string, Promise<Buffer>>();
const MEMO_MAX = 90;                // a whole crawl of the set, so a sequential pass hits instead of missing every time
export function frontKey(card: any, opts: RenderOpts = {}): string {
  const shared = (card?.art?.sharedWith ?? []).map((id: string) => opts.namesById?.[id] ?? '');
  const digest = crypto.createHash('md5').update(JSON.stringify([card, shared, opts.tierOverride ?? null, opts.artOverride ?? null])).digest('hex').slice(0, 12);
  return [card?.id, card?.asOfDate ?? '', artMtime(card, opts.artOverride), opts.flatten === undefined ? PAPER : opts.flatten ?? 'none', digest].join('|');
}
export function frontBuffer(card: any, opts: RenderOpts = {}): Promise<Buffer> {
  const key = frontKey(card, opts);
  let hit = memo.get(key);
  if (hit) { memo.delete(key); memo.set(key, hit); return hit; } // refresh recency
  hit = front(card, opts);
  memo.set(key, hit);
  hit.catch(() => memo.delete(key));
  while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string);
  return hit;
}

// ----------------------------------------------------------------------------------------------
// BACK (layout lives in back.ts; this just renders its node)
// ----------------------------------------------------------------------------------------------
export async function back(card: any, opts: RenderOpts = {}): Promise<Buffer> {
  const flatten = opts.flatten === undefined ? PAPER : opts.flatten;
  const vm = viewModel(card, opts);
  const art = await artLayer(card, vm.T, opts.artOverride);
  const root = await backNode(vm, art);
  return finishCard(await rasterise(root), flatten);
}
