/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Full-bleed competitor fronts must keep a square source's subject in the middle. A synthetic
 *          square image carries a red stripe exactly down its centre; the cropped front layer must keep
 *          that stripe in its middle column (and move it when the card art sets focusX). Regression for
 *          sharp's `attention` crop, which pushed every square source the full 150px to one edge.
 * SRP/DRY check: Pass — drives the production artLayer() with a real file; no new helper.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, expect, it } from 'vitest';
import { artLayer } from '../server/services/news/cardFace/art';
import { W, H } from '../server/services/news/cardFace/zones';

const SIZE = 1024;
// art.ts only reads art under client/public or loose in the repo root (its path guard), so the
// synthetic image is written to the repo root for the duration of the test and removed after.
const file = path.join(process.cwd(), `card-crop-test-${process.pid}.png`);
afterAll(() => fs.rmSync(file, { force: true }));

async function stripedSquare(): Promise<void> {
  // Grey square with a 20px red stripe centred at x = 512, plus bright clutter at the right edge
  // (the kind of detail an attention crop chases).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <rect width="100%" height="100%" fill="#808080"/>
    <rect x="${SIZE / 2 - 10}" y="0" width="20" height="${SIZE}" fill="#ff0000"/>
    <rect x="${SIZE - 140}" y="0" width="140" height="${SIZE}" fill="#ffff00"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

/** x of the reddest column in the middle row of the rendered layer. */
async function stripeX(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const y = Math.floor(info.height / 2);
  let best = -1, bestScore = -Infinity;
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    const score = data[i] - (data[i + 1] + data[i + 2]) / 2;
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}

it('keeps a square source centred on a full-bleed front, and honours focusX', async () => {
  await stripedSquare();
  const card = (focusX?: number) => ({ art: { file, kind: 'registered', focusX } });
  const tier = {} as Parameters<typeof artLayer>[1];
  const centred = await artLayer(card(), tier, { coverPortrait: true });
  expect(centred.mode).toBe('full-bleed');
  expect(Math.abs(await stripeX(centred.png) - W / 2)).toBeLessThanOrEqual(12);

  // focusX 0.4 shifts the window left, so the centre stripe appears right of the middle.
  const shifted = await artLayer(card(0.4), tier, { coverPortrait: true });
  const scaled = Math.round(SIZE * (H / SIZE));
  const expected = Math.round(scaled / 2 - (0.4 * scaled - W / 2));
  expect(Math.abs(await stripeX(shifted.png) - expected)).toBeLessThanOrEqual(12);
});
