/*
Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: The storage side of fast special-page publishing. A special page (for example the
         Turducken write-up at /specials/2026-11-06-arc3-solution-draft.html) normally changes
         only through a full Railway build of the repo. This module keeps an "overlay" copy of
         chosen files under /specials/ on the Railway persistent volume, so an edit can go live
         in seconds through PUT /api/specials/file (routes/specialsPublish.ts) and be served by
         the read layer (middleware/specialsOverlay.ts) ahead of the copy baked into dist/public.

         ONE PATH RULE. resolveSpecialPath() is the only place a request path becomes a file
         path. It accepts nested relative paths (the article's images live several folders
         deep), rejects anything that is not a plain relative path on an allow-listed
         extension, and finally checks the resolved path is still inside the overlay root.
         Both the writer and the reader use it, so they cannot disagree.

         THE OVERLAY ENDS AT THE NEXT DEPLOY. Files are stored per Railway deployment
         (<volume>/specials-overlay/<RAILWAY_DEPLOYMENT_ID>/...). A restart keeps the same
         deployment id and keeps the overlay; a new deploy starts with an empty overlay and
         prunes the old ones, so the git copy that the new build baked in wins again. Without
         this, a stale API copy would silently shadow every later git edit forever. The rule
         that follows: every API push must also be committed to git, or the next deploy undoes it.

         Where: RAILWAY_VOLUME_MOUNT_PATH (set by Railway, /app/data in production), or
         SPECIALS_OVERLAY_ROOT to override (tests, local runs). With neither set the overlay is
         off and the site serves the baked files exactly as before.
SRP/DRY check: Pass -- path safety and file storage only. HTTP lives in the route and the
         middleware; the token check is the shared middleware/arc3AdminToken.ts.
*/

import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

/** Extensions a special page is made of. Checked case-insensitively on the path, never on a declared content type. */
export const SPECIALS_ALLOWED_EXTENSIONS = new Set([
  '.html', '.md', '.png', '.svg', '.csv', '.json', '.webp', '.jpg', '.jpeg', '.txt',
]);

/** The article's largest picture is about 4.5 MB; leave room, but refuse anything absurd. */
export const SPECIALS_MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Each segment: starts with a letter or digit (no dotfiles), then letters, digits, dot, dash, underscore. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_PATH_LENGTH = 300;

/** Root that holds one folder per deployment, or null when no volume is configured. */
export function overlayBaseDir(): string | null {
  const explicit = process.env.SPECIALS_OVERLAY_ROOT;
  if (explicit) return path.resolve(explicit);
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return volume ? path.resolve(volume, 'specials-overlay') : null;
}

/** The current deployment's overlay folder (mirrors the /specials/ URL tree), or null when off. */
export function overlayDir(): string | null {
  const base = overlayBaseDir();
  if (!base) return null;
  // Locally there is no deployment id; one fixed folder keeps local runs simple.
  const deployment = (process.env.RAILWAY_DEPLOYMENT_ID || 'local').replace(/[^A-Za-z0-9-]/g, '');
  return path.join(base, deployment || 'local');
}

/**
 * Turns a path relative to /specials/ (as sent by the publisher, or taken from the URL after
 * decoding) into an absolute file path under `root`. Returns null for anything unsafe or not
 * allow-listed. Callers pass already-decoded text; a leftover '%' is refused so a double-encoded
 * '..' cannot slip through a second decode somewhere else.
 */
export function resolveSpecialPath(root: string, relative: unknown): string | null {
  if (typeof relative !== 'string') return null;
  if (relative.length === 0 || relative.length > MAX_PATH_LENGTH) return null;
  if (/[\0\\%]/.test(relative)) return null;
  if (relative.startsWith('/')) return null;

  const segments = relative.split('/');
  if (!segments.every((segment) => SEGMENT.test(segment) && segment !== '.' && segment !== '..')) return null;

  const extension = path.extname(relative).toLowerCase();
  if (!SPECIALS_ALLOWED_EXTENSIONS.has(extension)) return null;

  // Belt and braces: whatever the rules above missed, the result must stay inside the root.
  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, ...segments);
  if (!target.startsWith(rootResolved + path.sep)) return null;
  return target;
}

/**
 * Writes one file atomically: a temp file in the same folder, then a rename, so a reader never
 * sees half an upload.
 */
export async function writeOverlayFile(target: string, body: Buffer): Promise<void> {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomBytes(6).toString('hex')}.uploading`;
  try {
    await fs.promises.writeFile(temp, body);
    await fs.promises.rename(temp, target);
  } catch (error) {
    await fs.promises.rm(temp, { force: true });
    throw error;
  }
}

/** Removes one overlay file so the baked copy shows again. Returns whether a file was removed. */
export async function removeOverlayFile(target: string): Promise<boolean> {
  try {
    await fs.promises.unlink(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Deletes overlay folders left by earlier deployments. Called once at startup; failures are
 * logged by the caller and never stop the server, because the stale folders are simply unused.
 */
export async function pruneOldOverlays(): Promise<string[]> {
  const base = overlayBaseDir();
  const current = overlayDir();
  if (!base || !current) return [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(base, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || path.join(base, entry.name) === current) continue;
    await fs.promises.rm(path.join(base, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}
