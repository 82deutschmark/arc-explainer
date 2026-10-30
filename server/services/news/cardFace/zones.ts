/**
 * Author: Claude Sonnet 5.5 Medium
 * Date: 30-Oct-2026
 * PURPOSE: The artist contract for a Card Cabinet front, as numbers. ONE module so the renderer (render.ts), the
 *          picture pipeline (art.ts) and the art desk's template (which works at 2x, 1500 x 2100) can never
 *          drift apart. Everything is stated at the 750 x 1050 card scale; zonesAt(2) gives the art desk's scale.
 *          Contract: 5:7 portrait, tier border over the outer 26 px, a 100 px badge band across the top (logo,
 *          pennant, stamp and number only, never a subject), the subject zone y 100 to 725, the information
 *          plate from y 724, eyes of a portrait roughly y 280 to 390.
 * SRP/DRY check: Pass. Constants only; no layout decisions and no imports.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Medium): first production version (numbers lifted from the approved Topps source).
 */

/** Card size in px at the production scale. */
export const W = 750;
export const H = 1050;
/** The art desk draws at this multiple of the card size (1500 x 2100). */
export const ART_SCALE = 2;
/** Width : height of every card. */
export const RATIO = '5:7';
/** Tier border thickness. Identical for every tier so the art window never moves. */
export const BORDER = 26;
/** The badge band: nothing but badges is drawn between the border and this y. */
export const BAND_BOTTOM = 100;
/** Top of the information plate (name ribbon and everything below it). */
export const PLATE_TOP = 724;
/** Where a portrait's eyes should land on contract art. */
export const EYES = { y0: 280, y1: 390 };
/** The subject zone of contract art: x 75..675, y 100..725. */
export const SUBJECT = { x: 75, y: BAND_BOTTOM, w: 600, h: PLATE_TOP + 1 - BAND_BOTTOM };

export interface Rect { x: number; y: number; w: number; h: number }
/** Where a legacy picture may sit: full card width, below the badge band, down to the name ribbon. */
export const PICTURE_WINDOW: Rect = { x: 0, y: BAND_BOTTOM, w: W, h: 728 - BAND_BOTTOM };

/** All zone numbers multiplied by `scale` (2 = the art desk's 1500 x 2100 template). */
export function zonesAt(scale: number) {
  const s = (n: number) => n * scale;
  const r = (q: Rect): Rect => ({ x: s(q.x), y: s(q.y), w: s(q.w), h: s(q.h) });
  return {
    w: s(W), h: s(H), border: s(BORDER), bandBottom: s(BAND_BOTTOM), plateTop: s(PLATE_TOP),
    eyes: { y0: s(EYES.y0), y1: s(EYES.y1) }, subject: r(SUBJECT), pictureWindow: r(PICTURE_WINDOW),
  };
}
