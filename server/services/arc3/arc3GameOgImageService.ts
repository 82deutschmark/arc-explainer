/*
 * Author: Claude Opus 5
 * Date: 2026-09-12
 * PURPOSE: Builds the 1200x630 link-preview card for an official ARC-AGI-3 game page,
 *          from that game's own level-1 frame.
 *
 *          WHY A CARD RATHER THAN THE PNG ITSELF. The committed level frames are 256x256
 *          (a 64x64 board at 4x, see scripts/arc3/render_public_demo_levels.py). Handing a
 *          256px square to og:image gets it rendered as a small thumbnail next to the text
 *          on every surface that unfurls links, and Twitter's summary_large_image wants a
 *          wide image and treats a square one poorly. So the frame is composited onto the
 *          standard 1200x630 canvas instead, on the same #1a1a2e ground the puzzle cards
 *          use (ogImageService.ts), and the unfurl actually shows the game.
 *
 *          NEAREST-NEIGHBOUR, DELIBERATELY. These frames are pixel art with 4px cells.
 *          Any smooth kernel turns the board into mush -- the same mistake the spoiler
 *          page was making by displaying a 256px render at 291px until today. `kernel:
 *          'nearest'` keeps the cells square and the palette exact.
 *
 *          NO TEXT ON THE CARD. Not an oversight: sharp renders text through librsvg,
 *          which needs fonts present in the container, and the image would silently lose
 *          its text or fail to render where they are missing. ogImageService draws grids
 *          and an arrow and no words for the same reason. The title and description reach
 *          the unfurl through the meta tags, which is where text belongs anyway.
 *
 *          CACHING IS A PLAIN MAP, NOT AN LRU WITH A TTL. The input is a file committed to
 *          this repository: it cannot change while the process is alive, only across a
 *          redeploy, and there are 26 of them. A TTL would re-render identical bytes on a
 *          timer and an eviction policy would be managing a few megabytes at most.
 *
 * SRP/DRY check: Pass -- image composition for the official-game pages only. The puzzle
 *          OG cards stay in ogImageService.ts (different input entirely: an ARCTask's
 *          grids, drawn cell by cell), and the blind gallery's live-rendered thumbnails
 *          stay in Arc3MirrorThumbnails.ts. This one reads a committed PNG and frames it.
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getGameById } from '../../../shared/arc3Games';
import { logger } from '../../utils/logger';

/** Matches the puzzle cards in ogImageService.ts, so a shared link looks like this site. */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BACKGROUND_COLOR = { r: 26, g: 26, b: 46 };

/** Leaves a margin on the short edge so the board is not flush against the crop. */
const FRAME_SIZE = 540;

const cardCache = new Map<string, Buffer>();

/**
 * Where a level screenshot actually lives on disk.
 *
 * `imageUrl` is a public path (`/arc3-levels/r11l/lvl1.png`). In production that file is
 * under dist/public, having been copied there by the client build; in development the
 * build may not have run, and client/public is the source of truth either way. Both are
 * checked so this works the same in both, and so a missing build is not a broken card.
 */
async function resolveFramePath(imageUrl: string): Promise<string | null> {
  const relative = imageUrl.replace(/^\//, '');
  const candidates = [
    path.join(process.cwd(), 'dist', 'public', relative),
    path.join(process.cwd(), 'client', 'public', relative),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next one; a miss here is normal, not an error.
    }
  }
  return null;
}

/**
 * The link-preview card for one official game, or null when it has no usable frame.
 *
 * Null rather than a placeholder on purpose: the caller drops `og:image` entirely, and an
 * unfurl with no image is better than one showing a grey box that says nothing about the
 * game. Every one of the 26 games has a level-1 render today, so this is the path for a
 * game added without one.
 */
export async function buildArc3GameOgImage(gameId: string): Promise<Buffer | null> {
  const cached = cardCache.get(gameId);
  if (cached) return cached;

  const game = getGameById(gameId);
  if (!game) return null;

  // The lowest-numbered level, not levelScreenshots[0]: the arrays are authored by hand
  // and a few games list a later level first.
  const opening = [...(game.levelScreenshots ?? [])].sort((a, b) => a.level - b.level)[0];
  if (!opening?.imageUrl) return null;

  const framePath = await resolveFramePath(opening.imageUrl);
  if (!framePath) {
    logger.warn(`arc3 og-image: no file on disk for ${gameId} at ${opening.imageUrl}`, 'arc3');
    return null;
  }

  try {
    const frame = await sharp(framePath)
      .resize(FRAME_SIZE, FRAME_SIZE, { kernel: 'nearest', fit: 'contain' })
      .toBuffer();

    const card = await sharp({
      create: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        channels: 3,
        background: BACKGROUND_COLOR,
      },
    })
      .composite([{ input: frame, gravity: 'centre' }])
      .png()
      .toBuffer();

    cardCache.set(gameId, card);
    return card;
  } catch (error) {
    logger.error(
      `arc3 og-image: failed to build card for ${gameId} - ${error instanceof Error ? error.message : String(error)}`,
      'arc3',
    );
    return null;
  }
}

/** Ops visibility, and used by the tests: how many cards are held. */
export function arc3GameOgImageCacheSize(): number {
  return cardCache.size;
}
